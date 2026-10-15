# S3-222 · 客户域接线（B2 批 4）· 逐端点判定与调用面核对

- 派单人：**凌舟（总负责人）**｜派发：2026-10-16｜执行方：**阿坚（后端 / 权限）**｜本地子代理 `/root/s3225_ajian`
- 工作树：`D:\Users\ZXQL\wt-agents\S3-222`｜分支：`feat/s3-222-customer-domain-wiring`｜基线：`origin/main` = `e124173b`（开工 `git fetch` 真值）
- 台账：`docs/tasks/R101-RBAC接线缺口清单.md` §三.2（12 文件 / 45 写端点）＋ 本单新增 §十二
- 本文件性质：**判定依据留档**（可逐条复算）。落地代码见 `git diff`；门禁与反测原始输出见同目录 `10-*`～`23-*`。

---

## 一、开工前必做：生产角色核对（派单卡 §二.1）

**本执行方无生产库访问权**（服务器只读通道由凌舟持有，`tools/s3136-q.sh` 设计为**在服务器上**读 `.env` 后执行）。
故本批的持有核对以**卡面下发的批 2 生产实值 + 仓库种子**为依据，并**逐条标注**哪些角色属于「生产实值」、哪些属于「仓库种子（未经生产复核）」：

| 角色 | 权限串 | 来源 | 对本域的含义 |
|:--|:--|:--|:--|
| `SUPER_ADMIN` | `["*"]` | 生产实测（2026-10-15，凌舟） | 全通（代码层亦按角色旁路，`rbac-auth.ts:15`） |
| `STORE_MANAGER` | `store:*, sale:*, customer:*, inventory:*, report:*, dashboard:*, finance:payment, goods:price, finance:daily-settle` | 生产实测 | **`customer:*` 覆盖本域全部 5 个落地码** ⇒ 店长可见的页面零回归 |
| `STORE_OPERATOR` | `sale:create, sale:view, inventory:view, dashboard:view, sale:return, finance:daily-settle` | 生产实测 | 不持任何客户域写码（店长口径的"只读"） |
| `WAREHOUSE_STAFF` | `inventory:*, trace:*, transfer:*, stock-check:*` | 生产实测 | 不持任何客户域写码 |
| `FINANCE_STAFF` | `finance:*, report:*, customer:statement, supplier:statement, dashboard:view` | 生产实测 | **仅持 `customer:statement`** ⇒ 对账语义码成立、`customer:create/edit` 不成立 |
| `SALES_STAFF` | `sale:create, sale:view, customer:view, customer:visit, dashboard:view` | 仓库种子（079:88） | 持 `customer:visit`（拜访域精确码） |
| `CUSTOMER_SERVICE` | `customer:view, aftersale:*, miniapp:*, notification:*, dashboard:view` | 仓库种子（079:92） | 只读客户面 |
| `READONLY` | `["*:view"]` | 生产实测（S3-122-F1） | **不持任何写动作码**（本批反测的"缺码"侧） |
| `STORE_ADMIN` | `product:read, order:read, order:write, inventory:read, inventory:write, customer:read`（099 旧词表） | 仓库种子（099:36） | **不覆盖 `customer:<写动作>`**（`customer:read` ≠ `customer:edit`） |
| `OPERATION_ADMIN` | `["*"]`（另有 099 口径的 18 项旧词表，见 S3-122-F3 §注） | 仓库种子（两种互斥取值） | 按 `["*"]` 计入；**该不确定性已在 §四 报备** |

复算命令（本工作树可跑，逐码可核对）：

```powershell
cd backend
node scripts/guard-rbac-wiring.mjs --holders customer:create   # SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER
node scripts/guard-rbac-wiring.mjs --holders customer:visit    # + SALES_STAFF
node scripts/guard-rbac-wiring.mjs --holders customer:statement# SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER / FINANCE_STAFF
node scripts/guard-rbac-wiring.mjs --holders customer:payment  # SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER
```

> ⚠️ **边界（必须知道）**：`--holders` 是**仓库种子**口径；上表的"生产实测"部分来自卡面下发的批 2 核对结果。
> **仍未核实**的生产角色：`STORE_ADMIN` / `SALESMAN` / `OPERATION_ADMIN` 的权限串（脚本头注释与 S3-122-F3 均已登记该不确定性）——
> 本批的处置是：**凡这些角色可能"看得到页面/按钮"的端点，一律不硬接**（见 §三.3 的 W 类）；其余端点按"页面角色 ⊆ 持有人"判定。

---

## 二、调用面核对（逐端点；这是"选码"的唯一依据）

方法：全仓 `rg`（`admin-web/src`、`app-mobile/src`、`miniapp/src`、`platform-miniapp/src`、`e2e/`、`tests/`）查每个端点 URL；
页面角色取 `admin-web/src/router/index.ts` 的 `meta.roles`（fail-closed）；移动端取 `app-mobile/src/config/function-menu.ts` 的菜单码。

### 2.1 页面角色表（本域相关页面）

| 页面（`admin-web/src/router/index.ts`） | 路由 | 页面角色 |
|:--|:--|:--|
| 客户管理 | `customers` :160 | SUPER_ADMIN, STORE_MANAGER |
| 客户详情 | `customers/detail/:memberId` :161 | SUPER_ADMIN, STORE_MANAGER |
| 会员体系 | `member-system` :152 | SUPER_ADMIN |
| 等级配置 | `level-config` :150 | SUPER_ADMIN |
| 客户标签 | `customer-tags` :153 | SUPER_ADMIN |
| 客户关怀 | `customer-care` :155 | SUPER_ADMIN |
| 客户分群 | `customer-segments` :158 | SUPER_ADMIN |
| 拜访记录 | `customer-visits` :156 | SUPER_ADMIN, STORE_MANAGER |
| 客户类型 | `customer-types` :162 | SUPER_ADMIN |
| 客户价格 | `sales/customer-prices` :111 | SUPER_ADMIN, STORE_MANAGER |
| 客户对账 | `customer-statements` :195 | SUPER_ADMIN |
| 标签分组 | `products/tag-groups` :171 | SUPER_ADMIN, STORE_MANAGER |
| 标签关联 | `products/tag-relation` :172 | SUPER_ADMIN, STORE_MANAGER |
| 商品管理 | `products` :165 | SUPER_ADMIN, STORE_MANAGER |
| 移动端「对账单」 | `app-mobile/src/config/function-menu.ts:95` | 菜单码 `finance:statement`（生产持此菜单的角色 = FINANCE_STAFF / OPERATION_ADMIN / READONLY / STORE_ADMIN） |

### 2.2 逐端点判定（45 条，一条不漏）

「使用者」列 = 真实调用点；「判定」列取 `已接` / `不接`；行号 = 本批改动**前**的注册行（`git diff` 可复核）。

| # | 端点（`文件:行`） | 主要调用点（真实使用者） | 判定 | 落地码 / 不接理由 |
|--:|:--|:--|:--|:--|
| 1 | `admin-customer.routes.ts:12` POST `/api/admin/members` | `CustomersView.vue:276`［SUPER_ADMIN, STORE_MANAGER］ | 已接 | `customer:create` |
| 2 | `admin-customer.routes.ts:16` PUT `/api/admin/members/:id` | `CustomerDetail.vue:485`［同上］ | 已接 | `customer:edit` |
| 3 | `admin-customer.routes.ts:17` PUT `/api/admin/members/:id/disable` | `CustomerDetail.vue:457` / `CustomersView.vue:332` | 已接 | `customer:edit` |
| 4 | `admin-customer.routes.ts:18` PUT `/api/admin/members/:id/assign-staff` | **无页面调用方**（`assignMember` 打的是 `/members/:id/assign`，漂移） | 已接 | `customer:edit` |
| 5 | `admin-customer.routes.ts:25` POST `/api/admin/members/register` | `MemberSystem.vue:127`［SUPER_ADMIN］ | 已接 | `customer:create`；**台账原判「公开端点」有误**（本文件 `auth: requireAuthWithTenant`） |
| 6 | `admin-customer.routes.ts:27` PUT `/api/admin/members/:id/member-level` | `LevelConfig.vue:302` / `CustomerDetail.vue:509` | 已接 | `customer:edit` |
| 7 | `customer-care.routes.ts:8` POST `.../care/rules` | `CustomerCareRules.vue:194`［SUPER_ADMIN］ | 已接 | `customer:create` |
| 8 | `customer-care.routes.ts:9` PUT `.../care/rules/:id` | `CustomerCareRules.vue:191` | 已接 | `customer:edit` |
| 9 | `customer-care.routes.ts:10` DELETE `.../care/rules/:id` | `CustomerCareRules.vue:204` | 已接 | `customer:edit` |
| 10 | `customer-care.routes.ts:12` POST `.../care/rules/:id/execute` | `CustomerCareRules.vue:210` | 已接 | `customer:create`（同台账口径：POST=创建/触发动作） |
| 11 | `customer-merge.routes.ts:10` POST `/api/admin/customer-merge/merge` | **无页面调用方** | 已接 | `customer:create` |
| 12 | `customer-payment.routes.ts:10` POST `/api/store/customer-payments/` | **无页面调用方**（前端打 `/admin/customer-payments`，死路径） | 已接 | `customer:payment`（079:149「客户收款」；**与台账建议 `customer:create` 不同**，见 §12.6） |
| 13 | `customer-payment.routes.ts:11` POST `/api/store/customer-payments/:receiptNo/void` | 同上 | 已接 | `customer:payment` |
| 14 | `customer-price.routes.ts:9` POST `/api/admin/customer-prices/` | `CustomerPrices.vue:291`［SUPER_ADMIN, STORE_MANAGER］ | 已接 | `customer:create` |
| 15 | `customer-price.routes.ts:10` PUT `/api/admin/customer-prices/:id` | `CustomerPrices.vue`（编辑） | 已接 | `customer:edit` |
| 16 | `customer-price.routes.ts:11` DELETE `/api/admin/customer-prices/:id` | `CustomerPrices.vue:308` | 已接 | `customer:edit` |
| 17 | `customer-segment.routes.ts:8` POST `/api/admin/members/segments/` | `CustomerSegments.vue:200`［SUPER_ADMIN］ | 已接 | `customer:create` |
| 18 | `customer-segment.routes.ts:9` PUT `/api/admin/members/segments/:id` | `CustomerSegments.vue`（编辑） | 已接 | `customer:edit` |
| 19 | `customer-segment.routes.ts:10` DELETE `/api/admin/members/segments/:id` | `CustomerSegments.vue:210` | 已接 | `customer:edit` |
| 20 | `customer-segment.routes.ts:11` POST `/api/admin/members/segments/:id/refresh` | `CustomerSegments.vue:216` | 已接 | `customer:create` |
| 21 | `customer-statement.routes.ts:10` POST `/api/store/customer-statements/` | **无页面调用方**（前端打 `/store/customer-statements/generate`，死路径） | 已接 | `customer:statement`（079:147 客户对账；与台账建议不同，见 §12.6） |
| 22 | `customer-statement.routes.ts:11` POST `/api/store/customer-statements/:statementNo/confirm` | **移动端** `statements.vue:97`（菜单码 `finance:statement`） | **不接（W）** | 可见角色 {FINANCE_STAFF, OPERATION_ADMIN, READONLY, STORE_ADMIN} 中，READONLY(`*:view`) 与 STORE_ADMIN（099 旧词表）**不持任何客户域写码** ⇒ 接线即 403 回归 |
| 23 | `customer-statement.routes.ts:12` POST `/api/store/customer-statements/:statementNo/paid` | **无页面调用方** | 已接 | `customer:statement` |
| 24 | `customer-tag.routes.ts:8` POST `/api/admin/members/tags/` | `CustomerTags.vue:201`［SUPER_ADMIN］ | 已接 | `customer:create` |
| 25 | `customer-tag.routes.ts:9` PUT `/api/admin/members/tags/:id` | `CustomerTags.vue:198` | 已接 | `customer:edit` |
| 26 | `customer-tag.routes.ts:10` DELETE `/api/admin/members/tags/:id` | `CustomerTags.vue:211` | 已接 | `customer:edit` |
| 27 | `customer-tag.routes.ts:11` POST `/api/admin/members/tags/:id/tags` | **无页面调用方**（前端打 `/members/tags/add`，漂移） | 已接 | `customer:create` |
| 28 | `customer-tag.routes.ts:12` DELETE `/api/admin/members/tags/:id/tags/:tagId` | **无页面调用方**（`/members/tags/remove`，漂移） | 已接 | `customer:edit` |
| 29 | `customer-type.routes.ts:11` POST `/api/admin/customer-types/` | `CustomerTypes.vue:211`［SUPER_ADMIN］ | 已接 | `customer:create` |
| 30 | `customer-type.routes.ts:12` PUT `/api/admin/customer-types/:id` | `CustomerTypes.vue`（编辑） | 已接 | `customer:edit` |
| 31 | `customer-type.routes.ts:13` DELETE `/api/admin/customer-types/:id` | `CustomerTypes.vue:249` | 已接 | `customer:edit` |
| 32 | `customer-visit.routes.ts:15` POST `/api/admin/customer-visits/` | `CustomerVisits.vue:431`［SUPER_ADMIN, STORE_MANAGER］ | 已接 | `customer:visit` |
| 33 | `customer-visit.routes.ts:18` PUT `/api/admin/customer-visits/:visitNo` | `CustomerVisits.vue:428` | 已接 | `customer:visit` |
| 34 | `customer-visit.routes.ts:21` POST `.../:visitNo/checkin` | **无页面调用方**（`api/misc.ts` 有导出、无引用） | 已接 | `customer:visit` |
| 35 | `customer-visit.routes.ts:24` POST `.../:visitNo/checkout` | 同上 | 已接 | `customer:visit` |
| 36 | `customer-visit.routes.ts:27` POST `.../:visitNo/cancel` | 同上 | 已接 | `customer:visit` |
| 37 | `member-register.routes.ts:8` POST `/api/store/members/sms-code` | `app-mobile/src/api/modules/member.ts:23`、`auth.ts:115` | **不接（P）** | `routeConfig.auth = "none"` = **真免鉴权**公开端点（短信验证码），挂商家权限码无意义 |
| 38 | `member-register.routes.ts:9` POST `/api/store/members/register` | `member.ts:27` | **不接（P）** | 同上（注册开通） |
| 39 | `tag.routes.ts:11` POST `/api/admin/tags/groups` | `TagGroups.vue:316`［SUPER_ADMIN, STORE_MANAGER］ | 已接 | `customer:create` |
| 40 | `tag.routes.ts:12` PUT `/api/admin/tags/groups/:id` | `TagGroups.vue:311` | 已接 | `customer:edit` |
| 41 | `tag.routes.ts:13` DELETE `/api/admin/tags/groups/:id` | `TagGroups.vue`（删除分组） | 已接 | `customer:edit` |
| 42 | `tag.routes.ts:18` POST `/api/admin/tags` | **无页面调用方**（前端用的是 `/admin/product-tags`，属商品域另一文件） | 已接 | `customer:create` |
| 43 | `tag.routes.ts:19` PUT `/api/admin/tags/:id` | 同上 | 已接 | `customer:edit` |
| 44 | `tag.routes.ts:20` DELETE `/api/admin/tags/:id` | 同上 | 已接 | `customer:edit` |
| 45 | `tag.routes.ts:25` PUT `/api/admin/products/:spuId/tags` | `ProductTagRelation.vue:133` / `Products.vue:1358`［SUPER_ADMIN, STORE_MANAGER］ | 已接 | `customer:edit` |

**对账**：`45 = 42（已接） + 2（P 公开） + 1（W 待授权模型定案）`。

---

## 三、零回归论证（每个落地码 × 页面角色）

| 落地码 | 持有人（§一 口径） | 用它的页面角色 | 结论 |
|:--|:--|:--|:--|
| `customer:create` | SUPER_ADMIN(`*`)、OPERATION_ADMIN(`*`)、STORE_MANAGER(`customer:*`) | SUPER_ADMIN（客户管理/会员体系/标签/关怀/分群/类型）、SUPER_ADMIN+STORE_MANAGER（客户管理/客户价格/标签分组） | ✅ 页面角色 ⊆ 持有人 |
| `customer:edit` | 同上 | 同上（编辑/删除类动作） | ✅ |
| `customer:visit` | 上述 3 者 + SALES_STAFF（079 精确码） | SUPER_ADMIN、STORE_MANAGER（拜访记录） | ✅（且销售员持码，不误伤） |
| `customer:statement` | 上述 3 者 + FINANCE_STAFF（生产精确码 `customer:statement`） | 无桌面页面（端点无调用方）；财务为对账语义角色 | ✅（不锁死财务） |
| `customer:payment` | 上述 3 者（财务的 `finance:*` **不**覆盖客户域） | 无页面调用方 | ✅（但见 §四 报备：若将来财务要接客户收款，需补授权） |

机器复算：新增用例 `rbac-b2-s3-222-customer-wiring.test.ts` 里对**每一行**的**每个页面角色**逐个试跑并断言 `200`；
反证侧对**每个非持有人**断言 `403` 且**未到达业务层**（原始输出见 `13-vitest-batch.txt`）。

---

## 四、风险与自我报备（写在明处）

1. **无生产库访问权**：§一 的持有表里 `SALES_STAFF / CUSTOMER_SERVICE / STORE_ADMIN / OPERATION_ADMIN` 属**仓库种子**口径，
   未经生产复核；`OPERATION_ADMIN` 还存在两种互斥取值（`["*"]` vs 099 旧词表）。**请凌舟在生产复跑**
   `SELECT role_code, permissions FROM t_sys_role WHERE tenant_id='default' ORDER BY id;` 与本表比对；
   若 `OPERATION_ADMIN` 实为旧词表口径，则本批 42 行对该角色全部 403（不影响页面角色，因 `meta.roles` 未含它）。
2. **`customer:payment` 语义与持有面**：该码在 079 里是「客户收款」MENU 码；生产持它的是两个 `*` 角色 + 店长（`customer:*`），
   **财务不持**。本批两条收款端点无调用方，故不构成回归；若产品认为"收款应由财务办"，需另行补授权（登记为待裁定项）。
3. **标签域语义**：`/api/admin/tags/**`（商品标签组/标签）挂 `customer:*` 码是为满足"页面角色 ⊆ 持有人"
   （页面含 STORE_MANAGER，而店长不持 `goods:create|edit`）——语义与域不匹配，建议另立单细化（见 §12.7 卡外观察 5）。
4. **路径漂移 5 处**（前端打的路由后端不存在或形态不同）：见 §12.7；本批按**后端现状**接线，未改契约、未改前端。
