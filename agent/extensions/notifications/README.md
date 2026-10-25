# Notifications

Extension-owned task notifications after `agent_settled`. No agent tool calls or notification instructions are added to the main conversation. Requires Pi 1.x with `agent_settled`, `agent_before_settle`, and `modelRegistry.streamSimple`.

## Configuration

Edit `~/.pi/agent/configs/notifications.json`:

```json
{
  "url": "https://ntfy.sh/your-private-topic"
}
```

The URL is the complete HTTP POST endpoint. An empty URL disables HTTP delivery but not local tmux messages. An example is provided in `notifications.example.json`.

For HTTP Basic Auth (equivalent to `curl -u 'username:password'`), fill in `~/.pi/agent/configs/notifications-auth.json`:

```json
{
  "username": "",
  "password": ""
}
```

Fill both fields to enable authentication; leaving both blank (or omitting the file) sends no Authorization header. A partially filled or malformed auth file blocks HTTP delivery and reports a warning. Colons are allowed in passwords, but not usernames. An example is provided in `notifications-auth.example.json`. Keep this file private (`chmod 600`) and use HTTPS for authenticated endpoints. Credentials are never passed to the model or included in error messages.

Both files are reread for each notification; URL and credential changes do not require reload.

Run `/reload` once after installing the extension (or restart Pi).

## Routing

| Agent location | Delivery |
|---|---|
| Outside tmux | HTTP POST |
| Agent's tmux session has no attached clients | HTTP POST |
| Session attached, agent pane not active in any attached client | 15-second bold, black-on-lavender (`#9a7cff`, matching the lavender theme) status-line banner to each client attached to that session |
| Agent pane active in any attached client | Nothing |

Visibility means tmux's active window and pane, not whether the terminal app has desktop focus. No popup or focus change is used. `TMUX` and `TMUX_PANE` identify the agent pane. If tmux inspection fails, the extension reports a warning rather than guessing and sending HTTP. It uses argument arrays, never shell interpolation, and escapes task text to prevent tmux style injection or format expansion. Banners stay visible for up to 15 seconds while panes keep updating. Typing dismisses the banner and passes the key through normally; no dedicated dismissal is required. Banners do not change your tmux theme or options.

## Questions needing input

When `ask_user` opens its TUI question, it emits `ask-user:question` on Pi's extension event bus. This extension sends an `Input needed` notification with the question as its description, using the same routing, authentication, and highlighted banner as task notifications. The question opens immediately without waiting for delivery, and no model call is made. Answering, dismissing, or cancelling the question cancels any pending delivery; a notification already delivered cannot be recalled. HTTP notifications include the question text, so avoid secrets in questions.

If this extension is not loaded, `ask_user` continues to work normally without notifications. Non-TUI calls do not open a question or emit this event.

## Task labels and outcomes

`before_agent_start` captures the request; `agent_before_settle` captures the final runtime outcome. At `agent_settled`, the extension checks visibility, then makes a small separate model call through the current model's configured provider to generate a short task label. This call is extension-owned, incurs model usage, and does not appear as an agent tool call. It is skipped when notifications are suppressed or HTTP is disabled. Visibility is checked again after generation.

The label call has a 15-second abort timeout. If unavailable or unsuccessful, a sanitized, truncated request is used instead. Session changes, shutdown, or a new request cancel pending label delivery. State is in memory; no notification folder or history is created.

- Normal settlement: `Task completed: Add password reset support`
- Aborted or failed run: `Task stopped: Add password reset support`

“Completed” reflects Pi's runtime outcome, not independent verification that the user's goal succeeded. A normal response asking for clarification can still count as completed.

HTTP delivery separates title and description, matching ntfy's curl format:

```bash
curl -u 'username:password' \
  -H 'Title: Task completed' \
  -d 'Add password reset support' \
  https://ntfy.sh/your-private-topic
```

The `Title` header is `Task completed` or `Task stopped`; the generated task description is the UTF-8 plain-text POST body. Local tmux messages keep the combined `Task completed: description` format. HTTP requests have a 10-second timeout. Non-2xx responses are reported, redirects are rejected (so credentials are not forwarded), and requests are not retried automatically. The endpoint is not included in error messages.

**Privacy:** request text is sent to the configured model provider for label generation, and the resulting label (or request excerpt on fallback) is sent to your endpoint. Use a private/protected ntfy topic and avoid secret-bearing requests. The global config is gitignored in this repo.

## Verification

From the repository root:

```bash
npm run check
node --test agent/extensions/notifications/notifications.test.mjs
```

Tests use isolated config and mocked HTTP/tmux/model responses; they never post to your configured endpoint.
