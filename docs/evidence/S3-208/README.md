# S3-208 证据包：第 57 项 CodeQL 23 条 high 逐条定性

> 任务卡：`docs/tasks/inbox/ACTIVE-S3-208.md`（派单人：凌舟｜2026-10-15）
> 工作树：`wt-agents/S3-208`｜分支：`chore/s3-208-codeql-triage`｜基线：`origin/main` = `2fe8f109`
> 本目录所有 JSON/日志均为**原始读取**，未经改写；命令都可复跑。

## 一、对象与口径（先钉住"23 条"是什么）

| 项 | 值 | 证据 |
|:--|:--|:--|
| 23 条的来源 | PR #297 的 check-run `115404340298`（name=`CodeQL`，conclusion=`failure`），head=`67f178e198e3b60b291878370002e1e8e80b067b` | `pr297-annotations-raw.json`（`gh api repos/wen-868/wen-ssystem/check-runs/115404340298/annotations`）；`gh pr view 297 --json headRefOid` |
| 23 条构成 | ① **11 条**「route handler performs authorization, but is not rate-limited」＝`js/missing-rate-limiting`；② **12 条**「This path depends on a user-provided value」＝`js/path-injection` | 同上（23 条注解逐条见 `pr297-annotations-raw.json`） |
| 12 条是否在 PR #297 改动面内 | **否**。PR #297 改动 21 个文件（含 3 个路由文件），**不含** `avatar.controller.ts` / `product-image.controller.ts` / `miniapp-upload.service.ts` / `shared/zip.ts` | `gh api .../pulls/297/files` |
| 11 条是否在 PR #297 改动面内 | **是**。恰好落在 `wechat.routes.ts` / `marketing-miniapp.routes.ts` / `commerce-fix.routes.ts`（PR #297 = S3-187 的路由契约修复，正是给这些行加鉴权的那次改动） | 同上 |
| main 现状（`2fe8f109`） | code scanning **open 186 条**＝`js/missing-rate-limiting` **141** ＋ `js/path-injection` **12** ＋ 其它 33 | `alerts-raw.json`（`gh api .../code-scanning/alerts?state=open`，186 条） |

**结论先行**：11 条 `missing-rate-limiting` 属"该限流的"⇒ 本次**接线**；12 条 `path-injection` 属"误报"（判定见 §四）⇒ 需**逐条排除**，但卡面指定的机制（在 CodeQL 配置里按"查询 + 路径"排除）**在 CodeQL 配置 schema 里不存在**（§五，含官方文档原文）⇒ 本单**没有动 `.github/**`**，改为把逐条理由、可执行的替代方案与验证指令一并交出，请凌舟裁定。

## 二、11 条 `js/missing-rate-limiting` 逐条台账

行号三列并列，便于逐条核对（PR 时点行＝注解行；main 行＝当前 `2fe8f109`；接线后行＝本次工作树）：

| # | PR 注解（文件:行） | PR 时点该行内容（`67f178e1`） | main `2fe8f109` 该行内容 | 路由 | 判定 | 处置 |
|:--:|:--|:--|:--|:--|:--|:--|
| 1 | `wechat.routes.ts:26` | `POST /auth/decrypt-phone` | 同行（现 26） | `POST /api/miniapp/wechat/auth/decrypt-phone` | **该限流** | 注册点内联 `rateLimit(AUTHED_ROUTE_LIMIT)` ✅ |
| 2 | `wechat.routes.ts:26`（同行第 2 条） | 同上 | 同上 | 同上 | **该限流** | 同上（一条路由=一个限流器，2 条注解同点消解）✅ |
| 3 | `wechat.routes.ts:27` | `PUT /auth/profile` | 同行 | `PUT /api/miniapp/wechat/auth/profile` | **该限流** | ✅ |
| 4 | `wechat.routes.ts:28` | `GET /auth/profile` | 同行 | `GET /api/miniapp/wechat/auth/profile` | **该限流** | ✅ |
| 5 | `wechat.routes.ts:29` | `POST /auth/bind` | 同行 | `POST /api/miniapp/wechat/auth/bind` | **该限流** | ✅ |
| 6 | `wechat.routes.ts:30` | `POST /auth/unbind` | 同行 | `POST /api/miniapp/wechat/auth/unbind` | **该限流** | ✅ |
| 7 | `marketing-miniapp.routes.ts:55` | `POST /coupons/:templateId/claim` | 现 61 行 | `POST /api/miniapp/marketing/coupons/:templateId/claim` | **该限流** | ✅ |
| 8 | `marketing-miniapp.routes.ts:67` | `GET /points/my` | 现 73 行 | `GET /api/miniapp/marketing/points/my` | **该限流** | ✅ |
| 9 | `marketing-miniapp.routes.ts:72` | `POST /flash-sale/:id/buy` | 现 78 行 | `POST /api/miniapp/marketing/flash-sale/:id/buy` | **该限流** | ✅ |
| 10 | `marketing-miniapp.routes.ts:80` | `POST /group-buy/:teamId/join` | 现 86 行 | `POST /api/miniapp/marketing/group-buy/:teamId/join` | **该限流** | ✅ |
| 11 | `commerce-fix.routes.ts:30` | `storeCommerceFixRouter.get("/verify-records", …)`（**门店端**，鉴权不在注册行、由本文件 `routeConfigs` 的 `auth:"requireAuthWithTenant"` 前缀级前置） | 同行（现 30） | `GET /api/store/coupons/verify-records` | **该限流** | ✅ |

同文件同族存量（不在 23 条内，但同文件同族，一并接线；数字见 §三）：

| 文件 | main 行 | 路由 | 处置 |
|:--|:--|:--|:--|
| `marketing-miniapp.routes.ts` | 62 / 74 / 90 | `GET /coupons/my`、`GET /points/my-records`、`POST /calculate` | ✅ 接线 |
| `commerce-fix.routes.ts` | 20 | `POST /api/admin/bills/:id/verify` | ✅ 接线 |
| `commerce-fix.routes.ts` | 17 | `POST /api/admin/bills` | ✅ 接线（main 的 open 列表里未见此行，见 §六"判据差异"） |
| **`wechat.routes.ts`** | **22** | **`POST /api/miniapp/wechat/auth/login`** | ❌ **故意不接线**：登录路由，业主口径"演示/商户侧登录不限流"（`server.ts:237` 注释）。它**不在** 23 条内，处置建议见 §五.3 |

**接线形态**（与 S3-112 的结论一致：`rateLimit(...)` 必须**内联在注册点**，参数集中一处）：

```
backend/src/config/rate-limit.ts          ← 新增：AUTHED_ROUTE_LIMIT（5 分钟 / 60 次 / IP，与 routes/platform-auth.routes.ts 的 MFA 管理限流同形）
backend/src/routes/wechat.routes.ts       ← 5 条注册点内联 rateLimit(AUTHED_ROUTE_LIMIT)
backend/src/routes/marketing-miniapp.routes.ts ← 7 条
backend/src/routes/commerce-fix.routes.ts ← 3 条
```

## 三、影响面数字（守恒）

| 口径 | 数字 | 来源 |
|:--|:--|:--|
| `js/missing-rate-limiting` 全仓 open（main `2fe8f109`） | **141** | `alerts-raw.json` 分组统计 |
| 其中落在本单 3 个文件内 | **16**（wechat 7 ＋ marketing 7 ＋ commerce-fix 2） | 同上 |
| 本次接线覆盖的路由 | **15**（wechat 5 ＋ marketing 7 ＋ commerce-fix 3） | `harness/codeql-missing-rate-limiting-predicate.mjs`（接线前 14 命中 → 接线后 0） |
| 本单 3 个文件内**仍**会报 | **1**（`wechat.routes.ts` 的 `/auth/login`，登录路由，故意不接） | 16 − 15 = 1 |
| 全仓**仍**受影响（属 S3-112 登记的系统性存量，本单不动） | **126** | 141 − 15 = 126 |

> 说明：15 条路由 ≠ 15 条告警一一对应（`wechat.routes.ts:26` 一行有 2 条注解，一条路由一个限流器即可消解）。
> 全仓 126 条散落在 `miniapp.routes.ts(56)`、`subscription.routes.ts(13)`、`tenant.routes.ts(7)`、`aftersale.routes.ts(6)` 等既有文件，按 `docs/tasks/派单规范.md` §8.7 判**系统性存量**，收敛项＝**S3-112**，不属本单范围。

## 四、12 条 `js/path-injection` 逐条台账（判定：误报 —— 数据流真实存在，但路径可控成分已被消解）

判定依据（可复核）：CodeQL 的 `js/path-injection` 只认它**建模过的**净化形态（`path.resolve()+startsWith`、
`is-path-inside`、`..` 过滤、白名单成员测试等——见 `codeql-TaintedPathCustomizations.qll` 中的
`RelativePathStartsWithSanitizer` / `IsInsideCheckSanitizer` / `MembershipTestBarrierGuard`）；
本仓这几处的净化是**自研函数**（`safeSegment` / `safeName` / 扩展名白名单），模型不认 ⇒ 判误报。

| # | 告警号 | 位置 | 沉入点 | 用户可控输入 | 为何不可穿越（依据） |
|:--:|:--:|:--|:--|:--|:--|
| 1 | 265 | `controllers/admin/avatar.controller.ts:44` | `fs.writeFileSync(target, …)` | `file.originalname` | 落盘名＝`${tenantId}-${userId}-${Date.now()}${ext}`；`tenantId`/`userId` 来自签名 JWT（`middleware/tenant.ts:25-29`、`requireAuthWithTenant`）；`ext=path.extname(originalname)` 且必须命中 `ALLOWED_EXT` 白名单（`.jpg/.jpeg/.png/.gif/.webp`）⇒ 用户输入对路径的唯一贡献是白名单扩展名 |
| 2 | 266 | `controllers/admin/product-image.controller.ts:41` | 同上 | 同上 | 同形代码（`ALLOWED_EXT` + 服务端 tenantId） |
| 3-10 | 267-274 | `services/admin/miniapp-upload.service.ts:132/138/146/150/153/159/168/173` | `fs.writeFileSync` / `readFileSync` / `existsSync` | `req.query.platform \|\| req.body.platform`（**确实用户可控**，见 `controllers/admin/miniapp-config.controller.ts:95`） | 落盘名＝`${safeSegment(tenantId)}-${safeSegment(platform)}.key`，`safeSegment = replace(/[^\w-]/g,"_").slice(0,64)` ⇒ `/`、`.`、`..` 不可能存活 |
| 11 | 275 | `shared/zip.ts:100` | `fs.mkdirSync(path.dirname(zipPath))` | 经调用方 `tenantId` | 唯一生产调用方＝`services/admin/miniapp-package.service.ts:140`，`zipPath = getStorageDir() + "miniapp-" + theme + "-" + safeName(tenantId) + "-" + Date.now() + ".zip"`（`safeName` 同 `safeSegment` 形；`theme` 过 `THEME_IDS` 白名单，见同文件 119-121） |
| 12 | 276 | `shared/zip.ts:168` | `fs.writeFileSync(zipPath, …)` | 同上 | 同上 |

**可执行证据（把判定钉成回归，不靠文字自述）**：`backend/src/__tests__/security/path-sanitizer-s3-208.test.ts`

1. 真实 multipart 上传 `../../../../s3-208-evil.jpg` 到头像/商品主图控制器 ⇒ 200，文件落在 `backend/storage/avatars|product-images` **内**，穿越目标位置**不产生文件**；先断言该载荷确实会穿越（naive `path.resolve` 会跑出目录）、且 `.exe` 被白名单拒成 400（反测）。
2. 真实调用 `MiniappUploadService.uploadKey("../../../../etc", "../../../../s3-208-escaped", …)`（注入临时 `MINIAPP_KEY_STORAGE_DIR`）⇒ 只在注入目录内落 2 个文件、文件名只含 `[\w-]`、目录外无文件；`keyFilePaths` 对任意穿越载荷始终把 `dirname` 压回注入目录。

## 五、为什么本单**没有**改 `.github/**`（卡面指定的机制不存在）——请凌舟裁定

### 5.1 事实：CodeQL 配置不支持"查询 + 路径"粒度

官方配置项只有两类（`gh-docs-1.html` / `gh-docs-1.txt` 全文已存本目录，来源
`https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning`）：

1. `paths` / `paths-ignore`：**按路径**排除，但排除的是**该路径上的全部查询**（不是某一条查询）；
2. `query-filters: exclude: {id|tags|problem.severity…}`：**按查询**排除，但作用于**全仓**（不是某条路径）。

文档原文（Excluding specific queries from analysis）："You can add `exclude` and `include` filters to your
custom configuration file, to specify the queries you want to exclude or include in the analysis."；
（Specifying directories to scan）："You can also exclude the files in specific directories from analysis by
adding a `paths-ignore` array."。**没有** `query-filters` + `paths` 的组合键。

⇒ 卡面"按查询 + 路径显式排除"**无法在配置里表达**；而两个可行的近似各有代价，且都触碰本项目更高优先级的红线：

| 机制 | 效果 | 代价 | 判定 |
|:--|:--|:--|:--|
| A. `query-filters: exclude {id: js/path-injection}` | 12 条全消 | **全仓**不再检任何路径穿越（上传/导出/zip/静态文件都是本仓高危面），且卡面红线写明"**不得整体 mute 该查询**" | ❌ 不用 |
| B. `paths-ignore: [这 4 个文件]` | 12 条全消 | 这 4 个文件（文件上传/密钥/打包）**全部 87 条查询**都停止扫描，比 A 更隐蔽地放大盲区 | ❌ 不用 |

### 5.2 与"排除"等价的、**不降级**的替代（任选其一，等裁定）

- **方案甲（推荐，逐条精确、零降级）**：用 GitHub 的**逐条告警排除**（alert dismissal）——它天然是"查询 + 路径 + 行"粒度、带理由与日期、可审计可撤销。清单与理由已备好：`prepared/per-alert-dismissal.md`（**本单未执行**：属对仓库安全状态的外部写入，超出"只动工作树与本分支"的授权）。
- **方案乙（根治，改产品代码，需 CodeQL 复跑验证）**：把自研净化换成 CodeQL **建模过的形态**（`path.resolve()` + `startsWith(目录 + sep)` 守卫，或 `is-path-inside`），使 12 条**真的**消失而不是被静音；依据：`codeql-TaintedPathCustomizations.qll` 的 `RelativePathStartsWithSanitizer` 明确建模该形态（文档示例见同文件注释）。代价：动 4 个文件、且**本地无法验证**（CodeQL 只能在 push/PR/schedule 触发；本单被禁止 push/开 PR）⇒ 需凌舟合并后由新 run 判定，或另派一单带反测。
- **方案丙（不推荐）**：A 或 B 的配置排除——违反"不得为转绿降级检查"（`AGENTS.md` 技术债铁律 3）。

### 5.3 登录路由（卡面"业主口径"例外）的核对结果

卡面要求"演示/商户侧登录不得加限流，须走显式排除并写明理由"。逐条核对 23 条后：**23 条里没有任何一条是登录路由**——
`server.ts:239/241` 的两条演示登录（`/api/admin/auth/login`、`/api/store/auth/login`）**根本不在告警集合内**（CodeQL 未报），
故"为其排除"无对象；本单也**未**对任何登录路由做改动。唯一相关的旁证是 `wechat.routes.ts:22`（小程序消费者登录，
main 上 alert #287，**不在 23 条内**）——按同一口径**保持不限流**，若业主确认要排除，一并列入 `prepared/per-alert-dismissal.md`。

## 六、判据差异（本地等价判据 vs 线上 CodeQL）——诚实报备

本地判据 `harness/codeql-missing-rate-limiting-predicate.mjs` 按"注册行上出现鉴权中间件 + 未内联 `rateLimit(`"扫描，
接线前命中 **14** 条、接线后 **0** 条。与线上告警的已知差异（两向都有，逐条记录而非隐藏）：

1. **线上有、本地无**：`commerce-fix.routes.ts:30`（鉴权由 `routeConfigs` 前缀级前置，不在注册行）与 `wechat.routes.ts:22`
   （鉴权在 handler 内部：登录凭据校验）。前者已按 §二 接线，后者按口径不接线。
2. **本地有、线上无**：`commerce-fix.routes.ts:17`（`POST /bills`，有 `requirePermission` 但 main 的 open 列表里没有它）——
   仍按"同文件同族"接线（多接一条无副作用）。

⇒ 本单的**权威判据仍是 CodeQL 自己**：合并后在 `main` 上跑出的新分析才是终局。验证指令见 §七。

## 七、反测与门禁

| 项 | 结果 | 证据文件 |
|:--|:--|:--|
| 静态反测：摘掉一条 `rateLimit(...)` ⇒ 判据重新报出**且只报**那一条 | ✅ PASS（`wechat.routes.ts:38 POST /auth/unbind`） | `outputs-F1-antitest-static.log` |
| 运行期反测：摘掉同一条 ⇒ 运行期用例**只红那一条**（1 failed / 14 passed） | ✅ PASS | `outputs-F1-antitest-runtime.log` |
| 接线前/后判据 | 前：14 命中（列全）／后：0 命中 | `outputs-F1-predicate-before.log` / `-after.log` |
| 运行期接线证据（15 条路由各打满 60 次 ⇒ 第 61 次 429 + `RateLimit-*` 头） | ✅ 21 passed | `backend/src/__tests__/routes/authed-route-rate-limit-s3-208.test.ts` |
| `npx vitest run` 全量（**最终树状态**复跑） | ✅ **665 文件 / 8021 用例 / 0 failed** | `outputs-gate-vitest-full-final.log` |
| `npx tsc --noEmit`（最终树） | EXIT=0 | `outputs-gate-tsc.log` / `outputs-gate-final.log` |
| guard-route-auth / guard-tenant-status / guard-route-prefix / guard-utf8-encoding | 全 EXIT=0 | 回执 |
| guard-rbac-wiring（报告 + `--strict`） | 全 EXIT=0（680 条已登记欠账，0 未登记） | 回执 |
| `npm --workspace backend run build`（最终树） | EXIT=0（`已处理 802 个 JS 文件`） | `outputs-gate-build.log` |
| `npm --workspace backend run lint` | **未跑**（本工作树只装了 backend+root 依赖，eslint 由前端 workspace 提供、未安装；CI 的 `Backend lint gate` 会在 PR 上真跑） | 回执 §五 |

## 八、文件清单

| 文件 | 说明 |
|:--|:--|
| `alerts-raw.json` | main `2fe8f109` 上 186 条 open 告警原始 JSON（`?state=open&per_page=100 --paginate`） |
| `pr297-annotations-raw.json` | PR #297 check-run `115404340298` 的 23 条注解原始 JSON |
| `harness/codeql-missing-rate-limiting-predicate.mjs` | 本地等价判据（支持 `--git-ref` 跑接线前状态） |
| `harness/antitest-remove-rate-limit.mjs` | 静态反测（在副本上摘限流，不动工作树） |
| `outputs-F1-*.log` | 判据前/后、静态反测、运行期反测的原始输出 |
| `outputs-gate-vitest-full-final.log` | 全量单测**最终树**原始输出（665 文件 / 8021 用例 / 0 failed） |
| `outputs-gate-final.log` | 最终树的 tsc ＋ 5 条 guard 逐条 EXIT 码 |
| `outputs-gate-build.log` / `outputs-src-sha256.txt` | backend build 原始输出 ／ 6 个改动文件的 SHA256 前 16 位（供并行会话核对读数） |
| `gh-docs-1.*` / `gh-docs-2.*` | CodeQL 配置项官方文档原文（中文环境中抓取，用于 §5.1 的引用） |
| `codeql-TaintedPath.ql` / `codeql-TaintedPathCustomizations.qll` | `js/path-injection` 查询与其净化模型的官方源码（用于 §四 判定依据与方案乙） |
| `prepared/per-alert-dismissal.md` | 方案甲的逐条排除清单（含理由/日期），**未执行** |
