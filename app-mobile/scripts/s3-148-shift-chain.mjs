/**
 * S3-148 运行期主判据装置（真实后端进程 + 真实登录令牌 + 真实 HTTP）
 *
 * 判据（派单卡「验收标准（硬）」①②③）：
 *   列表（读 t_shift）⇒ 拿**列表行的 shiftNo** 打详情 200 ⇒ 用同一个 shiftNo 打关闭端点 200 ⇒ 详情 status=CLOSED。
 *
 * 与 S3-145 / S3-146 装置的关键差别：本装置**不把 URL 写死在脚本里**——
 *   `fetchShifts` / `fetchShiftDetail` / `completeShift` 三处请求路径是**从 app-mobile 源码
 *   `src/api/modules/store.ts` 现场解析出来的**，保证判据消费的是**本单改的那份代码**，
 *   而不是脚本自造的一份同名副本（S3-145-F2 的教训：装置不能自带一份"我以为的"端点）。
 *
 * 用法：
 *   node app-mobile/scripts/s3-148-shift-chain.mjs green    # 正向：列表 shiftNo → 详情 200 → close 200 → 详情 CLOSED
 *   node app-mobile/scripts/s3-148-shift-chain.mjs revert    # 反测：源码临时改回 /store/shift/history ⇒ 列表出 BJ… ⇒ 详情 404
 *
 * revert 的语义：它断言的是【旧源口径】——S3-148 之前 `fetchShifts` 打的是班结历史
 *   `GET /store/shift/history`（读 `t_daily_settlement`，单号 `BJ…`），而详情按 `shift_no` 查 `t_shift`
 *   （`JB…`）⇒ 列表行点进详情恒业务级 404。因此对**已修源码**跑 revert 会红（源码路径断言不过），
 *   这是**预期**：revert 只在源码确实被改回旧源时才应有全绿，两侧原始输出见回传卡。
 *
 * 说明：服务端以 `USE_MOCK_DB=true` 运行，数据面 = `backend/src/__tests__/mocks/mock-db-shift.ts`（非真实库，回传卡已声明）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE = process.env.S3_BASE || "http://127.0.0.1:18831";
const MODE = (process.argv[2] || "green").toLowerCase();
// 本地日历日（不用 toISOString：那是 UTC，凌晨会与库里的本地日期差一天）
const TODAY = new Date().toLocaleDateString("sv-SE");
const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const SRC_FILE = resolve(SRC_DIR, "api/modules/store.ts");
const ENV_FILE = resolve(SRC_DIR, "config/env.ts");

let passed = 0;
let failed = 0;
const requests = [];

function report(label, ok, detail) {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}   ← ${detail}`);
}

async function call(method, path, { token, csrf, body } = {}) {
  const headers = {};
  if (token) headers["authorization"] = `Bearer ${token}`;
  if (csrf) headers["x-csrf-token"] = csrf;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE}${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON 响应保留原文 */
  }
  const auth = token ? "Authorization令牌" : "无令牌";
  const csrfMark = csrf ? " +x-csrf-token" : "";
  const line = `${method} ${API_BASE}${path} [${auth}${csrfMark}] ⇒ ${res.status}`;
  requests.push(line);
  console.log(`  → ${line}`);
  console.log(`    ${text.length > 900 ? `${text.slice(0, 900)}…(截断)` : text}`);
  return { status: res.status, json, text };
}

const dataOf = (r) => (r.json && typeof r.json === "object" ? r.json.data : undefined);

// ─── 从 app-mobile 源码解析端点（判据对象 = 源码本身） ───
function sliceBetween(src, startMark, endMark) {
  const i = src.indexOf(startMark);
  if (i < 0) throw new Error(`源码里找不到标记：${startMark}`);
  const j = src.indexOf(endMark, i + startMark.length);
  if (j < 0) throw new Error(`源码里找不到结束标记：${endMark}`);
  return src.slice(i, j);
}

function pick(text, re, label) {
  const m = text.match(re);
  if (!m) throw new Error(`无法从源码解析出 ${label} 的请求路径`);
  return m[1];
}

const src = readFileSync(SRC_FILE, "utf8");
// 请求前缀同样取自源码（H5 端 BASE_URL = API_BASE_H5，默认 '/api'），避免脚本自带一份"我以为的"前缀
const envSrc = readFileSync(ENV_FILE, "utf8");
const API_BASE = process.env.S3_API_BASE || pick(envSrc, /export const API_BASE_H5[^]*?\|\|\s*'([^']+)'/, "API_BASE_H5");
const createFn = sliceBetween(src, "async createShift(", "async fetchShiftDetail(");
const listFn = sliceBetween(src, "async fetchShifts(", "async createShift(");
const detailFn = sliceBetween(src, "async fetchShiftDetail(", "async completeShift(");
const closeFn = sliceBetween(src, "async completeShift(", "async fetchShiftSalesStats(");

const createPath = pick(createFn, /await post\(\s*'([^']+)'/, "createShift");
const listPath = pick(listFn, /await get\(\s*'([^']+)'/, "fetchShifts");
const detailPathTpl = pick(detailFn, /await get\(\s*`([^`]+)`/, "fetchShiftDetail");
const closePathTpl = pick(closeFn, /await post\(\s*`([^`]+)`/, "completeShift");
const detailPath = (shiftNo) => detailPathTpl.replace("${shiftNo}", encodeURIComponent(shiftNo));
const closePath = (shiftNo) => closePathTpl.replace("${shiftNo}", encodeURIComponent(shiftNo));

console.log(`【装置】真实后端 = ${BASE}（USE_MOCK_DB=true，数据面 = mock-db-shift.ts）`);
console.log(`【模式】${MODE}   日期=${TODAY}   node=${process.version}`);
console.log(`【源码】${SRC_FILE}`);
console.log(`  解析出的端点（前缀 ${API_BASE}）：createShift=${createPath}  fetchShifts=${listPath}  fetchShiftDetail=${detailPathTpl}  completeShift=${closePathTpl}`);
console.log("");

const LEGACY_SETTLE_PATH = "/store/shift/settle"; // 旧路径（S3-148 之前 completeShift 打的端点），仅 revert 模式造数据用

// ─── 段0：真实登录（mock §state.users: store_manager / admin123） ───
const login = await call("POST", "/admin/auth/login", {
  body: { username: "store_manager", password: "admin123" },
});
const token = dataOf(login)?.token;
const csrf = dataOf(login)?.csrfToken;
report("段0 真实登录签发令牌", login.status === 200 && !!token, `status=${login.status} token=${token ? `${token.slice(0, 12)}…` : "无"}`);
if (!token) {
  console.log("\n无法取得令牌，装置中止");
  process.exitCode = 1;
} else if (MODE === "revert") {
  // 反测前提：源码必须确实被改回旧源（否则这次"反测"没有打到目标对象上）
  report(
    "反测-段1 源码 fetchShifts 确实走旧源（/store/shift/history）",
    listPath === "/store/shift/history",
    `解析出的列表路径=${listPath}`,
  );

  // 旧源要有数据：写一条班结记录（BJ…，t_daily_settlement）
  const settle = await call("POST", LEGACY_SETTLE_PATH, { token, csrf, body: { actualAmount: 0 } });
  report(
    "反测-段2 造一条班结记录（BJ…，写 t_daily_settlement）",
    settle.status === 200 && String(dataOf(settle)?.settleNo ?? "").startsWith("BJ"),
    `status=${settle.status} settleNo=${dataOf(settle)?.settleNo}`,
  );

  const list = await call("GET", `${listPath}?page=1&pageSize=20`, { token });
  const rows = dataOf(list)?.records ?? dataOf(list) ?? [];
  const listRows = Array.isArray(rows) ? rows : (rows.records ?? []);
  const rowNo = String(listRows[0]?.shiftNo ?? listRows[0]?.shift_no ?? "");
  report(
    "反测-段3 列表（旧源）行单号是 BJ…（与详情源 t_shift 不相交）",
    list.status === 200 && rowNo.startsWith("BJ"),
    `status=${list.status} 行数=${listRows.length} 首行单号=${rowNo}`,
  );

  const detail = await call("GET", detailPath(rowNo || "__S3148_NO_LIST_ROW__"), { token });
  const dMsg = dataOf(detail)?.msg ?? detail.json?.msg;
  report(
    "反测-段4 用列表行的单号点详情 ⇒ 业务级 404（复现原缺陷）",
    detail.status === 404 && String(dMsg ?? "").includes("交接班不存在"),
    `status=${detail.status} msg=${dMsg}`,
  );

  console.log(`\n小结[revert]：${passed} passed / ${failed} failed（请求 ${requests.length} 条）`);
  console.log(requests.map((r) => `  ★ ${r}`).join("\n"));
  console.log(`REVERT_EXIT=${failed === 0 ? 0 : 1}`);
  process.exitCode = failed === 0 ? 0 : 1;
} else {
  // 正向前提：源码三处端点必须是 S3-148 后的同源口径
  report(
    "段1 源码端点口径正确（列表 /store/shifts、详情 :shiftNo、关闭 :shiftNo/close）",
    listPath === "/store/shifts" &&
      detailPathTpl === "/store/shifts/${shiftNo}" &&
      closePathTpl === "/store/shifts/${shiftNo}/close",
    `list=${listPath} detail=${detailPathTpl} close=${closePathTpl}`,
  );

  // ─── 段2：建单（真实写路径 POST /api/store/shifts → t_shift） ───
  const created = await call("POST", createPath, {
    token,
    csrf,
    body: {
      shiftType: "EVENING",
      startTime: `${TODAY} 20:15:00`,
      operatorName: "张三",
      openingCash: 200,
      remark: "S3-148 运行期证据",
    },
  });
  const createdNo = String(dataOf(created)?.shiftNo ?? "");
  report(
    "段2 新建交接班（落 t_shift，单号 JB…）",
    created.status === 200 && createdNo.startsWith("JB"),
    `status=${created.status} shiftNo=${createdNo}`,
  );

  // ─── 段3：列表（同源），行必须带 shiftNo ───
  const list = await call("GET", `${listPath}?page=1&pageSize=20&date=${TODAY}`, { token });
  const listData = dataOf(list);
  const listRows = listData?.records ?? [];
  const listRow = listRows.find((r) => String(r.shiftNo ?? r.shift_no ?? "") === createdNo);
  const rowNo = String(listRow?.shiftNo ?? listRow?.shift_no ?? "");
  report(
    "段3 列表 200 且含新建行、行内含 shiftNo（JB…）",
    list.status === 200 && listRows.length >= 1 && !!listRow && rowNo.startsWith("JB"),
    `status=${list.status} 行数=${listRows.length} total=${listData?.total} 命中行 shiftNo=${rowNo}`,
  );

  // ─── 段4：主判据——**用列表行的 shiftNo**（不是数字 id）打详情 ───
  const detail = await call("GET", detailPath(rowNo || "__S3148_NO_LIST_ROW__"), { token });
  const detailData = dataOf(detail);
  report(
    "段4 用列表行的 shiftNo 打详情 ⇒ 200（原传数字 id/班结单号恒 404）",
    detail.status === 200 && String(detailData?.shiftNo ?? "") === rowNo,
    `status=${detail.status} 详情 shiftNo=${detailData?.shiftNo} 状态=${detailData?.status}`,
  );

  // ─── 段5：完成交接 = 关闭端点（用同一个列表行 shiftNo） ───
  const closed = await call("POST", closePath(rowNo), { token, csrf });
  const closedData = dataOf(closed);
  report(
    "段5 用列表行的 shiftNo 打关闭端点 ⇒ 200 且 status=CLOSED、endTime 非空",
    closed.status === 200 && closedData?.status === "CLOSED" && !!closedData?.endTime,
    `status=${closed.status} 返回 status=${closedData?.status} endTime=${JSON.stringify(closedData?.endTime)}`,
  );

  // ─── 段6：详情复读（界面刷新后可直接观察到） ───
  const after = await call("GET", detailPath(rowNo), { token });
  const afterData = dataOf(after);
  report(
    "段6 详情复读 status=CLOSED、endTime 非空",
    after.status === 200 && afterData?.status === "CLOSED" && !!afterData?.endTime,
    `status=${after.status} 详情 status=${afterData?.status} endTime=${JSON.stringify(afterData?.endTime)}`,
  );

  // ─── 段7：重复关闭 ⇒ 显式业务结果（不得静默 200 假成功、不得 500） ───
  const again = await call("POST", closePath(rowNo), { token, csrf });
  const againMsg = dataOf(again)?.msg ?? again.json?.msg;
  report(
    "段7 重复关闭 ⇒ 409 + 中文文案（非 200 假成功、非 500）",
    again.status === 409 && String(againMsg ?? "").includes("交接班已完成"),
    `status=${again.status} msg=${againMsg}`,
  );

  console.log(`\n小结[green]：${passed} passed / ${failed} failed（请求 ${requests.length} 条）`);
  console.log(requests.map((r) => `  ★ ${r}`).join("\n"));
  console.log(`GREEN_EXIT=${failed === 0 ? 0 : 1}`);
  process.exitCode = failed === 0 ? 0 : 1;
}
