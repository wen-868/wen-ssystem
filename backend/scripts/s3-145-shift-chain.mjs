/**
 * S3-145 运行期主判据装置（真实后端进程 + 真实登录令牌 + 真实 HTTP）
 *
 * 用法：
 *   node backend/scripts/s3-145-shift-chain.mjs green    # 正向：列表 → 详情 → 统计 → 盘点 全通
 *   node backend/scripts/s3-145-shift-chain.mjs revert   # 反测：列表源改回 t_daily_settlement ⇒ 详情 404
 *
 * revert 模式的语义（S3-145-F2 补注）：它断言的是【旧源口径】——交接班列表若走
 *   `t_daily_settlement`（班结表），列表行就是班结单号 `BJ…`，该单号在交接班详情端点里不存在。
 *   因此「对已修代码（列表已改读 t_shift）跑它是 4 passed / 0 failed」是**预期**，
 *   它只在「列表源被改回旧写法」的构建上才成立；对已修代码跑它若变红也不是本装置的缺陷。
 *   revert 分支本身**不能**单独充当「真反测」——真反测由 green 链在改坏构建上变红承担。
 *
 * 说明：装置只发 HTTP，不改任何产品数据以外的状态；服务端在 USE_MOCK_DB=true 下运行，
 * 数据面由 backend/src/__tests__/mocks/mock-db-shift.ts 提供（非真实库，回传卡已声明）。
 */
const BASE = process.env.S3_BASE || "http://127.0.0.1:18811";
const MODE = (process.argv[2] || "green").toLowerCase();
const TODAY = new Date().toISOString().slice(0, 10);

let passed = 0;
let failed = 0;
const requests = [];

function report(label, ok, detail) {
  if (ok) passed += 1; else failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}   ← ${detail}`);
}

async function call(method, path, { token, csrf, body } = {}) {
  const headers = {};
  if (token) headers["authorization"] = `Bearer ${token}`;
  if (csrf) headers["x-csrf-token"] = csrf;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON 响应保留原文 */ }
  const auth = token ? "Authorization令牌" : "无令牌";
  const csrfMark = csrf ? " +x-csrf-token" : "";
  const line = `${method} ${path} [${auth}${csrfMark}] ⇒ ${res.status}`;
  requests.push(line);
  console.log(`  → ${line}`);
  console.log(`    ${text.length > 900 ? text.slice(0, 900) + "…(截断)" : text}`);
  return { status: res.status, json, text };
}

const dataOf = (r) => (r.json && typeof r.json === "object" ? r.json.data : undefined);

console.log(`【装置】真实后端 = ${BASE}（USE_MOCK_DB=true，数据面 = mock-db-shift.ts）`);
console.log(`【模式】${MODE}   日期=${TODAY}   node=${process.version}`);
console.log("");

// ─── 0. 真实登录（store_manager / admin123，mock §state.users） ───
const login = await call("POST", "/api/admin/auth/login", {
  body: { username: "store_manager", password: "admin123" },
});
const token = dataOf(login)?.token;
const csrf = dataOf(login)?.csrfToken;
report("段0 真实登录签发令牌", login.status === 200 && !!token, `status=${login.status} token=${token ? token.slice(0, 12) + "…" : "无"}`);
if (!token) {
  console.log("\n无法取得令牌，装置中止");
  process.exit(1);
}

if (MODE === "revert") {
  // ─── 反测：列表源已改回 t_daily_settlement（旧写法） ⇒ 列表行单号 BJ… ⇒ 详情复现 404 ───
  console.log("\n=== 反测：把交接班列表源改回旧写法（t_daily_settlement / 班结口径） ===");
  const settle = await call("POST", "/api/store/shift/settle", { token, csrf, body: { actualAmount: 0 } });
  report("反测-段1 写入一条班结记录（BJ…，settleShift → t_daily_settlement）", settle.status === 200, `settleNo=${dataOf(settle)?.settleNo}`);

  const list = await call("GET", "/api/store/shifts?page=1&pageSize=20", { token });
  const rows = dataOf(list)?.records ?? [];
  const first = rows[0]?.shiftNo ?? "";
  report("反测-段2 列表（旧源）返回班结单号 BJ…", rows.length >= 1 && String(first).startsWith("BJ"), `行数=${rows.length} 首行=${first}`);

  const detail = await call("GET", `/api/store/shifts/${first}`, { token });
  report(
    "反测-段3 列表行（BJ…）点进详情 ⇒ 业务级 404（复现原缺陷）",
    detail.status === 404,
    `status=${detail.status} code=${dataOf(detail)?.code ?? detail.json?.code} msg=${dataOf(detail)?.msg ?? detail.json?.msg}`
  );

  console.log(`\n小结[revert]：${passed} passed / ${failed} failed（请求 ${requests.length} 条）`);
  console.log(requests.map((r) => "  ★ " + r).join("\n"));
  console.log(`REVERT_EXIT=${failed === 0 ? 0 : 1}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

if (MODE !== "revert") {
// ─── 1. 创建交接班（真实写路径：POST /api/store/shifts → createShift → t_shift） ───
const created = await call("POST", "/api/store/shifts", {
  token,
  csrf,
  body: {
    shiftType: "EVENING",
    startTime: `${TODAY} 20:15:00`,
    operatorName: "张三",
    openingCash: 200,
    remark: "S3-145 运行期证据",
  },
});
const shiftNo = dataOf(created)?.shiftNo ?? "";
report(
  "段1 新建交接班（落 t_shift，单号 JB…）",
  created.status === 200 && String(shiftNo).startsWith("JB"),
  `status=${created.status} shiftNo=${shiftNo} shiftType=${dataOf(created)?.shiftType} startTime=${dataOf(created)?.startTime}`
);

// 第二条（早班）——用于证明筛选与分页 total 是真值，而不是"只有一行时凑巧成立"
const created2 = await call("POST", "/api/store/shifts", {
  token,
  csrf,
  body: { shiftType: "MORNING", startTime: `${TODAY} 09:30:00`, operatorName: "李四", openingCash: 100 },
});
const shiftNo2 = dataOf(created2)?.shiftNo ?? "";
report(
  "段1b 第二条交接班（早班 09:30）",
  created2.status === 200 && String(shiftNo2).startsWith("JB"),
  `shiftNo=${shiftNo2} shiftType=${dataOf(created2)?.shiftType}`
);

// ─── 2. 列表（新端点 GET /api/store/shifts，读 t_shift） ───
const list = await call("GET", "/api/store/shifts?page=1&pageSize=20", { token });
const listData = dataOf(list) ?? {};
const rows = listData.records ?? [];
const row = rows.find((r) => r.shiftNo === shiftNo);
report(
  "段2 列表（GET /api/store/shifts，读 t_shift）返回 ≥1 行且含新建记录",
  list.status === 200 && rows.length >= 1 && !!row,
  `行数=${rows.length} total=${listData.total} 首行=${JSON.stringify(rows[0] ?? null)}`
);
report(
  "段2b 列表行的 operatorName/startTime 取自用户输入（原被后端忽略）",
  row?.operatorName === "张三" && String(row?.startTime).includes("20:15"),
  `operatorName=${row?.operatorName} startTime=${row?.startTime} shiftType=${row?.shiftType} status=${row?.status}`
);
report(
  "段2c 列表行 status=OPEN（t_shift 真实状态 ⇒「完成交接」按钮条件可命中，原恒不命中）",
  // ★ S3-145-F2 补强：`rows.every(...)` 在空数组上恒真 ⇒ 加 `rows.length >= 1` 前置，
  //   否则"列表 0 行"时本段会真空通过（假绿），掩盖列表源被改坏的缺陷。
  rows.length >= 1 && rows.every((r) => r.status === "OPEN"),
  `行数=${rows.length} 状态集合=${JSON.stringify([...new Set(rows.map((r) => r.status))])}`
);

// ─── 3. 详情（同源：GET /api/store/shifts/:shiftNo → t_shift） ───
// ★ S3-145-F2 补强：详情入参改取 **段2 列表返回的行**的单号（原实现取段1 的返回值 shiftNo，
//   于是「列表行 → 点进详情」这条 S3-145 的原始缺陷链根本没被断言）。改坏列表取数源时，
//   列表行变成班结单号 BJ…（或列表为 0 行）⇒ 本段打 404 ⇒ 必须能红。
const listRowNo = String(rows[0]?.shiftNo ?? "");
const detail = await call("GET", `/api/store/shifts/${listRowNo || "__S3145_NO_LIST_ROW__"}`, { token });
report(
  "段3 列表行 → 详情 200（原恒 404）",
  !!listRowNo && detail.status === 200 && dataOf(detail)?.shiftNo === listRowNo,
  `列表行单号=${listRowNo || "（列表无行）"} status=${detail.status} 返回单号=${dataOf(detail)?.shiftNo} status字段=${dataOf(detail)?.status}`
);

// ─── 4. 统计（本班次销售统计） ───
const sales = await call("GET", `/api/store/shifts/${shiftNo}/sales`, { token });
report(
  "段4 统计 200（有字段返回）",
  sales.status === 200 && dataOf(sales) !== undefined,
  `status=${sales.status} totalAmount=${dataOf(sales)?.totalAmount} totalCount=${dataOf(sales)?.totalCount}`
);

// ─── 5. 盘点（门店库存快照） ───
const check = await call("GET", `/api/store/shifts/${shiftNo}/check`, { token });
const checkRows = dataOf(check)?.records ?? [];
report(
  "段5 盘点 200 且有数据（账面数量）",
  check.status === 200 && checkRows.length >= 1,
  `status=${check.status} records=${checkRows.length} 首行=${JSON.stringify(checkRows[0] ?? null)}`
);

// ─── 6. 端点注册证据（踩坑[155]：带令牌打确定不存在的资源 ⇒ 业务级 404） ───
const missing = await call("GET", "/api/store/shifts/__S3145_DEFINITELY_NOT_EXIST__", { token });
const missingCode = dataOf(missing)?.code ?? missing.json?.code;
const missingMsg = dataOf(missing)?.msg ?? missing.json?.msg;
report(
  "段6 带令牌打不存在的交接班 ⇒ 业务级 404（端点已注册，非 401）",
  missing.status === 404 && String(missingMsg ?? "").includes("交接班不存在"),
  `status=${missing.status} code=${missingCode} msg=${missingMsg}`
);

// ─── 7. 班结历史端点保留（t_daily_settlement，BJ…），与交接班区分 ───
const settle = await call("POST", "/api/store/shift/settle", { token, csrf, body: { actualAmount: 0 } });
const settleNo = dataOf(settle)?.settleNo ?? "";
const history = await call("GET", "/api/store/shift/history?page=1&pageSize=20", { token });
const historyRows = dataOf(history) ?? [];
report(
  "段7 班结历史端点保留（POST /shift/settle 写 BJ…；GET /shift/history 读 t_daily_settlement）",
  settle.status === 200 && String(settleNo).startsWith("BJ") && history.status === 200 && historyRows.some((r) => r.shift_no === settleNo),
  `settleNo=${settleNo} history行数=${historyRows.length} 首行单号=${historyRows[0]?.shift_no}`
);

// ─── 8. 筛选参数生效（date + shiftType，派生口径与列表展示同一取值） ───
const filteredIn = await call("GET", `/api/store/shifts?page=1&pageSize=20&date=${TODAY}&shiftType=EVENING`, { token });
const filteredOut = await call("GET", `/api/store/shifts?page=1&pageSize=20&shiftType=MORNING`, { token });
const inRows = dataOf(filteredIn)?.records ?? [];
const outRows = dataOf(filteredOut)?.records ?? [];
report(
  "段8 列表筛选参数生效（date=今日&shiftType=EVENING 只命中晚班；shiftType=MORNING 只命中早班）",
  inRows.length === 1 &&
    inRows[0]?.shiftNo === shiftNo &&
    outRows.length === 1 &&
    outRows[0]?.shiftNo === shiftNo2,
  `EVENING行数=${inRows.length} 单号=${inRows[0]?.shiftNo}；MORNING行数=${outRows.length} 单号=${outRows[0]?.shiftNo}`
);

// ─── 9. 分页 total 真值 ───
const paged = await call("GET", "/api/store/shifts?page=2&pageSize=1", { token });
const pagedData = dataOf(paged) ?? {};
report(
  "段9 分页 total 为真值（2 条记录、每页 1 条 ⇒ 第 2 页 1 行且 total=2）",
  pagedData.total === rows.length && rows.length === 2 && (pagedData.records ?? []).length === 1,
  `total=${pagedData.total} 全量行数=${rows.length} 第2页行数=${(pagedData.records ?? []).length}`
);

console.log(`\n小结[green]：${passed} passed / ${failed} failed（请求 ${requests.length} 条）`);
console.log(requests.map((r) => "  ★ " + r).join("\n"));
console.log(`GREEN_EXIT=${failed === 0 ? 0 : 1}`);
process.exitCode = failed === 0 ? 0 : 1;
}
