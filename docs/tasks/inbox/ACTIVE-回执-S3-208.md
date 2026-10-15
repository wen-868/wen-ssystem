# 回执 · S3-208（第 57 项：CodeQL 23 条 high 逐条定性）

> 派单卡：`docs/tasks/inbox/archive/ACTIVE-S3-208-20261015.md`（派单人：凌舟｜2026-10-15）
> 工作区：`D:\Users\ZXQL\wt-agents\S3-208`｜分支 `chore/s3-208-codeql-triage`｜基线 `origin/main` = `2fe8f109`（未提交、未 push、未开 PR）
> 证据包：[`docs/evidence/S3-208/README.md`](D:/Users/ZXQL/wt-agents/S3-208/docs/evidence/S3-208/README.md)（台账 ＋ 装置 ＋ 反测 ＋ 原始 JSON/日志）
> 汇报人：阿坚（后端/CI）｜2026-10-15

## 一、结论摘要

1. **11 条 `js/missing-rate-limiting` 已逐条接线**：3 个文件、**15 条路由**（11 条注解含 1 条门店端 `routeConfigs` 前缀级鉴权路由 ＋ 同文件同族 4 条）在注册点内联 `rateLimit(AUTHED_ROUTE_LIMIT)`；参数集中在新增的 `backend/src/config/rate-limit.ts`（5 分钟 / 60 次 / IP，与 `routes/platform-auth.routes.ts` 既有路由级限流同形）。
2. **12 条 `js/path-injection` 逐条判定为误报（数据流真实、路径可控成分已被消解），但没有按卡面执行"配置排除"——因为该机制不存在**：CodeQL 配置只支持"按查询（全仓）"或"按路径（全查询）"两种粒度，**没有**"查询 + 路径"。两个近似都会降级扫描（其一正是卡面红线"不得整体 mute 该查询"）⇒ 本单**未动 `.github/**`**，改为交出逐条理由 ＋ 两个不降级方案（含可执行的替代命令）等凌舟裁定。详见 §二、§四。
3. **登录路由例外已逐条核对**：23 条里**没有**任何一条是登录路由（`server.ts:239/241` 两条演示登录根本不在告警集合内）⇒ 本单未对任何登录路由加限流，也未为此做排除。main 上另有 `wechat.routes.ts:22`（消费者小程序登录，#287，**不在 23 条内**）同判**不接线**。
4. 门禁（**最终树状态复跑**；首轮全量跑与我最后一处接线在时间上重叠，故全部重跑）：全量 `vitest run` **665 文件 / 8021 用例 / 0 failed**；`tsc --noEmit` **0**；4 条 guard ＋ `guard-rbac-wiring --strict` **EXIT=0**；`npm --workspace backend run build` **EXIT=0**。反测两侧（静态判据、运行期用例）均已做，且能红。

## 二、交付物

| # | 文件 | 性质 |
|:--:|:--|:--|
| ① | `backend/src/config/rate-limit.ts`（新增，30 行） | 路由级限流参数（只提供 options，调用方必须内联 `rateLimit(...)`——S3-112 的 CodeQL 可见性硬要求） |
| ② | `backend/src/routes/wechat.routes.ts`（+13/−5） | 5 条注册点内联限流（PR #297 注解 26/26/27/28/29/30 → 5 条路由） |
| ③ | `backend/src/routes/marketing-miniapp.routes.ts`（+15/−7） | 7 条注册点内联限流（注解 4 条 ＋ 同文件同族 3 条） |
| ④ | `backend/src/routes/commerce-fix.routes.ts`（+13/−3） | 3 条注册点内联限流（注解第 30 行＝门店端 `GET /verify-records` ＋ 同文件同族 `POST /bills`、`POST /bills/:id/verify`） |
| ⑤ | `backend/src/__tests__/routes/authed-route-rate-limit-s3-208.test.ts`（新增，16 用例） | **运行期**接线证据：15 条路由各打满 60 次 ⇒ 第 61 次 429 ＋ `RateLimit-*` 头；含"用例数 ≥ 15"防空转 |
| ⑥ | `backend/src/__tests__/security/path-sanitizer-s3-208.test.ts`（新增，9 用例） | 12 条 path-injection **误报判定的可执行回归**（真实 multipart 穿越上传 / 真实 `uploadKey` 穿越载荷 ⇒ 只落目标目录内；含 `.exe` 反测） |
| ⑦ | `docs/evidence/S3-208/**` | 证据包：README（23 条台账 ＋ 影响面守恒 ＋ 配置机制证据 ＋ 验证指令）、判据装置、反测脚本、原始 JSON/日志、`prepared/per-alert-dismissal.md` |
| ⑧ | **`.github/**`：未改** | 附证据（官方文档原文落盘）＋ 替代方案 ⇒ 见 §四 |

## 三、证据（可复跑）

1. **23 条的来源**：`gh api repos/wen-868/wen-ssystem/check-runs/115404340298/annotations` ⇒ 23 条（11 ＋ 12），原始 JSON：`docs/evidence/S3-208/pr297-annotations-raw.json`；`gh pr view 297 --json headRefOid` = `67f178e198e3b60b291878370002e1e8e80b067b`。
2. **12 条不在 PR 改动面内**（＝卡面"基线陈旧"成立）：`gh api .../pulls/297/files` 的 21 个文件不含 `avatar.controller.ts`／`product-image.controller.ts`／`miniapp-upload.service.ts`／`shared/zip.ts`。
3. **接线前/后判据**（本地等价判据 `harness/codeql-missing-rate-limiting-predicate.mjs`，支持 `--git-ref`）：
   - 接线前：`node … --git-ref HEAD --repo <wt>` ⇒ **14 命中**（列全：wechat 26-30、marketing 61/62/73/74/78/86/90、commerce-fix 17/20），EXIT=1（`outputs-F1-predicate-before.log`）；
   - 接线后：**0 命中**，EXIT=0（`outputs-F1-predicate-after.log`）。
4. **反测（两侧，均 PASS）**：
   - 静态：在副本上摘掉 `wechat.routes.ts` 的 `/auth/unbind` 的 `rateLimit(...)` ⇒ 判据重新报出**且只报**那一条（`outputs-F1-antitest-static.log`）；
   - 运行期：同一条摘掉后跑用例 ⇒ **1 failed / 14 passed**（只红那一条），复原后 16 passed（`outputs-F1-antitest-runtime.log`）。
5. **影响面守恒**：`js/missing-rate-limiting` 全仓 open **141**；本单 3 文件内 **16**（wechat 7 ＋ marketing 7 ＋ commerce-fix 2）；本次接线覆盖 **15** 条路由；文件内**仍**会报 **1**（`wechat.routes.ts:22` 登录，故意不接）⇒ **16 − 15 = 1**；全仓仍受影响 **141 − 15 = 126**（属 S3-112 系统性存量，本单不动）。
6. **门禁原始输出（最终树）**：`outputs-gate-vitest-full-final.log`（`Test Files 665 passed` / `Tests 8021 passed`）、`outputs-gate-final.log`（tsc ＋ 4 条 guard 逐条 EXIT=0 ＋ `--strict` EXIT=0）、`outputs-gate-build.log`（EXIT=0）；6 个改动文件的 SHA256 前 16 位见 `outputs-src-sha256.txt`（防"并行会话改了同一棵树"导致读数不可信）。**说明**：首轮全量（19:36 起）与我最后一处接线（门店端 `GET /verify-records`）时间重叠，故 19:43 起在最终树上**全部重跑**；旧日志已删除，避免两份读数混淆。

## 四、未完成与阻塞（逐条）

1. **12 条 `path-injection` 的"排除"未按卡面字面完成，阻塞点为机制不存在**：官方配置项只支持 `paths`/`paths-ignore`（按路径 ⇒ 排除该路径上**全部**查询）与 `query-filters: exclude:{id}`（按查询 ⇒ 作用于**全仓**），**没有** "查询 + 路径" 组合键。文档原文已落盘（`gh-docs-1.txt`）。两个近似分别等价于"全仓不检路径穿越"（＝卡面红线"不得整体 mute 该查询"）与"4 个上传/密钥/打包文件全查询停扫"⇒ **我选择不动配置**，把逐条理由与两个不降级方案一并交出，请凌舟裁定：
   - **方案甲（推荐）**：GitHub 逐条告警排除（天然"查询 + 路径 + 行"粒度，带理由/日期，可撤销）——命令与逐条理由已备好：`documents/evidence/S3-208/prepared/per-alert-dismissal.md`；**我未执行**（属对仓库安全状态的外部写入，超出"只动工作树与本分支"的授权）。
   - **方案乙（根治）**：把自研净化（`safeSegment`/`safeName`/扩展名白名单）换成 CodeQL 建模过的形态（`path.resolve()` + `startsWith(目录+sep)`），使 12 条**真的**消失；依据＝官方查询源码 `codeql-TaintedPathCustomizations.qll` 的 `RelativePathStartsWithSanitizer`。代价：动 4 个文件，且**本地无法验证**（CodeQL 仅 push/PR/schedule 触发，本单被禁止 push 与开 PR）⇒ 需另派带反测的一单。
2. **`npm --workspace backend run lint` 未跑**：本工作树只装了 `backend` ＋ root 依赖（`npm ci --legacy-peer-deps --workspace backend --include-workspace-root`），eslint 由前端 workspace 提供、未安装。CI 的 `Backend lint gate (zero error)` 会在 PR 上真跑；如需我本地复跑，需装全量根依赖（约 2 分钟）。
3. 本单**未提交、未 push、未开 PR**（按卡面红线）；`.github/**` 未改（§四.1）。

## 五、风险与自我报备

1. **判据差异（两向都记，不隐藏）**：本地判据按"注册行上有鉴权中间件 ＋ 未内联 `rateLimit(`"扫描，与线上 CodeQL 有两处不同：① 线上报了 `commerce-fix.routes.ts:30`（鉴权由 `routeConfigs` 前缀级前置，不在注册行）与 `wechat.routes.ts:22`（鉴权在 handler 内），本地判据不报——前者已接线、后者按口径不接；② 本地判据报了 `commerce-fix.routes.ts:17`（`POST /bills`）而 main 的 open 列表里没有它——仍按同族接线（多接一条无副作用）。**终局判据仍是合并后 CodeQL 自己**。
2. **超出卡面 §二 字面范围的 3 处新增**（均服务于"让证据可复跑"，请审）：① 新增 `config/rate-limit.ts`（卡面说"接上项目现成的限流器"，但仓内没有可复用的**路由级** options 模块：`server.ts` 的 `buildRateLimitOptions` 是私有的且被路由文件导入会成环；`middleware/login-fail-limiter.ts` 只服务登录失败计数）② ＋ ③ 两个测试文件（卡面要求"CodeQL 告警消失 ＋ 反测"，在被禁止 push/PR 的前提下，运行期用例是唯一能自证的形态）。
3. **行为变化（非纯注释改动）**：15 条路由新增 5 分钟 / 60 次 / IP 的限流；其中 8 条是 GET 只读（`/auth/profile`、`coupons/my`、`points/my`、`points/my-records`、`verify-records` 等）。阈值参照既有路由级限流（`platform-auth.routes.ts` 的 MFA 管理限流 60/5min），正常使用远低于阈值，但属**可观测的行为变化**。
4. **限流存储**：路由级限流沿用 `express-rate-limit` 默认 MemoryStore（与 `routes/platform-auth.routes.ts` 既有写法一致）；多进程部署下各进程独立计数（`server.ts` 的全局限流才用 RedisStore）。本次**未**扩大这一既有差异，仅报备。
5. **未执行任何外部写入**：告警排除（方案甲）、push、PR 一律未做。
6. **`docs/tasks/inbox/ACTIVE.md`（多卡路由表）本单未改**：它是凌舟的维护对象，且当前主仓该文件为「已修改未提交」状态、含并行会话在途内容；为避免互相覆盖，我只归档了自己的卡（`archive/ACTIVE-S3-208-20261015.md`）＋ 落回执与回传卡。

## 六、下一步（供凌舟）

1. 裁定 §四.1 的方案甲／乙（甲＝我可立即交执行清单；乙＝另派一单，需 CodeQL 复跑验证）。
2. 合并本分支后在 `main` 上取一次新 CodeQL run 作终局验证：本单 3 个文件的 `js/missing-rate-limiting` 应从 16 降到 **1**（仅剩登录路由），PR 检查的 23 条注解应从 23 降到 **12**（余 12 条为待裁定的 path-injection）。
3. 若要我在本地补跑 `lint`，告知即可（需装全量根依赖）。

## 七、关联

- 派单卡（已归档）：`docs/tasks/inbox/archive/ACTIVE-S3-208-20261015.md`
- 十项回传卡：`docs/tasks/cards/R101-S3-208-阿坚-回传.md`
- 证据包：`D:\Users\ZXQL\wt-agents\S3-208\docs\evidence\S3-208\README.md`
