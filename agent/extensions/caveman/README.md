# caveman

Compresses pi's LLM responses from polished prose to prehistoric grunt. Two modes cover professional-but-tight and maximum compression.



## Commands

| Command | Description |
|---------|-------------|
| `/caveman` | Cycle off → lite → full → off |
| `/caveman lite` | Professional, no fluff |
| `/caveman full` | Maximum compression |

## Levels

| Level | Style | Example |
|-------|-------|---------|
| **Lite** | No filler. Full sentences. Professional but tight. | "Your component re-renders because you create a new object reference each render." |
| **Full** | Abbreviations, arrows, maximum compression. | "Inline obj prop → new ref → re-render. `useMemo`." |

## Keyboard Shortcuts

- Default: `super+shift+tab` (Cmd+Shift+Tab on macOS, if your terminal reports the `super` modifier)
- Configure via `~/.pi/agent/configs/caveman.json`:

```json
{
  "defaultLevel": "off",
  "shortcuts": {
    "toggleMode": "super+shift+tab"
  }
}
```

Set `shortcuts.toggleMode` to an empty string to disable the shortcut.

## Persistence

Caveman state survives across sessions in two ways:

- **Session resume** — active level is stored in the session log via `pi.appendEntry`. If you fork or switch back to a session, the exact state (on/off + mode) is restored automatically.
- **New sessions** — the last-used state is saved to `~/.pi/agent/configs/caveman.json` and applied when starting a fresh session. This file is gitignored and auto-created on first use — no manual setup required.

Example config file (`~/.pi/agent/configs/caveman.json`):

```json
{
  "defaultLevel": "full",
  "shortcuts": {
    "toggleMode": "super+shift+tab"
  }
}
```

Valid values for `defaultLevel`: `"off"` (default, don't auto-enable), `"lite"`, `"full"`. Legacy `"ultra"` config/session values are treated as `"full"`. You can edit this file directly — changes take effect on the next session start.

## How it works

Hooks into `before_agent_start` and appends mode-specific instructions to the system prompt each turn. No post-processing — the LLM adjusts its output directly. Disabling caveman removes the instruction immediately on the next turn. Auto-clarity rules tell the model to drop caveman for security warnings or irreversible action confirmations, then resume after.
