# file-selector

Interactive file picker tool for Pi's TUI.

## Tool: `select_file`

Opens a `SelectList` populated with files from a directory and returns the selected file.

Parameters:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `directory` | string | yes | Directory to list. Relative paths resolve from the current project working directory. |
| `title` | string | no | Optional title shown above the selector. |

Result details include:

- `directory` — resolved absolute directory path
- `selectedPath` — absolute selected file path, or `null`
- `selectedName` — selected basename, or `null`
- `cancelled` — whether selection did not complete
- `reason` — optional `no-ui`, `empty`, or `cancelled`

## Pickup use case

`/pickup` uses this tool when no filename argument is provided, pointing it at `.pi/handoffs/` so the user can choose an existing handoff instead of typing a filename by hand.

If no TUI is available, the directory is empty, or the user cancels, the tool returns a clean cancellation result and the model should not guess a file.
