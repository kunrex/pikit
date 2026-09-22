---
description: Generate a handoff document capturing session state for seamless continuation in a new session
argument-hint: "[filename]"
---
Create a comprehensive handoff document capturing everything needed to continue this session's work in a fresh session.

## Filename

Resolve the output filename before writing anything:

- If a filename was given, use `$1`.
- If no filename was given, use the `ask_user` tool to ask for the desired handoff filename. Because `ask_user` always adds a "Write my own answer…" option, provide simple choices such as "Enter filename" and "Cancel", and use the user's free-form answer as the filename.
- The final write target must be `.pi/handoffs/<filename>` in the project root. Create `.pi/handoffs/` if needed.

After resolving the filename, check whether `.pi/handoffs/<filename>` already exists. If it exists, do not overwrite it silently. Use `ask_user` to ask whether to overwrite the existing handoff, choose a different filename, or cancel. If the user chooses a different filename, ask for the new filename and repeat the existence check before writing.

## Before writing

- Run `git status` and `git log --oneline -10` to capture repository state — this is essential context.
- Review the conversation for decisions made, approaches rejected, and anything surprising that was discovered.

## Document structure

```markdown
# Handoff: <topic>
Date: <ISO date/time> | Branch: <branch> | Status: <in progress / blocked / ready for review>

## Summary
2-4 sentences: what we set out to do, where things stand now.

## Work Completed
- [x] Each meaningful change, with the *why* when a decision was non-obvious

## Files Affected
- Created: path/to/file — purpose
- Modified: path/to/file:line — what changed
- Deleted: ...

## Technical Context
Architecture decisions, dependencies added/changed, config changes, gotchas discovered. Include anything the next session would otherwise have to re-derive.

## Current State
- Working: ...
- Not working / known issues: ...
- Tests: <passing/failing/not run, with output if failing>
- Git: <uncommitted changes, branch state>

## Next Steps
### Immediate (always include this section — it is critical)
1. Concrete first action with file paths and line numbers
### Then
- Subsequent tasks
### Blocked on
- Anything waiting on external input or decisions

## Useful Commands & Resources
Commands to run (build, test, dev server), relevant docs/tickets/PRs.
```

## Rules

- Be specific: file paths, line numbers, exact commands — not vague descriptions.
- Keep it under ~2000 words unless complexity genuinely demands more.
- Capture *why* decisions were made, not just what was done — rejected approaches save the next session from repeating them.
- Actually write the file with the write tool; don't just print the content.
- Never write a handoff until the filename is resolved and any overwrite confirmation has been handled.
- After saving, tell me the path and remind me to run `/pickup` in a fresh session `/new` to continue from it.
