import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
} from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";

export type CavemanMode = "lite" | "full";
type CavemanLevel = CavemanMode | "off";

export interface CavemanState {
  enabled: boolean;
  mode: CavemanMode;
}

// ─── Persistence ────────────────────────────────────────────────────────────

interface CavemanConfig {
  defaultLevel: CavemanLevel;
  shortcuts: {
    toggleMode: string;
  };
}

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "caveman.json");
const DEFAULT_CONFIG: CavemanConfig = {
  defaultLevel: "off",
  shortcuts: { toggleMode: "super+shift+tab" },
};
const VALID_LEVELS = new Set<CavemanLevel>(["off", "lite", "full"]);

function normalizeLevel(value: unknown): CavemanLevel | null {
  if (value === "ultra") return "full"; // legacy: old ultra is now full
  return VALID_LEVELS.has(value as CavemanLevel) ? value as CavemanLevel : null;
}

function normalizeConfig(parsed: any): CavemanConfig {
  return {
    defaultLevel: normalizeLevel(parsed?.defaultLevel) ?? DEFAULT_CONFIG.defaultLevel,
    shortcuts: {
      toggleMode: typeof parsed?.shortcuts?.toggleMode === "string"
        ? parsed.shortcuts.toggleMode
        : DEFAULT_CONFIG.shortcuts.toggleMode,
    },
  };
}

async function loadConfig(): Promise<CavemanConfig> {
  try {
    return normalizeConfig(JSON.parse(await readFile(CONFIG_PATH, "utf8")));
  } catch {
    return { ...DEFAULT_CONFIG, shortcuts: { ...DEFAULT_CONFIG.shortcuts } };
  }
}

function loadConfigSync(): CavemanConfig {
  try {
    return normalizeConfig(JSON.parse(readFileSync(CONFIG_PATH, "utf8")));
  } catch {
    return { ...DEFAULT_CONFIG, shortcuts: { ...DEFAULT_CONFIG.shortcuts } };
  }
}

let saveInProgress = false;
let pendingSave: CavemanConfig | null = null;

function saveConfig(config: CavemanConfig): void {
  if (saveInProgress) {
    pendingSave = config;
    return;
  }
  pendingSave = null;
  saveInProgress = true;

  const snapshot = JSON.stringify(config, null, 2) + "\n";

  (async () => {
    try {
      await mkdir(join(homedir(), ".pi", "agent", "configs"), { recursive: true });
      await writeFile(CONFIG_PATH, snapshot, "utf8");
    } finally {
      saveInProgress = false;
      if (pendingSave) saveConfig(pendingSave);
    }
  })();
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

// Shared base rules applied to all modes
const BASE = `\
IMPORTANT: You are in CAVEMAN MODE. Respond terse like smart caveman. \
All technical substance stay. Only fluff die. \
Active every response. No drift back to verbose. Still active if unsure.

Rules:
- Drop articles (a/an/the), filler (just/really/basically/actually/simply), \
pleasantries, hedging
- Fragments OK. Short synonyms preferred. Technical terms exact
- Code blocks unchanged. Errors quoted exact
- Pattern: [thing] [action] [reason]. [next step].

Bad: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Good: "Bug in auth middleware. Token expiry check use \`<\` not \`<=\`. Fix:"`;

// Per-level intensity calibration (appended after BASE)
const INTENSITY: Record<CavemanMode, string> = {
  lite: `\
No filler/hedging. Keep articles + full sentences. Professional but tight.
Example: "Your component re-renders because you create a new object reference each render. Wrap it in \`useMemo\`."

Spectrum (same fix, different compression):
- lite (you):  "Your component re-renders because you create a new object reference each render. Wrap it in \`useMemo\`."
- full:        "Inline obj prop → new ref → re-render. \`useMemo\`."`,

  full: `\
MUST abbreviate all terms (DB/auth/config/req/res/fn/impl), strip ALL conjunctions & articles, arrows for causality (X → Y), one word beats two. \
Code symbols, function names, API names, error strings: never abbreviate.
Example - before: "The bug is in the authentication middleware. The token expiry check uses less-than instead of less-than-or-equal."
After: "Bug in auth middleware. Token expiry check use < not <=."
Example - before: "Connection pooling reuses open connections instead of creating new ones per request, avoiding repeated handshake overhead."
After: "Pool reuse DB conn. Skip handshake → fast under load."

Spectrum (same fix, different compression):
- lite:        "Your component re-renders because you create a new object reference each render. Wrap it in \`useMemo\`."
- full (you):  "Inline obj prop → new ref → re-render. \`useMemo\`."`,
};

// Safety clause — shared across all modes
const SAFETY = `\
Auto-clarity: drop caveman for security warnings, irreversible action confirmations, or when user is confused. Resume after.
Boundaries: write normal code. Only compress explanations. "stop caveman" or "normal mode" reverts.`;

function buildSystemPrompt(mode: CavemanMode, base: string): string {
  return `${BASE}\n\n${INTENSITY[mode]}\n\n${SAFETY}\n\n${base}`;
}

// ─── State ───────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<CavemanMode, string> = {
  lite: "lite",
  full: "full",
};

// Module-level state — shared via globalThis for footer segment reads
const state: CavemanState = { enabled: false, mode: "full" };
(globalThis as Record<string, unknown>).__caveman = state;

function setState(enabled: boolean, mode: CavemanMode): void {
  state.enabled = enabled;
  state.mode = mode;
  (globalThis as Record<string, unknown>).__caveman = { ...state };
  const requestRender = (globalThis as Record<string, unknown>).__footerRequestRender;
  if (typeof requestRender === "function") requestRender();
}

function notifyModeChange(ctx: ExtensionContext): void {
  if (!state.enabled) {
    ctx.ui.notify("Caveman off", "info");
    return;
  }
  const label = MODE_LABELS[state.mode];
  const descriptions: Record<CavemanMode, string> = {
    lite: "Professional, no fluff",
    full: "Maximum compression",
  };
  ctx.ui.notify(`Caveman on — ${label}: ${descriptions[state.mode]}`, "info");
}

function applyLevel(level: CavemanLevel, pi: ExtensionAPI, ctx: ExtensionContext, notify = true): void {
  if (level === "off") {
    setState(false, state.mode);
  } else {
    setState(true, level);
  }

  pi.appendEntry("caveman-level", { level: state.enabled ? state.mode : "off" });
  saveConfig({ ...loadConfigSync(), defaultLevel: state.enabled ? state.mode : "off" });
  if (notify && ctx.hasUI) notifyModeChange(ctx);
}

function cycleLevel(pi: ExtensionAPI, ctx: ExtensionContext, notify = true): void {
  if (!state.enabled) {
    applyLevel("lite", pi, ctx, notify);
  } else if (state.mode === "lite") {
    applyLevel("full", pi, ctx, notify);
  } else {
    applyLevel("off", pi, ctx, notify);
  }
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function caveman(pi: ExtensionAPI) {
  // Restore state on session start — session entry wins over config default
  pi.on("session_start", async (_event, ctx) => {
    let sessionLevel: CavemanLevel | null = null;
    const entries = ctx.sessionManager?.getEntries?.() ?? [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.type === "custom" && entry.customType === "caveman-level") {
        sessionLevel = (entry.data as { level: CavemanLevel })?.level ?? null;
        break;
      }
    }

    const normalizedSessionLevel = normalizeLevel(sessionLevel);
    if (normalizedSessionLevel !== null) {
      // Resuming a forked/switched session — restore exact state
      setState(normalizedSessionLevel !== "off", normalizedSessionLevel === "off" ? state.mode : normalizedSessionLevel);
    } else {
      // New session — apply config default
      const config = await loadConfig();
      if (config.defaultLevel !== "off") {
        setState(true, config.defaultLevel);
        pi.appendEntry("caveman-level", { level: config.defaultLevel });
      }
    }
  });

  // Inject caveman instructions into every system prompt when active
  pi.on(
    "before_agent_start",
    (event: BeforeAgentStartEvent): BeforeAgentStartEventResult => {
      if (!state.enabled) return {};
      return { systemPrompt: buildSystemPrompt(state.mode, event.systemPrompt ?? "") };
    },
  );

  // /caveman [lite|full]
  // No args: cycle off → lite → full → off
  pi.registerCommand("caveman", {
    description:
      "Toggle caveman speak mode. Subcommands: lite · full. No args: cycle off → lite → full → off.",
    handler: async (args: string | undefined, ctx: ExtensionContext) => {
      if (!ctx.hasUI) return;

      const sub = (args ?? "").trim().toLowerCase();

      if (sub === "") {
        cycleLevel(pi, ctx);
      } else if (sub === "off") {
        applyLevel("off", pi, ctx);
      } else if (sub === "lite" || sub === "full") {
        applyLevel(sub, pi, ctx);
      } else {
        ctx.ui.notify(
          [
            "Usage: /caveman [subcommand]",
            "",
            "  /caveman          Toggle on (full as default) / off",
            "  /caveman off      Turn off caveman mode",
            "  /caveman lite     Professional, no fluff",
            "  /caveman full     Maximum compression",
          ].join("\n"),
          "info",
        );
        return;
      }
    },
  });

  const toggleShortcut = loadConfigSync().shortcuts.toggleMode;
  if (toggleShortcut) {
    pi.registerShortcut(toggleShortcut as KeyId, {
      description: "Toggle caveman mode",
      handler: async (ctx) => cycleLevel(pi, ctx),
    });
  }

  // Expose lightweight control API for companion extensions (e.g. mode-cycle)
  (globalThis as Record<string, unknown>).__cavemanControl = {
    set: (ctx: ExtensionContext, mode: CavemanMode = "full", notify = true) => applyLevel(mode, pi, ctx, notify),
    off: (ctx: ExtensionContext, notify = true) => applyLevel("off", pi, ctx, notify),
    toggle: (ctx: ExtensionContext, notify = true) => cycleLevel(pi, ctx, notify),
    getState: () => ({ enabled: state.enabled, mode: state.mode }),
  };
}
