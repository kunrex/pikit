# subagents

Delegate work to specialized child pi agents.

## How it works

The extension registers one tool: `subagent`.

When called, it starts child `pi` processes with agent-specific config. Each child can have its own model, tools, extensions, skills, and system prompt. Results stream back to the parent agent.

Subagents cannot spawn more subagents. `PI_SUBAGENT_DEPTH` prevents recursion.

## Modes

| Mode | Input | Description |
|------|-------|-------------|
| Single | `agent` + `task` | Run one agent on one task |
| Parallel | `tasks` | Run up to 8 tasks, 4 concurrent |
| Chain | `chain` | Run steps in order; use `{previous}` to pass prior output |

## Agent files

Agents are markdown files with YAML frontmatter plus a system prompt body.

Locations:

- Project: `.pi/agents/`
- User: `~/.pi/agent/agents/`

Example:

```md
---
name: scout
description: Find relevant files and summarize code structure
tools: read, grep, find, ls
model: kimi-k2.6:cloud
thinking: medium
---

You are a code scout. Search first, read only relevant files, report concise findings with paths.
```

Required fields:

- `name`
- `description`

Optional fields:

- `tools`
- `model`
- `thinking`
- `extensions`
- `skills`

## Usage examples

Single:

```json
{
  "agent": "scout",
  "task": "Find auth middleware and summarize token validation flow"
}
```

Parallel:

```json
{
  "tasks": [
    { "agent": "scout", "task": "Find DB connection code" },
    { "agent": "reviewer", "task": "Review auth middleware for bugs" }
  ]
}
```

Chain:

```json
{
  "chain": [
    { "agent": "scout", "task": "Find auth-related files" },
    { "agent": "planner", "task": "Using this context: {previous}\nPlan cleanup steps" }
  ]
}
```

## Configuration

Optional display config lives at:

```bash
~/.pi/agent/configs/subagents.json
```

Copy starter config:

```bash
cp ~/.pi/agent/extensions/subagents/subagents.example.json \
   ~/.pi/agent/configs/subagents.json
```

Most users do not need config.

## Notes

- Run `/reload` after adding or editing agent files.
- No built-in agents are provided; create `.md` agent files first.
- Parallel mode caps at 8 tasks total, 4 concurrent.
