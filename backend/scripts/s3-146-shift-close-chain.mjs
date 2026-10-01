/**
 * S3-146 运行期主判据装置（真实后端进程 + 真实登录令牌 + 真实 HTTP）
 *
 * 判据（派单卡「验收标准（硬）」①②③）：
 *   建单 → 列表行 status=OPEN → **打 close** → 详情 status=CLOSED 且 end_time 非空 → 重复 close 得到**显式**业务结果。
 *
 * 用法：
 *   node backend/scripts/s3-146-shift-close-chain.mjs green    # 正向：OPEN → close → CLOSED + end_time；重复 close ⇒ 409
 *   node backend/scripts/s3-146-shift-close-chain.mjs revert    # 旧口径复现：走旧路径（班结 /shift/settle）⇒ 交接班仍 OPEN
 *
 * revert 模式的语义（与 s3-145 装置同规）：它断言的是【旧路径口径】——S3-145 期的「完成交接」按钮
 *   回落到班结端点 `POST /store/shift/settle`（只写 `t_daily_settlement`，不碰 `t_shift`），返回 200
 *   "成功"但交接班仍是"进行中"（假成功）。因此对**已修代码**跑 revert 得到「仍 OPEN」是**预期**，
 *   它单独**不能**充当真反测；真反测＝把 `closeShift` 的写库那一步摘掉后跑 **green** 必须变红
 *   （两侧原始输出见回传卡）。
 *
 * 说明：装置只发 HTTP；服务端在 `USE_MOCK_DB=true` 下运行，数据面由
 * `backend/src/__tests__/mocks/mock-db-shift.ts` 提供（非真实库，回传卡已声明）。
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

// ─── 1. 建单（真实写路径：POST /api/store/shifts → createShift → t_shift） ───
const created = await call("POST", "/api/store/shifts", {
  token,
  csrf,
  body: {
    shiftType: "EVENING",
    startTime: `${TODAY} 20:15:00`,
    operatorName: "张三",
    openingCash: 200,
    remark: "S3-146 运行期证据",
  },
});
const shiftNo = dataOf(created)?.shiftNo ?? "";
report(
  "段1 新建交接班（落 t_shift，单号 JB…）",
  created.status === 200 && String(shiftNo).startsWith("JB"),
  `status=${created.status} shiftNo=${shiftNo} status字段=${dataOf(created)?.status}`
);

// ─── 2. 列表：行 status=OPEN（「完成交接」按钮的显示条件） ───
const list = await call("GET", "/api/store/shifts?page=1&pageSize=20", { token });
const rows = dataOf(list)?.records ?? [];
const row = rows.find((r) => r.shiftNo === shiftNo);
report(
  "段2 列表行 status=OPEN（点击条件成立）",
  list.status === 200 && !!row && row.status === "OPEN" && !row.endTime,
  `行数=${rows.length} 命中行=${JSON.stringify(row ?? null)}`
);

if (MODE === "revert") {
  // ─── 旧口径复现：走旧路径（班结端点）不能关闭交接班 ⇒ status 仍 OPEN（假成功） ───
  console.log("\n=== 旧口径复现：用旧路径 POST /store/shift/settle（只写 t_daily_settlement）代替 close ===");
  const settle = await call("POST", "/api/store/shift/settle", { token, csrf, body: { actualAmount: 0 } });
  report(
    "反测-段3 旧路径返回 200「成功」",
    settle.status === 200 && String(dataOf(settle)?.settleNo ?? "").startsWith("BJ"),
    `status=${settle.status} settleNo=${dataOf(settle)?.settleNo}`
  );

  const afterDetail = await call("GET", `/api/store/shifts/${shiftNo}`, { token });
  const after = dataOf(afterDetail);
  report(
    "反测-段4 旧路径后交接班仍 status=OPEN 且 end_time 为空（复现「假成功」）",
    afterDetail.status === 200 && after?.status === "OPEN" && !after?.endTime,
    `status=${after?.status} endTime=${JSON.stringify(after?.endTime)}`
  );

  console.log(`\n小结[revert]：${passed} passed / ${failed} failed（请求 ${requests.length} 条）`);
  console.log(requests.map((r) => "  ★ " + r).join("\n"));
  console.log(`REVERT_EXIT=${failed === 0 ? 0 : 1}`);
  process.exitCode = failed === 0 ? 0 : 1;
} else {
  // ─── 3. 关闭（唯一写端点）：OPEN → CLOSED + end_time（服务端时间） ───
  const closed = await call("POST", `/api/store/shifts/${shiftNo}/close`, { token, csrf });
  const closedData = dataOf(closed);
  report(
    "段3 close 返回 200 且落库结果 status=CLOSED、endTime 非空（服务端时间）",
    closed.status === 200 && closedData?.status === "CLOSED" && !!closedData?.endTime,
    `status=${closed.status} 返回 status=${closedData?.status} endTime=${JSON.stringify(closedData?.endTime)}`
  );

  // ─── 4. 详情（主判据：列表行 → 点按钮 → 详情 CLOSED） ───
  const detail = await call("GET", `/api/store/shifts/${shiftNo}`, { token });
  const d = dataOf(detail);
  report(
    "段4 详情 status=CLOSED 且 end_time 非空（主判据：OPEN → close → CLOSED + end_time）",
    detail.status === 200 && d?.status === "CLOSED" && !!d?.endTime,
    `status=${detail.status} 详情 status=${d?.status} endTime=${JSON.stringify(d?.endTime)}`
  );

  // ─── 5. 重复 close：显式业务结果（不得静默 200 假成功、不得 500） ───
  const again = await call("POST", `/api/store/shifts/${shiftNo}/close`, { token, csrf });
  const againCode = dataOf(again)?.code ?? again.json?.code;
  const againMsg = dataOf(again)?.msg ?? again.json?.msg;
  report(
    "段5 重复 close ⇒ 显式业务结果（409 + 中文文案，非 200 假成功、非 500）",
    again.status === 409 && String(againMsg ?? "").includes("交接班已完成"),
    `status=${again.status} code=${againCode} msg=${againMsg}`
  );

  // ─── 6. 权限：无令牌 ⇒ 401 ───
  const noToken = await call("POST", `/api/store/shifts/${shiftNo}/close`, {});
  report("段6 无令牌调 close ⇒ 401（受 requireAuthWithTenant 保护）", noToken.status === 401, `status=${noToken.status}`);

  // ─── 7. 端点注册证据（踩坑[155]：带令牌打确定不存在的资源 ⇒ 业务级 404，而非 401） ───
  const missing = await call("POST", "/api/store/shifts/__S3146_NOT_EXIST__/close", { token, csrf });
  const missingMsg = dataOf(missing)?.msg ?? missing.json?.msg;
  report(
    "段7 带令牌打不存在的单号 ⇒ 业务级 404（端点已注册，非 401）",
    missing.status === 404 && String(missingMsg ?? "").includes("交接班不存在"),
    `status=${missing.status} msg=${missingMsg}`
  );

  // ─── 8. 列表复读：该行已变 CLOSED（前端刷新列表可直接观察到的结果） ───
  const list2 = await call("GET", "/api/store/shifts?page=1&pageSize=20", { token });
  const row2 = (dataOf(list2)?.records ?? []).find((r) => r.shiftNo === shiftNo);
  report(
    "段8 复核列表：该行 status=CLOSED、endTime 非空",
    list2.status === 200 && !!row2 && row2.status === "CLOSED" && !!row2.endTime,
    `命中行=${JSON.stringify(row2 ?? null)}`
  );

  console.log(`\n小结[green]：${passed} passed / ${failed} failed（请求 ${requests.length} 条）`);
  console.log(requests.map((r) => "  ★ " + r).join("\n"));
  console.log(`GREEN_EXIT=${failed === 0 ? 0 : 1}`);
  process.exitCode = failed === 0 ? 0 : 1;
}
