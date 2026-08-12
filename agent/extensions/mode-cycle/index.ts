import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";

const SHORTCUT: KeyId = "shift+tab";

type Stage = "off" | "chat" | "plan";

type ChatModeState = { mode?: "off" | "chat" };
type PlanModeState = { mode?: "off" | "plan" | "execute" };

type ChatModeControl = {
  enter: (ctx: ExtensionContext, notify?: boolean) => void;
  off: (ctx: ExtensionContext, notify?: boolean) => void;
};

type PlanModeControl = {
  enter: (ctx: ExtensionContext, notify?: boolean) => void;
  off: (ctx: ExtensionContext, notify?: boolean) => void;
};

function getChatModeState(): ChatModeState {
  return ((globalThis as Record<string, unknown>).__chatMode as ChatModeState | undefined) ?? { mode: "off" };
}

function getPlanModeState(): PlanModeState {
  return ((globalThis as Record<string, unknown>).__planMode as PlanModeState | undefined) ?? { mode: "off" };
}

function getControls(): {
  chat?: ChatModeControl;
  plan?: PlanModeControl;
} {
  return {
    chat: (globalThis as Record<string, unknown>).__chatModeControl as ChatModeControl | undefined,
    plan: (globalThis as Record<string, unknown>).__planModeControl as PlanModeControl | undefined,
  };
}

function getStage(): Stage {
  const planMode = getPlanModeState().mode ?? "off";
  if (planMode !== "off") return "plan";

  const chatMode = getChatModeState().mode ?? "off";
  if (chatMode === "chat") return "chat";

  return "off";
}

function renderWidget(ctx: ExtensionContext, stage: Stage): void {
  if (!ctx.hasUI) return;

  const label = stage === "off" ? "Mode cycle: OFF" : `Mode cycle: ${stage.toUpperCase()}`;
  const color =
    stage === "off" ? "dim" :
    stage === "plan" ? "success" :
    "accent";

  ctx.ui.setWidget("mode-cycle", [ctx.ui.theme.fg(color as any, label)]);
}

function transitionTo(ctx: ExtensionContext, stage: Stage): void {
  const { chat, plan } = getControls();
  if (!chat || !plan) return;

  if (stage === "off") {
    plan.off(ctx, false);
    chat.off(ctx, false);
    if (ctx.hasUI) ctx.ui.notify("Mode cycle: OFF", "warning");
    renderWidget(ctx, "off");
    return;
  }

  if (stage === "chat") {
    plan.off(ctx, false);
    chat.enter(ctx, true);
    renderWidget(ctx, "chat");
    return;
  }

  chat.off(ctx, false);
  plan.enter(ctx, true);
  renderWidget(ctx, "plan");
}

export default function modeCycle(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    renderWidget(ctx, getStage());
  });

  pi.registerShortcut(SHORTCUT, {
    description: "Cycle Off → Chat → Plan (exclusive)",
    handler: async (ctx) => {
      const controls = getControls();
      if (!controls.chat || !controls.plan) {
        if (ctx.hasUI) ctx.ui.notify("Mode cycle unavailable: chat/plan extension controls not ready.", "warning");
        return;
      }

      const current = getStage();
      const next: Stage =
        current === "off" ? "chat" :
        current === "chat" ? "plan" :
        "off";

      transitionTo(ctx, next);
    },
  });
}
