# 矩阵 10 · 路由 / 菜单矩阵（WB-REFACTOR-P0）

- 工作树（只读盘点根）：`D:\Users\ZXQL\wt-agents\WB-REFACTOR-P0`｜基线提交 `7dda80b8bf1faf3e0f6ed955724bb3cb320d49fa`
- 生成日期 2026-10-22｜执行人：工作台执行子代理（Qoder 通道，任务 WB-REFACTOR-P0 · 矩阵 10）
- 复算脚本 `docs/evidence/WB-REFACTOR-P0/scripts/parse-routes.cjs`：**本文件所有数字与三表均由该脚本产出，未手改**；`--out <dir>` 可另存 4 张 CSV + 1 份 JSON
- 真相源（refs）：路由 `admin-web/src/router/index.ts:80-276`｜人工菜单 `admin-web/src/layouts/MainLayout.vue:92-300`（侧栏）+ `:376-386`（收银台 nav）｜原型 `D:/Users/ZXQL/ZXQL-AI/docs/设计/智享全链_工作台电脑端_UI原型_融合版.html:3013`（SECTORS 一整行 JSON）+ `:3774` 起运行时 fuse 扩容｜后端 `backend/src/routes/menu-permission.routes.ts:9-16` / `backend/src/controllers/admin/menu-permission.controller.ts:13-16` / `backend/src/services/admin/menu-permission.service.ts:5-135`

## 1. 头部摘要

| 指标 | 数量 | 口径 / ref |
|---|---|---|
| 路由声明总数 | 164 | 顶层 4 + MainLayout 子路由 160；逐条 ref 见表A |
| 唯一页面组件（剔除 3 个非页面组件后） | 155 | = 卡口径 155，差异 0 |
| 去重组件文件（全集） | 158 | 含 layouts/MainLayout.vue、views/LoginView.vue、views/NotFound.vue |
| 复用同名组件的声明 | 6 条 / 6 个文件 | §2 `DUP_COMPONENT` 6 行 |
| meta.hidden 路由 | 5 | `admin-web/src/router/index.ts:138`、`admin-web/src/router/index.ts:139`、`admin-web/src/router/index.ts:140`、`admin-web/src/router/index.ts:261`、`admin-web/src/router/index.ts:269` |
| 不在任何导航的路由（合计） | 85 | = meta.hidden 5 + 无 hidden 但导航进不去 80（表A `hidden?` 列两种取值，互斥不重复计） |
| 导航可见路由 | 79 | 侧栏 71 项 + 收银台 9 项去重 80，命中路由 79 |
| 人工菜单一级分组 / 二级项 | 12 / 71 | `MainLayout.vue:94-299`（业务 / 功能 / 系统 三段） |
| 带 meta.roles 的路由 | 160 | 无 roles 的 4 条：`/login`、`/register`、`/`、`/:pathMatch(.*)*` |
| /pos 路由条数 | 15 | 收银台版块，见表A |
| 原型 SECTORS | 13 版块 / 103 二级页 | `原型 html:3013`；分版块计数与卡逐一相同，见 §2 SECTOR 行 |
| 原型运行时 fuse 追加页 | 24 | `原型 html:3774` 起；合计 127 页 |
| 原型有 · admin-web 无页面 | 24 | 全 24 条 fuse 页，且声明组件文件在 admin-web **一个都不存在**（0 存在）→ 表B-1 |
| 原型有 · admin-web 也有 | 103 | routeName 精确 49 + 组件文件命中 54 |
| admin-web 有 · 原型未列 | 61 | 表B-2 |
| 后端 `GET /api/admin/menus/user` | **EXISTS**（不是 UNKNOWN） | `menu-permission.routes.ts:11` + `:14`；详见 §5-1 |
| menuCode 去重总数 / 形态 | 163 | MENU_CODE_TYPES=CATALOG=11 MENU=53 BUTTON=74 MENU(app-mobile catalog)=25 |
| menuCode → routeName 可对齐 | 10 / 163 | 菜单类码（CATALOG+MENU）仅 10/89 对齐 → 表C |
| admin-web 调用用户菜单接口 | **0 次** | 全量扫 `admin-web/src`（*.ts/*.js/*.vue）→ PC 菜单不依赖该接口（§5-1、缺口 G3） |
| admin-web 出现 menuCode/menu_code | 0 次 | 同上 |

**与卡口径（164 / 155 / 103）的差异结论：三个数全部复算命中，差异 0。** 两处必须写清的执行事实：
1. 155 只在「剔除 `layouts/MainLayout.vue` + `views/LoginView.vue` + `views/NotFound.vue`」后成立，去重组件全集是 158；卡把 155 写成"唯一页面组件"是准确的，但落地改造时不能用它当"组件文件全集"。
2. 6 条声明复用同名组件（pos 四件套与销售域双挂、调拨新建/编辑同组件、库存报表双挂），见 §2 `DUP_COMPONENT`。
3. 路由声明数包含 1 条无 `name` 的父级壳路由（`path: "/"`，`router/index.ts:93-98`）与 3 条非业务顶层路由，实际业务页 = 160 条子路由。

表A 一级归属分布（脚本派生）：`非菜单路由` 85 · `功能 / 即时零售` 12 · `系统 / 系统设置` 8 · `收银台（cashierNavItems）` 8 · `业务 / 销售管理` 7 · `业务 / 商品中心` 7 · `业务 / 财务中心` 7 · `业务 / 客户会员` 6 · `功能 / 营销中心` 6 · `业务 / 库存中心` 5 · `业务 / 订单管理` 4 · `功能 / 采购管理` 4 · `功能 / 数据报表` 4 · `工作台` 1

## 2. 复算命令与输出（原样粘贴）

命令与工作目录下的一次执行输出，整段原样粘贴（含脚本自带的 4 段 CSV 与 JSON 汇总；§3–§5 的 Markdown 表就是同一份 CSV 的渲染，未另加手工数据）。唯一每次会变的行是末行 `ELAPSED_MS`（运行耗时），其余逐行可比对。

```text
$ cd D:\Users\ZXQL\wt-agents\WB-REFACTOR-P0
$ node docs/evidence/WB-REFACTOR-P0/scripts/parse-routes.cjs
# WB-REFACTOR-P0 矩阵10 复算脚本
ROOT=D:\Users\ZXQL\wt-agents\WB-REFACTOR-P0
PROTOTYPE=D:/Users/ZXQL/ZXQL-AI/docs/设计/智享全链_工作台电脑端_UI原型_融合版.html
router=admin-web/src/router/index.ts layout=admin-web/src/layouts/MainLayout.vue proto=原型 html:3013
backend_endpoint=backend/src/routes/menu-permission.routes.ts:11(GET /user) / 14(prefix) / 9(GET /tree)
backend_controller=backend/src/controllers/admin/menu-permission.controller.ts:13
backend_service=backend/src/services/admin/menu-permission.service.ts:87(getUserMenus) / 31(SELECT menu_code AS menuCode) / 33(FROM t_sys_menu)

## COUNTS
ROUTE_DECLARATIONS=164
ROUTE_TOP_LEVEL=4
ROUTE_CHILDREN=160
ROUTE_WITH_NAME=163
ROUTE_WITHOUT_NAME=1
UNIQUE_COMPONENT_FILES=158
UNIQUE_COMPONENT_FILES_PAGE_ONLY=155
UNIQUE_COMPONENT_EXCLUDED_NON_PAGE=layouts/MainLayout.vue|views/LoginView.vue|views/NotFound.vue
COMPONENT_REUSED_DEFS=6
ROUTE_META_HIDDEN=5
ROUTE_FULLSCREEN=1
ROUTE_NO_ROLES_META=4
ROUTE_WITH_ROLES_META=160
MENU_GROUP_COUNT=12
MENU_ITEM_COUNT=71
CASHIER_NAV_ITEM_COUNT=9
MENU_PATH_UNIQUE=80
MENU_PATH_MATCHED_ROUTE=79
MENU_PATH_UNMATCHED_ROUTE=1
ROUTE_VISIBLE_IN_MENU=79
ROUTE_HIDDEN_TOTAL_NON_MENU=85
PROTO_SECTOR_COUNT=13
PROTO_LV2_BASE=103
PROTO_FUSE_PAGES=24
PROTO_PAGES_TOTAL=127
PROTO_PAGE_MATCHED=103
PROTO_PAGE_MATCHED_BY_NAME=49
PROTO_PAGE_MATCHED_BY_COMPONENT=54
PROTO_PAGE_MISSING_IN_ADMIN=24
PROTO_MISSING_WITH_COMP_FILE=0
ADMIN_ONLY_PAGES=61
ROUTE_COMPONENT_FILE_MISSING=0
BACKEND_MENU_ENDPOINT=EXISTS
BACKEND_MENU_CODES_PARSED=201
BACKEND_MENU_CODES_UNIQUE=163
BACKEND_MENU_CODES_CATALOG_ROWS=163
BACKEND_MENU_CODES_ALIGNED_TO_ROUTE=10
BACKEND_MENU_CODES_UNALIGNED=153
ADMIN_WEB_CALLS_MENUS_USER=0
ADMIN_WEB_MENU_CODE_REFERENCES=0

## 与任务卡口径对照（卡：164 路由声明 / 155 唯一页面组件 / 103 原型二级页）
ROUTE_DECLARATIONS: 卡=164 实=164 差异=0
UNIQUE_COMPONENT_FILES_PAGE_ONLY: 卡=155 实=155 差异=0
PROTO_LV2_BASE: 卡=103 实=103 差异=0
PROTO_FUSE_PAGES: 卡=24 实=24 差异=0
NOTE: 去重组件文件全集=158（含 layouts/MainLayout.vue|views/LoginView.vue|views/NotFound.vue 这 3 个非页面组件；剔除后=卡口径 155）；重复声明的组件文件数=6

## 原型 SECTORS 分版块计数（卡：dash4/sale8/order4/purchase8/inventory10/customer5/product8/retail10/finance11/report6/marketing9/system8/pos12）
SECTOR=dash 名称=工作台 基础二级=4 运行时fuse追加=0 合计=4
SECTOR=sale 名称=销售管理 基础二级=8 运行时fuse追加=0 合计=8
SECTOR=order 名称=订单管理 基础二级=4 运行时fuse追加=1 合计=5
SECTOR=purchase 名称=采购管理 基础二级=8 运行时fuse追加=1 合计=9
SECTOR=inventory 名称=库存管理 基础二级=10 运行时fuse追加=4 合计=14
SECTOR=customer 名称=客户管理 基础二级=5 运行时fuse追加=2 合计=7
SECTOR=product 名称=商品中心 基础二级=8 运行时fuse追加=3 合计=11
SECTOR=retail 名称=即时零售 基础二级=10 运行时fuse追加=0 合计=10
SECTOR=finance 名称=财务管理 基础二级=11 运行时fuse追加=2 合计=13
SECTOR=report 名称=数据报表 基础二级=6 运行时fuse追加=2 合计=8
SECTOR=marketing 名称=营销推广 基础二级=9 运行时fuse追加=4 合计=13
SECTOR=system 名称=系统管理 基础二级=8 运行时fuse追加=5 合计=13
SECTOR=pos 名称=门店收银 基础二级=12 运行时fuse追加=0 合计=12
SECTOR_LV2_SUM=103 FUSE_SUM=24

## 菜单项无对应路由（缺口）
MENU_ORPHAN=/pos/print-settings

## 组件被多条路由复用（共 6 个文件）
DUP_COMPONENT=views/pos/SaleBillsView.vue -> /sale-bills@admin-web/src/router/index.ts:106 , /pos/sale-bills@admin-web/src/router/index.ts:260
DUP_COMPONENT=views/pos/SaleBillDetail.vue -> /sale-bills/:billNo@admin-web/src/router/index.ts:107 , /pos/sale-bills/:billNo@admin-web/src/router/index.ts:261
DUP_COMPONENT=views/pos/SaleReturnView.vue -> /sale-returns@admin-web/src/router/index.ts:108 , /pos/sale-return@admin-web/src/router/index.ts:264
DUP_COMPONENT=views/pos/CollectionView.vue -> /collection@admin-web/src/router/index.ts:109 , /pos/collection@admin-web/src/router/index.ts:263
DUP_COMPONENT=views/inventory/InventoryTransferCreate.vue -> /inventory-transfer/create@admin-web/src/router/index.ts:138 , /inventory-transfer/edit/:id@admin-web/src/router/index.ts:139
DUP_COMPONENT=views/inventory/InventoryReports.vue -> /inventory-reports@admin-web/src/router/index.ts:148 , /reports/inventory@admin-web/src/router/index.ts:216

## menuCode 去重后形态分布（总数 163，原始行 201）
MENU_CODE_TYPES=CATALOG=11 MENU=53 BUTTON=74 MENU(app-mobile catalog)=25

### CSV:TABLE_A
一级菜单,二级菜单,path,routeName,组件文件,组件文件存在,hidden?,权限/roles meta,route ref,菜单 ref
非菜单路由,登录,/login,login,views/LoginView.vue,存在,是（非侧栏菜单）,无,admin-web/src/router/index.ts:82,无（不在导航）
非菜单路由,注册,/register,register,views/RegisterView.vue,存在,是（非侧栏菜单）,无,admin-web/src/router/index.ts:88,无（不在导航）
非菜单路由,UNKNOWN,/,UNKNOWN,layouts/MainLayout.vue,存在,是（非侧栏菜单）,无,admin-web/src/router/index.ts:94,无（不在导航）
工作台,工作台,/dashboard,dashboard,views/dashboard/Dashboard.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:100,admin-web/src/layouts/MainLayout.vue:95
非菜单路由,待办事项,/todo-list,todo-list,views/dashboard/TodoList.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:101,无（不在导航）
非菜单路由,快捷入口配置,/quick-entries,quick-entry-config,views/dashboard/QuickEntryConfig.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:102,无（不在导航）
非菜单路由,消息中心,/messages,message-center,views/dashboard/MessageCenter.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:103,无（不在导航）
业务 / 销售管理,销售开单,/sales/create,sales-order-create,views/sale/SalesOrderCreate.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:105,admin-web/src/layouts/MainLayout.vue:127
业务 / 销售管理,销售单据,/sale-bills,sale-bills,views/pos/SaleBillsView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:106,admin-web/src/layouts/MainLayout.vue:128
非菜单路由,销售单详情,/sale-bills/:billNo,sale-bill-detail,views/pos/SaleBillDetail.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:107,无（不在导航）
业务 / 销售管理,销售退货,/sale-returns,sale-returns,views/pos/SaleReturnView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:108,admin-web/src/layouts/MainLayout.vue:129
业务 / 销售管理,收款管理,/collection,collection,views/pos/CollectionView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:109,admin-web/src/layouts/MainLayout.vue:130
非菜单路由,收款关联,/sales/collection-links,collection-links,views/sale/CollectionLinks.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:110,无（不在导航）
业务 / 销售管理,客户价格,/sales/customer-prices,customer-prices,views/sale/CustomerPrices.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:111,admin-web/src/layouts/MainLayout.vue:131
业务 / 销售管理,提成规则,/sales/commission/rules,commission-rules,views/sale/CommissionRules.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:112,admin-web/src/layouts/MainLayout.vue:132
非菜单路由,提成记录,/sales/commission/records,commission-records,views/sale/CommissionRecords.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:113,无（不在导航）
业务 / 销售管理,销售报表,/sales/reports,sales-reports,views/sale/SalesReports.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:114,admin-web/src/layouts/MainLayout.vue:133
业务 / 订单管理,订单列表,/orders,orders,views/order/Orders.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:116,admin-web/src/layouts/MainLayout.vue:112
业务 / 订单管理,订单看板,/order-board,order-board,views/order/OrderBoardView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:117,admin-web/src/layouts/MainLayout.vue:113
非菜单路由,订单超时,/order-timeout,order-timeout,views/order/OrderTimeoutView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:118,无（不在导航）
非菜单路由,订单中心,/order-center,order-center,views/order/OrderCenterView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:119,无（不在导航）
非菜单路由,订单路由,/order-routing,order-routing,views/order/OrderRoutingView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:120,无（不在导航）
非菜单路由,订单同步,/order-sync,order-sync,views/order/OrderSyncView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:121,无（不在导航）
业务 / 订单管理,订单异常,/order-exception,order-exception,views/order/OrderExceptionView.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:122,admin-web/src/layouts/MainLayout.vue:115
非菜单路由,订单商品映射,/order-product-map,order-product-map,views/order/OrderProductMapView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:123,无（不在导航）
业务 / 订单管理,订单售后,/order-aftersale,order-aftersale,views/order/OrderAftersaleView.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:124,admin-web/src/layouts/MainLayout.vue:114
功能 / 采购管理,采购订单,/purchase-orders,purchase-orders,views/purchase/PurchaseOrders.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:126,admin-web/src/layouts/MainLayout.vue:217
功能 / 采购管理,采购入库,/purchase-in-stocks,purchase-in-stocks,views/purchase/PurchaseInStocks.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:127,admin-web/src/layouts/MainLayout.vue:218
非菜单路由,采购退货,/purchase-returns,purchase-returns,views/purchase/PurchaseReturnsView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:128,无（不在导航）
非菜单路由,采购合同,/purchase-contracts,purchase-contracts,views/purchase/PurchaseContracts.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:129,无（不在导航）
非菜单路由,供应商对账,/purchase/supplier-statements,supplier-statements,views/purchase/SupplierStatements.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:130,无（不在导航）
非菜单路由,采购计划,/purchase/plans,purchase-plans,views/purchase/PurchasePlans.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:131,无（不在导航）
功能 / 采购管理,采购付款,/purchase-payments,purchase-payments,views/purchase/PurchasePayments.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:132,admin-web/src/layouts/MainLayout.vue:220
功能 / 采购管理,供应商管理,/suppliers,suppliers,views/purchase/Suppliers.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:133,admin-web/src/layouts/MainLayout.vue:219
业务 / 库存中心,库存查询,/inventory,inventory,views/inventory/Inventory.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:135,admin-web/src/layouts/MainLayout.vue:163
业务 / 库存中心,库存盘点,/inventory-check,inventory-check,views/inventory/InventoryCheck.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:136,admin-web/src/layouts/MainLayout.vue:164
业务 / 库存中心,库存调拨,/inventory-transfer,inventory-transfer,views/inventory/InventoryTransfer.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:137,admin-web/src/layouts/MainLayout.vue:165
非菜单路由,新建调拨,/inventory-transfer/create,inventory-transfer-create,views/inventory/InventoryTransferCreate.vue,存在,meta.hidden,SUPER_ADMIN,admin-web/src/router/index.ts:138,无（不在导航）
非菜单路由,编辑调拨,/inventory-transfer/edit/:id,inventory-transfer-edit,views/inventory/InventoryTransferCreate.vue,存在,meta.hidden,SUPER_ADMIN,admin-web/src/router/index.ts:139,无（不在导航）
非菜单路由,调拨详情,/inventory-transfer/detail/:id,inventory-transfer-detail,views/inventory/InventoryTransferDetail.vue,存在,meta.hidden,SUPER_ADMIN,admin-web/src/router/index.ts:140,无（不在导航）
非菜单路由,库存共享设置,/inventory-share-config,inventory-share-config,views/inventory/InventoryShareConfig.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:141,无（不在导航）
非菜单路由,库存批次,/inventory-batch,inventory-batch,views/inventory/InventoryBatch.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:142,无（不在导航）
业务 / 库存中心,批量调价,/inventory-batch-price,inventory-batch-price,views/inventory/InventoryBatchPrice.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:143,admin-web/src/layouts/MainLayout.vue:167
非菜单路由,报价管理,/inventory-price-quote,inventory-price-quote,views/inventory/InventoryPriceQuote.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:144,无（不在导航）
业务 / 库存中心,库存预警,/inventory-alerts,inventory-alerts,views/inventory/InventoryAlerts.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:145,admin-web/src/layouts/MainLayout.vue:166
非菜单路由,库存成本,/inventory-cost,inventory-cost,views/inventory/InventoryCost.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:146,无（不在导航）
非菜单路由,预警配置,/inventory-alert-config,inventory-alert-config,views/inventory/InventoryAlertConfig.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:147,无（不在导航）
非菜单路由,库存报表,/inventory-reports,inventory-reports,views/inventory/InventoryReports.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:148,无（不在导航）
业务 / 客户会员,积分规则,/points-rules,points-rules,views/customer/PointsRules.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:149,admin-web/src/layouts/MainLayout.vue:183
业务 / 客户会员,等级配置,/level-config,level-config,views/customer/LevelConfig.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:150,admin-web/src/layouts/MainLayout.vue:184
业务 / 客户会员,储值卡,/store-value-cards,store-value-cards,views/customer/StoreValueCards.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:151,admin-web/src/layouts/MainLayout.vue:181
业务 / 客户会员,会员体系,/member-system,member-system,views/customer/MemberSystem.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:152,admin-web/src/layouts/MainLayout.vue:180
非菜单路由,客户标签,/customer-tags,customer-tags,views/customer/CustomerTags.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:153,无（不在导航）
非菜单路由,客户画像,/customer-profile,customer-profile,views/customer/CustomerProfile.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:154,无（不在导航）
非菜单路由,客户关怀,/customer-care,customer-care-rules,views/customer/CustomerCareRules.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:155,无（不在导航）
非菜单路由,拜访记录,/customer-visits,customer-visits,views/customer/CustomerVisits.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:156,无（不在导航）
非菜单路由,客户生命周期,/customer-lifecycle,customer-lifecycle,views/customer/CustomerLifecycle.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:157,无（不在导航）
非菜单路由,客户分群,/customer-segments,customer-segments,views/customer/CustomerSegments.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:158,无（不在导航）
业务 / 客户会员,客户列表,/customers,customers,views/customer/CustomersView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:160,admin-web/src/layouts/MainLayout.vue:179
非菜单路由,客户详情,/customers/detail/:memberId,customer-detail,views/customer/CustomerDetail.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:161,无（不在导航）
非菜单路由,客户类型,/customer-types,customer-types,views/customer/CustomerTypes.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:162,无（不在导航）
业务 / 客户会员,信用管理,/credit,credit,views/customer/CreditView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:163,admin-web/src/layouts/MainLayout.vue:182
业务 / 商品中心,商品列表,/products,products,views/product/Products.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:165,admin-web/src/layouts/MainLayout.vue:145
业务 / 商品中心,商品分类,/products/categories,product-categories,views/product/ProductCategories.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:166,admin-web/src/layouts/MainLayout.vue:146
业务 / 商品中心,品牌管理,/products/brands,brands,views/product/Brands.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:167,admin-web/src/layouts/MainLayout.vue:147
非菜单路由,单位管理,/products/units,units,views/product/Units.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:168,无（不在导航）
业务 / 商品中心,商品导入,/products/import,product-import,views/product/ProductImport.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:169,admin-web/src/layouts/MainLayout.vue:149
非菜单路由,商品标签,/products/tags,product-tags,views/product/ProductTags.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:170,无（不在导航）
非菜单路由,标签分组,/products/tag-groups,tag-groups,views/product/TagGroups.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:171,无（不在导航）
非菜单路由,标签关联,/products/tag-relation,product-tag-relation,views/product/ProductTagRelation.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:172,无（不在导航）
业务 / 商品中心,商品审核,/products/reviews,product-reviews,views/product/ProductReview.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:173,admin-web/src/layouts/MainLayout.vue:151
非菜单路由,审核流程配置,/products/review-workflow,product-review-workflow,views/product/ProductReviewWorkflow.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:174,无（不在导航）
非菜单路由,审核任务,/products/review-tasks,product-review-tasks,views/product/ProductReviewTasks.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER|FINANCE_ADMIN|WAREHOUSE_ADMIN,admin-web/src/router/index.ts:175,无（不在导航）
非菜单路由,审核委托,/products/review-delegation,review-delegation,views/product/ReviewDelegation.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:176,无（不在导航）
业务 / 商品中心,套装与组合品,/products/combo,product-combo,views/product/ProductCombo.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:177,admin-web/src/layouts/MainLayout.vue:150
业务 / 商品中心,价格管理,/prices,prices,views/product/PricesView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:178,admin-web/src/layouts/MainLayout.vue:148
功能 / 即时零售,平台配置,/instant-retail/config,instant-retail-config,views/instant-retail/InstantRetailConfig.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:180,admin-web/src/layouts/MainLayout.vue:232
功能 / 即时零售,商品货架,/instant-retail/shelf,instant-retail-shelf,views/instant-retail/InstantRetailShelf.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:181,admin-web/src/layouts/MainLayout.vue:236
功能 / 即时零售,小程序订单,/instant-retail/orders,instant-retail-orders,views/instant-retail/InstantRetailOrders.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:182,admin-web/src/layouts/MainLayout.vue:234
功能 / 即时零售,接单工作台,/instant-retail/pickup,instant-retail-pickup,views/instant-retail/InstantRetailPickup.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:183,admin-web/src/layouts/MainLayout.vue:233
功能 / 即时零售,平台对账,/instant-retail/payment,instant-retail-payment,views/instant-retail/InstantRetailPayment.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:184,admin-web/src/layouts/MainLayout.vue:240
功能 / 即时零售,配送管理,/instant-retail/delivery,instant-retail-delivery,views/instant-retail/InstantRetailDelivery.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:185,admin-web/src/layouts/MainLayout.vue:238
功能 / 即时零售,零售报表,/instant-retail/report,instant-retail-report,views/instant-retail/InstantRetailReport.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:186,admin-web/src/layouts/MainLayout.vue:243
功能 / 即时零售,平台管理,/instant-retail/platform,instant-retail-platform,views/instant-retail/InstantRetailPlatform.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:187,admin-web/src/layouts/MainLayout.vue:239
功能 / 即时零售,订单看板,/instant-retail/order-board,instant-retail-order-board,views/instant-retail/InstantRetailOrderBoard.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:188,admin-web/src/layouts/MainLayout.vue:235
功能 / 即时零售,平台公告,/instant-retail/announcements,retail-announcements,views/instant-retail/RetailAnnouncement.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:189,admin-web/src/layouts/MainLayout.vue:241
功能 / 即时零售,零售看板,/instant-retail/dashboard,instant-retail-dashboard,views/instant-retail/InstantRetailDashboard.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:190,admin-web/src/layouts/MainLayout.vue:242
功能 / 即时零售,库存同步,/instant-retail/sync,instant-retail-sync,views/instant-retail/InstantRetailSync.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:191,admin-web/src/layouts/MainLayout.vue:237
业务 / 财务中心,收付款管理,/payments,payments,views/finance/PaymentsView.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:193,admin-web/src/layouts/MainLayout.vue:196
非菜单路由,回款管理,/finance/collection,finance-collection,views/finance/FinanceCollection.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:194,无（不在导航）
业务 / 财务中心,客户对账,/customer-statements,customer-statements,views/finance/CustomerStatements.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:195,admin-web/src/layouts/MainLayout.vue:198
业务 / 财务中心,利润核算,/finance/profit,finance-profit,views/finance/FinanceProfit.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:196,admin-web/src/layouts/MainLayout.vue:200
非菜单路由,收款单,/finance/receipts,finance-receipts,views/finance/ReceiptsView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:197,无（不在导航）
非菜单路由,付款单,/finance/payments,finance-payments,views/finance/PaymentsNewView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:198,无（不在导航）
业务 / 财务中心,应收应付,/finance/receivables-payables,finance-receivables-payables,views/finance/ReceivablesPayables.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:199,admin-web/src/layouts/MainLayout.vue:197
非菜单路由,费用管理,/finance/expenses,finance-expenses,views/finance/ExpensesView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:200,无（不在导航）
业务 / 财务中心,财务对账,/finance/reconciliation,finance-reconciliation,views/finance/ReconciliationView.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:201,admin-web/src/layouts/MainLayout.vue:199
非菜单路由,财务看板,/finance/dashboard,finance-dashboard,views/finance/FinanceDashboard.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:202,无（不在导航）
非菜单路由,银行账户,/bank-accounts,bank-accounts,views/finance/BankAccounts.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:203,无（不在导航）
业务 / 财务中心,资金报表,/fund-report,fund-report,views/finance/FinanceReport.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:204,admin-web/src/layouts/MainLayout.vue:201
非菜单路由,票据管理,/bill-management,bill-management,views/finance/BillManagement.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:205,无（不在导航）
业务 / 财务中心,单据管理,/history-bills,history-bills,views/finance/HistoryBills.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:206,admin-web/src/layouts/MainLayout.vue:202
功能 / 数据报表,销售统计,/reports,reports,views/report/Reports.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:208,admin-web/src/layouts/MainLayout.vue:272
非菜单路由,采购报表,/reports/purchase,purchase-reports,views/report/PurchaseReports.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:209,无（不在导航）
功能 / 数据报表,商品排行,/reports/products,reports-products,views/report/ReportsProducts.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:210,admin-web/src/layouts/MainLayout.vue:274
功能 / 数据报表,员工业绩,/reports/employees,reports-employees,views/report/ReportsEmployees.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:211,admin-web/src/layouts/MainLayout.vue:275
非菜单路由,门店报表,/reports/stores,reports-stores,views/report/ReportsStores.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:212,无（不在导航）
功能 / 数据报表,销售分析,/reports/sales-analysis,sales-analysis,views/report/SalesAnalysis.vue,存在,否,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:213,admin-web/src/layouts/MainLayout.vue:273
非菜单路由,回款分析,/reports/collection-analysis,collection-analysis,views/report/CollectionAnalysis.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:214,无（不在导航）
非菜单路由,客户分析,/reports/customers,customer-analysis,views/report/CustomerAnalysis.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:215,无（不在导航）
非菜单路由,库存报表,/reports/inventory,reports-inventory,views/inventory/InventoryReports.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:216,无（不在导航）
非菜单路由,调拨统计,/reports/transfer,transfer-reports,views/report/TransferReport.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:217,无（不在导航）
非菜单路由,自定义报表,/reports/custom-report,custom-report,views/report/CustomReport.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:218,无（不在导航）
功能 / 营销中心,营销活动,/marketing,marketing,views/marketing/MarketingView.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:220,admin-web/src/layouts/MainLayout.vue:255
非菜单路由,营销标签,/marketing/tags,marketing-tags,views/marketing/MarketingTags.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:221,无（不在导航）
功能 / 营销中心,限时折扣,/marketing/limited-discount,marketing-limited-discount,views/marketing/MarketingLimitedDiscount.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:222,admin-web/src/layouts/MainLayout.vue:257
非菜单路由,赠品规则,/marketing/gift-rule,marketing-gift-rule,views/marketing/MarketingGiftRule.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:223,无（不在导航）
非菜单路由,积分商城,/marketing/points-mall,marketing-points-mall,views/marketing/MarketingPointsMall.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:224,无（不在导航）
非菜单路由,营销看板,/marketing/dashboard,marketing-dashboard,views/marketing/MarketingDashboard.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:225,无（不在导航）
非菜单路由,营销素材,/marketing/materials,marketing-material,views/marketing/MarketingMaterial.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:226,无（不在导航）
功能 / 营销中心,优惠券管理,/marketing/coupon,marketing-coupon,views/marketing/CouponManage.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:227,admin-web/src/layouts/MainLayout.vue:256
功能 / 营销中心,秒杀活动,/marketing/flash-sale,marketing-flash-sale,views/marketing/FlashSale.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:228,admin-web/src/layouts/MainLayout.vue:258
功能 / 营销中心,满减满赠,/marketing/full-reduction,marketing-full-reduction,views/marketing/FullReduction.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:229,admin-web/src/layouts/MainLayout.vue:259
功能 / 营销中心,售后管理,/aftersale,aftersale,views/marketing/AftersaleView.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:230,admin-web/src/layouts/MainLayout.vue:260
非菜单路由,员工管理,/employees,employees,views/system/EmployeesView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:232,无（不在导航）
系统 / 系统设置,组织架构,/organization,organization,views/system/OrganizationView.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:233,admin-web/src/layouts/MainLayout.vue:290
非菜单路由,部门管理,/department-manage,department-manage,views/system/DepartmentManage.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:234,无（不在导航）
非菜单路由,岗位管理,/position-manage,position-manage,views/system/PositionManage.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:235,无（不在导航）
非菜单路由,门店管理,/stores,stores,views/system/StoresView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:236,无（不在导航）
非菜单路由,角色管理,/system/roles,system-roles,views/system/SystemRoles.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:237,无（不在导航）
非菜单路由,操作日志,/audit-log,audit-log,views/system/AuditLogView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:238,无（不在导航）
非菜单路由,错误日志,/error-log,error-log,views/system/ErrorLogView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:239,无（不在导航）
非菜单路由,系统设置,/system,system,views/system/System.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:240,无（不在导航）
系统 / 系统设置,系统配置,/system/config,system-config,views/system/SystemConfigView.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:241,admin-web/src/layouts/MainLayout.vue:291
系统 / 系统设置,打印模板,/system/print,system-print,modules/print/PrintTemplatesView.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:242,admin-web/src/layouts/MainLayout.vue:292
非菜单路由,模板设计,/system/print/designer/:id?,system-print-designer,modules/print/PrintTemplateDesigner.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:243,无（不在导航）
非菜单路由,审批规则,/system/approval/rules,approval-rules,views/system/ApprovalRules.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:244,无（不在导航）
系统 / 系统设置,审批管理,/system/approval/manage,approval-manage,views/system/ApprovalManage.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:245,admin-web/src/layouts/MainLayout.vue:293
系统 / 系统设置,报表权限,/report-permissions,report-permissions,views/system/ReportPermission.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:246,admin-web/src/layouts/MainLayout.vue:294
非菜单路由,审批详情,/system/approval/detail/:id,approval-detail,views/system/ApprovalDetail.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:247,无（不在导航）
非菜单路由,我的审批,/system/approval/my,my-approvals,views/system/MyApprovals.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:248,无（不在导航）
系统 / 系统设置,支付配置,/system/payment,payment-config,views/system/PaymentConfigView.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:249,admin-web/src/layouts/MainLayout.vue:295
系统 / 系统设置,小程序配置,/system/miniapp,miniapp-config,views/system/MiniappConfigView.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:250,admin-web/src/layouts/MainLayout.vue:296
非菜单路由,系统监控,/monitor,monitor,views/system/MonitorView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:251,无（不在导航）
系统 / 系统设置,日志与反馈,/monitor-manage,monitor-manage,views/system/SystemMonitorManage.vue,存在,否,SUPER_ADMIN,admin-web/src/router/index.ts:252,admin-web/src/layouts/MainLayout.vue:297
非菜单路由,反馈管理,/system/feedback,feedback,views/system/FeedbackView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:253,无（不在导航）
非菜单路由,收货地址,/consumer-addresses,consumer-addresses,views/system/ConsumerAddress.vue,存在,是（非侧栏菜单）,SUPER_ADMIN,admin-web/src/router/index.ts:254,无（不在导航）
非菜单路由,在线收款分析,/reports/online-payment,online-payment-analysis,views/report/OnlinePaymentAnalysis.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER,admin-web/src/router/index.ts:256,无（不在导航）
非菜单路由,门店工作台,/pos/dashboard,pos-dashboard,views/pos/StoreDashboardView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:258,无（不在导航）
收银台（cashierNavItems）,快速收银,/pos/cashier,pos-cashier,views/pos/CashierView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:259,admin-web/src/layouts/MainLayout.vue:377
收银台（cashierNavItems）,销售单据,/pos/sale-bills,pos-sale-bills,views/pos/SaleBillsView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:260,admin-web/src/layouts/MainLayout.vue:378
非菜单路由,销售单详情,/pos/sale-bills/:billNo,pos-sale-bill-detail,views/pos/SaleBillDetail.vue,存在,meta.hidden,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:261,无（不在导航）
非菜单路由,接单履约,/pos/order-fulfill,pos-order-fulfill,views/pos/OrderFulfillView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:262,无（不在导航）
收银台（cashierNavItems）,分享收款,/pos/collection,pos-collection,views/pos/CollectionView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:263,admin-web/src/layouts/MainLayout.vue:383
收银台（cashierNavItems）,销售退货,/pos/sale-return,pos-sale-return,views/pos/SaleReturnView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:264,admin-web/src/layouts/MainLayout.vue:381
收银台（cashierNavItems）,挂单管理,/pos/hold-order,pos-hold-order,views/pos/HoldOrderView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:265,admin-web/src/layouts/MainLayout.vue:379
收银台（cashierNavItems）,会员识别,/pos/member,pos-member,views/pos/MemberView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:266,admin-web/src/layouts/MainLayout.vue:382
非菜单路由,优惠券核销,/pos/coupon-verify,pos-coupon-verify,views/pos/CouponVerifyView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:267,无（不在导航）
收银台（cashierNavItems）,交接班,/pos/shift,pos-shift,views/pos/ShiftView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:268,admin-web/src/layouts/MainLayout.vue:380
非菜单路由,交接班详情,/pos/shift/:id,pos-shift-detail,views/pos/ShiftDetailView.vue,存在,meta.hidden,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:269,无（不在导航）
收银台（cashierNavItems）,日结管理,/pos/daily-settle,pos-daily-settle,views/pos/DailySettleView.vue,存在,否,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:270,admin-web/src/layouts/MainLayout.vue:384
非菜单路由,门店管控,/pos/store-control,pos-store-control,views/pos/StoreControlView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:271,无（不在导航）
非菜单路由,操作记录,/pos/operation-log,pos-operation-log,views/pos/OperationLogView.vue,存在,是（非侧栏菜单）,SUPER_ADMIN|STORE_MANAGER|STORE_OPERATOR,admin-web/src/router/index.ts:272,无（不在导航）
非菜单路由,页面不存在,/:pathMatch(.*)*,not-found,views/NotFound.vue,存在,是（非侧栏菜单）,无,admin-web/src/router/index.ts:275,无（不在导航）

### CSV:TABLE_B1_PROTO_ONLY
原型版块,页 key,页说明,t,原型组件,原型 ref,原型组件文件是否存在,对齐 path,对齐 routeName,对齐方式,结论
dash/工作台,dashboard,工作台首页,board,views/dashboard/Dashboard.vue,原型 html:3013,存在,/dashboard,dashboard,routeName 精确,admin-web 有（存在）
dash/工作台,todo-list,待办事项,list,views/dashboard/TodoList.vue,原型 html:3013,存在,/todo-list,todo-list,routeName 精确,admin-web 有（存在）
dash/工作台,quick-entry-config,快捷入口配置,form,views/dashboard/QuickEntryConfig.vue,原型 html:3013,存在,/quick-entries,quick-entry-config,routeName 精确,admin-web 有（存在）
dash/工作台,message-center,消息中心,list,views/dashboard/MessageCenter.vue,原型 html:3013,存在,/messages,message-center,routeName 精确,admin-web 有（存在）
sale/销售管理,sales-create,销售开单,order,views/sale/SalesOrderCreate.vue,原型 html:3013,存在,/sales/create,sales-order-create,组件文件,admin-web 有（存在）
sale/销售管理,sale-bills,销售单据,fuse,views/pos/SaleBillsView.vue,原型 html:3013,存在,/sale-bills,sale-bills,routeName 精确,admin-web 有（存在）
sale/销售管理,sale-returns,销售退货,fuse,views/pos/SaleReturnView.vue,原型 html:3013,存在,/sale-returns,sale-returns,routeName 精确,admin-web 有（存在）
sale/销售管理,collection,收款管理,list,views/pos/CollectionView.vue,原型 html:3013,存在,/collection,collection,routeName 精确,admin-web 有（存在）
sale/销售管理,collection-links,收款关联,list,views/sale/CollectionLinks.vue,原型 html:3013,存在,/sales/collection-links,collection-links,routeName 精确,admin-web 有（存在）
sale/销售管理,customer-prices,客户价格,list,views/sale/CustomerPrices.vue,原型 html:3013,存在,/sales/customer-prices,customer-prices,routeName 精确,admin-web 有（存在）
sale/销售管理,commission,提成管理,fuse,views/sale/CommissionRules.vue,原型 html:3013,存在,/sales/commission/rules,commission-rules,组件文件,admin-web 有（存在）
sale/销售管理,sales-reports,销售报表,board,views/sale/SalesReports.vue,原型 html:3013,存在,/sales/reports,sales-reports,routeName 精确,admin-web 有（存在）
order/订单管理,orders,订单列表,list,views/order/Orders.vue,原型 html:3013,存在,/orders,orders,routeName 精确,admin-web 有（存在）
order/订单管理,order-board,订单看板,board,views/order/OrderBoardView.vue,原型 html:3013,存在,/order-board,order-board,routeName 精确,admin-web 有（存在）
order/订单管理,order-timeout,订单超时,list,views/order/OrderTimeoutView.vue,原型 html:3013,存在,/order-timeout,order-timeout,routeName 精确,admin-web 有（存在）
order/订单管理,order-center,订单中心,fuse,views/order/OrderCenterView.vue,原型 html:3013,存在,/order-center,order-center,routeName 精确,admin-web 有（存在）
purchase/采购管理,purchase-orders,采购订单,list,views/purchase/PurchaseOrders.vue,原型 html:3013,存在,/purchase-orders,purchase-orders,routeName 精确,admin-web 有（存在）
purchase/采购管理,purchase-in-stocks,采购入库,list,views/purchase/PurchaseInStocks.vue,原型 html:3013,存在,/purchase-in-stocks,purchase-in-stocks,routeName 精确,admin-web 有（存在）
purchase/采购管理,purchase-returns,采购退货,list,views/purchase/PurchaseReturnsView.vue,原型 html:3013,存在,/purchase-returns,purchase-returns,routeName 精确,admin-web 有（存在）
purchase/采购管理,purchase-contracts,采购合同,list,views/purchase/PurchaseContracts.vue,原型 html:3013,存在,/purchase-contracts,purchase-contracts,routeName 精确,admin-web 有（存在）
purchase/采购管理,supplier-statements,供应商对账,list,views/purchase/SupplierStatements.vue,原型 html:3013,存在,/purchase/supplier-statements,supplier-statements,routeName 精确,admin-web 有（存在）
purchase/采购管理,purchase-plans,采购计划,list,views/purchase/PurchasePlans.vue,原型 html:3013,存在,/purchase/plans,purchase-plans,routeName 精确,admin-web 有（存在）
purchase/采购管理,purchase-payments,采购付款,list,views/purchase/PurchasePayments.vue,原型 html:3013,存在,/purchase-payments,purchase-payments,routeName 精确,admin-web 有（存在）
purchase/采购管理,suppliers,供应商管理,fuse,views/purchase/Suppliers.vue,原型 html:3013,存在,/suppliers,suppliers,routeName 精确,admin-web 有（存在）
inventory/库存管理,inventory,库存列表,list,views/inventory/Inventory.vue,原型 html:3013,存在,/inventory,inventory,routeName 精确,admin-web 有（存在）
inventory/库存管理,inventory-check,库存盘点,list,views/inventory/InventoryCheck.vue,原型 html:3013,存在,/inventory-check,inventory-check,routeName 精确,admin-web 有（存在）
inventory/库存管理,inventory-transfer,库存调拨,fuse,views/inventory/InventoryTransfer.vue,原型 html:3013,存在,/inventory-transfer,inventory-transfer,routeName 精确,admin-web 有（存在）
inventory/库存管理,inventory-share-config,库存共享设置,form,views/inventory/InventoryShareConfig.vue,原型 html:3013,存在,/inventory-share-config,inventory-share-config,routeName 精确,admin-web 有（存在）
inventory/库存管理,inventory-batch,库存批次,list,views/inventory/InventoryBatch.vue,原型 html:3013,存在,/inventory-batch,inventory-batch,routeName 精确,admin-web 有（存在）
inventory/库存管理,inventory-batch-price,批量调价,form,views/inventory/InventoryBatchPrice.vue,原型 html:3013,存在,/inventory-batch-price,inventory-batch-price,routeName 精确,admin-web 有（存在）
inventory/库存管理,inventory-price-quote,报价管理,list,views/inventory/InventoryPriceQuote.vue,原型 html:3013,存在,/inventory-price-quote,inventory-price-quote,routeName 精确,admin-web 有（存在）
inventory/库存管理,inventory-alerts,库存预警,fuse,views/inventory/InventoryAlerts.vue,原型 html:3013,存在,/inventory-alerts,inventory-alerts,routeName 精确,admin-web 有（存在）
inventory/库存管理,inventory-cost,库存成本,list,views/inventory/InventoryCost.vue,原型 html:3013,存在,/inventory-cost,inventory-cost,routeName 精确,admin-web 有（存在）
inventory/库存管理,inventory-reports,库存报表,board,views/inventory/InventoryReports.vue,原型 html:3013,存在,/inventory-reports,inventory-reports,routeName 精确,admin-web 有（存在）
customer/客户管理,customers,客户管理,fuse,views/customer/CustomersView.vue,原型 html:3013,存在,/customers,customers,routeName 精确,admin-web 有（存在）
customer/客户管理,customer-types,客户类型,list,views/customer/CustomerTypes.vue,原型 html:3013,存在,/customer-types,customer-types,routeName 精确,admin-web 有（存在）
customer/客户管理,credit,信用管理,list,views/customer/CreditView.vue,原型 html:3013,存在,/credit,credit,routeName 精确,admin-web 有（存在）
customer/客户管理,member-sys,会员体系,fuse,views/customer/MemberSystem.vue,原型 html:3013,存在,/member-system,member-system,组件文件,admin-web 有（存在）
customer/客户管理,customer-care,客户运营,fuse,views/customer/CustomerCareRules.vue,原型 html:3013,存在,/customer-care,customer-care-rules,组件文件,admin-web 有（存在）
product/商品中心,products,商品管理,fuse,views/product/Products.vue,原型 html:3013,存在,/products,products,routeName 精确,admin-web 有（存在）
product/商品中心,categories,分类管理,list,views/product/ProductCategories.vue,原型 html:3013,存在,/products/categories,product-categories,组件文件,admin-web 有（存在）
product/商品中心,brands,品牌管理,list,views/product/Brands.vue,原型 html:3013,存在,/products/brands,brands,routeName 精确,admin-web 有（存在）
product/商品中心,units,单位管理,list,views/product/Units.vue,原型 html:3013,存在,/products/units,units,routeName 精确,admin-web 有（存在）
product/商品中心,tags,标签体系,fuse,views/product/ProductTags.vue,原型 html:3013,存在,/products/tags,product-tags,组件文件,admin-web 有（存在）
product/商品中心,review,商品审核,fuse,views/product/ProductReview.vue,原型 html:3013,存在,/products/reviews,product-reviews,组件文件,admin-web 有（存在）
product/商品中心,combo,套装与组合品,list,views/product/ProductCombo.vue,原型 html:3013,存在,/products/combo,product-combo,组件文件,admin-web 有（存在）
product/商品中心,prices,价格管理,list,views/product/PricesView.vue,原型 html:3013,存在,/prices,prices,routeName 精确,admin-web 有（存在）
retail/即时零售,rt-config,平台配置,form,views/instant-retail/InstantRetailConfig.vue,原型 html:3013,存在,/instant-retail/config,instant-retail-config,组件文件,admin-web 有（存在）
retail/即时零售,rt-platform,平台管理,list,views/instant-retail/InstantRetailPlatform.vue,原型 html:3013,存在,/instant-retail/platform,instant-retail-platform,组件文件,admin-web 有（存在）
retail/即时零售,rt-shelf,商品上架,list,views/instant-retail/InstantRetailShelf.vue,原型 html:3013,存在,/instant-retail/shelf,instant-retail-shelf,组件文件,admin-web 有（存在）
retail/即时零售,rt-orders,平台订单,fuse,views/instant-retail/InstantRetailOrders.vue,原型 html:3013,存在,/instant-retail/orders,instant-retail-orders,组件文件,admin-web 有（存在）
retail/即时零售,rt-payment,平台对账,list,views/instant-retail/InstantRetailPayment.vue,原型 html:3013,存在,/instant-retail/payment,instant-retail-payment,组件文件,admin-web 有（存在）
retail/即时零售,rt-delivery,配送管理,list,views/instant-retail/InstantRetailDelivery.vue,原型 html:3013,存在,/instant-retail/delivery,instant-retail-delivery,组件文件,admin-web 有（存在）
retail/即时零售,rt-sync,库存同步,form,views/instant-retail/InstantRetailSync.vue,原型 html:3013,存在,/instant-retail/sync,instant-retail-sync,组件文件,admin-web 有（存在）
retail/即时零售,rt-ann,平台公告,list,views/instant-retail/RetailAnnouncement.vue,原型 html:3013,存在,/instant-retail/announcements,retail-announcements,组件文件,admin-web 有（存在）
retail/即时零售,rt-report,平台报表,board,views/instant-retail/InstantRetailReport.vue,原型 html:3013,存在,/instant-retail/report,instant-retail-report,组件文件,admin-web 有（存在）
retail/即时零售,rt-dashboard,零售看板,board,views/instant-retail/InstantRetailDashboard.vue,原型 html:3013,存在,/instant-retail/dashboard,instant-retail-dashboard,组件文件,admin-web 有（存在）
finance/财务管理,fin-pay,收付款,fuse,views/finance/PaymentsView.vue,原型 html:3013,存在,/payments,payments,组件文件,admin-web 有（存在）
finance/财务管理,fin-collection,回款管理,list,views/finance/FinanceCollection.vue,原型 html:3013,存在,/finance/collection,finance-collection,组件文件,admin-web 有（存在）
finance/财务管理,fin-statements,客户对账,list,views/finance/CustomerStatements.vue,原型 html:3013,存在,/customer-statements,customer-statements,组件文件,admin-web 有（存在）
finance/财务管理,fin-profit,利润核算,board,views/finance/FinanceProfit.vue,原型 html:3013,存在,/finance/profit,finance-profit,组件文件,admin-web 有（存在）
finance/财务管理,fin-expenses,费用管理,list,views/finance/ExpensesView.vue,原型 html:3013,存在,/finance/expenses,finance-expenses,组件文件,admin-web 有（存在）
finance/财务管理,fin-recon,财务对账,list,views/finance/ReconciliationView.vue,原型 html:3013,存在,/finance/reconciliation,finance-reconciliation,组件文件,admin-web 有（存在）
finance/财务管理,fin-dashboard,财务看板,board,views/finance/FinanceDashboard.vue,原型 html:3013,存在,/finance/dashboard,finance-dashboard,组件文件,admin-web 有（存在）
finance/财务管理,fin-bank,银行账户,list,views/finance/BankAccounts.vue,原型 html:3013,存在,/bank-accounts,bank-accounts,组件文件,admin-web 有（存在）
finance/财务管理,fin-fund,资金报表,board,views/finance/FinanceReport.vue,原型 html:3013,存在,/fund-report,fund-report,组件文件,admin-web 有（存在）
finance/财务管理,fin-bill,票据管理,list,views/finance/BillManagement.vue,原型 html:3013,存在,/bill-management,bill-management,组件文件,admin-web 有（存在）
finance/财务管理,fin-history,单据管理,list,views/finance/HistoryBills.vue,原型 html:3013,存在,/history-bills,history-bills,组件文件,admin-web 有（存在）
report/数据报表,reports,报表中心,fuse,views/report/Reports.vue,原型 html:3013,存在,/reports,reports,routeName 精确,admin-web 有（存在）
report/数据报表,sales-analysis,销售分析,board,views/report/SalesAnalysis.vue,原型 html:3013,存在,/reports/sales-analysis,sales-analysis,routeName 精确,admin-web 有（存在）
report/数据报表,collection-analysis,回款分析,board,views/report/CollectionAnalysis.vue,原型 html:3013,存在,/reports/collection-analysis,collection-analysis,routeName 精确,admin-web 有（存在）
report/数据报表,customer-analysis,客户分析,board,views/report/CustomerAnalysis.vue,原型 html:3013,存在,/reports/customers,customer-analysis,routeName 精确,admin-web 有（存在）
report/数据报表,reports-inventory,库存分析,board,views/inventory/InventoryReports.vue,原型 html:3013,存在,/reports/inventory,reports-inventory,routeName 精确,admin-web 有（存在）
report/数据报表,online-payment,在线收款分析,board,views/report/OnlinePaymentAnalysis.vue,原型 html:3013,存在,/reports/online-payment,online-payment-analysis,组件文件,admin-web 有（存在）
marketing/营销推广,mk-activity,营销活动,list,views/marketing/MarketingView.vue,原型 html:3013,存在,/marketing,marketing,组件文件,admin-web 有（存在）
marketing/营销推广,mk-coupon,优惠券,fuse,views/marketing/CouponManage.vue,原型 html:3013,存在,/marketing/coupon,marketing-coupon,组件文件,admin-web 有（存在）
marketing/营销推广,mk-discount,限时折扣,list,views/marketing/MarketingLimitedDiscount.vue,原型 html:3013,存在,/marketing/limited-discount,marketing-limited-discount,组件文件,admin-web 有（存在）
marketing/营销推广,mk-gift,赠品规则,list,views/marketing/MarketingGiftRule.vue,原型 html:3013,存在,/marketing/gift-rule,marketing-gift-rule,组件文件,admin-web 有（存在）
marketing/营销推广,mk-points,积分商城,list,views/marketing/MarketingPointsMall.vue,原型 html:3013,存在,/marketing/points-mall,marketing-points-mall,组件文件,admin-web 有（存在）
marketing/营销推广,mk-tags,营销标签,list,views/marketing/MarketingTags.vue,原型 html:3013,存在,/marketing/tags,marketing-tags,组件文件,admin-web 有（存在）
marketing/营销推广,mk-material,营销素材,list,views/marketing/MarketingMaterial.vue,原型 html:3013,存在,/marketing/materials,marketing-material,组件文件,admin-web 有（存在）
marketing/营销推广,mk-dashboard,营销看板,board,views/marketing/MarketingDashboard.vue,原型 html:3013,存在,/marketing/dashboard,marketing-dashboard,组件文件,admin-web 有（存在）
marketing/营销推广,mk-aftersale,售后管理,list,views/marketing/AftersaleView.vue,原型 html:3013,存在,/aftersale,aftersale,组件文件,admin-web 有（存在）
system/系统管理,sys-org,组织人事,fuse,views/system/EmployeesView.vue,原型 html:3013,存在,/employees,employees,组件文件,admin-web 有（存在）
system/系统管理,sys-role,权限管理,fuse,views/system/SystemRoles.vue,原型 html:3013,存在,/system/roles,system-roles,组件文件,admin-web 有（存在）
system/系统管理,sys-approval,审批中心,fuse,views/system/ApprovalManage.vue,原型 html:3013,存在,/system/approval/manage,approval-manage,组件文件,admin-web 有（存在）
system/系统管理,sys-print,打印模板,print,modules/print/PrintTemplatesView.vue,原型 html:3013,存在,/system/print,system-print,组件文件,admin-web 有（存在）
system/系统管理,sys-config,系统配置,fuse,views/system/SystemConfigView.vue,原型 html:3013,存在,/system/config,system-config,组件文件,admin-web 有（存在）
system/系统管理,sys-log,日志中心,fuse,views/system/AuditLogView.vue,原型 html:3013,存在,/audit-log,audit-log,组件文件,admin-web 有（存在）
system/系统管理,sys-monitor,系统监控,fuse,views/system/MonitorView.vue,原型 html:3013,存在,/monitor,monitor,组件文件,admin-web 有（存在）
system/系统管理,sys-feedback,反馈管理,list,views/system/FeedbackView.vue,原型 html:3013,存在,/system/feedback,feedback,组件文件,admin-web 有（存在）
pos/门店收银,pos-dashboard,门店工作台,board,views/pos/StoreDashboardView.vue,原型 html:3013,存在,/pos/dashboard,pos-dashboard,routeName 精确,admin-web 有（存在）
pos/门店收银,pos-cashier,快速收银,pos,views/pos/CashierView.vue,原型 html:3013,存在,/pos/cashier,pos-cashier,routeName 精确,admin-web 有（存在）
pos/门店收银,pos-bills,收银单据,fuse,views/pos/SaleBillsView.vue,原型 html:3013,存在,/sale-bills,sale-bills,组件文件,admin-web 有（存在）
pos/门店收银,pos-fulfill,接单履约,list,views/pos/OrderFulfillView.vue,原型 html:3013,存在,/pos/order-fulfill,pos-order-fulfill,组件文件,admin-web 有（存在）
pos/门店收银,pos-collection,分享收款,list,views/pos/CollectionView.vue,原型 html:3013,存在,/pos/collection,pos-collection,routeName 精确,admin-web 有（存在）
pos/门店收银,pos-return,收银退货,list,views/pos/SaleReturnView.vue,原型 html:3013,存在,/sale-returns,sale-returns,组件文件,admin-web 有（存在）
pos/门店收银,pos-hold,挂单管理,list,views/pos/HoldOrderView.vue,原型 html:3013,存在,/pos/hold-order,pos-hold-order,组件文件,admin-web 有（存在）
pos/门店收银,pos-member,会员识别,form,views/pos/MemberView.vue,原型 html:3013,存在,/pos/member,pos-member,routeName 精确,admin-web 有（存在）
pos/门店收银,pos-coupon,优惠券核销,form,views/pos/CouponVerifyView.vue,原型 html:3013,存在,/pos/coupon-verify,pos-coupon-verify,组件文件,admin-web 有（存在）
pos/门店收银,pos-shift,交接班,fuse,views/pos/ShiftView.vue,原型 html:3013,存在,/pos/shift,pos-shift,routeName 精确,admin-web 有（存在）
pos/门店收银,pos-control,门店管控,form,views/pos/StoreControlView.vue,原型 html:3013,存在,/pos/store-control,pos-store-control,组件文件,admin-web 有（存在）
pos/门店收银,pos-log,操作记录,list,views/pos/OperationLogView.vue,原型 html:3013,存在,/pos/operation-log,pos-operation-log,组件文件,admin-web 有（存在）
report/数据报表,dash-store-rank,门店排行,fuse,views/dashboard/StoreRank.vue,原型 html:3779,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
report/数据报表,dash-trend,趋势分析,fuse,views/dashboard/TrendAnalysis.vue,原型 html:3783,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
system/系统管理,org-stores,门店档案,fuse,views/system/StoresArchive.vue,原型 html:3788,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
system/系统管理,org-inspection,巡店记录,fuse,views/system/StoreInspection.vue,原型 html:3792,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
system/系统管理,org-qualification,门店资质,fuse,views/system/StoreLicenses.vue,原型 html:3796,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
product/商品中心,product-schedule,定时上下架,fuse,views/product/ProductSchedule.vue,原型 html:3802,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
product/商品中心,tier-prices,阶梯价设置,fuse,views/product/TierPrices.vue,原型 html:3806,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
product/商品中心,min-order,起订量配置,fuse,views/product/MinOrderConfig.vue,原型 html:3809,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
customer/客户管理,ws-customers,批发客户,fuse,views/customer/WholesaleCustomers.vue,原型 html:3816,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
customer/客户管理,credit-quota,授信额度,fuse,views/customer/CreditQuota.vue,原型 html:3819,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
order/订单管理,ws-confirm,批发订单确认,fuse,views/order/WholesaleConfirm.vue,原型 html:3826,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
finance/财务管理,fin-receivable,应收账款,fuse,views/finance/Receivables.vue,原型 html:3834,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
finance/财务管理,fin-split,分账与结算,fuse,views/finance/SettlementView.vue,原型 html:3838,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
marketing/营销推广,mk-groupbuy,拼团活动,fuse,views/marketing/GroupBuying.vue,原型 html:3845,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
marketing/营销推广,mk-templates,活动模板库,fuse,views/marketing/ActivityTemplates.vue,原型 html:3849,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
marketing/营销推广,mk-budget,预算管控,fuse,views/marketing/BudgetControl.vue,原型 html:3852,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
marketing/营销推广,mk-roi,ROI 分析,fuse,views/marketing/RoiAnalysis.vue,原型 html:3856,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
purchase/采购管理,purchase-replenish,补货建议,fuse,views/purchase/ReplenishSuggest.vue,原型 html:3862,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
inventory/库存管理,trace-config,追溯配置,fuse,views/inventory/TraceConfig.vue,原型 html:3869,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
inventory/库存管理,trace-query,追溯查询,fuse,views/inventory/TraceQuery.vue,原型 html:3873,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
inventory/库存管理,trace-expiry,效期预警,fuse,views/inventory/ExpiryAlerts.vue,原型 html:3877,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
inventory/库存管理,trace-recall,召回管理,fuse,views/inventory/RecallManage.vue,原型 html:3881,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
system/系统管理,sys-perm-matrix,权限矩阵,fuse,views/system/PermissionMatrix.vue,原型 html:3887,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面
system/系统管理,sys-openapi,开放 API,fuse,views/system/OpenApiKeys.vue,原型 html:3892,不存在,UNKNOWN,UNKNOWN,无,原型有·admin-web 无页面

### CSV:TABLE_B2_ADMIN_ONLY
path,routeName,组件文件,meta.title,ref,结论
/login,login,views/LoginView.vue,登录,admin-web/src/router/index.ts:82,admin-web 有·原型 SECTORS 未列
/register,register,views/RegisterView.vue,注册,admin-web/src/router/index.ts:88,admin-web 有·原型 SECTORS 未列
/,UNKNOWN,layouts/MainLayout.vue,UNKNOWN,admin-web/src/router/index.ts:94,admin-web 有·原型 SECTORS 未列
/sale-bills/:billNo,sale-bill-detail,views/pos/SaleBillDetail.vue,销售单详情,admin-web/src/router/index.ts:107,admin-web 有·原型 SECTORS 未列
/sales/commission/records,commission-records,views/sale/CommissionRecords.vue,提成记录,admin-web/src/router/index.ts:113,admin-web 有·原型 SECTORS 未列
/order-routing,order-routing,views/order/OrderRoutingView.vue,订单路由,admin-web/src/router/index.ts:120,admin-web 有·原型 SECTORS 未列
/order-sync,order-sync,views/order/OrderSyncView.vue,订单同步,admin-web/src/router/index.ts:121,admin-web 有·原型 SECTORS 未列
/order-exception,order-exception,views/order/OrderExceptionView.vue,订单异常,admin-web/src/router/index.ts:122,admin-web 有·原型 SECTORS 未列
/order-product-map,order-product-map,views/order/OrderProductMapView.vue,订单商品映射,admin-web/src/router/index.ts:123,admin-web 有·原型 SECTORS 未列
/order-aftersale,order-aftersale,views/order/OrderAftersaleView.vue,订单售后,admin-web/src/router/index.ts:124,admin-web 有·原型 SECTORS 未列
/inventory-transfer/create,inventory-transfer-create,views/inventory/InventoryTransferCreate.vue,新建调拨,admin-web/src/router/index.ts:138,admin-web 有·原型 SECTORS 未列
/inventory-transfer/edit/:id,inventory-transfer-edit,views/inventory/InventoryTransferCreate.vue,编辑调拨,admin-web/src/router/index.ts:139,admin-web 有·原型 SECTORS 未列
/inventory-transfer/detail/:id,inventory-transfer-detail,views/inventory/InventoryTransferDetail.vue,调拨详情,admin-web/src/router/index.ts:140,admin-web 有·原型 SECTORS 未列
/inventory-alert-config,inventory-alert-config,views/inventory/InventoryAlertConfig.vue,预警配置,admin-web/src/router/index.ts:147,admin-web 有·原型 SECTORS 未列
/points-rules,points-rules,views/customer/PointsRules.vue,积分规则,admin-web/src/router/index.ts:149,admin-web 有·原型 SECTORS 未列
/level-config,level-config,views/customer/LevelConfig.vue,等级配置,admin-web/src/router/index.ts:150,admin-web 有·原型 SECTORS 未列
/store-value-cards,store-value-cards,views/customer/StoreValueCards.vue,储值卡管理,admin-web/src/router/index.ts:151,admin-web 有·原型 SECTORS 未列
/customer-tags,customer-tags,views/customer/CustomerTags.vue,客户标签,admin-web/src/router/index.ts:153,admin-web 有·原型 SECTORS 未列
/customer-profile,customer-profile,views/customer/CustomerProfile.vue,客户画像,admin-web/src/router/index.ts:154,admin-web 有·原型 SECTORS 未列
/customer-visits,customer-visits,views/customer/CustomerVisits.vue,拜访记录,admin-web/src/router/index.ts:156,admin-web 有·原型 SECTORS 未列
/customer-lifecycle,customer-lifecycle,views/customer/CustomerLifecycle.vue,客户生命周期,admin-web/src/router/index.ts:157,admin-web 有·原型 SECTORS 未列
/customer-segments,customer-segments,views/customer/CustomerSegments.vue,客户分群,admin-web/src/router/index.ts:158,admin-web 有·原型 SECTORS 未列
/customers/detail/:memberId,customer-detail,views/customer/CustomerDetail.vue,客户详情,admin-web/src/router/index.ts:161,admin-web 有·原型 SECTORS 未列
/products/import,product-import,views/product/ProductImport.vue,商品导入,admin-web/src/router/index.ts:169,admin-web 有·原型 SECTORS 未列
/products/tag-groups,tag-groups,views/product/TagGroups.vue,标签分组,admin-web/src/router/index.ts:171,admin-web 有·原型 SECTORS 未列
/products/tag-relation,product-tag-relation,views/product/ProductTagRelation.vue,标签关联,admin-web/src/router/index.ts:172,admin-web 有·原型 SECTORS 未列
/products/review-workflow,product-review-workflow,views/product/ProductReviewWorkflow.vue,审核流程配置,admin-web/src/router/index.ts:174,admin-web 有·原型 SECTORS 未列
/products/review-tasks,product-review-tasks,views/product/ProductReviewTasks.vue,审核任务,admin-web/src/router/index.ts:175,admin-web 有·原型 SECTORS 未列
/products/review-delegation,review-delegation,views/product/ReviewDelegation.vue,审核委托,admin-web/src/router/index.ts:176,admin-web 有·原型 SECTORS 未列
/instant-retail/pickup,instant-retail-pickup,views/instant-retail/InstantRetailPickup.vue,接单工作台,admin-web/src/router/index.ts:183,admin-web 有·原型 SECTORS 未列
/instant-retail/order-board,instant-retail-order-board,views/instant-retail/InstantRetailOrderBoard.vue,订单看板,admin-web/src/router/index.ts:188,admin-web 有·原型 SECTORS 未列
/finance/receipts,finance-receipts,views/finance/ReceiptsView.vue,收款单,admin-web/src/router/index.ts:197,admin-web 有·原型 SECTORS 未列
/finance/payments,finance-payments,views/finance/PaymentsNewView.vue,付款单,admin-web/src/router/index.ts:198,admin-web 有·原型 SECTORS 未列
/finance/receivables-payables,finance-receivables-payables,views/finance/ReceivablesPayables.vue,应收应付,admin-web/src/router/index.ts:199,admin-web 有·原型 SECTORS 未列
/reports/purchase,purchase-reports,views/report/PurchaseReports.vue,采购报表,admin-web/src/router/index.ts:209,admin-web 有·原型 SECTORS 未列
/reports/products,reports-products,views/report/ReportsProducts.vue,商品报表,admin-web/src/router/index.ts:210,admin-web 有·原型 SECTORS 未列
/reports/employees,reports-employees,views/report/ReportsEmployees.vue,员工报表,admin-web/src/router/index.ts:211,admin-web 有·原型 SECTORS 未列
/reports/stores,reports-stores,views/report/ReportsStores.vue,门店报表,admin-web/src/router/index.ts:212,admin-web 有·原型 SECTORS 未列
/reports/transfer,transfer-reports,views/report/TransferReport.vue,调拨统计,admin-web/src/router/index.ts:217,admin-web 有·原型 SECTORS 未列
/reports/custom-report,custom-report,views/report/CustomReport.vue,自定义报表,admin-web/src/router/index.ts:218,admin-web 有·原型 SECTORS 未列
/marketing/flash-sale,marketing-flash-sale,views/marketing/FlashSale.vue,秒杀活动,admin-web/src/router/index.ts:228,admin-web 有·原型 SECTORS 未列
/marketing/full-reduction,marketing-full-reduction,views/marketing/FullReduction.vue,满减满赠,admin-web/src/router/index.ts:229,admin-web 有·原型 SECTORS 未列
/organization,organization,views/system/OrganizationView.vue,组织架构,admin-web/src/router/index.ts:233,admin-web 有·原型 SECTORS 未列
/department-manage,department-manage,views/system/DepartmentManage.vue,部门管理,admin-web/src/router/index.ts:234,admin-web 有·原型 SECTORS 未列
/position-manage,position-manage,views/system/PositionManage.vue,岗位管理,admin-web/src/router/index.ts:235,admin-web 有·原型 SECTORS 未列
/stores,stores,views/system/StoresView.vue,门店管理,admin-web/src/router/index.ts:236,admin-web 有·原型 SECTORS 未列
/error-log,error-log,views/system/ErrorLogView.vue,错误日志,admin-web/src/router/index.ts:239,admin-web 有·原型 SECTORS 未列
/system,system,views/system/System.vue,系统设置,admin-web/src/router/index.ts:240,admin-web 有·原型 SECTORS 未列
/system/print/designer/:id?,system-print-designer,modules/print/PrintTemplateDesigner.vue,模板设计,admin-web/src/router/index.ts:243,admin-web 有·原型 SECTORS 未列
/system/approval/rules,approval-rules,views/system/ApprovalRules.vue,审批规则,admin-web/src/router/index.ts:244,admin-web 有·原型 SECTORS 未列
/report-permissions,report-permissions,views/system/ReportPermission.vue,报表权限,admin-web/src/router/index.ts:246,admin-web 有·原型 SECTORS 未列
/system/approval/detail/:id,approval-detail,views/system/ApprovalDetail.vue,审批详情,admin-web/src/router/index.ts:247,admin-web 有·原型 SECTORS 未列
/system/approval/my,my-approvals,views/system/MyApprovals.vue,我的审批,admin-web/src/router/index.ts:248,admin-web 有·原型 SECTORS 未列
/system/payment,payment-config,views/system/PaymentConfigView.vue,支付配置,admin-web/src/router/index.ts:249,admin-web 有·原型 SECTORS 未列
/system/miniapp,miniapp-config,views/system/MiniappConfigView.vue,小程序配置,admin-web/src/router/index.ts:250,admin-web 有·原型 SECTORS 未列
/monitor-manage,monitor-manage,views/system/SystemMonitorManage.vue,系统监控,admin-web/src/router/index.ts:252,admin-web 有·原型 SECTORS 未列
/consumer-addresses,consumer-addresses,views/system/ConsumerAddress.vue,收货地址,admin-web/src/router/index.ts:254,admin-web 有·原型 SECTORS 未列
/pos/sale-bills/:billNo,pos-sale-bill-detail,views/pos/SaleBillDetail.vue,销售单详情,admin-web/src/router/index.ts:261,admin-web 有·原型 SECTORS 未列
/pos/shift/:id,pos-shift-detail,views/pos/ShiftDetailView.vue,交接班详情,admin-web/src/router/index.ts:269,admin-web 有·原型 SECTORS 未列
/pos/daily-settle,pos-daily-settle,views/pos/DailySettleView.vue,日结管理,admin-web/src/router/index.ts:270,admin-web 有·原型 SECTORS 未列
/:pathMatch(.*)*,not-found,views/NotFound.vue,页面不存在,admin-web/src/router/index.ts:275,admin-web 有·原型 SECTORS 未列

### CSV:TABLE_C_MENUCODE
menuCode,menu_name,menu_type,DB path,routeName,route path,状态,消费方,来源 ref
dashboard,仪表盘,CATALOG,/dashboard,dashboard,/dashboard,可对齐,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:101
goods,商品管理,CATALOG,/goods,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:102
sale,销售管理,CATALOG,/sale,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:103
purchase,采购管理,CATALOG,/purchase,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:104
customer,客户管理,CATALOG,/customer,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:105
finance,财务管理,CATALOG,/finance,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:106
marketing,营销管理,CATALOG,/marketing,marketing,/marketing,可对齐,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:107
store,门店管理,CATALOG,/store,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:108
trace,追溯管理,CATALOG,/trace,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:109
report,报表中心,CATALOG,/report,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:110
system,系统管理,CATALOG,/system,system,/system,可对齐,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:111
dashboard:workbench,工作台,MENU,/dashboard/workbench,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:115
goods:list,商品列表,MENU,/goods/list,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:119
goods:category,商品分类,MENU,/goods/category,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:120
goods:price-level,价格等级,MENU,/goods/price-level,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:121
goods:price,阶梯价格,MENU,/goods/price,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:122
goods:inventory,库存查询,MENU,/goods/inventory,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:123
goods:batch,库存批次,MENU,/goods/batch,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:124
goods:ledger,库存流水,MENU,/goods/ledger,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:125
sale:bill,销售开单,MENU,/sale/bill,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:129
sale:record,销售记录,MENU,/sale/record,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:130
sale:return,销售退货,MENU,/sale/return,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:131
sale:miniapp,小程序订单,MENU,/sale/miniapp,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:132
sale:cart,购物车管理,MENU,/sale/cart,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:133
purchase:order,采购订单,MENU,/purchase/order,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:137
purchase:inbound,采购入库,MENU,/purchase/inbound,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:138
purchase:return,采购退货,MENU,/purchase/return,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:139
purchase:payment,采购付款,MENU,/purchase/payment,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:140
purchase:supplier,供应商管理,MENU,/purchase/supplier,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:141
customer:list,客户列表,MENU,/customer/list,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:145
customer:credit,客户授信,MENU,/customer/credit,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:146
customer:statement,客户对账,MENU,/customer/statement,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:147
customer:visit,客户拜访,MENU,/customer/visit,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:148
customer:payment,客户收款,MENU,/customer/payment,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:149
finance:receipt,收款管理,MENU,/finance/receipt,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:153
finance:payment,付款管理,MENU,/finance/payment,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:154
finance:statement,对账管理,MENU,/finance/statement,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:155
finance:receivable,应收账款,MENU,/finance/receivable,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:156
finance:report,财务报表,MENU,/finance/report,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:157
marketing:coupon,优惠券,MENU,/marketing/coupon,marketing-coupon,/marketing/coupon,可对齐,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:161
marketing:full-reduction,满减活动,MENU,/marketing/full-reduction,marketing-full-reduction,/marketing/full-reduction,可对齐,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:162
marketing:flash-sale,秒杀活动,MENU,/marketing/flash-sale,marketing-flash-sale,/marketing/flash-sale,可对齐,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:163
marketing:group-buy,拼团活动,MENU,/marketing/group-buy,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:164
marketing:points,积分管理,MENU,/marketing/points,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:165
store:list,门店列表,MENU,/store/list,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:169
store:control,门店管控,MENU,/store/control,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:170
store:transfer,调拨管理,MENU,/store/transfer,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:171
store:stock-check,盘点管理,MENU,/store/stock-check,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:172
trace:config,追溯配置,MENU,/trace/config,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:176
trace:code,追溯码管理,MENU,/trace/code,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:177
trace:scan,扫码记录,MENU,/trace/scan,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:178
trace:recall,召回管理,MENU,/trace/recall,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:179
report:sales,销售报表,MENU,/report/sales,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:183
report:product,商品报表,MENU,/report/product,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:184
report:finance,财务报表,MENU,/report/finance,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:185
report:customer,客户报表,MENU,/report/customer,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:186
report:staff,员工报表,MENU,/report/staff,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:187
system:user,用户管理,MENU,/system/user,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:191
system:role,角色管理,MENU,/system/role,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:192
system:tenant,租户管理,MENU,/system/tenant,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:193
system:subscription,订阅管理,MENU,/system/subscription,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:194
system:config,系统配置,MENU,/system/config,system-config,/system/config,可对齐,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:195
system:audit,操作日志,MENU,/system/audit,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:196
system:approval,审批管理,MENU,/system/approval,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:197
goods:create,新增商品,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:201
goods:edit,编辑商品,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:202
goods:delete,删除商品,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:203
goods:inventory:adjust,库存调整,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:204
sale:create,开单,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:205
sale:void,作废,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:206
sale:edit,编辑,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:207
purchase:create,新建采购,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:208
purchase:approve,审核采购,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:209
customer:create,新增客户,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:210
customer:edit,编辑客户,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:211
customer:credit:adjust,额度调整,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:212
finance:receipt:create,新增收款,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:213
finance:payment:create,新增付款,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:214
marketing:create,创建活动,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:215
store:create,新增门店,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:216
store:edit,编辑门店,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:217
system:user:create,新增用户,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:218
system:user:edit,编辑用户,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:219
system:role:create,新增角色,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:220
system:role:edit,编辑角色,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/079_权限矩阵.sql:221
sale:cancel,取消销售单,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/203_销售单取消权限点.sql:2
system:alert:handle,处理预警,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:19
system:alert:rule-edit,维护预警规则,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:20
system:alert:check,手动预警检查,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:21
system:archive:execute,执行数据归档,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:22
system:notification:read,通知标记已读,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:23
system:notification:read-all,通知全部已读,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:24
system:notification:send,发送通知,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:25
system:notification:delete,删除通知,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:26
system:notification:batch-delete,批量删除通知,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:27
system:push:test,发送测试推送,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:28
system:sms-template:create,新增短信模板,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:29
system:sms-template:edit,编辑短信模板,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:30
system:sms-template:delete,删除短信模板,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:31
system:migration:run,执行数据库迁移,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/204_系统设置域权限点立码.sql:32
report:custom:create,新建自定义报表,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:5
report:custom:edit,编辑自定义报表,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:6
report:custom:delete,删除自定义报表,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:7
report:custom:generate,生成自定义报表,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:8
report:schedule:create,新建报表定时任务,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:9
report:schedule:edit,编辑报表定时任务,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:10
report:schedule:delete,删除报表定时任务,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:11
report:schedule:toggle,启停报表定时任务,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:12
report:schedule:run,手动执行报表定时任务,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:13
report:permission:edit,维护报表权限,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:14
report:export,导出报表,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:15
system:print-record:create,保存打印记录,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:16
system:print-record:reprint,重打小票,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:17
system:print-template:create,新建打印模板,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:18
system:print-template:edit,编辑打印模板,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:19
system:print-template:delete,删除打印模板,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:20
system:print-template:reset,重置打印模板,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:21
system:print-template:set-default,设为默认打印模板,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:22
store:hardware:config-edit,编辑硬件配置,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:23
store:hardware:config-test,测试硬件配置,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:24
store:hardware:announce,云喇叭播报,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:25
store:hardware:box-pay,收银盒支付,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:26
store:hardware:box-config-edit,编辑收银盒配置,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:27
store:hardware:box-config-test,测试收银盒配置,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:28
store:hardware:unionpay-test,测试云闪付,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:29
miniapp:config:edit,编辑小程序配置,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:30
miniapp:package:upload-key,上传小程序密钥,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:31
miniapp:package:build,构建小程序包,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:32
miniapp:package:publish,发布小程序,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:33
miniapp:order-sync:retry,小程序订单同步重试,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:34
dashboard:todo:create,新建待办,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:35
dashboard:todo:complete,完成待办,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:36
dashboard:todo:dismiss,忽略待办,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:37
dashboard:todo:delete,删除待办,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:38
dashboard:quick-entry:create,新建快捷入口,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:39
dashboard:quick-entry:sort,调整快捷入口排序,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:40
dashboard:quick-entry:edit,编辑快捷入口,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:41
dashboard:quick-entry:delete,删除快捷入口,BUTTON,UNKNOWN,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,docs/migrations/207_四域权限点立码.sql:42
customer:address,收货地址,MENU(app-mobile catalog),/customer/address,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:68
customer:level,会员等级,MENU(app-mobile catalog),/customer/level,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:69
customer:points,积分管理,MENU(app-mobile catalog),/customer/points,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:70
customer:stored-card,储值卡,MENU(app-mobile catalog),/customer/stored-card,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:71
finance:expenses,费用支出,MENU(app-mobile catalog),/finance/expenses,finance-expenses,/finance/expenses,可对齐,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:72
finance:reconciliation,收银对账,MENU(app-mobile catalog),/finance/reconciliation,finance-reconciliation,/finance/reconciliation,可对齐,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:73
finance:transfer,门店调拨,MENU(app-mobile catalog),/finance/transfer,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:74
goods:loss-gain,报损报益,MENU(app-mobile catalog),/goods/loss-gain,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:75
goods:stock-check,盘点调拨,MENU(app-mobile catalog),/goods/stock-check,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:76
goods:stock-warning,库存预警,MENU(app-mobile catalog),/goods/stock-warning,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:77
goods:trace,溯源查询,MENU(app-mobile catalog),/goods/trace,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:78
marketing:activities,营销活动,MENU(app-mobile catalog),/marketing/activities,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:79
marketing:bargain,砍价活动,MENU(app-mobile catalog),/marketing/bargain,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:80
marketing:community,社区营销,MENU(app-mobile catalog),/marketing/community,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:81
marketing:seckill,秒杀活动,MENU(app-mobile catalog),/marketing/seckill,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:82
report:dashboard,经营报表,MENU(app-mobile catalog),/report/dashboard,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:83
report:finance-report,财务报表,MENU(app-mobile catalog),/report/finance-report,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:84
report:inventory,库存报表,MENU(app-mobile catalog),/report/inventory,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:85
report:purchase,采购报表,MENU(app-mobile catalog),/report/purchase,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:86
store:employees,员工管理,MENU(app-mobile catalog),/store/employees,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:87
store:roles,角色管理,MENU(app-mobile catalog),/store/roles,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:88
system:more,更多功能,MENU(app-mobile catalog),/system/more,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:89
system:operation-log,操作日志,MENU(app-mobile catalog),/system/operation-log,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:90
system:permission,报表权限,MENU(app-mobile catalog),/system/permission,UNKNOWN,UNKNOWN,menuCode 有码·admin-web 无同名/同路径路由,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:91
system:print,单据打印,MENU(app-mobile catalog),/system/print,system-print,/system/print,可对齐,admin-web 未调用 /api/admin/menus/user,backend/src/shared/app-mobile-menu-catalog.ts:92

### JSON:SUMMARY
{"ROUTE_DECLARATIONS":164,"ROUTE_TOP_LEVEL":4,"ROUTE_CHILDREN":160,"ROUTE_WITH_NAME":163,"ROUTE_WITHOUT_NAME":1,"UNIQUE_COMPONENT_FILES":158,"UNIQUE_COMPONENT_FILES_PAGE_ONLY":155,"UNIQUE_COMPONENT_EXCLUDED_NON_PAGE":"layouts/MainLayout.vue|views/LoginView.vue|views/NotFound.vue","COMPONENT_REUSED_DEFS":6,"ROUTE_META_HIDDEN":5,"ROUTE_FULLSCREEN":1,"ROUTE_NO_ROLES_META":4,"ROUTE_WITH_ROLES_META":160,"MENU_GROUP_COUNT":12,"MENU_ITEM_COUNT":71,"CASHIER_NAV_ITEM_COUNT":9,"MENU_PATH_UNIQUE":80,"MENU_PATH_MATCHED_ROUTE":79,"MENU_PATH_UNMATCHED_ROUTE":1,"ROUTE_VISIBLE_IN_MENU":79,"ROUTE_HIDDEN_TOTAL_NON_MENU":85,"PROTO_SECTOR_COUNT":13,"PROTO_LV2_BASE":103,"PROTO_FUSE_PAGES":24,"PROTO_PAGES_TOTAL":127,"PROTO_PAGE_MATCHED":103,"PROTO_PAGE_MATCHED_BY_NAME":49,"PROTO_PAGE_MATCHED_BY_COMPONENT":54,"PROTO_PAGE_MISSING_IN_ADMIN":24,"PROTO_MISSING_WITH_COMP_FILE":0,"ADMIN_ONLY_PAGES":61,"ROUTE_COMPONENT_FILE_MISSING":0,"BACKEND_MENU_ENDPOINT":"EXISTS","BACKEND_MENU_CODES_PARSED":201,"BACKEND_MENU_CODES_UNIQUE":163,"BACKEND_MENU_CODES_CATALOG_ROWS":163,"BACKEND_MENU_CODES_ALIGNED_TO_ROUTE":10,"BACKEND_MENU_CODES_UNALIGNED":153,"ADMIN_WEB_CALLS_MENUS_USER":0,"ADMIN_WEB_MENU_CODE_REFERENCES":0}

ELAPSED_MS=1107
```

## 3. 表A · 现有页面矩阵（164 条路由声明，逐条带 ref）

列口径：`一级菜单 / 二级菜单` 取 `MainLayout.vue` 人工导航（最后一列给该行 ref）；不在导航的写「非菜单路由」，二级列回落 `meta.title`。`hidden?` 三值：`否`（导航可见）/ `meta.hidden` / `是（非侧栏菜单）`（无 hidden 但导航里进不去）。`权限/roles meta` = `meta.roles`，无则「无」。

| 一级菜单 | 二级菜单 | path | routeName | 组件文件 | 组件文件存在 | hidden? | 权限/roles meta | route ref | 菜单 ref |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 非菜单路由 | 登录 | /login | login | views/LoginView.vue | 存在 | 是（非侧栏菜单） | 无 | admin-web/src/router/index.ts:82 | 无（不在导航） |
| 非菜单路由 | 注册 | /register | register | views/RegisterView.vue | 存在 | 是（非侧栏菜单） | 无 | admin-web/src/router/index.ts:88 | 无（不在导航） |
| 非菜单路由 | UNKNOWN | / | UNKNOWN | layouts/MainLayout.vue | 存在 | 是（非侧栏菜单） | 无 | admin-web/src/router/index.ts:94 | 无（不在导航） |
| 工作台 | 工作台 | /dashboard | dashboard | views/dashboard/Dashboard.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:100 | admin-web/src/layouts/MainLayout.vue:95 |
| 非菜单路由 | 待办事项 | /todo-list | todo-list | views/dashboard/TodoList.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:101 | 无（不在导航） |
| 非菜单路由 | 快捷入口配置 | /quick-entries | quick-entry-config | views/dashboard/QuickEntryConfig.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:102 | 无（不在导航） |
| 非菜单路由 | 消息中心 | /messages | message-center | views/dashboard/MessageCenter.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:103 | 无（不在导航） |
| 业务 / 销售管理 | 销售开单 | /sales/create | sales-order-create | views/sale/SalesOrderCreate.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:105 | admin-web/src/layouts/MainLayout.vue:127 |
| 业务 / 销售管理 | 销售单据 | /sale-bills | sale-bills | views/pos/SaleBillsView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:106 | admin-web/src/layouts/MainLayout.vue:128 |
| 非菜单路由 | 销售单详情 | /sale-bills/:billNo | sale-bill-detail | views/pos/SaleBillDetail.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:107 | 无（不在导航） |
| 业务 / 销售管理 | 销售退货 | /sale-returns | sale-returns | views/pos/SaleReturnView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:108 | admin-web/src/layouts/MainLayout.vue:129 |
| 业务 / 销售管理 | 收款管理 | /collection | collection | views/pos/CollectionView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:109 | admin-web/src/layouts/MainLayout.vue:130 |
| 非菜单路由 | 收款关联 | /sales/collection-links | collection-links | views/sale/CollectionLinks.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:110 | 无（不在导航） |
| 业务 / 销售管理 | 客户价格 | /sales/customer-prices | customer-prices | views/sale/CustomerPrices.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:111 | admin-web/src/layouts/MainLayout.vue:131 |
| 业务 / 销售管理 | 提成规则 | /sales/commission/rules | commission-rules | views/sale/CommissionRules.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:112 | admin-web/src/layouts/MainLayout.vue:132 |
| 非菜单路由 | 提成记录 | /sales/commission/records | commission-records | views/sale/CommissionRecords.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:113 | 无（不在导航） |
| 业务 / 销售管理 | 销售报表 | /sales/reports | sales-reports | views/sale/SalesReports.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:114 | admin-web/src/layouts/MainLayout.vue:133 |
| 业务 / 订单管理 | 订单列表 | /orders | orders | views/order/Orders.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:116 | admin-web/src/layouts/MainLayout.vue:112 |
| 业务 / 订单管理 | 订单看板 | /order-board | order-board | views/order/OrderBoardView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:117 | admin-web/src/layouts/MainLayout.vue:113 |
| 非菜单路由 | 订单超时 | /order-timeout | order-timeout | views/order/OrderTimeoutView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:118 | 无（不在导航） |
| 非菜单路由 | 订单中心 | /order-center | order-center | views/order/OrderCenterView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:119 | 无（不在导航） |
| 非菜单路由 | 订单路由 | /order-routing | order-routing | views/order/OrderRoutingView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:120 | 无（不在导航） |
| 非菜单路由 | 订单同步 | /order-sync | order-sync | views/order/OrderSyncView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:121 | 无（不在导航） |
| 业务 / 订单管理 | 订单异常 | /order-exception | order-exception | views/order/OrderExceptionView.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:122 | admin-web/src/layouts/MainLayout.vue:115 |
| 非菜单路由 | 订单商品映射 | /order-product-map | order-product-map | views/order/OrderProductMapView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:123 | 无（不在导航） |
| 业务 / 订单管理 | 订单售后 | /order-aftersale | order-aftersale | views/order/OrderAftersaleView.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:124 | admin-web/src/layouts/MainLayout.vue:114 |
| 功能 / 采购管理 | 采购订单 | /purchase-orders | purchase-orders | views/purchase/PurchaseOrders.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:126 | admin-web/src/layouts/MainLayout.vue:217 |
| 功能 / 采购管理 | 采购入库 | /purchase-in-stocks | purchase-in-stocks | views/purchase/PurchaseInStocks.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:127 | admin-web/src/layouts/MainLayout.vue:218 |
| 非菜单路由 | 采购退货 | /purchase-returns | purchase-returns | views/purchase/PurchaseReturnsView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:128 | 无（不在导航） |
| 非菜单路由 | 采购合同 | /purchase-contracts | purchase-contracts | views/purchase/PurchaseContracts.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:129 | 无（不在导航） |
| 非菜单路由 | 供应商对账 | /purchase/supplier-statements | supplier-statements | views/purchase/SupplierStatements.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:130 | 无（不在导航） |
| 非菜单路由 | 采购计划 | /purchase/plans | purchase-plans | views/purchase/PurchasePlans.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:131 | 无（不在导航） |
| 功能 / 采购管理 | 采购付款 | /purchase-payments | purchase-payments | views/purchase/PurchasePayments.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:132 | admin-web/src/layouts/MainLayout.vue:220 |
| 功能 / 采购管理 | 供应商管理 | /suppliers | suppliers | views/purchase/Suppliers.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:133 | admin-web/src/layouts/MainLayout.vue:219 |
| 业务 / 库存中心 | 库存查询 | /inventory | inventory | views/inventory/Inventory.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:135 | admin-web/src/layouts/MainLayout.vue:163 |
| 业务 / 库存中心 | 库存盘点 | /inventory-check | inventory-check | views/inventory/InventoryCheck.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:136 | admin-web/src/layouts/MainLayout.vue:164 |
| 业务 / 库存中心 | 库存调拨 | /inventory-transfer | inventory-transfer | views/inventory/InventoryTransfer.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:137 | admin-web/src/layouts/MainLayout.vue:165 |
| 非菜单路由 | 新建调拨 | /inventory-transfer/create | inventory-transfer-create | views/inventory/InventoryTransferCreate.vue | 存在 | meta.hidden | SUPER_ADMIN | admin-web/src/router/index.ts:138 | 无（不在导航） |
| 非菜单路由 | 编辑调拨 | /inventory-transfer/edit/:id | inventory-transfer-edit | views/inventory/InventoryTransferCreate.vue | 存在 | meta.hidden | SUPER_ADMIN | admin-web/src/router/index.ts:139 | 无（不在导航） |
| 非菜单路由 | 调拨详情 | /inventory-transfer/detail/:id | inventory-transfer-detail | views/inventory/InventoryTransferDetail.vue | 存在 | meta.hidden | SUPER_ADMIN | admin-web/src/router/index.ts:140 | 无（不在导航） |
| 非菜单路由 | 库存共享设置 | /inventory-share-config | inventory-share-config | views/inventory/InventoryShareConfig.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:141 | 无（不在导航） |
| 非菜单路由 | 库存批次 | /inventory-batch | inventory-batch | views/inventory/InventoryBatch.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:142 | 无（不在导航） |
| 业务 / 库存中心 | 批量调价 | /inventory-batch-price | inventory-batch-price | views/inventory/InventoryBatchPrice.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:143 | admin-web/src/layouts/MainLayout.vue:167 |
| 非菜单路由 | 报价管理 | /inventory-price-quote | inventory-price-quote | views/inventory/InventoryPriceQuote.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:144 | 无（不在导航） |
| 业务 / 库存中心 | 库存预警 | /inventory-alerts | inventory-alerts | views/inventory/InventoryAlerts.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:145 | admin-web/src/layouts/MainLayout.vue:166 |
| 非菜单路由 | 库存成本 | /inventory-cost | inventory-cost | views/inventory/InventoryCost.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:146 | 无（不在导航） |
| 非菜单路由 | 预警配置 | /inventory-alert-config | inventory-alert-config | views/inventory/InventoryAlertConfig.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:147 | 无（不在导航） |
| 非菜单路由 | 库存报表 | /inventory-reports | inventory-reports | views/inventory/InventoryReports.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:148 | 无（不在导航） |
| 业务 / 客户会员 | 积分规则 | /points-rules | points-rules | views/customer/PointsRules.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:149 | admin-web/src/layouts/MainLayout.vue:183 |
| 业务 / 客户会员 | 等级配置 | /level-config | level-config | views/customer/LevelConfig.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:150 | admin-web/src/layouts/MainLayout.vue:184 |
| 业务 / 客户会员 | 储值卡 | /store-value-cards | store-value-cards | views/customer/StoreValueCards.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:151 | admin-web/src/layouts/MainLayout.vue:181 |
| 业务 / 客户会员 | 会员体系 | /member-system | member-system | views/customer/MemberSystem.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:152 | admin-web/src/layouts/MainLayout.vue:180 |
| 非菜单路由 | 客户标签 | /customer-tags | customer-tags | views/customer/CustomerTags.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:153 | 无（不在导航） |
| 非菜单路由 | 客户画像 | /customer-profile | customer-profile | views/customer/CustomerProfile.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:154 | 无（不在导航） |
| 非菜单路由 | 客户关怀 | /customer-care | customer-care-rules | views/customer/CustomerCareRules.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:155 | 无（不在导航） |
| 非菜单路由 | 拜访记录 | /customer-visits | customer-visits | views/customer/CustomerVisits.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:156 | 无（不在导航） |
| 非菜单路由 | 客户生命周期 | /customer-lifecycle | customer-lifecycle | views/customer/CustomerLifecycle.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:157 | 无（不在导航） |
| 非菜单路由 | 客户分群 | /customer-segments | customer-segments | views/customer/CustomerSegments.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:158 | 无（不在导航） |
| 业务 / 客户会员 | 客户列表 | /customers | customers | views/customer/CustomersView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:160 | admin-web/src/layouts/MainLayout.vue:179 |
| 非菜单路由 | 客户详情 | /customers/detail/:memberId | customer-detail | views/customer/CustomerDetail.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:161 | 无（不在导航） |
| 非菜单路由 | 客户类型 | /customer-types | customer-types | views/customer/CustomerTypes.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:162 | 无（不在导航） |
| 业务 / 客户会员 | 信用管理 | /credit | credit | views/customer/CreditView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:163 | admin-web/src/layouts/MainLayout.vue:182 |
| 业务 / 商品中心 | 商品列表 | /products | products | views/product/Products.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:165 | admin-web/src/layouts/MainLayout.vue:145 |
| 业务 / 商品中心 | 商品分类 | /products/categories | product-categories | views/product/ProductCategories.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:166 | admin-web/src/layouts/MainLayout.vue:146 |
| 业务 / 商品中心 | 品牌管理 | /products/brands | brands | views/product/Brands.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:167 | admin-web/src/layouts/MainLayout.vue:147 |
| 非菜单路由 | 单位管理 | /products/units | units | views/product/Units.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:168 | 无（不在导航） |
| 业务 / 商品中心 | 商品导入 | /products/import | product-import | views/product/ProductImport.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:169 | admin-web/src/layouts/MainLayout.vue:149 |
| 非菜单路由 | 商品标签 | /products/tags | product-tags | views/product/ProductTags.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:170 | 无（不在导航） |
| 非菜单路由 | 标签分组 | /products/tag-groups | tag-groups | views/product/TagGroups.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:171 | 无（不在导航） |
| 非菜单路由 | 标签关联 | /products/tag-relation | product-tag-relation | views/product/ProductTagRelation.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:172 | 无（不在导航） |
| 业务 / 商品中心 | 商品审核 | /products/reviews | product-reviews | views/product/ProductReview.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:173 | admin-web/src/layouts/MainLayout.vue:151 |
| 非菜单路由 | 审核流程配置 | /products/review-workflow | product-review-workflow | views/product/ProductReviewWorkflow.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:174 | 无（不在导航） |
| 非菜单路由 | 审核任务 | /products/review-tasks | product-review-tasks | views/product/ProductReviewTasks.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER\|FINANCE_ADMIN\|WAREHOUSE_ADMIN | admin-web/src/router/index.ts:175 | 无（不在导航） |
| 非菜单路由 | 审核委托 | /products/review-delegation | review-delegation | views/product/ReviewDelegation.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:176 | 无（不在导航） |
| 业务 / 商品中心 | 套装与组合品 | /products/combo | product-combo | views/product/ProductCombo.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:177 | admin-web/src/layouts/MainLayout.vue:150 |
| 业务 / 商品中心 | 价格管理 | /prices | prices | views/product/PricesView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:178 | admin-web/src/layouts/MainLayout.vue:148 |
| 功能 / 即时零售 | 平台配置 | /instant-retail/config | instant-retail-config | views/instant-retail/InstantRetailConfig.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:180 | admin-web/src/layouts/MainLayout.vue:232 |
| 功能 / 即时零售 | 商品货架 | /instant-retail/shelf | instant-retail-shelf | views/instant-retail/InstantRetailShelf.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:181 | admin-web/src/layouts/MainLayout.vue:236 |
| 功能 / 即时零售 | 小程序订单 | /instant-retail/orders | instant-retail-orders | views/instant-retail/InstantRetailOrders.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:182 | admin-web/src/layouts/MainLayout.vue:234 |
| 功能 / 即时零售 | 接单工作台 | /instant-retail/pickup | instant-retail-pickup | views/instant-retail/InstantRetailPickup.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:183 | admin-web/src/layouts/MainLayout.vue:233 |
| 功能 / 即时零售 | 平台对账 | /instant-retail/payment | instant-retail-payment | views/instant-retail/InstantRetailPayment.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:184 | admin-web/src/layouts/MainLayout.vue:240 |
| 功能 / 即时零售 | 配送管理 | /instant-retail/delivery | instant-retail-delivery | views/instant-retail/InstantRetailDelivery.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:185 | admin-web/src/layouts/MainLayout.vue:238 |
| 功能 / 即时零售 | 零售报表 | /instant-retail/report | instant-retail-report | views/instant-retail/InstantRetailReport.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:186 | admin-web/src/layouts/MainLayout.vue:243 |
| 功能 / 即时零售 | 平台管理 | /instant-retail/platform | instant-retail-platform | views/instant-retail/InstantRetailPlatform.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:187 | admin-web/src/layouts/MainLayout.vue:239 |
| 功能 / 即时零售 | 订单看板 | /instant-retail/order-board | instant-retail-order-board | views/instant-retail/InstantRetailOrderBoard.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:188 | admin-web/src/layouts/MainLayout.vue:235 |
| 功能 / 即时零售 | 平台公告 | /instant-retail/announcements | retail-announcements | views/instant-retail/RetailAnnouncement.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:189 | admin-web/src/layouts/MainLayout.vue:241 |
| 功能 / 即时零售 | 零售看板 | /instant-retail/dashboard | instant-retail-dashboard | views/instant-retail/InstantRetailDashboard.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:190 | admin-web/src/layouts/MainLayout.vue:242 |
| 功能 / 即时零售 | 库存同步 | /instant-retail/sync | instant-retail-sync | views/instant-retail/InstantRetailSync.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:191 | admin-web/src/layouts/MainLayout.vue:237 |
| 业务 / 财务中心 | 收付款管理 | /payments | payments | views/finance/PaymentsView.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:193 | admin-web/src/layouts/MainLayout.vue:196 |
| 非菜单路由 | 回款管理 | /finance/collection | finance-collection | views/finance/FinanceCollection.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:194 | 无（不在导航） |
| 业务 / 财务中心 | 客户对账 | /customer-statements | customer-statements | views/finance/CustomerStatements.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:195 | admin-web/src/layouts/MainLayout.vue:198 |
| 业务 / 财务中心 | 利润核算 | /finance/profit | finance-profit | views/finance/FinanceProfit.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:196 | admin-web/src/layouts/MainLayout.vue:200 |
| 非菜单路由 | 收款单 | /finance/receipts | finance-receipts | views/finance/ReceiptsView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:197 | 无（不在导航） |
| 非菜单路由 | 付款单 | /finance/payments | finance-payments | views/finance/PaymentsNewView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:198 | 无（不在导航） |
| 业务 / 财务中心 | 应收应付 | /finance/receivables-payables | finance-receivables-payables | views/finance/ReceivablesPayables.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:199 | admin-web/src/layouts/MainLayout.vue:197 |
| 非菜单路由 | 费用管理 | /finance/expenses | finance-expenses | views/finance/ExpensesView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:200 | 无（不在导航） |
| 业务 / 财务中心 | 财务对账 | /finance/reconciliation | finance-reconciliation | views/finance/ReconciliationView.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:201 | admin-web/src/layouts/MainLayout.vue:199 |
| 非菜单路由 | 财务看板 | /finance/dashboard | finance-dashboard | views/finance/FinanceDashboard.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:202 | 无（不在导航） |
| 非菜单路由 | 银行账户 | /bank-accounts | bank-accounts | views/finance/BankAccounts.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:203 | 无（不在导航） |
| 业务 / 财务中心 | 资金报表 | /fund-report | fund-report | views/finance/FinanceReport.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:204 | admin-web/src/layouts/MainLayout.vue:201 |
| 非菜单路由 | 票据管理 | /bill-management | bill-management | views/finance/BillManagement.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:205 | 无（不在导航） |
| 业务 / 财务中心 | 单据管理 | /history-bills | history-bills | views/finance/HistoryBills.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:206 | admin-web/src/layouts/MainLayout.vue:202 |
| 功能 / 数据报表 | 销售统计 | /reports | reports | views/report/Reports.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:208 | admin-web/src/layouts/MainLayout.vue:272 |
| 非菜单路由 | 采购报表 | /reports/purchase | purchase-reports | views/report/PurchaseReports.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:209 | 无（不在导航） |
| 功能 / 数据报表 | 商品排行 | /reports/products | reports-products | views/report/ReportsProducts.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:210 | admin-web/src/layouts/MainLayout.vue:274 |
| 功能 / 数据报表 | 员工业绩 | /reports/employees | reports-employees | views/report/ReportsEmployees.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:211 | admin-web/src/layouts/MainLayout.vue:275 |
| 非菜单路由 | 门店报表 | /reports/stores | reports-stores | views/report/ReportsStores.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:212 | 无（不在导航） |
| 功能 / 数据报表 | 销售分析 | /reports/sales-analysis | sales-analysis | views/report/SalesAnalysis.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:213 | admin-web/src/layouts/MainLayout.vue:273 |
| 非菜单路由 | 回款分析 | /reports/collection-analysis | collection-analysis | views/report/CollectionAnalysis.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:214 | 无（不在导航） |
| 非菜单路由 | 客户分析 | /reports/customers | customer-analysis | views/report/CustomerAnalysis.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:215 | 无（不在导航） |
| 非菜单路由 | 库存报表 | /reports/inventory | reports-inventory | views/inventory/InventoryReports.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:216 | 无（不在导航） |
| 非菜单路由 | 调拨统计 | /reports/transfer | transfer-reports | views/report/TransferReport.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:217 | 无（不在导航） |
| 非菜单路由 | 自定义报表 | /reports/custom-report | custom-report | views/report/CustomReport.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:218 | 无（不在导航） |
| 功能 / 营销中心 | 营销活动 | /marketing | marketing | views/marketing/MarketingView.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:220 | admin-web/src/layouts/MainLayout.vue:255 |
| 非菜单路由 | 营销标签 | /marketing/tags | marketing-tags | views/marketing/MarketingTags.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:221 | 无（不在导航） |
| 功能 / 营销中心 | 限时折扣 | /marketing/limited-discount | marketing-limited-discount | views/marketing/MarketingLimitedDiscount.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:222 | admin-web/src/layouts/MainLayout.vue:257 |
| 非菜单路由 | 赠品规则 | /marketing/gift-rule | marketing-gift-rule | views/marketing/MarketingGiftRule.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:223 | 无（不在导航） |
| 非菜单路由 | 积分商城 | /marketing/points-mall | marketing-points-mall | views/marketing/MarketingPointsMall.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:224 | 无（不在导航） |
| 非菜单路由 | 营销看板 | /marketing/dashboard | marketing-dashboard | views/marketing/MarketingDashboard.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:225 | 无（不在导航） |
| 非菜单路由 | 营销素材 | /marketing/materials | marketing-material | views/marketing/MarketingMaterial.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:226 | 无（不在导航） |
| 功能 / 营销中心 | 优惠券管理 | /marketing/coupon | marketing-coupon | views/marketing/CouponManage.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:227 | admin-web/src/layouts/MainLayout.vue:256 |
| 功能 / 营销中心 | 秒杀活动 | /marketing/flash-sale | marketing-flash-sale | views/marketing/FlashSale.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:228 | admin-web/src/layouts/MainLayout.vue:258 |
| 功能 / 营销中心 | 满减满赠 | /marketing/full-reduction | marketing-full-reduction | views/marketing/FullReduction.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:229 | admin-web/src/layouts/MainLayout.vue:259 |
| 功能 / 营销中心 | 售后管理 | /aftersale | aftersale | views/marketing/AftersaleView.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:230 | admin-web/src/layouts/MainLayout.vue:260 |
| 非菜单路由 | 员工管理 | /employees | employees | views/system/EmployeesView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:232 | 无（不在导航） |
| 系统 / 系统设置 | 组织架构 | /organization | organization | views/system/OrganizationView.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:233 | admin-web/src/layouts/MainLayout.vue:290 |
| 非菜单路由 | 部门管理 | /department-manage | department-manage | views/system/DepartmentManage.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:234 | 无（不在导航） |
| 非菜单路由 | 岗位管理 | /position-manage | position-manage | views/system/PositionManage.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:235 | 无（不在导航） |
| 非菜单路由 | 门店管理 | /stores | stores | views/system/StoresView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:236 | 无（不在导航） |
| 非菜单路由 | 角色管理 | /system/roles | system-roles | views/system/SystemRoles.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:237 | 无（不在导航） |
| 非菜单路由 | 操作日志 | /audit-log | audit-log | views/system/AuditLogView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:238 | 无（不在导航） |
| 非菜单路由 | 错误日志 | /error-log | error-log | views/system/ErrorLogView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:239 | 无（不在导航） |
| 非菜单路由 | 系统设置 | /system | system | views/system/System.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:240 | 无（不在导航） |
| 系统 / 系统设置 | 系统配置 | /system/config | system-config | views/system/SystemConfigView.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:241 | admin-web/src/layouts/MainLayout.vue:291 |
| 系统 / 系统设置 | 打印模板 | /system/print | system-print | modules/print/PrintTemplatesView.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:242 | admin-web/src/layouts/MainLayout.vue:292 |
| 非菜单路由 | 模板设计 | /system/print/designer/:id? | system-print-designer | modules/print/PrintTemplateDesigner.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:243 | 无（不在导航） |
| 非菜单路由 | 审批规则 | /system/approval/rules | approval-rules | views/system/ApprovalRules.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:244 | 无（不在导航） |
| 系统 / 系统设置 | 审批管理 | /system/approval/manage | approval-manage | views/system/ApprovalManage.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:245 | admin-web/src/layouts/MainLayout.vue:293 |
| 系统 / 系统设置 | 报表权限 | /report-permissions | report-permissions | views/system/ReportPermission.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:246 | admin-web/src/layouts/MainLayout.vue:294 |
| 非菜单路由 | 审批详情 | /system/approval/detail/:id | approval-detail | views/system/ApprovalDetail.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:247 | 无（不在导航） |
| 非菜单路由 | 我的审批 | /system/approval/my | my-approvals | views/system/MyApprovals.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:248 | 无（不在导航） |
| 系统 / 系统设置 | 支付配置 | /system/payment | payment-config | views/system/PaymentConfigView.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:249 | admin-web/src/layouts/MainLayout.vue:295 |
| 系统 / 系统设置 | 小程序配置 | /system/miniapp | miniapp-config | views/system/MiniappConfigView.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:250 | admin-web/src/layouts/MainLayout.vue:296 |
| 非菜单路由 | 系统监控 | /monitor | monitor | views/system/MonitorView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:251 | 无（不在导航） |
| 系统 / 系统设置 | 日志与反馈 | /monitor-manage | monitor-manage | views/system/SystemMonitorManage.vue | 存在 | 否 | SUPER_ADMIN | admin-web/src/router/index.ts:252 | admin-web/src/layouts/MainLayout.vue:297 |
| 非菜单路由 | 反馈管理 | /system/feedback | feedback | views/system/FeedbackView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:253 | 无（不在导航） |
| 非菜单路由 | 收货地址 | /consumer-addresses | consumer-addresses | views/system/ConsumerAddress.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN | admin-web/src/router/index.ts:254 | 无（不在导航） |
| 非菜单路由 | 在线收款分析 | /reports/online-payment | online-payment-analysis | views/report/OnlinePaymentAnalysis.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER | admin-web/src/router/index.ts:256 | 无（不在导航） |
| 非菜单路由 | 门店工作台 | /pos/dashboard | pos-dashboard | views/pos/StoreDashboardView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:258 | 无（不在导航） |
| 收银台（cashierNavItems） | 快速收银 | /pos/cashier | pos-cashier | views/pos/CashierView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:259 | admin-web/src/layouts/MainLayout.vue:377 |
| 收银台（cashierNavItems） | 销售单据 | /pos/sale-bills | pos-sale-bills | views/pos/SaleBillsView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:260 | admin-web/src/layouts/MainLayout.vue:378 |
| 非菜单路由 | 销售单详情 | /pos/sale-bills/:billNo | pos-sale-bill-detail | views/pos/SaleBillDetail.vue | 存在 | meta.hidden | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:261 | 无（不在导航） |
| 非菜单路由 | 接单履约 | /pos/order-fulfill | pos-order-fulfill | views/pos/OrderFulfillView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:262 | 无（不在导航） |
| 收银台（cashierNavItems） | 分享收款 | /pos/collection | pos-collection | views/pos/CollectionView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:263 | admin-web/src/layouts/MainLayout.vue:383 |
| 收银台（cashierNavItems） | 销售退货 | /pos/sale-return | pos-sale-return | views/pos/SaleReturnView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:264 | admin-web/src/layouts/MainLayout.vue:381 |
| 收银台（cashierNavItems） | 挂单管理 | /pos/hold-order | pos-hold-order | views/pos/HoldOrderView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:265 | admin-web/src/layouts/MainLayout.vue:379 |
| 收银台（cashierNavItems） | 会员识别 | /pos/member | pos-member | views/pos/MemberView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:266 | admin-web/src/layouts/MainLayout.vue:382 |
| 非菜单路由 | 优惠券核销 | /pos/coupon-verify | pos-coupon-verify | views/pos/CouponVerifyView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:267 | 无（不在导航） |
| 收银台（cashierNavItems） | 交接班 | /pos/shift | pos-shift | views/pos/ShiftView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:268 | admin-web/src/layouts/MainLayout.vue:380 |
| 非菜单路由 | 交接班详情 | /pos/shift/:id | pos-shift-detail | views/pos/ShiftDetailView.vue | 存在 | meta.hidden | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:269 | 无（不在导航） |
| 收银台（cashierNavItems） | 日结管理 | /pos/daily-settle | pos-daily-settle | views/pos/DailySettleView.vue | 存在 | 否 | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:270 | admin-web/src/layouts/MainLayout.vue:384 |
| 非菜单路由 | 门店管控 | /pos/store-control | pos-store-control | views/pos/StoreControlView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:271 | 无（不在导航） |
| 非菜单路由 | 操作记录 | /pos/operation-log | pos-operation-log | views/pos/OperationLogView.vue | 存在 | 是（非侧栏菜单） | SUPER_ADMIN\|STORE_MANAGER\|STORE_OPERATOR | admin-web/src/router/index.ts:272 | 无（不在导航） |
| 非菜单路由 | 页面不存在 | /:pathMatch(.*)* | not-found | views/NotFound.vue | 存在 | 是（非侧栏菜单） | 无 | admin-web/src/router/index.ts:275 | 无（不在导航） |

## 4. 表B · 双向差集

### 4-1 原型有 · admin-web 无页面（24 页 = 全部 24 个 fuse 页）

这 24 页由 `原型 html:3774` 起的 `(function(){ G('report').lv2.push(...) })()` 运行时注入 SECTORS；声明的组件文件（如 `views/dashboard/StoreRank.vue`）在 `admin-web/src` 下不存在（复算 `PROTO_MISSING_WITH_COMP_FILE=0`），属"原型已画、生产线无路由无组件"的净缺口。

| 原型版块 | 页 key | 页说明 | t | 原型组件 | 原型 ref | 原型组件文件是否存在 | 对齐 path | 对齐 routeName | 对齐方式 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| report/数据报表 | dash-store-rank | 门店排行 | fuse | views/dashboard/StoreRank.vue | 原型 html:3779 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| report/数据报表 | dash-trend | 趋势分析 | fuse | views/dashboard/TrendAnalysis.vue | 原型 html:3783 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| system/系统管理 | org-stores | 门店档案 | fuse | views/system/StoresArchive.vue | 原型 html:3788 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| system/系统管理 | org-inspection | 巡店记录 | fuse | views/system/StoreInspection.vue | 原型 html:3792 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| system/系统管理 | org-qualification | 门店资质 | fuse | views/system/StoreLicenses.vue | 原型 html:3796 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| product/商品中心 | product-schedule | 定时上下架 | fuse | views/product/ProductSchedule.vue | 原型 html:3802 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| product/商品中心 | tier-prices | 阶梯价设置 | fuse | views/product/TierPrices.vue | 原型 html:3806 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| product/商品中心 | min-order | 起订量配置 | fuse | views/product/MinOrderConfig.vue | 原型 html:3809 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| customer/客户管理 | ws-customers | 批发客户 | fuse | views/customer/WholesaleCustomers.vue | 原型 html:3816 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| customer/客户管理 | credit-quota | 授信额度 | fuse | views/customer/CreditQuota.vue | 原型 html:3819 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| order/订单管理 | ws-confirm | 批发订单确认 | fuse | views/order/WholesaleConfirm.vue | 原型 html:3826 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| finance/财务管理 | fin-receivable | 应收账款 | fuse | views/finance/Receivables.vue | 原型 html:3834 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| finance/财务管理 | fin-split | 分账与结算 | fuse | views/finance/SettlementView.vue | 原型 html:3838 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| marketing/营销推广 | mk-groupbuy | 拼团活动 | fuse | views/marketing/GroupBuying.vue | 原型 html:3845 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| marketing/营销推广 | mk-templates | 活动模板库 | fuse | views/marketing/ActivityTemplates.vue | 原型 html:3849 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| marketing/营销推广 | mk-budget | 预算管控 | fuse | views/marketing/BudgetControl.vue | 原型 html:3852 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| marketing/营销推广 | mk-roi | ROI 分析 | fuse | views/marketing/RoiAnalysis.vue | 原型 html:3856 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| purchase/采购管理 | purchase-replenish | 补货建议 | fuse | views/purchase/ReplenishSuggest.vue | 原型 html:3862 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| inventory/库存管理 | trace-config | 追溯配置 | fuse | views/inventory/TraceConfig.vue | 原型 html:3869 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| inventory/库存管理 | trace-query | 追溯查询 | fuse | views/inventory/TraceQuery.vue | 原型 html:3873 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| inventory/库存管理 | trace-expiry | 效期预警 | fuse | views/inventory/ExpiryAlerts.vue | 原型 html:3877 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| inventory/库存管理 | trace-recall | 召回管理 | fuse | views/inventory/RecallManage.vue | 原型 html:3881 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| system/系统管理 | sys-perm-matrix | 权限矩阵 | fuse | views/system/PermissionMatrix.vue | 原型 html:3887 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |
| system/系统管理 | sys-openapi | 开放 API | fuse | views/system/OpenApiKeys.vue | 原型 html:3892 | 不存在 | UNKNOWN | UNKNOWN | 无 | 原型有·admin-web 无页面 |

另：原型 103 个基础二级页全部能在 admin-web 命中（routeName 精确 49 条 / 组件文件命中 54 条，`PROTO_PAGE_MISSING_IN_ADMIN` 不含它们）。逐页明细不在本表展开，可由脚本 `--out` 的 `table-b1-proto-only.csv`（127 行全量）复算。

### 4-2 admin-web 有 · 原型 SECTORS 未列（61 条）

| path | routeName | 组件文件 | meta.title | ref | 结论 |
| --- | --- | --- | --- | --- | --- |
| /login | login | views/LoginView.vue | 登录 | admin-web/src/router/index.ts:82 | admin-web 有·原型 SECTORS 未列 |
| /register | register | views/RegisterView.vue | 注册 | admin-web/src/router/index.ts:88 | admin-web 有·原型 SECTORS 未列 |
| / | UNKNOWN | layouts/MainLayout.vue | UNKNOWN | admin-web/src/router/index.ts:94 | admin-web 有·原型 SECTORS 未列 |
| /sale-bills/:billNo | sale-bill-detail | views/pos/SaleBillDetail.vue | 销售单详情 | admin-web/src/router/index.ts:107 | admin-web 有·原型 SECTORS 未列 |
| /sales/commission/records | commission-records | views/sale/CommissionRecords.vue | 提成记录 | admin-web/src/router/index.ts:113 | admin-web 有·原型 SECTORS 未列 |
| /order-routing | order-routing | views/order/OrderRoutingView.vue | 订单路由 | admin-web/src/router/index.ts:120 | admin-web 有·原型 SECTORS 未列 |
| /order-sync | order-sync | views/order/OrderSyncView.vue | 订单同步 | admin-web/src/router/index.ts:121 | admin-web 有·原型 SECTORS 未列 |
| /order-exception | order-exception | views/order/OrderExceptionView.vue | 订单异常 | admin-web/src/router/index.ts:122 | admin-web 有·原型 SECTORS 未列 |
| /order-product-map | order-product-map | views/order/OrderProductMapView.vue | 订单商品映射 | admin-web/src/router/index.ts:123 | admin-web 有·原型 SECTORS 未列 |
| /order-aftersale | order-aftersale | views/order/OrderAftersaleView.vue | 订单售后 | admin-web/src/router/index.ts:124 | admin-web 有·原型 SECTORS 未列 |
| /inventory-transfer/create | inventory-transfer-create | views/inventory/InventoryTransferCreate.vue | 新建调拨 | admin-web/src/router/index.ts:138 | admin-web 有·原型 SECTORS 未列 |
| /inventory-transfer/edit/:id | inventory-transfer-edit | views/inventory/InventoryTransferCreate.vue | 编辑调拨 | admin-web/src/router/index.ts:139 | admin-web 有·原型 SECTORS 未列 |
| /inventory-transfer/detail/:id | inventory-transfer-detail | views/inventory/InventoryTransferDetail.vue | 调拨详情 | admin-web/src/router/index.ts:140 | admin-web 有·原型 SECTORS 未列 |
| /inventory-alert-config | inventory-alert-config | views/inventory/InventoryAlertConfig.vue | 预警配置 | admin-web/src/router/index.ts:147 | admin-web 有·原型 SECTORS 未列 |
| /points-rules | points-rules | views/customer/PointsRules.vue | 积分规则 | admin-web/src/router/index.ts:149 | admin-web 有·原型 SECTORS 未列 |
| /level-config | level-config | views/customer/LevelConfig.vue | 等级配置 | admin-web/src/router/index.ts:150 | admin-web 有·原型 SECTORS 未列 |
| /store-value-cards | store-value-cards | views/customer/StoreValueCards.vue | 储值卡管理 | admin-web/src/router/index.ts:151 | admin-web 有·原型 SECTORS 未列 |
| /customer-tags | customer-tags | views/customer/CustomerTags.vue | 客户标签 | admin-web/src/router/index.ts:153 | admin-web 有·原型 SECTORS 未列 |
| /customer-profile | customer-profile | views/customer/CustomerProfile.vue | 客户画像 | admin-web/src/router/index.ts:154 | admin-web 有·原型 SECTORS 未列 |
| /customer-visits | customer-visits | views/customer/CustomerVisits.vue | 拜访记录 | admin-web/src/router/index.ts:156 | admin-web 有·原型 SECTORS 未列 |
| /customer-lifecycle | customer-lifecycle | views/customer/CustomerLifecycle.vue | 客户生命周期 | admin-web/src/router/index.ts:157 | admin-web 有·原型 SECTORS 未列 |
| /customer-segments | customer-segments | views/customer/CustomerSegments.vue | 客户分群 | admin-web/src/router/index.ts:158 | admin-web 有·原型 SECTORS 未列 |
| /customers/detail/:memberId | customer-detail | views/customer/CustomerDetail.vue | 客户详情 | admin-web/src/router/index.ts:161 | admin-web 有·原型 SECTORS 未列 |
| /products/import | product-import | views/product/ProductImport.vue | 商品导入 | admin-web/src/router/index.ts:169 | admin-web 有·原型 SECTORS 未列 |
| /products/tag-groups | tag-groups | views/product/TagGroups.vue | 标签分组 | admin-web/src/router/index.ts:171 | admin-web 有·原型 SECTORS 未列 |
| /products/tag-relation | product-tag-relation | views/product/ProductTagRelation.vue | 标签关联 | admin-web/src/router/index.ts:172 | admin-web 有·原型 SECTORS 未列 |
| /products/review-workflow | product-review-workflow | views/product/ProductReviewWorkflow.vue | 审核流程配置 | admin-web/src/router/index.ts:174 | admin-web 有·原型 SECTORS 未列 |
| /products/review-tasks | product-review-tasks | views/product/ProductReviewTasks.vue | 审核任务 | admin-web/src/router/index.ts:175 | admin-web 有·原型 SECTORS 未列 |
| /products/review-delegation | review-delegation | views/product/ReviewDelegation.vue | 审核委托 | admin-web/src/router/index.ts:176 | admin-web 有·原型 SECTORS 未列 |
| /instant-retail/pickup | instant-retail-pickup | views/instant-retail/InstantRetailPickup.vue | 接单工作台 | admin-web/src/router/index.ts:183 | admin-web 有·原型 SECTORS 未列 |
| /instant-retail/order-board | instant-retail-order-board | views/instant-retail/InstantRetailOrderBoard.vue | 订单看板 | admin-web/src/router/index.ts:188 | admin-web 有·原型 SECTORS 未列 |
| /finance/receipts | finance-receipts | views/finance/ReceiptsView.vue | 收款单 | admin-web/src/router/index.ts:197 | admin-web 有·原型 SECTORS 未列 |
| /finance/payments | finance-payments | views/finance/PaymentsNewView.vue | 付款单 | admin-web/src/router/index.ts:198 | admin-web 有·原型 SECTORS 未列 |
| /finance/receivables-payables | finance-receivables-payables | views/finance/ReceivablesPayables.vue | 应收应付 | admin-web/src/router/index.ts:199 | admin-web 有·原型 SECTORS 未列 |
| /reports/purchase | purchase-reports | views/report/PurchaseReports.vue | 采购报表 | admin-web/src/router/index.ts:209 | admin-web 有·原型 SECTORS 未列 |
| /reports/products | reports-products | views/report/ReportsProducts.vue | 商品报表 | admin-web/src/router/index.ts:210 | admin-web 有·原型 SECTORS 未列 |
| /reports/employees | reports-employees | views/report/ReportsEmployees.vue | 员工报表 | admin-web/src/router/index.ts:211 | admin-web 有·原型 SECTORS 未列 |
| /reports/stores | reports-stores | views/report/ReportsStores.vue | 门店报表 | admin-web/src/router/index.ts:212 | admin-web 有·原型 SECTORS 未列 |
| /reports/transfer | transfer-reports | views/report/TransferReport.vue | 调拨统计 | admin-web/src/router/index.ts:217 | admin-web 有·原型 SECTORS 未列 |
| /reports/custom-report | custom-report | views/report/CustomReport.vue | 自定义报表 | admin-web/src/router/index.ts:218 | admin-web 有·原型 SECTORS 未列 |
| /marketing/flash-sale | marketing-flash-sale | views/marketing/FlashSale.vue | 秒杀活动 | admin-web/src/router/index.ts:228 | admin-web 有·原型 SECTORS 未列 |
| /marketing/full-reduction | marketing-full-reduction | views/marketing/FullReduction.vue | 满减满赠 | admin-web/src/router/index.ts:229 | admin-web 有·原型 SECTORS 未列 |
| /organization | organization | views/system/OrganizationView.vue | 组织架构 | admin-web/src/router/index.ts:233 | admin-web 有·原型 SECTORS 未列 |
| /department-manage | department-manage | views/system/DepartmentManage.vue | 部门管理 | admin-web/src/router/index.ts:234 | admin-web 有·原型 SECTORS 未列 |
| /position-manage | position-manage | views/system/PositionManage.vue | 岗位管理 | admin-web/src/router/index.ts:235 | admin-web 有·原型 SECTORS 未列 |
| /stores | stores | views/system/StoresView.vue | 门店管理 | admin-web/src/router/index.ts:236 | admin-web 有·原型 SECTORS 未列 |
| /error-log | error-log | views/system/ErrorLogView.vue | 错误日志 | admin-web/src/router/index.ts:239 | admin-web 有·原型 SECTORS 未列 |
| /system | system | views/system/System.vue | 系统设置 | admin-web/src/router/index.ts:240 | admin-web 有·原型 SECTORS 未列 |
| /system/print/designer/:id? | system-print-designer | modules/print/PrintTemplateDesigner.vue | 模板设计 | admin-web/src/router/index.ts:243 | admin-web 有·原型 SECTORS 未列 |
| /system/approval/rules | approval-rules | views/system/ApprovalRules.vue | 审批规则 | admin-web/src/router/index.ts:244 | admin-web 有·原型 SECTORS 未列 |
| /report-permissions | report-permissions | views/system/ReportPermission.vue | 报表权限 | admin-web/src/router/index.ts:246 | admin-web 有·原型 SECTORS 未列 |
| /system/approval/detail/:id | approval-detail | views/system/ApprovalDetail.vue | 审批详情 | admin-web/src/router/index.ts:247 | admin-web 有·原型 SECTORS 未列 |
| /system/approval/my | my-approvals | views/system/MyApprovals.vue | 我的审批 | admin-web/src/router/index.ts:248 | admin-web 有·原型 SECTORS 未列 |
| /system/payment | payment-config | views/system/PaymentConfigView.vue | 支付配置 | admin-web/src/router/index.ts:249 | admin-web 有·原型 SECTORS 未列 |
| /system/miniapp | miniapp-config | views/system/MiniappConfigView.vue | 小程序配置 | admin-web/src/router/index.ts:250 | admin-web 有·原型 SECTORS 未列 |
| /monitor-manage | monitor-manage | views/system/SystemMonitorManage.vue | 系统监控 | admin-web/src/router/index.ts:252 | admin-web 有·原型 SECTORS 未列 |
| /consumer-addresses | consumer-addresses | views/system/ConsumerAddress.vue | 收货地址 | admin-web/src/router/index.ts:254 | admin-web 有·原型 SECTORS 未列 |
| /pos/sale-bills/:billNo | pos-sale-bill-detail | views/pos/SaleBillDetail.vue | 销售单详情 | admin-web/src/router/index.ts:261 | admin-web 有·原型 SECTORS 未列 |
| /pos/shift/:id | pos-shift-detail | views/pos/ShiftDetailView.vue | 交接班详情 | admin-web/src/router/index.ts:269 | admin-web 有·原型 SECTORS 未列 |
| /pos/daily-settle | pos-daily-settle | views/pos/DailySettleView.vue | 日结管理 | admin-web/src/router/index.ts:270 | admin-web 有·原型 SECTORS 未列 |
| /:pathMatch(.*)* | not-found | views/NotFound.vue | 页面不存在 | admin-web/src/router/index.ts:275 | admin-web 有·原型 SECTORS 未列 |

其中 4 条为壳/认证页（`/login`、`/register`、`/`=MainLayout、`/:pathMatch(.*)*`），其余 57 条是详情/设计器/子流程页与原型未纳入的既有能力页（订单路由/同步/商品映射、审核任务/委托、库存预警配置、财务收付款单、组织架构/部门/岗位/门店、审批族、支付与小程序配置等）。

## 5. 表C · menuCode → routeName 映射现状

### 5-1 接口存在性：不是 UNKNOWN，接口存在但 PC 不消费

- 路由层：`backend/src/routes/menu-permission.routes.ts:11` `menuPermissionRouter.get("/user", ctrl.getUserMenus)`；`:14` `prefix: "/api/admin/menus"`；`:16` `auth: "requireAuthWithTenant"`；`:9` 另有 `GET /tree`。
- 控制器：`backend/src/controllers/admin/menu-permission.controller.ts:13-16` → `getUserMenus(req.user!.id, req.tenantId!)`，返回 `ok(tree)`。
- 服务：`backend/src/services/admin/menu-permission.service.ts:87`（取用户角色）→ `:105`（`roleCode === "SUPER_ADMIN"` 走全量 `:111-118`）/ `:122-131`（按 `t_sys_role_menu JOIN t_sys_menu` 过滤）→ `buildTree` `:42-72`（按 `parent_id` 组树，清空 children）。
- `menuCode` 字段形态：DTO `MenuItem.menuCode: string`（`menu-permission.service.ts:9`），SQL `menu_code AS menuCode`（`:31`、`:112`、`:123`）；列定义 `menu_code VARCHAR(64) COMMENT '菜单编码，如 sale:order:view'`（`docs/migrations/079_权限矩阵.sql:21`），唯一键 `uk_sys_menu_code_tenant (menu_code, tenant_id)`（`:34`）。库内取值三段：CATALOG = 裸域码（`goods`，`079_权限矩阵.sql:101-111`）、MENU = `域:叶`（`goods:list`，`:119-197`）、BUTTON = `域:叶:动作`（`goods:create`，`:201-221`；`203:1-7`、`204:19-32`、`207:5-42` 继续补 BUTTON）。
- 消费方只有移动端：`app-mobile/src/api/modules/menu.ts:4`、`:21`（`url: '/admin/menus/user'`）、`app-mobile/src/stores/menu.ts:21`、`app-mobile/src/config/function-menu.ts:178`/`:213`。admin-web 全量扫描 `menus/user|admin/menus` 命中 **0 次**、`menuCode|menu_code` **0 次** ⇒ PC 工作台侧栏是 `MainLayout.vue:92-300` 硬编码、权限是 `meta.roles` + `router/index.ts:310-325` 的 fail-closed 守卫，**与 t_sys_menu 零联动**。
- 结论：表C 不是整表 UNKNOWN，而是「码在库里有、PC 不读；库里 path 形态与 PC 路由不同构（库 `/goods/list` ↔ PC `/products`）」。命中的 10 条属"路径恰好同名"，不是设计对齐。

### 5-2 冲突与缺失（逐条带 ref）

冲突：
- C1 `dashboard`（CATALOG，path `/dashboard`，`079_权限矩阵.sql:101`）↔ admin-web `routeName=dashboard`（页面，`router/index.ts:100`）：**同 path 不同语义**（库是目录节点，PC 是叶子页）。PC 若直接吃接口会把目录当页面渲染。
- C2 `system`（CATALOG `/system`，`:111`）↔ `routeName=system`（`views/system/System.vue`，`router/index.ts:240`）：同上。
- C3 `marketing`（CATALOG `/marketing`，`:107`）↔ `routeName=marketing`（营销活动页，`router/index.ts:220`）：同上。
- C4 `system:print`（`app-mobile-menu-catalog.ts:92`，名「单据打印」）↔ admin-web `system-print`（`/system/print` = 打印模板列表，`router/index.ts:242`）：同 path 同码不同义（移动端打印页 vs PC 模板管理）。
- C5 `report` / `store` / `trace`（CATALOG，`:110`、`:108`、`:109`）在 PC 无同域 path（PC 用 `/reports*`、`/stores`、`/pos/*`；`trace` 域 PC **完全无页面**，对应原型 fuse 追溯 4 页同样缺失，见表B-1 `inventory/trace-*`）。
- C6 BUTTON 类码 74 个（`goods:create` 等）`path` 一律 NULL（`079:201-221`、`204:15-32`、`207:1-42`），无法映射到任何 routeName；它们与 PC 的 `meta.roles`（角色级）不同层级 ⇒ PC 侧「按钮/动作」既无码也不受该接口管控（动作矩阵属任务 30 范围）。

缺失：
- M1 PC 侧栏 71 个二级项 + 收银台 9 项**全部没有 menuCode**（`MainLayout.vue:95-297`/`:377-385` 只有 path 与中文标签），不存在可执行的 menuCode↔routeName 映射；能反查到路由的码只有 10/163。
- M2 库里码表覆盖不到 PC 的域：instant-retail（12 路由 `router/index.ts:180-191`）、product-review（4 条 `:173-176`）、inventory 细域、pos（15 条 `:258-272`）等——库里只有 `store` 域 4 个 MENU 码（`079:169-172`）与 PC `/pos/*` 不同构。
- M3 `t_sys_menu.component` 列存在（`079:25`）但种子全为 NULL，且 service 的 SELECT 未取该列（`menu-permission.service.ts:31-32`、`:112-113`、`:123-124`）⇒ 后端返回体没有组件路径，PC 无法做"后端驱动路由"，仍需前端硬映射。
- M4 `GET /menus/tree`（`menu-permission.routes.ts:9`）与 `GET /roles/:roleId/permissions`（controller `:19-23`）在 admin-web 同样 0 消费；PC 角色管理页 `/system/roles`（`router/index.ts:237`）走的是另一套权限码接口，本矩阵不展开（归矩阵 30）。
- M5 菜单接口返回 `status` / `sortNo` 但没有 `visible` 列（service SELECT 列表未取 `visible`，尽管表里有该列 `079:28`）⇒ 「隐藏菜单」在接口层不可表达，PC 的 `meta.hidden`（5 条）语义无法由后端提供。

### 5-3 menuCode → routeName 全量映射表（脚本原样，163 码）

状态列口径：`可对齐` = 库里 path 与 admin-web 路由 path 全等，或 `域:叶` 换 `-` 后等于 routeName；其余为「menuCode 有码·admin-web 无同名/同路径路由」。消费方列全表同值（admin-web 未调用），已如实逐行标出。

| menuCode | menu_name | menu_type | DB path | routeName | route path | 状态 | 消费方 | 来源 ref |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dashboard | 仪表盘 | CATALOG | /dashboard | dashboard | /dashboard | 可对齐 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:101 |
| goods | 商品管理 | CATALOG | /goods | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:102 |
| sale | 销售管理 | CATALOG | /sale | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:103 |
| purchase | 采购管理 | CATALOG | /purchase | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:104 |
| customer | 客户管理 | CATALOG | /customer | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:105 |
| finance | 财务管理 | CATALOG | /finance | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:106 |
| marketing | 营销管理 | CATALOG | /marketing | marketing | /marketing | 可对齐 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:107 |
| store | 门店管理 | CATALOG | /store | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:108 |
| trace | 追溯管理 | CATALOG | /trace | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:109 |
| report | 报表中心 | CATALOG | /report | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:110 |
| system | 系统管理 | CATALOG | /system | system | /system | 可对齐 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:111 |
| dashboard:workbench | 工作台 | MENU | /dashboard/workbench | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:115 |
| goods:list | 商品列表 | MENU | /goods/list | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:119 |
| goods:category | 商品分类 | MENU | /goods/category | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:120 |
| goods:price-level | 价格等级 | MENU | /goods/price-level | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:121 |
| goods:price | 阶梯价格 | MENU | /goods/price | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:122 |
| goods:inventory | 库存查询 | MENU | /goods/inventory | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:123 |
| goods:batch | 库存批次 | MENU | /goods/batch | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:124 |
| goods:ledger | 库存流水 | MENU | /goods/ledger | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:125 |
| sale:bill | 销售开单 | MENU | /sale/bill | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:129 |
| sale:record | 销售记录 | MENU | /sale/record | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:130 |
| sale:return | 销售退货 | MENU | /sale/return | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:131 |
| sale:miniapp | 小程序订单 | MENU | /sale/miniapp | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:132 |
| sale:cart | 购物车管理 | MENU | /sale/cart | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:133 |
| purchase:order | 采购订单 | MENU | /purchase/order | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:137 |
| purchase:inbound | 采购入库 | MENU | /purchase/inbound | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:138 |
| purchase:return | 采购退货 | MENU | /purchase/return | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:139 |
| purchase:payment | 采购付款 | MENU | /purchase/payment | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:140 |
| purchase:supplier | 供应商管理 | MENU | /purchase/supplier | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:141 |
| customer:list | 客户列表 | MENU | /customer/list | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:145 |
| customer:credit | 客户授信 | MENU | /customer/credit | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:146 |
| customer:statement | 客户对账 | MENU | /customer/statement | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:147 |
| customer:visit | 客户拜访 | MENU | /customer/visit | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:148 |
| customer:payment | 客户收款 | MENU | /customer/payment | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:149 |
| finance:receipt | 收款管理 | MENU | /finance/receipt | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:153 |
| finance:payment | 付款管理 | MENU | /finance/payment | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:154 |
| finance:statement | 对账管理 | MENU | /finance/statement | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:155 |
| finance:receivable | 应收账款 | MENU | /finance/receivable | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:156 |
| finance:report | 财务报表 | MENU | /finance/report | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:157 |
| marketing:coupon | 优惠券 | MENU | /marketing/coupon | marketing-coupon | /marketing/coupon | 可对齐 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:161 |
| marketing:full-reduction | 满减活动 | MENU | /marketing/full-reduction | marketing-full-reduction | /marketing/full-reduction | 可对齐 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:162 |
| marketing:flash-sale | 秒杀活动 | MENU | /marketing/flash-sale | marketing-flash-sale | /marketing/flash-sale | 可对齐 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:163 |
| marketing:group-buy | 拼团活动 | MENU | /marketing/group-buy | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:164 |
| marketing:points | 积分管理 | MENU | /marketing/points | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:165 |
| store:list | 门店列表 | MENU | /store/list | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:169 |
| store:control | 门店管控 | MENU | /store/control | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:170 |
| store:transfer | 调拨管理 | MENU | /store/transfer | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:171 |
| store:stock-check | 盘点管理 | MENU | /store/stock-check | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:172 |
| trace:config | 追溯配置 | MENU | /trace/config | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:176 |
| trace:code | 追溯码管理 | MENU | /trace/code | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:177 |
| trace:scan | 扫码记录 | MENU | /trace/scan | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:178 |
| trace:recall | 召回管理 | MENU | /trace/recall | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:179 |
| report:sales | 销售报表 | MENU | /report/sales | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:183 |
| report:product | 商品报表 | MENU | /report/product | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:184 |
| report:finance | 财务报表 | MENU | /report/finance | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:185 |
| report:customer | 客户报表 | MENU | /report/customer | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:186 |
| report:staff | 员工报表 | MENU | /report/staff | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:187 |
| system:user | 用户管理 | MENU | /system/user | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:191 |
| system:role | 角色管理 | MENU | /system/role | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:192 |
| system:tenant | 租户管理 | MENU | /system/tenant | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:193 |
| system:subscription | 订阅管理 | MENU | /system/subscription | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:194 |
| system:config | 系统配置 | MENU | /system/config | system-config | /system/config | 可对齐 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:195 |
| system:audit | 操作日志 | MENU | /system/audit | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:196 |
| system:approval | 审批管理 | MENU | /system/approval | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:197 |
| goods:create | 新增商品 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:201 |
| goods:edit | 编辑商品 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:202 |
| goods:delete | 删除商品 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:203 |
| goods:inventory:adjust | 库存调整 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:204 |
| sale:create | 开单 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:205 |
| sale:void | 作废 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:206 |
| sale:edit | 编辑 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:207 |
| purchase:create | 新建采购 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:208 |
| purchase:approve | 审核采购 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:209 |
| customer:create | 新增客户 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:210 |
| customer:edit | 编辑客户 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:211 |
| customer:credit:adjust | 额度调整 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:212 |
| finance:receipt:create | 新增收款 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:213 |
| finance:payment:create | 新增付款 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:214 |
| marketing:create | 创建活动 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:215 |
| store:create | 新增门店 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:216 |
| store:edit | 编辑门店 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:217 |
| system:user:create | 新增用户 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:218 |
| system:user:edit | 编辑用户 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:219 |
| system:role:create | 新增角色 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:220 |
| system:role:edit | 编辑角色 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/079_权限矩阵.sql:221 |
| sale:cancel | 取消销售单 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/203_销售单取消权限点.sql:2 |
| system:alert:handle | 处理预警 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:19 |
| system:alert:rule-edit | 维护预警规则 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:20 |
| system:alert:check | 手动预警检查 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:21 |
| system:archive:execute | 执行数据归档 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:22 |
| system:notification:read | 通知标记已读 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:23 |
| system:notification:read-all | 通知全部已读 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:24 |
| system:notification:send | 发送通知 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:25 |
| system:notification:delete | 删除通知 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:26 |
| system:notification:batch-delete | 批量删除通知 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:27 |
| system:push:test | 发送测试推送 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:28 |
| system:sms-template:create | 新增短信模板 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:29 |
| system:sms-template:edit | 编辑短信模板 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:30 |
| system:sms-template:delete | 删除短信模板 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:31 |
| system:migration:run | 执行数据库迁移 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/204_系统设置域权限点立码.sql:32 |
| report:custom:create | 新建自定义报表 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:5 |
| report:custom:edit | 编辑自定义报表 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:6 |
| report:custom:delete | 删除自定义报表 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:7 |
| report:custom:generate | 生成自定义报表 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:8 |
| report:schedule:create | 新建报表定时任务 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:9 |
| report:schedule:edit | 编辑报表定时任务 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:10 |
| report:schedule:delete | 删除报表定时任务 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:11 |
| report:schedule:toggle | 启停报表定时任务 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:12 |
| report:schedule:run | 手动执行报表定时任务 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:13 |
| report:permission:edit | 维护报表权限 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:14 |
| report:export | 导出报表 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:15 |
| system:print-record:create | 保存打印记录 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:16 |
| system:print-record:reprint | 重打小票 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:17 |
| system:print-template:create | 新建打印模板 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:18 |
| system:print-template:edit | 编辑打印模板 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:19 |
| system:print-template:delete | 删除打印模板 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:20 |
| system:print-template:reset | 重置打印模板 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:21 |
| system:print-template:set-default | 设为默认打印模板 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:22 |
| store:hardware:config-edit | 编辑硬件配置 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:23 |
| store:hardware:config-test | 测试硬件配置 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:24 |
| store:hardware:announce | 云喇叭播报 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:25 |
| store:hardware:box-pay | 收银盒支付 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:26 |
| store:hardware:box-config-edit | 编辑收银盒配置 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:27 |
| store:hardware:box-config-test | 测试收银盒配置 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:28 |
| store:hardware:unionpay-test | 测试云闪付 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:29 |
| miniapp:config:edit | 编辑小程序配置 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:30 |
| miniapp:package:upload-key | 上传小程序密钥 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:31 |
| miniapp:package:build | 构建小程序包 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:32 |
| miniapp:package:publish | 发布小程序 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:33 |
| miniapp:order-sync:retry | 小程序订单同步重试 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:34 |
| dashboard:todo:create | 新建待办 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:35 |
| dashboard:todo:complete | 完成待办 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:36 |
| dashboard:todo:dismiss | 忽略待办 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:37 |
| dashboard:todo:delete | 删除待办 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:38 |
| dashboard:quick-entry:create | 新建快捷入口 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:39 |
| dashboard:quick-entry:sort | 调整快捷入口排序 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:40 |
| dashboard:quick-entry:edit | 编辑快捷入口 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:41 |
| dashboard:quick-entry:delete | 删除快捷入口 | BUTTON | UNKNOWN | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | docs/migrations/207_四域权限点立码.sql:42 |
| customer:address | 收货地址 | MENU(app-mobile catalog) | /customer/address | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:68 |
| customer:level | 会员等级 | MENU(app-mobile catalog) | /customer/level | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:69 |
| customer:points | 积分管理 | MENU(app-mobile catalog) | /customer/points | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:70 |
| customer:stored-card | 储值卡 | MENU(app-mobile catalog) | /customer/stored-card | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:71 |
| finance:expenses | 费用支出 | MENU(app-mobile catalog) | /finance/expenses | finance-expenses | /finance/expenses | 可对齐 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:72 |
| finance:reconciliation | 收银对账 | MENU(app-mobile catalog) | /finance/reconciliation | finance-reconciliation | /finance/reconciliation | 可对齐 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:73 |
| finance:transfer | 门店调拨 | MENU(app-mobile catalog) | /finance/transfer | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:74 |
| goods:loss-gain | 报损报益 | MENU(app-mobile catalog) | /goods/loss-gain | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:75 |
| goods:stock-check | 盘点调拨 | MENU(app-mobile catalog) | /goods/stock-check | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:76 |
| goods:stock-warning | 库存预警 | MENU(app-mobile catalog) | /goods/stock-warning | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:77 |
| goods:trace | 溯源查询 | MENU(app-mobile catalog) | /goods/trace | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:78 |
| marketing:activities | 营销活动 | MENU(app-mobile catalog) | /marketing/activities | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:79 |
| marketing:bargain | 砍价活动 | MENU(app-mobile catalog) | /marketing/bargain | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:80 |
| marketing:community | 社区营销 | MENU(app-mobile catalog) | /marketing/community | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:81 |
| marketing:seckill | 秒杀活动 | MENU(app-mobile catalog) | /marketing/seckill | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:82 |
| report:dashboard | 经营报表 | MENU(app-mobile catalog) | /report/dashboard | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:83 |
| report:finance-report | 财务报表 | MENU(app-mobile catalog) | /report/finance-report | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:84 |
| report:inventory | 库存报表 | MENU(app-mobile catalog) | /report/inventory | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:85 |
| report:purchase | 采购报表 | MENU(app-mobile catalog) | /report/purchase | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:86 |
| store:employees | 员工管理 | MENU(app-mobile catalog) | /store/employees | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:87 |
| store:roles | 角色管理 | MENU(app-mobile catalog) | /store/roles | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:88 |
| system:more | 更多功能 | MENU(app-mobile catalog) | /system/more | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:89 |
| system:operation-log | 操作日志 | MENU(app-mobile catalog) | /system/operation-log | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:90 |
| system:permission | 报表权限 | MENU(app-mobile catalog) | /system/permission | UNKNOWN | UNKNOWN | menuCode 有码·admin-web 无同名/同路径路由 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:91 |
| system:print | 单据打印 | MENU(app-mobile catalog) | /system/print | system-print | /system/print | 可对齐 | admin-web 未调用 /api/admin/menus/user | backend/src/shared/app-mobile-menu-catalog.ts:92 |

## 6. 缺口清单

| 编号 | 缺口 | 证据 ref |
|---|---|---|
| G1 | 收银台导航项 `/pos/print-settings` 无路由声明（点击走本地弹窗，无法直达/刷新即丢），复算 `MENU_ORPHAN=/pos/print-settings` | `MainLayout.vue:385` vs `router/index.ts:258-272`（无该 path） |
| G2 | 原型 24 个 fuse 页在 admin-web 无路由且无组件文件 | 表B-1（逐行 ref）；`PROTO_PAGE_MISSING_IN_ADMIN=24`、`PROTO_MISSING_WITH_COMP_FILE=0` |
| G3 | PC 菜单/权限与后端 `t_sys_menu` 零联动（侧栏硬编码 + meta.roles 双轨），后端接口只服务移动端 | `MainLayout.vue:92-300`、`router/index.ts:310-325`、`ADMIN_WEB_CALLS_MENUS_USER=0`、`app-mobile/src/api/modules/menu.ts:21` |
| G4 | 库里 menuCode 的 path 形态与 PC 实际 path 不同构（`153` 码对不上），直接接入会让侧栏大面积 404 | 表C 逐条；`079_权限矩阵.sql:119-197` ↔ `router/index.ts:165-254` |
| G5 | 导航覆盖仅 79/164：80 条路由不在任何导航（含 5 条 meta.hidden） | 表A `hidden?` 列 |
| G6 | 6 条声明复用同名组件（pos 与销售域双挂 / 调拨新建编辑同组件 / 库存报表双挂），路由收敛必须一并处理 | §2 `DUP_COMPONENT` 6 行（`router/index.ts:106/260`、`:107/261`、`:108/264`、`:109/263`、`:138/139`、`:148/216`） |
| G7 | 4 条路由无 roles meta，访问控制落到 `requiresAuth !== false` 分支 | `admin-web/src/router/index.ts:82`、`admin-web/src/router/index.ts:88`、`admin-web/src/router/index.ts:94`、`admin-web/src/router/index.ts:275`、守卫 `router/index.ts:300-303` |
| G8 | `t_sys_menu.component` / `visible` 两列在建表语句存在但接口不返回，后端驱动 PC 路由缺必要字段 | `079:25`、`079:28`、`menu-permission.service.ts:31-32` |
| G9 | 工作台侧「13 版块」与 PC 侧栏「12 分组」不同构：原型 dash/sale/order/purchase/inventory/customer/product/retail/finance/report/marketing/system/pos 13 段，PC 侧栏 12 个 nav-group（无独立 pos 分组，pos 走收银台模式；无「工作台」外的 dash 分组） | `MainLayout.vue:94-299` vs `原型 html:3013` SECTORS（分版块计数 §2） |

## 7. UNKNOWN 登记（禁止留空/编造的执行说明）

- 本次**没有整表 UNKNOWN**：后端接口存在（`BACKEND_MENU_ENDPOINT=EXISTS`），表C 按「有码但不消费」逐条填。
- 表A `routeName=UNKNOWN` 共 1 条（`path: "/"` 父级壳，`router/index.ts:93-94`）；`二级菜单=UNKNOWN` 同这 1 条；组件文件列无 UNKNOWN（`ROUTE_COMPONENT_FILE_MISSING=0`，即所有路由声明的组件文件都存在）。
- `原型 html:3013` 的 fuse 页只核到「路由 + 组件文件」两层的存在性；其 `api` 声明（`a` 字段）是否已实现**不在本矩阵范围**，未核。
- 运行期读数（接口实际返回多少行、每租户 menuCode 行数）为 **UNKNOWN**：静态读码不连库，依 R8 不得用静态数冒充运行期数；`198_租户角色菜单补全.sql:11-29`、`197_演示租户隔离.sql:35-47` 的按租户克隆逻辑说明行数会随租户数放大，须运行期取样。
- saas-admin / miniapp / website 等其它前端的菜单不在本矩阵（任务卡只要求 admin-web）。

## 8. 复算与反测记录

- 复算：`node docs/evidence/WB-REFACTOR-P0/scripts/parse-routes.cjs`（§2 原样输出）。脚本只读、默认不写盘；可用 `--root` 指任意工作树副本、`--proto` 指原型文件、`--out <dir>` 落 4 张 CSV + 1 份 JSON。
- ref 逐条复核：独立校验脚本解析本文件的表A（`route ref` 164 条 + `菜单 ref` 79 条 navTo）、表B-1（`原型 ref` 24 条 html 行）、表B-2（`ref` 61 条 router 行）、表C（`来源 ref` 163 条 menuCode 声明行），共 **491 处 `文件:行号`**，逐条打开该文件、取该行号处的真实文本，断言其中确实包含本行声称的数据（表A 另断言 routeName 落在 ref ±3 行窗口内），结果 `REF_CHECKED=491 BAD=0`（校验器为一次性工具，不在交付物内；验收可用同样方法复验）。
- 反测（全部在 `C:\Users\XIONG\AppData\Local\Temp\wb10-sb` 沙箱副本上做，工作树零改动）：

| 反测 | 制造的失败 | 复算读数变化 | 结论 |
|---|---|---|---|
| 基线 | 无（沙箱副本原样） | `ROUTE_DECLARATIONS=164`、`UNIQUE_COMPONENT_FILES=158`、`MENU_PATH_UNMATCHED_ROUTE=1`、`ROUTE_VISIBLE_IN_MENU=79`、`PROTO_PAGE_MISSING_IN_ADMIN=24` | 与工作树读数逐项相同 ⇒ 沙箱等价 |
| T1 | 删沙箱 `router/index.ts:100`（`/dashboard` 声明） | `ROUTE_DECLARATIONS 164→163`、`ROUTE_CHILDREN 160→159`、`UNIQUE_COMPONENT_FILES 158→157`、`MENU_PATH_UNMATCHED_ROUTE 1→2`、`ROUTE_VISIBLE_IN_MENU 79→78`，新出 `MENU_ORPHAN=/dashboard` | 计数随真实解析变红 |
| T2 | 沙箱 `MainLayout.vue` 把 `navTo('/orders')` 改成 `navTo('/orders-x')` | `MENU_PATH_UNMATCHED_ROUTE 2→3`、`ROUTE_VISIBLE_IN_MENU 78→77`，新出 `MENU_ORPHAN=/orders-x` | 菜单孤儿检确有检出能力 |
| T3 | `--proto D:/nope.html`（原型不可读） | `PROTO_SECTOR_COUNT=UNKNOWN`、`PROTO_LV2_BASE=UNKNOWN`、`SECTOR_LV2_SUM=UNKNOWN（原型文件不存在…）` | 无静默兜底：读不到就写 UNKNOWN，不会编数 |
| T4（墨收口复跑 · 另一沙箱 `wbsbx`） | 删沙箱 `router/index.ts:102`（`quick-entry-config` 声明） | `ROUTE_DECLARATIONS 164→163`、`UNIQUE_COMPONENT_FILES_PAGE_ONLY 155→154`、`PROTO_PAGE_MATCHED 103→102`、`PROTO_PAGE_MISSING_IN_ADMIN 24→25`、**`PROTO_MISSING_WITH_COMP_FILE 0→1`** | 换一条路由造错可复现；且双向差集真实生效——被摘掉的路由立刻让原型侧多出一页「原型有现网无」+ 一个孤儿组件文件 |
| T5（墨收口 · 新增 `--strict`） | 同上（沙箱仍处造错态时跑 `--strict`） | `STRICT_FAILED=2` + 两行 `DRIFT …`，**EXIT=1**；复原后 `STRICT_PASS` **EXIT=0**，输出与基线逐字节一致 | 本脚本由「只打印」升级为「可挂门禁」：差异非 0 直接红 |

- 红线遵守：除本文件与 `scripts/parse-routes.cjs` 外未创建/修改工作树内任何文件；未执行 `git add/commit/push`；未改业务代码（反测沙箱在工作树外，生成器/校验器也在工作树外）。
  **口径更新（墨 · 收口）**：末句「未执行 git add/commit/push」记录的是**生成时点**状态；收口已按派工卡 §四 逐文件 `git add` 提交至 `docs/wb-refactor-p0-inventory`，**仍未 push、仍未开 PR**。
  合计↔明细守恒与四表列对齐由 `scripts/verify-inventory.cjs --strict` 机读核对（42 项全绿）；T4/T5 原始输出见同目录 `50-reverse-test-log.md` §二。

---
工作台执行子代理（Qoder 通道）· 2026-10-22 · 基线 `7dda80b8` · 全部数字来自 parse-routes.cjs 静态解析，逐条 ref 见各表最后一列。
