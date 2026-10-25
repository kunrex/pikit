import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";
import ts from "typescript";

// Transpile into an isolated fixture; no Pi process, live config, or remote service is used.
const dir = await mkdtemp(join(tmpdir(), "pi-notifications-test-"));
after(() => rm(dir, { recursive: true, force: true }));
await writeFile(join(dir, "package.json"), '{"type":"module"}');
for (const name of ["index", "utils", "types"]) {
  const source = await readFile(new URL(`./${name}.ts`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  await writeFile(join(dir, `${name}.js`), output);
}
await writeFile(join(dir, "config.js"), 'export const config = { url: "https://example.invalid/topic", auth: {} }; export const loadConfig = () => config; export const loadAuth = () => config.auth;');
const { default: extension } = await import(pathToFileURL(join(dir, "index.js")));
const { chooseRoute, cleanLabel, taskLabel, postNotification } = await import(pathToFileURL(join(dir, "utils.js")));
const { config } = await import(pathToFileURL(join(dir, "config.js")));

function fixture(t, { clients, tmux = true, failTmux = false, summary } = {}) {
  const oldEnv = { TMUX: process.env.TMUX, TMUX_PANE: process.env.TMUX_PANE };
  const oldFetch = globalThis.fetch;
  const oldUrl = config.url;
  const oldAuth = config.auth;
  if (tmux) { process.env.TMUX = "/tmp/fake,1,0"; process.env.TMUX_PANE = "%1"; }
  else { delete process.env.TMUX; delete process.env.TMUX_PANE; }
  t.after(() => {
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = oldFetch;
    config.url = oldUrl;
    config.auth = oldAuth;
  });
  const posts = [], commands = [], warnings = [], handlers = new Map();
  let modelCalls = 0;
  const ctx = {
    hasUI: true,
    sessionManager: { getSessionId: () => "session-1" },
    model: {},
    modelRegistry: {
      streamSimple: () => {
        modelCalls++;
        return { result: summary ?? (async () => ({ stopReason: "stop", content: [{ type: "text", text: "Add password reset" }] })) };
      },
    },
    ui: { notify: (...args) => warnings.push(args) },
  };
  const pi = {
    events: {
      on: (event, handler) => handlers.set(event, handler),
    },
    on: (event, handler) => handlers.set(event, handler),
    exec: async (command, args) => {
      assert.equal(command, "tmux");
      commands.push(args);
      if (failTmux) return { code: 1, stdout: "", stderr: "error" };
      const stdout = args[0] === "list-clients" ? (typeof clients === "function" ? clients() : clients ?? "")
        : args.includes("-p") ? "$1" : "";
      return { code: 0, stdout, stderr: "" };
    },
  };
  globalThis.fetch = async (url, options) => {
    posts.push({ url: String(url), ...options });
    return new Response(null, { status: 200 });
  };
  extension(pi);
  const emit = (event, data = {}) => handlers.get(event)?.(data, ctx);
  const start = () => emit("before_agent_start", { prompt: "Please add password reset support" });
  const settle = async (outcome = "completed") => {
    await emit("agent_before_settle", { outcome });
    await emit("agent_settled");
  };
  const ask = async (question = "Which environment should I deploy to?", signal = new AbortController().signal) => {
    emit("ask-user:question", { question, ctx, signal });
    await new Promise((done) => setImmediate(done));
  };
  return { posts, commands, warnings, ctx, emit, start, settle, ask, modelCalls: () => modelCalls };
}

test("route matrix: detached, other sessions, hidden pane/window, viewed, multiple clients", () => {
  assert.deepEqual(chooseRoute("%1", "$1", ""), { kind: "http" });
  assert.deepEqual(chooseRoute("%1", "$1", "/dev/ttys0\t$2\t%2"), { kind: "http" });
  assert.deepEqual(chooseRoute("%1", "$1", "/dev/ttys0\t$1\t%2"), { kind: "tmux", clients: ["/dev/ttys0"] });
  assert.deepEqual(chooseRoute("%1", "$1", "/dev/ttys0\t$1\t%1"), { kind: "silent" });
  assert.deepEqual(chooseRoute("%1", "$1", "a\t$1\t%2\nb\t$1\t%1"), { kind: "silent" });
});

for (const tmux of [false, true]) {
  test(`HTTP POST when ${tmux ? "detached" : "outside tmux"}, once per settlement`, async (t) => {
    const f = fixture(t, { tmux });
    await f.start();
    await f.settle();
    await f.settle();
    assert.equal(f.posts.length, 1);
    assert.equal(f.posts[0].method, "POST");
    assert.equal(f.posts[0].headers.Title, "Task completed");
    assert.equal(f.posts[0].body, "Add password reset");
    assert.equal(f.posts[0].headers.Authorization, undefined);
    assert.equal(f.posts[0].redirect, "error");
    assert.equal(f.modelCalls(), 1);
  });
}

for (const tmux of [false, true]) {
  test(`ask_user sends authenticated Input needed notification when ${tmux ? "detached" : "outside tmux"}`, async (t) => {
    const f = fixture(t, { tmux });
    config.auth = { username: "test", password: "secret" };
    await f.ask();
    assert.equal(f.posts.length, 1);
    assert.equal(f.posts[0].headers.Title, "Input needed");
    assert.equal(f.posts[0].body, "Which environment should I deploy to?");
    assert.equal(f.posts[0].headers.Authorization, `Basic ${Buffer.from("test:secret").toString("base64")}`);
    assert.equal(f.modelCalls(), 0);
  });
}

test("ask_user uses highlighted banner for hidden attached pane", async (t) => {
  const f = fixture(t, { clients: "a\t$1\t%2" });
  await f.ask("Deploy #{pane_id} #[fg=red]?");
  assert.equal(f.posts.length, 0);
  const banner = f.commands.find((args) => args.includes("-l"));
  assert.equal(banner.at(-1), "#[fg=black,bg=#9a7cff,bold]  Input needed: Deploy ##{pane_id} ##[fg=red]?  #[default]");
  assert.ok(banner.includes("15000"));
  assert.equal(f.modelCalls(), 0);
});

test("ask_user stays silent for viewed pane or disabled HTTP", async (t) => {
  const f = fixture(t, { clients: "a\t$1\t%1" });
  await f.ask();
  assert.equal(f.posts.length, 0);
  assert.equal(f.commands.filter((args) => args.includes("-l")).length, 0);
  delete process.env.TMUX;
  config.url = "";
  await f.ask();
  assert.equal(f.posts.length, 0);
});

test("answered or cancelled question suppresses unsent notification", async (t) => {
  const f = fixture(t, { clients: "a\t$1\t%2" });
  const controller = new AbortController();
  const notifying = f.ask("Continue?", controller.signal);
  controller.abort();
  await notifying;
  assert.equal(f.posts.length, 0);
  assert.equal(f.commands.filter((args) => args.includes("-l")).length, 0);
});

test("ask_user notification failure is caught and reported", async (t) => {
  const f = fixture(t, { failTmux: true });
  await f.ask();
  assert.equal(f.posts.length, 0);
  assert.equal(f.warnings.length, 1);
});

test("visible pane suppresses notification and model call", async (t) => {
  const f = fixture(t, { clients: "a\t$1\t%1" });
  await f.start(); await f.settle();
  assert.equal(f.posts.length, 0);
  assert.equal(f.modelCalls(), 0);
});

test("hidden agent sends literal local message to every attached client, never HTTP", async (t) => {
  const f = fixture(t, { clients: "a\t$1\t%2\nb\t$1\t%3" });
  config.url = "";
  await f.start(); await f.settle();
  assert.equal(f.posts.length, 0);
  const messages = f.commands.filter((args) => args.includes("-l"));
  assert.equal(messages.length, 2);
  assert.equal(messages[0][2], "a");
  assert.equal(messages[1][2], "b");
  assert.equal(messages[0][messages[0].indexOf("-d") + 1], "15000");
  assert.ok(messages[0].includes("-C"));
  assert.ok(!messages[0].includes("-N"));
  assert.equal(messages[0].at(-1), "#[fg=black,bg=#9a7cff,bold]  Task completed: Add password reset  #[default]");
});

test("banner escapes tmux style and format syntax in task descriptions", async (t) => {
  const f = fixture(t, {
    clients: "a\t$1\t%2",
    summary: async () => ({ stopReason: "stop", content: [{ type: "text", text: "Fix #{pane_id} #[fg=red]" }] }),
  });
  await f.start(); await f.settle();
  const message = f.commands.find((args) => args.includes("-l"));
  assert.equal(message.at(-1), "#[fg=black,bg=#9a7cff,bold]  Task completed: Fix ##{pane_id} ##[fg=red]  #[default]");
  assert.equal(f.posts.length, 0);
});

test("visibility is rechecked after generation", async (t) => {
  let calls = 0;
  const f = fixture(t, { clients: () => ++calls === 1 ? "a\t$1\t%2" : "a\t$1\t%1" });
  await f.start(); await f.settle();
  assert.equal(f.posts.length, 0);
  assert.equal(f.commands.filter((args) => args.includes("-l")).length, 0);
});

test("blank URL skips HTTP and summary generation", async (t) => {
  const f = fixture(t, { tmux: false });
  config.url = "";
  await f.start(); await f.settle();
  assert.equal(f.modelCalls(), 0);
  assert.equal(f.posts.length, 0);
});

test("tmux inspection failure warns without HTTP fallback", async (t) => {
  const f = fixture(t, { failTmux: true });
  await f.start(); await f.settle();
  assert.equal(f.posts.length, 0);
  assert.equal(f.warnings.length, 1);
});

for (const outcome of ["aborted", "error"]) {
  test(`${outcome} is not called completed`, async (t) => {
    const f = fixture(t, { tmux: false });
    await f.start(); await f.settle(outcome);
    assert.equal(f.posts[0].headers.Title, "Task stopped");
    assert.equal(f.posts[0].body, "Add password reset");
  });
}

test("summary failure falls back to the request", async (t) => {
  const f = fixture(t, { tmux: false, summary: async () => { throw new Error("no model"); } });
  await f.start(); await f.settle();
  assert.equal(f.posts[0].headers.Title, "Task completed");
  assert.equal(f.posts[0].body, "Please add password reset support");
});

test("session change/shutdown suppresses stale notification", async (t) => {
  const f = fixture(t, { tmux: false });
  await f.start(); await f.emit("session_start"); await f.settle();
  await f.start(); await f.emit("session_shutdown"); await f.settle();
  assert.equal(f.posts.length, 0);
});

test("shutdown during generation cancels delivery", async (t) => {
  let resolve;
  const f = fixture(t, { tmux: false, summary: () => new Promise((done) => { resolve = done; }) });
  await f.start();
  const settled = f.settle();
  while (!resolve) await new Promise((done) => setImmediate(done));
  await f.emit("session_shutdown");
  resolve({ stopReason: "stop", content: [{ type: "text", text: "Late summary" }] });
  await settled;
  assert.equal(f.posts.length, 0);
});

test("labels remove control characters and have bounded length", () => {
  assert.equal(cleanLabel("a\n\x1bb\t c"), "a b c");
  assert.equal(cleanLabel("a".repeat(200)).length, 120);
});

test("missing model uses bounded prompt fallback", async () => {
  assert.equal(await taskLabel("hello\nworld", {}, new AbortController().signal), "hello world");
});

test("Basic Auth matches curl -u, with title and description kept separate", async (t) => {
  const f = fixture(t, { tmux: false });
  config.auth = { username: "test-user", password: "test:password!" };
  await f.start(); await f.settle();
  assert.equal(f.posts.length, 1);
  assert.equal(f.posts[0].headers.Authorization, `Basic ${Buffer.from("test-user:test:password!").toString("base64")}`);
  assert.equal(f.posts[0].headers.Title, "Task completed");
  assert.equal(f.posts[0].headers["Content-Type"], "text/plain; charset=utf-8");
  assert.equal(f.posts[0].body, "Add password reset");
  config.auth = { username: "another-user", password: "changed" };
  await f.start(); await f.settle();
  assert.equal(f.posts[1].headers.Authorization, `Basic ${Buffer.from("another-user:changed").toString("base64")}`);
});

test("blank credentials omit Authorization", async (t) => {
  const f = fixture(t, { tmux: false });
  config.auth = { username: "", password: "" };
  await f.start(); await f.settle();
  assert.equal(f.posts[0].headers.Authorization, undefined);
});

test("partial or invalid credentials never send a request", async (t) => {
  const f = fixture(t, { tmux: false });
  for (const auth of [{ username: "user" }, { password: "secret" }, { username: "bad:user", password: "secret" }]) {
    await assert.rejects(postNotification("https://example.invalid/topic", "Task completed", "done", auth), /authentication requires/);
  }
  assert.equal(f.posts.length, 0);
});

test("HTTP errors and invalid protocols are rejected without leaking the URL", async (t) => {
  fixture(t, { tmux: false });
  globalThis.fetch = async () => new Response(null, { status: 403 });
  await assert.rejects(postNotification("https://example.invalid/secret", "Task completed", "done"), { message: "Notification endpoint returned HTTP 403" });
  await assert.rejects(postNotification("file:///secret", "Task completed", "done"), /HTTP or HTTPS/);
});
