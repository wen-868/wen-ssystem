# S3-223 · 财务域接线（B2 批 5）· 逐端点判定与调用面核对

- 派单人：**凌舟（总负责人）**｜派发：2026-10-16｜执行方：**阿坚（后端 / 权限）**｜本地子代理 `/root/s3227_ajian`
- 工作树：`D:\Users\ZXQL\wt-agents\S3-223`｜分支：`feat/s3-223-finance-domain-wiring`｜基线：`origin/main` = `90119ef4`（开工 `git fetch` 真值）
- 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §三.10（9 文件 / 28 写端点）＋ 本单新增 §十三
- 本文件性质：**判定依据留档**（可逐条复算）。落地代码见 `git diff`；门禁与反测原始输出见同目录 `10-*`～`23-*`。

---

## 一、开工前必做两项（派单卡 §二.1 / §二.2）

### 1.1 生产角色核对（R-PROD-READ）

**本执行方无生产库访问权**（服务器只读通道由凌舟持有）。故持有核对以**卡面下发的生产实值** ＋
**仓库种子**为依据，并逐条标注来源；**请凌舟在生产复跑**：

```sql
SELECT role_code, permissions FROM t_sys_role WHERE tenant_id='default' ORDER BY id;
```

| 角色 | 权限串 | 来源 | 对本域的含义 |
|:--|:--|:--|:--|
| `SUPER_ADMIN` | `["*"]` | 生产实测（卡面下发） | 全通（代码层亦按角色旁路，`middleware/rbac-auth.ts:14`） |
| `FINANCE_STAFF` | `finance:*` + `report:*` + `customer:statement` + `supplier:statement` + `dashboard:view` | 生产实测 | 命中 `finance:create` / `finance:receipt:create` / `finance:statement`（域通配） |
| `STORE_MANAGER` | `store:*, sale:*, customer:*, inventory:*, report:*, dashboard:*, finance:payment, goods:price, finance:daily-settle` | 生产实测 | **精确码** `finance:payment`，**无** `finance:*` ⇒ 只过「付款动作用码」的行（本批 1 行） |
| `STORE_OPERATOR` / `WAREHOUSE_STAFF` / `SALES_STAFF` / `PURCHASE_STAFF` / `READONLY` | 见 `USERS` 表 | 生产实测 / 079 种子 | 均**不持**本批任一落地码（反测「缺码」侧） |
| `OPERATION_ADMIN` | `["*"]`（另有 099 旧词表口径，两种互斥取值） | 仓库种子 | 按 `["*"]` 计入；不确定性已报备（同 S3-222 §一） |

复算命令（本工作树可跑，逐码可核对）：

```powershell
cd backend
node scripts/guard-rbac-wiring.mjs --holders finance:create            # SUPER_ADMIN / OPERATION_ADMIN / FINANCE_STAFF
node scripts/guard-rbac-wiring.mjs --holders finance:payment          # + STORE_MANAGER（精确码）
node scripts/guard-rbac-wiring.mjs --holders finance:receipt:create    # SUPER_ADMIN / OPERATION_ADMIN / FINANCE_STAFF
node scripts/guard-rbac-wiring.mjs --holders sale:commission          # + STORE_MANAGER（sale:*）
node scripts/guard-rbac-wiring.mjs --holders customer:credit           # + STORE_MANAGER（customer:*）
```

### 1.2 接线前先查两道闸（批 3 教训，**本批做了**）

| 闸 | 检查对象 | 命中结果（本域 28 行） |
|:--|:--|:--|
| ① 既有锁定/待裁名单 | `rbac-g0-wiring.test.ts`（G0 名单 + `NOT_IN_G0` 范围控制行 + 已知锁定）、`rbac-g1-wiring.test.ts`（G1 已接 8 + S3-126 已接 8 + **待裁 12**）、`rbac-g2-wiring.test.ts`（G2 已接 1 + **待裁 11**） | **命中 9 行**（见 §三）：B 类 5（G1/G2 双锁）＋ G0 `NOT_IN_G0` 3 ＋ 公开 1 |
| ② 机读门禁 `authForm` | `guard-rbac-wiring.mjs --json`（本域 9 文件 = 44 写端点：`inline` 16 → **35**、`none` 28 → **9**） | 见 `raw/10-guard-before.json` 与 `raw/11-guard-after.json` |

---

## 二、调用面核对（逐端点；这是"选码"的唯一依据）

方法：全仓 `rg`（`admin-web/src`、`app-mobile/src`、`miniapp/src`、`platform-miniapp/src`、`e2e/`、`tests/`）查每个端点 URL；
页面角色取 `admin-web/src/router/index.ts` 的 `meta.roles`（fail-closed），移动端取 `app-mobile/src/config/function-menu.ts` 的菜单码。

### 2.1 页面角色表（本域相关页面）

| 页面（`admin-web/src/router/index.ts`） | 路由 | 页面角色 |
|:--|:--|:--|
| 提成规则 | `sales/commission/rules` :112 | SUPER_ADMIN, STORE_MANAGER |
| 提成记录 | `sales/commission/records` :113 | SUPER_ADMIN, STORE_MANAGER |
| 信用管理 | `credit` :163 | SUPER_ADMIN, STORE_MANAGER |
| 收款单 | `finance/receipts` :197 | SUPER_ADMIN |
| 付款单 | `finance/payments` :198 | SUPER_ADMIN |
| 费用管理 | `finance/expenses` :200 | SUPER_ADMIN |
| 财务对账 | `finance/reconciliation` :201 | SUPER_ADMIN |
| 银行账户 | `bank-accounts` :203 | SUPER_ADMIN |
| 支付配置 | `system/payment` :249 | SUPER_ADMIN |

移动端（`app-mobile/src/config/function-menu.ts`）：收款管理 `finance:receipt` :91、收银对账 `finance:reconciliation` :93、
费用支出 `finance:expenses` :94、对账单 `finance:statement` :95、门店管理 `store:list` :117。
⚠️ 其中 `finance:reconciliation` / `finance:expenses` **在 `t_sys_menu` 无对应行**（079:153-157 财务子菜单仅
receipt/payment/statement/receivable/report）——同 `rbac-g2-wiring.test.ts:197/:276` 的既有结论。

### 2.2 逐端点判定（28 条，一条不漏）

「使用者」列 = 真实写调用点（无调用方时写明"零调用方"）；行号为改动**前**的注册行。

| # | 端点（`文件:行`） | 真实调用点（使用者） | 判定 | 落地码 / 不接理由 |
|--:|:--|:--|:--|:--|
| 1 | `bank-account.routes.ts:10` POST `/api/admin/bank-accounts/` | app-mobile 门店管理 `stores.vue:241`（`stores.ts:141`） | **不接（B）** | 该页经「我的」页无条件入口可达、角色集不可枚举；锁于 `rbac-g1:273` / `rbac-g2:232` |
| 2 | `bank-account.routes.ts:11` PUT `/api/admin/bank-accounts/:id` | `BankAccounts.vue:294`［SUPER_ADMIN］ | **已接** | `finance:create`（同文件 G1 既有码） |
| 3 | `bank-account.routes.ts:14` POST `/api/admin/bank-accounts/:id/close` | app-mobile 门店管理 `stores.vue:263` | **不接（B）** | 同上；锁于 `rbac-g1:274` / `rbac-g2:244` |
| 4 | `commission.routes.ts:12` PUT `/api/admin/commission/rules/:id` | `CommissionRules.vue:208`［SUPER_ADMIN, STORE_MANAGER］ | **已接** | `sale:commission`（同文件 S3-126 既有码） |
| 5 | `commission.routes.ts:13` DELETE `/api/admin/commission/rules/:id` | `CommissionRules.vue:226` | **已接** | `sale:commission` |
| 6 | `commission.routes.ts:16` POST `/api/admin/commission/calculate` | `CommissionRecords.vue:179`［SUPER_ADMIN, STORE_MANAGER］ | **不接（G0 锁定）** | 落在 `rbac-g0-wiring.test.ts` `NOT_IN_G0`（:705）⇒ 接线必改该断言，本批未获授权 |
| 7 | `credit.routes.ts:26` POST `/api/admin/credits/collections` | **零调用方**（`api/customer.ts:145` 导出无引用） | **不接（G0 锁定）** | 落在 `rbac-g0` `NOT_IN_G0`（:702） |
| 8 | `credit.routes.ts:27` PUT `/api/admin/credits/collections/:id` | **零调用方** | **已接** | `customer:credit`（同文件 S3-126 既有码） |
| 9 | `credit.routes.ts:29` POST `/api/admin/credits/collections/auto-generate` | **零调用方** | **已接** | `customer:credit` |
| 10 | `credit.routes.ts:30` POST `/api/admin/credits/collections/batch-remind` | **零调用方** | **已接** | `customer:credit` |
| 11 | `credit.routes.ts:50` PUT `/api/admin/credits/:customerId/limit` | `CreditView.vue:279`［SUPER_ADMIN, STORE_MANAGER］ | **已接** | `customer:credit`（**与台账机器建议 `finance:create` 不同**，见 §四） |
| 12 | `credit.routes.ts:51` PUT `/api/admin/credits/:customerId/term` | **零调用方** | **已接** | `customer:credit` |
| 13 | `expense.routes.ts:12` PUT `/api/admin/expenses/:expenseNo` | **零有效调用方**（`api/modules/expenses.ts:94` 导出无引用） | **已接** | `finance:create`（同文件 G2 既有码） |
| 14 | `expense.routes.ts:13` POST `/api/admin/expenses/:expenseNo/approve` | `ExpensesView.vue:362/374`［SUPER_ADMIN］＋ app-mobile `expenses.vue:178`、`expense-detail.vue:108` | **已接** | `finance:create` |
| 15 | `expense.routes.ts:14` POST `/api/admin/expenses/:expenseNo/void` | `ExpensesView.vue:384` ＋ app-mobile `expenses.vue:203`、`expense-detail.vue:131` | **已接** | `finance:create` |
| 16 | `payment-config.routes.ts:9` PUT `/api/payment-config/configs/:provider` | `PaymentConfigView.vue:491/510`［SUPER_ADMIN］ | **已接** | `finance:create` |
| 17 | `payment-config.routes.ts:10` POST `/api/payment-config/configs/:provider/test` | `PaymentConfigView.vue:548` | **已接** | `finance:create` |
| 18 | `payment-config.routes.ts:13` POST `/api/payment-config/bank-accounts` | 无有效调用方（页面打 `/admin/payment/bank-accounts`，路径漂移） | **已接** | `finance:create` |
| 19 | `payment-config.routes.ts:14` PUT `/api/payment-config/bank-accounts/:id` | 同上 | **已接** | `finance:create` |
| 20 | `payment-config.routes.ts:15` DELETE `/api/payment-config/bank-accounts/:id` | 同上 | **已接** | `finance:create` |
| 21 | `payment-config.routes.ts:16` POST `/api/payment-config/bank-accounts/:id/default` | 同上 | **已接** | `finance:create` |
| 22 | `payment-new.routes.ts:8` POST `/api/admin/payments-new/` | `PaymentsNewView.vue:314`［SUPER_ADMIN］＋ app-mobile 开单页 `create-sale.vue:2218` | **不接（G0 锁定 + B）** | `NOT_IN_G0`（`rbac-g0:704`）；且移动写调用点 ⇒ `rbac-g1:283` / `rbac-g2:327` |
| 23 | `payment-new.routes.ts:12` POST `/api/admin/payments-new/:paymentNo/void` | `PaymentsNewView.vue:369`［SUPER_ADMIN］ | **已接** | `finance:payment`（同文件既有码；店长精确持有 ⇒ 不因本行收窄） |
| 24 | `payment.routes.ts:20` POST `/api/pay/wx/callback` | 微信服务器直调 | **不接（公开）** | 无登录态/无浏览器会话 ⇒ 免鉴权（挂 CSRF 会把正常回调打成 403，见同文件 :18-20 注释） |
| 25 | `receipt.routes.ts:8` POST `/api/admin/receipts/` | app-mobile 开单页 `create-sale.vue:2202`（`receipts.ts:54`） | **不接（B）** | 开单页角色含无 finance 码角色；锁于 `rbac-g1:275` / `rbac-g2:256` |
| 26 | `receipt.routes.ts:12` POST `/api/admin/receipts/:receiptNo/void` | `ReceiptsView.vue:379`［SUPER_ADMIN］＋ app-mobile 收款管理页 `receipts.vue:121` | **已接** | `finance:receipt:create`（079:213 既有按钮码） |
| 27 | `reconciliation.routes.ts:9` POST `/api/admin/reconciliation/customer/:customerId/confirm` | app-mobile 对账页 `reconciliation.vue:256` | **不接（B）** | 注册码 `finance:reconciliation` 无 `t_sys_menu` 行 + 「我的」页无条件入口；锁于 `rbac-g1:276` / `rbac-g2:268` |
| 28 | `reconciliation.routes.ts:12` POST `/api/admin/reconciliation/supplier/:supplierId/confirm` | app-mobile 对账页 `reconciliation.vue:258` | **不接（B）** | 同上；锁于 `rbac-g1:277` / `rbac-g2:280` |

**对账**：`28 = 19（已接） + 5（B 类·页面角色集不可枚举） + 3（G0 范围控制锁定） + 1（公开回调）`。
缺口 **573 → 554**（文件 146 → 144；`expense.routes.ts`、`payment-config.routes.ts` 两文件清零）。

---

## 三、零回归论证（每个落地码 × 页面/按钮使用者）

| 落地码 | 持有人（§1.1 口径） | 用它的页面/按钮 | 结论 |
|:--|:--|:--|:--|
| `finance:create` | 超管、运营（`*`）、财务（`finance:*`） | 银行账户页（超管）、费用管理页（超管）+ app-mobile 费用支出（财务类）、支付配置页（超管） | ✅ 使用者 ⊆ 持有人 |
| `finance:payment` | 上述三者 + **生产店长（精确码）** | 付款单页作废（超管） | ✅（店长亦通过，属"该码固有持有面"，非本批扩面） |
| `finance:receipt:create` | 超管、运营（`*`）、财务（`finance:*`） | 收款单页作废（超管）+ app-mobile 收款管理（`finance:receipt` 菜单，持有者=财务类） | ✅ |
| `sale:commission` | 超管、运营（`*`）、店长（`sale:*`） | 提成规则页改/删（超管 + 店长） | ✅ |
| `customer:credit` | 超管、运营（`*`）、店长（`customer:*`） | 信用管理页额度调整（超管 + 店长） | ✅ |

机器复算：`rbac-b2-s3-223-finance-wiring.test.ts` 对**每一行**的**每个使用者账号**逐个试跑并断言 `200`；
对**每个非持有人**断言 `403` 且**未到达业务层**；并有「页面角色表 ↔ `router/index.ts` / `function-menu.ts` 源码同源」断言
（防测试里写一个不存在的页面角色）。原始输出见 `13-vitest-batch.txt`（154 用例）。

---

## 四、与台账「机器建议码」的差异（逐条给理由）

| # | 端点 | 台账建议 | 本批落地 | 差异理由 |
|--:|:--|:--|:--|:--|
| 11/12 | `PUT /credits/:customerId/limit`、`/term` | `finance:create` | `customer:credit` | 额度调整页 `CreditView.vue` 的 `meta.roles` 含 **STORE_MANAGER**，生产店长**不持** `finance:create` ⇒ 挂它会把店长的额度调整打成 403（同批 1 `trace:*` 形态）。`customer:credit` 是同文件 7 行既有码、持有者 ⊇ 页面角色 |
| 8/9/10 | 催收 3 行 | `finance:create` | `customer:credit` | 催收归属「授信/风控」同文件域（`credit.routes.ts`），且同文件既有码一致；若产品判定"催收应由财务办"，需**另立码**或给店长补授权（登记为待裁定项） |
| 26 | `POST /receipts/:receiptNo/void` | `finance:receipt:create` | 同左 | 与台账一致（079:213 既有按钮码「新增收款」） |
| 13/14/15 | 费用 3 行 | `finance:create` | 同左 | 与台账一致，且与同文件 G2 既有码一致 |
| 16–21 | 支付配置 6 行 | `finance:create` | 同左 | 与台账一致 |
| 23 | `POST /payments-new/:paymentNo/void` | `finance:create` | `finance:payment` | 本文件既有写行（`writeoff`）与采购域裁定（付款审核/作废）统一用 `finance:payment`；语义为"付款动作" |
| 2 | `PUT /bank-accounts/:id` | `finance:create` | 同左 | 与同文件 G1 既有码（freeze/unfreeze）一致 |

---

## 五、风险与自我报备（写在明处）

1. **无生产库访问权**：§1.1 的持有表以卡面下发实值 + 仓库种子为依据，`OPERATION_ADMIN` 存在两种互斥取值；请凌舟复跑那条 SQL 复核（同 S3-222 §四.1）。
2. **`finance:payment` 的"精确码 vs 通配"**（派单卡 §三.5 点名要求写清）：生产店长持**精确码** `finance:payment`（不含 `finance:*`）⇒ 他在 API 面通过一切挂 `finance:payment` 的行（本批 1 行：付款单作废）；**页面是否给店长**才是产品口径——付款单页 `meta.roles` 仅 `SUPER_ADMIN`，故不构成页面回归，仅属"宽授"（同 S3-214-B2 §11.5 第 4 条的既有形态）。
3. **`finance:receipt:create` 的残差**：若生产存在"仅持菜单码 `finance:receipt`（无 `finance:*`）"的角色，则该角色在移动端收款管理页作废收款单会被 403。当前种子/生产实值中**无**此类角色（财务一律 `finance:*`）⇒ 判为可接受，但如实登记。
4. **催收 3 行的码选择**（§四）属"同域一致性"判断，**不是**台账机器建议值；若凌舟认为催收应归财务专属，请裁定（改为 `finance:create` 或另立 `finance:collection`）。
5. **未接 9 行的处置**：5 行 B 类（页面角色集不可枚举）沿用 G1/G2 既有锁定，**待移动端补权限门后收编**；3 行 G0 锁定 + 1 行公开按卡面口径不接（详见回执 §三/§六）。
6. **判据边界（不藏着）**：本批只解决"有没有权限门"，**不判断码的语义是否最优**；`guard-rbac-wiring` 仍是**报告器**（未接 CI），缺口 554 条为欠账余额。

---

## 六、卡外观察（**只登记不动手**，供凌舟决定是否另立单）

1. `admin-web/src/api/finance.ts:17` 打 `PATCH /admin/bank-accounts/:id/status`、`:21/:25` 打
   `/admin/bank-accounts/:id/transactions`——后端 `bank-account.routes.ts` **无**这两条路径（前端路径漂移，调用即 404）。
2. `admin-web/src/api/finance.ts:212-216` + `views/system/PaymentConfigView.vue:466/595/598/623/633` 打
   `/admin/payment/bank-accounts**`（GET/POST/PUT/DELETE）——**后端无此前缀**（`/api/payment-config/bank-accounts` 才是实体）
   ⇒ 支付配置页的"银行账户"区块当前不可用；且 `PUT .../:id/default`（前端）与 `POST`（后端 :16）**方法不一致**。
3. `admin-web/src/api/customer.ts:126`（`PUT /credits/:customerId/term`）、`:145-161`（催收四方法）、
   `app-mobile/src/api/modules/expenses.ts:94`（`PUT /expenses/:expenseNo`）均为**导出零引用**（前端死代码）。
4. `finances/expense-detail.vue:131` 的"驳回"实际调用 `POST /expenses/:expenseNo/void`（语义为作废），
   与 `rbac-g2` 注释口径一致（后端 `expense.routes.ts:14` 注释标 VOIDED）——仅登记，不在本单改前端。
