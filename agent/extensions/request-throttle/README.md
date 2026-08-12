# request-throttle

Adds a simple delay layer before each provider request to reduce burst traffic on free-tier model limits.

## What it does

- Enforces a minimum spacing between provider requests (`minIntervalMs`)
- If the provider returns `429`, applies a cooldown before allowing the next request
- Uses the response `retry-after` header when available; otherwise falls back to `retryAfterFallbackMs`

This does **not** guarantee zero rate-limit errors (provider limits vary), but it reduces rapid-fire request bursts.

## Configuration

Config file:

`~/.pi/agent/configs/request-throttle.json`

Copy the example:

```bash
cp ~/.pi/agent/extensions/request-throttle/request-throttle.example.json ~/.pi/agent/configs/request-throttle.json
```

Fields:

- `minIntervalMs` (number, default `3500`): minimum delay between provider requests
- `retryAfterFallbackMs` (number, default `30000`): cooldown used when `retry-after` is missing or invalid

## Command

Use `/throttle` to inspect or adjust runtime values:

- `/throttle` → show current settings + remaining cooldown
- `/throttle 5000` → set minimum interval to 5000ms
- `/throttle fallback 45000` → set 429 fallback cooldown to 45s
- `/throttle reset` → restore defaults from config

## Notes

- Command changes persist to `~/.pi/agent/configs/request-throttle.json`
- Extension is auto-discovered from `~/.pi/agent/extensions/request-throttle/index.ts`
- Reload pi (or run `/reload`) after adding/changing extension files
