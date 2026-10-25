# ask-user

Ask the user a single multiple-choice question from the agent.

## How it works

The extension registers one tool: `ask_user`.

The agent provides:

- `question` — prompt shown to the user
- `options` — 2 to 5 choices, each with a label and optional description

Pi shows an interactive TUI picker. The user can:

- choose an option with arrow keys or number keys
- choose **Write my own answer…** for free-form input
- press `Esc` to dismiss without answering

The selected answer is returned to the agent as the tool result.

## Tool

| Parameter | Type | Description |
|-----------|------|-------------|
| `question` | `string` | Question to ask |
| `options` | `object[]` | 2–5 choices with `label` and optional `description` |

Example:

```json
{
  "question": "Which env should I deploy to?",
  "options": [
    { "label": "staging", "description": "Safe test env" },
    { "label": "production", "description": "Live users" }
  ]
}
```

## Dependencies

Runtime dependencies, including `effect`, are declared in the repository's root `package.json`. For a direct clone into `~/.pi`, run `npm install` there once before starting Pi; no per-extension install is needed. Pi installs dependencies when this kit is installed as a managed npm or git package.

## Notes

- One question per tool call.
- Free-form answer option is added automatically.
- In non-TUI mode, tool tells the agent no interactive UI is available.
- With the [notifications extension](../notifications/README.md) loaded, opening a question emits `ask-user:question` and sends an `Input needed` notification through its existing tmux/HTTP routing. Viewing the agent pane suppresses the notification. Delivery runs in the background without delaying the question; answering or dismissing cancels pending delivery. Without that extension, the tool works unchanged.
