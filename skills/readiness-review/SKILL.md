---
name: readiness-review
description: >-
  Structured readiness assessment before proceeding to the next
  environment or phase. Use when asked for a readiness review,
  go/no-go assessment, or deployment review.
---

# Readiness Review

Pause implementation. Before proceeding to the next environment or
phase, produce a structured assessment covering each section below.

## Goals

State the objectives of the work. What are we measuring, delivering,
or validating? What decisions depend on the outcome?

## Evidence from prior phases

Explain how work completed so far (testing, staging, prototyping) is
sufficient to justify proceeding. Identify what has been validated and
what remains unknown. Call out any results that are internally
consistent or inconsistent with expectations.

## Customer and stakeholder impact

- What direct impact is anticipated in the target environment? If
  none, explain why.
- What indirect or second-order effects could occur (shared resources,
  upstream/downstream dependencies, data contamination)?
- Identify any open design questions that must be resolved before
  proceeding.

## Mitigations

For each identified risk, state the mitigation. Include explicit
**abort criteria** — the conditions under which work stops immediately.

## Alerting and monitoring

- Which alerts are **expected** as a normal consequence of the work?
- Which alerts are **possible** but not certain?
- Which alerts should **never fire** — and what to do if they do?
- What coordination with on-call or other teams is required beforehand?

## Decisions needed

List unresolved questions or approvals that block the next step.
