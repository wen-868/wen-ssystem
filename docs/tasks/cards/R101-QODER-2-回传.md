# 【汇报 QODER-2】卡《QODER-2 · B3-1 移动端入口门，解锁后端收编》 · 结论：5 条端点登记齐（4 gated + 1 pending-code）、一致性用例可红（删登记即红并点名）、页面挂门三态成立、后端零改动 —— 已交付 · 待凌舟验收

> ⚠️ 本卡为**执行方回传**，不构成验收结论；验收读数与合并决定权在凌舟。

```
【汇报 QODER-2】QODER-2（B3-1 · 移动端入口门）登记 + 挂门 + 一致性用例已交付
汇报对象：凌舟（总负责人）
汇报人：QODER（移动端执行方，工作树 QODER-2）｜2026-10-18
交付物：见 §二
证据（可复跑）：见 §三
验收自评：见 §四
未完成与阻塞：见 §六
风险与自我报备：见 §七
回传要求：本汇报已落卡：docs/tasks/cards/R101-QODER-2-回传.md
关联卡：docs/tasks/inbox/QODER-2-B31-入口门解锁后端收编.md（派单卡，原件未动）
```

## 〇、ref（R8.2：验证目标必须可核对）

- 工作树 `D:\Users\ZXQL\wt-agents\QODER-2`｜分支 `feat/qoder-2-appmobile-entry-gates`
- **基线偏离（主动交代，见 §七.1）→ 已按裁定③收敛**：任务书写基线 `origin/main`；起基时为 QODER-1 尖端 `10b1e879`（栈式），
  原因=卡 2 判据（vue-tsc 0 新增 / 一致性用例 / test-gate）依赖卡 1 的门禁 harness，这正是卡 1 回传 §八 的建议口径。
  **2026-10-18 验收后已 rebase 到卡 1 口径收敛尖端 `ce52ca66`**（裁定①②落地 commit），rebase 重写哈希：
  实现提交现为 **`5958cdc2f25a7551a338a7d5ffc0e78f5f16f7c8`**（6 文件，354+/18-；原 `bc5d1beb` 已被替换，内容零差异）；
  合并态复跑读数见 `docs/evidence/qoder-2/口径收敛/post-rebase-*.log`（四门 EXIT=0，tests 基线 4/27 两卡合并后一致）。
- **v3（2026-10-18）二次 rebase**：卡 1 按凌舟前置要求 rebase 到 `3fa138e7`（#363 进 main）并归零 typeCheck 基线后，本分支再栈至卡 1 新尖端 `cbca2c37`；
  三笔哈希重写：`5958cdc2`→**`859b1184f8b2fa9d8afb6460608da37458575f3c`**（实现）、`d72a2efb`→`49b8f1c5ef9ae43d85802da3440b88ec69882bc1`（回传）、`280f146b`→`4c45017cec5f0a475c64f7e79db09464c6b80831`（口径收敛）；
  合并态复跑（`docs/evidence/qoder-2/合并态复跑-v3/`）：四门 EXIT=0（**type 读数已是 0 条/基线 0 条**，裁定②收口生效）、`build:h5` EXIT=0（在 #363 新 crypto.ts 上重建）、三守卫 EXIT=0、backend diff 0 行；
  两门关键文件 SHA256 与 v2 反测复原值逐字节一致（`c12fd72d…`/`4fc160d6…`），证明 rebase 未改内容。
- 后端零改动：`git diff origin/main HEAD -- backend/` **0 行**（卡 1 + 卡 2 累计均为零）；本卡未 push、未开 PR。

## 一、一句话

售后 approve/reject/inspect/complete 四条在 `ENTRY_GATES` 由 `registered` 升级为 **`gated` + `sale:return`**（同族已落地码，不新造），
积分调整一条升级为 **`pending-code`**（码未立⇒入口按"未开通"恒隐藏，不硬挂不存在的码）；
两个页面挂上 `canEntry`，新增 12 条一致性/三态用例（含**具名待接白名单**与"后端接线后自动转绿"的机检），
S3-250 后端收编单因此拿到可枚举的「端点 ↔ 门 ↔ 码」清单——**卡上"解锁"的实质：后端接线不再会造出"前端无门可对齐"的孤儿端点**。

## 二、交付物（逐条，均在 `859b1184`（v3 rebase 后哈希；原 `5958cdc2`/`bc5d1beb`，内容零差异））

| # | 交付 | 路径 |
|:--|:--|:--|
| 1 | `EntryGate.status` 并集新增 `pending-code`（语义：码未立⇒恒隐藏、codes 必须为空；与 registered 的"放行"**有意相反**，失败关闭）；两行登记升级（详见 §三.1 对照表）；新增 `PENDING_CODE_ENTRY_IDS` / `isPendingCodeEntry` | `app-mobile/src/config/permission-gates.ts` |
| 2 | `canEntry` 对 pending-code 恒 false（短路在取码之前，持通配码也不显示） | `app-mobile/src/composables/usePermissionGate.ts` |
| 3 | 页面挂门：售后页 PENDING 动作按钮块 `&& canEntry(...)`；会员详情页「调整积分」按钮 `v-if="canEntry(...)"`（pending-code ⇒ 恒隐藏=未开通） | `app-mobile/src/pages-sub/order/order-aftersale/aftersale.vue`、`app-mobile/src/pages-sub/marketing/member/member-detail.vue` |
| 4 | 一致性/三态用例 12 条：注册表自洽不变量、gated↔后端接线逐条裁决（具名待接白名单 4 条、每条带理由与后端现场行号）、**自动转绿机检**（合成后端索引，不碰 backend 文件）、反例自检（挂错码必须点名）、三态装置（`vi.mock` 用户 store）、页面挂载点静态断言 | `app-mobile/tests/entry-gate-consistency.spec.ts` |
| 5 | test 基线 3/15 → 4/27（实测即基线，卡 1 §八 预告的预期动作） | `app-mobile/scripts/gates-baseline.json` |
| 6 | 证据（门禁/守卫/构建原始输出 + 反测日志 + SHA256） | `docs/evidence/qoder-2/**` |

### §二.1 「5 条端点登记」逐条对照（卡 §三.1 判据本体）

| # | 端点 | 门 id | 入口（entry） | 页面 | codes | status（本卡后） |
|:--|:--|:--|:--|:--|:--|:--|
| 1 | `POST /api/admin/aftersales/:id/approve` | `island-aftersale` | 售后处理页 PENDING 单「同意」按钮 | `pages-sub/order/order-aftersale/aftersale.vue` | `['sale:return']` | **gated** |
| 2 | `POST /api/admin/aftersales/:id/reject` | 同上 | 同上「拒绝」按钮 | 同上 | 同上 | **gated** |
| 3 | `POST /api/admin/aftersales/:id/inspect` | 同上 | 页面暂无对应按钮（见 §七.5） | 同上 | 同上 | **gated** |
| 4 | `POST /api/admin/aftersales/:id/complete` | 同上 | 同上 | 同上 | 同上 | **gated** |
| 5 | `POST /api/admin/members/:id/points/adjust` | `mkt-points-adjust` | 会员详情页「调整积分」按钮（按未开通恒隐藏） | `pages-sub/marketing/member/member-detail.vue` | `[]`（不许硬挂） | **pending-code** |

⚠️ 如实口径：这 5 条端点在 `ENTRY_GATES` **原已存在**（`island-aftersale`/`mkt-points-adjust` 两行，status=registered、codes=[]，
是 S3-230 批次登记的孤岛行）⇒ 本卡是**补齐/升级**（registered→gated、registered→pending-code + 页面挂载 + 一致性用例），
不是新增 5 条字面新行。逐条 id/entry/page/endpoints/codes/status 见上表。

## 三、给 S3-250（后端收编单）的「5 条码 ↔ 门 id」对照表（卡面点名交付）

| 待后端接线的端点 | 门 id | 门码 | 后端现场（本卡实测行号） | 接线动作 |
|:--|:--|:--|:--|:--|
| `POST /api/admin/aftersales/:id/approve` | `island-aftersale` | `sale:return` | `aftersale.routes.ts:49` | 注册行加 `requirePermission("sale:return")` |
| `POST /api/admin/aftersales/:id/reject` | 同上 | `sale:return` | `:51` | 同上 |
| `POST /api/admin/aftersales/:id/inspect` | 同上 | `sale:return` | `:66` | 同上 |
| `POST /api/admin/aftersales/:id/complete` | 同上 | `sale:return` | `:71` | 同上 |
| `POST /api/admin/members/:id/points/adjust` | `mkt-points-adjust` | **未立**（候选 `marketing:points` / `customer:*` / `marketing:create` 冲突待裁定） | `points.routes.ts:14`（前缀 `:32` = `/api/admin/members`） | 先裁码 ⇒ 立码后注册行挂 `requirePermission(码)` **并且**注册表该行转 `gated` 补码（用例 3 会点名"pending-code 已接线"提示这一步，防只改一半） |

- 参照锚：同文件 confirm-receipt 已挂 `sale:return`（`aftersale.routes.ts:64`）⇒ 售后 4 条接线是同族同码，零新码。
- **自动转绿口径**：一致性用例判定顺序=先看后端接线（命中即过，白名单不再参与裁决）⇒ 后端接上 `sale:return` 后
  `tests/entry-gate-consistency.spec.ts` 无需任何改动即转绿；白名单条目随门删失归属才会红（反测挂钩，见 §四.2）。
  该机制已由"合成后端索引"用例机检（不碰 backend 文件）：4 条端点模拟挂上 `sale:return` ⇒ 零违规；模拟挂 `sale:whatever` ⇒ 4 条逐一违规点名。

## 四、验收自评（逐条对照任务书 §三）

| §三 | 判据 | 自评 | 依据 |
|:--|:--|:--|:--|
| 1 | 5 条登记逐条（id/entry/page/endpoints/codes/status） | **通过**（口径=§二.1 注：系既有 registered 行的升级，非字面新行） | `permission-gates.ts` diff；用例「本卡登记」两条逐字段断言 |
| 2 | 删 1 条登记 ⇒ 一致性用例红且点名；复原逐字节一致（SHA256） | **通过**（C1：整块移除 `island-aftersale` ⇒ `npm test` EXIT=1，3 条用例红、白名单孤儿逐条点名 4 端点；复原 SHA256 `c12fd72d…` 前=后；再绿。另加 C2：摘掉 `canEntry` 的 pending-code 短路 ⇒ 恒隐藏用例红并点名该门；复原 `4fc160d6…` 前=后） | `counter/C1..C2-*.log`、`sha256-counter-tests.txt` |
| 3 | `vue-tsc` 0 新增；`build:h5` EXIT=0 | **通过**（type-gate EXIT=0：裸 12 = 基线 12；build DONE，见 `gates/build-h5.log`） | `gates/final-all-gates.log`、`gates/build-h5.log` |
| 4 | 页面级三态：持码=渲染 / 不持码=0 / 未取到=0 | **通过（口径说明见 §七.2）**：售后门逻辑装置六断言全过（持 `sale:return`/`*` ⇒ 显示；持他码/空/`null`/`undefined` ⇒ 隐藏）；页面模板静态断言（门控 v-if 存在、未门控形态已不存在、挂载点唯一）；`mkt-points-adjust` 任何权限形态（含 `*`）恒 0 | 用例「B3-1 三态装置」「B3-1 页面挂载点」 |
| 5 | `git diff origin/main HEAD -- backend/` 为空 | **通过**（0 行） | §〇 |

## 五、读数摘要（最终态四门 + 三守卫 + 构建，全在 `docs/evidence/qoder-2/`）

复跑命令（仓库根）：
```bash
npm --workspace app-mobile run type-check      # EXIT=0（12=基线12，0 新增）
npm --workspace app-mobile run lint            # EXIT=0（error 20=基线、warning 12880=基线，页面挂门未引入任何新告警）
npm --workspace app-mobile run test            # EXIT=0（4 文件 27 用例，含本卡 12 条）
npm --workspace app-mobile run check:contract  # EXIT=0（292/283/204/1498，差集 1=具名豁免 1；本卡未移动计数字段）
npm --workspace app-mobile run build:h5        # EXIT=0
node backend/scripts/guard-route-auth.mjs                      # EXIT=0
node backend/scripts/guard-evidence-secrets.mjs                # EXIT=0
node backend/scripts/guard-rbac-wiring.mjs --strict            # EXIT=0
```
反测原始输出（裁定④要求入证据索引）：
- `counter/C1-delete-registration-red.log` / `C1-post-restore-green.log`（删登记红→点名→复原绿）；
- `counter/C2-pending-code-shortcut-removed-red.log` / `C2-post-restore-green.log`（**摘掉 `canEntry` 的 pending-code 短路 ⇒ 恒隐藏用例必红并点名**那条真实反测的完整原始输出，红行含用例名「积分调整门（pending-code）：任何权限形态一律隐藏（含持通配码）」，EXIT=1）；
- `counter/sha256-counter-tests.txt`（两条反测复原均 BYTE-IDENTICAL）。
合并态（rebase 到 `ce52ca66` 之后）复跑：`口径收敛/post-rebase-gates.log`、`口径收敛/post-rebase-type-check.log`（四门 EXIT=0，27 用例）。
**v3（二次 rebase 到 `cbca2c37` 之后）复跑**：`合并态复跑-v3/gate-*.log`、`build-h5.log`、`guard-*.log`、`ci-yaml-validate.log`、`README.note.txt`（类型门读数已 0=0；四门+构建+守卫全绿）。

## 六、未完成与阻塞

无阻塞。三条**登记在案、不归本卡做**的后继：
1. `mkt-points-adjust` 转 gated ⇒ 依赖立码裁定（候选三选一，§三表已列）；
2. 后端 5 条接线 ⇒ S3-250 收编单（对照表已给）；
3. 售后页 inspect/complete 的动作按钮补挂 ⇒ 产品面决定（本卡不造入口、不扩页面功能，见 §七.5）。

## 七、风险与自我报备（主动交代）

1. **基线偏离**：起基 QODER-1 尖端而非任务书写的 `origin/main`（原因见 §〇）。若凌舟要求严格基于 `origin/main`：
   本卡 6 文件增量彼此独立、可整体重放（vitest/test-gate 依赖卡 1，重放后判据 3 的一致性用例无法在本工作树自证，需另配最小跑批）。
   合并顺序建议：**先合卡 1 再合卡 2**，或合卡 1 后把本分支 rebase 到 main（无冲突面：两卡改动文件交集仅 `gates-baseline.json` 的 `tests` 字段，本卡已在其上递增）。
2. **三态判据的落地口径**：node 测试环境无 uni 页面挂载装置，"页面级三态"落成为：① `canEntry` 逻辑装置断言（mock 用户 store，六形态）+ ② 页面模板静态断言（门控表达式逐字匹配、未门控形态不得残留、脚本挂载点唯一）。**不是** mount 渲染级断言；真实浏览器三态请并入 H5 手动验收单（`build:h5` 产物已可部署验证）。
   **⚠️ 残留风险（裁定④要求明写）：本卡判据未覆盖真实渲染流程** —— v-if 经 uni 编译到 H5 运行时的实际显隐、Pinia store 真实时序（登录态恢复瞬间 `permissions` 的实际值形态）、以及真机 WebView 下的渲染，均**不在**自动化断言面上；浏览器级三态已列入 H5 手动验收清单（凌舟登记 P2）。
3. **行为变化点**：`island-aftersale` 转 gated 后，直达售后页（孤岛页，全仓无导航入口）且**不持 `sale:return`** 的账号，「同意/拒绝」按钮由"人人可见"变为隐藏——这是本卡的预期效果，也是"门先行"的全部用户可见面；充值/修改按钮未动。
4. **字面出现次数口径**：`usePermissionGate.ts` 头注释警告"注释里勿写带引号真实门 id"（S3-230 证据脚本按字面计数核对注册表↔源码引用）。本卡新增真实引用：两页面各 1 处（模板 v-if，属预期引用）；spec 文件内若干处（断言本体，位于 `tests/**`，非 src 扫描面）。若证据脚本的引用计数口径需要微调（src 内 +1/+1 属合法新增），请在验收时知悉。
5. **inspect/complete 无页面按钮**：两条端点登记在门内、后端也未接；页面当前只有同意/拒绝。若 S3-250 接线后需要移动端补"验货/完成"动作，属新的页面工作单，本卡未擅自加按钮。
6. **一致性扫描口径边界**（与 check-contract/后端 guard 同款限制，spec 头注释已写明）：`requirePermission` 与注册行**同行**判定；`requirePermission(PERM_X)` 仅解析**同文件** `const PERM_X = "码"`（实测唯一常量用法 `PERM_SALE_CANCEL` 可解析）；变量拼接路径、`router.use` 二级挂载不在扫描面。
7. **门禁全绿≠存量无欠账**：`gated` 全表 30+ 行的存量一致性由用例逐条裁决且当前 0 违规（首跑即全绿，无第三类欠账冒出）；若后续批次把别的门转 gated，用同一白名单机制需要**再登记理由**，白名单不会自动吸收新欠账（孤儿检测只查"是否仍属 gated 端点"）。

## 八、哈希登记

- 实现提交：`859b1184f8b2fa9d8afb6460608da37458575f3c`（单笔；哈希两度重写 `bc5d1beb`→`5958cdc2`→现值，**文件内容零差异**；v3 栈于卡 1 基线归零尖端 `cbca2c37`；未 push）
- 反测复原 SHA256（前=后）：`permission-gates.ts` `c12fd72dddf5…`、`usePermissionGate.ts` `4fc160d65891…`（全文见 `docs/evidence/qoder-2/counter/sha256-counter-tests.txt`）
- 构建物：`build:h5` 产物未入库（沿用移动端 H5 手动部署口径，不在本卡判据）。

## 九、关联与署名

- 派单卡：`docs/tasks/inbox/QODER-2-B31-入口门解锁后端收编.md`（原件未动）
- 上游：卡 1 回传 `docs/tasks/cards/R101-QODER-1-回传.md`（本分支栈于其 v3 尖端 `cbca2c37`，v2 时为 `ce52ca66`）
- 下游：S3-250 后端收编单（§三 对照表即其输入）

## 十、变更记录

- 2026-10-18：首次回传（无更早版本，无口径覆盖）。
- 2026-10-18（裁定落地 v2）：凌舟三条亲验通过、四条裁定，本分支按 ③④ 收口：
  - **裁定③**：已 rebase 到卡 1 口径收敛尖端 `ce52ca66`（先卡 1 后卡 2）；tests 基线合并态一致（4 文件/27 用例，卡 1 未声明 tests 改动、本卡字段独占，无叠加冲突）；**合并态复跑**四门 EXIT=0（`口径收敛/post-rebase-*.log`），不以"两分支各自绿"代替。哈希重写见 §〇/§八。
  - **裁定④**：§七.2 增「残留风险」明写（未覆盖真实渲染流程；浏览器级三态并入 H5 手动验收清单）；C2 反测原始输出已进 §五 证据索引。
  - 裁定①②（卡 1 侧）落地见 `R101-QODER-1-回传.md` §十 v2。
  - S3-250 前置确认：凌舟裁定积分调整**先出立码裁定卡**（`marketing:points` vs `customer:*` 冲突未决前不接线），S3-250 首批只收 4 条售后端点 ⇒ `mkt-points-adjust` 维持 pending-code，本卡登记面无需再动。
- 2026-10-18（v3 · 跟随卡 1 二次 rebase + 合并态复跑）：凌舟前置「QODER-1 先 rebase 到 `3fa138e7` 并把 typeCheck 基线归 0」完成后，本分支再栈至卡 1 新尖端 `cbca2c37`；三笔哈希重写（见 §〇）；合并态复跑四门 EXIT=0（type 已是 0 条/基线 0 条 ⇒ 裁定②全链收口）、`build:h5` 在 #363 新 crypto.ts 上 EXIT=0、三守卫 0、backend diff 0 行、ci.yml js-yaml 校验（App mobile 4 步、类型门唯一）；两门文件 SHA256 与 v2 复原值一致。状态：**验收通过 · 栈已对齐 · 等凌舟合并（先卡 1 后卡 2）；合并后他侧 `npm test` 复跑为裁定③最后一环**。

—— QODER（移动端执行方，工作树 QODER-2）｜2026-10-18
