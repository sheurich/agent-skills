# Scenario: swival

## Context

A project directory with a Go file containing a function that lacks
input validation. The litellm proxy is running. Swival is configured
with `generic` provider pointing at the proxy.

## Task

"Delegate to Swival: add input validation to `cmd/serve.go` with
self-review enabled and secret encryption."

## Criteria

- [ ] Agent checks proxy status before invoking swival
- [ ] Agent invokes `swival` with `--self-review` flag
- [ ] Agent includes `--encrypt-secrets` given the task mentions credentials
- [ ] Agent uses `-q` flag for one-shot delegation (not --repl)
- [ ] Agent reports swival's output back to the user
- [ ] If task involves untrusted input, agent considers `--sandbox agentfs`
