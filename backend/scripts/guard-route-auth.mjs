#!/usr/bin/env node
/**
 * G3 门禁 · guard:route-auth（S3-176 B0）
 *
 * 防的是什么（根因）：鉴权有两个挂法 —— `routeConfig.auth` 声明式（auto-routes 统一挂
 *   认证 + CSRF）与「auth:"none" + 端点内联 requirePlatformAuth」。后者**会绕过 CSRF**：
 *   2026-10-01 的 P0 就是这么产生的（platform-msg-config 6 端点、tenant applications 审批端点）。
 *   只修那几处 ⇒ 下次新人照着"内联"写法再写一遍 ⇒ 又复发。
 *   ⇒ 本门禁把"绕过统一挂载"变成**机械红**，而不是靠人记得。
 *
 * 规则：
 *   R1 凡含写方法（post/put/patch/delete）的路由文件，`routeConfig.auth` 不得为 "none"，
 *      除非在 NONE_ALLOWLIST 里（必须写明理由）。
 *   R2 `auth: "none"` 的文件里，任何**内联**挂载的认证中间件（requireAuth /
 *      requireAuthWithTenant / requirePlatformAuth）必须**同一行**带 csrfMiddleware。
 *
 * 用法：node backend/scripts/guard-route-auth.mjs     退出码 0=绿 / 1=红
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = resolve(HERE, "..", "src", "routes");

/** auth:"none" 白名单：必须逐条写明"为什么不能走声明式" */
const NONE_ALLOWLIST = {
  "tenant-register.routes.ts":
    "同一文件含公开注册端点（/register、/register/sms-code、/register/config）必须无鉴权；受保护分支已改为 use('/applications', requirePlatformAuth, csrfMiddleware) 成对挂载",
};

const AUTH_MIDDLEWARES = ["requireAuthWithTenant", "requirePlatformAuth", "requireAuth"];
const WRITE_METHODS = ["post", "put", "patch", "delete"];
const rules = [];

function check(file, src) {
  const authMatch = /\bauth:\s*["']([A-Za-z]+)["']/.exec(src);
  const auth = authMatch ? authMatch[1] : null;
  const lines = src.split(/\r?\n/);
  const hasWrite = new RegExp(`\\.(${WRITE_METHODS.join("|")})\\s*\\(`).test(src);

  // R1：写方法 + auth:none ⇒ 必须显式登记为「公开端点」
  if (hasWrite && auth === "none" && !NONE_ALLOWLIST[file]) {
    rules.push(
      `${file}: 含写方法但 auth:"none" 且未登记为公开端点 ⇒ 该文件的写端点不经过 auto-routes 的 CSRF 挂载。` +
        ` 若确为公开端点（webhook/回调/注册/自有鉴权），请在 NONE_ALLOWLIST 里逐条写明理由；否则改 routeConfig.auth 声明式。`
    );
  }

  // R2：auth:none ⇒ **写方法**行上内联挂载了认证中间件，则该文件必须至少使用过 csrfMiddleware。
  //     判据取"文件级"而不是"同行"，因为既有合法写法是分两步挂载：
  //       router.use("/admin", requireAuthWithTenant);
  //       router.use("/admin", csrfMiddleware);      ← 见 retail-announcement.routes.ts 的注释说明
  //     （GET/HEAD/OPTIONS 是安全方法，csrfMiddleware 自身直接放行 ⇒ 不要求）
  //     ⚠️ 已知局限（本版有意接受，已在计划 §二 G3 登记）：同文件里若"某 scope 挂了 csrf、另一
  //        scope 没挂"，本规则不会报。后续升级为按 scope 配对时补。
  const fileUsesCsrf = /\bcsrfMiddleware\b/.test(src);
  if (auth === "none") {
    lines.forEach((line, idx) => {
      const isWriteLine = new RegExp(`\\.(${WRITE_METHODS.join("|")})\\s*\\(`).test(line);
      if (!isWriteLine) return;
      const hasAuthInline = AUTH_MIDDLEWARES.some((m) => new RegExp(`\\b${m}\\b`).test(line));
      if (!hasAuthInline) return;
      if (/^\s*(import|\/\/|\*)/.test(line)) return; // 导入与注释不算挂载
      if (!fileUsesCsrf) {
        rules.push(
          `${file}:${idx + 1}: auth:"none" 的**写**端点内联挂载了认证中间件，但**整个文件从未使用 csrfMiddleware** ⇒ 该写端点无 CSRF 防护`
        );
      }
    });
  }
}

if (!existsSync(ROUTES_DIR)) {
  console.error(`找不到路由目录：${ROUTES_DIR}`);
  process.exit(1);
}

const files = readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".routes.ts"));
for (const f of files) check(f, readFileSync(join(ROUTES_DIR, f), "utf8"));

console.log(`[guard:route-auth] 扫描 ${files.length} 个路由文件`);
if (rules.length > 0) {
  console.error(`\n❌ G3 违规 ${rules.length} 条：`);
  for (const r of rules) console.error(`   ${r}`);
  process.exit(1);
}
console.log("✅ G3 通过：无「绕过声明式鉴权/CSRF」的路由文件");
