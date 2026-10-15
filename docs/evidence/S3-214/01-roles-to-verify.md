# S3-214 · 阶段① 交付物：**采购域「待核对角色清单」**（B2 批 2 · 第一域）

- 派单人：**凌舟｜2026-10-15**｜执行方：**阿坚（后端/权限）**
- 工作树：`D:\Users\ZXQL\wt-agents\S3-214`｜分支：`feat/s3-214-rbac-batch2`
- 基线：`e6c6f95b`（= `origin/main`，S3-212 合并后）
- 性质：**阶段①只出清单，未改任何代码**（全仓 `git status` 仅本文件 + `docs/evidence/S3-214/**` 为新增）
- 结论先行：**4 条"必须先核对、否则一定踩批 1 同款坑"的组合**已定位（见 §六），逐条给出生产核对 SQL（见 §七）

---

## 〇、结论先行

1. 本单选域：**采购域（台账 §三.16）**——9 个路由文件、**31 条缺口**、**0 条需新立权限点**；选择理由与备选见 §一。
2. 台账与实测**逐条对得上**：台账 31 条 = 门禁实测 33 个写端点 − 已接线 2 条，缺口 31 = 31（§二，可复算）。
3. 拟用码**全部取自仓库既有码**，来源是 `079_权限矩阵.sql` 的**采购菜单码 + 采购按钮码**（§三），与移动端功能中心菜单码**同码对齐**，不新造码。
4. **风险不在"选不出码"，在"页面角色 ⊉ 码持有者"**。批 1 的教训（`trace:*` 无人持有 → 门店追溯页 403）在本域以**同一形态**出现 4 处：
   - `STORE_MANAGER`（门店店长）**能打开**采购退货 / 供应商对账 / 采购计划 三个页面（`admin-web/src/router/index.ts:128/130/131`），但种子权限里**没有** `purchase:*`、也没有 `supplier:statement` ⇒ 直接接线会让店长这三个页面**全部 403**。
   - 移动端「销售开单」页的**采购页签没有任何权限门**（`app-mobile/src/pages/sales/create-sale.vue:23`，无条件渲染）⇒ 任何持有 `sale:bill` 的角色（含 `STORE_MANAGER`）都能提交采购订单/入库/退货/付款 ⇒ 这 4 个创建端点接 `purchase:*` 后，店长在手机端**由可用变 403**。
   - `FINANCE_STAFF`（财务）持有 `supplier:statement`、`finance:*`，但**不持** `purchase:*` ⇒ 若采购付款审核接 `purchase:approve`，财务在"采购付款"页点"审核"必 403（该按钮已在页面上存在，见 §六-3）。
   - `WAREHOUSE_STAFF`（仓管）持有 `inventory:*`，**不持** `purchase:*` ⇒ 入库单审核若接 `purchase:approve`，仓管审核入库（业务上最可能的人）会 403。
5. 因此**阶段②开工前，凌舟需先做两件事**：① 按 §七 的 5 条查询在生产核对"页面角色是否持有拟用码"；② 对 §六/§八 的 6 个待裁定项给口径（用哪个码、是否扩角色权限、是否属于本单范围）。

---

## 一、选域理由与备选（凌舟可否决）

**选：采购域（`docs/tasks/R101-RBAC接线缺口清单.md` §三.16，9 文件 / 31 缺口）**

| 判据 | 采购域实测 |
|:--|:--|
| 语义单一 | 9 个文件全部落在 `/api/admin/purchase-*` 与 `/api/admin/supplier*`，无消费者端/公开端点混入（台账 31 条全判"管理面"） |
| 规模 | 31 条缺口 ≈ 批 1（S3-198）已接线的 34 条，一批可交付 |
| 码齐备 | 台账「需新权限点」= **0**；`079` 已有采购菜单码 5 个 + 按钮码 2 个 |
| 安全价值 | 采购付款/采购退货/采购入库都是"钱与货"的写操作，今天任何登录用户都能调（缺口=无权限码） |
| 旁证 | 本域含**唯一一条已接线先例**（`purchase.routes.ts:13/:18` 的 `purchase:create`），批 2 可沿用同一形态 |

**备选（若凌舟另有排期，按此顺序替换，清单方法一致）**：客户域（45）/ 商品域（45）/ 系统设置-基础域（37，但 22 条需新立码）/ 员工-账号域（31，含 7 条自服务 + 4 条需新立码）/ 营销域（89，**不建议**：单域内混入消费者端行为（`/api/marketing/group-buy/:id/join`、`/api/marketing/bargain/:id/help`）、门店核销端点（`/api/store/coupons/verify` 属收银员）与会员积分，语义不单一，逐条裁定成本高于接线收益）。
排除项：`platform*` 平台域（118 条，另立单）与已做的库存/追溯域（批 1）。

---

## ★ 凌舟生产核对结论 + 阶段②口径（2026-10-15，**照此执行**）

**核对方式**：服务器只读通道查 `t_sys_role.permissions`（`tenant_id='default'`）。**你的 4 处风险推断全部命中**：

| 角色 | 生产 permissions | 结论 |
|:--|:--|:--|
| `SUPER_ADMIN` | `["*"]` | 全通 |
| `STORE_MANAGER` | `store:*, sale:*, customer:*, inventory:*, report:*, dashboard:*, finance:payment, goods:price, finance:daily-settle` | **无 `purchase:*`、无 `supplier:statement`** ⇒ 盲接会打断店长的采购退货 / 供应商对账 / 采购计划三页 |
| `STORE_OPERATOR` | `sale:create, sale:view, inventory:view, dashboard:view, sale:return, finance:daily-settle` | 无 `purchase:*` |
| `WAREHOUSE_STAFF` | `inventory:*, trace:*, transfer:*, stock-check:*` | **无 `purchase:*`** ⇒ 入库审核接 `purchase:approve` 会打断仓管 |
| `FINANCE_STAFF` | `finance:*, report:*, customer:statement, supplier:statement, dashboard:view` | **无 `purchase:*`、有 `supplier:statement`** ⇒ 采购付款审核接 `purchase:approve` 会打断财务 |

### 阶段②口径（**按"使用者已持有的码"接线，不强行统一 `purchase:*`**）

1. **优先挂"该端点真实使用者已持有的模块码"**（保证零回归），例如：
   - 采购入库/入库审核 ⇒ 用 **`inventory:*`** 域既有码（仓管持有）；
   - 采购付款/付款审核 ⇒ 用 **`finance:*`** 域既有码（财务持有）；
   - 供应商对账 ⇒ 用 **`supplier:statement`**（财务持有）或 `report:*`（多角色持有）——你按端点语义二选一并在回执给理由；
   - 采购退货（店长页面在用）⇒ 用 **`sale:return`** 或 `store:*` 域既有码（店长持有）。
2. **只有"采购岗专属、且使用者本来就不是上述角色"的端点**（如采购单新增/修改/删除）才挂 **`purchase:*`**，并在回执里**注明"该码当前仅 `SUPER_ADMIN` 持有"**（生产没有独立采购岗角色）。
3. **移动端「销售开单」采购页签的 4 个创建端点**：因该页签**无权限门**、使用者是门店 ⇒ **本批不接线**，登记「待移动端补权限门后收编」，避免把手机端可用功能打成 403。
4. **找不到"使用者已持有"的码、又不宜挂 `purchase:*` 的端点** ⇒ **本批不接线**，登记「待授权模型定案」，由凌舟另立"授权模型提案"单（哪个角色该有哪些码属产品决策，不由此单顺带改）。
5. 逐端点两侧反测（缺码 ⇒ 403 / 有码 ⇒ 通过 / 摘中间件 ⇒ 用例红），台账守恒（641 → 641−本批接线数），门禁全绿。

---

## 二、台账 ↔ 实测对账（本单判据 2）

```powershell
# 起点（防旧工作树污染）
git -C D:\Users\ZXQL\wt-agents\S3-214 log --oneline -1     # e6c6f95b
# ① 本域实测缺口（域级 join：台账域划分 × 门禁实测）
node docs/evidence/S3-214/tools/domain-gaps.mjs             # 输出见 docs/evidence/S3-214/02-domain-gaps.txt
# ② 门禁原始输出（人读 + 机读）
node backend/scripts/guard-rbac-wiring.mjs                  # 641 处缺口 / 155 文件
node backend/scripts/guard-rbac-wiring.mjs --json           # 763 个写端点
node backend/scripts/guard-rbac-wiring.mjs --strict         # EXIT=0（641 条已登记、未登记 0）
```

**对账结果**

| 口径 | 数字 | 来源 |
|:--|--:|:--|
| 台账 §二「采购域」声明 | 9 文件 / 31 写端点 | `R101-RBAC接线缺口清单.md:57` 表行 |
| 台账 §三.16 逐条行数（`\| \`POST/PUT/DELETE ...\``） | **31 行** | 同文件 §三.16（L1237–L1314） |
| 门禁实测本域写端点 | **33** | `guard-rbac-wiring.mjs --json`，file 含 `purchase*`/`supplier*` |
| 其中已接线（基线内） | **2**（`purchase.routes.ts:13` submit、`:18` in-stock，均 `purchase:create`） | 同上，`hasPermission=true` |
| **本域实测缺口** | **31** | 33 − 2 = 31 = 台账 31 ✅ |

**逐文件核对**：`purchase-contract` 4 ＝ 实测 4；`purchase-in-stock` 3 ＝ 3；`purchase-payment` 3 ＝ 3；`purchase-plan` 2 ＝ 2；`purchase-return` 3 ＝ 3；`purchase.routes` 5 ＝ 实测 7 − 已接 2；`supplier-contact` 4 ＝ 4；`supplier.routes` 4 ＝ 4；`supplier-statement` 3 ＝ 3。**无一条台账行对不上，也无一条实测缺口不在台账里。**

> 口径提示：`supplier.routes.ts`（供应商主数据）在台账里被归入**采购域**（§三.16 末段 L1306），本清单沿用该归属；若凌舟认为供应商主数据应另立域，本单 31 条中 8 条（#23–#30）随之调整。

---

## 三、拟用码的取值依据（**只用仓库既有码，不新造**）

`docs/migrations/079_权限矩阵.sql` 里采购域**自己的**权限点（不是规则推断，是产品已定义的权限模型）：

| 码 | 类型 | 名称 | 079 行 | 仓库种子持有角色（`--holders` 复算） |
|:--|:--|:--|--:|:--|
| `purchase:order` | MENU(30) | 采购订单 | L137 | SUPER_ADMIN / OPERATION_ADMIN / **PURCHASE_STAFF** |
| `purchase:inbound` | MENU(31) | 采购入库 | L138 | SUPER_ADMIN / OPERATION_ADMIN / **PURCHASE_STAFF** |
| `purchase:return` | MENU(32) | 采购退货 | L139 | SUPER_ADMIN / OPERATION_ADMIN / **PURCHASE_STAFF** |
| `purchase:payment` | MENU(33) | 采购付款 | L140 | SUPER_ADMIN / OPERATION_ADMIN / **PURCHASE_STAFF** |
| `purchase:supplier` | MENU(34) | 供应商管理 | L141 | SUPER_ADMIN / OPERATION_ADMIN / **PURCHASE_STAFF** |
| `purchase:create` | BUTTON(220) | 新建采购 | L208 | SUPER_ADMIN / OPERATION_ADMIN / **PURCHASE_STAFF** |
| `purchase:approve` | BUTTON(221) | 审核采购 | L209 | SUPER_ADMIN / OPERATION_ADMIN / **PURCHASE_STAFF** |
| `supplier:statement` | 代码在用（078/128 等） | 供应商对账 | 见 `--holders` | SUPER_ADMIN / OPERATION_ADMIN / **PURCHASE_STAFF**（经 `supplier:*`）/ **FINANCE_STAFF** |

复算命令（逐码可复跑）：

```powershell
node backend/scripts/guard-rbac-wiring.mjs --holders purchase:create
node backend/scripts/guard-rbac-wiring.mjs --holders purchase:approve
node backend/scripts/guard-rbac-wiring.mjs --holders purchase:supplier
node backend/scripts/guard-rbac-wiring.mjs --holders supplier:statement
node backend/scripts/guard-rbac-wiring.mjs --holders inventory:inbound
node backend/scripts/guard-rbac-wiring.mjs --holders finance:payment
```

**拟用码规则（本单建议，待凌舟裁定 → 见 §八）**

| 规则 | 端点类别 | 拟用码 |
|:--|:--|:--|
| R1 | 采购单据的**新建 / 编辑 / 删除 / 作废 / 转换 / 上传** | `purchase:create` |
| R2 | 采购单据的**审核**（`/approve`） | `purchase:approve` |
| R3 | **供应商主数据**（`/admin/suppliers*`、`/admin/supplier-contacts*`） | `purchase:supplier`（与移动端"供应商管理"菜单码同码） |
| R4 | **供应商对账**（generate / confirm / dispute） | `supplier:statement`（对账属财务语义，且 `supplier:*` 亦覆盖采购员） |

`matchPermission` 语义已核（`backend/scripts/guard-rbac-wiring.mjs:175-185` 与 `backend/src/services/admin/rbac.service.ts` 逐行同义）：`purchase:*` 命中 `purchase:create` / `purchase:approve` / `purchase:order` / `purchase:inbound` / `purchase:return` / `purchase:payment` / `purchase:supplier` ⇒ **采购员（PURCHASE_STAFF）对上述全部码均通过**；风险角色不是采购员，是**店长/财务/仓管**。

---

## 四、逐端点待核对清单（31 条）

列含义：`后端 file:行` = 该写端点声明处；`前端调用点` = 实际会发出该请求的页面代码（`—` = 全仓无调用方）；`码持有者` = 仓库种子口径；`会用到它的角色（依据）` = 页面/入口的角色门证据；`判定` = 若直接接线是否安全。

| # | METHOD 路径 | 后端 file:行 | 前端调用点 file:行 | 拟用码 | 会用到它的角色（依据） | 判定 |
|--:|:--|:--|:--|:--|:--|:--|
| 1 | `POST /api/admin/purchase-orders/` | `purchase.routes.ts:12` | 桌面 `PurchaseOrders.vue:351`；移动 `create-sale.vue:2159`（doc=pur_order） | `purchase:create` | 桌面页：SUPER_ADMIN（`admin-web/src/router/index.ts:126`）；移动：`sale:bill` 或 `purchase:order` 持有者（`app-mobile/src/config/function-menu.ts:38` + `:59`） | ⚠️ 移动端会破店长（§六-2） |
| 2 | `POST /api/admin/purchase-orders/:orderNo/approve` | `purchase.routes.ts:14` | `—`（桌面调的是 `/confirm`，后端无此路由，见 §八-1） | `purchase:approve` | 无页面调用方 ⇒ 仅 API 策略面 | ✅ 可接（无回归面） |
| 3 | `POST /api/admin/purchase-orders/:orderNo/cancel` | `purchase.routes.ts:15` | 桌面 `PurchaseOrders.vue:328` | `purchase:create` | SUPER_ADMIN（`admin-web/src/router/index.ts:126`） | ✅ 可接（页面仅超管） |
| 4 | `PUT /api/admin/purchase-orders/:orderNo` | `purchase.routes.ts:16` | `—` | `purchase:create` | 无调用方（移动 `app-mobile/src/api/modules/purchase.ts:142` 有函数、无页面调用） | ✅ 可接 |
| 5 | `DELETE /api/admin/purchase-orders/:orderNo` | `purchase.routes.ts:17` | `—` | `purchase:create` | 无调用方 | ✅ 可接 |
| 6 | `POST /api/admin/purchase-plans/` | `purchase-plan.routes.ts:9` | 桌面 `PurchasePlans.vue:261,299` | `purchase:create` | **SUPER_ADMIN + STORE_MANAGER**（`admin-web/src/router/index.ts:131`） | ❌ 会 403 店长 |
| 7 | `POST /api/admin/purchase-plans/:planNo/convert` | `purchase-plan.routes.ts:11` | 桌面 `PurchasePlans.vue:336` | `purchase:create` | 同上 | ❌ 会 403 店长 |
| 8 | `POST /api/admin/purchase-in-stocks/` | `purchase-in-stock.routes.ts:9` | 桌面 `PurchaseInStocks.vue:339`；移动 `create-sale.vue:2112`（doc=pur_inbound） | `purchase:create` | 桌面：SUPER_ADMIN（`:127`）；移动：`purchase:inbound`→PURCHASE_STAFF（`app-mobile/src/config/function-menu.ts:60`） | ✅ 可接（两处持有者都过） |
| 9 | `POST /api/admin/purchase-in-stocks/:stockNo/approve` | `purchase-in-stock.routes.ts:10` | `—` | `purchase:approve` | 无调用方 ⇒ 但业务上审核人很可能是仓管（**待裁定**，§八-4） | ⚠️ 需裁定 |
| 10 | `POST /api/admin/purchase-in-stocks/:stockNo/void` | `purchase-in-stock.routes.ts:11` | `—` | `purchase:create` | 无调用方 | ✅ 可接 |
| 11 | `POST /api/admin/purchase-payments/` | `purchase-payment.routes.ts:9` | 桌面 `PurchasePayments.vue:400`；移动 `create-sale.vue:2211`（doc=pur_payment） | `purchase:create` | 桌面：SUPER_ADMIN（`:132`）；移动：`sale:bill` 持有者 | ⚠️ 移动端会破店长（§六-2） |
| 12 | `POST /api/admin/purchase-payments/:paymentNo/approve` | `purchase-payment.routes.ts:10` | 桌面 `PurchasePayments.vue:358` | `purchase:approve` | SUPER_ADMIN 页面；**财务不持 `purchase:*`**（§六-3） | ⚠️ 需裁定 |
| 13 | `POST /api/admin/purchase-payments/:paymentNo/void` | `purchase-payment.routes.ts:11` | `—` | `purchase:create` | 无调用方 | ✅ 可接 |
| 14 | `POST /api/admin/purchase-returns/` | `purchase-return.routes.ts:9` | **移动 `create-sale.vue:2270`**（`submitPurchaseReturn`，`purchaseReturnApi.create`） | `purchase:create` | 移动「销售开单」页 `sale:bill` 持有者（`app-mobile/src/config/function-menu.ts:38`）；页内采购页签**无权限门**（`app-mobile/src/pages/sales/create-sale.vue:23`） | ❌ 会 403 店长（§六-2） |
| 15 | `POST /api/admin/purchase-returns/:returnNo/approve` | `purchase-return.routes.ts:10` | 桌面 `PurchaseReturnsView.vue:138` | `purchase:approve` | **SUPER_ADMIN + STORE_MANAGER**（`admin-web/src/router/index.ts:128`） | ❌ 会 403 店长 |
| 16 | `POST /api/admin/purchase-returns/:returnNo/void` | `purchase-return.routes.ts:11` | `—` | `purchase:create` | 无调用方 | ✅ 可接 |
| 17 | `POST /api/admin/purchase-contracts/` | `purchase-contract.routes.ts:10` | 桌面 `PurchaseContracts.vue:419`（`api/misc.ts:68`） | `purchase:create` | SUPER_ADMIN（`admin-web/src/router/index.ts:129`） | ✅ 可接 |
| 18 | `PUT /api/admin/purchase-contracts/:contractNo` | `purchase-contract.routes.ts:11` | 桌面 `PurchaseContracts.vue:416`（`api/misc.ts:73`） | `purchase:create` | 同上 | ✅ 可接 |
| 19 | `DELETE /api/admin/purchase-contracts/:contractNo` | `purchase-contract.routes.ts:12` | 桌面 `PurchaseContracts.vue:443`（`api/misc.ts:78`） | `purchase:create` | 同上 | ✅ 可接 |
| 20 | `POST /api/admin/purchase-contracts/:contractNo/upload` | `purchase-contract.routes.ts:13` | `—` | `purchase:create` | 无调用方 | ✅ 可接 |
| 21 | `POST /api/admin/supplier-contacts/supplier/:supplierId` | `supplier-contact.routes.ts:14` | ⚠️ 路径不一致：前端 `purchase.ts:185` 打 `/admin/supplier-contacts` | `purchase:supplier` | 桌面 `Suppliers.vue:655`（SUPER_ADMIN，`:133`） | ⚠️ 契约漂移（§八-2） |
| 22 | `PUT /api/admin/supplier-contacts/:id` | `supplier-contact.routes.ts:16` | 桌面 `Suppliers.vue:652`（`purchase.ts:198`） | `purchase:supplier` | SUPER_ADMIN（`:133`）；移动无调用 | ✅ 可接 |
| 23 | `DELETE /api/admin/supplier-contacts/:id` | `supplier-contact.routes.ts:18` | 桌面 `Suppliers.vue:671`（`purchase.ts:202`） | `purchase:supplier` | 同上 | ✅ 可接 |
| 24 | `POST /api/admin/supplier-contacts/:id/set-primary` | `supplier-contact.routes.ts:20` | 桌面 `Suppliers.vue:684`（`purchase.ts:206`） | `purchase:supplier` | 同上 | ✅ 可接 |
| 25 | `POST /api/admin/suppliers/` | `supplier.routes.ts:11` | 桌面 `Suppliers.vue:705`（`purchase.ts:10`）；移动 `suppliers/detail.vue:535` | `purchase:supplier` | 桌面：SUPER_ADMIN（`:133`）；移动：`purchase:supplier`→PURCHASE_STAFF（`app-mobile/src/config/function-menu.ts:61`） | ✅ 可接（两处持有者都过） |
| 26 | `PUT /api/admin/suppliers/:id` | `supplier.routes.ts:12` | 桌面 `Suppliers.vue:702`；移动 `suppliers/detail.vue:552,584` | `purchase:supplier` | 同上 | ✅ 可接 |
| 27 | `POST /api/admin/suppliers/:id/contacts` | `supplier.routes.ts:13` | `—`（前端走 `/admin/supplier-contacts`） | `purchase:supplier` | 无调用方 | ✅ 可接 |
| 28 | `DELETE /api/admin/suppliers/:id/contacts/:contactId` | `supplier.routes.ts:14` | `—` | `purchase:supplier` | 无调用方 | ✅ 可接 |
| 29 | `POST /api/admin/supplier-statements/generate` | `supplier-statement.routes.ts:8` | 桌面 `SupplierStatements.vue:230`（`purchase.ts:126`） | `supplier:statement` | **SUPER_ADMIN + STORE_MANAGER**（`admin-web/src/router/index.ts:130`）；财务持该码 | ❌ 会 403 店长 |
| 30 | `POST /api/admin/supplier-statements/:statementNo/confirm` | `supplier-statement.routes.ts:11` | 桌面 `SupplierStatements.vue:259`（`purchase.ts:130`） | `supplier:statement` | 同上 | ❌ 会 403 店长 |
| 31 | `POST /api/admin/supplier-statements/:statementNo/dispute` | `supplier-statement.routes.ts:12` | 桌面 `SupplierStatements.vue:276`（`purchase.ts:134`） | `supplier:statement` | 同上 | ❌ 会 403 店长 |

**计数**：❌ 会 403 现有页面角色 **8 条**（#6/#7/#14/#15/#29/#30/#31 + #11 的移动面）；⚠️ 需裁定/契约问题 **4 条**（#9/#12/#21 + #1 移动面）；✅ 可直接接线 **19 条**。

---

## 五、页面 / 入口 → 角色 对照（"谁在用这个域"的证据表）

| 入口 | 页面文件 | 允许角色（原文） | 依据 |
|:--|:--|:--|:--|
| 桌面·采购订单 | `views/purchase/PurchaseOrders.vue` | `["SUPER_ADMIN"]` | `admin-web/src/router/index.ts:126` |
| 桌面·采购入库 | `views/purchase/PurchaseInStocks.vue` | `["SUPER_ADMIN"]` | `:127` |
| 桌面·采购退货 | `views/purchase/PurchaseReturnsView.vue` | `["SUPER_ADMIN","STORE_MANAGER"]` | `:128` |
| 桌面·采购合同 | `views/purchase/PurchaseContracts.vue` | `["SUPER_ADMIN"]` | `:129` |
| 桌面·供应商对账 | `views/purchase/SupplierStatements.vue` | `["SUPER_ADMIN","STORE_MANAGER"]` | `:130` |
| 桌面·采购计划 | `views/purchase/PurchasePlans.vue` | `["SUPER_ADMIN","STORE_MANAGER"]` | `:131` |
| 桌面·采购付款 | `views/purchase/PurchasePayments.vue` | `["SUPER_ADMIN"]` | `:132` |
| 桌面·供应商管理 | `views/purchase/Suppliers.vue` | `["SUPER_ADMIN"]` | `:133` |
| 移动·采购订单 | `pages-sub/finance/purchase/orders.vue` | 菜单码 `purchase:order` | `app-mobile/src/config/function-menu.ts:59` |
| 移动·进货入库 | `pages-sub/finance/purchase/in-stock.vue`（`redirectTo` 到 `create-sale?doc=pur_inbound`，见 `in-stock.vue:12`） | 菜单码 `purchase:inbound` | `:60` |
| 移动·供应商管理 | `pages-sub/product/suppliers/suppliers.vue` | 菜单码 `purchase:supplier` | `:61` |
| 移动·销售开单（含**采购页签**：订单/入库/退货/付款） | `pages/sales/create-sale.vue` | 菜单码 `sale:bill`；**采购页签无二次门** | `app-mobile/src/config/function-menu.ts:38` + `app-mobile/src/pages/sales/create-sale.vue:23`（`doc-seg` 无 `v-if`） |

**引用写法约定（为免误读）**：① 全路径引用（含 `admin-web/`、`app-mobile/`、`backend/` 前缀）可独立定位；② 形如 `:127`、`:2159` 的**短引用**指向同一单元格/同一段落中最近出现的全路径文件；③ **同名文件按单元格前缀消歧**：`purchase.ts:NN` 在"桌面"语境 = `admin-web/src/api/purchase.ts`，在"移动"语境 = `app-mobile/src/api/modules/purchase.ts`（本文件两处移动引用已写全路径）；`Suppliers.vue` = `admin-web/src/views/purchase/Suppliers.vue`（移动端同名页为 `app-mobile/src/pages-sub/product/suppliers/suppliers.vue`，本文件只在 §四 #25/#26 以 `suppliers/detail.vue` 形式引用移动端）；④ 本文件所有 `文件:行` 已由脚本逐条复核（产物 `docs/evidence/S3-214/03-citation-audit.txt`；脚本解析 105 条引用，无"文件不存在/行号越界"，`purchase.ts` 与 `Suppliers.vue` 两处同名歧义按 ③ 消歧）。

角色门的三套判据（本清单同时使用，缺一不可）：

1. 桌面：`meta.roles` fail-closed 判定（`admin-web/src/router/index.ts:311-314`）。
2. 后端：`requirePermission(code)` → `t_sys_role.permissions` × `matchPermission`（`backend/src/middleware/rbac-auth.ts:6-28`；`SUPER_ADMIN` 短路放行见 `:14`）。
3. 移动：菜单可见性由权限码集判定（`app-mobile/src/config/function-menu.ts:235-239` `isPageVisible`），但**页面内页签不受菜单码约束** ⇒ 移动端"看得到销售开单 ≠ 只能做销售单"。

---

## 六、⚠️ 风险组合（接线后必然 403 的组合，逐条给证据与处置选项）

**六-1 店长 × 采购计划 / 采购退货 / 供应商对账（桌面，7 条端点）**

- 事实：三个页面 `meta.roles` 含 `STORE_MANAGER`（`admin-web/src/router/index.ts:128/130/131`）；`STORE_MANAGER` 种子权限 = `store:*、sale:*、customer:*、inventory:*、report:*、dashboard:*、finance:payment、goods:price、finance:daily-settle`（`079_权限矩阵.sql:87`），**不含任何 `purchase:*` / `supplier:statement`**；`--holders purchase:create` 与 `--holders supplier:statement` 均不含店长。
- 影响：接 `purchase:create`/`purchase:approve`/`supplier:statement` 后，店长在这三个页面点击写操作**必 403**（#6/#7/#15/#29/#30/#31）。
- 处置（**需凌舟裁定**）：
  (a) 生产核对后若店长确实要在这三个页面做事 ⇒ 需**扩店长权限串**（加 `purchase:return`/`purchase:approve`/`supplier:statement` 或 `purchase:*`），属数据变更、应另立单；
  (b) 若店长本不该有这三个页面 ⇒ 改 `meta.roles`（前端改动，越出本卡范围）；
  (c) 本单只接 ✅ 组，把 7 条移出本域范围并登记为"待角色授权后接入"。

**六-2 店长/其他 `sale:bill` 角色 × 移动端采购 4 个创建端点（#1/#11/#14 + 已接线的 :13/:18 同族）**

- 事实：移动「销售开单」页的采购页签**无条件渲染**（`app-mobile/src/pages/sales/create-sale.vue:23`），页内可提交 `pur_order`（`:2159` `purchaseApi.createOrder`）、`pur_inbound`（`:2112` `purchaseApi.createInStock`）、`pur_return`（`:2270` `purchaseReturnApi.create`）、`pur_payment`（`:2211` `submitPayment` → `purchase.ts:91`）。
- 影响：任何持有 `sale:bill` 的角色（店长、店长运营岗等）今天能提交这 4 类采购单据；接线后若无 `purchase:*` ⇒ 手机端**由可用变 403**。
- 处置（**需凌舟裁定**）：(a) 生产核对 `sale:bill` 持有者的 `purchase:*` 情况；(b) 若不该由销售侧提交采购单据 ⇒ 前端页签加权限门（越出本卡范围，另立单）；(c) 若应允许 ⇒ 相应角色加 `purchase:create`。

**六-3 财务 × 采购付款审核（#12）**

- 事实：页面按钮"审核"已存在（`PurchasePayments.vue:358` 调 `approvePurchasePayment`）；`FINANCE_STAFF` 种子 = `finance:*、report:*、customer:statement、supplier:statement、dashboard:view`（`079:91`），**不持 `purchase:*`**；`--holders purchase:approve` 不含财务。
- 影响：接 `purchase:approve` 后，财务（业务上最可能审核付款的人）必 403；页面本身 `meta.roles` 仅 `SUPER_ADMIN`（`:132`），所以**这不是页面破，是职责归属待定**。
- 处置（**需凌舟裁定**）：用 `purchase:approve`（采购侧审核）还是 `finance:payment:create`（`079:214`，财务口径）——取决于生产里付款审核人是谁；两者持有者不同，不能同时写。

**六-4 仓管 × 采购入库审核（#9）**

- 事实：`WAREHOUSE_STAFF` 种子 = `inventory:*、trace:*、transfer:*、stock-check:*`（`079:90`），不持 `purchase:*`；`--holders inventory:inbound` = SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER / PURCHASE_STAFF / WAREHOUSE_STAFF。
- 影响：若入库审核由仓管执行，`purchase:approve` ⇒ 403；`inventory:inbound` 可覆盖仓管+采购员+店长。
- 处置（**需凌舟裁定**）：#9/#12 的码取向二选一（采购口径 or 库存/财务口径）。

---

## 七、需凌舟在生产核对的具体查询（逐条 + 期望 + 不符时处置）

> 全部**只读**。口径：以生产 `t_sys_role.permissions`（JSON 数组串）为真值，按 `matchPermission`（`*` / `dom:*` / `*:action` / 精确）判定，**不要只看字符串相等**。

| 编号 | 查询 | 判据 / 期望 | 不符时 |
|:--|:--|:--|:--|
| Q1 | `SELECT role_code, role_name, tenant_id, permissions FROM t_sys_role WHERE status = 1 ORDER BY tenant_id, role_code;` | 产出**生产角色全集 + 权限串**（仓库种子可能缺角色，脚本自述：生产另有 `STORE_ADMIN`/`SALESMAN` 等） | 把新增角色名补进 §六 的判定面 |
| Q2 | 对 Q1 结果按 `matchPermission` 复算：`purchase:create`、`purchase:approve`、`purchase:supplier`、`supplier:statement`、`inventory:inbound`、`finance:payment` 各自的**持有角色集合** | 用于确认 §六 四条风险是否在生产同样成立 | 生产持有者 ⊉ 页面角色 ⇒ 走 §六 处置 (a)/(c) |
| Q3 | `SELECT role_code, permissions FROM t_sys_role WHERE JSON_SEARCH(permissions, 'one', 'purchase%') IS NOT NULL;`（辅助：粗筛含采购字样的角色） | 快速定位**除采购员外还有谁**持有采购码 | 与 Q2 交叉验证 |
| Q4 | `SELECT role_code, permissions FROM t_sys_role WHERE role_code IN ('STORE_MANAGER','STORE_ADMIN','SALESMAN','STORE_OPERATOR','FINANCE_STAFF','WAREHOUSE_STAFF','PURCHASE_STAFF');` | 重点核 §六 的 5 个角色：**店长/财务/仓管是否持 `purchase:*` 或 `supplier:statement`** | 同上 |
| Q5 | `SELECT menu_code, menu_name, menu_type, parent_id FROM t_sys_menu WHERE menu_code LIKE 'purchase:%' OR menu_code LIKE 'supplier:%' ORDER BY menu_code;` | 确认采购菜单码/按钮码在生产**菜单库已落库**（`purchase:order/inbound/return/payment/supplier/create/approve`） | 缺码 ⇒ 接线后前端菜单/按钮与后端码对不上，需先补菜单数据 |

**另需凌舟回答的 2 个口径问题**（不查库，属裁定）：

1. **作废类端点（#3/#10/#13/#16）用 `purchase:create` 还是另立 `purchase:void`？**（销售域有 `sale:void` 先例，`079:206`；采购域无对应码，本清单暂用 `purchase:create`。）
2. **#9/#12 的审核归属**（见 §六-3/六-4）——决定用 `purchase:approve` 还是 `inventory:inbound`/`finance:payment:create`。

---

## 八、卡外观察（**未修**，仅登记，供凌舟决定是否另立单）

1. **桌面「采购订单」审核按钮打的是不存在的路由**：`PurchaseOrders.vue:315` 调 `confirmPurchaseOrder`（`api/purchase.ts:41`）→ `POST /admin/purchase-orders/:id/confirm`，而后端 `purchase.routes.ts` **没有** `/confirm` 路由（只有 `/:orderNo/approve`）⇒ 该按钮今天应为 404。同族：`api/purchase.ts:103` `payPurchasePayment` → `/purchase-payments/:id/pay`、`:153` `approvePurchasePlan` → `/purchase-plans/:id/approve`、`:161` `cancelPurchasePlan` → `/purchase-plans/:id/cancel`、`:36` `cancelPurchaseOrder` → `/purchase-orders/:id/cancel`（后端是 `:orderNo`，且 id/单号语义不同）；`api/misc.ts:68/73/78` 合同用 `:id`，后端是 `:contractNo`（`purchase-contract.routes.ts:10-12`）。
2. **供应商联系人路径不一致**：前端 `api/purchase.ts:185` POST `/admin/supplier-contacts`（body 带 `supplierId`），后端只有 `POST /api/admin/supplier-contacts/supplier/:supplierId`（`supplier-contact.routes.ts:14`）；另有一条 `POST /api/admin/suppliers/:id/contacts`（`supplier.routes.ts:13`）**全仓无调用方**。
3. **13 条端点当前无任何前端调用方**：#2/#4/#5/#9/#10/#13/#16/#20/#27/#28 + 移动侧 `app-mobile/src/api/modules/purchase.ts:142/138` 的订单更新/创建（函数存在、页面未用）。它们接码后**无回归面**，但也说明"接了不影响任何人"——**不应据此降级为不接**（无权限码=任何登录用户可调，属安全面）。
4. **前端角色模型与 RBAC 码模型错位**：桌面采购页几乎全部只给 `SUPER_ADMIN`，而 `PURCHASE_STAFF`（采购员，RBAC 里唯一专职采购角色）在桌面**打不开任何采购页**，只能走移动端（`purchase:order/inbound/supplier`）。两个模型谁是准的，需凌舟裁定（影响本单 #6/#7/#14/#15/#29-31 的处置方向）。

---

## 九、复算与证据

```powershell
cd D:\Users\ZXQL\wt-agents\S3-214
git log --oneline -1                                   # e6c6f95b（基线）
node backend/scripts/guard-rbac-wiring.mjs             # 641 缺口 / 155 文件
node backend/scripts/guard-rbac-wiring.mjs --strict    # EXIT=0
node docs/evidence/S3-214/tools/domain-gaps.mjs        # 域级 join（31 条）
```

| 证据文件 | 内容 | SHA256 |
|:--|:--|:--|
| `docs/evidence/S3-214/00-guard-report.txt` | 门禁报告模式原始输出（641 缺口 / 155 文件 / 台账核对 641-0-0） | `60D2341265C686518FC00D466F4A7C681893E685D7348F5DF3D29F084D8BD282` |
| `docs/evidence/S3-214/00-baseline-json.txt` | 门禁机读模式原始输出（763 写端点） | `5FEA66AB332F040E1025C69F0D4C32CCB40A52C478D52A2807846A230AD4161B` |
| `docs/evidence/S3-214/02-domain-gaps.txt` | 17 域缺口分布（采购域 33 端点 / 31 缺口） | 见文件 |
| `docs/evidence/S3-214/tools/domain-gaps.mjs` | 域级 join 脚本（只读，供任何人复算） | 见文件 |

---

## 十、未完成与阻塞（阶段①）

1. **阶段②未开工**（按卡面红线：未得凌舟核对结论前不许接线）——等 §七 的 Q1–Q5 与 2 个口径问题。
2. **生产 `information_schema`/`t_sys_role` 取不到**（本机 `.env` 指向 127.0.0.1，且卡面规定生产核对由凌舟做）⇒ 本清单所有"持有角色"均为**仓库种子口径**，已逐处显式标注。
3. **未跑 MariaDB 对照**（判据只取 MySQL 8 生产形态）；**未做 CI 侧验证**（红线禁 push/PR）。
4. 本清单**不含** `docs/tasks/R101-RBAC接线缺口清单.md` 的修改（该文件不在本卡授权范围；若凌舟要把它作为阶段②的"已接线"登记源，请在阶段②卡里写明允许改哪些行）。

---

派单人：凌舟（主代理）｜2026-10-15　　执行方：阿坚（后端/权限）｜2026-10-15
