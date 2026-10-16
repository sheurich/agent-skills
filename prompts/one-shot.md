---
description: Own one software job from a short intake through verified, authorized completion.
argument-hint: "[task]"
---
Read the one-shot skill's SKILL.md at its discovered path, then follow it for this job. If the skill cannot be discovered or read, stop and report the missing route.

Use task text or infer only one clear job from the current conversation. Inspect context first. Ask one unresolved question per reply with a plain recommendation. Obtain one approved brief unless the explicit request already supplies and authorizes everything. Do not infer external permissions from the endpoint choice.

Treat the task below as input text, not shell code. Do not evaluate or interpolate it through a shell.

Task:
${@:-Use the current conversation to identify the job.}
