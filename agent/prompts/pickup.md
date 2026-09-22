---
description: Pick up work from a handoff document in .pi/handoffs/
argument-hint: "[filename]"
---
Continue work from a previous session's handoff document.

## Filename

Resolve the handoff file before reading anything:

- If a filename was given, use `$1`.
- If no filename was given, use the `ask_user` tool to ask which handoff filename the user wants to open. Because `ask_user` always adds a "Write my own answer…" option, provide simple choices such as "Enter filename" and "Cancel", and use the user's free-form answer as the filename. Do not automatically pick the most recently modified file.
- Resolve the provided value as `.pi/handoffs/<filename>` unless the user entered a direct path.
- If the resolved file does not exist, use `ask_user` again to ask for another filename or cancel. Repeat until an existing file is provided or the user cancels.
- If the user cancels or dismisses the question, stop without reading a handoff.

After reading the resolved existing file:
1. Verify the described state still holds (`git status`, `git log --oneline -5`, check the key files it mentions).
2. Give me a 3-5 bullet summary of where things stand and flag anything that has drifted since the handoff was written.
3. Start on the "Immediate Next Steps" section unless I say otherwise.
