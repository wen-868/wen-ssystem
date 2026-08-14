/**
 * 安全冒烟扫描（基础 DAST，验收检查项：安全测试 SAST+DAST）
 *
 * 用法：
 *   node scripts/security-smoke.mjs [--base http://127.0.0.1:8080]
 *
 * 场景：越权访问、SQL 注入（登录/搜索）、路径遍历、无效输入
 * 原则：恶意请求必须被拦截（401/400/403），不得返回 200 数据或 500 崩溃
 * 输出：docs/reports/security-smoke-{时间戳}.md
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://127.0.0.1:8080";

async function req(path, options = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text().catch(() => "");
    return { status: res.status, body: body.slice(0, 300) };
  } catch (err) {
    return { status: 0, body: String(err?.message || err) };
  }
}

async function login() {
  try {
    const res = await fetch(`${BASE}/api/store/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    return data?.data?.token || "";
  } catch (err) {
    console.error("登录失败:", String(err?.message || err));
    return "";
  }
}

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name} — ${detail}`);
}

async function run() {
  const token = await login();
  const auth = token ? { Authorization: `Bearer ${token}` } : {};

  // 1. 越权：无 token 访问受保护接口
  const unauth = await req("/api/store/dashboard");
  record("越权访问拦截", unauth.status === 401, `无 token → ${unauth.status}`);

  // 2. SQL 注入（登录）：注入 payload 不得登录成功
  const sqliLogin = await req("/api/store/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "' OR '1'='1", password: "x" }),
  });
  record(
    "SQL 注入(登录)拦截",
    sqliLogin.status === 400 || sqliLogin.status === 401,
    `注入 payload → ${sqliLogin.status}`
  );

  // 3. SQL 注入（搜索）：参数化查询应安全处理，不 500
  const sqliSearch = await req("/api/admin/products?keyword=%27%20OR%20%271%27%3D%271&page=1&pageSize=10", { headers: auth });
  record(
    "SQL 注入(搜索)不崩溃",
    sqliSearch.status !== 500 && sqliSearch.status !== 0,
    `注入搜索 → ${sqliSearch.status}`
  );

  // 4. 路径遍历：备份下载禁止穿越
  const traversal = await req("/api/admin/sys-config/backups/..%2F..%2Fetc%2Fpasswd/download", { headers: auth });
  record(
    "路径遍历拦截",
    traversal.status === 400 || traversal.status === 404,
    `穿越路径 → ${traversal.status}`
  );

  // 5. 无效 JSON：解析失败应 400
  const badJson = await req("/api/store/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad json",
  });
  record("无效 JSON 拦截", badJson.status === 400, `坏 JSON → ${badJson.status}`);

  const passed = results.filter((r) => r.pass).length;
  const dir = join(ROOT, "docs", "reports");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const mdPath = join(dir, `security-smoke-${stamp}.md`);
  writeFileSync(mdPath, [
    `# 安全冒烟扫描报告 ${stamp}`,
    "",
    `| 场景 | 结果 | 详情 |`,
    `|---|---|---|`,
    ...results.map((r) => `| ${r.name} | ${r.pass ? "✅" : "❌"} | ${r.detail} |`),
    "",
    `**通过 ${passed}/${results.length}**`,
    "",
    "> 由 `node scripts/security-smoke.mjs` 生成（基础 DAST 冒烟，非第三方渗透）",
  ].join("\n"), "utf8");
  console.log(`\n通过 ${passed}/${results.length}；报告：${mdPath}`);
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((err) => {
  console.error("安全扫描执行失败:", err);
  process.exit(1);
});
