import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { loadConfig } from "./config.js";
import type { NotificationEvents, Outcome } from "./types.js";
import { getRoute, sendNotification, taskLabel } from "./utils.js";

export default function (pi: ExtensionAPI) {
  let pending: { sessionId: string; prompt: string; outcome: Outcome } | undefined;
  let summaryController: AbortController | undefined;
  const events = pi as unknown as NotificationEvents;

  function reportError(error: unknown, ctx: ExtensionContext) {
    // Never include the endpoint or credentials in error messages.
    const message = error instanceof Error && error.message.startsWith("Notification endpoint returned HTTP")
      ? error.message : "Notification failed; check tmux, notifications.json, and notifications-auth.json";
    if (ctx.hasUI) ctx.ui.notify(message, "warning");
    else console.error(`[notifications] ${message}`);
  }

  pi.events.on("ask-user:question", (data) => {
    const { question, ctx, signal } = data as { question: string; ctx: ExtensionContext; signal: AbortSignal };
    // Do not delay opening the question UI while inspecting tmux or sending HTTP.
    void sendNotification(pi, "Input needed", question, signal).catch((error) => {
      if (!signal.aborted) reportError(error, ctx);
    });
  });

  pi.on("before_agent_start", (event, ctx) => {
    summaryController?.abort();
    pending = {
      sessionId: ctx.sessionManager.getSessionId(),
      prompt: event.prompt,
      outcome: "completed",
    };
  });

  events.on("agent_before_settle", (event) => {
    if (pending) pending.outcome = event.outcome;
  });

  pi.on("session_start", () => {
    pending = undefined;
    summaryController?.abort();
  });
  pi.on("session_shutdown", () => {
    pending = undefined;
    summaryController?.abort();
  });

  events.on("agent_settled", async (_event, ctx) => {
    const task = pending;
    pending = undefined;
    if (!task || task.sessionId !== ctx.sessionManager.getSessionId()) return;

    try {
      const config = loadConfig();
      const route = await getRoute(pi);
      if (route.kind === "silent" || (route.kind === "http" && !config.url)) return;

      const controller = new AbortController();
      summaryController = controller;
      let label: string;
      try {
        label = await taskLabel(task.prompt, ctx, AbortSignal.any([
          controller.signal, AbortSignal.timeout(15000),
        ]));
      } finally {
        if (summaryController === controller) summaryController = undefined;
      }
      if (controller.signal.aborted) return;
      if (task.sessionId !== ctx.sessionManager.getSessionId()) return;

      // Delivery rechecks visibility after the label is generated.
      const status = task.outcome === "completed" ? "Task completed" : "Task stopped";
      await sendNotification(pi, status, label, controller.signal);
    } catch (error) {
      reportError(error, ctx);
    }
  });
}
