/**
 * S3-147 运行期主判据装置（真实后端进程 + 真实登录令牌 + 真实 HTTP）
 *
 * 判据（派单卡「交付物③」）：
 *   · 显式 shiftType=AFTERNOON + start_time 09:30 创建 ⇒ 列表/详情返回 AFTERNOON
 *     （09:30 的派生值是 MORNING，返回 AFTERNOON 才证明"显式值不被 start_time 覆盖"）；
 *   · 不传 shiftType 创建 ⇒ 返回派生值（存量/省略路径兼容）；
 *   · 非法值（NIGHT）⇒ 400；
 *   · 统计段 ⇒ 200 且 totalAmount>0 且 totalCount>0。
 *
 * 用法：
 *   node backend/scripts/s3-147-shift-type.mjs green
 *
 * 说明：装置只发 HTTP，不改任何产品数据以外的状态；服务端在 USE_MOCK_DB=true 下运行，
 * 数据面由 backend/src/__tests__/mocks/mock-db-shift.ts 提供（非真实库，回传卡已声明）。
 *
 * 反测（改坏⇒红 / 复原⇒绿，原始输出见回传卡）：
 *   ① 把读侧改回"只用 deriveShiftType"（shift.service.ts 的 resolveShiftType / 列表 / 详情）
 *      ⇒ 本装置「段1 显式落库」与「段3 详情」必红；
 *   ② 把 mock 数据面的销售行去掉（mock-db-shift.ts 的 shiftSaleBills 清空）
 *      ⇒ 本装置「段6 统计 >0」必红。
 */
const BASE = process.env.S3_BASE || "http://127.0.0.1:18811";
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
console.log(`【模式】S3-147 班次类型落库   日期=${TODAY}   node=${process.version}`);
console.log("");

// ─── 0. 真实登录 ───
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

// ─── 1. 显式 shiftType=AFTERNOON（start_time 09:30 ⇒ 派生值本是 MORNING） ───
const explicit = await call("POST", "/api/store/shifts", {
  token,
  csrf,
  body: {
    shiftType: "AFTERNOON",
    startTime: `${TODAY} 09:30:00`,
    operatorName: "王五",
    openingCash: 300,
    remark: "S3-147 显式班次类型",
  },
});
const explicitNo = dataOf(explicit)?.shiftNo ?? "";
report(
  "段1 显式 shiftType=AFTERNOON 创建（start_time 09:30）⇒ 创建响应返回 AFTERNOON",
  explicit.status === 200 && dataOf(explicit)?.shiftType === "AFTERNOON",
  `status=${explicit.status} shiftNo=${explicitNo} shiftType=${dataOf(explicit)?.shiftType} startTime=${dataOf(explicit)?.startTime}`
);

// ─── 2. 列表与筛选都走落库值 ───
const list = await call("GET", "/api/store/shifts?page=1&pageSize=20", { token });
const rows = dataOf(list)?.records ?? [];
const explicitRow = rows.find((r) => r.shiftNo === explicitNo);
report(
  "段2 列表返回该行且 shiftType=AFTERNOON（证明显式值不被 start_time 派生覆盖）",
  list.status === 200 && !!explicitRow && explicitRow.shiftType === "AFTERNOON",
  `行数=${rows.length} 该行=${JSON.stringify(explicitRow ?? null)}`
);

const filterIn = await call("GET", `/api/store/shifts?page=1&pageSize=20&date=${TODAY}&shiftType=AFTERNOON`, { token });
const filterOut = await call("GET", `/api/store/shifts?page=1&pageSize=20&shiftType=MORNING`, { token });
const inRows = dataOf(filterIn)?.records ?? [];
const outRows = dataOf(filterOut)?.records ?? [];
report(
  "段2b 筛选与展示同一口径（shiftType=AFTERNOON 命中该行；shiftType=MORNING 不命中它）",
  inRows.some((r) => r.shiftNo === explicitNo) && !outRows.some((r) => r.shiftNo === explicitNo),
  `AFTERNOON命中=${JSON.stringify(inRows.map((r) => [r.shiftNo, r.shiftType]))} MORNING命中=${JSON.stringify(outRows.map((r) => [r.shiftNo, r.shiftType]))}`
);

// ─── 3. 详情同口径 ───
const detail = await call("GET", `/api/store/shifts/${explicitNo}`, { token });
report(
  "段3 详情返回 shiftType=AFTERNOON（读侧落库值优先）",
  detail.status === 200 && dataOf(detail)?.shiftType === "AFTERNOON",
  `status=${detail.status} shiftType=${dataOf(detail)?.shiftType} startTime=${dataOf(detail)?.startTime}`
);

// ─── 4. 不传 shiftType ⇒ 派生回退（start_time 20:15 ⇒ EVENING） ───
const derived = await call("POST", "/api/store/shifts", {
  token,
  csrf,
  body: { startTime: `${TODAY} 20:15:00`, operatorName: "赵六", openingCash: 150, remark: "S3-147 未传班次类型" },
});
const derivedNo = dataOf(derived)?.shiftNo ?? "";
const derivedDetail = await call("GET", `/api/store/shifts/${derivedNo}`, { token });
report(
  "段4 不传 shiftType 创建 ⇒ 返回派生值 EVENING（存量/省略路径兼容）",
  derived.status === 200 &&
    dataOf(derived)?.shiftType === "EVENING" &&
    derivedDetail.status === 200 &&
    dataOf(derivedDetail)?.shiftType === "EVENING",
  `status=${derived.status} shiftNo=${derivedNo} 创建返回=${dataOf(derived)?.shiftType} 详情返回=${dataOf(derivedDetail)?.shiftType}`
);

// ─── 5. 非法值 ⇒ 400（不落库） ───
// ★ 基线必须"紧邻非法创建之前"取：段4 已新增一条记录，若复用段2 的列表行数会把新增算成"非法值落了库"。
const beforeInvalid = await call("GET", "/api/store/shifts?page=1&pageSize=20", { token });
const beforeInvalidCount = (dataOf(beforeInvalid)?.records ?? []).length;
const invalid = await call("POST", "/api/store/shifts", {
  token,
  csrf,
  body: { shiftType: "NIGHT", startTime: `${TODAY} 09:30:00`, operatorName: "钱七" },
});
const invalidMsg = dataOf(invalid)?.msg ?? invalid.json?.msg ?? invalid.json?.message;
const afterInvalid = await call("GET", "/api/store/shifts?page=1&pageSize=20", { token });
const afterInvalidCount = (dataOf(afterInvalid)?.records ?? []).length;
report(
  "段5 非法 shiftType=NIGHT ⇒ 400 且不落库（列表行数不增）",
  invalid.status === 400 && afterInvalidCount === beforeInvalidCount,
  `status=${invalid.status} code=${dataOf(invalid)?.code ?? invalid.json?.code} msg=${invalidMsg} 列表行数=${afterInvalidCount}（非法创建前=${beforeInvalidCount}）`
);

// ─── 6. 统计 > 0（F-6：补掉"只能断言结构完整"的判据缺口） ───
const stats = await call("GET", `/api/store/shifts/${explicitNo}/sales`, { token });
const totalAmount = Number(dataOf(stats)?.totalAmount ?? 0);
const totalCount = Number(dataOf(stats)?.totalCount ?? 0);
report(
  "段6 统计 200 且 totalAmount>0 且 totalCount>0（本班次存在销售行）",
  stats.status === 200 && totalAmount > 0 && totalCount > 0,
  `status=${stats.status} totalAmount=${dataOf(stats)?.totalAmount} totalCount=${dataOf(stats)?.totalCount} totalReceived=${dataOf(stats)?.totalReceived}`
);

console.log(`\n小结[S3-147]：${passed} passed / ${failed} failed（请求 ${requests.length} 条）`);
console.log(requests.map((r) => "  ★ " + r).join("\n"));
console.log(`S3147_EXIT=${failed === 0 ? 0 : 1}`);
process.exitCode = failed === 0 ? 0 : 1;
