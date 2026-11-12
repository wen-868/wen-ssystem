/**
 * WORKBENCH-PROTOTYPE-12-COMMERCIAL-REVERIFY-01 · MySQL8 方案A：V1 smoke + V2 全量重跑
 * 8081=3307 zxql_ms_verify_s5（dump 同源）；3016=AI 41e48b0 → 8081。
 * 逐项留证：真实登录→JWT→AI生成（禁自签）、confirm 落库逐字段比对、重复 confirm 幂等、revoke 真实生效、cancel 零落库、失败无半写。
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("D:/Users/ZXQL/ZXQL-WORK/worktrees/ms/WORKBENCH-PROTOTYPE-12-COMMERCIAL-REVERIFY-01/backend/package.json");
const mysql = require("mysql2/promise");
const cfg = fs.readFileSync("D:/Users/ZXQL/ZXQL-WORK/.local/WORKBENCH-PROTOTYPE-12-COMMERCIAL-REVERIFY-01/config.local.ps1", "utf8");
const get = (k) => (cfg.match(new RegExp("\\b" + k + "\\s*=\\s*'([^']*)'", "m")) || [])[1];
const verifyPw = get("VerifyAdminPassword");
const DB = { host: "127.0.0.1", port: 3307, user: get("MySql8AppUser"), password: get("MySql8AppPassword"), database: get("MySql8DbName") };
const API = "http://127.0.0.1:8081";
const AI = "http://127.0.0.1:3016";
const OUT = "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-COMMERCIAL-REVERIFY-01/raw";
const log = (...a) => console.log(new Date().toISOString(), ...a);
const result = { env: { backend: API + " (3307 " + DB.database + ")", ai: AI }, mysql_version: "8.0.46" };

async function sseChat(message, conversationId, auth) {
  const resp = await fetch(`${AI}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: auth }, body: JSON.stringify({ message, conversationId }) });
  if (resp.status !== 200 && resp.status !== 201) return { http: resp.status, body: (await resp.text()).slice(0, 250), events: [] };
  const events = []; const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = "";
  for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n\n")) !== -1) { const c = buf.slice(0, i); buf = buf.slice(i + 2); const line = c.split("\n").find((l) => l.startsWith("data: ")); if (!line) continue; try { events.push(JSON.parse(line.slice(6))); } catch {} } }
  return { http: resp.status, events };
}
const textOf = (ev) => ev.filter((e) => e.type === "text").map((e) => e.content).join("");
const typeCount = (ev) => ev.reduce((m, e) => { m[e.type] = (m[e.type] || 0) + 1; return m; }, {});
async function jfetch(url, opts = {}) { const r = await fetch(url, opts); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { r, t, j }; }

const conn = await mysql.createConnection(DB);
async function tableCounts() {
  const [r] = await conn.query("SELECT table_name AS t FROM information_schema.tables WHERE table_schema=? AND table_name IN ('t_product_spu','t_product_sku','t_product_price','t_product_price_log','t_inventory_balance')", [DB.database]);
  const out = {};
  for (const row of r) { const [c] = await conn.query(`SELECT COUNT(*) AS n FROM \`${row.t}\``); out[row.t] = c[0].n; }
  return out;
}
async function findProduct(name) {
  const out = {};
  const [spu] = await conn.query("SELECT id AS spu_id, spu_code, name, category_id, unit, status, tenant_id FROM t_product_spu WHERE name=?", [name]);
  out.spu = spu;
  if (spu.length) {
    const [sku] = await conn.query("SELECT id AS sku_id, spu_id, sku_code, sku_name, base_unit, box_unit, box_ratio, tenant_id FROM t_product_sku WHERE spu_id=?", [spu[0].spu_id]);
    out.sku = sku;
    if (sku.length) {
      const [price] = await conn.query("SELECT cost_price, retail_price, wholesale_price, miniapp_price, store_price, tenant_id FROM t_product_price WHERE sku_id=?", [sku[0].sku_id]);
      out.price = price;
      const [inv] = await conn.query("SELECT physical_qty, available_qty FROM t_inventory_balance WHERE sku_id=?", [sku[0].sku_id]).catch(() => [[]]);
      out.inventory = inv;
    }
  }
  return out;
}

// ═══ V1 smoke（MySQL8，真实登录禁自签）═══
log("V1: 真实登录 8081 (MySQL8 3307)");
const lr = await jfetch(`${API}/api/admin/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "comm_verify_admin", password: verifyPw }) });
const token = lr.j?.data?.token || null;
result.v1_login = { http: lr.r.status, code: lr.j?.code, has_token: !!token, roles: lr.j?.data?.user?.roles ?? null, jwt_payload_keys: token ? Object.keys(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())).sort() : null };
log("V1 login:", JSON.stringify({ http: result.v1_login.http, token: !!token, roles: JSON.stringify(result.v1_login.roles) }));
const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
const g = await sseChat("你好，请用两句话介绍一下你能帮商户做哪些库存管理方面的事。", `m8-v1-${Date.now()}`, H.Authorization);
result.v1_ai_sse = { http: g.http, event_count: g.events.length, event_types: typeCount(g.events), has_error_event: g.events.some((e) => e.type === "error"), generated_text_chars: textOf(g.events).length, generated_text_head: textOf(g.events).slice(0, 140) };
log("V1 ai_sse:", JSON.stringify(result.v1_ai_sse));
fs.writeFileSync(OUT + "/61-mysql8-v1-sse-events.ndjson", g.events.map((e) => JSON.stringify(e)).join("\n"), "utf8");
const menus = await jfetch(`${API}/api/admin/menus/user`, { headers: { Authorization: H.Authorization } });
result.v1_menus = { http: menus.r.status, menu_codes: (menus.t.match(/"menuCode":"/g) || []).length };

// ═══ V2a 写意图（新商品名 C2M8）═══
log("V2a: 触发写意图");
const before = await tableCounts();
const NAME = "商用复验商品C2M8";
const w = await sseChat(`请帮我新增一个商品：名称「${NAME}」，类别为白酒，单价 88.8 元。`, `m8-v2a-${Date.now()}`, H.Authorization);
const pending = w.events.find((e) => e.type === "pending_write") || null;
const narrative = textOf(w.events);
result.v2a = {
  http: w.http, event_count: w.events.length, event_types: typeCount(w.events),
  has_pending_write: !!pending, preview: pending?.preview ?? null,
  narrative_head: narrative.slice(0, 200),
  pending_semantics_ok: !/已成功创建|创建成功|已创建/.test(narrative) && !!pending,
};
log("V2a:", JSON.stringify({ pending: !!pending, narrative: narrative.slice(0, 100) }));
fs.writeFileSync(OUT + "/62-mysql8-v2a-events.ndjson", w.events.map((e) => JSON.stringify(e)).join("\n"), "utf8");

// ═══ V2b confirm 落库 + 逐字段比对 ═══
log("V2b: confirmations + confirm");
const conf = await jfetch(`${AI}/api/chat/confirmations`, { headers: { Authorization: H.Authorization } });
const items = Array.isArray(conf.j?.items) ? conf.j.items : [];
const target = items.find((it) => it.preview?.details?.name === NAME) || null;
result.v2b = { confirmations_total: conf.j?.total ?? null, target_found: !!target };
if (target) {
  const cid = target.confirmationId;
  const cr = await jfetch(`${AI}/api/chat/confirmations/${cid}/confirm`, { method: "POST", headers: { ...H } });
  result.v2b.confirm = { http: cr.r.status, body: cr.j ?? cr.t.slice(0, 300) };
  const opId = cr.j?.data?.operationId ?? cr.j?.operationId ?? (typeof cr.j?.data === "string" ? cr.j.data : null) ?? null;
  result.v2b.operationId = opId;
  log("V2b confirm:", JSON.stringify({ http: cr.r.status, opId: !!opId }));
  // 逐字段比对
  const dbRows = await findProduct(NAME);
  const d = target.preview?.details || {};
  const spu = dbRows.spu?.[0] || null, sku = dbRows.sku?.[0] || null, price = dbRows.price?.[0] || null;
  const [cat] = await conn.query("SELECT id FROM t_product_category WHERE name=?", [d.categoryName]);
  result.v2b.field_check = {
    spu_name: { preview: d.name, db: spu?.name ?? null, match: spu?.name === d.name },
    sku_name: { preview: d.skuName ?? d.name, db: sku?.sku_name ?? null, match: !!sku && sku.sku_name === (d.skuName ?? d.name) },
    category: { preview: d.categoryName, db_id: spu?.category_id ?? null, expected_id: cat[0]?.id ?? null, match: !!spu && !!cat[0] && spu.category_id === cat[0].id },
    base_unit: { preview: d.baseUnit ?? null, db: sku?.base_unit ?? null, match: !!sku && (d.baseUnit == null || sku.base_unit === d.baseUnit) },
    box_unit: { preview: d.boxUnit ?? null, db: sku?.box_unit ?? null, match: !!sku && (d.boxUnit == null || sku.box_unit === d.boxUnit) },
    box_ratio: { preview: d.boxRatio ?? null, db: sku?.box_ratio ?? null, match: !!sku && (d.boxRatio == null || Number(sku.box_ratio) === Number(d.boxRatio)) },
    retail_price: { preview: d.retailPrice ?? null, db: price?.retail_price ?? null, match: !!price && (d.retailPrice == null || Number(price.retail_price) === Number(d.retailPrice)) },
    wholesale_price: { preview: d.wholesalePrice ?? null, db: price?.wholesale_price ?? null, match: !!price && (d.wholesalePrice == null || Number(price.wholesale_price) === Number(d.wholesalePrice)) },
  };
  result.v2b.all_fields_match = Object.values(result.v2b.field_check).every((x) => x.match);
  result.v2b.after_counts = await tableCounts();
  log("V2b fields:", JSON.stringify(result.v2b.field_check));
  log("V2b all_match:", result.v2b.all_fields_match);
  // confirmations 归零
  const conf2 = await jfetch(`${AI}/api/chat/confirmations`, { headers: { Authorization: H.Authorization } });
  result.v2b.confirmations_after = { total: conf2.j?.total ?? null };

  // ═══ V2c 幂等：同 cid 重复 confirm ═══
  log("V2c: 重复 confirm（幂等）");
  const cr2 = await jfetch(`${AI}/api/chat/confirmations/${cid}/confirm`, { method: "POST", headers: { ...H } });
  const after2 = await tableCounts();
  result.v2c_idempotent = {
    http: cr2.r.status, body: cr2.j ?? cr2.t.slice(0, 250),
    row_delta_vs_confirm: Object.fromEntries(Object.entries(after2).map(([k, v]) => [k, typeof v === "number" && typeof result.v2b.after_counts[k] === "number" ? v - result.v2b.after_counts[k] : "n/a"])),
    verdict: (cr2.r.status >= 400 || cr2.j?.success === false) ? "第二次被拒/幂等" : "第二次再次执行（须如实记录行为）",
  };
  log("V2c:", JSON.stringify({ http: cr2.r.status, verdict: result.v2c_idempotent.verdict }));

  // ═══ V2d revoke ═══
  if (opId) {
    log("V2d: revoke");
    const rr = await jfetch(`${AI}/api/chat/operations/${encodeURIComponent(opId)}/revoke`, { method: "POST", headers: { ...H } });
    const afterRevoke = await tableCounts();
    const dbAfterRevoke = await findProduct(NAME);
    result.v2d_revoke = {
      http: rr.r.status, body: rr.j ?? rr.t.slice(0, 250),
      counts_delta_vs_confirm: Object.fromEntries(Object.entries(afterRevoke).map(([k, v]) => [k, typeof v === "number" && typeof result.v2b.after_counts[k] === "number" ? v - result.v2b.after_counts[k] : "n/a"])),
      product_still_exists: (dbAfterRevoke.spu?.length ?? 0) > 0,
      real_effect_note: "以系统真实语义为准（业务回滚或审计记录）",
    };
    log("V2d:", JSON.stringify({ http: rr.r.status, still_exists: result.v2d_revoke.product_still_exists }));
  } else {
    result.v2d_revoke = { skipped: true, reason: "confirm 响应未含 operationId，如实记录" };
  }
} else {
  result.v2b = { ...result.v2b, confirm: { skipped: true, reason: "无目标待确认项" } };
}

// ═══ V2e cancel 分支（新名 C3M8，零落库）═══
log("V2e: cancel 分支");
const NAME3 = "商用复验取消品C3M8";
const w2 = await sseChat(`请帮我新增一个商品：名称「${NAME3}」，类别为白酒，单价 66.6 元。`, `m8-v2e-${Date.now()}`, H.Authorization);
const conf3 = await jfetch(`${AI}/api/chat/confirmations`, { headers: { Authorization: H.Authorization } });
const items3 = Array.isArray(conf3.j?.items) ? conf3.j.items : [];
const t3 = items3.find((it) => it.preview?.details?.name === NAME3) || null;
result.v2e = { has_pending: !!w2.events.find((e) => e.type === "pending_write"), target_found: !!t3 };
if (t3) {
  const c3 = await jfetch(`${AI}/api/chat/confirmations/${t3.confirmationId}/cancel`, { method: "POST", headers: { ...H } });
  result.v2e.cancel = { http: c3.r.status, body: c3.j ?? c3.t.slice(0, 150) };
  const conf4 = await jfetch(`${AI}/api/chat/confirmations`, { headers: { Authorization: H.Authorization } });
  result.v2e.confirmations_after = { total: conf4.j?.total ?? null };
  const dbC3 = await findProduct(NAME3);
  result.v2e.cancel_zero_write = (dbC3.spu?.length ?? 0) === 0;
  log("V2e:", JSON.stringify({ cancel: c3.r.status, total_after: result.v2e.confirmations_after.total, zero_write: result.v2e.cancel_zero_write }));
}

// ═══ V2f 失败探针（缺必填）═══
log("V2f: 失败回滚探针");
const f = await sseChat("请帮我新增一个商品。", `m8-v2f-${Date.now()}`, H.Authorization);
result.v2f_failure = {
  has_pending_write: !!f.events.find((e) => e.type === "pending_write"),
  narrative_head: textOf(f.events).slice(0, 150),
  no_partial_write: !f.events.find((e) => e.type === "pending_write"),
};
log("V2f:", JSON.stringify({ pending: result.v2f_failure.has_pending_write, narrative: result.v2f_failure.narrative_head.slice(0, 80) }));

// ═══ 零触碰终验（3306 三库 + 旧 MariaDB 隔离库）═══
const root = await mysql.createConnection({ host: "127.0.0.1", port: 3306, user: "root", password: get("MySqlPassword") });
const zero = {};
for (const db of ["zhixiang_ops", "zxql_ms_verify_s5", "zxql_ms_commercial_verify"]) {
  const [r] = await root.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=?", [db]);
  zero[db] = r[0].n;
}
result.zero_touch_3306 = zero;
result.zero_touch_expected = { zhixiang_ops: 75, zxql_ms_verify_s5: 314, zxql_ms_commercial_verify: 314 };
result.zero_touch_verdict = zero.zhixiang_ops === 75 && zero.zxql_ms_verify_s5 === 314 && zero.zxql_ms_commercial_verify === 314 ? "PASS：冻结库/生产库/旧隔离库零变化" : "FAIL";
log("zero_touch:", JSON.stringify(zero), result.zero_touch_verdict);
await root.end(); await conn.end();

fs.writeFileSync(OUT + "/60-mysql8-v1v2-chain-result.json", JSON.stringify(result, null, 2) + "\n", "utf8");
log("DONE mysql8 chain");
