// ============================================================================
// 手机端「入口权限门」注册表（S3-230）
//
// 背景（为什么要有这个文件）
//   B2 批次累计登记了一批「B 类」写端点：它们的写调用点落在**无权限门的手机页**上
//   （首页快捷入口 / tabBar / 推送深链无条件可达，或全仓无导航入口的孤岛页）
//   ⇒ 页面「看得到按钮的角色」无法枚举，后端**不敢**给这些端点挂权限码：
//      一旦挂码，今天能点的角色（店长 / 店员）点下去就是 403。
//
//   依据：`docs/tasks/cards/R101-授权模型提案-凌舟-20261016.md`
//     · 不变量 I1：凡能看到某页的**在用**角色，必须持有该页写端点所用的码；
//     · 裁定 D4：B 类**必须由前端按码显隐入口（补权限门）**，后端才可收编接线。
//
// 本文件做三件事
//   1. `matchPermissionCode()`：后端 `matchPermission` 的**逐条镜像**（判据同源，见下）；
//   2. `ENTRY_GATES`：入口 → 码 的**声明式注册表**（唯一真相源；runtime 用它求值，
//      证据与断言也用它枚举，避免"文档一套、代码一套"）；
//   3. 给证据脚本/断言提供可机器读取的同构数据（见 docs/evidence/S3-230/**）。
//
// 判据同源（**镜像，不许分叉**）
//   后端：`backend/src/services/admin/rbac.service.ts` 的 `matchPermission()`（:295）
//     ① `"*"` ⇒ 全通过；② `"<dom>:*"` 模块通配；③ `"*:<action>"` 动作通配；④ 精确码。
//   本文件 `matchPermissionCode()` 逐条等价；如后端判据变化，本文件必须同步（同 S3-203 的
//   "同一身份域内两端口径必须同源"精神）。
//
// 「未取到权限码」的处置（**S3-231 F3 起 = 失败关闭**）
//   · `permissions` 为 null/undefined ⇒ 尚未取到（登录响应与 `/admin/auth/me` 均会下发
//     `permissions`；老版本本地缓存可能确实没有）⇒ **不显示**（失败关闭，S3-231 F3 按凌舟裁定 5 改）；
//   · `permissions` 为**空数组** ⇒ 确实取到了、且该用户没有任何码 ⇒ **不显示**（失败关闭，原本即如此）。
//   ⚠️ 与 `stores/menu.ts` 的 null 语义**有意分叉**：menu.ts 的 null = 首屏加载中、放全量（产品既有语义，
//      本单不动）；入口门是"能不能进这个写页面"，未取到就不该给一个必 403 的入口 ⇒ 失败关闭。
//      两者的差异与影响面逐条登记在 `docs/evidence/S3-231/F3/`。
//
// 代码层级：本文件**零依赖**（纯函数 + 常量），可被 Node 直接加载（证据脚本用），
// 也可被 Pinia store / 页面 / 组件引入，避免"文档口径与实现口径"两套。
// ============================================================================

/**
 * 权限码匹配 —— 后端 `matchPermission()` 的逐条镜像（`backend/src/services/admin/rbac.service.ts:295`）。
 *
 * 判定顺序（与后端一致）：
 *  1. `"*"` ⇒ 全通过；
 *  2. 持码含 `"<dom>:*"`，且待判定码以 `<dom>:` 开头 ⇒ 通过（模块通配）；
 *  3. 持码含 `"*:<action>"`，且待判定码以 `:<action>` 结尾 ⇒ 通过（动作通配）；
 *  4. 精确码命中 ⇒ 通过；其余 ⇒ 不通过。
 *
 * @param perms    当前用户的权限码集合（t_sys_role.permissions 去重合并，含通配）
 * @param permCode 待判定的权限码（如 sale:create / system:user:edit）
 */
export function matchPermissionCode(perms: readonly string[] | null | undefined, permCode: string): boolean {
  if (!Array.isArray(perms) || typeof permCode !== 'string' || permCode.length === 0) return false
  if (perms.includes('*')) return true

  const domIndex = permCode.indexOf(':')
  if (domIndex > 0 && perms.includes(`${permCode.slice(0, domIndex)}:*`)) return true

  const actionIndex = permCode.lastIndexOf(':')
  if (
    actionIndex > -1 &&
    actionIndex < permCode.length - 1 &&
    perms.includes(`*:${permCode.slice(actionIndex + 1)}`)
  ) {
    return true
  }
  return perms.includes(permCode)
}

/**
 * 「全部持有」判定：注册表里一个入口若承载**多个不同码**的写端点，
 * 必须**每个码都持有**才显示（否则其中一个端点仍会出现"看得到但点不了"）。
 * 码数组为空 ⇒ 不门（返回 true）。
 *
 * 说明：不做「任一持有即显示」的宽松判定 —— 那会让入口对着未持码的端点继续可见，
 * 等于没补门（I1 只对"看得到的写能力"成立）。
 */
export function hasPermissionCodes(
  perms: readonly string[] | null | undefined,
  codes: readonly string[] | undefined | null
): boolean {
  if (!codes || codes.length === 0) return true
  /**
   * 未取到权限码（`null` / `undefined`）⇒ **不显示**（失败关闭）。见文件头。
   *
   * S3-231 F3（2026-10-16，凌舟裁定 5，`R101-S3-230-凌舟验收与裁定.md` §二.5）：
   *   改造前口径为"未取到 ⇒ 放行（维持改造前可见性）"。裁定改为**失败关闭**，理由：
   *   失败放行会把"无码角色"放进一个**必 403** 的界面（违反不变量 I1'/I1），
   *   而手机端**没有**前端登录拦截可兜底 —— 一旦 `/admin/auth/me` 未回或老版本本地缓存缺字段，
   *   用户就会看到一排点了必 403 的按钮（比"看不到"体验更差，且把越权可能性留给下一次改判）。
   *
   * ⚠️ 影响面（本改动只落在**入口门这一层**，不动 `stores/menu.ts` 的既有 null 语义）：
   *   ① `usePermissionGate.canEntry/canAnyEntry`（页面入口显隐）—— 本项的主目标；
   *   ② `config/function-menu.ts` 的功能中心入口过滤（同样按码显隐，属入口门）；
   *   ③ `native/push.ts` 的推送深链落地判定（同属入口门，避免"点通知进必 403 页"）。
   *   `usePermissionGate.can()` 对**零散动作**仍在 `codes===null` 时放行（那是"该动作不设门"，
   *   与"没取到权限码"是两回事），见该文件注释。
   */
  if (perms === null || perms === undefined) return false
  return codes.every((code) => matchPermissionCode(perms, code))
}

/**
 * 入口权限门（声明式）。
 *
 * · `status = 'gated'`     ：入口已按 `codes` 显隐（本单落地）；
 * · `status = 'registered'`：**只登记、不门**（码未定 / 孤岛页 / 疑似查询型 POST …），
 *                            `codes` 恒为空数组，`note` 必须写出"为什么不门"。
 *
 * ⚠️ 注册表是"入口 → 码"的**唯一真相源**：runtime 的显隐、证据表、断言都从这里读。
 *    新增入口时**先加一行**，再在页面里用 `canEntry('<id>')` 引用，别在页面里手写码。
 */
export interface EntryGate {
  /** 稳定 id（页面 / 证据 / 断言共用键） */
  id: string
  /** 域（与 `docs/tasks/R101-RBAC接线缺口清单.md` 的批次分域一致） */
  domain: string
  /** 入口人读描述（页面上的位置） */
  entry: string
  /** 入口所在页面（相对 app-mobile/src 的路径） */
  page: string
  /** 该入口承载的 B 类写端点（方法 + 路径，逐条列出） */
  endpoints: string[]
  /** 门码：**全部持有**才显示；空数组 = 不门（只登记） */
  codes: string[]
  /** 码依据（批次已落地码 / 批次规则推定），供复核 */
  basis: string
  status: 'gated' | 'registered'
  /** 备注：待裁定项、口径提醒等 */
  note?: string
}

/**
 * 入口门注册表（按域分组，顺序与台账 §九~§十五 的批次顺序一致）。
 *
 * 码选取口径（本单）：① 优先取**同域批次已落地、语义同族**的既有码；
 * ② 批次未定点时，按批次规则「该端点真实使用者已持有的最细现成码」推定，并在此写明依据；
 * ③ 推定不成立（码族无在用持有者且页面确属在用角色 / 语义本身待产品定）⇒ `registered`（只登记）。
 */
export const ENTRY_GATES: EntryGate[] = [
  // ── 一、销售域（S3-224 §14.5，B 类 40 条）────────────────────────────
  {
    id: 'sale-order-detail-deliver',
    domain: '销售域',
    entry: '订单详情页「确认订单 / 开始配送 / 完成配送」三个状态流转按钮',
    page: 'pages/orders/order-detail.vue',
    endpoints: [
      'PUT /api/admin/orders/:orderNo/status',
      'POST /api/store/orders/:orderNo/start-delivery'
    ],
    codes: ['sale:create'],
    basis: '批次已落地同族码：`store-order.routes.ts` 的 accept / complete-delivery / reject 均挂 `sale:create`（pageRoles 含收银员）；手机端 `ordersApi.confirm/startDelivery/completeDelivery` 三个封装**打的是同一个 `PUT /admin/orders/:orderNo/status`**（`api/modules/orders.ts:96-109`）',
    status: 'gated',
    note: '履约族（接单/发货/完成）统一 `sale:create`；改判为 `sale:edit` 会让收银员失去发货'
  },
  {
    id: 'sale-order-detail-cancel',
    domain: '销售域',
    entry: '订单详情页「取消订单」按钮',
    page: 'pages/orders/order-detail.vue',
    endpoints: ['POST /api/admin/orders/:orderNo/cancel'],
    codes: ['sale:void'],
    basis: '**已接线端点**：`admin-order.routes.ts:25` 挂 `requirePermission("sale:void")`（S3-209 落地）',
    status: 'gated',
    note: '**卡外发现**：该按钮所在页（订单详情）经首页快捷入口/推送深链无条件可达，而 B 类 40 条清单未登记它（批次按 `api/modules/orders.ts` 封装判定"无页面调用点"，但 `pages/orders/order-detail.vue:291` 实际调用 `ordersApi.cancel`）⇒ 今天收银员点它必 403。本单补门（取消/作废类按批 6 口径不含收银员）'
  },
  {
    id: 'sale-create-hold',
    domain: '销售域',
    entry: '开单页「挂单」按钮',
    page: 'pages/sales/create-sale.vue',
    endpoints: ['POST /api/store/hold-orders/'],
    codes: ['sale:create'],
    basis: '批次已落地同族码：`store-order.routes.ts` 的 hold-orders restore / delete 均挂 `sale:create`（pageRoles 含收银员）',
    status: 'gated'
  },
  {
    id: 'sale-bill-offline-pay',
    domain: '销售域',
    entry: '销售单详情页「线下收款」按钮',
    page: 'pages-sub/order/sales/sale-detail.vue',
    endpoints: ['POST /api/store/sale-bills/:billNo/offline-payment'],
    codes: ['sale:create'],
    basis: '批次已落地同族码：`store-sale-bill.routes.ts` 的 pay-by-code（收银）挂 `sale:create`',
    status: 'gated',
    note: '收款族按"页面角色含收银员 ⇒ 用覆盖收银员的码"（批 6 规则③）'
  },
  {
    id: 'sale-receipt-sub',
    domain: '销售域',
    entry: '开单页「收款单」子段',
    page: 'pages/sales/create-sale.vue',
    endpoints: ['POST /api/admin/receipts/'],
    codes: ['sale:create'],
    basis: '批 6 规则③（页面角色含收银员）+ 同族收款动作',
    status: 'gated',
    note: '收据作废行（`POST /api/admin/receipts/:receiptNo/void`，批 5 已接 `finance:receipt:create`）不在本入口的写调用面上'
  },

  // ── 二、采购域（S3-214-B2 §11.3，M 类 4 条：移动端开单页采购页签）─────
  {
    id: 'purchase-sub-order',
    domain: '采购域',
    entry: '开单页「采购 → 采购订单」子段',
    page: 'pages/sales/create-sale.vue',
    endpoints: ['POST /api/admin/purchase-orders/'],
    codes: ['purchase:create'],
    basis: '批次已落地同文件同族码：`purchase.routes.ts` 的 cancel / PUT / DELETE 均挂 `purchase:create`',
    status: 'gated',
    note: '在用角色中仅超管（及生产存在但 0 账号的 PURCHASE_STAFF）持该码 ⇒ 店长/店员将看不到本子段（**报备项**）'
  },
  {
    id: 'purchase-sub-inbound',
    domain: '采购域',
    entry: '开单页「采购 → 采购入库」子段',
    page: 'pages/sales/create-sale.vue',
    endpoints: ['POST /api/admin/purchase-in-stocks/'],
    codes: ['inventory:inbound'],
    basis: '批次已落地同族码：`purchase-in-stock.routes.ts` 的 approve / void 挂 `inventory:inbound`',
    status: 'gated',
    note: '店长持 `inventory:*` ⇒ 命中模块通配，不受影响；店员（`inventory:view`）看不到'
  },
  {
    id: 'purchase-sub-return',
    domain: '采购域',
    entry: '开单页「采购 → 采购退货」子段',
    page: 'pages/sales/create-sale.vue',
    endpoints: ['POST /api/admin/purchase-returns/'],
    codes: ['sale:return'],
    basis: '批次已落地同族码：`purchase-return.routes.ts` 的 approve / void 挂 `sale:return`（pageRoles 含店长）',
    status: 'gated'
  },
  {
    id: 'purchase-sub-payment',
    domain: '采购域',
    entry: '开单页「采购 → 付款单」子段',
    page: 'pages/sales/create-sale.vue',
    endpoints: ['POST /api/admin/purchase-payments/'],
    codes: ['finance:payment'],
    basis: '批次已落地同族码：`purchase-payment.routes.ts` 的 approve / void 挂 `finance:payment`（店长持有）',
    status: 'gated'
  },
  {
    id: 'home-in-stock',
    domain: '采购域',
    entry: '首页快捷入口「扫码入库」',
    page: 'pages/home/home.vue',
    endpoints: ['POST /api/admin/purchase-in-stocks/'],
    codes: ['inventory:inbound'],
    basis: '同 `purchase-sub-inbound`（进货入库页的写调用面）',
    status: 'gated',
    note: '店长持 `inventory:*` 不受影响；店员看不到（进货入库本非收银员动作）'
  },

  // ── 三、库存 / 追溯域（S3-198 §9.3，B 类 21 条）───────────────────────
  {
    id: 'fx-stock-check',
    domain: '库存/追溯域',
    entry: '功能中心「盘点调拨」入口（`goods:stock-check`）',
    page: 'pages-sub/product/stock-check/stock-checks.vue',
    endpoints: [
      'POST /api/admin/stock-checks/',
      'PUT /api/admin/stock-checks/:id',
      'POST /api/admin/stock-checks/:id/start',
      'POST /api/admin/stock-checks/:id/complete',
      'POST /api/admin/stock-checks/:id/cancel',
      'POST /api/admin/stock-checks/:id/handle-diff',
      'POST /api/admin/stock-checks/:id/items',
      'PUT /api/store/stock-checks/:id/items/:itemId',
      'POST /api/store/stock-checks/:id/submit'
    ],
    codes: ['inventory:create', 'inventory:adjust'],
    basis: '批次规则②（域内既有码）：新建盘点 = `inventory:create`、差异处理 = `inventory:adjust`（批 1 §9.2 同码）',
    status: 'gated',
    note: '店长持 `inventory:*` 不受影响；店员（`inventory:view`）看不到盘点入口（**报备项**：若门店盘点需收银员参与，须在库存域收编单里改用覆盖收银员的码）'
  },
  {
    id: 'fx-stock-warning',
    domain: '库存/追溯域',
    entry: '功能中心「库存预警」入口（`goods:stock-warning`）+「我的」页「库存预警」快捷入口',
    page: 'pages-sub/product/stock-warning/stock-warning.vue',
    endpoints: [
      'POST /api/admin/stock-warnings/config',
      'PUT /api/store/inventory/alerts/:skuId/threshold'
    ],
    codes: ['inventory:adjust'],
    basis: '批次规则②（域内既有码）：预警阈值配置属库存参数调整',
    status: 'gated',
    note: '店长持 `inventory:*` 不受影响；店员看不到预警入口（**报备项**同盘条目）'
  },
  {
    id: 'fx-loss-gain',
    domain: '库存/追溯域',
    entry: '功能中心「报损报益」入口（`goods:loss-gain`）',
    page: 'pages-sub/finance/loss-gain/loss-gain-report.vue',
    endpoints: ['POST /api/admin/inventory/report-loss-gain'],
    codes: ['inventory:adjust'],
    basis: '批次规则②（域内既有码）：报损报益＝库存数量调整',
    status: 'gated',
    note: '店长持 `inventory:*` 不受影响；店员看不到（**报备项**）'
  },
  {
    id: 'fx-transfer',
    domain: '库存/追溯域',
    entry: '功能中心「门店调拨」入口（`finance:transfer`）',
    page: 'pages-sub/finance/transfer/transfer.vue',
    endpoints: [
      'POST /api/admin/transfers/',
      'PUT /api/admin/transfers/:id',
      'POST /api/admin/transfers/:id/submit',
      'POST /api/admin/transfers/:id/approve',
      'POST /api/admin/transfers/:id/reject',
      'POST /api/admin/transfers/:id/cancel',
      'POST /api/admin/transfers/:id/ship'
    ],
    codes: ['store:transfer'],
    basis: '批次已落地同族码：`transfer-order.routes.ts` 的调拨单 v2 全部挂 `store:transfer`（店长持 `store:*`）',
    status: 'gated'
  },
  {
    id: 'fx-transfer-receive',
    domain: '库存/追溯域',
    entry: '调拨单「门店收货」按钮',
    page: 'pages-sub/finance/transfer/transfer.vue',
    endpoints: ['POST /api/store/transfers/:id/receive'],
    codes: ['store:transfer'],
    basis: '同 `fx-transfer`（同一调拨单生命周期，同族码）',
    status: 'gated',
    note: '**待核对**：若门店收货应由收银员执行（收银员不持 `store:transfer`），须在库存域收编单里改码或补码'
  },
  {
    id: 'fx-trace-verify',
    domain: '库存/追溯域',
    entry: '功能中心「溯源查询」的溯源校验动作',
    page: 'pages-sub/product/trace/trace-query.vue',
    endpoints: ['POST /api/admin/trace/verify'],
    codes: [],
    basis: '码未定',
    status: 'registered',
    note: '`trace:*` 在生产**无任何在用持有者**（`docs/evidence/_shared/prod-roles-20261016.txt`），挂码即把溯源查询打成 403；且该 POST 语义疑似查询型（同 S3-227 C 类形态）⇒ 等"追溯授权口径单 / 立码单"，本单只登记'
  },

  // ── 四、商品域（S3-220 §12.3，B 类 13 条）─────────────────────────────
  {
    id: 'goods-detail-edit',
    domain: '商品域',
    entry: '商品详情页底栏「修改 / 保存」按钮（一次保存会打商品主数据、SKU、单位、营销标签四族端点）',
    page: 'pages/products/product-detail.vue',
    endpoints: [
      'PUT /api/admin/products/:id',
      'PUT /api/admin/products/:skuId/price',
      'PUT /api/admin/products/skus/:skuId',
      'POST /api/admin/products/skus/:skuId/units',
      'PUT /api/admin/products/skus/:skuId/units/:unitId',
      'DELETE /api/admin/products/skus/:skuId/units/:unitId',
      'PUT /api/admin/products/:spuId/marketing-tags',
      'POST /api/admin/products/upload-image'
    ],
    codes: ['goods:edit', 'goods:price', 'goods:create', 'goods:delete'],
    basis: '批次已落地码：`admin-product.routes.ts` 等商品主数据写端点挂 `goods:create|edit|delete`',
    status: 'gated',
    note: '**粗粒度门（主动报备）**：该页是"单按钮多码"（一次保存可能打 `goods:edit`/`goods:price`/`goods:create`/`goods:delete` 四族）⇒ 门取四码全持，在用角色中只有超管/运营可见；店长（仅持 `goods:price`）将看不到移动端商品详情的编辑入口，**批量改价页仍保留**（`goods:price`）。若要给店长保留逐 SKU 改价，需要把「保存」按码拆分或按码禁用字段（前端改造，另立单）'
  },
  {
    id: 'goods-batch-price-submit',
    domain: '商品域',
    entry: '批量改价页「提交」按钮',
    page: 'pages-sub/product/batch-price/batch-price.vue',
    endpoints: ['PUT /api/admin/products/:skuId/price'],
    codes: ['goods:price'],
    basis: '同 `goods-detail-price`（同一端点）',
    status: 'gated'
  },
  {
    id: 'goods-category-create',
    domain: '商品域',
    entry: '商品分类页「新增分类」按钮',
    page: 'pages-sub/product/categories/categories.vue',
    endpoints: ['POST /api/admin/products/categories/'],
    codes: ['goods:create'],
    basis: '批次已落地码：商品域 `goods:create`',
    status: 'gated',
    note: '分类页菜单（`goods:category`）在生产授予 7 个角色、其中 6 个不持 `goods:*` ⇒ 只门**写按钮**、不门页面，保留读能力'
  },
  {
    id: 'goods-category-edit',
    domain: '商品域',
    entry: '商品分类编辑页「保存」按钮 + 分类页「编辑/排序」动作',
    page: 'pages-sub/product/categories/category-edit.vue',
    endpoints: [
      'PUT /api/admin/products/categories/:id',
      'PUT /api/admin/products/categories/:id/sort'
    ],
    codes: ['goods:edit'],
    basis: '批次已落地码：商品域 `goods:edit`',
    status: 'gated'
  },
  {
    id: 'goods-category-delete',
    domain: '商品域',
    entry: '商品分类页「删除」按钮',
    page: 'pages-sub/product/categories/categories.vue',
    endpoints: ['DELETE /api/admin/products/categories/:id'],
    codes: ['goods:delete'],
    basis: '批次已落地码：商品域 `goods:delete`',
    status: 'gated'
  },
  {
    id: 'goods-scan-lookup',
    domain: '商品域',
    entry: '扫码入口的条码查询（商品 tab / 开单页 / 库存页共用）',
    page: 'native/scan.ts',
    endpoints: ['POST /api/admin/library/lookup'],
    codes: [],
    basis: '码未定',
    status: 'registered',
    note: '该 POST 语义为**查询**（不改数据），按 S3-227 C 类口径应登记进门禁 `READ_ONLY_POSTS` ⇒ 等门禁批/裁定，本单不门（挂 `goods:*` 会把所有角色的扫码查货打成 403）'
  },

  // ── 五、员工 / 账号域（S3-225 §15.3 ①，B 类 7 条）────────────────────
  {
    id: 'staff-entry',
    domain: '员工/账号域',
    entry: '「我的」页「员工管理」入口',
    page: 'pages/profile/profile.vue',
    endpoints: [
      'POST /api/admin/staff',
      'PUT /api/admin/staff/:id',
      'PUT /api/admin/staff/:id/disable',
      'POST /api/admin/staff/:id/restore'
    ],
    codes: ['system:user:create', 'system:user:edit'],
    basis: '批次已落地码：S3-225 的 `system:user:create` / `system:user:edit`（079:270/271）',
    status: 'gated',
    note: '持有者只有超管/运营 ⇒ 店长将看不到员工管理入口（**报备项**，S3-225 §15.1⑤ 已预判）'
  },
  {
    id: 'role-entry',
    domain: '员工/账号域',
    entry: '「我的」页「角色管理」入口',
    page: 'pages/profile/profile.vue',
    endpoints: [
      'POST /api/admin/system/roles/',
      'PUT /api/admin/system/roles/:id',
      'DELETE /api/admin/system/roles/:id'
    ],
    codes: ['system:role:create', 'system:role:edit'],
    basis: '批次已落地码：S3-225 的 `system:role:create` / `system:role:edit`（079:272/273）',
    status: 'gated',
    note: '同 `staff-entry`（**报备项**）'
  },

  // ── 六、营销域（S3-226 §15.5，B 类 9 条）─────────────────────────────
  {
    id: 'mkt-coupons',
    domain: '营销域',
    entry: '功能中心「优惠券」入口 + 推送深链（`marketing` → 优惠券页）',
    page: 'pages-sub/marketing/marketing/coupons.vue',
    endpoints: [
      'POST /api/admin/marketing/coupons/templates',
      'POST /api/admin/marketing/coupons/templates/:id/pause'
    ],
    codes: ['marketing:create'],
    basis: '批次已落地码：S3-226 的 `marketing:create`（同文件 activate/delete 已挂）',
    status: 'gated',
    note: '持有者只有超管/运营；`READONLY`（观察员）与 `STORE_ADMIN`（旧词表、0 账号）持营销菜单但无写码 ⇒ 由本门拦在入口'
  },
  {
    id: 'mkt-activities',
    domain: '营销域',
    entry: '功能中心「营销活动」入口',
    page: 'pages-sub/marketing/marketing/activities.vue',
    endpoints: [
      'POST /api/admin/marketing/full-reductions/:id/activate',
      'POST /api/admin/marketing/full-reductions/:id/pause',
      'DELETE /api/admin/marketing/full-reductions/:id'
    ],
    codes: ['marketing:create'],
    basis: '批次已落地码：S3-226 的 `marketing:create`（满减满赠 create/update 已挂）',
    status: 'gated',
    note: '同 `mkt-coupons`'
  },
  {
    id: 'mkt-coupon-verify',
    domain: '营销域',
    entry: '优惠券核销页「核销 / 手工核销」按钮',
    page: 'pages-sub/marketing/marketing/coupon-verify.vue',
    endpoints: [
      'POST /api/store/coupons/verify',
      'POST /api/store/coupons/manual-verify'
    ],
    codes: [],
    basis: '码未定',
    status: 'registered',
    note: '核销是**门店收银动作**（今天由店长/店员执行），而营销域既有写码 `marketing:create` 的在用持有者只有超管/运营 ⇒ 按"宁可登记跳过"处理：先去营销域收编单里定码（候选 `marketing:create` / 新立核销细码 / 覆盖收银员的码）'
  },
  {
    id: 'mkt-points-adjust',
    domain: '营销域',
    entry: '会员详情页「积分调整」按钮',
    page: 'pages-sub/marketing/member/member-detail.vue',
    endpoints: ['POST /api/admin/members/:id/points/adjust'],
    codes: [],
    basis: '码未定',
    status: 'registered',
    note: '三个候选互相冲突（`marketing:points`（超管/运营）／`customer:*`（店长）／`marketing:create`），取决于"谁该调积分"⇒ 待裁定，本单只登记'
  },
  {
    id: 'mkt-points-exchange',
    domain: '营销域',
    entry: '积分兑换页（孤岛页）',
    page: 'pages-sub/marketing/points/points-exchange.vue',
    endpoints: ['POST /api/admin/marketing/points/redeem'],
    codes: [],
    basis: '孤岛页',
    status: 'registered',
    note: '全仓无导航入口 ⇒ 按卡面口径**不为其造入口**，只登记（将来补回入口时按 `marketing:points` 显隐）'
  },

  // ── 七、财务域（S3-223 §13.3，B 类 5 条）─────────────────────────────
  {
    id: 'fin-bank-accounts',
    domain: '财务域',
    entry: '门店管理页「银行账户」新增 / 关闭按钮',
    page: 'pages-sub/admin/stores/stores.vue',
    endpoints: [
      'POST /api/admin/bank-accounts/',
      'POST /api/admin/bank-accounts/:id/close'
    ],
    codes: ['finance:create'],
    basis: '批次已落地码：S3-223 的 `finance:create`（bank-accounts PUT 已挂）',
    status: 'gated',
    note: '店长持 `finance:payment` / `finance:daily-settle`，不持 `finance:create` ⇒ 将看不到银行账户写按钮（**报备项**）'
  },
  {
    id: 'fin-recon-confirm',
    domain: '财务域',
    entry: '对账页「确认对账」按钮（客户 / 供应商）',
    page: 'pages-sub/finance/reconciliation/reconciliation.vue',
    endpoints: [
      'POST /api/admin/reconciliation/customer/:customerId/confirm',
      'POST /api/admin/reconciliation/supplier/:supplierId/confirm'
    ],
    codes: ['report:finance'],
    basis: '批次已落地同语义码：S3-214-B2 的对账单 confirm / dispute 挂 `report:finance`（pageRoles 含店长，店长持 `report:*` ⇒ 在用角色不减）',
    status: 'gated',
    note: '**待核对**：若财务域收编时改用 `finance:create`，本门码须同步改（否则店长会"看得到但 403"）'
  },
  {
    id: 'cust-statement-confirm',
    domain: '客户域',
    entry: '对账单页「确认」按钮',
    page: 'pages-sub/finance/statements/statements.vue',
    endpoints: ['POST /api/store/customer-statements/:statementNo/confirm'],
    codes: [],
    basis: '码未定',
    status: 'registered',
    note: 'S3-222 §12.3 W 类：页面可见角色（生产菜单 `finance:statement`）含 `READONLY`/`STORE_ADMIN`，与任何客户域写码都不重叠；"补授权 / 收菜单 / 立门店专用细码"三选一属产品授权口径 ⇒ 待裁定，本单只登记'
  },

  // ── 八、孤岛页（全仓无导航入口）：**不造入口、只登记** ────────────────
  {
    id: 'island-quote-push',
    domain: '销售域',
    entry: '报价推送页（孤岛页）',
    page: 'pages-sub/product/price-push/price-push.vue',
    endpoints: ['POST /api/admin/quote-push/'],
    codes: [],
    basis: '孤岛页',
    status: 'registered',
    note: '不造入口；将来补回入口时按销售域口径显隐（管理面 `sale:create|edit|void`）'
  },
  {
    id: 'island-aftersale',
    domain: '销售域',
    entry: '售后处理页（孤岛页）',
    page: 'pages-sub/order/order-aftersale/aftersale.vue',
    endpoints: [
      'POST /api/admin/aftersales/:id/approve',
      'POST /api/admin/aftersales/:id/reject',
      'POST /api/admin/aftersales/:id/inspect',
      'POST /api/admin/aftersales/:id/complete'
    ],
    codes: [],
    basis: '孤岛页',
    status: 'registered',
    note: '不造入口；售后族已落地码为 `sale:return`（同域 confirm-receipt）'
  },
  {
    id: 'island-order-exception',
    domain: '销售域',
    entry: '订单异常页（孤岛页）',
    page: 'pages-sub/order/order-exception/exception.vue',
    endpoints: [
      'POST /api/admin/order-exceptions',
      'PUT /api/admin/order-exceptions/:id',
      'PUT /api/admin/order-exceptions/:id/status'
    ],
    codes: [],
    basis: '孤岛页',
    status: 'registered',
    note: '不造入口；订单状态族口径 `sale:edit`（管理面）'
  },
  {
    id: 'island-collection-link',
    domain: '销售域',
    entry: '收款链接页（孤岛页）',
    page: 'pages-sub/product/collection-link/collection-link.vue',
    endpoints: ['POST /api/store/sale-bills/:billNo/collection-link'],
    codes: [],
    basis: '孤岛页',
    status: 'registered',
    note: '不造入口；门店端收款族口径 `sale:create`'
  },
  {
    id: 'island-instant-retail-admin',
    domain: '销售域',
    entry: '即时零售运营 / 平台配置三个孤岛页（订单、配置、商品）',
    page: 'pages-sub/finance/instant-retail/{orders,config,products}.vue',
    endpoints: [
      'POST /api/admin/instant-retail/orders/:orderNo/status',
      'POST /api/admin/instant-retail/routing-rules',
      'PUT /api/admin/instant-retail/routing-rules/:id',
      'DELETE /api/admin/instant-retail/routing-rules/:id',
      'POST /api/admin/instant-retail/exceptions/:id/handle',
      'POST /api/admin/instant-retail/shelf',
      'PUT /api/admin/instant-retail/shelf/:id',
      'DELETE /api/admin/instant-retail/shelf/:id',
      'POST /api/admin/instant-retail/deliveries/:deliveryId/assign',
      'POST /api/admin/instant-retail/deliveries/:deliveryId/status',
      'POST /api/admin/instant-retail/reviews/:id/reply',
      'POST /api/admin/instant-retail/reviews/sync',
      'POST /api/admin/instant-retail/platform/configs',
      'POST /api/admin/instant-retail/platform/configs/:platform/test',
      'POST /api/admin/instant-retail/platform/configs/:platform/sync-orders',
      'POST /api/admin/instant-retail/platform/configs/:platform/sync-products',
      'DELETE /api/admin/instant-retail/platform/configs/:platform',
      'POST /api/admin/instant-retail/platform/shop-config',
      'POST /api/admin/instant-retail/platform/categories',
      'PUT /api/admin/instant-retail/platform/categories/:id',
      'DELETE /api/admin/instant-retail/platform/categories/:id',
      'POST /api/admin/instant-retail/platform/products',
      'PUT /api/admin/instant-retail/platform/products/:id',
      'DELETE /api/admin/instant-retail/platform/products/:id',
      'POST /api/admin/instant-retail/platform/banners',
      'PUT /api/admin/instant-retail/platform/banners/:id',
      'DELETE /api/admin/instant-retail/platform/banners/:id'
    ],
    codes: [],
    basis: '孤岛页',
    status: 'registered',
    note: '27 条（12 运营 + 15 平台）；不造入口。⚠️ 平台配置 15 条另有"路由前缀待核"问题（台账 §14.5 已登记）'
  }
]

/** id → 门（供页面 `canEntry(id)` 与证据脚本共用） */
export const ENTRY_GATE_BY_ID: Record<string, EntryGate> = ENTRY_GATES.reduce<Record<string, EntryGate>>(
  (acc, gate) => {
    acc[gate.id] = gate
    return acc
  },
  {}
)

/** 取某入口应持有的码（未知 id ⇒ 空数组 = 不门；**不抛错**，避免入口因拼错 id 整片消失） */
export function codesOfEntry(id: string): string[] {
  return ENTRY_GATE_BY_ID[id]?.codes ?? []
}

/** 已补门的入口 id 集合（证据/断言用） */
export const GATED_ENTRY_IDS: string[] = ENTRY_GATES.filter((g) => g.status === 'gated').map((g) => g.id)

/** 只登记、不门的入口 id 集合（证据/断言用） */
export const REGISTERED_ENTRY_IDS: string[] = ENTRY_GATES.filter((g) => g.status === 'registered').map(
  (g) => g.id
)
