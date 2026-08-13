import { createRouter, createWebHistory } from "vue-router";
import { ElMessage } from "element-plus";
import { createWebHashHistory } from "vue-router";
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
  Printer,
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
      { path: "dashboard", name: "dashboard", component: () => import("../views/dashboard/Dashboard.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "工作台", icon: DataAnalysis } },
      { path: "todo-list", name: "todo-list", component: () => import("../views/dashboard/TodoList.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "待办事项", icon: List } },
      { path: "quick-entries", name: "quick-entry-config", component: () => import("../views/dashboard/QuickEntryConfig.vue"), meta: { roles: ["SUPER_ADMIN"], title: "快捷入口配置", icon: Grid } },
      { path: "messages", name: "message-center", component: () => import("../views/dashboard/MessageCenter.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "消息中心", icon: Bell } },
      // 2. 销售管理
      { path: "sales/create", name: "sales-order-create", component: () => import("../views/sale/SalesOrderCreate.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "销售开单", icon: Edit } },
      { path: "sale-bills", name: "sale-bills", component: () => import("../views/pos/SaleBillsView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "销售单据", icon: Document } },
      { path: "sale-bills/:billNo", name: "sale-bill-detail", component: () => import("../views/pos/SaleBillDetail.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "销售单详情", icon: Document } },
      { path: "sale-returns", name: "sale-returns", component: () => import("../views/pos/SaleReturnView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "销售退货", icon: RefreshRight } },
      { path: "collection", name: "collection", component: () => import("../views/pos/CollectionView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "收款管理", icon: Money } },
      { path: "sales/collection-links", name: "collection-links", component: () => import("../views/sale/CollectionLinks.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "收款关联", icon: Link } },
      { path: "sales/customer-prices", name: "customer-prices", component: () => import("../views/sale/CustomerPrices.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "客户价格", icon: PriceTag } },
      { path: "sales/commission/rules", name: "commission-rules", component: () => import("../views/sale/CommissionRules.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "提成规则", icon: Medal } },
      { path: "sales/commission/records", name: "commission-records", component: () => import("../views/sale/CommissionRecords.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "提成记录", icon: Medal } },
      { path: "sales/reports", name: "sales-reports", component: () => import("../views/sale/SalesReports.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "销售报表", icon: DataLine } },
      // 3. 订单管理
      { path: "orders", name: "orders", component: () => import("../views/order/Orders.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "订单列表", icon: Tickets } },
      { path: "order-board", name: "order-board", component: () => import("../views/order/OrderBoardView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "订单看板", icon: Histogram } },
      { path: "order-timeout", name: "order-timeout", component: () => import("../views/order/OrderTimeoutView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "订单超时", icon: Timer } },
      { path: "order-center", name: "order-center", component: () => import("../views/order/OrderCenterView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "订单中心", icon: OfficeBuilding } },
      { path: "order-routing", name: "order-routing", component: () => import("../views/order/OrderRoutingView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "订单路由", icon: Connection } },
      { path: "order-sync", name: "order-sync", component: () => import("../views/order/OrderSyncView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "订单同步", icon: Refresh } },
      { path: "order-exception", name: "order-exception", component: () => import("../views/order/OrderExceptionView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "订单异常", icon: WarningFilled } },
      { path: "order-product-map", name: "order-product-map", component: () => import("../views/order/OrderProductMapView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "订单商品映射", icon: MapLocation } },
      { path: "order-aftersale", name: "order-aftersale", component: () => import("../views/order/OrderAftersaleView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "订单售后", icon: Service } },
      // 4. 采购管理
      { path: "purchase-orders", name: "purchase-orders", component: () => import("../views/purchase/PurchaseOrders.vue"), meta: { roles: ["SUPER_ADMIN"], title: "采购订单", icon: ShoppingCart } },
      { path: "purchase-in-stocks", name: "purchase-in-stocks", component: () => import("../views/purchase/PurchaseInStocks.vue"), meta: { roles: ["SUPER_ADMIN"], title: "采购入库", icon: Box } },
      { path: "purchase-returns", name: "purchase-returns", component: () => import("../views/purchase/PurchaseReturnsView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "采购退货", icon: Delete } },
      { path: "purchase-contracts", name: "purchase-contracts", component: () => import("../views/purchase/PurchaseContracts.vue"), meta: { roles: ["SUPER_ADMIN"], title: "采购合同", icon: Document } },
      { path: "purchase/supplier-statements", name: "supplier-statements", component: () => import("../views/purchase/SupplierStatements.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "供应商对账", icon: Checked } },
      { path: "purchase/plans", name: "purchase-plans", component: () => import("../views/purchase/PurchasePlans.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "采购计划", icon: Calendar } },
      { path: "purchase-payments", name: "purchase-payments", component: () => import("../views/purchase/PurchasePayments.vue"), meta: { roles: ["SUPER_ADMIN"], title: "采购付款", icon: CreditCard } },
      { path: "suppliers", name: "suppliers", component: () => import("../views/purchase/Suppliers.vue"), meta: { roles: ["SUPER_ADMIN"], title: "供应商管理", icon: Van } },
      // 5. 库存管理
      { path: "inventory", name: "inventory", component: () => import("../views/inventory/Inventory.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "库存列表", icon: Goods } },
      { path: "inventory-check", name: "inventory-check", component: () => import("../views/inventory/InventoryCheck.vue"), meta: { roles: ["SUPER_ADMIN"], title: "库存盘点", icon: Check } },
      { path: "inventory-transfer", name: "inventory-transfer", component: () => import("../views/inventory/InventoryTransfer.vue"), meta: { roles: ["SUPER_ADMIN"], title: "库存调拨", icon: Switch } },
      { path: "inventory-transfer/create", name: "inventory-transfer-create", component: () => import("../views/inventory/InventoryTransferCreate.vue"), meta: { roles: ["SUPER_ADMIN"], title: "新建调拨", icon: Switch, hidden: true } },
      { path: "inventory-transfer/edit/:id", name: "inventory-transfer-edit", component: () => import("../views/inventory/InventoryTransferCreate.vue"), meta: { roles: ["SUPER_ADMIN"], title: "编辑调拨", icon: Switch, hidden: true } },
      { path: "inventory-transfer/detail/:id", name: "inventory-transfer-detail", component: () => import("../views/inventory/InventoryTransferDetail.vue"), meta: { roles: ["SUPER_ADMIN"], title: "调拨详情", icon: Switch, hidden: true } },
      { path: "inventory-share-config", name: "inventory-share-config", component: () => import("../views/inventory/InventoryShareConfig.vue"), meta: { roles: ["SUPER_ADMIN"], title: "库存共享设置", icon: Share } },
      { path: "inventory-batch", name: "inventory-batch", component: () => import("../views/inventory/InventoryBatch.vue"), meta: { roles: ["SUPER_ADMIN"], title: "库存批次", icon: CollectionTag } },
      { path: "inventory-batch-price", name: "inventory-batch-price", component: () => import("../views/inventory/InventoryBatchPrice.vue"), meta: { roles: ["SUPER_ADMIN"], title: "批量调价", icon: Coin } },
      { path: "inventory-price-quote", name: "inventory-price-quote", component: () => import("../views/inventory/InventoryPriceQuote.vue"), meta: { roles: ["SUPER_ADMIN"], title: "报价管理", icon: ChatDotSquare } },
      { path: "inventory-alerts", name: "inventory-alerts", component: () => import("../views/inventory/InventoryAlerts.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "库存预警", icon: Warning } },
      { path: "inventory-cost", name: "inventory-cost", component: () => import("../views/inventory/InventoryCost.vue"), meta: { roles: ["SUPER_ADMIN"], title: "库存成本", icon: TrendCharts } },
      { path: "inventory-alert-config", name: "inventory-alert-config", component: () => import("../views/inventory/InventoryAlertConfig.vue"), meta: { roles: ["SUPER_ADMIN"], title: "预警配置", icon: Setting } },
      { path: "inventory-reports", name: "inventory-reports", component: () => import("../views/inventory/InventoryReports.vue"), meta: { roles: ["SUPER_ADMIN"], title: "库存报表", icon: PieChart } },
      { path: "points-rules", name: "points-rules", component: () => import("../views/customer/PointsRules.vue"), meta: { roles: ["SUPER_ADMIN"], title: "积分规则", icon: Star } },
      { path: "level-config", name: "level-config", component: () => import("../views/customer/LevelConfig.vue"), meta: { roles: ["SUPER_ADMIN"], title: "等级配置", icon: Rank } },
      { path: "store-value-cards", name: "store-value-cards", component: () => import("../views/customer/StoreValueCards.vue"), meta: { roles: ["SUPER_ADMIN"], title: "储值卡管理", icon: CreditCard } },
      { path: "member-system", name: "member-system", component: () => import("../views/customer/MemberSystem.vue"), meta: { roles: ["SUPER_ADMIN"], title: "会员体系", icon: User } },
      { path: "customer-tags", name: "customer-tags", component: () => import("../views/customer/CustomerTags.vue"), meta: { roles: ["SUPER_ADMIN"], title: "客户标签", icon: Discount } },
      { path: "customer-profile", name: "customer-profile", component: () => import("../views/customer/CustomerProfile.vue"), meta: { roles: ["SUPER_ADMIN"], title: "客户画像", icon: Avatar } },
      { path: "customer-care", name: "customer-care-rules", component: () => import("../views/customer/CustomerCareRules.vue"), meta: { roles: ["SUPER_ADMIN"], title: "客户关怀", icon: Present } },
      { path: "customer-visits", name: "customer-visits", component: () => import("../views/customer/CustomerVisits.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "拜访记录", icon: ChatDotRound } },
      { path: "customer-lifecycle", name: "customer-lifecycle", component: () => import("../views/customer/CustomerLifecycle.vue"), meta: { roles: ["SUPER_ADMIN"], title: "客户生命周期", icon: DataLine } },
      { path: "customer-segments", name: "customer-segments", component: () => import("../views/customer/CustomerSegments.vue"), meta: { roles: ["SUPER_ADMIN"], title: "客户分群", icon: Share } },
      // 6. 客户管理
      { path: "customers", name: "customers", component: () => import("../views/customer/CustomersView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "客户管理", icon: UserFilled } },
      { path: "customers/detail/:memberId", name: "customer-detail", component: () => import("../views/customer/CustomerDetail.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "客户详情", icon: UserFilled } },
      { path: "customer-types", name: "customer-types", component: () => import("../views/customer/CustomerTypes.vue"), meta: { roles: ["SUPER_ADMIN"], title: "客户类型", icon: CollectionTag } },
      { path: "credit", name: "credit", component: () => import("../views/customer/CreditView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "信用管理", icon: Lock } },
      // 7. 商品中心
      { path: "products", name: "products", component: () => import("../views/product/Products.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "商品管理", icon: Goods } },
      { path: "products/categories", name: "product-categories", component: () => import("../views/product/ProductCategories.vue"), meta: { roles: ["SUPER_ADMIN"], title: "商品分类", icon: Menu } },
      { path: "products/brands", name: "brands", component: () => import("../views/product/Brands.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "品牌管理", icon: Flag } },
      { path: "products/units", name: "units", component: () => import("../views/product/Units.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "单位管理", icon: ScaleToOriginal } },
      { path: "products/import", name: "product-import", component: () => import("../views/product/ProductImport.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "商品导入", icon: Upload } },
      { path: "products/tags", name: "product-tags", component: () => import("../views/product/ProductTags.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "商品标签", icon: CollectionTag } },
      { path: "products/tag-groups", name: "tag-groups", component: () => import("../views/product/TagGroups.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "标签分组", icon: FolderOpened } },
      { path: "products/tag-relation", name: "product-tag-relation", component: () => import("../views/product/ProductTagRelation.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "标签关联", icon: Link } },
      { path: "products/reviews", name: "product-reviews", component: () => import("../views/product/ProductReview.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "商品审核", icon: CircleCheck } },
      { path: "products/review-workflow", name: "product-review-workflow", component: () => import("../views/product/ProductReviewWorkflow.vue"), meta: { roles: ["SUPER_ADMIN"], title: "审核流程配置", icon: Connection } },
      { path: "products/review-tasks", name: "product-review-tasks", component: () => import("../views/product/ProductReviewTasks.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "FINANCE_ADMIN", "WAREHOUSE_ADMIN"], title: "审核任务", icon: List } },
      { path: "products/review-delegation", name: "review-delegation", component: () => import("../views/product/ReviewDelegation.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "审核委托", icon: Share } },
      { path: "products/combo", name: "product-combo", component: () => import("../views/product/ProductCombo.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "套装与组合品", icon: Present } },
      { path: "prices", name: "prices", component: () => import("../views/product/PricesView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "价格管理", icon: PriceTag } },
      // 8. 即时零售
      { path: "instant-retail/config", name: "instant-retail-config", component: () => import("../views/instant-retail/InstantRetailConfig.vue"), meta: { roles: ["SUPER_ADMIN"], title: "平台配置", icon: Monitor } },
      { path: "instant-retail/shelf", name: "instant-retail-shelf", component: () => import("../views/instant-retail/InstantRetailShelf.vue"), meta: { roles: ["SUPER_ADMIN"], title: "商品上架", icon: Sell } },
      { path: "instant-retail/orders", name: "instant-retail-orders", component: () => import("../views/instant-retail/InstantRetailOrders.vue"), meta: { roles: ["SUPER_ADMIN"], title: "平台订单", icon: Tickets } },
      { path: "instant-retail/pickup", name: "instant-retail-pickup", component: () => import("../views/instant-retail/InstantRetailPickup.vue"), meta: { roles: ["SUPER_ADMIN"], title: "接单工作台", icon: Bell } },
      { path: "instant-retail/payment", name: "instant-retail-payment", component: () => import("../views/instant-retail/InstantRetailPayment.vue"), meta: { roles: ["SUPER_ADMIN"], title: "平台对账", icon: Finished } },
      { path: "instant-retail/delivery", name: "instant-retail-delivery", component: () => import("../views/instant-retail/InstantRetailDelivery.vue"), meta: { roles: ["SUPER_ADMIN"], title: "配送管理", icon: Van } },
      { path: "instant-retail/report", name: "instant-retail-report", component: () => import("../views/instant-retail/InstantRetailReport.vue"), meta: { roles: ["SUPER_ADMIN"], title: "平台报表", icon: TrendCharts } },
      { path: "instant-retail/platform", name: "instant-retail-platform", component: () => import("../views/instant-retail/InstantRetailPlatform.vue"), meta: { roles: ["SUPER_ADMIN"], title: "平台管理", icon: Monitor } },
      { path: "instant-retail/order-board", name: "instant-retail-order-board", component: () => import("../views/instant-retail/InstantRetailOrderBoard.vue"), meta: { roles: ["SUPER_ADMIN"], title: "订单看板", icon: Odometer } },
      { path: "instant-retail/announcements", name: "retail-announcements", component: () => import("../views/instant-retail/RetailAnnouncement.vue"), meta: { roles: ["SUPER_ADMIN"], title: "平台公告", icon: ChatLineSquare } },
      { path: "instant-retail/dashboard", name: "instant-retail-dashboard", component: () => import("../views/instant-retail/InstantRetailDashboard.vue"), meta: { roles: ["SUPER_ADMIN"], title: "零售看板", icon: DataAnalysis } },
      { path: "instant-retail/sync", name: "instant-retail-sync", component: () => import("../views/instant-retail/InstantRetailSync.vue"), meta: { roles: ["SUPER_ADMIN"], title: "库存同步", icon: Connection } },
      // 9. 财务管理
      { path: "payments", name: "payments", component: () => import("../views/finance/PaymentsView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "收付款管理", icon: Money } },
      { path: "finance/collection", name: "finance-collection", component: () => import("../views/finance/FinanceCollection.vue"), meta: { roles: ["SUPER_ADMIN"], title: "回款管理", icon: Coin } },
      { path: "customer-statements", name: "customer-statements", component: () => import("../views/finance/CustomerStatements.vue"), meta: { roles: ["SUPER_ADMIN"], title: "客户对账", icon: Document } },
      { path: "finance/profit", name: "finance-profit", component: () => import("../views/finance/FinanceProfit.vue"), meta: { roles: ["SUPER_ADMIN"], title: "利润核算", icon: TrendCharts } },
      { path: "finance/receipts", name: "finance-receipts", component: () => import("../views/finance/ReceiptsView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "收款单", icon: Sell } },
      { path: "finance/payments", name: "finance-payments", component: () => import("../views/finance/PaymentsNewView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "付款单", icon: ShoppingCart } },
      { path: "finance/receivables-payables", name: "finance-receivables-payables", component: () => import("../views/finance/ReceivablesPayables.vue"), meta: { roles: ["SUPER_ADMIN"], title: "应收应付", icon: Collection } },
      { path: "finance/expenses", name: "finance-expenses", component: () => import("../views/finance/ExpensesView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "费用管理", icon: Money } },
      { path: "finance/reconciliation", name: "finance-reconciliation", component: () => import("../views/finance/ReconciliationView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "财务对账", icon: Finished } },
      { path: "finance/dashboard", name: "finance-dashboard", component: () => import("../views/finance/FinanceDashboard.vue"), meta: { roles: ["SUPER_ADMIN"], title: "财务看板", icon: DataAnalysis } },
      { path: "bank-accounts", name: "bank-accounts", component: () => import("../views/finance/BankAccounts.vue"), meta: { roles: ["SUPER_ADMIN"], title: "银行账户", icon: CreditCard } },
      { path: "fund-report", name: "fund-report", component: () => import("../views/finance/FinanceReport.vue"), meta: { roles: ["SUPER_ADMIN"], title: "资金报表", icon: TrendCharts } },
      { path: "bill-management", name: "bill-management", component: () => import("../views/finance/BillManagement.vue"), meta: { roles: ["SUPER_ADMIN"], title: "票据管理", icon: Ticket } },
      // 10. 数据报表
      { path: "reports", name: "reports", component: () => import("../views/report/Reports.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "报表中心", icon: Files } },
      { path: "reports/purchase", name: "purchase-reports", component: () => import("../views/report/PurchaseReports.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "采购报表", icon: ShoppingCart } },
      { path: "reports/products", name: "reports-products", component: () => import("../views/report/ReportsProducts.vue"), meta: { roles: ["SUPER_ADMIN"], title: "商品报表", icon: Goods } },
      { path: "reports/employees", name: "reports-employees", component: () => import("../views/report/ReportsEmployees.vue"), meta: { roles: ["SUPER_ADMIN"], title: "员工报表", icon: User } },
      { path: "reports/stores", name: "reports-stores", component: () => import("../views/report/ReportsStores.vue"), meta: { roles: ["SUPER_ADMIN"], title: "门店报表", icon: Shop } },
      { path: "reports/sales-analysis", name: "sales-analysis", component: () => import("../views/report/SalesAnalysis.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "销售分析", icon: TrendCharts } },
      { path: "reports/collection-analysis", name: "collection-analysis", component: () => import("../views/report/CollectionAnalysis.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "回款分析", icon: DataLine } },
      { path: "reports/customers", name: "customer-analysis", component: () => import("../views/report/CustomerAnalysis.vue"), meta: { roles: ["SUPER_ADMIN"], title: "客户分析", icon: User } },
      { path: "reports/inventory", name: "reports-inventory", component: () => import("../views/inventory/InventoryReports.vue"), meta: { roles: ["SUPER_ADMIN"], title: "库存报表", icon: PieChart } },
      { path: "reports/transfer", name: "transfer-reports", component: () => import("../views/report/TransferReport.vue"), meta: { roles: ["SUPER_ADMIN"], title: "调拨统计", icon: TrendCharts } },
      { path: "reports/custom-report", name: "custom-report", component: () => import("../views/report/CustomReport.vue"), meta: { roles: ["SUPER_ADMIN"], title: "自定义报表", icon: Document } },
      // 11. 营销推广
      { path: "marketing", name: "marketing", component: () => import("../views/marketing/MarketingView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "营销活动", icon: Present } },
      { path: "marketing/tags", name: "marketing-tags", component: () => import("../views/marketing/MarketingTags.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "营销标签", icon: Discount } },
      { path: "marketing/limited-discount", name: "marketing-limited-discount", component: () => import("../views/marketing/MarketingLimitedDiscount.vue"), meta: { roles: ["SUPER_ADMIN"], title: "限时折扣", icon: Clock } },
      { path: "marketing/gift-rule", name: "marketing-gift-rule", component: () => import("../views/marketing/MarketingGiftRule.vue"), meta: { roles: ["SUPER_ADMIN"], title: "赠品规则", icon: Present } },
      { path: "marketing/points-mall", name: "marketing-points-mall", component: () => import("../views/marketing/MarketingPointsMall.vue"), meta: { roles: ["SUPER_ADMIN"], title: "积分商城", icon: Shop } },
      { path: "marketing/dashboard", name: "marketing-dashboard", component: () => import("../views/marketing/MarketingDashboard.vue"), meta: { roles: ["SUPER_ADMIN"], title: "营销看板", icon: DataAnalysis } },
      { path: "marketing/materials", name: "marketing-material", component: () => import("../views/marketing/MarketingMaterial.vue"), meta: { roles: ["SUPER_ADMIN"], title: "营销素材", icon: PictureFilled } },
      { path: "marketing/coupon", name: "marketing-coupon", component: () => import("../views/marketing/CouponManage.vue"), meta: { roles: ["SUPER_ADMIN"], title: "优惠券管理", icon: CreditCard } },
      { path: "marketing/flash-sale", name: "marketing-flash-sale", component: () => import("../views/marketing/FlashSale.vue"), meta: { roles: ["SUPER_ADMIN"], title: "秒杀活动", icon: Timer } },
      { path: "marketing/full-reduction", name: "marketing-full-reduction", component: () => import("../views/marketing/FullReduction.vue"), meta: { roles: ["SUPER_ADMIN"], title: "满减满赠", icon: Medal } },
      { path: "aftersale", name: "aftersale", component: () => import("../views/marketing/AftersaleView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "售后管理", icon: Service } },
      // 12. 系统管理
      { path: "employees", name: "employees", component: () => import("../views/system/EmployeesView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "员工管理", icon: User } },
      { path: "organization", name: "organization", component: () => import("../views/system/OrganizationView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "组织架构", icon: User } },
      { path: "department-manage", name: "department-manage", component: () => import("../views/system/DepartmentManage.vue"), meta: { roles: ["SUPER_ADMIN"], title: "部门管理", icon: OfficeBuilding } },
      { path: "position-manage", name: "position-manage", component: () => import("../views/system/PositionManage.vue"), meta: { roles: ["SUPER_ADMIN"], title: "岗位管理", icon: Medal } },
      { path: "stores", name: "stores", component: () => import("../views/system/StoresView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "门店管理", icon: Shop } },
      { path: "system/roles", name: "system-roles", component: () => import("../views/system/SystemRoles.vue"), meta: { roles: ["SUPER_ADMIN"], title: "角色管理", icon: Key } },
      { path: "audit-log", name: "audit-log", component: () => import("../views/system/AuditLogView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "操作日志", icon: Document } },
      { path: "error-log", name: "error-log", component: () => import("../views/system/ErrorLogView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "错误日志", icon: WarningFilled } },
      { path: "system", name: "system", component: () => import("../views/system/System.vue"), meta: { roles: ["SUPER_ADMIN"], title: "系统设置", icon: Setting } },
      { path: "system/config", name: "system-config", component: () => import("../views/system/SystemConfigView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "系统配置", icon: Setting } },
      { path: "system/print", name: "system-print", component: () => import("../modules/print/PrintTemplatesView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "打印模板", icon: Printer } },
      { path: "system/print/designer/:id?", name: "system-print-designer", component: () => import("../modules/print/PrintTemplateDesigner.vue"), meta: { roles: ["SUPER_ADMIN"], title: "模板设计", fullscreen: true } },
      { path: "system/approval/rules", name: "approval-rules", component: () => import("../views/system/ApprovalRules.vue"), meta: { roles: ["SUPER_ADMIN"], title: "审批规则", icon: Checked } },
      { path: "system/approval/manage", name: "approval-manage", component: () => import("../views/system/ApprovalManage.vue"), meta: { roles: ["SUPER_ADMIN"], title: "审批管理", icon: Checked } },
      { path: "report-permissions", name: "report-permissions", component: () => import("../views/system/ReportPermission.vue"), meta: { roles: ["SUPER_ADMIN"], title: "报表权限", icon: Lock } },
      { path: "system/approval/detail/:id", name: "approval-detail", component: () => import("../views/system/ApprovalDetail.vue"), meta: { roles: ["SUPER_ADMIN"], title: "审批详情", icon: Document } },
      { path: "system/approval/my", name: "my-approvals", component: () => import("../views/system/MyApprovals.vue"), meta: { roles: ["SUPER_ADMIN"], title: "我的审批", icon: List } },
      { path: "system/payment", name: "payment-config", component: () => import("../views/system/PaymentConfigView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "支付配置", icon: CreditCard } },
      { path: "system/miniapp", name: "miniapp-config", component: () => import("../views/system/MiniappConfigView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "小程序配置", icon: Connection } },
      { path: "monitor", name: "monitor", component: () => import("../views/system/MonitorView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "系统监控", icon: Monitor } },
      { path: "monitor-manage", name: "monitor-manage", component: () => import("../views/system/SystemMonitorManage.vue"), meta: { roles: ["SUPER_ADMIN"], title: "系统监控", icon: Monitor } },
      { path: "system/feedback", name: "feedback", component: () => import("../views/system/FeedbackView.vue"), meta: { roles: ["SUPER_ADMIN"], title: "反馈管理", icon: ChatDotRound } },
      { path: "consumer-addresses", name: "consumer-addresses", component: () => import("../views/system/ConsumerAddress.vue"), meta: { roles: ["SUPER_ADMIN"], title: "收货地址", icon: Location } },
      // 13. 在线收款分析
      { path: "reports/online-payment", name: "online-payment-analysis", component: () => import("../views/report/OnlinePaymentAnalysis.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER"], title: "在线收款分析", icon: Money } },
      // 14. 门店收银
      { path: "pos/dashboard", name: "pos-dashboard", component: () => import("../views/pos/StoreDashboardView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "门店工作台", icon: DataAnalysis } },
      { path: "pos/cashier", name: "pos-cashier", component: () => import("../views/pos/CashierView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "快速收银", icon: Edit } },
{ path: "pos/sale-bills", name: "pos-sale-bills", component: () => import("../views/pos/SaleBillsView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "销售单据", icon: Document } },
{ path: "pos/sale-bills/:billNo", name: "pos-sale-bill-detail", component: () => import("../views/pos/SaleBillDetail.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "销售单详情", icon: Document, hidden: true } },
      { path: "pos/order-fulfill", name: "pos-order-fulfill", component: () => import("../views/pos/OrderFulfillView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "接单履约", icon: Tickets } },
      { path: "pos/collection", name: "pos-collection", component: () => import("../views/pos/CollectionView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "分享收款", icon: Share } },
      { path: "pos/sale-return", name: "pos-sale-return", component: () => import("../views/pos/SaleReturnView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "销售退货", icon: RefreshRight } },
      { path: "pos/hold-order", name: "pos-hold-order", component: () => import("../views/pos/HoldOrderView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "挂单管理", icon: FolderOpened } },
      { path: "pos/member", name: "pos-member", component: () => import("../views/pos/MemberView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "会员识别", icon: User } },
      { path: "pos/coupon-verify", name: "pos-coupon-verify", component: () => import("../views/pos/CouponVerifyView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "优惠券核销", icon: Ticket } },
      { path: "pos/shift", name: "pos-shift", component: () => import("../views/pos/ShiftView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "交接班", icon: Clock } },
      { path: "pos/shift/:id", name: "pos-shift-detail", component: () => import("../views/pos/ShiftDetailView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "交接班详情", icon: Clock, hidden: true } },
      { path: "pos/daily-settle", name: "pos-daily-settle", component: () => import("../views/pos/DailySettleView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "CASHIER", "STORE_OPERATOR"], title: "日结管理", icon: Checked } },
      { path: "pos/store-control", name: "pos-store-control", component: () => import("../views/pos/StoreControlView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], title: "门店管控", icon: Switch } },
      { path: "pos/operation-log", name: "pos-operation-log", component: () => import("../views/pos/OperationLogView.vue"), meta: { roles: ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OPERATOR"], title: "操作记录", icon: Document } }
    ]
  },
  { path: "/:pathMatch(.*)*", name: "not-found", component: NotFound, meta: { requiresAuth: false, title: "页面不存在", icon: WarningFilled } }
];

const router = createRouter({
  // Electron 桌面版（file://）必须用 hash 路由；Web 部署保持 history 路由
  history:
    typeof window !== "undefined" && (window as any).electronAPI
      ? createWebHashHistory()
      : createWebHistory(),
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

  // 角色权限检查：用户角色数组与路由允许角色数组任一命中即可（与后端 roles: string[] 对齐）
  const userRoles = auth.userRoles;
  const allowedRoles = (to.meta.roles as string[] | undefined) || [];
  if (allowedRoles.length > 0 && userRoles.length > 0 && !userRoles.some(r => allowedRoles.includes(r))) {
    ElMessage.warning("您没有权限访问该页面");
    next("/dashboard");
    return;
  }

  next();
});

export default router;
