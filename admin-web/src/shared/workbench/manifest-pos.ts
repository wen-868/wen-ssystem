import { item, type ManifestItem } from "./types";

/** 收银台 9 项（8 条路由 + 1 个本地打印设置动作） */
export const CASHIER_ITEMS: ManifestItem[] = [
  item("web.pos.cashier", "pos-cashier", "/pos/cashier", "快速收银", () => import("../../views/pos/CashierView.vue")),
  item("web.pos.sale-bills", "pos-sale-bills", "/pos/sale-bills", "销售单据", () => import("../../views/pos/SaleBillsView.vue")),
  item("web.pos.hold-order", "pos-hold-order", "/pos/hold-order", "挂单管理", () => import("../../views/pos/HoldOrderView.vue")),
  item("web.pos.shift", "pos-shift", "/pos/shift", "交接班", () => import("../../views/pos/ShiftView.vue")),
  item("web.pos.sale-return", "pos-sale-return", "/pos/sale-return", "销售退货", () => import("../../views/pos/SaleReturnView.vue")),
  item("web.pos.member", "pos-member", "/pos/member", "会员识别", () => import("../../views/pos/MemberView.vue")),
  item("web.pos.collection", "pos-collection", "/pos/collection", "分享收款", () => import("../../views/pos/CollectionView.vue")),
  item("web.pos.daily-settle", "pos-daily-settle", "/pos/daily-settle", "日结管理", () => import("../../views/pos/DailySettleView.vue")),
  {
    menuCode: "web.pos.print-settings",
    routeName: null,
    path: null,
    title: "打印设置",
    action: "print-settings",
    visibilityFrom: "pos-cashier",
    component: () => import("../../modules/print/PrintSettingsPanel.vue"),
  },
];
