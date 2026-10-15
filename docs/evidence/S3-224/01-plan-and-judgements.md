# S3-224 · 销售域接线「判定与依据」留档

> 执行方：阿坚（后端 / 权限）｜本地子代理 `/root/s3228_ajian`｜派单卡：`docs/tasks/inbox/ACTIVE-S3-224.md`
> 工作树：`D:\Users\ZXQL\wt-agents\S3-224`｜分支 `feat/s3-224-sales-domain-wiring`
> 开工基线：`origin/main`（真值见回执 §一）

## 一、开工第一步：把「台账 88 条」还原成「当前真实缺口」

台账 `docs/tasks/R101-RBAC接线缺口清单.md` §三.5 的数字（17 文件 / 91 端点 / 88 管理面 + 3 公开）
是 **S3-180 期快照**，与今天的真实状态有 5 处偏移，必须先用**机读真值**替换（否则对账必然不平）：

| 偏移 | 说明 | 处置 |
|:--|:--|:--|
| 台账判「管理面」的 4 条小程序售后端点 | S3-205 起按「消费者端保护形态」登记进 `consumerEnd`，**不算缺口** | 从 88 里剔除（4 条） |
| `admin-order.routes.ts` 新增 1 条 | S3-209 的 `POST /sale-bills/:billNo/cancel` 已接线（`sale:cancel`） | 非缺口 |
| `store-sale-bill.routes.ts` 新增 1 条 | 同上文件 `POST /` 已接线（`sale:create`） | 非缺口 |
| `sale-return.routes.ts` 新增 1 条 | `POST /:returnNo/refund` 已接线（`sale:return`） | 非缺口 |
| `admin-marketing-flash-sale.routes.ts` 新增 2 条 | 该文件 4 条已接线（`sale:create`），另有 `/pause`、`/grab` 共 6 条写端点 | 非缺口 |

**机读真值（本单起点）**：`node backend/scripts/guard-rbac-wiring.mjs --json`
⇒ 本域 17 个文件 **写端点 100 条 / 仍缺口 87 条**（原始输出 `10-guard-before.txt`）。

## 二、判定口径（沿批 1~5 已跑通的口径，逐端点一条）

1. **先查两道闸**（批 3 教训）：`rbac-g0-wiring.test.ts`（G0 名单 + `NOT_IN_G0` 范围控制 + 已知锁定）、
   `rbac-g1-wiring.test.ts`（`UNWIRED` 12 行）、`rbac-g2-wiring.test.ts`（`UNWIRED` 11 行）⇒ 本域**命中 2 行锁定**（见 §四）；
2. **调用面**：`docs/evidence/S3-224/tools/callers.mjs` + `tools/page-callers.mjs`（两遍：URL→api 封装→页面），
   逐条给「页面调用点（文件:行）」；api 封装无页面使用者一律记「无页面调用点」；
3. **持有核对**：用**生产只读导出** `docs/evidence/S3-220/00-prod-roles-raw.txt`（12 角色 / 租户 `default`）
   × `matchPermission` 复算（工具 `docs/evidence/S3-220/tools/prod-holders.mjs`，原始输出 `05-prod-holders.txt`）；
   判据 = **页面角色／菜单码持有角色 ⊆ 权限码持有人**；
4. **页面角色**：admin-web 取 `admin-web/src/router/index.ts` 的 `meta.roles`；
   app-mobile 取「入口」——`config/function-menu.ts` 的菜单码（可枚举）／ 首页快捷入口与 tabBar（无条件可达）；
5. **B 类（不接）**：存在 app-mobile 写调用点，且该页**使用者集合不可枚举** ⇒ 不接、逐条登记
   （与 S3-198 §9.1、S3-220 §12.3、S3-223 §13.1③ 同口径）；
6. **查询型 POST** 不按写端点接（不改数据）⇒ 不接、登记；
7. **公开端点**按台账口径免鉴权 ⇒ 不接、逐条登记理由。

### 2.1 「不可枚举」的三类入口（本单口径，逐条留痕）

app-mobile 页面能否解出「使用者集合」，取决于它的**入口**：

| 入口形态 | 使用者集合 | 本单处置 |
|:--|:--|:--|
| `function-menu.ts` 菜单项（有 `code`）且**无**其它无门入口 | 该菜单码的生产持有角色 | **可枚举** ⇒ 按 `⊆ 持有人` 判定后接线 |
| tabBar 固定项 / 首页快捷入口 / 推送深链（`native/push.ts`）/ 「我的」页 | 任意登录态商家用户 | **不可枚举** ⇒ B 类，不接 |
| 仅在 `pages.json` 注册、**全仓无任何导航入口**（孤岛页） | 静态证据只能证明「仓库内无引用」，**不能**证明「线上无人直连该 URL」 | **不可枚举** ⇒ B 类，不接（保守） |

> 孤岛页的处置属**保守选择**：孤岛页无入口 ⇒ 实际上"看得到按钮"的角色为空，若不接线则零回归、
> 若接线亦大概率零回归。本单按「**无法证明**不误伤 ⇒ 不接」处理，并把可得方案（码位）在 §五 一次性给出，
> 由凌舟一句话决定是否翻牌（翻牌只需把对应行的 `requirePermission(...)` 加上，本单已备好反测位）。

## 三、生产持有事实（本批判据起点，先测再判）

原始输出：`05-prod-holders.txt`（`node docs/evidence/S3-220/tools/prod-holders.mjs <码…>`）

| 码 | 生产持有角色（租户 `default`，12 角色复算） | 备注 |
|:--|:--|:--|
| `sale:create` | SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER / **STORE_OPERATOR** / SALES_STAFF | 唯一覆盖收银员的销售写码 |
| `sale:edit` | SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER | 收银员**不持** |
| `sale:void` | 同上 | 同上（作废属高风险） |
| `sale:cancel` | 同上 | S3-209 立码（`docs/migrations/203`），本单沿用 |
| `sale:return` | SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER / **STORE_OPERATOR** | 退货语义 |
| `finance:daily-settle` | SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER / **STORE_OPERATOR** / FINANCE_STAFF | 班结/日结语义 |
| `sale:bill` / `sale:record` / `sale:miniapp` / `sale:cart` | SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER | 079 MENU 码 |
| `report:finance` / `finance:payment` | SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER / FINANCE_STAFF | 收银员**不持** |
| `marketing:create` / `marketing:flash-sale` | SUPER_ADMIN / OPERATION_ADMIN | 店长**不持** |
| `store:transfer` / `store:edit` | SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER | — |
| `goods:price` | SUPER_ADMIN / OPERATION_ADMIN / STORE_MANAGER | — |

⚠️ `aftersale:*` 只是 CUSTOMER_SERVICE 的权限串通配，**`t_sys_menu` 里没有任何 `aftersale:*` 行**
（`rg aftersale docs/migrations` 只有 079/128 的角色串）⇒ 「售后域细码」在本仓**不存在**，不可挂。

## 四、两道闸命中：本批**不接**的 2 行锁定

| # | 端点 | 锁定锚点 | 说明 |
|--:|:--|:--|:--|
| 1 | `POST /api/admin/sale-returns/`（`sale-return.routes.ts:14`） | `rbac-g0-wiring.test.ts:729`（`NOT_IN_G0`，断言 READONLY 仍 200）＋ `rbac-g1-wiring.test.ts:285`（C 类）＋ `rbac-g2-wiring.test.ts:350-362`（**R 类**：同一 Router 双挂载 `/api/store/sale-returns`） | 接线会让 `/store/sale-returns` 一并要求权限；admin-web `pos/SaleReturnView.vue:216`（`createStoreSaleReturn`，页面角色含 **STORE_OPERATOR**）与 app-mobile 同族调用点会 403 ⇒ 不接 |
| 2 | `POST /api/store/sale-bills/:billNo/payment`（`store-sale-bill.routes.ts:14`） | `rbac-g0-wiring.test.ts:730`（`NOT_IN_G0`，断言 READONLY 仍 200；注释标「归 G2」） | 不接（改断言未获授权） |

## 五、逐条判定总表（87 条，与机读台账逐条对齐）

> 说明：`W` = 本批接线；`B` = app-mobile 写调用点落在**使用者不可枚举**的页；`L` = 既有锁定；
> `Q` = 查询型 POST；`P` = 公开端点（免鉴权）；`C` = 消费者端形态；`W-M` = 待授权模型定案。

（执行时逐组落盘：组 1/2/3 的明细见 `docs/evidence/S3-224/20-*.md` 与回传卡。）

## 六、卡外观察（只登记不动手）

1. **`cart.routes.ts` 的 6 条写端点实际是消费者端形态，但静态门禁看不见**：
   该文件用**声明式** `routeConfig.auth = "requireConsumerAuthWithTenant"`（`cart.routes.ts:24-28`），
   而 `guard-rbac-wiring.mjs` 的「消费者端保护形态」判据要求 `requireConsumerAuthWithTenant` 与 `csrfMiddleware`
   **在同一挂载调用里成对出现**（脚本 `isConsumerProtectedCall`）⇒ 声明式写法扫不到，6 条被记成「无授权形态」。
   对照：`miniapp.routes.ts` / `aftersale.routes.ts` / `notification.routes.ts` 是**内联**写法，已被正确登记进
   `consumerEnd`（39 条）。⇒ 建议另立单：给 `cart.routes.ts` 的写端点补内联成对中间件（或在门禁里识别声明式消费者认证），
   并把 6 条登记进 `consumerEnd`。**本单不接这 6 条**（挂商家码会把消费者打成 403，同 S3-203 `trace:*` 教训）。
2. **app-mobile 孤岛页共 6 个**：`pages-sub/order/order-exception/exception.vue`、`pages-sub/product/price-push/price-push.vue`、
   `pages-sub/order/order-aftersale/aftersale.vue`、`pages-sub/order/sales/sale-bills.vue`、
   `pages-sub/product/collection-link/collection-link.vue`、`pages-sub/finance/instant-retail/{orders,config,products}.vue`
   ——均在 `pages.json` 注册，但 `rg` 全仓无 `navigateTo/redirectTo/function-menu/tabBar/push` 引用。
3. **`pages/home/home.vue:69/75/81/87` 的「快捷入口」是硬编码且无权限门**（快速开单→`/pages/sales/create-sale`、
   单据管理→`/pages/orders/orders`、扫码入库、会员管理）⇒ 这 4 个页面**无条件可达**，
   是 app-mobile 侧 B 类的主要来源（与批 4 的 M 类同源）。
4. **`pages/orders/order-detail.vue`** 同时经 `pages/orders/orders.vue`（菜单码 `sale:record`）与
   `native/push.ts:105` 的推送深链（无门）进入 ⇒ 其写调用点不可枚举。

## 七、复算命令（任何人可自行核对）

```
node backend/scripts/guard-rbac-wiring.mjs            # 报告模式：本域缺口清单
node backend/scripts/guard-rbac-wiring.mjs --json      # 机读
node backend/scripts/guard-rbac-wiring.mjs --strict    # 严格模式（未登记 ⇒ exit 1）
node docs/evidence/S3-224/tools/callers.mjs            # 第一遍：URL → api 模块
node docs/evidence/S3-224/tools/page-callers.mjs       # 第二遍：api 封装 → 页面调用点
node docs/evidence/S3-220/tools/prod-holders.mjs sale:create sale:edit …  # 生产持有复算
```
