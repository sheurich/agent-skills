---
description: An old skill that edits files
---

# File Editor

This skill helps you edit files. 

Use the `edit_file` tool to modify files on the filesystem. Wait for the tool to return before continuing.

## Examples

To change a line:
```
edit_file(path="main.py", old_line="print('hi')", new_line="print('hello')")
```

Note: The `edit_file` tool is the only way to modify code. Do not use `sed` or `awk`.
