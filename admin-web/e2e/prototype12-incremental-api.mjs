/**
 * WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01 · 增量复验 API/SSE 采集（R05/R06/R07/R12 + 新缺陷复现）
 *
 * 口径（红线约束，沿用 AI-CONFIG-SEED-01 已门1通过的等价方案）：
 *  - backend 登录成功必写 t_sys_user.last_login_at；8080 连 S5 冻结库 zxql_ms_verify_s5；
 *    liquor_inventory 无 t_sys_user；zhixiang_ops 为生产库。故本装置以与 backend signToken
 *    完全一致的 HS256 格式（issuer=zhixiang-system / audience=zhixiang-client / 4h TTL / 共享 JWT_SECRET）
 *    自签「真实 SUPER_ADMIN 账号 s5_super(id=5,tenant=default)」的登录等价 JWT，
 *    零数据库写入；AI(3016) 与 backend(8080) 两侧 TenantMiddleware 按 jwt-verify 双验签真实通过。
 *  - confirm 执行会经 BACKEND_API_BASE=8080 写穿透冻结库 ⇒ 只做 cancel，confirm/revoke 如实记 UNVERIFIED。
 *
 * 运行（worktree 根）：node admin-web/e2e/prototype12-incremental-api.mjs
 * 输出：evidence/incremental-20261112/raw/*.json
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, "..", "..");
const require = createRequire(path.join(WT, "backend", "package.json"));
const jwt = require("jsonwebtoken");

const envText = fs.readFileSync(path.join(WT, "backend", ".env"), "utf8");
const getEnv = (k) => { const m = envText.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].replace(/\r$/, "").replace(/^["']|["']$/g, "") : null; };
const JWT_SECRET = getEnv("JWT_SECRET");
if (!JWT_SECRET) { console.error("JWT_SECRET missing in backend/.env"); process.exit(2); }

const AI = "http://127.0.0.1:3016";
const API = "http://127.0.0.1:8080";
const OUT = "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-S5-ACCEPTANCE-01/incremental-20261112/raw";
fs.mkdirSync(OUT, { recursive: true });

const token = jwt.sign(
  { id: 5, username: "s5_super", realName: "S5 验收超管", roles: ["SUPER_ADMIN"], storeId: null, tenantId: "default" },
  JWT_SECRET,
  { algorithm: "HS256", expiresIn: "4h", issuer: "zhixiang-system", audience: "zhixiang-client" },
);
const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
const log = (...a) => console.log(new Date().toISOString(), ...a);
const result = {};

async function sseChat(message, conversationId) {
  const resp = await fetch(`${AI}/api/chat`, { method: "POST", headers: H, body: JSON.stringify({ message, conversationId }) });
  const summary = { http_status: resp.status, content_type: resp.headers.get("content-type") || "" };
  if (resp.status !== 200 && resp.status !== 201) { summary.body = (await resp.text()).slice(0, 400); return { summary, events: [] }; }
  const events = []; const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = ""; const started = Date.now();
  for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n\n")) !== -1) { const c = buf.slice(0, i); buf = buf.slice(i + 2); const line = c.split("\n").find((l) => l.startsWith("data: ")); if (!line) continue; try { events.push(JSON.parse(line.slice(6))); } catch {} } }
  summary.duration_ms = Date.now() - started; return { summary, events };
}

function sumEvents(events) {
  const types = {}; for (const e of events) types[e.type] = (types[e.type] || 0) + 1;
  const textParts = events.map((e) => e.delta ?? e.content ?? e.text ?? e.answer ?? (e.type === "done" && e.fullText) ?? "").filter((x) => typeof x === "string" && x.length > 0);
  return { event_count: events.length, event_types: types, has_error_event: events.some((e) => e.type === "error"), generated_text_chars: textParts.join("").length, generated_text_head: textParts.join("").slice(0, 200), confirmation_events: events.filter((e) => e.type && /confirm/i.test(e.type)).length };
}

// ── R12-a：真实对话生成（基线口径 42 事件/0 error/72 字）──
{
  const { summary, events } = await sseChat("你好，请用两句话介绍一下你能帮商户做哪些库存管理方面的事。", `s5-inc-sse-${Date.now()}`);
  const agg = sumEvents(events);
  result.R12a_sse_generation = { ...summary, ...agg };
  fs.writeFileSync(path.join(OUT, "10-sse-chat-events.ndjson"), events.map((e) => JSON.stringify(e)).join("\n"), "utf8");
  fs.writeFileSync(path.join(OUT, "10-sse-chat-summary.json"), JSON.stringify({ ...summary, ...agg }, null, 2) + "\n", "utf8");
  log("R12a SSE:", JSON.stringify(agg));
}

// ── R12-b + 新缺陷：写意图挂起（pending_write vs text 叙述不符）──
// 消息同 AI-CONFIG-SEED-01 _cancel-chain-run.mjs（复现「已成功创建」叙述缺陷）
{
  const { summary, events } = await sseChat("请帮我新增一个商品：名称「验收测试商品X1」，类别为酒水饮料，单价 99.9 元，初始库存 10。", `s5-inc-write-${Date.now()}`);
  const pending = events.find((e) => e.type === "pending_write") || null;
  const awaitConfirm = events.find((e) => e.type === "await_confirm") || null;
  const textHead = events.filter((e) => e.type === "text").map((e) => e.content).join("");
  const previewDetails = pending?.preview?.details || {};
  const narrative = textHead.slice(0, 300);
  // 缺陷判定（消费者诚实性）：
  const claimsCreated = /已成功创建|创建成功|已创建/.test(narrative);
  const claimsStock = /初始库存|库存为|库存\s*[:：]?\s*\d/.test(narrative);
  const previewHasStockField = Object.keys(previewDetails).some((k) => /stock|inventory|库存/i.test(k));
  const catNarrative = (narrative.match(/(白酒|酒水饮料|啤酒|红酒)/) || [])[1] || null;
  const catPreview = previewDetails.categoryName || null;
  const categoryMismatch = catNarrative && catPreview && catNarrative !== catPreview;
  result.R12b_write_intent = {
    status: summary.http_status, event_count: events.length,
    event_types: events.reduce((m, e) => { m[e.type] = (m[e.type] || 0) + 1; return m; }, {}),
    pending_write: pending, await_confirm: awaitConfirm,
    narrative_text: narrative,
    defect_consumer_honesty: {
      narrative_claims_created: claimsCreated,
      narrative_claims_initial_stock: claimsStock,
      preview_has_stock_field: previewHasStockField,
      narrative_category: catNarrative, preview_category: catPreview, category_mismatch: categoryMismatch,
      verdict: (claimsCreated && !pending?.executed) ? "挂起态被叙述成已创建（诚实性缺陷）" : "本地未复现",
    },
  };
  fs.writeFileSync(path.join(OUT, "11-write-intent-pending.json"), JSON.stringify(result.R12b_write_intent, null, 2) + "\n", "utf8");
  log("R12b write-intent: pending=", !!pending, "claimsCreated=", claimsCreated, "claimsStock=", claimsStock, "catMismatch=", categoryMismatch);
}

// ── R06：confirmations {total,items} 解析 ──
{
  const r = await fetch(`${AI}/api/chat/confirmations`, { headers: H });
  const body = await r.json().catch(() => null);
  const isItemsShape = body && Array.isArray(body.items) && typeof body.total === "number";
  result.R06_confirmations = { status: r.status, shape: isItemsShape ? "{total,items}" : "非期望形态", total: body?.total ?? null, items_len: body?.items?.length ?? null, body_head: JSON.stringify(body).slice(0, 400) };
  fs.writeFileSync(path.join(OUT, "12-confirmations.json"), JSON.stringify(result.R06_confirmations, null, 2) + "\n", "utf8");
  log("R06 confirmations:", JSON.stringify({ status: r.status, shape: result.R06_confirmations.shape, total: result.R06_confirmations.total }));

  // ── R12-c：cancel 真跑（不执行写入，安全）──
  const pendingItems = body && Array.isArray(body.items) ? body.items : [];
  const out = {};
  if (pendingItems.length > 0) {
    const cid = pendingItems[0].confirmationId;
    const c = await fetch(`${AI}/api/chat/confirmations/${cid}/cancel`, { method: "POST", headers: H, body: JSON.stringify({}) });
    out.cancel = { status: c.status, confirmationId: cid, body: await c.json().catch(() => null) };
    const r2 = await fetch(`${AI}/api/chat/confirmations`, { headers: H });
    out.after_cancel = { status: r2.status, body: await r2.json().catch(() => null) };
  } else { out.cancel = { skipped: true, reason: "无待确认项" }; }
  // confirm / revoke：红线禁触冻结库，如实记 UNVERIFIED
  out.confirm_execution = { status: "UNVERIFIED", reason: "confirm 执行经 BACKEND_API_BASE=8080 写穿透 S5 冻结库，红线禁触，未执行" };
  out.revoke_chain = { status: "UNVERIFIED", reason: "revoke 依赖 confirm 产生的真实已执行 operationId；未 confirm 故无 operationId，如实空态" };
  result.R12c_cancel_chain = out;
  fs.writeFileSync(path.join(OUT, "13-cancel-chain.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
  log("R12c cancel:", JSON.stringify({ had_pending: pendingItems.length, cancel_status: out.cancel.status }));
}

// ── R05：AI 数据源真实响应（employees / plans）──
{
  const r05 = {};
  for (const [name, p] of [["employees", "/api/ai/employees"], ["plans", "/api/ai/agent/plans"]]) {
    const r = await fetch(`${AI}${p}`, { headers: H });
    const txt = await r.text(); let body = null; try { body = JSON.parse(txt); } catch {}
    r05[name] = { path: p, status: r.status, len: txt.length, shape: Array.isArray(body) ? "array" : (body && typeof body === "object" ? "object" : "other"), head: txt.slice(0, 300) };
  }
  result.R05_ai_sources = r05;
  fs.writeFileSync(path.join(OUT, "14-ai-sources.json"), JSON.stringify(r05, null, 2) + "\n", "utf8");
  log("R05 ai sources:", JSON.stringify(Object.fromEntries(Object.entries(r05).map(([k, v]) => [k, v.status]))));
}

// ── R07：晨报经营概览（backend 8080，真实字段）──
{
  const r = await fetch(`${API}/api/admin/dashboard/overview`, { headers: H });
  const txt = await r.text(); let body = null; try { body = JSON.parse(txt); } catch {}
  const data = body?.data?.data ?? body?.data ?? body;
  result.R07_overview = { status: r.status, len: txt.length, has_today: !!(data && data.today), keys: data ? Object.keys(data) : [], head: txt.slice(0, 400) };
  fs.writeFileSync(path.join(OUT, "15-overview.json"), JSON.stringify(result.R07_overview, null, 2) + "\n", "utf8");
  log("R07 overview:", JSON.stringify({ status: r.status, has_today: result.R07_overview.has_today, keys: result.R07_overview.keys }));
}

fs.writeFileSync(path.join(OUT, "00-incremental-api-result.json"), JSON.stringify(result, null, 2) + "\n", "utf8");
log("DONE api collection");
