# C2-4 独立验证证据包（执行：苏然 · 测试/QA · 本地通道代执行）

对象：`docs/tasks/cards/R101-派单-20260923-C2.md` 第四段【派单 C2-4】。
回传卡：`docs/tasks/cards/R101-C2-4-苏然回传.md`。
只读核验：**未改动 `backend/**`、`saas-admin/**` 任何产品代码**；本目录全部为新增证据文件。

## 一、怎么复跑（每条命令都可原样重放，均在本仓库根执行）

| 编号 | 工具 | 复跑命令 | 退出码语义 |
|---|---|---|---|
| 00 | `tools/c2-4-00-run-all.ps1` | `pwsh -File docs/evidence/C2-4/tools/c2-4-00-run-all.ps1` | 一键按顺序跑 00–03，逐条打印退出码，落盘 `outputs/00-run-all.txt` |
| 04 | `tools/c2-4-04-pending-count.ps1` | `pwsh -File docs/evidence/C2-4/tools/c2-4-04-pending-count.ps1` | 无（只输出读数） |
| 01 | `tools/c2-4-01-static-diff.mjs` | `node docs/evidence/C2-4/tools/c2-4-01-static-diff.mjs --json docs/evidence/C2-4/outputs/01-static-diff-baseline.json` | 0=全一致；1=有不一致 |
| 01b | `tools/c2-4-01b-cross-file-shadow.mjs` | `node docs/evidence/C2-4/tools/c2-4-01b-cross-file-shadow.mjs` | 0=目标由专门 handler 命中；1=被通配吞 |
| 02 | `tools/c2-4-02-falsify.mjs` | `node docs/evidence/C2-4/tools/c2-4-02-falsify.mjs` | 0=反测全部达预期；1=有反测未达预期 |
| 03 | `tools/c2-4-03-runtime-probe.mjs` | `node docs/evidence/C2-4/tools/c2-4-03-runtime-probe.mjs`（反测：末尾加 `--selftest`） | 0=断言全通过；1=有断言不通过 |
| 05 | `tools/c2-4-05-migration-parse.mjs` | `node docs/evidence/C2-4/tools/c2-4-05-migration-parse.mjs` | 0=171 会被 runner 执行；1=不通过 |
| 06 | `tools/c2-4-06-doc-axis.mjs` | `node docs/evidence/C2-4/tools/c2-4-06-doc-axis.mjs` | 0=契约文档轴一致；1=有差异 |

## 二、沙箱约束（为什么和"常规做法"不同）

1. **`tsx` 不可用**：`npx tsx …` 直接报 `Error: spawn EPERM`（`tsx/node_modules/esbuild/lib/main.js:2272 ensureServiceIsRunning`）——
   tsx 依赖 esbuild 的常驻服务**子进程**，本沙箱禁止 `node` 的 `child_process.spawn`。
   ⇒ 改用 `tools/c2-4-ts-loader.mjs`：node 自带的 ESM loader + **TypeScript 编译器 API 单文件转译**（进程内，零子进程）。
   冒烟证据：`node docs/evidence/C2-4/tools/c2-4-ts-loader-smoke.mjs` ⇒ `SMOKE_OK …`。
   （注意：`module.stripTypeScriptTypes` 的 `strip`/`transform` 两种模式都会保留 `import { …, Row }` 这类值与类型混写的具名导入，
   运行期报 `does not provide an export named 'Row'`；TS 编译器单文件转译会做导入消除，故采用后者。）
2. **反测不能靠"另起子进程跑检测器"**：同因（`spawnSync node.exe EPERM`，上一轮 6 项反测全部 `exit=-1` 即此）。
   ⇒ `tools/c2-4-lib.mjs` 把检测算法导出为函数（`analyzeStaticDiff` / `analyzeCrossFile`），
   01/01b 是薄 CLI，02 反测在**同一进程内**指向临时副本复用**同一份算法**（算法未削弱）。

## 三、文件清单与"证据边界"

| 文件 | 内容 | 证据边界 |
|---|---|---|
| `outputs/01-static-diff-baseline.txt/.json` | 后端 `routeConfig` 反推端点集（18=10+8）× 前端 api 模块调用集（18）双向差集 | 纯静态源码分析，不含运行期行为 |
| `outputs/01-static-diff-rerun.txt` | 同一命令重跑，`Compare-Object` 与 baseline **差异 0 行**（可复现性证据） | 同上 |
| `outputs/01b-cross-file-shadow.txt/.rerun` | 全仓 176 个路由文件按文件名升序挂载的顺序模拟，判定 `GET /api/platform/announcements/templates` 归属 | 离线模拟 express 命中顺序，非真实请求 |
| `outputs/02-falsify.log` / `02-falsify-stdout.txt` | 反测：副本原样（绿）+ 4 个改坏场景（必须红）+ 每处还原后（必须回绿）+ 1 条检出边界记录 | 改坏只发生在 `%TEMP%` 副本，仓库文件零改动 |
| `outputs/03-runtime-probe.txt/.json` | **真起** express（`app.listen(0,127.0.0.1)`）+ 真 HTTP：mock 封条、18 条无令牌 401、5 读端点 200 空态、5 条非法参数 400、CSRF 403/放行、`/templates` 未被 `/:id` 吞、运行期路由表内省 | `NODE_ENV=test` + `USE_MOCK_DB=true` + 自签令牌；mock 库**不落真数据**，不能作"真库/生产行为"证据 |
| `outputs/03-runtime-probe-selftest.txt/.json` | 反测：注入 1 条故意错误的预期，断言探针**会红** | 同上 |
| `outputs/04-pending-count.txt` | `待接入` 计数：口径 A（`TODO\|FIXME\|待接入` 行数）与口径 B（`待接入` 出现次数），范围 saas-admin 及两个目标文件，取 `4217ee30e^` / `4217ee30e` / `HEAD` 三个提交 | 用 `git grep` 读历史提交内容，工作区未改 |
| `outputs/05-migration-parse.txt/.json` | 复演 `migration.ts:894-931` 的语句切分规则，判定 171 是否真会被执行；并全量扫描 172 个 SQL 文件 | **语义级复演**，非真库执行；全量扫描只说明"该文件块会被丢弃"，不代表表一定不存在（可能有其它建表路径） |
| `outputs/06-doc-axis.txt` | 第二轴：`docs/API接口文档.md` §模板中心 12 端点 ⇒ 后端实现；前端 18 条方法 ⇒ 契约方法 | 文档口径源为契约文档；清账卡清单仅作告知性对照 |
