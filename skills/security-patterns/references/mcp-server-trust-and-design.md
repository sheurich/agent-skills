# MCP server trust and design

## Project-supplied MCP configuration is never auto-trusted, and the vetted set stays small
- Rule: Keep project-scoped MCP servers disabled by default and require an explicit per-project trust decision before loading them; set the flag explicitly even where it matches the current default so a future default cannot flip it, and standardize on a small reviewed server set chosen for low blast radius instead of accumulating servers.
- Threat: A checked-in `.mcp.json` declares arbitrary servers with arbitrary commands, so cloning and opening a compromised repository launches attacker-controlled processes.
- Mechanism: `"enableAllProjectMcpServers": false` in `settings.json`. The README warns that `.mcp.json` files sit in git, so a compromised repository can ship malicious MCP servers. Codex loads `.codex/config.toml` MCP entries only for trusted projects. The org-wide recommended set is two servers: Context7 (docs lookup, no API key, no side effects) and Exa (web search).
- Sources: `claude-code-config/main/settings.json`, `claude-code-config/main/README.md`, `codex-config/main/README.md`

## Pin the server's declared contract and re-approve any change
- Rule: Treat an MCP server's instructions, tool descriptions, and input and output schemas as a pinned contract hashed at first approval, refuse to use the server after any change until a human re-approves, re-check on every connect and on any tools-list-changed notification, and remember that pinning verifies the interface and not the backend behaviour.
- Threat: A server or a MITM in front of it silently expands what it can induce the agent to do after the operator reviewed it once — a rug pull.
- Mechanism: `MCPServerEntry` stores `approved_instructions_hash` and one hash per tool in `approved_tools`, computed by `_hash_tool_definition`/`_hash_instructions`, in `~/.mcp-context-protector/servers.json`; `MCPServerConfig.compare()` does a semantic comparison ignoring tool and parameter order; `_initialize_config()` and `_handle_tool_updates()` re-check.
- Sources: `mcp-context-protector/main/README.md`, `mcp-context-protector/main/src/contextprotector/mcp_config.py`, `mcp-context-protector/main/src/contextprotector/mcp_wrapper.py`

## Approval is per component, not per server
- Rule: Track approval separately for the server's instructions and for each individual tool by name and hash, so adding or changing one tool blocks only that tool while the rest keeps working, and return a structured reason distinguishing never-approved, instructions-changed, and this-tool-changed rather than an empty success.
- Threat: A coarse whole-server approval lets a newly added or silently modified tool through on the strength of an earlier review.
- Mechanism: `get_server_approval_status()` returns `{"server_approved", "instructions_approved", "tools": {name: bool}, "is_new_server"}`; `list_tools()` omits unapproved tools individually and `call_tool()` re-checks the same per-tool flag, raising `ValueError(json.dumps({"status": "blocked", "reason": "..."}))` with a distinct string per case.
- Sources: `mcp-context-protector/main/src/contextprotector/mcp_config.py`, `mcp-context-protector/main/src/contextprotector/mcp_wrapper.py`

## Fail closed on the discovery surface, not only on invocation
- Rule: While a server is unapproved, expose none of its tool, prompt, or resource metadata to the model — only a wrapper-provided tool explaining how to approve it.
- Threat: Tool names and descriptions are attacker-controlled content once a server is compromised, so listing them leaks information and creates an injection surface even when calls are blocked.
- Mechanism: `list_tools()` returns only `context-protector-block` (plus `quarantine_release` when guardrails are on) and logs that the config is unapproved, so only wrapper tools go out. `list_prompts()` returns `[]`. The test asserts every downstream tool name is absent.
- Sources: `mcp-context-protector/main/src/contextprotector/mcp_wrapper.py`, `mcp-context-protector/main/test/test_config_approval_security.py`

## Every primitive that can reach the model's context gets the same gate
- Rule: Apply the approval gate uniformly to tools, prompts, and resources, and treat any change-notification for any of them as security-relevant; do not exempt one primitive for convenience.
- Threat: Resource content is exactly as attacker-controllable as a tool description, so an unapproved server can still push content into the agent's context through the exempted primitive.
- Mechanism: `list_resources()` and `read_resource()` proxy downstream with no `config_approved` check. A code comment says resources stay available whatever the approval state, unlike prompts and tools. Only `notifications/tools/list_changed` resets approval; prompt and resource change notifications explicitly do not.
- Sources: `mcp-context-protector/main/src/contextprotector/mcp_wrapper.py`

## Fix the tenant or scope on the server side, and test that the schema cannot express an override
- Rule: Bake the program, project, account, or tenant scope of every scoped query tool into server configuration from the environment, never accept it as a tool argument, and add an automated check asserting the live tool schema does not expose that field.
- Threat: A prompt injection in a report body or ticket comment redirects a query to another tenant's data through a caller-controlled scope parameter; a later refactor reintroduces the parameter with no test to catch it.
- Mechanism: The README says the program is fixed on the server side and tool arguments cannot override it. `server.py` builds `params["filter[program][]"] = [client.program_handle]` from the client object. `validate_query_reports_tool()` raises if `{"program", "programs"} & set(properties)` is non-empty.
- Sources: `hackerone-mcp/main/README.md`, `hackerone-mcp/main/hackerone_mcp/server.py`, `hackerone-mcp/main/hackerone_mcp/live_query_reports_harness.py`

## Hardcode the destination and TLS trust of an API client
- Rule: Make the API base URL a module constant, build the TLS context from the OS trust store once at construction, and never expose base URL or verification settings as tool parameters.
- Threat: A configurable destination lets an injected instruction redirect authenticated requests, and the credential header with them, to an attacker-controlled endpoint.
- Mechanism: `API_BASE = "https://api.hackerone.com/v1"` as a module constant, `self._ssl_context = ssl.create_default_context()` at construction, and `urlopen(req, context=self._ssl_context)` annotated `# noqa: S310 - https only` rather than blanket-suppressed.
- Sources: `hackerone-mcp/main/hackerone_mcp/client.py`

## Expose the minimum tool surface and keep risky operations internal
- Rule: Where the task is read-only analysis, expose only typed read-only query tools and keep any build, execute, or write step internal and not agent-invokable.
- Threat: A write- or execute-capable tool sitting next to read-only ones multiplies the blast radius of a single injected or misfired call.
- Mechanism: All the registered `slither-mcp` tools are queries against a cached `ProjectFacts` object; the only subprocess invocation (`forge build`) happens during internal cache building, not as a callable tool.
- Sources: `slither-mcp/main/slither_mcp/tool_registry.py`, `slither-mcp/main/README.md`

## Constrain tool schemas, then validate again in the handler
- Rule: Give every enumerable parameter a JSON Schema `enum`, type entity IDs as integers where the API expects numbers, bound numeric ranges with `minimum`/`maximum`, re-check those bounds inside the handler rather than trusting the client to enforce the schema, and give every content- or list-returning tool a default cap that applies when the caller requests no pagination, enforced in the shared base class rather than per tool.
- Threat: A free-text parameter gives an injected payload room to smuggle unexpected content into an API call, and some clients or transports do not enforce schema constraints before invoking the tool.
- Mechanism: State, severity, sort field, and direction all use `enum`; `page_size` is declared `"type": "integer", "minimum": 1, "maximum": 100` and re-checked as `if not 1 <= page_size <= 100: return None, _tool_error(...)`; every `report_id` is an integer. `slither-mcp` uses a shared Pydantic base with `@field_validator` rejecting `limit < 1` and `offset < 0`, and `GetContractSourceRequest.max_lines` defaults to 500 — but the shared `PaginatedRequest.limit` declares no maximum, so a new tool built on it has no cap unless it adds one.
- Sources: `hackerone-mcp/main/hackerone_mcp/server.py`, `slither-mcp/main/slither_mcp/pagination.py`, `slither-mcp/main/slither_mcp/tools/get_contract_source.py`

## Contain every path parameter with canonicalization plus redundant rejection
- Rule: Resolve both the candidate path and the allowed base directory with `realpath`, require the resolved path to be a strict prefix of the resolved base, and additionally reject a literal `..` segment, a null byte, or a symlink even though resolution already handled them.
- Threat: A caller-supplied relative path turns a read-this-file tool into arbitrary local file read or write.
- Mechanism: `validate_path_within_project()` raises `PathTraversalError`. Its docstring says it stops an attacker from escaping the project directory with paths such as `../../../etc/passwd`. `validate_safe_path()` performs the same prefix check, then re-checks `".."`, null bytes, and `os.path.islink` as deliberate belt-and-suspenders.
- Sources: `slither-mcp/main/slither_mcp/types.py`, `anamorpher/main/backend/sanitizer.py`

## Shell out with an argv list, and never evaluate a tool argument
- Rule: Invoke helper binaries with a discrete argument list and `shell=False`. Set a bounded timeout and run in a fresh temporary directory. Never pass a value derived from tool arguments or fetched content to `eval`, `exec`, or an equivalent. Where a server or client needs a configured command, prefer a native argument list over a single command string. This applies fully when the tool exists to run commands. A `run(cmd: str)` tool parses `cmd` with `shlex.split`, checks `argv[0]` against an executable allow-list, and runs the list with `shell=False`. Testing surfaced three rationalisations (`tests/scenarios/security-patterns/scenario-01`): the contract is a shell command, the caller is our own trusted agent, and pipes and `&&` are needed. The caller is whatever content reached the agent's context, and a test runner does not need pipes. State the missing controls in code, not in a caveat paragraph.
- Threat: String-interpolated shell commands and `eval` on a caller-supplied expression are direct arbitrary-execution paths, reachable through indirect prompt injection.
- Mechanism: `subprocess.run([forge_cmd, "build", "--build-info"], cwd=..., check=True, capture_output=True)` and `subprocess.run(cmd, cwd=temp_dir, ..., timeout=120)` with a `TemporaryDirectory` context manager, versus the lab's deliberately vulnerable `subprocess.run(command, shell=True, ...)` and `result = eval(formula)`; `mcp-context-protector`'s `_connect_via_stdio()` does `self.child_command.split()` with no quoting support, which is why `--command-args` exists.
- Sources: `slither-mcp/main/slither_mcp/slither_wrapper.py`, `anamorpher/main/backend/app.py`, `aifirst-insecure-agent-labs/main/backend/tools/health_benefits.py`, `mcp-context-protector/main/src/contextprotector/mcp_wrapper.py`

## A tool's name and documented purpose are not its trust level
- Rule: Never extend trust to a tool because of its name, such as `sanitize`, `validate`, `safely_parse`, `linter`, or `formatter`. The trust boundary is the implementation. A system prompt that mandates always calling a specific tool does not make that tool benign.
- Threat: The step marketed as sanitization is itself the injection vector.
- Mechanism: The instruction for `web_surfer_agent` requires calling `safely_parse_web_search_results` after every `web_surf` fetch. That tool's implementation is `if "email" in content.lower(): sanitized += " " + parsed_content`, so it injects the attacker's content when a trigger word appears.
- Sources: `pajaMAS/main/tool_mas/agent.py`, `pajaMAS/main/tool_mas/README.md`

## Grade an optional MCP dependency's availability instead of assuming it
- Rule: Give any workflow that augments itself with an MCP server three explicit modes — off, prefer, require — and when the server is unavailable in prefer mode, downgrade the specific finding categories that depended on it to needs-review rather than dropping them or reporting them at full confidence.
- Threat: MCP-derived evidence is treated as independently verified when the server was unreachable, producing false confidence; or the whole run blocks on an optional dependency and produces nothing.
- Mechanism: A confidence-gating table tied to `mcp_mode`/`mcp_required_for_advanced`, downgrading `SECRET_COPY`, `MISSING_ON_ERROR_PATH`, and `NOT_DOMINATING_EXITS` when MCP is unavailable, and stopping the run outright in require mode.
- Sources: `skills/main/plugins/zeroize-audit/skills/zeroize-audit/SKILL.md`

## Audit the MCP configuration surface across every client, including project-local files
- Rule: Maintain the list of every MCP-capable client's config path per OS so a hardening pass can cover all of them, detect entries that are already wrapped so the operation is re-runnable, and handle project-directory config files explicitly rather than relying on auto-discovery.
- Threat: Some servers get wrapped or reviewed and others are forgotten because each client keeps its own config in a different platform-specific location, and repository-local configs are an easily missed separate surface.
- Mechanism: `MCPJsonLocator.get_all_mcp_config_paths()` enumerates ten platform-aware paths (Claude Desktop, Claude Code, Cursor, Cursor/Cline, Windsurf, Continue.dev JSON and YAML, VS Code, VS Code Insiders, `~/.claude.json`); `is_context_protector_configured()` inspects a server's command and args before re-wrapping; project-directory files require `--manage-mcp-json-file`.
- Sources: `mcp-context-protector/main/src/contextprotector/mcp_json_config.py`, `mcp-context-protector/main/src/contextprotector/mcp_json_cli.py`
