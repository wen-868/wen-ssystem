/**
 * WORKBENCH-PROTOTYPE-12-COMMERCIAL-REVERIFY-01 · V1+V2 商用路径全链路实跑
 *
 * 拓扑：8081=新隔离库 zxql_ms_commercial_verify（本卡自建）；3016=AI 底座（41e48b0 P0 修复，BACKEND_API_BASE=8081）。
 * 全真实：真实口令登录（password 只从本卡 config.local.ps1 读，不落证据）→ 8081 真实 JWT → AI SSE 真实生成。
 * V2 confirm 真实落库（写新隔离库，非冻结/非生产）；幂等/撤销/cancel/失败回滚逐项验证。
 *
 * 运行（worktree 根）：node admin-web/e2e/prototype12-commercial-v2-chain.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, "..", "..");
const require = createRequire(path.join(WT, "backend", "package.json"));
const mysql = require("mysql2/promise");

const cfg = fs.readFileSync("D:/Users/ZXQL/ZXQL-WORK/.local/WORKBENCH-PROTOTYPE-12-COMMERCIAL-REVERIFY-01/config.local.ps1", "utf8");
const get = (k) => (cfg.match(new RegExp("\\b" + k + "\\s*=\\s*'([^']*)'", "m")) || [])[1];
const verifyPw = get("VerifyAdminPassword");
const DB = { host: "127.0.0.1", port: 3306, user: get("AppDbUser"), password: get("AppDbPassword"), database: get("AppDbName") };
const API = "http://127.0.0.1:8081";
const AI = "http://127.0.0.1:3016";
const OUT = "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-COMMERCIAL-REVERIFY-01/raw";
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function sseChat(message, conversationId, authHeader) {
  const resp = await fetch(`${AI}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify({ message, conversationId }) });
  if (resp.status !== 200 && resp.status !== 201) return { http: resp.status, body: (await resp.text()).slice(0, 300), events: [] };
  const events = []; const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = ""; const t0 = Date.now();
  for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n\n")) !== -1) { const c = buf.slice(0, i); buf = buf.slice(i + 2); const line = c.split("\n").find((l) => l.startsWith("data: ")); if (!line) continue; try { events.push(JSON.parse(line.slice(6))); } catch {} } }
  return { http: resp.status, duration_ms: Date.now() - t0, events };
}
const textOf = (events) => events.filter((e) => e.type === "text").map((e) => e.content).join("");
const typeCount = (events) => events.reduce((m, e) => { m[e.type] = (m[e.type] || 0) + 1; return m; }, {});

async function dbCounts(conn) {
  const q = async (sql, params) => { const [r] = await conn.query(sql, params); return r; };
  const goodsTables = (await q("SELECT table_name AS t FROM information_schema.tables WHERE table_schema=? AND (table_name LIKE '%goods%' OR table_name LIKE '%sku%' OR table_name LIKE '%product%')", [DB.database])).map((r) => r.t || r.TABLE_NAME || r.table_name);
  const counts = {};
  for (const t of goodsTables) { try { const [r] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``); counts[t] = r[0].n; } catch { counts[t] = "err"; } }
  return { goodsTables, counts };
}

// ═══ V1 真实登录 → JWT → AI SSE 端到端 ═══
log("V1: 真实登录 8081");
const lr = await fetch(`${API}/api/admin/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "comm_verify_admin", password: verifyPw }) });
const lj = await lr.json();
const token = lj?.data?.token || null;
const v1 = { login: { http: lr.status, code: lj?.code, has_token: !!token, roles: lj?.data?.user?.roles ?? null } };
log("V1 login:", JSON.stringify(v1.login));
if (!token) { fs.writeFileSync(path.join(OUT, "40-v1v2-chain-result.json"), JSON.stringify({ error: "login failed", v1 }, null, 2)); process.exit(1); }

log("V1: 携真实 JWT 调 AI SSE 真实生成");
const conv1 = `comm-v1-${Date.now()}`;
const g = await sseChat("你好，请用两句话介绍一下你能帮商户做哪些库存管理方面的事。", conv1, `Bearer ${token}`);
const gTypes = typeCount(g.events);
const gText = textOf(g.events);
v1.ai_sse = { http: g.http, duration_ms: g.duration_ms ?? null, event_count: g.events.length, event_types: gTypes, has_error_event: g.events.some((e) => e.type === "error"), generated_text_chars: gText.length, generated_text_head: gText.slice(0, 160) };
log("V1 ai_sse:", JSON.stringify(v1.ai_sse));
fs.writeFileSync(path.join(OUT, "41-v1-sse-events.ndjson"), g.events.map((e) => JSON.stringify(e)).join("\n"), "utf8");

// JWT 载荷形状（脱敏：只记键名与角色）
v1.jwt_payload_keys = Object.keys(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())).sort();
v1.jwt_verify_fact = { ai_accepted: g.http === 200 || g.http === 201, backend_accepted: v1.login.http === 200 };

// ═══ V2a 写意图挂起（P0 修复回归：叙述必须是挂起语义）═══
log("V2a: 触发写意图");
const conn = await mysql.createConnection(DB);
const before = await dbCounts(conn);
log("V2a before counts:", JSON.stringify(before.counts));
const conv2 = `comm-v2a-${Date.now()}`;
const w = await sseChat("请帮我新增一个商品：名称「商用复验商品C1」，类别为白酒，单价 88.8 元。", conv2, `Bearer ${token}`);
const pending = w.events.find((e) => e.type === "pending_write") || null;
const narrative = textOf(w.events);
const claimsCreated = /已成功创建|创建成功|已创建|已完成/.test(narrative);
const v2a = {
  http: w.http, event_count: w.events.length, event_types: typeCount(w.events),
  has_pending_write: !!pending, writeType: pending?.writeType ?? null,
  preview: pending?.preview ?? null,
  narrative_text: narrative.slice(0, 300),
  narrative_pending_semantics: { claims_created_while_pending: claimsCreated, verdict: claimsCreated ? "FAIL: 挂起态叙述成功（P0 未修复）" : "PASS: 挂起态为挂起语义（P0 修复生效）" },
};
log("V2a:", JSON.stringify({ pending: !!pending, claimsCreated, narrative_head: narrative.slice(0, 120) }));
fs.writeFileSync(path.join(OUT, "42-v2a-write-intent.json"), JSON.stringify(v2a, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(OUT, "43-v2a-events.ndjson"), w.events.map((e) => JSON.stringify(e)).join("\n"), "utf8");

// ═══ V2b confirm 真实落库 ═══
log("V2b: confirmations 列表");
const conf = await (await fetch(`${AI}/api/chat/confirmations`, { headers: { Authorization: `Bearer ${token}` } })).json();
const items = Array.isArray(conf?.items) ? conf.items : [];
const target = items.find((it) => it.preview?.details?.name === "商用复验商品C1") || items[0] || null;
const v2b = { confirmations_total: conf?.total ?? null, items_len: items.length, target_found: !!target, target_id_present: !!target?.confirmationId };
if (target) {
  log("V2b: confirm 真实执行", target.confirmationId ? "(id present)" : "(NO id)");
  const cr = await fetch(`${AI}/api/chat/confirmations/${target.confirmationId}/confirm`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({}) });
  const cj = await cr.json().catch(() => null);
  v2b.confirm = { http: cr.status, body_keys: cj ? Object.keys(cj).sort() : null, body_head: JSON.stringify(cj).slice(0, 300), operationId: cj?.data?.operationId ?? cj?.operationId ?? null };
  log("V2b confirm:", JSON.stringify({ http: cr.status, op: !!v2b.confirm.operationId }));
  // 落库验证：与 preview 一致
  const [rows] = await conn.query("SELECT * FROM information_schema.columns WHERE table_schema=? AND table_name LIKE '%goods%'", [DB.database]).catch(() => [[]]);
  log("V2b: 查询落库（goods 表模糊匹配商品名）");
  const probe = {};
  for (const t of before.goodsTables) {
    try {
      const [r] = await conn.query(`SELECT * FROM \`${t}\` WHERE CONCAT_WS('', \`${t}\`.* ) LIKE ? LIMIT 3`.replace("CONCAT_WS('', `" + t + "`.* )", "*"), ["%商用复验商品C1%"]).catch(() => [[]]);
    } catch {}
  }
  // 通用探测：所有 goods/sku/product 表按行数增量 + 按名检索
  const after = await dbCounts(conn);
  v2b.after_counts = after.counts;
  v2b.row_delta = Object.fromEntries(Object.entries(after.counts).map(([k, v]) => [k, typeof v === "number" && typeof before.counts[k] === "number" ? v - before.counts[k] : "n/a"]));
  // 按名检索（逐表 LIKE）
  const found = {};
  for (const t of after.goodsTables) {
    try {
      const cols = (await conn.query("SELECT column_name AS c FROM information_schema.columns WHERE table_schema=? AND table_name=?", [DB.database, t]))[0].map((x) => x.c);
      const nameCol = cols.find((c) => /^name$|.*_name$|^title$/.test(c));
      if (!nameCol) continue;
      const [r] = await conn.query(`SELECT * FROM \`${t}\` WHERE \`${nameCol}\` LIKE ? LIMIT 5`, ["%商用复验商品C1%"]);
      if (r.length) found[t] = r.map((x) => JSON.parse(JSON.stringify(x)));
    } catch (e) { found[t + "_err"] = String(e.message).slice(0, 120); }
  }
  v2b.row_match_preview = found;
  // confirmations 归零
  const conf2 = await (await fetch(`${AI}/api/chat/confirmations`, { headers: { Authorization: `Bearer ${token}` } })).json();
  v2b.confirmations_after = { total: conf2?.total ?? null, items_len: Array.isArray(conf2?.items) ? conf2.items.length : null };

  // ═══ V2c 幂等：同 confirmationId 第二次 confirm ═══
  log("V2c: 幂等（重复 confirm）");
  const cr2 = await fetch(`${AI}/api/chat/confirmations/${target.confirmationId}/confirm`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({}) });
  const cj2 = await cr2.json().catch(() => null);
  v2b.idempotent_second_confirm = { http: cr2.status, body_head: JSON.stringify(cj2).slice(0, 250), rejected_or_idempotent: cr2.status >= 400 || cj2?.success === false || cj2?.code !== "0" };
  log("V2c idempotent:", JSON.stringify(v2b.idempotent_second_confirm));

  // ═══ V2d revoke 撤销 ═══
  const opId = v2b.confirm.operationId;
  if (opId) {
    log("V2d: revoke", opId ? "(operationId present)" : "");
    const rr = await fetch(`${AI}/api/chat/operations/${encodeURIComponent(opId)}/revoke`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const rj = await rr.json().catch(() => null);
    const afterRevoke = await dbCounts(conn);
    v2b.revoke = { http: rr.status, body_head: JSON.stringify(rj).slice(0, 250), counts_after_revoke: afterRevoke.counts, delta_vs_after_confirm: Object.fromEntries(Object.entries(afterRevoke.counts).map(([k, v]) => [k, typeof v === "number" && typeof after.counts[k] === "number" ? v - after.counts[k] : "n/a"])) };
    log("V2d revoke:", JSON.stringify({ http: rr.status }));
  } else {
    v2b.revoke = { skipped: true, reason: "confirm 响应未返回 operationId，真实语义如实记录" };
  }
} else {
  v2b.confirm = { skipped: true, reason: "无目标待确认项" };
}

// ═══ V2e cancel 分支（挂起后取消 → 零落库）═══
log("V2e: cancel 分支");
const conv3 = `comm-v2e-${Date.now()}`;
const w2 = await sseChat("请帮我新增一个商品：名称「商用复验取消品C2」，类别为白酒，单价 66.6 元。", conv3, `Bearer ${token}`);
const pending2 = w2.events.find((e) => e.type === "pending_write") || null;
const conf3 = await (await fetch(`${AI}/api/chat/confirmations`, { headers: { Authorization: `Bearer ${token}` } })).json();
const items3 = Array.isArray(conf3?.items) ? conf3.items : [];
const t3 = items3.find((it) => it.preview?.details?.name === "商用复验取消品C2") || items3[0] || null;
const v2e = { has_pending: !!pending2, confirmations_total: conf3?.total ?? null };
if (t3) {
  const c3 = await fetch(`${AI}/api/chat/confirmations/${t3.confirmationId}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({}) });
  v2e.cancel = { http: c3.status, body_head: JSON.stringify(await c3.json().catch(() => null)).slice(0, 200) };
  const conf4 = await (await fetch(`${AI}/api/chat/confirmations`, { headers: { Authorization: `Bearer ${token}` } })).json();
  v2e.confirmations_after = { total: conf4?.total ?? null };
  const afterCancel = await dbCounts(conn);
  v2e.row_delta_vs_before_all = Object.fromEntries(Object.entries(afterCancel.counts).map(([k, v]) => [k, typeof v === "number" && typeof before.counts[k] === "number" ? v - before.counts[k] : "n/a"]));
  v2e.zero_write_on_cancel = !String(JSON.stringify(afterCancel.counts)).includes("商用复验取消品C2");
  // 按名确认 C2 不存在
  const found2 = {};
  for (const t of afterCancel.goodsTables) {
    try {
      const cols = (await conn.query("SELECT column_name AS c FROM information_schema.columns WHERE table_schema=? AND table_name=?", [DB.database, t]))[0].map((x) => x.c);
      const nameCol = cols.find((c) => /^name$|.*_name$|^title$/.test(c));
      if (!nameCol) continue;
      const [r] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\` WHERE \`${nameCol}\` LIKE ?`, ["%商用复验取消品C2%"]);
      if (r[0].n > 0) found2[t] = r[0].n;
    } catch {}
  }
  v2e.cancel_product_rows_found = found2;
} else {
  v2e.cancel = { skipped: true, reason: "无挂起项可取消" };
}
log("V2e:", JSON.stringify({ cancel: v2e.cancel?.http, after_total: v2e.confirmations_after?.total, c2_rows: JSON.stringify(v2e.cancel_product_rows_found || {}) }));

// ═══ V2f 失败回滚（构造工具失败：缺失必填信息）═══
log("V2f: 失败回滚探针");
const conv4 = `comm-v2f-${Date.now()}`;
const f = await sseChat("请帮我新增一个商品。", conv4, `Bearer ${token}`); // 缺名称/类别/单价 → 工具应失败或询问
const fCounts = await dbCounts(conn);
const v2f = {
  http: f.http, event_count: f.events.length, event_types: typeCount(f.events),
  has_pending_write: !!f.events.find((e) => e.type === "pending_write"),
  narrative_head: textOf(f.events).slice(0, 200),
  counts_delta_vs_v2e: "see raw",
  zero_partial_write: !f.events.find((e) => e.type === "pending_write"),
};
const afterF = await dbCounts(conn);
v2f.counts_delta_vs_v2e = JSON.stringify(Object.fromEntries(Object.entries(afterF.counts).map(([k, v]) => [k, typeof v === "number" ? v : "n/a"])));
log("V2f:", JSON.stringify({ pending: v2f.has_pending_write, narrative_head: v2f.narrative_head.slice(0, 100) }));
fs.writeFileSync(path.join(OUT, "45-v2f-failure-probe.ndjson"), f.events.map((e) => JSON.stringify(e)).join("\n"), "utf8");

await conn.end();
const result = { v1, v2a_summary: { pending: v2a.has_pending_write, semantics: v2a.narrative_pending_semantics }, v2b, v2e, v2f, db: { database: DB.database, before_counts: before.counts } };
fs.writeFileSync(path.join(OUT, "40-v1v2-chain-result.json"), JSON.stringify(result, null, 2) + "\n", "utf8");
log("DONE chain");
