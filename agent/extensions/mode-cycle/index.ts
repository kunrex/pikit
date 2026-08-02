import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";

const SHORTCUT: KeyId = "shift+tab";

type Stage = "off" | "caveman" | "chat" | "plan";

type ChatModeState = { mode?: "off" | "chat" };
type PlanModeState = { mode?: "off" | "plan" | "execute" };
type CavemanState = { enabled?: boolean; mode?: "lite" | "full" | "ultra" };

type ChatModeControl = {
  enter: (ctx: ExtensionContext, notify?: boolean) => void;
  off: (ctx: ExtensionContext, notify?: boolean) => void;
};

type PlanModeControl = {
  enter: (ctx: ExtensionContext, notify?: boolean) => void;
  off: (ctx: ExtensionContext, notify?: boolean) => void;
};

type CavemanControl = {
  set: (ctx: ExtensionContext, mode?: "lite" | "full" | "ultra", notify?: boolean) => void;
  off: (ctx: ExtensionContext, notify?: boolean) => void;
};

function getChatModeState(): ChatModeState {
  return ((globalThis as Record<string, unknown>).__chatMode as ChatModeState | undefined) ?? { mode: "off" };
}

function getPlanModeState(): PlanModeState {
  return ((globalThis as Record<string, unknown>).__planMode as PlanModeState | undefined) ?? { mode: "off" };
}

function getCavemanState(): CavemanState {
  return ((globalThis as Record<string, unknown>).__caveman as CavemanState | undefined) ?? { enabled: false, mode:
"full" };
}

function getControls(): {
  chat?: ChatModeControl;
  plan?: PlanModeControl;
  caveman?: CavemanControl;
} {
  return {
    chat: (globalThis as Record<string, unknown>).__chatModeControl as ChatModeControl | undefined,
    plan: (globalThis as Record<string, unknown>).__planModeControl as PlanModeControl | undefined,
    caveman: (globalThis as Record<string, unknown>).__cavemanControl as CavemanControl | undefined,
  };
}

function getStage(): Stage {
  const planMode = getPlanModeState().mode ?? "off";
  if (planMode !== "off") return "plan";

  const chatMode = getChatModeState().mode ?? "off";
  if (chatMode === "chat") return "chat";

  const caveman = getCavemanState();
  if (caveman.enabled) return "caveman";

  return "off";
}

function renderWidget(ctx: ExtensionContext, stage: Stage): void {
  if (!ctx.hasUI) return;

  const label = stage === "off" ? "Mode cycle: OFF" : `Mode cycle: ${stage.toUpperCase()}`;
  const color =
    stage === "off" ? "dim" :
    stage === "plan" ? "success" :
    stage === "chat" ? "accent" :
    "warning";

  ctx.ui.setWidget("mode-cycle", [ctx.ui.theme.fg(color as any, label)]);
}

function transitionTo(ctx: ExtensionContext, stage: Stage): void {
  const { chat, plan, caveman } = getControls();
  if (!chat || !plan || !caveman) return;

  if (stage === "off") {
    plan.off(ctx, false);
    chat.off(ctx, false);
    caveman.off(ctx, false);
    if (ctx.hasUI) ctx.ui.notify("Mode cycle: OFF", "warning");
    renderWidget(ctx, "off");
    return;
  }

  if (stage === "caveman") {
    plan.off(ctx, false);
    chat.off(ctx, false);
    caveman.set(ctx, "full", true);
    renderWidget(ctx, "caveman");
    return;
  }

  if (stage === "chat") {
    plan.off(ctx, false);
    caveman.off(ctx, false);
    chat.enter(ctx, true);
    renderWidget(ctx, "chat");
    return;
  }

  caveman.off(ctx, false);
  chat.off(ctx, false);
  plan.enter(ctx, true);
  renderWidget(ctx, "plan");
}

export default function modeCycle(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    renderWidget(ctx, getStage());
  });

  pi.registerShortcut(SHORTCUT, {
    description: "Cycle Off → Caveman → Chat → Plan (exclusive)",
    handler: async (ctx) => {
      const controls = getControls();
      if (!controls.chat || !controls.plan || !controls.caveman) {
        if (ctx.hasUI) ctx.ui.notify("Mode cycle unavailable: chat/plan/caveman extension controls not ready.", "warning");
        return;
      }

      const current = getStage();
      const next: Stage =
        current === "off" ? "caveman" :
        current === "caveman" ? "chat" :
        current === "chat" ? "plan" :
        "off";

      transitionTo(ctx, next);
    },
  });
}
