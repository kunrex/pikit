# mode-cycle

Binds `shift+tab` to cycle an exclusive mode ring:

1. Caveman (`full`)
2. Chat mode
3. Plan mode
4. Back to Caveman

## Why

`shift+tab` is normally bound to thinking-level cycling (`app.thinking.cycle`).
This extension repurposes `shift+tab` as a mode switcher, so rebind
`app.thinking.cycle` in `~/.pi/agent/keybindings.json` (for example to `ctrl+tab`).

## Behavior

- Entering a mode turns other modes in the ring off first.
- Plan mode includes both `plan` and `execute` states in the ring.
- Caveman is entered as `full` when cycling into it.

## Notes

- This extension depends on `chat-mode`, `plan-mode`, and `caveman` being loaded.
- If those controls are unavailable, it shows a warning toast instead of failing.
