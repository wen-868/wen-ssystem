#!/usr/bin/env node
/**
 * S3-160 单测「等价复跑」装置（本沙箱 vitest 不可用时替代证据）
 *
 * 背景（与踩坑日志同源）：本沙箱 node 无法创建子进程（`spawn EPERM`），vitest/vite 加载配置时
 * esbuild 服务进程 spawn 被拒 ⇒ `npx vitest run` 无法执行。为不把"未跑"当"通过"，把
 * `src/__tests__/services/admin/auth-remember-me.test.ts` 的断言在**进程内**等价复跑：
 *   · 用 `ts.transpileModule`（不 spawn）把生产源码 `middleware/auth.ts` 与
 *     `services/admin/auth.service.ts` 转 CJS 后直接执行；
 *   · 只桩外部依赖（db / password / csrf / env / mfa-token / tenant）；`signToken` 与
 *     `jsonwebtoken` 均为**真实实现**；
 *   · 断言与单测一致：真实 `jwt.verify` 解出 `exp - iat`，判断 = 4h / 30d。
 *
 * 用法：node backend/scripts/s3-160-unit-equivalent.mjs
 * 退出码：0 = 全 PASS；1 = 有失败
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import jwt from "jsonwebtoken";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(REPO, "backend", "src");
const JWT_SECRET = "s3-160-unit-equivalent-secret";
const FOUR_HOURS = 4 * 3600;
const THIRTY_DAYS = 30 * 24 * 3600;

const ACCOUNT = {
  id: 2,
  username: "store_manager",
  password_hash: "hashed",
  real_name: "门店经理",
  store_id: 1,
  status: 1,
  tenant_id: "default",
  login_fail_count: 0,
  locked_until: null,
};

/* ── 进程内 TS(CJS) 加载器：只桩外部依赖，其余走真实源码 ── */
const TS_OPTS = {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
  },
};
const loaded = new Map();
const stubs = new Map();

class AppErrorStub extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const dbState = { queryOne: async () => ACCOUNT, query: async () => [] };
stubs.set(path.join(SRC, "shared", "db.ts"), {
  query: (sql, params) => dbState.query(sql, params),
  queryOne: (sql, params) => dbState.queryOne(sql, params),
  queryWithTenant: async () => [],
  queryOneWithTenant: async () => null,
  transaction: async () => undefined,
});
stubs.set(path.join(SRC, "shared", "password.ts"), {
  verifyPassword: async () => true,
  hashPassword: async () => "hashed",
  validatePassword: () => undefined,
});
stubs.set(path.join(SRC, "shared", "app-error.ts"), { AppError: AppErrorStub });
stubs.set(path.join(SRC, "shared", "response.ts"), { ok: (d) => ({ code: "0", data: d }), fail: () => ({}) });
stubs.set(path.join(SRC, "shared", "logger.ts"), {
  default: { info() {}, warn() {}, error() {}, debug() {} },
});
stubs.set(path.join(SRC, "middleware", "csrf.ts"), { generateCsrfToken: () => "csrf-stub" });
stubs.set(path.join(SRC, "middleware", "mfa-token.ts"), { signMfaToken: () => "mfa-stub" });
stubs.set(path.join(SRC, "middleware", "tenant.ts"), { tenantMiddleware: (_req, _res, next) => next?.() });
stubs.set(path.join(SRC, "config", "env.ts"), {
  env: {
    JWT_SECRET,
    CSRF_SECRET: JWT_SECRET,
    SERVICE_ACCOUNT_CLIENT_ID: "",
    SERVICE_ACCOUNT_CLIENT_SECRET: "",
  },
});

function load(absPath) {
  if (stubs.has(absPath)) return stubs.get(absPath);
  if (loaded.has(absPath)) return loaded.get(absPath);
  const code = ts.transpileModule(readFileSync(absPath, "utf-8"), TS_OPTS).outputText;
  const mod = { exports: {} };
  loaded.set(absPath, mod.exports);
  const dir = path.dirname(absPath);
  const nodeRequire = createRequire(absPath);
  const req = (spec) => {
    if (!spec.startsWith(".")) return nodeRequire(spec);
    const base = path.resolve(dir, spec);
    for (const cand of [
      `${base}.ts`,
      `${base}.js`,
      path.join(base, "index.ts"),
      path.join(base, "index.js"),
    ]) {
      if (existsSync(cand)) return load(cand);
      if (cand.endsWith("index.ts") && existsSync(path.join(base, "index.ts"))) return load(cand);
    }
    throw new Error(`无法解析模块 ${spec}（from ${absPath}）`);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", code)(
    req,
    mod,
    mod.exports,
    absPath,
    dir,
  );
  loaded.set(absPath, mod.exports);
  return mod.exports;
}

let passed = 0;
let failed = 0;
function report(ok, label, detail) {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}   ← ${detail}`);
}

const authMod = load(path.join(SRC, "middleware", "auth.ts"));
const svc = load(path.join(SRC, "services", "admin", "auth.service.ts"));

function decode(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: authMod.MERCHANT_JWT_ISSUER,
    audience: authMod.MERCHANT_JWT_AUDIENCE,
  });
}

async function runCase(label, rememberMe, expectedTtl) {
  const res =
    rememberMe === undefined
      ? await svc.login("store_manager", "x")
      : await svc.login("store_manager", "x", rememberMe);
  const payload = decode(res.token);
  const delta = payload.exp - payload.iat;
  console.log(
    `  ${label}：真实 jwt.verify 解出 iat=${payload.iat} exp=${payload.exp} exp-iat=${delta}s（期望 ${expectedTtl}s）；响应 expiresIn=${res.expiresIn}`,
  );
  report(delta === expectedTtl, `${label} exp-iat=${expectedTtl}s`, `实测 ${delta}s`);
  report(res.expiresIn === expectedTtl, `${label} 响应 expiresIn`, `实测 ${res.expiresIn}`);
  return payload;
}

const shortPayload = await runCase("缺省-不传 rememberMe", undefined, FOUR_HOURS);
const falsePayload = await runCase("rememberMe=false", false, FOUR_HOURS);
const longPayload = await runCase("rememberMe=true", true, THIRTY_DAYS);

report(
  longPayload.iss === shortPayload.iss &&
    longPayload.aud === shortPayload.aud &&
    longPayload.iss === authMod.MERCHANT_JWT_ISSUER &&
    longPayload.aud === authMod.MERCHANT_JWT_AUDIENCE &&
    falsePayload.iss === shortPayload.iss,
  "长短效 token 的 issuer/audience 完全一致（只差 TTL）",
  `iss=${longPayload.iss} aud=${longPayload.aud}`,
);

console.log(`\n小结：${passed} passed / ${failed} failed`);
console.log(`EXIT=${failed === 0 ? 0 : 1}`);
process.exitCode = failed === 0 ? 0 : 1;
