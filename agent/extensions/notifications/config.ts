import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { NotificationsAuthConfig, NotificationsUserConfig } from "./types.js";

export const DEFAULT_CONFIG = { URL: "", USERNAME: "", PASSWORD: "" };
export const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "notifications.json");

function loadUserConfig(): NotificationsUserConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) ?? {};
  } catch {
    return {};
  }
}

export const AUTH_PATH = join(homedir(), ".pi", "agent", "configs", "notifications-auth.json");

export function loadAuth(): NotificationsAuthConfig {
  let auth: NotificationsAuthConfig;
  try {
    auth = JSON.parse(readFileSync(AUTH_PATH, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error("Could not load notification authentication");
  }
  return {
    username: auth?.username ?? DEFAULT_CONFIG.USERNAME,
    password: auth?.password ?? DEFAULT_CONFIG.PASSWORD,
  };
}

export function loadConfig() {
  const userConfig = loadUserConfig();
  return { url: userConfig.url ?? DEFAULT_CONFIG.URL };
}
