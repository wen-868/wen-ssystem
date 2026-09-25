# S3-111 证据包（C6-3 前端收口：类目只读聚合 + 上下架接线 + #86 + #85 + 删死代码）

> 执行方：墨（saas-admin 前端 · 本地通道）｜2026-09-25
> 回传卡：`docs/tasks/cards/R101-S3-111-墨回传.md`
> 派单卡：`docs/tasks/cards/R101-派单-20260925-S3-111.md`
> 工作区：`D:\Users\ZXQL\wt-agents\issue-120`（分支 `agent/issue-120`，HEAD `1c43e0e9`，**未提交**）

## 一、本沙箱的环境事实（决定了证据形态）

| 能力 | 状态 | 证据 |
|---|---|---|
| `cd saas-admin && npx vite build`（卡面标准命令） | **不可用** | `01-vite-build-标准命令-沙箱EPERM.log`：`Error: spawn EPERM`（esbuild `ensureServiceRunning`）——沙箱禁止 node 创建子进程 |
| `npx vue-tsc -b` | 可用 | `03` / `04` |
| `node saas-admin/scripts/check-api-paths.mjs` | 可用 | `05` / `06` |
| 后端 `npx vitest run`（标准命令） | **不可用**（同 `spawn EPERM`） | 用 `sandbox-vitest/` 壳替代，见 `07` |
| MySQL / docker / tsx / 浏览器 | **无** | 无库、无服务 ⇒ 端点级真机 200/404 **未在本沙箱执行** |
| git 网络 / gh 写 | 无 | 按派单卡：提交 / 推送 / PR / Issue 评论由凌舟执行 |

### 沙箱适配跑法（`spawn EPERM` 的绕行，仅用于取证据，不是 CI 口径）

```powershell
$repo = "D:\Users\ZXQL\wt-agents\issue-120"
$hook = "$repo\docs\evidence\C6-1A\sandbox-vitest"      # C6-1A 遗留的 esbuild 假实现 + 注册钩子（复用，未改动）
$env:NODE_OPTIONS = "--import file:///" + ($hook -replace '\\','/') + "/register-hook.mjs"

# ① 前端构建（真实 Vite/Rollup，仅 esbuild 转译被假实现替换 ⇒ **不等于** CI 口径）
cd "$repo\saas-admin"
npx vite build --configLoader runner --minify false --outDir "$env:TEMP\s3-111\dist" --emptyOutDir

# ② 后端状态机测试（复用 S3-110 的用例，真实路由 + 真实 service，DB 走内存桩）
cd "$repo\backend"
npx vitest run --configLoader native --config "$repo\docs\evidence\S3-111\sandbox-vitest\vitest.config.sandbox.mjs" `
  --pool=threads --reporter=verbose src/__tests__/routes/platform-s3-110.test.ts
```

凌舟本机 / CI 的**标准命令**（无沙箱限制）：

```powershell
cd D:\Users\ZXQL\wt-agents\issue-120\saas-admin
npx vite build          # = CI 的 npm --workspace saas-admin run build
npx vue-tsc -b
cd ..
node saas-admin\scripts\check-api-paths.mjs --no-color
```

## 二、文件清单

| 文件 | 说明 |
|---|---|
| `01-vite-build-标准命令-沙箱EPERM.log` | 卡面标准命令在本沙箱的原始失败输出（`spawn EPERM`，exit 1） |
| `02-vite-build-沙箱适配壳-exit0.log` | 沙箱适配壳下 `vite build` 全量产物列表，`✓ built in 28.94s`，exit 0 |
| `03-vue-tsc-改前基线.log` | 改动前 `npx vue-tsc -b`：**11 条**既有错误（0 条在 `main.ts`） |
| `04-vue-tsc-改后.log` | 改动后：**11 条**，与 `03` **逐行一致（Compare-Object 无差异）**，本单 8 个改动文件 **0 条** |
| `05-check-api-paths-改后PASS.log` | 路径比对 PASS（exit 0），含卡面命令 `cd saas-admin && node scripts/check-api-paths.mjs` 原样复跑 |
| `06-check-api-paths-反测RED.log` | 反测：临时注入不存在路径 ⇒ FAIL + exit 1，且指名 `saas-admin/src/api/library.ts:348`（文件末尾，证明全量扫描） |
| `07-后端状态机测试-9用例.log` | `platform-s3-110.test.ts` 9 用例全绿（含**反测：PENDING → OFFLINE 仍 400**），exit 0 |
| `08-死代码与提示清理判据.log` | `rg auditTenantApi` / `尚未开放 OFFLINE` / `待接入真实统计` 的 0 命中判据（含 1 条注释命中的说明） |
| `09-上下架入口守卫-等价断言.log` | 前端只对 APPROVED 展示「下架」、只对 OFFLINE 展示「重新上架」，且两条执行函数各带状态守卫 |
| `10-工作区状态与diffstat.log` | 分支名 / HEAD / `git status` / `git diff --stat` |
| `sandbox-vitest/vitest.config.sandbox.mjs` | 沙箱内 vitest 配置（root 由本文件位置推导，不硬编码工作区） |

## 三、本单未覆盖 / 需凌舟或 CI 复跑的部分

1. **卡面标准命令 `npx vite build`**：沙箱无子进程能力 ⇒ 未通过（`01`）；沙箱适配壳 exit 0（`02`）不能替代 CI 口径，请在
   本机或 CI 上跑 `npm --workspace saas-admin run build`。
2. **端点级真机验证**（类目聚合 200 的真实 7 行 / 下架→重新上架的 200、PENDING→OFFLINE 的 400）：沙箱无库无服务，
   未执行；`07` 是**用例级**证据（真实路由 + 真实 controller/service + 内存 DB 桩），真机命令见回传卡 §八。
3. **`vue-tsc` 基线口径与卡面不同**：卡面写「`src/main.ts:71-72` 的 2 条既有错误」，实测本工作区为 **11 条、且 0 条在 `main.ts`**
   （`03`）。本单只保证「改前=改后逐行一致、本单文件 0 条」。
