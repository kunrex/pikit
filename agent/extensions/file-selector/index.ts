import { DynamicBorder, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, SelectList, Text, type SelectItem } from "@earendil-works/pi-tui";
import { readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { Type, type Static } from "typebox";

const SelectFileParams = Type.Object({
  directory: Type.String({
    description: "Directory to list files from. Relative paths are resolved from the current working directory.",
  }),
  title: Type.Optional(
    Type.String({
      description: "Optional title shown above the file selector.",
    }),
  ),
});

type SelectFileInput = Static<typeof SelectFileParams>;

interface SelectFileDetails {
  directory: string;
  selectedPath: string | null;
  selectedName: string | null;
  cancelled: boolean;
  reason?: "no-ui" | "empty" | "cancelled";
}

function result(
  text: string,
  details: SelectFileDetails,
  isError = false,
) {
  return {
    content: [{ type: "text" as const, text }],
    details,
    isError,
  };
}

export default function fileSelector(pi: ExtensionAPI) {
  pi.registerTool({
    name: "select_file",
    label: "Select File",
    description:
      "Open an interactive TUI file picker for selecting one file from a directory. Use when the user should choose from existing files instead of typing a filename.",
    promptSnippet: "Select one file from a directory using an interactive TUI list",
    promptGuidelines: [
      "Use select_file when the user should choose one existing file from a known directory.",
      "If select_file reports no UI, an empty directory, or cancellation, do not guess a file; ask the user how to proceed or stop if cancellation was requested.",
    ],
    parameters: SelectFileParams,

    async execute(_toolCallId, params: SelectFileInput, signal, _onUpdate, ctx) {
      const directory = resolve(ctx.cwd, params.directory);
      const baseDetails = {
        directory,
        selectedPath: null,
        selectedName: null,
        cancelled: true,
      } satisfies SelectFileDetails;

      if (ctx.mode !== "tui") {
        return result(
          "No interactive UI is available, so the file selector could not be shown.",
          { ...baseDetails, reason: "no-ui" },
          true,
        );
      }

      if (signal?.aborted) {
        return result("Cancelled", { ...baseDetails, reason: "cancelled" });
      }

      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return result(
          `Could not list directory: ${message}`,
          baseDetails,
          true,
        );
      }

      const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

      if (files.length === 0) {
        return result(
          `No files found in ${directory}.`,
          { ...baseDetails, reason: "empty" },
        );
      }

      const items: SelectItem[] = files.map((name) => ({
        value: resolve(directory, name),
        label: name,
      }));

      const selectedPath = await ctx.ui.custom<string | null>(
        (tui, theme, _keybindings, done) => {
          let settled = false;

          function finish(value: string | null) {
            if (settled) return;
            settled = true;
            signal?.removeEventListener("abort", cancel);
            done(value);
          }

          function cancel() {
            finish(null);
          }

          signal?.addEventListener("abort", cancel, { once: true });
          if (signal?.aborted) queueMicrotask(cancel);

          const container = new Container();
          container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
          container.addChild(
            new Text(
              theme.fg("accent", theme.bold(params.title?.trim() || "Select a file")) +
                " " +
                theme.fg("dim", directory),
              1,
              0,
            ),
          );

          const selectList = new SelectList(items, Math.min(items.length, 12), {
            selectedPrefix: (text: string) => theme.fg("accent", text),
            selectedText: (text: string) => theme.fg("accent", text),
            description: (text: string) => theme.fg("muted", text),
            scrollInfo: (text: string) => theme.fg("dim", text),
            noMatch: (text: string) => theme.fg("warning", text),
          });
          selectList.onSelect = (item) => finish(item.value);
          selectList.onCancel = () => finish(null);
          container.addChild(selectList);
          container.addChild(
            new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel"), 1, 0),
          );
          container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

          return {
            render: (width: number) => container.render(width),
            invalidate: () => container.invalidate(),
            handleInput: (data: string) => {
              selectList.handleInput?.(data);
              tui.requestRender();
            },
            dispose: () => {
              signal?.removeEventListener("abort", cancel);
            },
          };
        },
      );

      if (!selectedPath) {
        return result("User cancelled file selection.", {
          ...baseDetails,
          reason: "cancelled",
        });
      }

      const selectedName = basename(selectedPath);
      return result(`Selected file: ${selectedPath}`, {
        directory,
        selectedPath,
        selectedName,
        cancelled: false,
      });
    },

    renderCall(args, theme, _context) {
      const directory = typeof args.directory === "string" ? args.directory : "";
      return new Text(
        theme.fg("toolTitle", theme.bold("select_file ")) +
          theme.fg("muted", directory),
        0,
        0,
      );
    },

    renderResult(toolResult, _options, theme, _context) {
      const details = toolResult.details as SelectFileDetails | undefined;
      if (!details || details.cancelled || !details.selectedName) {
        return new Text(theme.fg("warning", "✗ no file selected"), 0, 0);
      }

      return new Text(
        theme.fg("success", "✓ ") + theme.fg("accent", details.selectedName),
        0,
        0,
      );
    },
  });
}
