---
description: Pick up work from a handoff document in .pi/handoffs/
argument-hint: "[filename]"
---
Continue work from a previous session's handoff document.

## Filename

Resolve the handoff file before reading anything:

- If a filename was given, use `$1`.
- If no filename was given, use the `select_file` tool with `directory` set to `.pi/handoffs/` and a title such as "Select handoff to pick up". Do not use `ask_user` for the initial filename choice, and do not automatically pick the most recently modified file.
- Resolve the provided value as `.pi/handoffs/<filename>` unless the user entered a direct path.
- If the resolved file does not exist, use `ask_user` to ask for another filename or cancel. Set `customAnswerLabel` to "Enter filename…" and do not add a normal "Enter filename" option. Repeat until an existing file is provided or the user cancels.
- If the user cancels or dismisses the question, or if `select_file` reports cancellation/no UI/empty directory, stop without reading a handoff unless the user explicitly provides another filename.

After reading the resolved existing file:
1. Verify the described state still holds (`git status`, `git log --oneline -5`, check the key files it mentions).
2. Give me a 3-5 bullet summary of where things stand and flag anything that has drifted since the handoff was written.
3. Start on the "Immediate Next Steps" section unless I say otherwise.
