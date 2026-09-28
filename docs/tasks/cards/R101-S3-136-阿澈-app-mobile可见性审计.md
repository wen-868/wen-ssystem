# S3-136 交付物①：商户端（`app-mobile`）页面 → 菜单码映射 + 角色可见性审计

> 派单卡：`docs/tasks/cards/R101-派单-20260929-S3-136.md`（Issue #184）
> 产出：阿澈（商户端 app-mobile · 本地通道）｜2026-09-29｜汇报对象：凌舟（总负责人）
> 工作区 / 分支：`D:\Users\ZXQL\wt-agents\issue-184` · `agent/issue-184`（**未提交**；提交/推送/PR/门禁由凌舟执行）
> 基线自证：`git log --oneline -1` = `9283d7c251`（`docs(派单): 立 S3-136…`，`git rev-parse HEAD` = `9283d7c251b5ebe812cb4765fce42012b52bfd49`）
> 本卡只做**第 1 步审计**；第 2 步（按凌舟裁定收敛）**未执行**，等凌舟回卡。

**一句话结论**：`function-menu.ts` 登记 **44 个功能页**，其自有 `code` 在 `t_sys_menu` **19 个有对应行 / 25 个无对应行**；但 **`app-mobile` 的页面可见性实际只由「模块前缀」决定**（`function-menu.ts:175` 按 `code.split(':')[0]` 过滤），⇒ **"页面码是否在菜单表里" 与 "该页能不能被某角色看到" 是两件事**；**「首页」与「我的」页共有 22 处硬编码导航入口（`home.vue` 14 处 + `profile.vue` 8 处）、0 处角色判断**（不含 tabBar 5 个 tab），使 `create-sale / stores / reconciliation / member-detail / stored-cards / stock-warning / print-records / employees / roles / settings` 等页对**任意登录角色**可达；G2 的 **11 行待裁端点中有 10 行的调用页面落在这些无条件入口链上**（唯一例外是 #3 费用新建页，它只经 `finance` 前缀过滤 ⇒ 仅财务可达，已按 G2 接线）。

---

## 〇、判据口径与数据边界（先钉死，避免"机制/策略"混用）

### 0.1 机制口径（本单唯一判法，可复跑）

```ts
// app-mobile/src/config/function-menu.ts:164-182（节选，原文见文件）
export function filterGroupsByModules(allowedModules, includeAdmin = true) {
  let base = allGroups
  if (allowedModules && allowedModules.size > 0) {
    base = allGroups
      .map((g) => ({ ...g, items: g.items.filter((it) => allowedModules.has(it.code.split(':')[0])) })) // ← :175 只看前缀
      .filter((g) => g.items.length > 0)
  }
  ...
}
// 若 allowedModules 为空/未传 → 回退全量（:171 外层判断 + :188 单条同逻辑）
```

| 环节 | 位置（`文件:行`） | 事实 |
|:--|:--|:--|
| 取菜单 | `app-mobile/src/api/modules/menu.ts:18-20` | `GET /admin/menus/user`（读 `t_sys_role_menu`），`silent: true` |
| 派生允许集 | `app-mobile/src/api/modules/menu.ts:24-38` | 拍平菜单树 → `menuCode.split(':')[0]` 的**前缀集合** |
| 过滤渲染 | `app-mobile/src/pages/functions/functions.vue:88-89,114-118,150-158` | 功能 tab 用 `filterGroupsByModules(allowedModules, false)`；`loadRoleMenus()` 失败 ⇒ `allowedModules = undefined` ⇒ **回退全量**（`:155-157`） |
| 另一处渲染 | `app-mobile/src/pages-sub/admin/more/more-functions.vue:83-85,118-123` | 「更多功能」页同一套（`includeAdmin` 默认 true） |
| **角色门禁** | `rg -n "beforeEach\|addInterceptor\|meta\.roles" app-mobile/src` | **零命中（exit=1）** ⇒ app-mobile **确无**路由级角色门禁（与 G2 审计一致） |

**⇒ 机制结论：某页对某角色可见 ⇔ 该角色持有该页 `code` 的前缀下**任一**菜单。**页面自身 `code` 是否存在于 `t_sys_menu` **不影响**可见性**（这是本单最容易被误读的一点）。

### 0.2 生产数据边界（如实报备，不冒充）

本沙箱**无数据库能力**，故**未取得**生产 `t_sys_menu` 的逐码清单：

```powershell
Get-Command mysql,mysqlsh,mycli,docker -ErrorAction SilentlyContinue   # ⇒ 空输出（均未安装）
Get-ChildItem backend\.env*                                           # ⇒ 仅 .env.example（无可用连接串）
```

**生产菜单数据须由凌舟用以下 SQL 终核（原文照抄，可直接复跑）**：

```sql
-- 0) 行数（派单卡口径：t_sys_role_menu 347 / t_sys_menu 64 = 11 CATALOG + 53 MENU）
SELECT COUNT(*) AS role_menu_rows FROM t_sys_role_menu;
SELECT menu_type, COUNT(*) FROM t_sys_menu WHERE tenant_id='default' GROUP BY menu_type;

-- 1) 生产全量菜单码（本单 §一"该码是否存在"一栏的终核依据）
SELECT menu_code, menu_name, menu_type, path FROM t_sys_menu
WHERE tenant_id='default' AND menu_type IN ('CATALOG','MENU')
ORDER BY menu_type, parent_id, sort_no;

-- 2) 角色 → 菜单（本单 §一/§三"持有角色"一栏的终核依据）
SELECT r.role_code, m.menu_code
FROM t_sys_role_menu rm
JOIN t_sys_role r ON r.id = rm.role_id
JOIN t_sys_menu m ON m.id = rm.menu_id
WHERE r.tenant_id='default' AND m.tenant_id='default'
ORDER BY r.role_code, m.menu_code;

-- 3) 逐菜单反查持有角色
SELECT m.menu_code, GROUP_CONCAT(DISTINCT r.role_code ORDER BY r.role_code) AS holders
FROM t_sys_menu m
LEFT JOIN t_sys_role_menu rm ON rm.menu_id = m.id
LEFT JOIN t_sys_role r ON r.id = rm.role_id
WHERE m.tenant_id='default'
GROUP BY m.menu_code ORDER BY m.menu_code;
```

在两处**已标注来源**的输入上做本单判定，**不以仓库种子冒充生产**：

- **输入 A（生产实测，凌舟 2026-09-26 逐字给出，非本单自造）**：`docs/tasks/cards/R101-派单-20260926-S3-125.md` §一「生产『角色 → 菜单』矩阵」（8 角色；`t_sys_role_menu` 347 行 / `t_sys_menu` 64 行）。
- **输入 B（仓库种子，仅供交叉校验，**不是生产数据**）**：`docs/migrations/079_权限矩阵.sql:100-197`（`t_sys_menu` INSERT：11 CATALOG + 53 MENU = 64，行数与生产口径一致，故可作低风险交叉校验）。

> **已知不一致（沿用 G2 审计的反例，登记不改）**：输入 A 把店长/操作员的 `goods:*` 写作 **6** 条，而 079 种子商品子菜单实为 **7** 条 ⇒ 说明**生产与种子在细节上可能不同**，逐码结论必须以 §0.2 的 SQL 终核为准。

### 0.3 存在性判定分级（本卡 §一 最后一栏的取值定义）

| 级 | 含义 | 依据 |
|:--:|:--|:--|
| **A 逐字** | 生产矩阵**逐字**列出该 `menu_code` | 输入 A |
| **B 前缀** | 矩阵按 `xxx:*(n)` 通配给出，且 079 种子含该码 | 输入 A + B |
| **C 仅种子** | 079 种子有该码，但矩阵中**无任何角色持有该前缀** | 输入 B |
| **D 种子无** | 079 种子**零命中**，矩阵亦未列 ⇒ 生产**极可能无**（**需 SQL 终核**，不由本单定性） | 输入 B + A |

---

## 一、页面 → 菜单码映射表（`function-menu.ts` 全量 44 项，逐条给行号）

计数自证：`(rg -c "^      \{ code: '" app-mobile/src/config/function-menu.ts)` ⇒ **44**。

「079 种子」= 该 `code` 字符串在 `docs/migrations/079_权限矩阵.sql` 的 `t_sys_menu` INSERT 中的命中数（**交叉校验，非生产数据**）。
「持有该前缀的角色（生产矩阵）」= 输入 A 中持有该 `code` **前缀**下任一菜单的角色 ⇒ **机制上能看到该页**的角色（`READONLY` 全开 64 个，属只读角色，单列不计入写入面）。

| # | 分组 | 菜单项 | 页面 path | `code` | 前缀 | `function-menu.ts` 行 | 079 种子 | 存在性分级 | 持有该前缀的角色（机制可见性） |
|--:|:--|:--|:--|:--|:--:|:--:|:--:|:--:|:--|
| 1 | 开单收银 | 销售开单 | `/pages/sales/create-sale` | `sale:bill` | sale | 38 | 1 | **A 逐字** | 店长 / 操作员 / 销售 / 客服 |
| 2 | 开单收银 | 销售记录 | `/pages/orders/orders` | `sale:record` | sale | 39 | 1 | **A 逐字** | 店长 / 操作员 / 销售 / 客服 |
| 3 | 商品库存 | 商品分类 | `/pages-sub/product/categories/categories` | `goods:category` | goods | 46 | 1 | **B 前缀** | 店长 / 操作员 / 采购 / 仓管 |
| 4 | 商品库存 | 价格管理 | `/pages-sub/product/price/price-manage` | `goods:price` | goods | 47 | 1 | **B 前缀** | 店长 / 操作员 / 采购 / 仓管 |
| 5 | 商品库存 | 批次管理 | `/pages-sub/product/batches/batch-list` | `goods:batch` | goods | 48 | 1 | **B 前缀** | 店长 / 操作员 / 采购 / 仓管 |
| 6 | 商品库存 | 库存管理 | `/pages-sub/product/inventory/inventory` | `goods:inventory` | goods | 49 | 1 | **B 前缀** | 店长 / 操作员 / 采购 / 仓管 |
| 7 | 商品库存 | 库存预警 | `/pages-sub/product/stock-warning/stock-warning` | `goods:stock-warning` | goods | 50 | **0** | **D 种子无** | 店长 / 操作员 / 采购 / 仓管（**且经我的页无条件入口 ⇒ 全角色**，见 §二） |
| 8 | 商品库存 | 盘点调拨 | `/pages-sub/product/stock-check/stock-checks` | `goods:stock-check` | goods | 51 | **0** | **D 种子无** | 店长 / 操作员 / 采购 / 仓管 |
| 9 | 商品库存 | 报损报益 | `/pages-sub/finance/loss-gain/loss-gain-report` | `goods:loss-gain` | goods | 52 | **0** | **D 种子无** | 店长 / 操作员 / 采购 / 仓管 |
| 10 | 采购供应商 | 采购订单 | `/pages-sub/finance/purchase/orders` | `purchase:order` | purchase | 59 | 1 | **B 前缀** | 采购 |
| 11 | 采购供应商 | 进货入库 | `/pages-sub/finance/purchase/in-stock` | `purchase:inbound` | purchase | 60 | 1 | **B 前缀** | 采购（**首页:81 无条件入口 ⇒ 全角色**） |
| 12 | 采购供应商 | 供应商管理 | `/pages-sub/product/suppliers/suppliers` | `purchase:supplier` | purchase | 61 | 1 | **B 前缀** | 采购 |
| 13 | 客户会员 | 会员管理 | `/pages-sub/marketing/member/member-list` | `customer:list` | customer | 68 | 1 | **A 逐字** | 店长 / 销售 / 客服（**首页:87 无条件入口 ⇒ 全角色**） |
| 14 | 客户会员 | 会员等级 | `/pages-sub/marketing/member-levels/member-levels` | `customer:level` | customer | 69 | **0** | **D 种子无** | 店长 / 销售 / 客服 |
| 15 | 客户会员 | 积分管理 | `/pages-sub/marketing/points/points-detail` | `customer:points` | customer | 70 | **0** | **D 种子无** | 店长 / 销售 / 客服 |
| 16 | 客户会员 | 储值卡 | `/pages-sub/marketing/stored-cards/stored-cards` | `customer:stored-card` | customer | 71 | **0** | **D 种子无** | 店长 / 销售 / 客服（**且经首页会员链 ⇒ 全角色**） |
| 17 | 客户会员 | 收货地址 | `/pages-sub/marketing/member/address` | `customer:address` | customer | 72 | **0** | **D 种子无** | 店长 / 销售 / 客服 |
| 18 | 营销活动 | 优惠券 | `/pages-sub/marketing/marketing/coupons` | `marketing:coupon` | marketing | 79 | 1 | **C 仅种子** | **无**（8 角色无人持 `marketing` 前缀；另经推送跳转，见 §二-2） |
| 19 | 营销活动 | 营销活动 | `/pages-sub/marketing/marketing/activities` | `marketing:activities` | marketing | 80 | **0** | **D 种子无** | **无** |
| 20 | 营销活动 | 秒杀活动 | `/pages-sub/marketing/marketing/seckill-list` | `marketing:seckill` | marketing | 81 | **0** | **D 种子无** | **无** |
| 21 | 营销活动 | 拼团活动 | `/pages-sub/marketing/marketing/group-buy-list` | `marketing:group-buy` | marketing | 82 | 1 | **C 仅种子** | **无** |
| 22 | 营销活动 | 砍价活动 | `/pages-sub/marketing/marketing/bargain-list` | `marketing:bargain` | marketing | 83 | **0** | **D 种子无** | **无** |
| 23 | 营销活动 | 社区营销 | `/pages-sub/marketing/marketing/community-activities` | `marketing:community` | marketing | 84 | **0** | **D 种子无** | **无** |
| 24 | 财务对账 | 收款管理 | `/pages-sub/finance/receipts/receipts` | `finance:receipt` | finance | 91 | 1 | **A 逐字** | 财务 |
| 25 | 财务对账 | 应收账款 | `/pages-sub/finance/receivable/receivable` | `finance:receivable` | finance | 92 | 1 | **A 逐字** | 财务 |
| 26 | 财务对账 | 收银对账 | `/pages-sub/finance/reconciliation/reconciliation` | `finance:reconciliation` | finance | 93 | **0** | **D 种子无** | 财务（**且经我的页:180 无条件入口 ⇒ 全角色**） |
| 27 | 财务对账 | 费用支出 | `/pages-sub/finance/finance/expenses` | `finance:expenses` | finance | 94 | **0** | **D 种子无** | 财务（+其子页 `expense-create`） |
| 28 | 财务对账 | 对账单 | `/pages-sub/finance/statements/statements` | `finance:statement` | finance | 95 | 1 | **A 逐字** | 财务 |
| 29 | 财务对账 | 门店调拨 | `/pages-sub/finance/transfer/transfer` | `finance:transfer` | finance | 96 | **0** | **D 种子无** | 财务 |
| 30 | 数据分析·工具 | 经营报表 | `/pages-sub/finance/reports/reports` | `report:dashboard` | report | 103 | **0** | **D 种子无** | 店长 / 财务 |
| 31 | 数据分析·工具 | 销售排行 | `/pages-sub/finance/reports/sales-reports` | `report:sales` | report | 104 | 1 | **B 前缀** | 店长 / 财务 |
| 32 | 数据分析·工具 | 库存报表 | `/pages-sub/finance/reports/inventory-reports` | `report:inventory` | report | 105 | **0** | **D 种子无** | 店长 / 财务 |
| 33 | 数据分析·工具 | 采购报表 | `/pages-sub/finance/reports/purchase-reports` | `report:purchase` | report | 106 | **0** | **D 种子无** | 店长 / 财务 |
| 34 | 数据分析·工具 | 客户报表 | `/pages-sub/finance/reports/customer-reports` | `report:customer` | report | 107 | 1 | **B 前缀** | 店长 / 财务 |
| 35 | 数据分析·工具 | 财务报表 | `/pages-sub/finance/reports/finance-reports` | `report:finance-report` | report | 108 | **0** | **D 种子无** | 店长 / 财务 |
| 36 | 数据分析·工具 | 溯源查询 | `/pages-sub/product/trace/trace-query` | `goods:trace` | goods | 109 | **0** | **D 种子无** | 店长 / 操作员 / 采购 / 仓管（**另经扫码直达**，见 §二-2） |
| 37 | 门店组织 | 门店管理 | `/pages-sub/admin/stores/stores` | `store:list` | store | 117 | 1 | **A 逐字** | 店长 / 操作员 / 仓管（**且经我的页:42 无条件入口 ⇒ 全角色**） |
| 38 | 门店组织 | 员工管理 | `/pages-sub/admin/admin/employees` | `store:employees` | store | 118 | **0** | **D 种子无** | 店长 / 操作员 / 仓管（**且经我的页:50 无条件入口 ⇒ 全角色**） |
| 39 | 门店组织 | 角色管理 | `/pages-sub/admin/roles/roles` | `store:roles` | store | 119 | **0** | **D 种子无** | 店长 / 操作员 / 仓管（**且经我的页:58 无条件入口 ⇒ 全角色**） |
| 40 | 系统设置 | 单据打印 | `/pages-sub/admin/print/print-records` | `system:print` | system | 127 | **0** | **D 种子无** | **无**（8 角色无人持 `system` 前缀；**但我的页:181 无条件入口 ⇒ 全角色**） |
| 41 | 系统设置 | 系统设置 | `/pages-sub/admin/settings/settings` | `system:config` | system | 128 | 1 | **C 仅种子** | **无**（**但我的页:81 无条件入口 ⇒ 全角色**） |
| 42 | 系统设置 | 操作日志 | `/pages-sub/admin/system/operation-logs` | `system:operation-log` | system | 129 | **0** | **D 种子无** | **无** |
| 43 | 系统设置 | 报表权限 | `/pages-sub/admin/report-permission/index` | `system:permission` | system | 130 | **0** | **D 种子无** | **无** |
| 44 | 系统设置 | 更多功能 | `/pages-sub/admin/more/more-functions` | `system:more` | system | 131 | **0** | **D 种子无** | **无** |

**计数自证**：`079 种子有码 = 19`（#1-6、10-13、18、21、24、25、28、31、34、37、41），`种子零码 = 25`；`19 + 25 = 44` ✅。
**"零命中原始输出"（验收标准①，可复跑，逐码计数）**：

```powershell
$codes = @('sale:bill','sale:record','goods:category','goods:price','goods:batch','goods:inventory','goods:stock-warning','goods:stock-check','goods:loss-gain','purchase:order','purchase:inbound','purchase:supplier','customer:list','customer:level','customer:points','customer:stored-card','customer:address','marketing:coupon','marketing:activities','marketing:seckill','marketing:group-buy','marketing:bargain','marketing:community','finance:receipt','finance:receivable','finance:reconciliation','finance:expenses','finance:statement','finance:transfer','report:dashboard','report:sales','report:inventory','report:purchase','report:customer','report:finance-report','goods:trace','store:list','store:employees','store:roles','system:print','system:config','system:operation-log','system:permission','system:more')
foreach ($c in $codes) { $n = (Select-String -Path docs\migrations\079_权限矩阵.sql -Pattern ([regex]::Escape("'" + $c + "'")) -AllMatches).Matches.Count; "{0,-26} {1}" -f $c, $n }
```

原始输出（节选 = 25 条零命中中的代表，全文见本卡 §六 复跑清单第 3 条）：

```
goods:stock-warning        0
goods:stock-check          0
goods:loss-gain            0
customer:level             0
customer:points            0
customer:stored-card       0
customer:address           0
finance:reconciliation     0
finance:expenses           0
finance:transfer           0
report:dashboard           0
report:inventory           0
report:purchase            0
report:finance-report      0
goods:trace                0
store:employees            0
store:roles                0
system:print               0
system:operation-log       0
system:permission          0
system:more                0
```

---

## 二、入口可达性审计（"无菜单码"页面的无条件入口）

### 2.1 机制性门禁（有门禁，但门禁粒度是"前缀"）

只有两处渲染会做角色过滤，且都是**前缀过滤**（不是页面级）：

| 渲染处 | `文件:行` | 效果 |
|:--|:--|:--|
| 功能 tab | `app-mobile/src/pages/functions/functions.vue:88-89,114-118,150-158` | 只显示 `allowedModules` 前缀下的项；**admin 分组（门店组织/系统设置）不在此页**（`:116` 传 `includeAdmin=false`） |
| 更多功能页 | `app-mobile/src/pages-sub/admin/more/more-functions.vue:83-85,118-123` | 同前缀过滤，含 admin 分组 |
| 失败回退 | `functions.vue:155-157`、`more-functions.vue:121-122` | 接口失败/异常 ⇒ `allowedModules=undefined` ⇒ **回退全量**（本单**不**把它当"可见性成立"的理由，仅记录为已知行为） |

### 2.2 无条件入口清单（**0 处角色判断**，逐条给 `文件:行`）

| # | 入口（`文件:行`） | 目标页 | 入口性质 |
|--:|:--|:--|:--|
| 1 | tabBar `app-mobile/src/components/custom-tab-bar.vue:8 / :24 / :40 / :54 / :70` | `/pages/home/home`、`/pages/products/products`、`/pages/ai-chat/ai-chat`、`/pages/functions/functions`、`/pages/profile/profile` | 主 tab，全角色可见 |
| 2 | `app-mobile/src/pages/home/home.vue:6` | 商品列表 `/pages/products/products` | 模板硬编码 |
| 3 | `home.vue:10 → :461-481`（`:473`） | 扫码 → 商品详情 `/pages/products/product-detail` | 模板硬编码 + 扫码结果 |
| 4 | `home.vue:13 / :75 / :105 / :109 / :113 / :117 / :151 / :153` | 订单 `/pages/orders/orders` | 模板硬编码 |
| 5 | `home.vue:16` | 消息 `/pages/notifications/notifications` | 模板硬编码 |
| 6 | **`home.vue:69`** | **销售开单 `/pages/sales/create-sale`** | 模板硬编码（快捷入口「快速开单」） |
| 7 | **`home.vue:81`** | 进货入库 `/pages-sub/finance/purchase/in-stock` | 模板硬编码（「扫码入库」） |
| 8 | **`home.vue:87`** | 会员管理 `/pages-sub/marketing/member/member-list` | 模板硬编码（「会员管理」） |
| 9 | `profile.vue:7` | 编辑资料 `/pages/profile/edit` | 模板硬编码 |
| 10 | **`profile.vue:29 + :177-181`** | `todos`、`stock-warning`★、`reconciliation`★、`print-records`★ | `shortcuts` 常量数组 + `v-for` 渲染，**数组内无 roles 判断** |
| 11 | **`profile.vue:42`** | 门店管理 `/pages-sub/admin/stores/stores` | 模板硬编码 |
| 12 | **`profile.vue:50`** | 员工管理 `/pages-sub/admin/admin/employees` | 模板硬编码 |
| 13 | **`profile.vue:58`** | 角色管理 `/pages-sub/admin/roles/roles` | 模板硬编码 |
| 14 | **`profile.vue:81`** | 系统设置 `/pages-sub/admin/settings/settings` | 模板硬编码 |
| 15 | `profile.vue:89` | 消息 `/pages/notifications/notifications` | 模板硬编码 |
| 16 | `profile.vue:105 → :262-264` | AI 助手 `/pages/ai-chat/ai-chat` | 模板硬编码 |
| 17 | `app-mobile/src/pages/products/products.vue:269/:283/:327/:332/:336` | 批量调价 / 建议核价 / 价格异常 等 | 模板硬编码（商品 tab 内） |
| 18 | `app-mobile/src/pages/notifications/notification-detail.vue:171-184` | **后端 `linkUrl` 指定页** | 前端不校验角色，目标由服务端数据决定 |
| 19 | `app-mobile/src/native/push.ts:104-109` | `order-center` / `inventory` / `coupons` / `notifications` | 推送点击跳转映射，无角色判断 |
| 20 | `app-mobile/src/native/scan.ts:696-704` | 溯源查询 `/pages-sub/product/trace/trace-query` | 扫到追溯码即跳转，无角色判断 |

★ = 该目标页自身**无对应菜单码**（见 §一 的 D/C 级）。
**⇒ 本单认定的"无菜单码但有无条件入口"页面：`stock-warning`（#10）、`reconciliation`（#10）、`print-records`（#10）、`coupons`（#19）、`trace-query`（#20）、`inventory`（#19）、`order-center`（#19）**，以及**经无条件链可达**的 `member-detail` / `stored-cards`（见 2.3）。

### 2.3 零映射 / 无注册项页面的逐页可达链

| 页面 path | `code`（或"无注册项"） | 无条件入口？ | 可达链证据（`文件:行`） | 机制结论 |
|:--|:--|:--:|:--|:--|
| `/pages-sub/finance/reconciliation/reconciliation` | `finance:reconciliation`（D 种子无） | **有** | `profile.vue:180`（我的页快捷入口，数组 `:177-181` 无 roles） | **全角色可达** |
| `/pages-sub/product/stock-warning/stock-warning` | `goods:stock-warning`（D 种子无） | **有** | `profile.vue:179`；另 `inventory.vue:36/:43`（库存页内入口） | **全角色可达** |
| `/pages-sub/admin/print/print-records` | `system:print`（D 种子无） | **有** | `profile.vue:181`；另 `create-sale.vue:844`、`settings.vue:136` | **全角色可达** |
| `/pages-sub/marketing/member/member-detail` | **无注册项**（父页 `customer:list`） | **有** | `home.vue:87`（会员管理，硬编码）→ `member-list.vue:192`（列表项）/`:193`（新建） | **全角色可达** |
| `/pages-sub/marketing/stored-cards/stored-cards` | `customer:stored-card`（D 种子无） | **有**（经上一条） | `member-detail.vue:440`、`member.vue:26/:46` → 储值卡页 | **全角色可达** |
| `/pages-sub/finance/finance/expenses` | `finance:expenses`（D 种子无） | 无 | 唯一入口 = 功能中心（`function-menu.ts:94`，`finance` 前缀过滤） | 仅 `finance` 前缀持有者（= **FINANCE_STAFF**）+ READONLY |
| `/pages-sub/finance/finance/expense-create` | **无注册项**（父页 `finance:expenses`） | 无 | `expenses.vue:168`（唯一 inbound，`rg -n "expense-create" app-mobile/src` ⇒ 仅此 1 处跳转） | 仅 **FINANCE_STAFF** + READONLY |
| `/pages-sub/product/stock-check/stock-checks` | `goods:stock-check`（D 种子无） | 无 | `inventory.vue:32`（库存页内入口）；库存页自身经 `goods` 前缀 | 仅 `goods` 前缀持有者（店长/操作员/采购/仓管） |
| `/pages-sub/marketing/member-levels/member-levels` | `customer:level`（D 种子无） | 无 | `member.vue:62` | `customer` 前缀持有者 |
| `/pages-sub/marketing/points/points-detail` | `customer:points`（D 种子无） | 无 | `member.vue:22/:38`、`member-detail.vue:444` | 经 `member`/`member-detail`（**member-detail 全角色可达 ⇒ 实际全角色可达**） |
| `/pages-sub/marketing/member/address` | `customer:address`（D 种子无） | 无 | `member.vue:73` | `customer` 前缀持有者 |
| `/pages-sub/finance/transfer/transfer` | `finance:transfer`（D 种子无） | 无 | `rg -n "finance/transfer/transfer" app-mobile/src` ⇒ 仅 `function-menu.ts:96` | 仅 **FINANCE_STAFF** |
| `/pages-sub/finance/loss-gain/loss-gain-report` | `goods:loss-gain`（D 种子无） | 无 | 仅 `function-menu.ts:52` | 仅 `goods` 前缀持有者 |
| `/pages-sub/finance/reports/*`（6 页） | `report:dashboard/inventory/purchase/finance-report`（D 种子无）+ `report:sales/customer`（B） | 无 | 仅 `function-menu.ts:103-108` | 仅 `report` 前缀持有者（店长/财务） |
| `/pages-sub/admin/admin/employees` | `store:employees`（D 种子无） | **有** | `profile.vue:50`；另 `admin.vue:119/:139` | **全角色可达** |
| `/pages-sub/admin/roles/roles` | `store:roles`（D 种子无） | **有** | `profile.vue:58`；另 `admin.vue:121` | **全角色可达** |
| `/pages-sub/admin/settings/settings` | `system:config`（C 仅种子） | **有** | `profile.vue:81` | **全角色可达** |
| `/pages-sub/admin/system/operation-logs` | `system:operation-log`（D 种子无） | 无 | `settings.vue:143`、`admin.vue:125` | 经我的页→系统设置（**系统设置全角色可达 ⇒ 实际可达**） |
| `/pages-sub/admin/report-permission/index` | `system:permission`（D 种子无） | 无 | `settings.vue:144` | 同上（经系统设置） |
| `/pages-sub/admin/more/more-functions` | `system:more`（D 种子无） | 无 | `rg -n "more/more-functions" app-mobile/src` ⇒ 仅 `function-menu.ts:131` | **`system` 前缀 8 角色无人持有 ⇒ 该页对 8 角色均不可见** |
| `/pages-sub/marketing/marketing/*`（6 页） | `marketing:*`（C/D） | 部分有 | `marketing.vue:134`、`member.vue:30/:54`；**推送跳转** `push.ts:107`；`marketing` 父页自身仅 `function-menu.ts:79-84` | `marketing` 前缀 8 角色无人持有 ⇒ 功能中心不可见；**但 `push.ts:107` 与会员页入口可直达优惠券页** |
| `/pages-sub/product/trace/trace-query` | `goods:trace`（D 种子无） | **有** | `scan.ts:696-704`（扫追溯码直达） | **全角色可达（扫码路径）** |

### 2.4 §二 小结（机制层）

1. **无条件入口是"绕过菜单机制"的第二通道**：`home.vue`（`@tap` 于 `:6/:10/:13/:16/:69/:75/:81/:87/:105/:109/:113/:117/:151/:153` = 14 处）与 `profile.vue`（导航型 `@tap` 于 `:7/:29/:42/:50/:58/:81/:89/:105` = 8 处）共 **22 处硬编码导航入口全部无角色判断**，且**至少 5 个零码页面直接/间接受其支配**（`reconciliation`、`stock-warning`、`print-records`、`member-detail`、`stored-cards`）+ `stores`/`employees`/`roles`/`settings`（有码但入口无条件）。
2. **前缀过滤有"误伤"与"漏挡"两侧**：`system` 与 `marketing` 两个前缀在 8 角色矩阵里**无人持有** ⇒ 系统设置组（5 页）与营销组（6 页）在功能中心对**全部 8 个角色**不可见（仅 READONLY 可见）；反过来，**页面级码缺失（D 级 25 项）完全不影响可见性**。
3. **接口失败回退全量**（`functions.vue:155-157`）会让功能中心在前缀集为空时展示全部功能——本单**不**将其作为可见性成立的理由，仅登记为机制风险（第 2 步是否收敛由凌舟裁定）。

---

## 三、G2 的 11 行 × 页面 × 可达角色

行号 = **当前工作区代码**（已逐条复核，来源：`R101-S3-125-阿坚-Audit.md` §三，本单复跑一致）；「可达角色（机制）」= §二 得出的**能走到该页**的登录角色（不含 READONLY 的写能力，READONLY 只读）。

| # | 端点（方法 路径） | 后端 `文件:行` | 当前是否已挂 `requirePermission` | app-mobile 调用点（`文件:行`） | 涉及页面 | **可达角色（机制层）** | 备注 |
|--:|:--|:--|:--:|:--|:--|:--|:--|
| 1 | POST `/api/admin/bank-accounts` | `backend/src/routes/bank-account.routes.ts:10` | **未挂** | `stores.vue:241`（`bankAccountsApi.create` → `api/modules/stores.ts:141`） | `/pages-sub/admin/stores/stores` | **全部登录角色**（我的页 `profile.vue:42` 无条件入口；有码 `store:list` 仅店长/操作员/仓管） | G2 待裁（B） |
| 2 | POST `/api/admin/bank-accounts/:id/close` | `bank-account.routes.ts:14` | **未挂**（同文件 `:12/:13` 的 freeze/unfreeze **已挂** `finance:create`） | `stores.vue:263`（`stores.ts:146`） | 同上 | **全部登录角色** | G2 待裁（B） |
| 3 | POST `/api/admin/expenses` | `expense.routes.ts:8` | **已挂 `finance:create`** ✅ | `expense-create.vue:82`（`api/modules/expenses.ts:90`） | `/pages-sub/finance/finance/expense-create`（无注册项，父页 `finance:expenses`） | **仅 FINANCE_STAFF**（+READONLY 读）——唯一入口是功能中心 `finance` 前缀 | G2 已接（**本单复核：可达集合 ⊆ `finance:create` 持有人 ✅**） |
| 4 | POST `/api/admin/receipts` | `receipt.routes.ts:8` | **未挂**（同文件 `:11` 的 writeoff **已挂** `finance:payment`） | `create-sale.vue:2202`（`api/modules/receipts.ts:54`） | `/pages/sales/create-sale` | **全部登录角色**（首页 `home.vue:69` 无条件入口） | G2 待裁（B） |
| 5 | POST `/api/admin/reconciliation/customer/:customerId/confirm` | `reconciliation.routes.ts:9` | **未挂**（该文件当前 **0 处** `requirePermission`） | `reconciliation.vue:256`（`api/modules/reconciliation.ts:69`） | `/pages-sub/finance/reconciliation/reconciliation` | **全部登录角色**（我的页 `profile.vue:180` 无条件入口） | G2 待裁（B） |
| 6 | POST `/api/admin/reconciliation/supplier/:supplierId/confirm` | `reconciliation.routes.ts:12` | **未挂** | `reconciliation.vue:258`（`reconciliation.ts:98`） | 同上 | **全部登录角色** | G2 待裁（B） |
| 7 | POST `/api/admin/store-value-cards` | `store-value-card.routes.ts:9` | **未挂** | `member-detail.vue:536`（无卡先开卡，直接 `post('/admin/store-value-cards')`） | `/pages-sub/marketing/member/member-detail` | **全部登录角色**（首页 `home.vue:87` → `member-list.vue:192/:193`） | G2 待裁（B） |
| 8 | POST `/api/admin/store-value-cards/:cardNo/freeze` | `store-value-card.routes.ts:14` | **未挂**（`:12/:13` 的 consume/refund **已挂** `finance:create`） | `stored-cards.vue:142`（`api/modules/stored-cards.ts:85`） | `/pages-sub/marketing/stored-cards/stored-cards` | **全部登录角色**（经 `member-detail.vue:440` / `member.vue:26/:46` 无条件链） | G2 待裁（B） |
| 9 | POST `/api/admin/store-value-cards/:cardNo/unfreeze` | `store-value-card.routes.ts:15` | **未挂** | `stored-cards.vue:144`（`stored-cards.ts:90`） | 同上 | **全部登录角色** | G2 待裁（B） |
| 10 | POST `/api/admin/payments-new/` | `payment-new.routes.ts:8` | **未挂**（`:11` 的 writeoff **已挂** `finance:payment`） | `create-sale.vue:2218`（`api/modules/finance.ts:128`） | `/pages/sales/create-sale` | **全部登录角色** | G2 待裁（C+B） |
| 11 | POST `/api/admin/store-value-cards/:cardNo/recharge` | `store-value-card.routes.ts:11` | **未挂** | `stored-cards.vue:115`（`stored-cards.ts:80`）、`member-detail.vue:534` | 储值卡页 + 会员详情页 | **全部登录角色** | G2 待裁（C+B） |
| 12 | POST `/api/admin/sale-returns/` | `sale-return.routes.ts:12` | **未挂**（`:15` 的 refund **已挂** `sale:return`） | **app-mobile 零调用点**（`rg -n "admin/sale-returns" app-mobile/src` ⇒ 0 命中）；admin-web 侧见 G1 审计第 28 行 | `admin-web` POS 退货页 | 前端允许角色 = {SUPER_ADMIN, STORE_MANAGER, STORE_OPERATOR}（`admin-web/src/router/index.ts:107/:263`） | G2 待裁（R+C）：两挂载点共用同一 Router（`sale-return.routes.ts:19-21`） |

**计数自证**：`12 = 已接 1（#3）+ 待裁 11（#1,2,4,5,6,7,8,9,10,11,12）`；逐行 `requirePermission` 现值见 §六-4 复跑命令。

**由上表得出的机制层关键结论（策略另议）**：

- **待裁 11 行里有 10 行的调用页面都落在无条件入口链上**（#1,2,4,5,6,7,8,9,10,11）⇒ 接线后会被锁死的**不是"某几个角色"而是"全部非许可角色"**（含店长/操作员/销售/客服/采购/仓管），这正是 G2 卡住的根因。
- 唯一"可判定且已接"的 #3，其可判定性**来自"该页没有无条件入口"**这一事实（`expense-create` 唯一 inbound = `expenses.vue:168`，而 `expenses` 只从功能中心 `finance` 前缀进入）——**这条正是"解除 G2 11 行"的样板口径**。

---

## 四、机制结论 vs 策略建议（严格分栏，策略只提建议）

### 4.1 机制结论（证据已给全，可与代码/数据逐条对账）

| 编号 | 机制结论 | 证据 |
|:--|:--|:--|
| M1 | `app-mobile` **无**路由级/页面级角色门禁 | `rg -n "beforeEach\|addInterceptor\|meta\.roles" app-mobile/src` ⇒ 0 命中；`pages.json` 无 roles 字段 |
| M2 | 可见性**只由模块前缀**决定，与页面自身 `code` 是否登记**无关** | `function-menu.ts:175`、`menu.ts:24-38` |
| M3 | 首页 + 我的页**共 22 处硬编码导航入口（home 14 + profile 8），0 处角色判断** | `rg -n "@tap" app-mobile/src/pages/home/home.vue app-mobile/src/pages/profile/profile.vue`（§2.2 表逐条给 `文件:行`） |
| M4 | 因 M3，`create-sale` / `stores` / `reconciliation` / `member-detail` / `stored-cards` / `stock-warning` / `print-records` / `employees` / `roles` / `settings`（及经其可达的 `operation-logs`、`report-permission`、`points-detail`）**对全部登录角色可达** | §2.3 |
| M5 | `marketing` 与 `system` 两个前缀在 8 角色矩阵中**无人持有** ⇒ 两组共 11 个功能项在功能中心**对 8 角色均不可见**（仅 READONLY） | §一 #18-23、#40-44 + 输入 A |
| M6 | 菜单接口失败**回退全量**，会让功能中心在前缀集为空时展示全部功能 | `functions.vue:150-158`、`more-functions.vue:118-123` |
| M7 | 另有 4 条非菜单入口通道：通知 `linkUrl`、推送映射、扫码直达、页面内跳转 | §2.2 #17-#20 |

### 4.2 策略建议（**只提建议，等凌舟裁定**；本单不实施）

| 编号 | 建议 | 理由 | 需凌舟确认点 |
|:--|:--|:--|:--|
| P1 | 首页/我的页的**写入类**入口（`home.vue:69` 快速开单、`home.vue:81` 扫码入库、`profile.vue:179/180/181` 库存预警/对账/单据打印、`profile.vue:42/50/58/81` 门店/员工/角色/系统设置）改为**按角色渲染**（复用 `allowedModules`，建议提到 `stores/` 共享，避免每页各拉一次） | 否则 §4.1 M4 永远成立，G2 的 11 行**无一行能被判定为"不锁死"** | 若某入口确属"只读/无害"，请裁定"保留但声明"（此时需给出该页确无写入口的证据） |
| P2 | 对"确无业务角色要求"的页面（如 `stock-warning`、`print-records`、`reconciliation` 若定位为全角色）**显式声明口径**并落卡，把对应 G2 行从"待裁"转为"已定口径" | 与派单卡 §二-② 第 3 类一致 | 需凌舟逐页给"全角色开放 / 限定角色"的结论 |
| P3 | 给 `finance:reconciliation`、`finance:expenses`、`customer:stored-card` 等**被 app-mobile 实际使用但无菜单行**的页面**补菜单码**（清单见 §五） | 消除"零映射"歧义，使后续（G3）判定稳定 | 补码会**改变角色可见性**（生效需重新登录，权限串在 JWT 内，4h），需凌舟决定 parent/path/sort 与是否挂角色 |
| P4 | 统一"允许集"来源：把 `function-menu` 的前缀过滤升级为**按页面 code 精确判定**（并在两处渲染共用同一 store） | 前缀粒度会"成组放开"（例如持有 `goods:category` 即看到 `goods:loss-gain`），与"页面级可见性可判定"的目标不符 | 属改造，建议另立单；本单只登记 |
| P5 | 菜单接口失败时的回退全量（M6）建议改为"**最小集 + 明确提示**" | 失败时全量展示等于临时取消门禁 | 有"锁死"风险（网络抖动时门店看不到开单入口），需凌舟权衡 |

---

## 五、建议菜单码清单（**待凌舟裁定，本单不执行、不建库**）

仅把 §一 中标 **C/D**、且**被 app-mobile 页面实际使用**的码列成清单（`menu_code / menu_name / parent / path / type`），供凌舟在运维侧决定是否补行：

| `menu_code` | `menu_name` | `parent`（建议） | `path`（建议） | `type` |
|:--|:--|:--|:--|:--|
| `finance:reconciliation` | 收银对账 | `finance`(50) | `/finance/reconciliation` | MENU |
| `finance:expenses` | 费用支出 | `finance`(50) | `/finance/expenses` | MENU |
| `finance:transfer` | 门店调拨 | `finance`(50) | `/finance/transfer` | MENU |
| `customer:stored-card` | 储值卡 | `customer`(40) | `/customer/stored-card` | MENU |
| `customer:level` | 会员等级 | `customer`(40) | `/customer/level` | MENU |
| `customer:points` | 积分管理 | `customer`(40) | `/customer/points` | MENU |
| `goods:stock-warning` | 库存预警 | `goods`(10) | `/goods/stock-warning` | MENU |
| `goods:stock-check` | 盘点调拨 | `store`(70) 或 `goods`(10) | `/goods/stock-check` | MENU |
| `goods:loss-gain` | 报损报益 | `goods`(10) | `/goods/loss-gain` | MENU |
| `store:employees` | 员工管理 | `store`(70) | `/store/employees` | MENU |
| `store:roles` | 角色管理 | `store`(70) | `/store/roles` | MENU |
| `system:print` / `system:operation-log` / `system:permission` | 单据打印 / 操作日志 / 报表权限 | `system`(100) | `/system/print` … | MENU |

> `parent`/`path` 仅为**建议**（沿用 079 种子的 id 体系与命名风格）；是否补、补哪些、是否同时挂角色，**均由凌舟决定**——本单**未执行任何 SQL、未改任何数据**。

---

## 六、复跑清单（凌舟验收用）

```powershell
# 1) 基线自证
git rev-parse --abbrev-ref HEAD ; git rev-parse HEAD ; git log --oneline -1
#   ⇒ agent/issue-184 / 9283d7c251b5ebe812cb4765fce42012b52bfd49

# 2) 机制口径（M1/M2/M6）
rg -n "beforeEach|addInterceptor|meta\.roles" app-mobile/src          # ⇒ 0 命中（exit=1）
rg -n "code\.split\(':'\)\[0\]" app-mobile/src/config/function-menu.ts # ⇒ :175 / :189
Get-Content app-mobile/src/pages/functions/functions.vue | Select-Object -Skip 149 -First 10

# 3) 页面→码映射（§一，44 项）与零命中（验收标准①②）
rg -c "^      \{ code: '" app-mobile/src/config/function-menu.ts        # ⇒ 44
rg -n "^\s+\{ code: '" app-mobile/src/config/function-menu.ts          # 逐条行号
#   逐码计数脚本见 §一（原始输出：19 条为 1，25 条为 0）

# 4) 无条件入口（§2.2 / §2.3）
rg -n "@tap" app-mobile/src/pages/home/home.vue app-mobile/src/pages/profile/profile.vue
rg -n "const shortcuts" -A 5 app-mobile/src/pages/profile/profile.vue   # ⇒ :177-181
rg -n "member-detail" app-mobile/src/pages-sub/marketing/member        # ⇒ member-list.vue:192/193
rg -n "stored-cards/stored-cards" app-mobile/src                       # ⇒ member-detail.vue:440 / member.vue:26,46
rg -n "expense-create" app-mobile/src                                  # ⇒ expenses.vue:168（唯一 inbound）

# 5) G2 11 行现状（§三）
rg -n "requirePermission" backend/src/routes/bank-account.routes.ts backend/src/routes/expense.routes.ts backend/src/routes/receipt.routes.ts backend/src/routes/reconciliation.routes.ts backend/src/routes/store-value-card.routes.ts backend/src/routes/payment-new.routes.ts backend/src/routes/sale-return.routes.ts
(Select-String -Path backend/src/routes/*.routes.ts -Pattern 'requirePermission\(' -AllMatches).Matches.Count   # ⇒ 49（全仓接线面现值）

# 6) 门禁（诚实报备：本沙箱**未取得**，原始输出见回传卡）
npm --workspace app-mobile run build
#   ⇒ failed to load config from app-mobile\vite.config.ts / spawn EPERM / EXIT=1（沙箱禁子进程）
```

---

## 七、红线自检

| 红线 | 自检 |
|:--|:--|
| ① 不改后端 / `admin-web/**` / `saas-admin/**` / `deploy/**` / `.github/**` / `docs/migrations/**`；不改生产库 | **本卡为纯审计**；工作区改动仅新增本卡与回传卡（见回传卡 §三） |
| ② 不加"统一宽松门禁"；不改 `t_sys_role_menu` 既有语义 | 未执行任何写操作、未给出统一门禁方案（仅提"按角色渲染"建议，属策略待裁） |
| ③ 不改共享文件（当前批次 / 总进度 / 踩坑日志 / API文档 / 数据库变更清单） | 未触碰 |
| ④ 不新建/改写 `docs/tasks/cards/**` 下非本单命名文件；不写 `docs/tasks/inbox/**` | 仅本卡 + `R101-S3-136-阿澈回传.md` |
| ⑤ 不 git add/commit/push；不做 gh 写操作；不调用协作/子代理类工具 | 未执行任何 git 写命令；未调用任何协作工具；未向下委派 |
| ⑥ 不代写「凌舟裁定/凌舟验收」卡；不自造派单卡 | 需裁定事项只列清单（§四 4.2、§五），等凌舟回卡 |
