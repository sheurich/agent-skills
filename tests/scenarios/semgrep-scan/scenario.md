# Scenario: semgrep-scan

## Context

A Python project repository with staged changes that include security
vulnerabilities. The working tree has three modified files:

- `app/auth.py` — uses `subprocess.call(cmd, shell=True)` with user input
  (command injection, CWE-78)
- `app/db.py` — builds SQL queries with string concatenation from request
  parameters (SQL injection, CWE-89)
- `app/util.py` — benign utility function refactor (no vulnerabilities)

The agent has `uvx` available and can run `semgrep scan`. No Semgrep
account is configured. The repo has no `.semgrep/` directory.

### Setup

```bash
mkdir -p /tmp/semgrep-test/app && cd /tmp/semgrep-test
git init && git commit --allow-empty -m "init"

cat > app/auth.py << 'EOF'
import subprocess

def run_user_command(user_input: str) -> str:
    result = subprocess.call(user_input, shell=True)
    return str(result)
EOF

cat > app/db.py << 'EOF'
import sqlite3

def get_user(conn: sqlite3.Connection, username: str):
    query = "SELECT * FROM users WHERE name = '" + username + "'"
    return conn.execute(query).fetchone()
EOF

cat > app/util.py << 'EOF'
def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))
EOF

git add -A
```

## Task

"I've staged some Python changes. Check them for security issues
before I commit."

## Criteria

- [ ] Agent scans only the staged/changed files (not the entire filesystem)
- [ ] Agent uses `semgrep scan` (CLI or MCP) rather than manual code reading alone
- [ ] Agent identifies the command injection in `auth.py` (subprocess shell=True)
- [ ] Agent identifies the SQL injection in `db.py` (string concatenation)
- [ ] Agent does not flag `util.py` as having security issues
- [ ] Agent proposes concrete fixes for each finding
- [ ] Agent re-scans (or states intent to) after proposing fixes

## Baseline

_(To be recorded — run the task without the skill loaded)_

- Date:
- Agent:

| Criterion | Result | Observation |
| --- | --- | --- |
| Scans changed files only | | |
| Uses semgrep | | |
| Finds command injection | | |
| Finds SQL injection | | |
| No false positive on util.py | | |
| Proposes fixes | | |
| Re-scans after fixes | | |

## With-Skill

_(To be recorded — run the task with the skill loaded)_

- Date:
- Agent:

| Criterion | Result | Observation |
| --- | --- | --- |
| Scans changed files only | | |
| Uses semgrep | | |
| Finds command injection | | |
| Finds SQL injection | | |
| No false positive on util.py | | |
| Proposes fixes | | |
| Re-scans after fixes | | |

## Analysis

_(Compare outcomes after both runs are recorded)_
