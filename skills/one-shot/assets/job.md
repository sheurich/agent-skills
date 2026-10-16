# One-shot job record template

Copy this template into an authorized durable job location and fill unresolved fields explicitly. This is a reusable record, not an approved brief or a completed example. It is evidence, not authenticated authority. Do not store credentials, tokens, or secret-bearing logs. Use redacted evidence references.

## Brief

- Job ID and record location: <identity; authorized storage>
- Task source: <task text or current conversation reference; single job>
- Outcome: <intended user result>
- Endpoint: <unresolved, or approved a: locally usable / b: delivered / c: deployed to an existing approved environment>
- Scope and exclusions: <included changes; infrastructure modifications excluded>
- Targets: <existing repository or new project; workspace; branch; remote; existing environment as applicable>
- Acceptance criteria: <numbered criteria; tests; independent review; real-use procedure; endpoint checks>
- Permissions: <explicitly allowed local writes, commits, pushes, pull requests, installation/deployment, research, data access; forbidden actions>
- User-only setup: <needed access/setup; state; unresolved single question if any>
- Constraints: <repository policy, compatibility, security, data handling, provider/model/tool restrictions>
- Approved limits: <time/deadline; cost; retry/repair rounds; total concurrency; delegation depth; counting rules; exhaustion behavior>
- Runtime boundary: <available controls; missing enforcement; disclosure to user before execution>
- Approval provenance: <trusted conversation/request reference; exact approved brief/content; approver; time; verify outside this record on resume>
- Decisions: <decision ID; question; sources/evidence; options; lead decision/rationale; authority boundary>

## Specification

Record before task dispatch or implementation. The approved brief authorizes in-scope technical design without routine reapproval; material scope or authority changes require user approval.

- Acceptance criteria and behavior: <reference Brief criterion IDs; expected behavior notes; sufficient for small jobs>
- Larger-job design as applicable: <interfaces; data flow; invariants; error cases; compatibility>
- Test mapping: <criterion/behavior to planned checks; reference task or evidence entries rather than duplicate the plan>

## Tasks

| ID | Task and acceptance IDs | Dependencies | Owner and role | Workspace/content identity | Shared resources | State | Validation and integration order |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <ID> | <bounded work> | <IDs> | <owner> | <workspace; revision/hash including dirty content> | <locks/serialization> | <pending/active/blocked/integrated> | <checks; order> |

- Capability discovery: <effective tools and role routes; permitted data; missing requirements; launch failures>
- Child assignments: <requirements/content supplied; owned files; side-effect limits; return contract; stop conditions>
- Advisory work: <research citations and uncertainty; focused oracle question; bounded council membership/rounds/budget if needed; lead decision>
- Integration log: <returned changes and evidence; conflicts; integrated content identity; invalidated evidence>

## Evidence

| Acceptance ID | Check type | Exact command or procedure | Environment/tool version | Content identity | Time | Result | Evidence reference |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <ID> | <test/review/real use/delivery> | <reproducible procedure> | <environment> | <revision/hash of tested files or artifact> | <time> | <pending/pass/fail/skipped/unavailable/empty> | <redacted output/report> |

- Defect reproduction or test-first evidence: <before/after; exceptions with reasons>
- Independent review: <reviewer identity; exact requirements/content supplied; report; blockers; repairs; refreshed review identity>
- Real use: <actual invocation or user flow; target environment; expected and observed behavior; failure paths>
- Invalidated evidence: <old identity; change; affected checks/review; required refresh>
- Unmet criteria: <failed/skipped/unavailable/empty checks; none counts as a pass>

## Recovery

- Last checkpoint: <time; phase; next safe step>
- Actual workspace state: <workspace IDs; revisions; dirty-content identities; ownership>
- Active workers: <worker IDs; role; workspace; owned files/shared resources; last known state; confirmed live/stopped/uncertain>
- Current usage and remaining budgets: <elapsed/remaining time; spent/remaining cost; used/remaining repairs; occupied/available concurrency; do not reset on resume>
- Approval reconciliation: <trusted source checked outside this record; remaining authority; unresolved provenance>
- Uncertain writes/actions: <local or external action; target; expected effect; receipt status; inspection required before retry>
- Side-effect reconciliation: <actual state inspected; duplicate/conflict checks; safe retry decision>
- Runtime state: <controls in effect; gaps; restart requires external mechanism>
- Resume reconciliation: <actual files/workers/budgets checked; stale evidence identified; safe to resume or blocked>
- Blocker and safe next step: <exact missing condition; preserved work; one recommended question only if user can resolve it>

## Delivery

| Action | Authority reference | Content identity | Destination | Time | Receipt and observed target state | Status |
| --- | --- | --- | --- | --- | --- | --- |
| <commit/push/pull request/install/deploy> | <explicit authorization> | <revision/artifact identity> | <target> | <time> | <redacted receipt; state inspection> | <not attempted/confirmed/failed/uncertain> |

- Requested endpoint and reached endpoint: <do not label partial work complete>
- Result and usage instructions: <location; invocation; prerequisites>
- Acceptance summary: <current tests, independent review, and real-use evidence references>
- Remaining work and limitations: <unmet conditions; exhausted budgets; uncertain actions; user actions>
- Handoff status: <pending/blocked/incomplete/complete only with all required current evidence and receipts>
