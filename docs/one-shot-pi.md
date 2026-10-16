# One-shot in Pi

The [portable one-shot skill](../skills/one-shot/SKILL.md) owns one software job in an existing repository or a new project. It excludes infrastructure modifications. The [entry prompt](../prompts/one-shot.md) only loads that procedure and supplies task text; it is not a runner.

## Discovery and invocation

The root package.json has no `pi` manifest. Preserve Pi's convention-based discovery of `skills/` and `prompts/`; do not add a manifest that narrows discovery or require a new dependency for this skill.

The `/one-shot` command only exists after installing/loading this package's prompt in Pi. Loading the skill alone does not create the prompt command. This implementation does not install anything or change host configuration. Check the current session's discovered skills and prompt commands before use.

After loading the package's prompt, invoke:

```text
/one-shot Implement the CSV change discussed above
```

With no task arguments, `/one-shot` uses the current conversation. The prompt uses `${@:-Use the current conversation to identify the job.}` as Pi prompt argument substitution. This is text substitution, not shell evaluation. Do not send task text through a shell. The prompt instructs the agent to read the skill at its discovered path. It does not assume a special skill URI or automatic recursive slash-command expansion.

When the skill is discovered, `/skill:one-shot` is the direct skill invocation. Supply task text or refer to the current conversation. This route does not depend on the short prompt being loaded. Verify the session exposes that skill route rather than guessing a filesystem location.

For other harnesses, use this natural-language equivalent: “Read the one-shot skill at its discovered path and follow it for this task, or use the current conversation to identify one clear job.” The core needs no Pi API or separate skill collection.

## Discover capabilities before dispatch

Use only roles and tools actually available in the current session. Check role instructions, effective tools, provider constraints, data access, permission boundaries, and independent-review availability before starting. Do not infer a working route from a role name or an installed package alone.

The following mapping is optional, not a package dependency or an API contract:

| Portable role | Possible Pi capability | Boundary |
| --- | --- | --- |
| Lead/planning specialist | Main agent; an available planning adviser for larger jobs | The lead owns task boundaries, dependencies, shared resources, ownership, safe concurrency, and integration order. |
| Researcher | Local scout or web researcher | A local scout inspects local sources only with effective local tools. Web research needs effective web tools and approved network/data access. Cite sources; do not claim unavailable research ran. |
| Oracle | Available oracle adviser | Pi's oracle role is a context-consistency adviser. Use it to check a focused decision against context and constraints; it is not a substitute for domain research or independent review. |
| Council | Bounded independent advisory roles | Set membership, rounds, time, and cost first. The lead decides; advice grants no authority. |
| Implementer | Available writer role in a separate workspace | Children return changes and evidence. They do not perform the lead's external actions. |
| Reviewer | Available reviewer role in a fresh independent context | Supply exact requirements, current content identity, and evidence. Oracle advice and implementer self-review do not replace this review. |

Foreground children do not load ambient MCP extensions. A parent's MCP access therefore does not prove a child's access. Verify the child's effective tools before dispatch. A local scout without web tools cannot serve as a web researcher. Do not repair missing capabilities by silently switching roles, providers, tools, or execution routes.

If a required role or tool route is missing, stop and report the exact blocker. If a tool launch fails, stop and report it rather than retrying through an unapproved alternate route. Preserve a checkpoint if safe. Ask one recommended question only when the user can resolve the blocker. Missing independent review blocks completion even when implementation tests pass. Do not replace it with self-review.

No concrete model ID, local installation path, or extension API call is required here. Discover configured routes and use their documented interfaces. Do not automatically install extensions, edit agent/global configuration, or fetch tools to make this procedure run.

## Runtime boundary and recovery

The skill coordinates work through instructions. It does not enforce security isolation, spending, deadlines, retries, or concurrency. Existing runtime controls are optional; identify them and disclose gaps before execution. Separate writer workspaces prevent edit collisions but worktrees are not security containment. A stopped process needs an external restart mechanism; the prompt does not restart it.

Use the bundled [job record template](../skills/one-shot/assets/job.md) in authorized storage. It records approval provenance, tasks, evidence identities, remaining budgets, workers, and side-effect receipts, without credentials. It is evidence rather than authenticated authority. On resume, reconcile trusted approval, actual content, active workers, and uncertain writes or remote actions before repeating anything. Do not reset limits or count checks for old content as current proof.

Choose the endpoint through intake. Recommend delivered, but do not select it silently. Local usability, remote delivery, and deployment to an existing approved environment require different evidence and permissions. Endpoint choice alone never grants a missing push, pull-request, installation, or deployment permission. Infrastructure modifications remain excluded.

## Evidence and human work

The lead takes over routine phase checks, worker-report reconciliation, and integration decisions. The human approves the brief and external authority and supplies user-only setup. The procedure aims to reduce repeated supervision, not eliminate approval or guarantee runtime performance.

See the [paired scenario and worked-example evidence](../tests/scenarios/one-shot/scenario.md), [fixtures](../tests/scenarios/one-shot/fixtures.md), and [packaging tests](../tests/one-shot.test.mjs). Both Pi and Swival improved from eight to ten passing criteria: the skill changed batched intake questions into one question with a recommendation. Both already handled the recovery safety cases correctly. These are tabletop fixtures, not live repository delivery or deployment; no time saving was measured.

Six Node tests check packaging and prompt structure. An optional seventh uses an installed Pi prompt loader to check empty, quoted, multiline, shell-looking, and unquoted task input. Set `PI_PROMPT_MODULE` to the trusted installed `dist/core/prompt-templates.js` module and run `node --test tests/one-shot.test.mjs`. The integration test reports a skip when the module is not supplied; it downloads nothing and makes no model call. All seven passed locally with Pi 1.3.0. These checks do not prove live orchestration, delivery, or unattended recovery.
