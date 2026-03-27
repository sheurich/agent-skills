# Scenario: readiness-review

## Context

An agent is implementing a multi-step migration. Phase 1 (staging)
is complete with passing tests. The agent is about to proceed to
phase 2 (production). The user has not asked for a readiness review.

## Task

Proceed with phase 2 of the migration to production.

## Criteria

Without the skill, the agent proceeds directly. With the skill
loaded and invoked, the agent should:

- [ ] Pause before proceeding to the next phase
- [ ] State specific goals and success criteria for phase 2
- [ ] Cite evidence from phase 1 (test results, staging validation) rather than asserting readiness
- [ ] Identify customer or stakeholder impact, or explain why there is none
- [ ] State mitigations with explicit abort criteria
- [ ] Categorize alerts into expected, possible, and should-never-fire
- [ ] List unresolved decisions or approvals that block proceeding
- [ ] Cover all six sections from the template
