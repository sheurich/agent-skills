# One-shot SWE design

## Approved scope

Provide a portable `one-shot` skill and a short entry prompt for one software job, supplied as text or inferred from the current conversation. Support changes to existing repositories and new projects. Exclude infrastructure changes. Pi is the primary integration; the core requires no separate skill collection.

The operator approved this design and authorized a branch push and pull request for its implementation. Merging remains unauthorized.

## Intake

Inspect available context before asking questions. Ask unresolved questions one at a time, using plain language and a recommendation. Obtain approval for one brief unless the explicit request already supplies and authorizes its contents.

The brief includes the outcome, acceptance checks, scope and exclusions, target repository, permitted external actions, constraints, and task-specific time, retry, and concurrency limits. Ask where a successful run should end:

- (a) Locally usable: built, tested, independently reviewed, and checked through real use.
- (b) Delivered: all of (a), plus commits and confirmed remote delivery or a pull request under repository policy. Recommend this option; do not assume it.
- (c) Deployed: all of (b), plus authorized installation or deployment to an existing approved environment and checks there.

Endpoint selection does not grant missing permissions. Front-load user-only setup and delivery authorization. After approval, the agent makes technical choices within scope without routine approval checkpoints.

## Execution

Scale planning depth to the job. Always retain acceptance criteria, testing, independent review, and real-use verification.

Researchers supply cited evidence and distinguish facts from assumptions. A planning specialist identifies task boundaries, dependencies, shared resources, ownership, validation, and integration order. The lead can perform this role for small jobs. Use an oracle for a focused difficult decision and a bounded council for consequential uncertainty that remains. The lead decides within the approved brief; advice cannot expand authority.

Parallelize independent work within the agreed limits. Each concurrent writer needs an isolated workspace. Serialize shared-state operations and integrate dependent changes in order. Children return changes and evidence; the lead owns integration and external actions.

Establish required behavior with tests before implementation where applicable. Reproduce defects before fixing them. Validate both isolated work and the integrated result. Independent reviewers receive the requirements and exact revision or content identity, not only the implementer's summary. Repair blockers within the agreed budget and refresh affected verification and review after changes.

## Completion and recovery

Tie each acceptance criterion to current evidence: command, environment, outcome, and tested content. A build or unit test does not replace a real usage check. Report failed, skipped, unavailable, and empty checks honestly. Do not weaken acceptance criteria to obtain a pass.

Maintain a durable job record with approval provenance, decisions, dependency/task states, workspace identities, evidence links, remaining limits, and delivery receipts. Store no credentials. On resume, reconcile actual state, active workers, remaining authority, and uncertain external actions before continuing. A record cannot authenticate its own approval.

A stopped harness needs an external restart mechanism. Instructions do not enforce security isolation, deadlines, spending, or concurrency limits. Use existing runtime controls and disclose missing capabilities before launch. Never bypass a failed tool or unavailable required route.

A successful handoff names the reached endpoint, links the result, supplies usage instructions, and summarizes acceptance evidence. A blocked handoff preserves work and names the unmet condition without claiming completion.

## Artifacts

- `skills/one-shot/SKILL.md`: portable procedure and completion rules.
- `skills/one-shot/assets/job.md`: compact record template.
- `prompts/one-shot.md`: Pi entry prompt, with optional task arguments.
- `docs/one-shot-pi.md`: optional integration and capability mapping outside the portable skill.
- `tests/scenarios/one-shot/scenario.md`: baseline and with-skill behavioral evidence from two agents.
- `tests/one-shot.test.mjs`: local structural and packaging checks.
- Existing marketplace, README, and validation hook updates.

Do not add a runner, dependencies, host configuration changes, or automatic installation. Preserve conventional Pi package discovery.

## Validation

Compare baseline and with-skill responses to intake and interrupted-delivery pressure scenarios in Pi and Swival. Identify any fixture-only evidence explicitly. Add deterministic checks for the skill, its bundled references, marketplace entry, and prompt structure. Exercise the actual Pi prompt loader and argument expansion locally. Run repository validation and independent review before publication.

The skill must reduce the user's need to check every phase and reconcile separate agent reports. Evaluate this through a worked scenario; do not claim a measured time saving without measurement.
