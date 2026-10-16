/**
 * S3-230 · B 类写端点台账（端点级，机器可读）
 *
 * 来源：`docs/tasks/R101-RBAC接线缺口清单.md` 各批次 §9.3 / §11.3 / §12.3（商品+客户）/ §13.3
 *      / §14.5 / §15.3① / §15.5 的 **B 类行**（逐条），以及 S3-224 验收卡 §四结转列的
 *      "B 类：销售 40 + 采购 4 + 财务 5 + 客户 1 …" 归属口径。
 *
 * 每行字段：
 *   domain   域（台账分域口径）
 *   endpoint 「方法 路径」
 *   entryId  入口权限门 id（`app-mobile/src/config/permission-gates.ts` 的 ENTRY_GATES）；
 *            该端点的写调用点落在这个入口上 ⇒ 入口按码显隐后，端点即可被后端收编
 *   status   'gated'（入口已按码显隐）/ 'registered'（只登记：孤岛页 / 码未定 / 查询型 POST）
 *   caller   手机端写调用点（证据；file:line）
 *
 * 说明：**同一入口承载多个端点**时（如商品详情一次性保存打 6 个端点），逐条列出、entryId 相同。
 */

export const B_CLASS_ROWS = [
  // ── 销售域（§14.5，B 类 40 条）───────────────────────────────────────
  { domain: '销售域', endpoint: 'PUT /api/admin/orders/:orderNo/status', entryId: 'sale-order-detail-deliver', status: 'gated', caller: 'pages/orders/order-detail.vue:258（ordersApi.startDelivery；同页 confirm/completeDelivery 打同一端点）' },
  { domain: '销售域', endpoint: 'POST /api/store/orders/:orderNo/start-delivery', entryId: 'sale-order-detail-deliver', status: 'gated', caller: 'pages/orders/order-detail.vue:258' },
  { domain: '销售域', endpoint: 'POST /api/store/hold-orders/', entryId: 'sale-create-hold', status: 'gated', caller: 'pages/sales/create-sale.vue:2013（storeApi.createHoldOrder，订单/进货「保存」）' },
  { domain: '销售域', endpoint: 'POST /api/store/sale-bills/:billNo/offline-payment', entryId: 'sale-bill-offline-pay', status: 'gated', caller: 'pages-sub/order/sales/sale-detail.vue:172（salesApi.offlinePayment）' },
  // 同一端点的**第二个入口**：首页快捷入口「扫码入库」（hook 在同一写调用面上）
  { domain: '采购域', endpoint: 'POST /api/admin/purchase-in-stocks/', entryId: 'home-in-stock', status: 'gated', caller: 'pages/home/home.vue:83 → 进货入库页（同 purchase-sub-inbound 的写调用面）' },
  // 同一端点的**第二个入口**：商品 tab → 批量改价页
  { domain: '商品域', endpoint: 'PUT /api/admin/products/:skuId/price', entryId: 'goods-batch-price-submit', status: 'gated', caller: 'pages/products/products.vue:327 → 批量改价页（同 goods-detail-price 的端点）' },
  // ⚠️ 卡外发现（B 类 40 条清单未登记；端点已接线 sale:void，页面却无条件可达）
  { domain: '销售域', endpoint: 'POST /api/admin/orders/:orderNo/cancel', entryId: 'sale-order-detail-cancel', status: 'gated', caller: 'pages/orders/order-detail.vue:291（ordersApi.cancel）；端点已在 admin-order.routes.ts:25 接 sale:void' },
  { domain: '销售域', endpoint: 'POST /api/admin/quote-push/', entryId: 'island-quote-push', status: 'registered', caller: 'pages-sub/product/price-push/price-push.vue:163（孤岛页）' },
  { domain: '销售域', endpoint: 'POST /api/admin/aftersales/:id/approve', entryId: 'island-aftersale', status: 'registered', caller: 'pages-sub/order/order-aftersale/aftersale.vue:144（孤岛页）' },
  { domain: '销售域', endpoint: 'POST /api/admin/aftersales/:id/reject', entryId: 'island-aftersale', status: 'registered', caller: 'pages-sub/order/order-aftersale/aftersale.vue:178（孤岛页）' },
  { domain: '销售域', endpoint: 'POST /api/admin/aftersales/:id/inspect', entryId: 'island-aftersale', status: 'registered', caller: 'pages-sub/order/order-aftersale/aftersale.vue（孤岛页）' },
  { domain: '销售域', endpoint: 'POST /api/admin/aftersales/:id/complete', entryId: 'island-aftersale', status: 'registered', caller: 'pages-sub/order/order-aftersale/aftersale.vue（孤岛页）' },
  { domain: '销售域', endpoint: 'POST /api/admin/order-exceptions', entryId: 'island-order-exception', status: 'registered', caller: 'pages-sub/order/order-exception/exception.vue（api/modules/exceptions.ts:123）' },
  { domain: '销售域', endpoint: 'PUT /api/admin/order-exceptions/:id', entryId: 'island-order-exception', status: 'registered', caller: 'api/modules/exceptions.ts:140' },
  { domain: '销售域', endpoint: 'PUT /api/admin/order-exceptions/:id/status', entryId: 'island-order-exception', status: 'registered', caller: 'api/modules/exceptions.ts:134' },
  { domain: '销售域', endpoint: 'POST /api/store/sale-bills/:billNo/collection-link', entryId: 'island-collection-link', status: 'registered', caller: 'pages-sub/product/collection-link/collection-link.vue:119（孤岛页）' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/orders/:orderNo/status', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/orders.vue:224' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/routing-rules', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/config.vue:158' },
  { domain: '销售域', endpoint: 'PUT /api/admin/instant-retail/routing-rules/:id', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/config.vue:170' },
  { domain: '销售域', endpoint: 'DELETE /api/admin/instant-retail/routing-rules/:id', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/config.vue:180' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/exceptions/:id/handle', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/orders.vue:244' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/shelf', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/products.vue:201' },
  { domain: '销售域', endpoint: 'PUT /api/admin/instant-retail/shelf/:id', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/products.vue:215' },
  { domain: '销售域', endpoint: 'DELETE /api/admin/instant-retail/shelf/:id', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/products.vue:237' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/deliveries/:deliveryId/assign', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/orders.vue:274' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/deliveries/:deliveryId/status', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/orders.vue:274' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/reviews/:id/reply', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/orders.vue:274' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/reviews/sync', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/orders.vue:274' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/platform/configs', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/config.vue:205' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/platform/configs/:platform/test', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/config.vue:205' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/platform/configs/:platform/sync-orders', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/config.vue:205' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/platform/configs/:platform/sync-products', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/config.vue:205' },
  { domain: '销售域', endpoint: 'DELETE /api/admin/instant-retail/platform/configs/:platform', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/config.vue:205' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/platform/shop-config', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/config.vue:205' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/platform/categories', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/products.vue:237' },
  { domain: '销售域', endpoint: 'PUT /api/admin/instant-retail/platform/categories/:id', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/products.vue:237' },
  { domain: '销售域', endpoint: 'DELETE /api/admin/instant-retail/platform/categories/:id', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/products.vue:237' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/platform/products', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/products.vue:237' },
  { domain: '销售域', endpoint: 'PUT /api/admin/instant-retail/platform/products/:id', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/products.vue:237' },
  { domain: '销售域', endpoint: 'DELETE /api/admin/instant-retail/platform/products/:id', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/products.vue:237' },
  { domain: '销售域', endpoint: 'POST /api/admin/instant-retail/platform/banners', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/products.vue:237' },
  { domain: '销售域', endpoint: 'PUT /api/admin/instant-retail/platform/banners/:id', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/products.vue:237' },
  { domain: '销售域', endpoint: 'DELETE /api/admin/instant-retail/platform/banners/:id', entryId: 'island-instant-retail-admin', status: 'registered', caller: 'pages-sub/finance/instant-retail/products.vue:237' },

  // ── 采购域（§11.3 M 类 4 条：移动端开单页采购页签）────────────────────
  { domain: '采购域', endpoint: 'POST /api/admin/purchase-orders/', entryId: 'purchase-sub-order', status: 'gated', caller: 'pages/sales/create-sale.vue:2159（doc=pur_order 提交）' },
  { domain: '采购域', endpoint: 'POST /api/admin/purchase-in-stocks/', entryId: 'purchase-sub-inbound', status: 'gated', caller: 'pages/sales/create-sale.vue:2112（doc=pur_inbound「转付款单」）' },
  { domain: '采购域', endpoint: 'POST /api/admin/purchase-payments/', entryId: 'purchase-sub-payment', status: 'gated', caller: 'pages/sales/create-sale.vue:2211（doc=pur_payment「确认付款」）' },
  { domain: '采购域', endpoint: 'POST /api/admin/purchase-returns/', entryId: 'purchase-sub-return', status: 'gated', caller: 'pages/sales/create-sale.vue:2270（submitPurchaseReturn）' },

  // ── 库存 / 追溯域（§9.3，B 类 21 条）──────────────────────────────────
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/inventory/report-loss-gain', entryId: 'fx-loss-gain', status: 'gated', caller: 'api/modules/inventory-loss-gain.ts:175/184（报损报益页）' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/stock-checks/', entryId: 'fx-stock-check', status: 'gated', caller: 'api/modules/stock-check.ts:97-122' },
  { domain: '库存/追溯域', endpoint: 'PUT /api/admin/stock-checks/:id', entryId: 'fx-stock-check', status: 'gated', caller: 'api/modules/stock-check.ts:97-122' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/stock-checks/:id/start', entryId: 'fx-stock-check', status: 'gated', caller: 'api/modules/stock-check.ts:97-122' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/stock-checks/:id/complete', entryId: 'fx-stock-check', status: 'gated', caller: 'api/modules/stock-check.ts:97-122' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/stock-checks/:id/cancel', entryId: 'fx-stock-check', status: 'gated', caller: 'api/modules/stock-check.ts:97-122' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/stock-checks/:id/handle-diff', entryId: 'fx-stock-check', status: 'gated', caller: 'api/modules/stock-check.ts:97-122' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/stock-checks/:id/items', entryId: 'fx-stock-check', status: 'gated', caller: 'api/modules/stock-check.ts:97-122' },
  { domain: '库存/追溯域', endpoint: 'PUT /api/store/stock-checks/:id/items/:itemId', entryId: 'fx-stock-check', status: 'gated', caller: 'api/modules/store.ts:645' },
  { domain: '库存/追溯域', endpoint: 'POST /api/store/stock-checks/:id/submit', entryId: 'fx-stock-check', status: 'gated', caller: 'api/modules/store.ts:650' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/stock-warnings/config', entryId: 'fx-stock-warning', status: 'gated', caller: 'api/modules/stock-warning.ts:72' },
  { domain: '库存/追溯域', endpoint: 'PUT /api/store/inventory/alerts/:skuId/threshold', entryId: 'fx-stock-warning', status: 'gated', caller: 'api/modules/store.ts:485' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/trace/verify', entryId: 'fx-trace-verify', status: 'registered', caller: 'api/modules/trace.ts:154（溯源查询页）' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/transfers/', entryId: 'fx-transfer', status: 'gated', caller: 'api/modules/transfer.ts:104-129' },
  { domain: '库存/追溯域', endpoint: 'PUT /api/admin/transfers/:id', entryId: 'fx-transfer', status: 'gated', caller: 'api/modules/transfer.ts:104-129' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/transfers/:id/submit', entryId: 'fx-transfer', status: 'gated', caller: 'api/modules/transfer.ts:104-129' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/transfers/:id/approve', entryId: 'fx-transfer', status: 'gated', caller: 'api/modules/transfer.ts:104-129' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/transfers/:id/reject', entryId: 'fx-transfer', status: 'gated', caller: 'api/modules/transfer.ts:104-129' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/transfers/:id/cancel', entryId: 'fx-transfer', status: 'gated', caller: 'api/modules/transfer.ts:104-129' },
  { domain: '库存/追溯域', endpoint: 'POST /api/admin/transfers/:id/ship', entryId: 'fx-transfer', status: 'gated', caller: 'api/modules/transfer.ts:104-129' },
  { domain: '库存/追溯域', endpoint: 'POST /api/store/transfers/:id/receive', entryId: 'fx-transfer-receive', status: 'gated', caller: 'pages-sub/finance/transfer/transfer.vue:265（handleReceive → transferApi.receive）' },

  // ── 商品域（§12.3，B 类 13 条）───────────────────────────────────────
  { domain: '商品域', endpoint: 'POST /api/admin/library/lookup', entryId: 'goods-scan-lookup', status: 'registered', caller: 'native/scan.ts:746（扫码查货，多页共用）' },
  { domain: '商品域', endpoint: 'POST /api/admin/products/upload-image', entryId: 'goods-detail-edit', status: 'gated', caller: 'pages/products/product-detail.vue:1268' },
  { domain: '商品域', endpoint: 'PUT /api/admin/products/:id', entryId: 'goods-detail-edit', status: 'gated', caller: 'pages/products/product-detail.vue:1009' },
  // 商品详情里的改价与商品主数据**共用一个底栏「保存」按钮** ⇒ 门合并进 goods-detail-edit（四码全持，天然 ⊆ goods:price 持有人，I1 成立）；
  // 批量改价页是独立入口，按 goods:price 单独为门（下行）
  { domain: '商品域', endpoint: 'PUT /api/admin/products/:skuId/price', entryId: 'goods-detail-edit', status: 'gated', caller: 'pages/products/product-detail.vue:1031（底栏「保存」，与商品主数据同按钮）+ pages-sub/product/batch-price/batch-price.vue:834' },
  { domain: '商品域', endpoint: 'PUT /api/admin/products/skus/:skuId', entryId: 'goods-detail-edit', status: 'gated', caller: 'api/modules/products.ts:55' },
  { domain: '商品域', endpoint: 'POST /api/admin/products/skus/:skuId/units', entryId: 'goods-detail-edit', status: 'gated', caller: 'pages/products/product-detail.vue:1080' },
  { domain: '商品域', endpoint: 'PUT /api/admin/products/skus/:skuId/units/:unitId', entryId: 'goods-detail-edit', status: 'gated', caller: 'pages/products/product-detail.vue:1049/1072' },
  { domain: '商品域', endpoint: 'DELETE /api/admin/products/skus/:skuId/units/:unitId', entryId: 'goods-detail-edit', status: 'gated', caller: 'pages/products/product-detail.vue:1054' },
  { domain: '商品域', endpoint: 'PUT /api/admin/products/:spuId/marketing-tags', entryId: 'goods-detail-edit', status: 'gated', caller: 'pages/products/product-detail.vue:1092' },
  { domain: '商品域', endpoint: 'POST /api/admin/products/categories/', entryId: 'goods-category-create', status: 'gated', caller: 'pages-sub/product/categories/category-edit.vue:176' },
  { domain: '商品域', endpoint: 'PUT /api/admin/products/categories/:id', entryId: 'goods-category-edit', status: 'gated', caller: 'pages-sub/product/categories/category-edit.vue:174' },
  { domain: '商品域', endpoint: 'DELETE /api/admin/products/categories/:id', entryId: 'goods-category-delete', status: 'gated', caller: 'pages-sub/product/categories/categories.vue:196' },
  { domain: '商品域', endpoint: 'PUT /api/admin/products/categories/:id/sort', entryId: 'goods-category-edit', status: 'gated', caller: 'pages-sub/product/categories/categories.vue:179' },

  // ── 员工 / 账号域（§15.3 ①，B 类 7 条）───────────────────────────────
  { domain: '员工/账号域', endpoint: 'POST /api/admin/staff', entryId: 'staff-entry', status: 'gated', caller: 'pages-sub/admin/admin/employees.vue:132' },
  { domain: '员工/账号域', endpoint: 'PUT /api/admin/staff/:id', entryId: 'staff-entry', status: 'gated', caller: 'pages-sub/admin/admin/employees.vue:159' },
  { domain: '员工/账号域', endpoint: 'PUT /api/admin/staff/:id/disable', entryId: 'staff-entry', status: 'gated', caller: 'pages-sub/admin/admin/employees.vue:179' },
  { domain: '员工/账号域', endpoint: 'POST /api/admin/staff/:id/restore', entryId: 'staff-entry', status: 'gated', caller: 'pages-sub/admin/admin/employees.vue:187' },
  { domain: '员工/账号域', endpoint: 'POST /api/admin/system/roles/', entryId: 'role-entry', status: 'gated', caller: 'pages-sub/admin/roles/role-edit.vue:227' },
  { domain: '员工/账号域', endpoint: 'PUT /api/admin/system/roles/:id', entryId: 'role-entry', status: 'gated', caller: 'pages-sub/admin/roles/role-edit.vue:225' },
  { domain: '员工/账号域', endpoint: 'DELETE /api/admin/system/roles/:id', entryId: 'role-entry', status: 'gated', caller: 'pages-sub/admin/roles/roles.vue:116' },

  // ── 营销域（§15.5，B 类 9 条）────────────────────────────────────────
  { domain: '营销域', endpoint: 'POST /api/admin/marketing/coupons/templates', entryId: 'mkt-coupons', status: 'gated', caller: 'pages-sub/marketing/marketing/create-coupon.vue:279' },
  { domain: '营销域', endpoint: 'POST /api/admin/marketing/coupons/templates/:id/pause', entryId: 'mkt-coupons', status: 'gated', caller: 'pages-sub/marketing/marketing/coupons.vue:147' },
  { domain: '营销域', endpoint: 'POST /api/admin/marketing/full-reductions/:id/activate', entryId: 'mkt-activities', status: 'gated', caller: 'pages-sub/marketing/marketing/activities.vue:128' },
  { domain: '营销域', endpoint: 'POST /api/admin/marketing/full-reductions/:id/pause', entryId: 'mkt-activities', status: 'gated', caller: 'pages-sub/marketing/marketing/activities.vue:146' },
  { domain: '营销域', endpoint: 'DELETE /api/admin/marketing/full-reductions/:id', entryId: 'mkt-activities', status: 'gated', caller: 'pages-sub/marketing/marketing/activities.vue:164' },
  { domain: '营销域', endpoint: 'POST /api/admin/marketing/points/redeem', entryId: 'mkt-points-exchange', status: 'registered', caller: 'pages-sub/marketing/points/points-exchange.vue:88（孤岛页）' },
  { domain: '营销域', endpoint: 'POST /api/admin/members/:id/points/adjust', entryId: 'mkt-points-adjust', status: 'registered', caller: 'pages-sub/marketing/member/member-detail.vue:540' },
  { domain: '营销域', endpoint: 'POST /api/store/coupons/verify', entryId: 'mkt-coupon-verify', status: 'registered', caller: 'pages-sub/marketing/marketing/coupon-verify.vue:160' },
  { domain: '营销域', endpoint: 'POST /api/store/coupons/manual-verify', entryId: 'mkt-coupon-verify', status: 'registered', caller: 'pages-sub/marketing/marketing/coupon-verify.vue:163' },

  // ── 财务域（§13.3，B 类 5 条）────────────────────────────────────────
  { domain: '财务域', endpoint: 'POST /api/admin/bank-accounts/', entryId: 'fin-bank-accounts', status: 'gated', caller: 'pages-sub/admin/stores/stores.vue:241' },
  { domain: '财务域', endpoint: 'POST /api/admin/bank-accounts/:id/close', entryId: 'fin-bank-accounts', status: 'gated', caller: 'pages-sub/admin/stores/stores.vue:263' },
  { domain: '财务域', endpoint: 'POST /api/admin/receipts/', entryId: 'sale-receipt-sub', status: 'gated', caller: 'pages/sales/create-sale.vue:2202（收款单提交，receipts.ts:54）' },
  { domain: '财务域', endpoint: 'POST /api/admin/reconciliation/customer/:customerId/confirm', entryId: 'fin-recon-confirm', status: 'gated', caller: 'pages-sub/finance/reconciliation/reconciliation.vue:256' },
  { domain: '财务域', endpoint: 'POST /api/admin/reconciliation/supplier/:supplierId/confirm', entryId: 'fin-recon-confirm', status: 'gated', caller: 'pages-sub/finance/reconciliation/reconciliation.vue:258' },

  // ── 客户域（§12.3 W 类 1 条，S3-224 验收卡 §四结转把它列进本门单口径）──
  { domain: '客户域', endpoint: 'POST /api/store/customer-statements/:statementNo/confirm', entryId: 'cust-statement-confirm', status: 'registered', caller: 'pages-sub/finance/statements/statements.vue:97' }
]

/** 台账域顺序（打印用） */
export const DOMAIN_ORDER = ['销售域', '采购域', '库存/追溯域', '商品域', '员工/账号域', '营销域', '财务域', '客户域']
