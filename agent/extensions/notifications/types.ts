import type { AssistantMessageEventStream, Context, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface NotificationsUserConfig {
  url?: string;
}

export interface NotificationsAuthConfig {
  username?: string;
  password?: string;
}

export type Outcome = "completed" | "aborted" | "error";

// The repo's development types predate the installed Pi 1.x lifecycle/runtime.
export interface NotificationEvents {
  on(event: "agent_before_settle", handler: (event: { outcome: Outcome }) => void): void;
  on(event: "agent_settled", handler: (event: unknown, ctx: ExtensionContext) => Promise<void>): void;
}

export interface NotificationModelRegistry {
  streamSimple(
    model: Model<any>,
    context: Context,
    options: { maxTokens: number; signal: AbortSignal },
  ): AssistantMessageEventStream;
}

export type Route = { kind: "silent" } | { kind: "http" } | { kind: "tmux"; clients: string[] };
