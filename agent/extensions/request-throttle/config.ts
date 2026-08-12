import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface RequestThrottleConfig {
  minIntervalMs: number;
  retryAfterFallbackMs: number;
}

const DEFAULT_CONFIG: RequestThrottleConfig = {
  minIntervalMs: 3500,
  retryAfterFallbackMs: 30000,
};

const CONFIG_DIR = join(homedir(), ".pi", "agent", "configs");
const CONFIG_PATH = join(CONFIG_DIR, "request-throttle.json");

function toPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function loadConfig(): RequestThrottleConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return {
      minIntervalMs: toPositiveNumber(parsed.minIntervalMs) ?? DEFAULT_CONFIG.minIntervalMs,
      retryAfterFallbackMs:
        toPositiveNumber(parsed.retryAfterFallbackMs) ?? DEFAULT_CONFIG.retryAfterFallbackMs,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: RequestThrottleConfig): Promise<void> {
  const snapshot = JSON.stringify(config, null, 2) + "\n";
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, snapshot, "utf8");
}
