# mode-cycle

Binds `shift+tab` to cycle an exclusive mode ring:

1. Chat mode
2. Plan mode
3. Off

## Why

`shift+tab` is normally bound to thinking-level cycling (`app.thinking.cycle`).
This extension repurposes `shift+tab` as a mode switcher, so rebind
`app.thinking.cycle` in `~/.pi/agent/keybindings.json` (for example to `ctrl+tab`).

## Behavior

- Entering a mode turns other modes in the ring off first.
- Plan mode includes both `plan` and `execute` states in the ring.

## Notes

- This extension depends on `chat-mode` and `plan-mode` being loaded.
- If those controls are unavailable, it shows a warning toast instead of failing.
