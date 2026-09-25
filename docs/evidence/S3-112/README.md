# S3-112 证据包（CodeQL `js/missing-rate-limiting` 根因收敛：限流注册点内联 `rateLimit(...)`）

> 执行方：阿坚（后端 · 本地通道）｜2026-09-25
> 回传卡：`docs/tasks/cards/R101-S3-112-阿坚回传.md`
> 派单卡：`docs/tasks/cards/R101-派单-20260925-S3-112.md`

## 一、本沙箱的环境事实（决定了证据形态）

| 能力 | 状态 | 证据 |
|---|---|---|
| `npx vitest run`（标准命令） | **不可用** | `outputs/vitest-standard-command-blocked.log`：`Error: spawn EPERM`（esbuild `ensureServiceIsRunning`），沙箱禁止 node 创建子进程 |
| 沙箱 vitest 通道 | **可用** | 复用 C6-1A 壳 `docs/evidence/C6-1A/sandbox-vitest/`（esbuild 假实现 + 注册钩子）+ 本目录 `sandbox-vitest/vitest.config.sandbox.mjs` |
| `npx tsc -p tsconfig.json --noEmit` | 可用 | exit 0（见回传卡证据 1） |
| `npx eslint src/server.ts src/__tests__/config/rate-limit-options.test.ts` | 可用 | 0 error（见回传卡证据 2） |
| GitHub 只读（`gh api` GET） | **无** | `proxyconnect tcp: dial tcp 127.0.0.1:9: connectex: … refused`（连只读也出不去 ⇒ CodeQL 收敛判据只能由凌舟的 PR CI 给） |
| git 网络 / gh 写 | 无 | 按派单卡：提交 / 推送 / PR 由凌舟执行 |

## 二、复跑命令

**凌舟本机 / CI（标准命令，两条都要绿）**

```powershell
cd D:\Users\ZXQL\wt-agents\issue-122\backend
npx tsc -p tsconfig.json --noEmit
npx vitest run
```

**本沙箱内的等价通道（执行方已用它跑出下列日志）**

```powershell
$repo = "D:\Users\ZXQL\wt-agents\issue-122"
$hook = "$repo\docs\evidence\C6-1A\sandbox-vitest"
$env:NODE_OPTIONS = "--import file:///" + ($hook -replace '\\','/') + "/register-hook.mjs"
cd $repo\backend

# 涉及测试（S3-112 新增文件）
npx vitest run --configLoader native --config "$repo\docs\evidence\S3-112\sandbox-vitest\vitest.config.sandbox.mjs" --pool=threads `
  src/__tests__/config/rate-limit-options.test.ts

# 全量
npx vitest run --configLoader native --config "$repo\docs\evidence\S3-112\sandbox-vitest\vitest.config.sandbox.mjs" --pool=threads
```

**反测（验收③，红 → 恢复 → 绿）**

```powershell
# 1) 把 server.ts 的全局注册点改回 helper 形式（原样）：
#    function createRateLimiter(options) { return rateLimit(buildRateLimitOptions(options)); }
#    app.use(createRateLimiter({ windowMs: 60_000, max: process.env.NODE_ENV === "production" ? 600 : 2000 }));
#    然后跑上面「涉及测试」命令 ⇒ 期望红（outputs/shape-redtest-reverted-helper-RED.log）
# 2) 恢复为 `app.use(rateLimit(buildRateLimitOptions({ windowMs: 60_000, max: … })))` ⇒ 再跑 ⇒ 期望绿
```

## 三、产物与读数（原始日志在 `outputs/`）

| 文件 | 含义 | 汇总行 |
|---|---|---|
| `outputs/affected-test-green.log` | **最终状态**：S3-112 新增单测 | `Test Files 1 passed (1)` / `Tests 8 passed (8)` |
| `outputs/shape-redtest-reverted-helper-RED.log` | **反测红**：注册点改回 `createRateLimiter(...)` | `Test Files 1 failed (1)` / `Tests 2 failed \| 6 passed (8)` |
| `outputs/affected-test-run1.log` | 首次真跑（7 用例）暴露**测试自身缺陷**：形状断言拿全文匹配，被"解释为什么不能那样写"的注释误伤 ⇒ 已改为"去注释后再匹配" | `Tests 1 failed \| 6 passed (7)` |
| `outputs/affected-test-green-restored.log` | 反测恢复后的中间态（7 用例版本） | `Tests 7 passed (7)` |
| `outputs/full-suite-sandbox.log` | 本沙箱**全量**（S3-112 最终状态，含新增文件） | `Test Files 586 passed (586)` / `Tests 6483 passed (6483)` |
| `outputs/vitest-standard-command-blocked.log` | 标准命令在本沙箱不可用的原始报错 | `Error: spawn EPERM` |
| `sandbox-vitest/vitest.config.sandbox.mjs` | 沙箱内 vitest 配置（复跑用，未改动生产配置） | — |

## 四、验收④（限流行为不变，真机 429）的"低 max 构造法"说明

红线①禁止改动生产参数（`windowMs: 60_000`、`max: production?600:2000`），因此低 max 实例必须在**临时外壳**里构造，两种做法：

**A. 直接复用已落库的单测用例（一键复跑，推荐）**

```powershell
cd D:\Users\ZXQL\wt-agents\issue-122\backend
npx vitest run src/__tests__/config/rate-limit-options.test.ts -t "限流行为不变"
```

该用例内部就是"真机等价"的构造：`lowMaxApp.use(rateLimit(buildRateLimitOptions({ windowMs: 60_000, max: 3 })))`，
用 `supertest` 连打 4 次 `/ping`，断言前 3 次 200、第 4 次 **429**，且响应头 `RateLimit-Limit: 3`、`RateLimit-Remaining: 2`。
注意它调用的 `rateLimit` / `buildRateLimitOptions` 都来自 `server.ts` 本体（不是复制品）⇒ 与生产注册点是**同一条代码路径**。

**B. 自己起临时实例（真机反测模板）**

```ts
// 放在仓库外的临时文件（不要落进生产源码），用 tsx 跑：
//   $env:NODE_ENV='test'; $env:USE_MOCK_DB='true'; $env:JWT_SECRET='probe'   # NODE_ENV=test ⇒ server.ts 不会真的 listen
//   npx tsx <临时文件>
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { buildRateLimitOptions } from "./src/server";

const app = express();
app.set("trust proxy", 1); // 与 server.ts 一致，避免 express-rate-limit 的 XFF 校验告警
app.use(rateLimit(buildRateLimitOptions({ windowMs: 60_000, max: 3 })));
app.get("/ping", (_req, res) => res.json({ ok: true }));

for (let i = 1; i <= 4; i += 1) {
  const res = await request(app).get("/ping");
  console.log(i, res.status, res.headers["ratelimit-limit"], res.headers["ratelimit-remaining"]);
}
```

要点：`NODE_ENV` 用 `test` 或 `production` 都行——`test` 或无 `REDIS_URL` 时 `buildRateLimitOptions` 返回 MemoryStore options（不连 Redis）；
若要一并验证 RedisStore 分支，则设 `NODE_ENV=production` + `REDIS_URL=redis://…`（需真 Redis），仍只把 `max` 压到 3。
