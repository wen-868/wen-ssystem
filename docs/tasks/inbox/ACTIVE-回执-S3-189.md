# ACTIVE 回执 · S3-189（门禁三处精度收口：G3 逐条 `auth:` 声明 / G2 域清单去硬编码 / 抽 `guard-route-prefix`）

> 汇报对象：**凌舟（总负责人）**
> 汇报人：**阿坚（后端 · 本地子代理通道执行）**｜日期：**2026-10-14**
> 对应派单：`docs/tasks/inbox/ACTIVE-S3-189.md`（含 00:20 追加指令）→ 已移入 `docs/tasks/inbox/archive/ACTIVE-S3-189-20261014.md`
> 工作区：`D:\Users\ZXQL\wt-agents\S3-189`｜分支 `chore/s3-189-gate-precision`｜基线 `origin/main` = `f161a448`｜**本地提交 `4aa845b1` + `a94e0891`（未 push、未开 PR）**
> 十项完整版回传卡：`docs/tasks/cards/R101-S3-189-阿坚-回传.md`（工作树内已随提交入库）｜证据目录：`D:\Users\ZXQL\wt-agents\_s3189-evidence\`
> ⚠️ 本回执只写执行方的事实与**请求**，不含任何「凌舟裁定 / 验收结论」字样。

## 一、一句话结论

三件交付物全部落地并逐项反测：**G2 / G36 在当前 main 上 `EXIT=0`**；**G3 升级后新暴露 2 处真缺口**（`notification.routes.ts:23/24` 有认证无 CSRF）⇒ **G3 当前 `EXIT=1`**；补 2 行 `csrfMiddleware` 即三绿（已预验证、已 byte-exact 复原，**未改业务路由**）。全量 `vitest` **648 files / 7673 tests / 0 failed**、`tsc --noEmit` **0**、`npm run build` **0**。

## 二、改了什么（8 个文件）

| 文件 | 性质 |
|:--|:--|
| `backend/src/shared/route-prefix-rules.js` | **新增**：白名单 + 判据的唯一一份（纯 ESM `.js`、零 import；放 `src/` 为随 `dist/` 上生产） |
| `backend/src/shared/route-prefix-rules.d.ts` | **新增**：类型声明 |
| `backend/src/shared/auto-routes.ts` | **改**：删本地白名单/`joinRoutePath`，改调共享模块；`inspectRouteHygiene` 改为"运行期栈 → 入口数组 → `classifyRoutePrefixes`" |
| `backend/scripts/guard-route-prefix.mjs` | **新增**：独立门禁（静态扫描 + 同一判据函数），`--json`、退出码 0/1 |
| `backend/scripts/guard-route-auth.mjs` | **改**：`collectAuthDecls()` 逐条读 `auth:` 声明（R1/R2 都逐条判定、违规指到条）；补登记 3 条盲区文件 |
| `backend/scripts/guard-tenant-status.mjs` | **改**：加 R3「漏登检测 + 对照表」（机械信号扫 `src/**` + `SIGNAL_EXEMPT` 台账逐条理由） |
| `backend/tsconfig.json` | **改**：`allowJs` + `include` 显式点名那一个 `.js` |
| `backend/src/__tests__/shared/route-prefix-rules.test.ts` | **新增**：共享判据 9 例单测 |

## 三、证据（原始日志目录 `_s3189-evidence\`）

- ① 两侧反测：`07a-mutation-old.log`（**旧判据对夹具 B 完全不红**——真盲区是 `auth:"none"` 不在第一条）／`07b-mutation-new.log`（新判据红，6 条）；`06-g3-before-register.log` → `06-g3-after-register.log`（5 条 → 2 条）。
- ② 对照表 + 反测：`05-g2-green.log`（7 个信号文件：清单内 2 / 登记豁免 5 / **漏登 0**，逐条理由含"登记≠合规"）、`08c-g2-mutation.log`（域外文件写租户状态 ⇒ **红**）。
- ③ 两组反测 + 一致性：`08a-…unlisted.log`（未登记重复前缀 ⇒ 红）、`08b-…dup-endpoint.log`（**白名单前缀内的真重复端点 ⇒ 红**）、`03-prefix-green.log`（复原 ⇒ 绿）；一致性 = 同一份白名单（`route-prefix-rules.js:29`）+ 同一个函数（`classifyRoutePrefixes`）+ 数字一致（脚本 189 文件 / 203 条注册 ↔ 启动期冻结基线 `EXPECTED_FILES=189`、`EXPECTED_REGISTRATION_COUNT=203`，且全量日志含 `已自动注册 203 个路由`）。
- 运行期/构建：`10-build.log`（`dist/shared/route-prefix-rules.js` 已进产物、`auto-routes.js` 的 import 已补 `.js` ⇒ 生产只同步 dist 也拿得到）、`11-vitest-full.log`、`12-tsc.log`、`09-proposed-fix-g3.log`（补 2 行 ⇒ G3 `EXIT=0`，随后复原 sha256 `417F6E0B…`）。

## 四、需要凌舟处置（**请求，不是裁定**）

1. **G3 的 2 处 CSRF 缺口**（`notification.routes.ts:23/24`）：本单按卡 §四.6「不得顺手改业务路由」未修。请择一：(A) 授权本单顺带补 2 行（已预验证三绿）；(B) 另立单——但 G3 是 CI 阻断步骤，未修则本单**不能合并**。另：把 miniapp 分支改声明式为更干净根治，同属改业务路由。
2. **G2 新发现 4 个"写租户状态"文件**（`subscription-expiry` / `tenant-register` / `saas/tenant` / `platform/tenant-admin`）：现以"登记豁免 + 逐条理由"落账（登记≠合规）。其中两处口径问题需定：① `subscription-expiry.service.ts:93` 直接写 `'EXPIRED'`（与"可写值仅 ACTIVE/DISABLED、EXPIRED 由 expire_at 派生"冲突）；② `saas/tenant.service.ts:265` 接口**接受** `SUSPENDED` 入参。若要收编进 R1 域，须先把 R1 从"带引号即命中"细化为"语句级/表级"（否则这 4 个文件里**别的表**的合法字面量会被误伤）。
3. **与 S3-187 的合并冲突预告**：S3-187 在 `auto-routes.ts` 白名单加了 `/api/store/coupons`；本单白名单已搬到 `src/shared/route-prefix-rules.js` ⇒ 两单合并时该区域必冲突；若 S3-187 先合，把该条目（含理由）补进新共享文件即可。

## 五、未完成与阻塞

**无阻塞**（依赖/沙箱/权限正常，未触发 `BLOCKED.txt`；`_s3189-evidence/STATUS.md` 是回应 00:20 追加指令的进度留痕）。未完成仅 §四.1 一条（需授权）。

## 六、风险与自我报备

1. **R1 的钝刀性质未改**：本单只解决"域清单对扩张无感"，没动 R1 的"带引号即命中"口径（改口径会影响既有 4 个文件，属另一件事）——这正是 4 个新发现文件暂列"登记豁免"而非收编的直接原因。
2. **我自己的一处越界动作（如实报备）**：开工初期我未拿到卡、误判身份，曾把 S3-187 的工作树当作验收对象跑过一次**只读**全量 vitest 并留了日志（`agents-logs/s3187-accept-vitest.log`），发现后**立即停止并杀掉进程**；全程未写、未 push、未开 PR、未碰他人分支。
3. **路由器的陈旧指针**：本单按卡 §六 已把卡移入 archive，`docs/tasks/inbox/ACTIVE.md`（凌舟维护）里那条指向仍是旧路径，请一并更新。
4. 关联卡：收口总清单第 **21 / 22 / 36** 项；同族 S3-179（启动期阻断）、S3-177/S3-178（CSRF 成对补齐）。

## 七、环境复原

- 3 个反测夹具（`src/routes/_s3189-fixture-{a,b,p1,p2}.routes.ts`、`src/services/_s3189-fixture-tenant-writer.ts`）与临时比对夹具 `scripts/_s3189-parity.mts`、旧版脚本副本 `scripts/_s3189-old-guard.mjs` **全部已删除**；`src/routes` 回到 **189** 个文件（与启动期基线一致）。
- 未做任何生产/数据库写操作；未 push；未开 PR；工作树内 `node_modules` 为指向主仓的 junction（复用依赖，未改主仓依赖）。
