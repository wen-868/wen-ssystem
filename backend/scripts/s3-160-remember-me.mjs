#!/usr/bin/env node
/**
 * S3-160 运行期证据装置：商家端登录「记住我」TTL
 *
 * 前置：一台**真实后端**已在本机监听（由 s3-160-remember-me.ps1 以 USE_MOCK_DB=true 启动；
 *      即真实 Express + 真实 controller/service/signToken + 真实 JWT，仅数据库为项目自带的 mock 通道）。
 * 装置本身用真实 HTTP 请求打 `/api/store/auth/login`，再用**真实 jwt.verify** 解出 `exp - iat`。
 *
 * 用例：
 *   ① 不带 rememberMe        ⇒ 期望 4h（14400s）—— 缺省不放松
 *   ② rememberMe=false       ⇒ 期望 4h（14400s）
 *   ③ rememberMe=true        ⇒ 期望 30d（2592000s）—— 长效
 * 同时核对响应字段 `expiresIn`（秒）与实签 TTL 一致。
 *
 * 用法：
 *   node backend/scripts/s3-160-remember-me.mjs
 *   S3_160_ONLY=缺省-不带rememberMe node backend/scripts/s3-160-remember-me.mjs   # 只跑某一条（反测定位用）
 *
 * 退出码：0 = 三条全部符合预期；1 = 有断言失败（反测时"应当红"即为预期结果）。
 */
import jwt from "jsonwebtoken";

const BASE = process.env.S3_160_BASE || "http://127.0.0.1:18160";
const SECRET = process.env.S3_160_JWT_SECRET || "s3-160-evidence-secret";
const USERNAME = process.env.S3_160_USERNAME || "store_manager";
const PASSWORD = process.env.S3_160_PASSWORD || "admin123";
const ONLY = (process.env.S3_160_ONLY || "").trim();

const FOUR_HOURS = 4 * 3600;
const THIRTY_DAYS = 30 * 24 * 3600;

let passed = 0;
let failed = 0;

function report(ok, label, detail) {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}   ← ${detail}`);
}

async function login(body) {
  const res = await fetch(`${BASE}/api/store/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    /* 非 JSON 保留原文 */
  }
  return { status: res.status, raw, json };
}

/** 真实 jwt.verify（与 requireAuth 同密钥/算法/issuer/audience） */
function decode(token) {
  return jwt.verify(token, SECRET, {
    algorithms: ["HS256"],
    issuer: "zhixiang-system",
    audience: "zhixiang-client",
  });
}

async function caseTtl(name, body, expectedTtl) {
  if (ONLY && ONLY !== name) return;
  console.log(`\n==== 用例 ${name}：请求体 ${JSON.stringify(body)} ====`);
  const r = await login(body);
  console.log(`原始响应 HTTP ${r.status}：${r.raw}`);
  if (r.status !== 200 || !r.json || r.json.code !== "0" || !r.json.data?.token) {
    report(false, `${name} 登录成功`, `HTTP ${r.status} / code ${r.json?.code}`);
    return;
  }
  const data = r.json.data;
  const payload = decode(data.token);
  const delta = payload.exp - payload.iat;
  console.log(
    `jwt.verify 解出：iat=${payload.iat} exp=${payload.exp} exp-iat=${delta}s（期望 ${expectedTtl}s）`,
  );
  console.log(`响应字段 expiresIn=${data.expiresIn}（期望 ${expectedTtl}）`);
  report(delta === expectedTtl, `${name} exp-iat=${expectedTtl}s`, `实测 ${delta}s`);
  report(data.expiresIn === expectedTtl, `${name} 响应 expiresIn`, `实测 ${data.expiresIn}`);
}

async function main() {
  const health = await fetch(`${BASE}/health`)
    .then((r) => r.json())
    .catch(() => null);
  console.log(`[前置] ${BASE}/health ⇒ ${JSON.stringify(health)}`);
  if (!health) {
    console.log("FAIL  后端未就绪（/health 无响应）");
    process.exitCode = 1;
    return;
  }

  await caseTtl("缺省-不带rememberMe", { username: USERNAME, password: PASSWORD }, FOUR_HOURS);
  await caseTtl(
    "rememberMe-false",
    { username: USERNAME, password: PASSWORD, rememberMe: false },
    FOUR_HOURS,
  );
  await caseTtl(
    "rememberMe-true",
    { username: USERNAME, password: PASSWORD, rememberMe: true },
    THIRTY_DAYS,
  );

  console.log(`\n小结：${passed} passed / ${failed} failed`);
  console.log(`EXIT=${failed === 0 ? 0 : 1}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

await main();
