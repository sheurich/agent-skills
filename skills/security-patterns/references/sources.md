# Sources

Every entry cites `repo/branch/path` relative to the Trail of Bits GitHub organization. Paths were read at the commits below. File contents drift, so before relying on a cited detail externally, re-read the cited path at the pinned commit with any read-only fetch or clone tool.

The entries paraphrase and cite Trail of Bits material. They are not quotes. Code facts such as configuration keys, flags, identifiers, and paths appear exactly as written in the source.

Extraction ran in four parallel buckets (harness config and sandboxing; skills and plugin supply chain; MCP and multi-agent; ML model and data-file trust), then one consolidation pass that deduped across buckets, dropped low-applicability and domain-specific entries (smart contract, Windows, fuzzer internals), and merged the per-bucket contradiction lists. Roughly 235 raw entries became 121.

| Repository | Branch | Commit | License |
| --- | --- | --- | --- |
| trailofbits/agentcov | main | d9b1f7abcfbe9262dc9abab988d6b3bc92dd944a | Apache-2.0 |
| trailofbits/aifirst-insecure-agent-labs | main | 508e93666d367f014671eed5951a55b4c108750f | None stated |
| trailofbits/anamorpher | main | 6aa9877ed64d0d1b1bf6d8b86d754ab5098c155b | Apache-2.0 |
| trailofbits/awesome-ml-security | main | d7fe4fa917192dba20051741d357c939c709a1e3 | CC-BY-4.0 |
| trailofbits/background-agents | main | 50c17812e2caf6f86ea81699a6a463904b7feeeb | MIT |
| trailofbits/claude-code-config | main | 2109be998c09f0c271fb9f46a283bbc92db5b5a7 | None stated |
| trailofbits/claude-code-devcontainer | main | feea113719e50c8820ce5d0f11f2b0abb01d32a4 | Apache-2.0 |
| trailofbits/codex-config | main | 29a66d1aef1a3e6c2696811109a781b059b95b4f | None stated |
| trailofbits/CompChomper | main | 0be44adab6295691e94f8438cb1d2745ea052a16 | Apache-2.0 |
| trailofbits/coop | main | 64f3a82d83e99ec4bcab639b84ebb474c8b893f5 | Apache-2.0 |
| trailofbits/datasig | main | 84fe2434ad7547628df4fdffc695e13578b8ccc1 | AGPL-3.0 |
| trailofbits/fickling | master | 854c99acd2637f97162dd2e1aa2dab4e8d55d77d | LGPL-3.0 |
| trailofbits/hackerone-mcp | main | 65e8b67cd2907a2b90268845915cb16b92cbc3e1 | AGPL-3.0 |
| trailofbits/mcp-context-protector | main | 05e56c1616f4382ca25eb15bdfc98c4967bbdd74 | Apache-2.0 |
| trailofbits/micro | main | 96b1a13508e113ce34f4a7aff1edb082afd63f2b | None stated |
| trailofbits/ml-file-formats | main | fa63bd9045da8d78cfabaab4c6eab8fffa3c011b | Apache-2.0 |
| trailofbits/overtly-malicious-skills | main | 4ffbf9461ef0505f9ce76a0d3694a18ec33ea531 | None stated |
| trailofbits/pajaMAS | main | 67b83f1e488652f9bdf580b7f6c8050190ae80ed | Apache-2.0 |
| trailofbits/skills | main | 123037ec8aed26f0d86327cc39137ee5043e5deb | CC-BY-SA-4.0 |
| trailofbits/skills-curated | main | 6d05be4889017b06fb15069f371afd220daffb62 | CC-BY-SA-4.0 |
| trailofbits/sleepy-pickle-public | main | 63bd93703e8c4807b8171de766341a9c396a8564 | MIT |
| trailofbits/slither-mcp | main | 17755731bf7aba6e5ed4d72e116d9d394430b1e2 | AGPL-3.0 |

License is the license file present in the repository at the pinned commit. None stated means the repository had no license file at that commit. Each source repository keeps its own license; see `../NOTICE.md`.

Not yet covered: `trailofbits/publications`, `trailofbits/testing-handbook`, `trailofbits/semgrep-rules`, `trailofbits/codeql-queries`, and the non-AI tooling repos. Add them as further buckets using the same entry format.
