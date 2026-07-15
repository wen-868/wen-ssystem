import { createRouter, createWebHistory } from "vue-router";
import { ElMessage } from "element-plus";
import {
  Avatar,
  Bell,
  Box,
  Calendar,
  ChatDotRound,
  ChatDotSquare,
  ChatLineSquare,
  Check,
  Checked,
  CircleCheck,
  Clock,
  Coin,
  Collection,
  CollectionTag,
  Connection,
  CreditCard,
  DataAnalysis,
  DataLine,
  Delete,
  Discount,
  Document,
  Edit,
  Files,
  Finished,
  Flag,
  FolderOpened,
  Goods,
  Grid,
  Histogram,
  Key,
  Link,
  List,
  Location,
  Lock,
  MapLocation,
  Medal,
  Menu,
  Money,
  Monitor,
  Odometer,
  OfficeBuilding,
  PictureFilled,
  PieChart,
  Present,
  PriceTag,
  Rank,
  Refresh,
  RefreshRight,
  ScaleToOriginal,
  Sell,
  Service,
  Setting,
  Share,
  Shop,
  ShoppingCart,
  Star,
  Switch,
  Ticket,
  Tickets,
  Timer,
  TrendCharts,
  Upload,
  User,
  UserFilled,
  Van,
  Warning,
  WarningFilled
} from "@element-plus/icons-vue";
import MainLayout from "../layouts/MainLayout.vue";
import LoginView from "../views/LoginView.vue";
import NotFound from "../views/NotFound.vue";
import { useAuthStore } from "../stores/auth";

const routes = [
  {
    path: "/login",
    name: "login",
    component: LoginView,
    meta: { requiresAuth: false, title: "登录", icon: UserFilled }
  },
  {
    path: "/register",
    name: "register",
    component: () => import("../views/RegisterView.vue"),
    meta: { requiresAuth: false, title: "注册", icon: UserFilled }
  },
  {
    path: "/",
    component: MainLayout,
    redirect: "/dashboard",
    meta: { requiresAuth: true },
    children: [
      // 1. 工作台
      { path: "dashboard", name: "dashboard", component: () => import("../views/Dashboard.vue"), meta: { roles: ["BOSS", "MGR"], title: "工作台", icon: DataAnalysis } },
      { path: "todo-list", name: "todo-list", component: () => import("../views/TodoList.vue"), meta: { roles: ["BOSS", "MGR"], title: "待办事项", icon: List } },
      { path: "quick-entries", name: "quick-entry-config", component: () => import("../views/QuickEntryConfig.vue"), meta: { roles: ["BOSS"], title: "快捷入口配置", icon: Grid } },
      { path: "messages", name: "message-center", component: () => import("../views/MessageCenter.vue"), meta: { roles: ["BOSS", "MGR"], title: "消息中心", icon: Bell } },
      // 2. 销售管理
      { path: "sales/create", name: "sales-order-create", component: () => import("../views/SalesOrderCreate.vue"), meta: { roles: ["BOSS", "MGR"], title: "销售开单", icon: Edit } },
      { path: "sale-bills", name: "sale-bills", component: () => import("../views/SaleBills.vue"), meta: { roles: ["BOSS", "MGR"], title: "销售单据", icon: Document } },
      { path: "sale-returns", name: "sale-returns", component: () => import("../views/SaleReturnsView.vue"), meta: { roles: ["BOSS", "MGR"], title: "销售退货", icon: RefreshRight } },
      { path: "collection", name: "collection", component: () => import("../views/Collection.vue"), meta: { roles: ["BOSS", "MGR"], title: "收款管理", icon: Money } },
      { path: "sales/collection-links", name: "collection-links", component: () => import("../views/CollectionLinks.vue"), meta: { roles: ["BOSS", "MGR"], title: "收款关联", icon: Link } },
      { path: "sales/customer-prices", name: "customer-prices", component: () => import("../views/CustomerPrices.vue"), meta: { roles: ["BOSS", "MGR"], title: "客户价格", icon: PriceTag } },
      { path: "sales/commission/rules", name: "commission-rules", component: () => import("../views/CommissionRules.vue"), meta: { roles: ["BOSS", "MGR"], title: "提成规则", icon: Medal } },
      { path: "sales/commission/records", name: "commission-records", component: () => import("../views/CommissionRecords.vue"), meta: { roles: ["BOSS", "MGR"], title: "提成记录", icon: Medal } },
      { path: "sales/reports", name: "sales-reports", component: () => import("../views/SalesReports.vue"), meta: { roles: ["BOSS", "MGR"], title: "销售报表", icon: DataLine } },
      // 3. 订单管理
      { path: "orders", name: "orders", component: () => import("../views/Orders.vue"), meta: { roles: ["BOSS", "MGR"], title: "订单列表", icon: Tickets } },
      { path: "order-board", name: "order-board", component: () => import("../views/OrderBoardView.vue"), meta: { roles: ["BOSS", "MGR"], title: "订单看板", icon: Histogram } },
      { path: "order-timeout", name: "order-timeout", component: () => import("../views/OrderTimeoutView.vue"), meta: { roles: ["BOSS", "MGR"], title: "订单超时", icon: Timer } },
      { path: "order-center", name: "order-center", component: () => import("../views/OrderCenterView.vue"), meta: { roles: ["BOSS"], title: "订单中心", icon: OfficeBuilding } },
      { path: "order-routing", name: "order-routing", component: () => import("../views/OrderRoutingView.vue"), meta: { roles: ["BOSS"], title: "订单路由", icon: Connection } },
      { path: "order-sync", name: "order-sync", component: () => import("../views/OrderSyncView.vue"), meta: { roles: ["BOSS"], title: "订单同步", icon: Refresh } },
      { path: "order-exception", name: "order-exception", component: () => import("../views/OrderExceptionView.vue"), meta: { roles: ["BOSS"], title: "订单异常", icon: WarningFilled } },
      { path: "order-product-map", name: "order-product-map", component: () => import("../views/OrderProductMapView.vue"), meta: { roles: ["BOSS"], title: "订单商品映射", icon: MapLocation } },
      { path: "order-aftersale", name: "order-aftersale", component: () => import("../views/OrderAftersaleView.vue"), meta: { roles: ["BOSS"], title: "订单售后", icon: Service } },
      // 4. 采购管理
      { path: "purchase-orders", name: "purchase-orders", component: () => import("../views/PurchaseOrders.vue"), meta: { roles: ["BOSS"], title: "采购订单", icon: ShoppingCart } },
      { path: "purchase-in-stocks", name: "purchase-in-stocks", component: () => import("../views/PurchaseInStocks.vue"), meta: { roles: ["BOSS"], title: "采购入库", icon: Box } },
      { path: "purchase-returns", name: "purchase-returns", component: () => import("../views/PurchaseReturnsView.vue"), meta: { roles: ["BOSS", "MGR"], title: "采购退货", icon: Delete } },
      { path: "purchase-contracts", name: "purchase-contracts", component: () => import("../views/PurchaseContracts.vue"), meta: { roles: ["BOSS"], title: "采购合同", icon: Document } },
      { path: "purchase/supplier-statements", name: "supplier-statements", component: () => import("../views/SupplierStatements.vue"), meta: { roles: ["BOSS", "MGR"], title: "供应商对账", icon: Checked } },
      { path: "purchase/plans", name: "purchase-plans", component: () => import("../views/PurchasePlans.vue"), meta: { roles: ["BOSS", "MGR"], title: "采购计划", icon: Calendar } },
      { path: "purchase-payments", name: "purchase-payments", component: () => import("../views/PurchasePayments.vue"), meta: { roles: ["BOSS"], title: "采购付款", icon: CreditCard } },
      { path: "suppliers", name: "suppliers", component: () => import("../views/Suppliers.vue"), meta: { roles: ["BOSS"], title: "供应商管理", icon: Van } },
      // 5. 库存管理
      { path: "inventory", name: "inventory", component: () => import("../views/Inventory.vue"), meta: { roles: ["BOSS", "MGR"], title: "库存列表", icon: Goods } },
      { path: "inventory-check", name: "inventory-check", component: () => import("../views/InventoryCheck.vue"), meta: { roles: ["BOSS"], title: "库存盘点", icon: Check } },
      { path: "inventory-transfer", name: "inventory-transfer", component: () => import("../views/InventoryTransfer.vue"), meta: { roles: ["BOSS"], title: "库存调拨", icon: Switch } },
      { path: "inventory-transfer/create", name: "inventory-transfer-create", component: () => import("../views/InventoryTransferCreate.vue"), meta: { roles: ["BOSS"], title: "新建调拨", icon: Switch, hidden: true } },
      { path: "inventory-transfer/edit/:id", name: "inventory-transfer-edit", component: () => import("../views/InventoryTransferCreate.vue"), meta: { roles: ["BOSS"], title: "编辑调拨", icon: Switch, hidden: true } },
      { path: "inventory-transfer/detail/:id", name: "inventory-transfer-detail", component: () => import("../views/InventoryTransferDetail.vue"), meta: { roles: ["BOSS"], title: "调拨详情", icon: Switch, hidden: true } },
      { path: "inventory-share-config", name: "inventory-share-config", component: () => import("../views/InventoryShareConfig.vue"), meta: { roles: ["BOSS"], title: "库存共享设置", icon: Share } },
      { path: "inventory-batch", name: "inventory-batch", component: () => import("../views/InventoryBatch.vue"), meta: { roles: ["BOSS"], title: "库存批次", icon: CollectionTag } },
      { path: "inventory-batch-price", name: "inventory-batch-price", component: () => import("../views/InventoryBatchPrice.vue"), meta: { roles: ["BOSS"], title: "批量调价", icon: Coin } },
      { path: "inventory-price-quote", name: "inventory-price-quote", component: () => import("../views/InventoryPriceQuote.vue"), meta: { roles: ["BOSS"], title: "报价管理", icon: ChatDotSquare } },
      { path: "inventory-alerts", name: "inventory-alerts", component: () => import("../views/InventoryAlerts.vue"), meta: { roles: ["BOSS", "MGR"], title: "库存预警", icon: Warning } },
      { path: "inventory-cost", name: "inventory-cost", component: () => import("../views/InventoryCost.vue"), meta: { roles: ["BOSS"], title: "库存成本", icon: TrendCharts } },
      { path: "inventory-alert-config", name: "inventory-alert-config", component: () => import("../views/InventoryAlertConfig.vue"), meta: { roles: ["BOSS"], title: "预警配置", icon: Setting } },
      { path: "inventory-reports", name: "inventory-reports", component: () => import("../views/InventoryReports.vue"), meta: { roles: ["BOSS"], title: "库存报表", icon: PieChart } },
      { path: "points-rules", name: "points-rules", component: () => import("../views/PointsRules.vue"), meta: { roles: ["BOSS"], title: "积分规则", icon: Star } },
      { path: "level-config", name: "level-config", component: () => import("../views/LevelConfig.vue"), meta: { roles: ["BOSS"], title: "等级配置", icon: Rank } },
      { path: "store-value-cards", name: "store-value-cards", component: () => import("../views/StoreValueCards.vue"), meta: { roles: ["BOSS"], title: "储值卡管理", icon: CreditCard } },
      { path: "member-system", name: "member-system", component: () => import("../views/MemberSystem.vue"), meta: { roles: ["BOSS"], title: "会员体系", icon: User } },
      { path: "customer-tags", name: "customer-tags", component: () => import("../views/CustomerTags.vue"), meta: { roles: ["BOSS"], title: "客户标签", icon: Discount } },
      { path: "customer-profile", name: "customer-profile", component: () => import("../views/CustomerProfile.vue"), meta: { roles: ["BOSS"], title: "客户画像", icon: Avatar } },
      { path: "customer-care", name: "customer-care-rules", component: () => import("../views/CustomerCareRules.vue"), meta: { roles: ["BOSS"], title: "客户关怀", icon: Present } },
      { path: "customer-visits", name: "customer-visits", component: () => import("../views/CustomerVisits.vue"), meta: { roles: ["BOSS", "MGR"], title: "拜访记录", icon: ChatDotRound } },
      { path: "customer-lifecycle", name: "customer-lifecycle", component: () => import("../views/CustomerLifecycle.vue"), meta: { roles: ["BOSS"], title: "客户生命周期", icon: DataLine } },
      { path: "customer-segments", name: "customer-segments", component: () => import("../views/CustomerSegments.vue"), meta: { roles: ["BOSS"], title: "客户分群", icon: Share } },
      // 6. 客户管理
      { path: "customers", name: "customers", component: () => import("../views/CustomersView.vue"), meta: { roles: ["BOSS", "MGR"], title: "客户管理", icon: UserFilled } },
      { path: "customers/detail/:memberId", name: "customer-detail", component: () => import("../views/CustomerDetail.vue"), meta: { roles: ["BOSS", "MGR"], title: "客户详情", icon: UserFilled } },
      { path: "credit", name: "credit", component: () => import("../views/CreditView.vue"), meta: { roles: ["BOSS", "MGR"], title: "信用管理", icon: Lock } },
      // 7. 商品中心
      { path: "products", name: "products", component: () => import("../views/Products.vue"), meta: { roles: ["BOSS", "MGR"], title: "商品管理", icon: Goods } },
      { path: "products/categories", name: "product-categories", component: () => import("../views/ProductCategories.vue"), meta: { roles: ["BOSS"], title: "商品分类", icon: Menu } },
      { path: "products/brands", name: "brands", component: () => import("../views/Brands.vue"), meta: { roles: ["BOSS", "MGR"], title: "品牌管理", icon: Flag } },
      { path: "products/units", name: "units", component: () => import("../views/Units.vue"), meta: { roles: ["BOSS", "MGR"], title: "单位管理", icon: ScaleToOriginal } },
      { path: "products/import", name: "product-import", component: () => import("../views/ProductImport.vue"), meta: { roles: ["BOSS", "MGR"], title: "商品导入", icon: Upload } },
      { path: "products/tags", name: "product-tags", component: () => import("../views/ProductTags.vue"), meta: { roles: ["BOSS", "MGR"], title: "商品标签", icon: CollectionTag } },
      { path: "products/tag-groups", name: "tag-groups", component: () => import("../views/TagGroups.vue"), meta: { roles: ["BOSS", "MGR"], title: "标签分组", icon: FolderOpened } },
      { path: "products/tag-relation", name: "product-tag-relation", component: () => import("../views/ProductTagRelation.vue"), meta: { roles: ["BOSS", "MGR"], title: "标签关联", icon: Link } },
      { path: "products/reviews", name: "product-reviews", component: () => import("../views/ProductReview.vue"), meta: { roles: ["BOSS", "MGR"], title: "商品审核", icon: CircleCheck } },
      { path: "products/review-workflow", name: "product-review-workflow", component: () => import("../views/ProductReviewWorkflow.vue"), meta: { roles: ["BOSS"], title: "审核流程配置", icon: Connection } },
      { path: "products/review-tasks", name: "product-review-tasks", component: () => import("../views/ProductReviewTasks.vue"), meta: { roles: ["BOSS", "MGR", "FIN", "STOCK"], title: "审核任务", icon: List } },
      { path: "products/review-delegation", name: "review-delegation", component: () => import("../views/ReviewDelegation.vue"), meta: { roles: ["BOSS", "MGR"], title: "审核委托", icon: Share } },
      { path: "products/combo", name: "product-combo", component: () => import("../views/ProductCombo.vue"), meta: { roles: ["BOSS", "MGR"], title: "套装与组合品", icon: Present } },
      { path: "prices", name: "prices", component: () => import("../views/PricesView.vue"), meta: { roles: ["BOSS", "MGR"], title: "价格管理", icon: PriceTag } },
      // 8. 即时零售
      { path: "instant-retail/config", name: "instant-retail-config", component: () => import("../views/InstantRetailConfig.vue"), meta: { roles: ["BOSS"], title: "平台配置", icon: Monitor } },
      { path: "instant-retail/shelf", name: "instant-retail-shelf", component: () => import("../views/InstantRetailShelf.vue"), meta: { roles: ["BOSS"], title: "商品上架", icon: Sell } },
      { path: "instant-retail/orders", name: "instant-retail-orders", component: () => import("../views/InstantRetailOrders.vue"), meta: { roles: ["BOSS"], title: "平台订单", icon: Tickets } },
      { path: "instant-retail/pickup", name: "instant-retail-pickup", component: () => import("../views/InstantRetailPickup.vue"), meta: { roles: ["BOSS"], title: "接单工作台", icon: Bell } },
      { path: "instant-retail/payment", name: "instant-retail-payment", component: () => import("../views/InstantRetailPayment.vue"), meta: { roles: ["BOSS"], title: "平台对账", icon: Finished } },
      { path: "instant-retail/delivery", name: "instant-retail-delivery", component: () => import("../views/InstantRetailDelivery.vue"), meta: { roles: ["BOSS"], title: "配送管理", icon: Van } },
      { path: "instant-retail/report", name: "instant-retail-report", component: () => import("../views/InstantRetailReport.vue"), meta: { roles: ["BOSS"], title: "平台报表", icon: TrendCharts } },
      { path: "instant-retail/platform", name: "instant-retail-platform", component: () => import("../views/InstantRetailPlatform.vue"), meta: { roles: ["BOSS"], title: "平台管理", icon: Monitor } },
      { path: "instant-retail/order-board", name: "instant-retail-order-board", component: () => import("../views/InstantRetailOrderBoard.vue"), meta: { roles: ["BOSS"], title: "订单看板", icon: Odometer } },
      { path: "instant-retail/announcements", name: "retail-announcements", component: () => import("../views/RetailAnnouncement.vue"), meta: { roles: ["BOSS"], title: "平台公告", icon: ChatLineSquare } },
      { path: "instant-retail/dashboard", name: "instant-retail-dashboard", component: () => import("../views/InstantRetailDashboard.vue"), meta: { roles: ["BOSS"], title: "零售看板", icon: DataAnalysis } },
      { path: "instant-retail/sync", name: "instant-retail-sync", component: () => import("../views/InstantRetailSync.vue"), meta: { roles: ["BOSS"], title: "库存同步", icon: Connection } },
      // 9. 财务管理
      { path: "payments", name: "payments", component: () => import("../views/PaymentsView.vue"), meta: { roles: ["BOSS"], title: "收付款管理", icon: Money } },
      { path: "finance/collection", name: "finance-collection", component: () => import("../views/FinanceCollection.vue"), meta: { roles: ["BOSS"], title: "回款管理", icon: Coin } },
      { path: "customer-statements", name: "customer-statements", component: () => import("../views/CustomerStatements.vue"), meta: { roles: ["BOSS"], title: "客户对账", icon: Document } },
      { path: "finance/profit", name: "finance-profit", component: () => import("../views/FinanceProfit.vue"), meta: { roles: ["BOSS"], title: "利润核算", icon: TrendCharts } },
      { path: "finance/receipts", name: "finance-receipts", component: () => import("../views/ReceiptsView.vue"), meta: { roles: ["BOSS"], title: "收款单", icon: Sell } },
      { path: "finance/payments", name: "finance-payments", component: () => import("../views/PaymentsNewView.vue"), meta: { roles: ["BOSS"], title: "付款单", icon: ShoppingCart } },
      { path: "finance/receivables-payables", name: "finance-receivables-payables", component: () => import("../views/ReceivablesPayables.vue"), meta: { roles: ["BOSS"], title: "应收应付", icon: Collection } },
      { path: "finance/expenses", name: "finance-expenses", component: () => import("../views/ExpensesView.vue"), meta: { roles: ["BOSS"], title: "费用管理", icon: Money } },
      { path: "finance/reconciliation", name: "finance-reconciliation", component: () => import("../views/ReconciliationView.vue"), meta: { roles: ["BOSS"], title: "财务对账", icon: Finished } },
      { path: "finance/dashboard", name: "finance-dashboard", component: () => import("../views/FinanceDashboard.vue"), meta: { roles: ["BOSS"], title: "财务看板", icon: DataAnalysis } },
      { path: "bank-accounts", name: "bank-accounts", component: () => import("../views/BankAccounts.vue"), meta: { roles: ["BOSS"], title: "银行账户", icon: CreditCard } },
      { path: "fund-report", name: "fund-report", component: () => import("../views/FinanceReport.vue"), meta: { roles: ["BOSS"], title: "资金报表", icon: TrendCharts } },
      { path: "bill-management", name: "bill-management", component: () => import("../views/BillManagement.vue"), meta: { roles: ["BOSS"], title: "票据管理", icon: Ticket } },
      // 10. 数据报表
      { path: "reports", name: "reports", component: () => import("../views/Reports.vue"), meta: { roles: ["BOSS", "MGR"], title: "报表中心", icon: Files } },
      { path: "reports/purchase", name: "purchase-reports", component: () => import("../views/PurchaseReports.vue"), meta: { roles: ["BOSS", "MGR"], title: "采购报表", icon: ShoppingCart } },
      { path: "reports/products", name: "reports-products", component: () => import("../views/ReportsProducts.vue"), meta: { roles: ["BOSS"], title: "商品报表", icon: Goods } },
      { path: "reports/employees", name: "reports-employees", component: () => import("../views/ReportsEmployees.vue"), meta: { roles: ["BOSS"], title: "员工报表", icon: User } },
      { path: "reports/stores", name: "reports-stores", component: () => import("../views/ReportsStores.vue"), meta: { roles: ["BOSS"], title: "门店报表", icon: Shop } },
      { path: "reports/sales-analysis", name: "sales-analysis", component: () => import("../views/SalesAnalysis.vue"), meta: { roles: ["BOSS", "MGR"], title: "销售分析", icon: TrendCharts } },
      { path: "reports/collection-analysis", name: "collection-analysis", component: () => import("../views/CollectionAnalysis.vue"), meta: { roles: ["BOSS", "MGR"], title: "回款分析", icon: DataLine } },
      { path: "reports/customers", name: "customer-analysis", component: () => import("../views/CustomerAnalysis.vue"), meta: { roles: ["BOSS"], title: "客户分析", icon: User } },
      { path: "reports/inventory", name: "inventory-reports", component: () => import("../views/InventoryReports.vue"), meta: { roles: ["BOSS"], title: "库存报表", icon: PieChart } },
      { path: "reports/transfer", name: "transfer-reports", component: () => import("../views/TransferReport.vue"), meta: { roles: ["BOSS"], title: "调拨统计", icon: TrendCharts } },
      { path: "reports/custom-report", name: "custom-report", component: () => import("../views/CustomReport.vue"), meta: { roles: ["BOSS"], title: "自定义报表", icon: Document } },
      // 11. 营销推广
      { path: "marketing", name: "marketing", component: () => import("../views/MarketingView.vue"), meta: { roles: ["BOSS"], title: "营销活动", icon: Present } },
      { path: "marketing/tags", name: "marketing-tags", component: () => import("../views/MarketingTags.vue"), meta: { roles: ["BOSS", "MGR"], title: "营销标签", icon: Discount } },
      { path: "marketing/limited-discount", name: "marketing-limited-discount", component: () => import("../views/MarketingLimitedDiscount.vue"), meta: { roles: ["BOSS"], title: "限时折扣", icon: Clock } },
      { path: "marketing/gift-rule", name: "marketing-gift-rule", component: () => import("../views/MarketingGiftRule.vue"), meta: { roles: ["BOSS"], title: "赠品规则", icon: Present } },
      { path: "marketing/points-mall", name: "marketing-points-mall", component: () => import("../views/MarketingPointsMall.vue"), meta: { roles: ["BOSS"], title: "积分商城", icon: Shop } },
      { path: "marketing/dashboard", name: "marketing-dashboard", component: () => import("../views/MarketingDashboard.vue"), meta: { roles: ["BOSS"], title: "营销看板", icon: DataAnalysis } },
      { path: "marketing/materials", name: "marketing-material", component: () => import("../views/MarketingMaterial.vue"), meta: { roles: ["BOSS"], title: "营销素材", icon: PictureFilled } },
      { path: "marketing/coupon", name: "marketing-coupon", component: () => import("../views/CouponManage.vue"), meta: { roles: ["BOSS"], title: "优惠券管理", icon: CreditCard } },
      { path: "marketing/flash-sale", name: "marketing-flash-sale", component: () => import("../views/FlashSale.vue"), meta: { roles: ["BOSS"], title: "秒杀活动", icon: Timer } },
      { path: "marketing/full-reduction", name: "marketing-full-reduction", component: () => import("../views/FullReduction.vue"), meta: { roles: ["BOSS"], title: "满减满赠", icon: Medal } },
      { path: "aftersale", name: "aftersale", component: () => import("../views/AftersaleView.vue"), meta: { roles: ["BOSS"], title: "售后管理", icon: Service } },
      // 12. 系统管理
      { path: "employees", name: "employees", component: () => import("../views/EmployeesView.vue"), meta: { roles: ["BOSS"], title: "员工管理", icon: User } },
      { path: "department-manage", name: "department-manage", component: () => import("../views/DepartmentManage.vue"), meta: { roles: ["BOSS"], title: "部门管理", icon: OfficeBuilding } },
      { path: "position-manage", name: "position-manage", component: () => import("../views/PositionManage.vue"), meta: { roles: ["BOSS"], title: "岗位管理", icon: Medal } },
      { path: "stores", name: "stores", component: () => import("../views/StoresView.vue"), meta: { roles: ["BOSS"], title: "门店管理", icon: Shop } },
      { path: "system/roles", name: "system-roles", component: () => import("../views/SystemRoles.vue"), meta: { roles: ["BOSS"], title: "角色管理", icon: Key } },
      { path: "audit-log", name: "audit-log", component: () => import("../views/AuditLogView.vue"), meta: { roles: ["BOSS"], title: "操作日志", icon: Document } },
      { path: "error-log", name: "error-log", component: () => import("../views/ErrorLogView.vue"), meta: { roles: ["BOSS"], title: "错误日志", icon: WarningFilled } },
      { path: "system", name: "system", component: () => import("../views/System.vue"), meta: { roles: ["BOSS"], title: "系统设置", icon: Setting } },
      { path: "system/config", name: "system-config", component: () => import("../views/SystemConfigView.vue"), meta: { roles: ["BOSS"], title: "系统配置", icon: Setting } },
      { path: "system/approval/rules", name: "approval-rules", component: () => import("../views/ApprovalRules.vue"), meta: { roles: ["BOSS"], title: "审批规则", icon: Checked } },
      { path: "report-permissions", name: "report-permissions", component: () => import("../views/ReportPermission.vue"), meta: { roles: ["BOSS"], title: "报表权限", icon: Lock } },
      { path: "system/approval/detail/:id", name: "approval-detail", component: () => import("../views/ApprovalDetail.vue"), meta: { roles: ["BOSS"], title: "审批详情", icon: Document } },
      { path: "system/approval/my", name: "my-approvals", component: () => import("../views/MyApprovals.vue"), meta: { roles: ["BOSS"], title: "我的审批", icon: List } },
      { path: "system/payment", name: "payment-config", component: () => import("../views/PaymentConfigView.vue"), meta: { roles: ["BOSS"], title: "支付配置", icon: CreditCard } },
      { path: "system/miniapp", name: "miniapp-config", component: () => import("../views/MiniappConfigView.vue"), meta: { roles: ["BOSS"], title: "小程序配置", icon: Connection } },
      { path: "monitor", name: "monitor", component: () => import("../views/MonitorView.vue"), meta: { roles: ["BOSS"], title: "系统监控", icon: Monitor } },
      { path: "system/feedback", name: "feedback", component: () => import("../views/FeedbackView.vue"), meta: { roles: ["BOSS"], title: "反馈管理", icon: ChatDotRound } },
      { path: "consumer-addresses", name: "consumer-addresses", component: () => import("../views/ConsumerAddress.vue"), meta: { roles: ["BOSS"], title: "收货地址", icon: Location } },
      // 13. SaaS 平台后台
      { path: "saas/dashboard", name: "saas-dashboard", component: () => import("../views/PlatformDashboard.vue"), meta: { roles: ["BOSS"], title: "平台看板", icon: DataAnalysis } },
      { path: "saas/plans", name: "saas-plan-manage", component: () => import("../views/SaasPlanManage.vue"), meta: { roles: ["BOSS"], title: "套餐管理", icon: Tickets } },
      { path: "saas/tenants", name: "saas-tenants", component: () => import("../views/Tenants.vue"), meta: { roles: ["BOSS"], title: "租户管理", icon: OfficeBuilding } },
      { path: "saas/subscriptions", name: "saas-subscriptions", component: () => import("../views/Subscriptions.vue"), meta: { roles: ["BOSS"], title: "订阅管理", icon: Coin } },
      { path: "saas/tenant-review", name: "saas-tenant-review", component: () => import("../views/TenantReview.vue"), meta: { roles: ["BOSS"], title: "入驻审核", icon: Document } },
      { path: "saas/reviews", name: "platform-reviews", component: () => import("../views/PlatformReview.vue"), meta: { roles: ["BOSS"], title: "平台评价", icon: Star } },
      { path: "saas/tenant-usage", name: "saas-tenant-usage", component: () => import("../views/TenantUsage.vue"), meta: { roles: ["BOSS"], title: "租户统计", icon: DataAnalysis } },
      { path: "saas/announcements", name: "saas-announcements", component: () => import("../views/PlatformAnnouncements.vue"), meta: { roles: ["BOSS"], title: "公告管理", icon: ChatDotSquare } },
      { path: "saas/audit-logs", name: "saas-audit-logs", component: () => import("../views/PlatformAuditLogs.vue"), meta: { roles: ["BOSS"], title: "审计日志", icon: Document } },
      { path: "saas/config", name: "saas-config", component: () => import("../views/PlatformConfig.vue"), meta: { roles: ["BOSS"], title: "平台配置", icon: Setting } },
      // 14. 在线收款分析
      { path: "reports/online-payment", name: "online-payment-analysis", component: () => import("../views/OnlinePaymentAnalysis.vue"), meta: { roles: ["BOSS", "MGR"], title: "在线收款分析", icon: Money } }
    ]
  },
  { path: "/:pathMatch(.*)*", name: "not-found", component: NotFound, meta: { requiresAuth: false, title: "页面不存在", icon: WarningFilled } }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore();
  const token = auth.token;
  const expired = auth.isTokenExpired();

  if (expired) {
    auth.clearAuth();
    if (to.path !== "/login") {
      next("/login");
      return;
    }
  }

  if (to.meta.requiresAuth !== false && !token) {
    next("/login");
    return;
  }

  if (to.path === "/login" && token) {
    next("/dashboard");
    return;
  }

  // 角色权限检查
  const userRole = auth.userRole;
  const allowedRoles = (to.meta.roles as string[] | undefined) || [];
  if (allowedRoles.length > 0 && userRole && !allowedRoles.includes(userRole)) {
    ElMessage.warning("您没有权限访问该页面");
    next("/dashboard");
    return;
  }

  next();
});

export default router;