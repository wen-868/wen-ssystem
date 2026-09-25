# S3-115 证据包（平台评论页前端契约收口：删无载体字段 + 改入参键 + 重写统计卡）

> 执行方：墨（saas-admin 前端 · 本地通道）｜2026-09-26
> 派单卡：`docs/tasks/cards/R101-派单-20260926-S3-115.md`
> 回传卡：`docs/tasks/cards/R101-S3-115-墨回传.md`
> 工作区：`D:\Users\ZXQL\wt-agents\issue-129`（分支 `agent/issue-129`，HEAD `8ffc7ca83`，**未提交**）

## 一、本沙箱的环境事实（决定了证据形态）

| 能力 | 状态 | 证据 |
|---|---|---|
| `cd saas-admin && npx vite build`（卡面标准命令） | **不可用** | `08-vite-build-标准命令-沙箱EPERM.log`：`Error: spawn EPERM`（esbuild `ensureServiceIsRunning`）——本沙箱禁止 node 创建**带管道**的子进程（`spawn(exe,{stdio:['pipe','pipe','pipe']})` ⇒ EPERM；`stdio:'ignore'/'inherit'` ⇒ 正常） |
| `npx vue-tsc -b --force` | 可用 | `02` / `03` / `11` |
| `node saas-admin/scripts/check-api-paths.mjs` | 可用 | `01` / `04` / `05` / `06` / `07` |
| MySQL / docker / 浏览器 / git 网络 / gh 写 | 无 | 端点级真机 200 与提交/推送/PR 由凌舟执行 |

### 沙箱适配跑法（`spawn EPERM` 的绕行，仅用于取证据，**不是 CI 口径**）

复用 C6-1A 遗留的**未改动**垫片（esbuild 假实现 + `net use` 探测降级），按 S3-111 同一手法：

```powershell
$env:NODE_OPTIONS = "--import file:///D:/Users/ZXQL/wt-agents/issue-129/docs/evidence/C6-1A/sandbox-vitest/register-hook.mjs"
cd saas-admin
npx vite build --configLoader runner --minify false --outDir "$env:TEMP\s3115\dist2" --emptyOutDir
```

凌舟本机 / CI 的**标准命令**（无沙箱限制）：

```powershell
cd D:\Users\ZXQL\wt-agents\issue-129\saas-admin
npx vite build          # = CI 的 npm --workspace saas-admin run build
npx vue-tsc -b --force
cd ..
node saas-admin\scripts\check-api-paths.mjs --no-color
```

## 二、文件清单

| 文件 | 说明 |
|---|---|
| `01-check-api-paths-改后PASS.log` | 卡面③：路径比对 + 新增键位断言全 PASS，exit 0 |
| `02-vue-tsc-改前.log` | 卡面②改前基线：11 条既有错误（`npx vue-tsc -b --force`，exit 1） |
| `03-vue-tsc-改后.log` | 卡面②改后：11 条，与 `02` **逐行一致**，本单两个改动文件命中 0 条 |
| `04-check-api-paths-反测a-RED.log` | 卡面④a 造红：脚本可见处注入不存在路径 ⇒ FAIL + exit 1（指名文件:行号） |
| `05-check-api-paths-反测a-还原PASS.log` | 卡面④a 还原：删除注入文件 ⇒ PASS + exit 0 |
| `06-check-api-paths-反测b-键位RED.log` | 卡面④b 造红：body 键改回 `reply` ⇒ 键位断言变红 + exit 1（2 条） |
| `07-check-api-paths-反测b-还原PASS.log` | 卡面④b 还原：改回 `replyContent` ⇒ 转绿 + exit 0，且 **SHA256 与反测前完全一致** |
| `08-vite-build-标准命令-沙箱EPERM.log` | 卡面①标准命令在本沙箱的原始失败输出（exit 1，非代码问题） |
| `09-vite-build-沙箱适配壳-exit0.log` | 沙箱适配壳下 vite 全量产物（含 `PlatformReviews-IO-NDrIg.js 25.98 kB`），`✓ built in 28.28s`，exit 0（**不等于 CI 口径**） |
| `10-rg-零静默失效判据.log` | 卡面⑤：`rg -n "platformName\|reviewType\|keyword\|status"` 两个文件的全部命中（17 条，逐条说明见回传卡 §四） |
| `11-vue-tsc-改前改后对比.log` | 卡面②判据：`Compare-Object` 差异 0 行、改前 11 = 改后 11、本单文件 0 条 |
| `12-工作区状态与哈希.log` | 分支 / HEAD / `git status` / `git diff --stat` / 三个改动文件 SHA256 |

## 三、本单未覆盖 / 需凌舟或 CI 复跑的部分

1. **卡面标准命令 `npx vite build`**：沙箱无带管道子进程能力 ⇒ 未通过（`08`）；沙箱适配壳 exit 0（`09`）不能替代 CI 口径，请在本机或 CI 跑 `npm --workspace saas-admin run build`。
2. **端点级真机验证**（空表 `GET /api/platform/reviews` = 200 `records: []`、`/stats` = 200 `stats: []`、`POST /reviews/:id/reply` body `{replyContent}` = 200）：沙箱无库无服务，未执行。
3. **提交 / 推送 / PR / 门禁**：按派单卡纪律由凌舟执行（本工作区仅 3 个文件 M + 本证据目录未跟踪）。
