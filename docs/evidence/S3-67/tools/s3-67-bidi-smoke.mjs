/**
 * S3-67 取证环境辅助：WebDriver BiDi 连通性冒烟（Firefox Remote Agent）
 *
 * 背景：本沙箱禁止 node 创建带管道子进程 ⇒ `playwright.launch()`（含 Firefox juggler 的 `-juggler-pipe`）
 *      与 Chromium（mojo 命名管道被拒）均不可用。实测可用路径：
 *      **PowerShell 启动 Firefox（`--remote-debugging-port=9222`）+ node 连 WebDriver BiDi（WebSocket/TCP）**。
 *
 * 用法：node docs/evidence/S3-67/tools/s3-67-bidi-smoke.mjs [wsEndpoint]
 */
const wsUrl = process.argv[2] || "ws://127.0.0.1:9222/session";
const TARGET = process.env.S3_67_BASE || "http://127.0.0.1:5173/";

const ws = new WebSocket(wsUrl);
let nextId = 1;
const pending = new Map();

ws.addEventListener("message", (ev) => {
  let msg;
  try { msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString()); } catch { return; }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.type === "error") reject(new Error(JSON.stringify(msg)));
    else resolve(msg.result);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error("timeout: " + method)); }
    }, 30000);
  });

ws.addEventListener("open", async () => {
  try {
    let sessionOk = "ok";
    try {
      const r = await send("session.new", { capabilities: {} });
      sessionOk = "sessionId=" + (r && r.sessionId);
    } catch (e) {
      sessionOk = "session.new 失败（多数情况下表示已存在隐式会话，可继续）：" + e.message.slice(0, 120);
    }
    console.log("[bidi] session:", sessionOk);

    const tree = await send("browsingContext.getTree", {});
    console.log("[bidi] contexts:", JSON.stringify(tree).slice(0, 300));
    let context = tree.contexts && tree.contexts[0] && tree.contexts[0].context;
    if (!context) {
      const created = await send("browsingContext.create", { type: "tab" });
      context = created.context;
    }
    const nav = await send("browsingContext.navigate", { context, url: TARGET, wait: "complete" });
    console.log("[bidi] navigate:", JSON.stringify(nav).slice(0, 200));

    const res = await send("script.evaluate", {
      expression: `({ url: location.href, title: document.title, hasAccountInput: !!document.querySelector('input[placeholder="账号"]'), ua: navigator.userAgent })`,
      target: { context },
      awaitPromise: true,
      resultOwnership: "none",
    });
    console.log("[bidi] evaluate:", JSON.stringify(res).slice(0, 500));
    ws.close();
    process.exit(0);
  } catch (e) {
    console.error("[bidi] FAIL:", e.message);
    process.exit(1);
  }
});

ws.addEventListener("error", (e) => {
  console.error("[bidi] WS 错误：", e.message || e.type);
  process.exit(1);
});
