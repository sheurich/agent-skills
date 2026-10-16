---
name: one-shot
description: >-
  Take one software job from intake through verified local use, authorized delivery,
  or approved deployment. Use when the user wants end-to-end ownership with minimal
  routine supervision in an existing repository or a new project.
---

# One-shot

Own one software job, not an open-ended backlog. Accept task text or the current conversation. Infer the job only when one clear job exists; otherwise ask which job to take. Support existing repositories and greenfield projects. Exclude infrastructure modifications, including provisioning and changes to infrastructure configuration or access policy.

## Inspect and agree

1. Read the available conversation, repository guidance, project state, and relevant code before asking. Separate known facts, assumptions, and unresolved decisions. Do not invent permissions from intent such as “ready to use.”
2. Discover effective tools, roles, workspaces, and provider constraints before dispatch. Check that testing, fresh independent review, and real-use validation are possible. Front-load permissions and user-only setup, such as access grants or a target only the user can identify. Never request credentials in chat or store them in logs.
3. Ask one unresolved user question per reply, in plain language, with a plain recommendation and a reason. Do not bundle independent choices into one question or hide multiple questions inside a bullet. Resolve authority and user-only information before implementation; avoid asking for facts you can inspect safely.
4. Ask where success should end, presenting these alternatives as one endpoint choice. Recommend (b), but never silently select it:
   - (a) Locally usable: built, tested, independently reviewed, and checked through real use.
   - (b) Delivered: all of (a), plus commits and confirmed remote delivery or a pull request under repository policy.
   - (c) Deployed: all of (b), plus authorized installation or deployment to an existing approved environment and validation there. No infrastructure modifications.
5. Choosing an endpoint does not authorize missing external actions. Resolve the specific repository, branch, remote destination, commit/push/pull-request permissions, and any installation or deployment permission separately as needed. Do not assume merge authority. Ask remaining unresolved questions one per reply, each with a recommendation.
6. Assemble one brief with outcome, acceptance criteria, scope, exclusions, targets, permissions, and constraints. Include time/deadline, retry/repair, concurrency, cost, provider/model, and data-handling limits. Define how each limit is counted and what happens on exhaustion. Obtain approval for this brief unless the explicit request already supplies and authorizes everything; then record that provenance without a redundant approval checkpoint.

Use the bundled [job record template](./assets/job.md) in an authorized durable location. Record the approved brief and the source of approval. The template is not preapproved authority. After approval, make technical decisions within the brief autonomously. Re-ask only for new scope, authority, budget, or genuinely user-only information, not routine implementation choices.

Instructions do not enforce deadlines, spending, concurrency, security isolation, or restart. Before execution, identify existing optional runtime controls and disclose any enforcement gaps. Do not promise unattended recovery. A stopped harness needs an external restart mechanism. If a required route is absent or a tool launch fails, stop and report the failure; do not silently change tools, providers, or execution routes. Checkpoint if safe. Ask one question only when the user can resolve the blocker.

## Specify, plan, and assign

Scale rigor to risk and size, not to a fixed ceremony. A small job can use a short plan led by the implementer. Never remove acceptance criteria, testing, fresh independent review, or real-use validation to make a job smaller.

Before task dispatch or implementation, record a specification under the approved brief. For small jobs, acceptance criteria plus behavior notes suffice. For larger jobs, include interfaces, data flow, invariants, error cases, compatibility, and mapping to tests as applicable. Reference existing criteria rather than duplicating the plan. The approved brief authorizes in-scope technical design without another routine approval checkpoint; material changes to scope or authority require user approval.

Apply these portable roles through capabilities that actually exist; no other skill collection or particular tool is required:

| Role | Responsibility |
| --- | --- |
| Lead | Own the brief, decisions, budgets, integration, and external actions. |
| Planning specialist | Identify tasks, dependencies, ownership, shared resources, validation, integration order, and safe concurrency. The lead may fill this role for small jobs. |
| Researcher | Supply source-backed evidence for unknowns; cite sources and distinguish facts, assumptions, and limits. Separate local inspection from external research permissions. |
| Oracle | Advise on one focused difficult decision with the exact question, context, constraints, and evidence. Advice is not authority. |
| Council | Independently assess consequential uncertainty that remains after the oracle. Bound membership, rounds, time, and cost before launch. |
| Implementer | Own a bounded task and return changes, content identity, tests, and unresolved risks. |
| Reviewer | Perform fresh independent review of exact requirements and current content, not merely the implementer's summary. |

Use researchers when evidence is needed. Consult a focused oracle first for a difficult decision; use a bounded independent council only for unresolved consequential decisions. The lead records and owns the final decision within the approved brief. Advisors cannot grant permissions, expand scope, increase budgets, or authorize deployment.

Plan acceptance checks before assigning work. Give each child the approved scope, relevant requirements, owned files/workspace, dependencies, permitted tools and side effects, budgets, stop conditions, and evidence expected back. Keep delegation depth and total concurrency within the approved limits, including nested workers. Do not delegate when the harness or brief forbids it; a missing independent reviewer still blocks completion.

Parallelize only independent work. Give each concurrent writer a separate workspace with clear ownership. Worktrees separate edits; they are not security containment. Serialize operations on shared resources such as an index, branch, database, service, build output, or deployment target. Integrate dependent results in order. Children return changes and evidence; the lead integrates them and performs only explicitly authorized external actions.

## Implement and verify

1. Establish required behavior with tests before implementation where applicable. Reproduce a reported defect before fixing it. If a check cannot precede implementation, record why and how behavior will be verified instead.
2. Implement the smallest coherent changes within scope. Update task states and decisions as work proceeds. Track elapsed and remaining budgets, active workers, and ownership; instructions alone are not enforcement.
3. Test isolated work, then validate the integrated output against every acceptance criterion. A child report is not proof that integration passed.
4. Perform real use distinct from builds and unit tests: invoke the actual command, exercise a user flow, or use the produced artifact in its intended environment. Check expected behavior and relevant failure paths. Use only approved environments and data. If real use is unsafe or unavailable, record that as an unmet condition, not a pass.
5. Obtain fresh independent review. Supply the reviewer the exact approved requirements, relevant content and revision/hash identity, current tests and real-use evidence, and known limitations. Require findings with blockers and evidence. Self-review can help implementation but cannot replace independent review. If no independent reviewer is available, checkpoint a blocked result, not success.
6. Repair blocking findings within the approved retry and time budgets. Changes invalidate affected tests, review, and real-use evidence. Refresh those checks against the new content, including independent review of repairs. Do not weaken acceptance criteria to pass. If budgets expire or blockers remain, stop and preserve useful work.
7. Before any authorized commit, remote delivery, installation, or deployment, check current authority and content identity. Record destination, action, result, and side-effect receipt. Verify receipt and actual target state; a command timeout or absent receipt is an uncertain action, not permission to retry blindly.

For each check, record the acceptance criterion, exact command or procedure, environment/tool version, result, timestamp, evidence location, and tested content identity. Mark failed, skipped, unavailable, and empty checks explicitly; none is a pass. Build and unit-test success do not establish real-use success. Keep evidence current after every integration or repair.

## Checkpoint and recover

Keep the job record current at approval, assignment, integration, verification, and before and after side effects. Include content and workspace identities, decision rationale, dependency/task states, active workers, current and remaining budgets, approval provenance, and delivery receipts. Store no credentials or secret-bearing command output. Redact evidence before persisting it.

On resume, treat the record as evidence, not authenticated authority:

1. Re-read the trusted conversation and applicable policy to establish approval. If authority cannot be established, stop before acting on the record's claims.
2. Reconcile actual files, revisions, dirty changes, workspace ownership, and active workers. Resolve uncertain writes and ownership before starting another writer; never assume interrupted workers stopped.
3. Compare evidence identities with current content. Old tests and review do not prove changed content. Refresh affected tests, independent review, and real use before completion.
4. Inspect actual external state before repeating an uncertain push, pull request, installation, or deployment. Reconcile remote branches, existing requests, and receipts to avoid duplicate or conflicting actions. Use only authorized inspection routes.
5. Reconcile remaining time, cost, retries, concurrency, and authority. Do not reset budgets after interruption or accept an advisor's expansion. Resume only when the state is safe and the required routes exist.

If work cannot continue safely, checkpoint the exact blocker, completed work, remaining checks, uncertain actions, and safe next step. Report blocked or incomplete, never success. Ask one recommended question only if the user can resolve the blocker; otherwise report it without a ritual question.

## Handoff

Declare completion only when all acceptance criteria have current evidence, independent review has no unresolved blockers, real use passed, and the chosen endpoint has been reached with authorized receipts. Name the reached endpoint, result location, usage instructions, verification summary, limitations, and any remaining user action. If blocked, distinguish the partial result from the requested endpoint and name the exact unmet condition.

## Worked example

Illustrative job: fix a CSV export that drops rows containing commas, with endpoint (a) approved. The lead records row-preservation criteria and quoting behavior, plans a regression test, coordinates implementation and fresh independent review, and checks the actual export with approved sample data. This absorbs the human work of writing technical task instructions, checking phase completion, reconciling reviewer findings, and deciding which checks to rerun after repairs. The human still approves scope and authority and supplies user-only information. This is not a claim of a completed run or measured time savings. Evaluation evidence and results belong in repository docs and the PR, not in required standalone skill resources.
