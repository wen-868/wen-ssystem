# ACTIVE-回执 · S3-214-B2（采购域权限接线 · B2 批 2 阶段②）

- **汇报对象**：凌舟（总负责人）
- **汇报人**：阿坚（后端 / 权限 · 本地子代理通道 `/root/s3220_ajian`）
- **日期**：2026-10-16
- **对应派单编号**：S3-214-B2（卡：`docs/tasks/inbox/ACTIVE-S3-214-B2.md`）
- **工作树 / 分支**：`D:\Users\ZXQL\wt-agents\S3-214` ｜ `feat/s3-214-batch2-wiring`（基线 `origin/main` = `7beafd24`）
- **完整十项回传**：`docs/tasks/cards/R101-S3-214-B2-阿坚-回传.md`

## 一、改了什么

1. **接线 25 条**（9 个路由文件；一律「加一个**既有**码的 `requirePermission`」，无逻辑改动）：

   | 落地码 | 条数 | 用在哪 |
   |:--|--:|:--|
   | `purchase:create` | 7 | 采购单作废/改/删 + 采购合同 4 条 |
   | `purchase:approve` | 1 | 采购单审核（`/:orderNo/approve`） |
   | `purchase:supplier` | 8 | 供应商主数据 4 + 供应商联系人 4 |
   | `inventory:inbound` | 2 | 入库审核 / 入库作废（办件人＝仓管） |
   | `finance:payment` | 2 | 付款审核 / 付款作废（办件人＝财务） |
   | `sale:return` | 2 | 采购退货审核 / 作废（页面含店长） |
   | `report:finance` | 3 | 供应商对账 generate/confirm/dispute（页面含店长） |

2. **不接线 6 条**（按卡面 §二/§三 口径）：**M 类 4 条** = 移动端「销售开单」采购页签的 4 个创建端点（该页签无权限门，接线会把持 `sale:bill` 的门店角色打成 403）；**W 类 2 条** = 采购计划创建/转换（页面真实使用者含 STORE_MANAGER，生产店长不持任何 `purchase:*`，又无其已持有的采购计划语义码 ⇒ 待授权模型定案）。6 条**均保留在**机读台账与人读台账里，未被洗绿。
3. **台账同步**：`backend/scripts/rbac-wiring-baseline.json`（`gaps` 641 → **616** 条 / 文件 155 → 151，删掉 25 条已接线、保留 6 条，并加 `_s3214_b2_note`）；`docs/tasks/R101-RBAC接线缺口清单.md` §三.16 **逐行订正**（加「S3-214-B2 落地」列）+ 新增 **§十一**（接线口径、25 条逐条表、6 条未接原因、守恒、反测、与阶段①建议码的差异、卡外观察）。
4. **测试**：新增 `backend/src/__tests__/routes/rbac-b2-s3-214-purchase-wiring.test.ts`（**153 用例**：注册行级形状断言 / READONLY⇒403 / 非持有人逐账号⇒403 / 持有人逐账号⇒200 / 零回归正面证据 / 范围控制 / 未登录 401）；`rbac-g0-wiring.test.ts` 只同步两处跨批断言（总数 82 → 107；一条已接线端点移出「未纳入 G0」名单），G0 名单行与其 403/200 断言一字未动。
5. **证据落盘**：`docs/evidence/S3-214/` 下 `10~16`、`20~23`、`30-hashes.txt` + `tools/verify-s3-214-b2.ps1`（一键复算）；阶段①产物（`01-roles-to-verify.md` 等）**原样保留**。

## 二、证据（原始输出）

| 判据 | 读数 | 文件 |
|:--|:--|:--|
| 本批前缺口 | 641 处 / 155 文件 / 已接线 83 | `docs/evidence/S3-214/10-guard-before.txt` |
| 本批后缺口 | **616 处 / 151 文件 / 已接线 108**（641 − 25） | `11-guard-after.txt` |
| `--strict` | 未登记 0、陈旧 0、**EXIT=0** | `12-guard-strict-after.txt` |
| 本批用例 | **153 passed** | `14-vitest-batch2.txt` |
| 全量回归 | **670 文件 / 8243 用例 全通过（EXIT=0）** | `13-vitest-full.txt` |
| tsc / build | **EXIT=0 / EXIT=0** | `15-tsc.txt` / `16-build.txt` |
| 反测（摘掉一条接线） | 缺口 616→**617**；`--strict` **EXIT=1** 并点出该端点；用例 **5 failed**；复原后 616/EXIT=0/153 passed，文件 SHA256 一致 | `20`/`21`/`22`/`23-neg-A-*.txt` |
| src/dist 哈希 | 见文件 | `30-hashes.txt` |

**本域对账**：台账 31 = **25 已接 + 4（M）+ 2（W）**。

## 三、阻塞点

**无阻塞**（本单在一个会话内拿到「接线 + 两侧反测 + 门禁守恒」闭环）。未做的事都是卡面**明令不做**的：未 push、未开 PR、未改角色种子、未新增权限码、未动迁移/契约/收口总清单、未改共享路由文件 `ACTIVE.md`。

## 四、需凌舟处置（不属本单动手范围）

1. 验收后**归档** `docs/tasks/inbox/ACTIVE-S3-214-B2.md`，并把 `ACTIVE.md` 里 `/root/s3220_ajian` 一行移出「在办」（该文件为多 agent 共用，本单按纪律未动）。
2. 裁定 **W 类 2 条（采购计划）的授权模型**与 **M 类 4 条的移动端权限门口径**。
3. 确认生产是否真有 `PURCHASE_STAFF`（影响 `purchase:*` 端点的实际可用者，见回传卡 §七.1）。

## 五、环境复原

- 临时基线工作树 `wt-agents/S3-214-base`（取"本批前 641"用）**已删除**（`git worktree remove`，删前 `status` 干净）。
- 本工作树 `node_modules` 为指向主检出的 junction（lockfile 字节一致），删除后 `npm ci` 可独立安装；不影响 git 状态。
- 构建产物仅在各自 `dist/`（git 忽略），未提交、未推送。

派单人：凌舟（总负责人）｜2026-10-16　　执行方：阿坚（后端/权限）｜2026-10-16
