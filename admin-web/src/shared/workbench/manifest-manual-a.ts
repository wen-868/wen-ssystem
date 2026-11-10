import { item, type ManifestGroup } from "./types";

/** 人工操作台第 1~6 组（37 项） */
export const MANUAL_GROUPS_A: ManifestGroup[] = [
  {
    groupCode: "wb.dashboard",
    title: "工作台",
    items: [
      item("web.dashboard", "dashboard", "/dashboard", "工作台", () => import("../../views/dashboard/Dashboard.vue")),
    ],
  },
  {
    groupCode: "wb.order",
    title: "订单管理",
    items: [
      item("web.order.list", "orders", "/orders", "订单列表", () => import("../../views/order/Orders.vue")),
      item("web.order.board", "order-board", "/order-board", "订单看板", () => import("../../views/order/OrderBoardView.vue")),
      item("web.order.aftersale", "order-aftersale", "/order-aftersale", "订单售后", () => import("../../views/order/OrderAftersaleView.vue")),
      item("web.order.exception", "order-exception", "/order-exception", "订单异常", () => import("../../views/order/OrderExceptionView.vue")),
    ],
  },
  {
    groupCode: "wb.sales",
    title: "销售管理",
    items: [
      item("web.sales.create", "sales-order-create", "/sales/create", "销售开单", () => import("../../views/sale/SalesOrderCreate.vue")),
      item("web.sales.bills", "sale-bills", "/sale-bills", "销售单据", () => import("../../views/pos/SaleBillsView.vue")),
      item("web.sales.returns", "sale-returns", "/sale-returns", "销售退货", () => import("../../views/pos/SaleReturnView.vue")),
      item("web.sales.collection", "collection", "/collection", "收款管理", () => import("../../views/pos/CollectionView.vue")),
      item("web.sales.customer-prices", "customer-prices", "/sales/customer-prices", "客户价格", () => import("../../views/sale/CustomerPrices.vue")),
      item("web.sales.commission-rules", "commission-rules", "/sales/commission/rules", "提成规则", () => import("../../views/sale/CommissionRules.vue")),
      item("web.sales.reports", "sales-reports", "/sales/reports", "销售报表", () => import("../../views/sale/SalesReports.vue")),
    ],
  },
  {
    groupCode: "wb.product",
    title: "商品中心",
    items: [
      item("web.product.list", "products", "/products", "商品列表", () => import("../../views/product/Products.vue")),
      item("web.product.categories", "product-categories", "/products/categories", "商品分类", () => import("../../views/product/ProductCategories.vue")),
      item("web.product.brands", "brands", "/products/brands", "品牌管理", () => import("../../views/product/Brands.vue")),
      item("web.product.prices", "prices", "/prices", "价格管理", () => import("../../views/product/PricesView.vue")),
      item("web.product.import", "product-import", "/products/import", "商品导入", () => import("../../views/product/ProductImport.vue")),
      item("web.product.combo", "product-combo", "/products/combo", "套装与组合品", () => import("../../views/product/ProductCombo.vue")),
      item("web.product.reviews", "product-reviews", "/products/reviews", "商品审核", () => import("../../views/product/ProductReview.vue")),
    ],
  },
  {
    groupCode: "wb.inventory",
    // WORKBENCH-10：组名对齐原型一级模块（原「库存中心」）
    title: "库存管理",
    items: [
      item("web.inventory.list", "inventory", "/inventory", "库存查询", () => import("../../views/inventory/Inventory.vue")),
      item("web.inventory.check", "inventory-check", "/inventory-check", "库存盘点", () => import("../../views/inventory/InventoryCheck.vue")),
      item("web.inventory.transfer", "inventory-transfer", "/inventory-transfer", "库存调拨", () => import("../../views/inventory/InventoryTransfer.vue")),
      item("web.inventory.alerts", "inventory-alerts", "/inventory-alerts", "库存预警", () => import("../../views/inventory/InventoryAlerts.vue")),
      item("web.inventory.batch-price", "inventory-batch-price", "/inventory-batch-price", "批量调价", () => import("../../views/inventory/InventoryBatchPrice.vue")),
    ],
  },
  {
    groupCode: "wb.customer",
    // WORKBENCH-10：组名对齐原型一级模块（原「客户会员」；WB-09 已把 Dashboard 入口统一为「客户管理」）
    title: "客户管理",
    items: [
      item("web.customer.list", "customers", "/customers", "客户列表", () => import("../../views/customer/CustomersView.vue")),
      item("web.customer.member-system", "member-system", "/member-system", "会员体系", () => import("../../views/customer/MemberSystem.vue")),
      item("web.customer.store-value", "store-value-cards", "/store-value-cards", "储值卡", () => import("../../views/customer/StoreValueCards.vue")),
      item("web.customer.credit", "credit", "/credit", "信用管理", () => import("../../views/customer/CreditView.vue")),
      item("web.customer.points", "points-rules", "/points-rules", "积分规则", () => import("../../views/customer/PointsRules.vue")),
      item("web.customer.level", "level-config", "/level-config", "等级配置", () => import("../../views/customer/LevelConfig.vue")),
    ],
  },
  {
    groupCode: "wb.finance",
    // WORKBENCH-10：组名对齐原型一级模块（原「财务中心」）
    title: "财务管理",
    items: [
      item("web.finance.payments", "payments", "/payments", "收付款管理", () => import("../../views/finance/PaymentsView.vue")),
      item("web.finance.receivables", "finance-receivables-payables", "/finance/receivables-payables", "应收应付", () => import("../../views/finance/ReceivablesPayables.vue")),
      item("web.finance.customer-statements", "customer-statements", "/customer-statements", "客户对账", () => import("../../views/finance/CustomerStatements.vue")),
      item("web.finance.reconciliation", "finance-reconciliation", "/finance/reconciliation", "财务对账", () => import("../../views/finance/ReconciliationView.vue")),
      item("web.finance.profit", "finance-profit", "/finance/profit", "利润核算", () => import("../../views/finance/FinanceProfit.vue")),
      item("web.finance.fund-report", "fund-report", "/fund-report", "资金报表", () => import("../../views/finance/FinanceReport.vue")),
      item("web.finance.history-bills", "history-bills", "/history-bills", "单据管理", () => import("../../views/finance/HistoryBills.vue")),
    ],
  },
];
