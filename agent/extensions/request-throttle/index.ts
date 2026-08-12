import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { loadConfig, saveConfig } from "./config.js";

function parseRetryAfterMs(value: string | undefined): number | undefined {
  if (!value) return undefined;

  const asSeconds = Number(value);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.round(asSeconds * 1000);
  }

  const asDate = Date.parse(value);
  if (Number.isNaN(asDate)) return undefined;

  return Math.max(0, asDate - Date.now());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function requestThrottleExtension(pi: ExtensionAPI) {
  const config = loadConfig();

  let minIntervalMs = config.minIntervalMs;
  let retryAfterFallbackMs = config.retryAfterFallbackMs;
  let nextAllowedAt = 0;
  let queuedWaitMs = 0;

  pi.on("before_provider_request", async () => {
    const now = Date.now();
    const waitMs = Math.max(0, nextAllowedAt - now);

    if (waitMs > 0) {
      queuedWaitMs += waitMs;
      await sleep(waitMs);
    }

    const startedAt = Date.now();
    nextAllowedAt = startedAt + minIntervalMs;
  });

  pi.on("after_provider_response", (event, ctx) => {
    if (event.status !== 429) return;

    const retryAfterHeader = event.headers["retry-after"];
    const retryAfterMs = parseRetryAfterMs(retryAfterHeader) ?? retryAfterFallbackMs;

    const cooldownUntil = Date.now() + retryAfterMs;
    if (cooldownUntil > nextAllowedAt) nextAllowedAt = cooldownUntil;

    if (ctx.hasUI) {
      const seconds = Math.ceil(retryAfterMs / 1000);
      const waitedSeconds = Math.ceil(queuedWaitMs / 1000);
      const queuedInfo = waitedSeconds > 0 ? ` (already delayed ${waitedSeconds}s this session)` : "";
      ctx.ui.notify(
        `[request-throttle] Rate limit hit (429). Cooling down for ${seconds}s${queuedInfo}.`,
        "warning",
      );
    }
  });

  pi.registerCommand("throttle", {
    description: "Request throttle: /throttle (show) · /throttle <ms> · /throttle fallback <ms> · /throttle reset",
    handler: async (args, ctx) => {
      const input = args.trim();

      const persist = async (): Promise<boolean> => {
        try {
          await saveConfig({ minIntervalMs, retryAfterFallbackMs });
          return true;
        } catch {
          if (ctx.hasUI) ctx.ui.notify("[request-throttle] Failed to persist config", "error");
          return false;
        }
      };

      if (!input) {
        const remainingMs = Math.max(0, nextAllowedAt - Date.now());
        const remaining = Math.ceil(remainingMs / 1000);
        if (ctx.hasUI) {
          ctx.ui.notify(
            `[request-throttle] minInterval=${minIntervalMs}ms, fallback=${retryAfterFallbackMs}ms, cooldownRemaining=${remaining}s`,
            "info",
          );
        }
        return;
      }

      if (input === "reset") {
        minIntervalMs = config.minIntervalMs;
        retryAfterFallbackMs = config.retryAfterFallbackMs;
        nextAllowedAt = 0;
        const persisted = await persist();
        if (ctx.hasUI) {
          const persistedText = persisted ? " and saved" : " (save failed)";
          ctx.ui.notify(
            `[request-throttle] Reset to defaults: minInterval=${minIntervalMs}ms, fallback=${retryAfterFallbackMs}ms${persistedText}`,
            persisted ? "info" : "warning",
          );
        }
        return;
      }

      const fallbackMatch = input.match(/^fallback\s+(\d+)$/);
      if (fallbackMatch) {
        retryAfterFallbackMs = Number(fallbackMatch[1]);
        const persisted = await persist();
        if (ctx.hasUI) {
          const persistedText = persisted ? " (saved)" : " (save failed)";
          ctx.ui.notify(`[request-throttle] fallback cooldown set to ${retryAfterFallbackMs}ms${persistedText}`, persisted ? "info" : "warning");
        }
        return;
      }

      const intervalMatch = input.match(/^(\d+)$/);
      if (intervalMatch) {
        minIntervalMs = Number(intervalMatch[1]);
        const persisted = await persist();
        if (ctx.hasUI) {
          const persistedText = persisted ? " (saved)" : " (save failed)";
          ctx.ui.notify(`[request-throttle] min interval set to ${minIntervalMs}ms${persistedText}`, persisted ? "info" : "warning");
        }
        return;
      }

      if (ctx.hasUI) {
        ctx.ui.notify("Usage: /throttle | /throttle <ms> | /throttle fallback <ms> | /throttle reset", "warning");
      }
    },
  });
}
