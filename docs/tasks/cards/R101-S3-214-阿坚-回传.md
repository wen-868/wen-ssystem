# 【回传 S3-214 · 阶段①】采购域「待核对角色清单」已交付（31 条）

- 汇报对象：**凌舟（主代理）**
- 汇报人：**阿坚（后端/权限）**
- 日期：**2026-10-15**
- 对应派单编号：**S3-214（阶段①，`docs/tasks/inbox/ACTIVE-S3-214.md`）**
- 工作树/分支：`D:\Users\ZXQL\wt-agents\S3-214`｜`feat/s3-214-rbac-batch2`｜基线 `e6c6f95b`（= `origin/main`）
- 交付物：**`docs/evidence/S3-214/01-roles-to-verify.md`**（本工作树内；§七 是等你核对的查询清单）

---

## 一、结论先行（五条）

1. **域已选定并做完整清单：采购域（台账 §三.16）**，9 文件 / **31 条缺口** / **0 条需新立权限点**；选域理由与备选域排序写在清单 §一，你可直接否决换域（客户域 45 / 商品域 45 同法可做）。
2. **台账与实测逐条对得上**：台账 31 行 = 门禁实测 33 个写端点 − **已接线 2 条**（`purchase.routes.ts:13` submit、`:18` in-stock，均 `purchase:create`）＝ 缺口 31。逐文件核对无一条差异（清单 §二）。
3. **拟用码全部取自仓库既有码**（`079_权限矩阵.sql` 的采购菜单码 L137–L141 + 采购按钮码 L208/L209），并按"菜单码看页面、按钮码看动作"的既有口径分派：单据增删改= `purchase:create`、审核= `purchase:approve`、供应商主数据= `purchase:supplier`、供应商对账= `supplier:statement`。
4. **本域的坑与批 1 同形，已定位 4 组、共 8 条端点会 403 现有页面角色**：
   - `STORE_MANAGER` 种子**不含任何 `purchase:*` / `supplier:statement`**，却是采购退货（`admin-web/src/router/index.ts:128`）、供应商对账（`:130`）、采购计划（`:131`）三个页面的允许角色 ⇒ 直接接线，店长这三个页面写操作**必 403**（#6/#7/#15/#29/#30/#31）。
   - 移动端「销售开单」页的**采购页签无权限门**（`app-mobile/src/pages/sales/create-sale.vue:23` 无 `v-if`）⇒ 持 `sale:bill` 的角色（含店长）今天能提交采购订单/入库/退货/付款，接 `purchase:*` 后**由可用变 403**（#1/#11/#14）。
   - `FINANCE_STAFF` 不持 `purchase:*`，但"采购付款"页**已有审核按钮**（`PurchasePayments.vue:358`）⇒ 审核码用 `purchase:approve` 还是 `finance:payment:create` 需你定（#12）。
   - `WAREHOUSE_STAFF` 不持 `purchase:*`（仅 `inventory:*`）⇒ 入库审核码取向需你定（#9）。
5. **分类计数**：可直接接线 **19 条**✅／会 403 现有页面角色 **8 条**❌／需你裁定或存在契约漂移 **4 条**⚠️。

---

## 二、改了什么（范围守恒）

- **只新增文档与证据，零代码改动**：`git status --porcelain` 输出仅 `?? docs/evidence/S3-214/`（无任何 `.ts/.vue/.sql` 被改）。
- 新增文件（全部在本工作树）：

| 文件 | 作用 |
|:--|:--|
| `docs/evidence/S3-214/01-roles-to-verify.md` | **阶段①交付物**：31 条逐端点（方法/路径/后端 file:行/前端调用点/拟用码/页面角色依据）＋ 4 组风险 ＋ 5 条生产核对查询 ＋ 6 条待裁定项 ＋ 卡外观察 |
| `docs/evidence/S3-214/00-guard-report.txt` | `guard-rbac-wiring.mjs` 报告模式原始输出（641 缺口 / 155 文件） |
| `docs/evidence/S3-214/00-baseline-json.txt` | 同门禁 `--json` 原始输出（763 写端点，本域数据源） |
| `docs/evidence/S3-214/02-domain-gaps.txt` | 17 域缺口分布（域级 join 输出） |
| `docs/evidence/S3-214/tools/domain-gaps.mjs` | 域级 join 脚本（只读，供你复算） |
| `docs/evidence/S3-214/03-citation-audit.txt` | **引用审计**：脚本解析清单里 105 条 `文件:行`，无"文件不存在/行号越界" |

---

## 三、关键证据（可复跑）

```powershell
cd D:\Users\ZXQL\wt-agents\S3-214
git log --oneline -1                                    # e6c6f95b
git status --porcelain                                  # 仅 ?? docs/evidence/S3-214/
node backend/scripts/guard-rbac-wiring.mjs              # 641 处缺口 / 155 文件 / 台账核对 641-0-0
node backend/scripts/guard-rbac-wiring.mjs --strict     # EXIT=0
node backend/scripts/guard-rbac-wiring.mjs --json       # 763 个写端点
node docs/evidence/S3-214/tools/domain-gaps.mjs         # 采购域：33 写端点 / 31 缺口
node backend/scripts/guard-rbac-wiring.mjs --holders purchase:create     # SUPER_ADMIN/OPERATION_ADMIN/PURCHASE_STAFF
node backend/scripts/guard-rbac-wiring.mjs --holders supplier:statement  # + FINANCE_STAFF（仍无 STORE_MANAGER）
```

| 证据 | SHA256 |
|:--|:--|
| `01-roles-to-verify.md` | `AD3F62C6C28882D45BB91491C386AFEFE26B9FF664313F746C9FE66B9EEBBD36` |
| `03-citation-audit.txt` | `74DD5A711C82C064C9E142E4CB688E2FAD84580F77C9713D2A80B69ABB88BF7A` |
| `00-guard-report.txt` | `60D2341265C686518FC00D466F4A7C681893E685D7348F5DF3D29F084D8BD282` |
| （冻结说明） | 上两行哈希为**最终修订**同批冻结值（清单 32432 B）；清单此后未再改动 | `5FEA66AB332F040E1025C69F0D4C32CCB40A52C478D52A2807846A230AD4161` |

---

## 四、等你做的两件事（阶段②开不了工的原因）

1. 按清单 **§七 Q1–Q5** 在生产核对（全部只读 SQL）：生产角色全集与权限串、6 个候选码的**真实持有角色**、店长/财务/仓管重点角色、采购菜单码是否已落库。
2. 对 **6 个口径问题**给结论（清单 §六 处置选项 + §七 末尾）：
   - 店长那 3 个页面：**扩店长权限**（另立单）／**改 `meta.roles`**（前端改动）／**本单不接这 7 条**？
   - 移动端采购页签无门：**允许销售侧提交采购单据**（给相关角色加码）／**给页签加权限门**（另立单）？
   - #12 采购付款审核：`purchase:approve` 还是 `finance:payment:create`？
   - #9 入库审核：`purchase:approve` 还是 `inventory:inbound`？
   - 作废类（#3/#10/#13/#16）：沿用 `purchase:create` 还是另立 `purchase:void`（销售域有 `sale:void` 先例）？
   - 供应商主数据：用 `purchase:supplier`（菜单码，与移动端菜单同码）还是台账建议的 `purchase:create`？

---

## 五、未完成与阻塞

1. **阶段②未开工**（红线：未得核对结论前不许接线）；本单**未 commit / 未 push / 未开 PR**（红线）。
2. **生产库取不到**：本机 `.env` 指向 `127.0.0.1:3306`，且卡面规定生产核对由你做 ⇒ 清单里所有"持有角色"均为**仓库种子口径**，已逐处显式标注，未把推断写成结论。
3. **未跑** MariaDB 对照、未做 CI 侧验证（红线禁 push/PR）。
4. **未改** `docs/tasks/R101-RBAC接线缺口清单.md`（不在本卡授权范围）⇒ 若阶段②要求"接线后把台账登记源同步"，请在阶段②卡里写明允许改哪些行、改成什么口径。
5. **未动共享树 `docs/tasks/inbox/ACTIVE.md`**：它现在是**三会话共用的路由表**（含 `s3215`/`s3216`/`s3217` 行），按 2026-10-15 的"只能追加、不得删别人在办行"纪律，我不改写它；本卡副本已归档到**我的分支** `docs/tasks/inbox/archive/ACTIVE-S3-214.md`，回执同时落在共享树 inbox（本文件）与我的分支。

---

## 六、风险与自我报备

1. **口径风险（最重要）**：我给的"会 403"结论建立在**仓库角色种子**上；生产若已给 `STORE_MANAGER` 加了 `purchase:*`，则 §六-1 的 7 条不成立——这也是我把 Q1–Q4 列在最前面的原因。**未核对前请勿把这些结论当验收判据。**
2. **同列口径修正（不是本单结论）**：`supplier.routes.ts` 在台账里归"采购域"，本清单沿用；若你判定供应商主数据应另立域，本单 31 条里 #23–#30 需移出。
3. **移动端证据的局限**：我用的是"页签无 `v-if`"这一静态证据，**未在真机跑**确认店长实际会点采购页签；若你要更硬的证据，给我一台可跑 `app-mobile` 的环境，我补真机截图/日志（属阶段②前置，不阻塞本单）。
4. **框架性观察（越出本卡，仅报备）**：桌面"采购订单"审核按钮打的是**后端不存在的** `/purchase-orders/:id/confirm`（`api/purchase.ts:41` vs `purchase.routes.ts` 只有 `/approve`），同族还有 `pay`/`approve`/`cancel` 系列；`supplier-contacts` 前后端路径不一致（前端 `/admin/supplier-contacts`，后端 `/supplier/:supplierId`）。这些是**契约漂移**，我没有改（越出范围），登记在清单 §八，供你决定是否另立单。
5. **卡面缺陷报备（R6）**：本卡**未内嵌「回传格式」块**（`docs/tasks/派单规范.md` §三 要求派单卡开头提供可照抄的回传格式）。我按规范 §3/§4 自行补齐了署名与"未完成与阻塞/风险与自我报备"两栏；建议后续卡补上该块，避免执行方各写各的。

---

汇报对象：凌舟（主代理）｜汇报人：阿坚（后端/权限）｜日期：2026-10-15
