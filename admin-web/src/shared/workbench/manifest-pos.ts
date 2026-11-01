import { item, type ManifestItem } from "./types";

/**
 * 收银台 9 项（8 条真实路由 + 1 个本地打印设置动作）。
 *
 * ⚠️ WORKBENCH-12 说明（打印设置入口归属结论）：
 *   `web.pos.print-settings` **刻意不绑定路由**，`routeName` 与 `path` 均为 `null`，
 *   靠 `action: "print-settings"` + `visibilityFrom: "pos-cashier"` 由外壳打开本机弹窗
 *   （`src/modules/print/PrintSettingsPanel.vue` 只读写本机配置，零后端请求）。
 *
 *   选择「保留本地动作」而非「补真实路由」的消费者理由：
 *     1. 该面板是**本机**配置（打印机/小票模板），无服务端资源可寻址，路由化没有语义收益；
 *     2. 收银流程中它属于**上下文弹窗**，跳走会中断当前结账，与「弹窗即用即走」的原型一致；
 *     3. 既有守卫已锁定该契约：`workbench-shell.spec.mjs:127` 断言 `routeName === null`，
 *        `parity-coverage.spec.mjs:105` 要求显式给出「本地弹窗」原因，`rollout-rollback.spec.mjs:177`
 *        断言「本地动作必须不产生路由跳转」——补路由会同时打红这三条守卫并违背原型。
 *
 *   消费方契约：任何渲染该列表的外壳都**必须先判 `action` 再判 `path`**。
 *   `WorkbenchShell.vue:671-675` 已正确实现（`action` 命中即开弹窗并 return）；
 *   `WorkbenchShell.vue:666` 亦对 `!entry.path` 提前返回，不会把本地动作当路由高亮。
 *
 *   遗留项（**本卡允许路径外，未修改**）：`MainLayout.vue:385` 的收银导航硬编码里
 *   给该项写了 `path: "/pos/print-settings"` 这个**未注册路径**。其点击分支同样先判
 *   `action`（`MainLayout.vue:393`）故**不会真跳转、不构成死链**；但该字段会被
 *   `isCashierNavActive(item.path)`（:401）用于前缀高亮，属语义噪声。
 *   已在证据中登记为 WORKBENCH-13 待清理项（需放开 `MainLayout.vue` 写入权限）。
 */
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
    /** 本地动作项：不绑定路由（consumer 必须先判 action） */
    routeName: null,
    /** 必须保持 null：非 null 会让外壳误当可跳转路由（见文件头说明） */
    path: null,
    title: "打印设置",
    action: "print-settings",
    visibilityFrom: "pos-cashier",
    component: () => import("../../modules/print/PrintSettingsPanel.vue"),
  },
];

/** 本地动作入口（无路由项）——供外壳与测试统一消费，避免各自硬编码判断 */
export const CASHIER_LOCAL_ACTION_ITEMS: ManifestItem[] = CASHIER_ITEMS.filter((entry) => entry.action && !entry.routeName);

/** 判断某 manifest 项是否为本地动作（非路由入口） */
export function isLocalActionItem(entry: Pick<ManifestItem, "routeName" | "action">): boolean {
  return Boolean(entry.action) && !entry.routeName;
}

/** 收银台可路由项（本地动作已排除），供路由/高亮逻辑使用 */
export const CASHIER_ROUTED_ITEMS: ManifestItem[] = CASHIER_ITEMS.filter((entry) => entry.routeName && entry.path);
