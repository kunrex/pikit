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

## Notes

- One question per tool call.
- Free-form answer option is added automatically.
- In non-TUI mode, tool tells the agent no interactive UI is available.
