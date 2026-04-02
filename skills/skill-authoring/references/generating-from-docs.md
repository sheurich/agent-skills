# Generating Skills from Documentation

Create skill content by crawling documentation websites.

## Prerequisites

Check if the generator CLI is available. If not, follow the manual fallback path or install it (macOS: `brew install rodydavis/tap/agent-skills-generator`).

```bash
if ! command -v agent-skills-generator &> /dev/null; then
    echo "Warning: agent-skills-generator not found."
    # Ask the user if they want to install it or fall back to manual crawling
fi
```

## Process

1. **Gather from user:**
   - Skill name (kebab-case)
   - Documentation URLs to crawl
   - Exclusion patterns (optional)
   - Brief description of when to use the skill

2. **Create temp workspace:**

   ```bash
   WORKDIR=$(mktemp -d)
   cd "$WORKDIR"
   ```

3. **Write .skillscontext:**
   One URL pattern per line. Prefix URLs with ! (exclamation mark) to exclude them.
   Write this file even when using the manual fallback — it serves as provenance for the source URLs.

   ```text
   https://docs.example.com/guide/*
   !https://docs.example.com/guide/changelog/*
   ```

4. **Run crawler** (skip if `agent-skills-generator` is not installed — fall back to manual `curl`/browser download of the docs):

   ```bash
   if command -v agent-skills-generator &> /dev/null; then
       agent-skills-generator crawl --flat
   else
       echo "agent-skills-generator not found; fetch docs manually into .skillscache/"
   fi
   ```

5. **Collect output:**
   Read all `.md` files from `.skillscache/`

6. **Generate skill content:**
   Combine frontmatter + crawled content. Follow [format-spec.md](format-spec.md) for frontmatter requirements and [platform-guide.md](platform-guide.md) for harness compatibility.

   ```markdown
   ---
   name: <skill-name>
   description: <when to use this skill>
   ---

   <crawled markdown content>
   ```

7. **Output the content:**
   Present the generated skill content to the user or write it to the
   requested location.

8. **Cleanup:**

   ```bash
   rm -rf "$WORKDIR"
   ```

## URL Pattern Syntax

| Pattern     | Meaning                    |
| ----------- | -------------------------- |
| `*`         | Wildcard, matches any path |
| `!url`      | Exclude matching URLs      |
| `# comment` | Comment line (ignored)     |

## Notes

- For large docs, consider crawling specific sections only
- Review crawled content for relevance before finalizing
- The crawled content may need editing for clarity or brevity
