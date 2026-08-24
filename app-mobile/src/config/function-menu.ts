// ============================================================================
// 手机端功能菜单注册表（数据驱动，唯一真相源）
// 说明：
//  - 系统功能 ↔ 手机端页面 path 在这里登记；新增功能只需加一行，手机端自动排列。
//  - isHot=true 的项显示在「功能」tab 高频宫格；其余按分组显示在「全部功能」。
//  - isTool=true 的项显示在「数据 · 工具」区块（带副标题）。
//  - icon 复用 /static/icons/fn-*.svg；缺专属图标时用 fn-more 兜底，后续替换。
// ============================================================================

export interface FunctionItem {
  /** 系统菜单 code（对应 t_sys_menu.menu_code，用于角色过滤扩展） */
  code: string
  label: string
  path: string
  icon: string
  sub?: string
  hot?: boolean
  tool?: boolean
  /** 已放入「我的」页：功能中心隐藏展示（仅调整显示位置，不删数据源） */
  inProfile?: boolean
}

export interface FunctionGroup {
  id: string
  title: string
  items: FunctionItem[]
  /** 门店/系统管理等后台类分组：功能中心(功能tab 全部功能)不展示，归「我的」页 */
  admin?: boolean
}

const DEFAULT_ICON = '/static/icons/fn-more.svg'

export const functionMenu: FunctionGroup[] = [
  {
    id: 'sale',
    title: '开单收银',
    items: [
      { code: 'sale:bill', label: '销售开单', path: '/pages/sales/create-sale', icon: '/static/icons/fn-open.svg', hot: true },
      { code: 'sale:record', label: '销售记录', path: '/pages/orders/orders', icon: '/static/icons/fn-order.svg', hot: true },
    ],
  },
  {
    id: 'goods',
    title: '商品库存',
    items: [
      { code: 'goods:list', label: '商品列表', path: '/pages/products/products', icon: '/static/icons/fn-product.svg' },
      { code: 'goods:category', label: '商品分类', path: '/pages-sub/product/categories/categories', icon: '/static/icons/fn-category.svg' },
      { code: 'goods:price', label: '价格管理', path: '/pages-sub/product/price/price-manage', icon: '/static/icons/fn-price.svg' },
      { code: 'goods:batch', label: '批次管理', path: '/pages-sub/product/batches/batch-list', icon: '/static/icons/fn-batch.svg' },
      { code: 'goods:inventory', label: '库存管理', path: '/pages-sub/product/inventory/inventory', icon: '/static/icons/fn-stockin.svg', hot: true },
      { code: 'goods:stock-warning', label: '库存预警', path: '/pages-sub/product/stock-warning/stock-warning', icon: '/static/icons/fn-alert.svg', inProfile: true },
      { code: 'goods:stock-check', label: '盘点调拨', path: '/pages-sub/product/stock-check/stock-checks', icon: '/static/icons/fn-check.svg', hot: true },
      { code: 'goods:loss-gain', label: '报损报益', path: '/pages-sub/finance/loss-gain/loss-gain-report', icon: '/static/icons/fn-loss-gain.svg' },
    ],
  },
  {
    id: 'purchase',
    title: '采购供应商',
    items: [
      { code: 'purchase:order', label: '采购订单', path: '/pages-sub/finance/purchase/orders', icon: '/static/icons/fn-purchase-order.svg' },
      { code: 'purchase:inbound', label: '进货入库', path: '/pages-sub/finance/purchase/in-stock', icon: '/static/icons/fn-stockin.svg', hot: true },
      { code: 'purchase:supplier', label: '供应商管理', path: '/pages-sub/product/suppliers/suppliers', icon: '/static/icons/fn-supplier.svg' },
    ],
  },
  {
    id: 'customer',
    title: '客户会员',
    items: [
      { code: 'customer:list', label: '会员管理', path: '/pages-sub/marketing/member/member-list', icon: '/static/icons/fn-member.svg', hot: true },
      { code: 'customer:level', label: '会员等级', path: '/pages-sub/marketing/member-levels/member-levels', icon: '/static/icons/fn-level.svg' },
      { code: 'customer:points', label: '积分管理', path: '/pages-sub/marketing/points/points-detail', icon: '/static/icons/fn-points.svg' },
      { code: 'customer:stored-card', label: '储值卡', path: '/pages-sub/marketing/stored-cards/stored-cards', icon: '/static/icons/fn-stored-card.svg' },
      { code: 'customer:address', label: '收货地址', path: '/pages-sub/marketing/member/address', icon: '/static/icons/fn-address.svg' },
    ],
  },
  {
    id: 'marketing',
    title: '营销活动',
    items: [
      { code: 'marketing:coupon', label: '优惠券', path: '/pages-sub/marketing/marketing/coupons', icon: '/static/icons/fn-coupon.svg' },
      { code: 'marketing:activities', label: '营销活动', path: '/pages-sub/marketing/marketing/activities', icon: '/static/icons/fn-activity.svg' },
      { code: 'marketing:seckill', label: '秒杀活动', path: '/pages-sub/marketing/marketing/seckill-list', icon: '/static/icons/fn-flash.svg' },
      { code: 'marketing:group-buy', label: '拼团活动', path: '/pages-sub/marketing/marketing/group-buy-list', icon: '/static/icons/fn-group-buy.svg' },
      { code: 'marketing:bargain', label: '砍价活动', path: '/pages-sub/marketing/marketing/bargain-list', icon: '/static/icons/fn-bargain.svg' },
      { code: 'marketing:community', label: '社区营销', path: '/pages-sub/marketing/marketing/community-activities', icon: '/static/icons/fn-community.svg' },
    ],
  },
  {
    id: 'finance',
    title: '财务对账',
    items: [
      { code: 'finance:receipt', label: '收款管理', path: '/pages-sub/finance/receipts/receipts', icon: '/static/icons/fn-settle.svg' },
      { code: 'finance:receivable', label: '应收账款', path: '/pages-sub/finance/receivable/receivable', icon: '/static/icons/fn-receivable.svg' },
      { code: 'finance:reconciliation', label: '收银对账', path: '/pages-sub/finance/reconciliation/reconciliation', icon: '/static/icons/fn-settle.svg', hot: true, inProfile: true },
      { code: 'finance:expenses', label: '费用支出', path: '/pages-sub/finance/finance/expenses', icon: '/static/icons/fn-expense.svg' },
      { code: 'finance:statement', label: '对账单', path: '/pages-sub/finance/statements/statements', icon: '/static/icons/fn-statement.svg' },
      { code: 'finance:transfer', label: '门店调拨', path: '/pages-sub/finance/transfer/transfer', icon: '/static/icons/fn-transfer.svg' },
    ],
  },
  {
    id: 'report',
    title: '数据分析 · 工具',
    items: [
      { code: 'report:dashboard', label: '经营报表', sub: '营业额、利润、趋势分析', path: '/pages-sub/finance/reports/reports', icon: '/static/icons/fn-report.svg', tool: true },
      { code: 'report:sales', label: '销售排行', sub: '商品销量TOP排行', path: '/pages-sub/finance/reports/sales-reports', icon: '/static/icons/fn-rank.svg', tool: true },
      { code: 'report:inventory', label: '库存报表', sub: '库存进销存分析', path: '/pages-sub/finance/reports/inventory-reports', icon: '/static/icons/fn-report.svg', tool: true },
      { code: 'report:purchase', label: '采购报表', sub: '采购进货分析', path: '/pages-sub/finance/reports/purchase-reports', icon: '/static/icons/fn-report.svg', tool: true },
      { code: 'report:customer', label: '客户报表', sub: '客户消费分析', path: '/pages-sub/finance/reports/customer-reports', icon: '/static/icons/fn-report.svg', tool: true },
      { code: 'report:finance-report', label: '财务报表', sub: '收支利润分析', path: '/pages-sub/finance/reports/finance-reports', icon: '/static/icons/fn-report.svg', tool: true },
      { code: 'goods:trace', label: '溯源查询', sub: '商品来源与批次追踪', path: '/pages-sub/product/trace/trace-query', icon: '/static/icons/fn-trace.svg', tool: true },
    ],
  },
  {
    id: 'store',
    title: '门店组织',
    admin: true,
    items: [
      { code: 'store:list', label: '门店管理', path: '/pages-sub/admin/stores/stores', icon: '/static/icons/fn-store.svg', hot: true, inProfile: true },
      { code: 'store:employees', label: '员工管理', path: '/pages-sub/admin/admin/employees', icon: '/static/icons/fn-staff.svg', inProfile: true },
      { code: 'store:roles', label: '角色管理', path: '/pages-sub/admin/roles/roles', icon: '/static/icons/fn-role.svg' },
    ],
  },
  {
    id: 'system',
    title: '系统设置',
    admin: true,
    items: [
      { code: 'system:print', label: '单据打印', path: '/pages-sub/admin/print/print-records', icon: '/static/icons/fn-print.svg', hot: true, inProfile: true },
      { code: 'system:config', label: '系统设置', path: '/pages-sub/admin/settings/settings', icon: '/static/icons/fn-setting.svg', inProfile: true },
      { code: 'system:operation-log', label: '操作日志', path: '/pages-sub/admin/system/operation-logs', icon: '/static/icons/fn-log.svg' },
      { code: 'system:permission', label: '报表权限', path: '/pages-sub/admin/report-permission/index', icon: '/static/icons/fn-permission.svg' },
      { code: 'system:more', label: '更多功能', path: '/pages-sub/admin/more/more-functions', icon: '/static/icons/fn-more.svg' },
    ],
  },
]

/** 功能中心展示用分组（剔除已放入「我的」页的 inProfile 项；空分组一并去掉） */
const homeGroups: FunctionGroup[] = functionMenu
  .map((g) => ({ ...g, items: g.items.filter((it) => !it.inProfile) }))
  .filter((g) => g.items.length > 0)

/** 高频宫格（首页「功能」tab 顶部）：只取 hot 项，最多若干 */
export const hotActions: FunctionItem[] = (() => {
  const hot: FunctionItem[] = []
  for (const g of homeGroups) {
    for (const it of g.items) if (it.hot) hot.push(it)
  }
  return hot.slice(0, 8)
})()

/** 数据 · 工具（带 sub 副标题的分类） */
export const dataTools: FunctionItem[] = (() => {
  const tools: FunctionItem[] = []
  for (const g of homeGroups) {
    for (const it of g.items) if (it.tool) tools.push(it)
  }
  return tools
})()

/** 全部功能（分组的完整列表，供「更多」页与搜索用） */
export const allGroups: FunctionGroup[] = homeGroups

/**
 * 按「允许的模块前缀」过滤注册表（角色过滤）。
 * 若 allowedModules 为空/未传 → 回退全量（避免误隐藏）。
 */
export function filterGroupsByModules(
  allowedModules: Set<string> | null | undefined,
  includeAdmin = true
): FunctionGroup[] {
  let base = allGroups
  if (allowedModules && allowedModules.size > 0) {
    base = allGroups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => allowedModules.has(it.code.split(':')[0])),
      }))
      .filter((g) => g.items.length > 0)
  }
  if (!includeAdmin) base = base.filter((g) => !g.admin)
  return base
}

/** 按模块前缀过滤单个条目列表（高频宫格/数据工具） */
export function filterItemsByModules(
  items: FunctionItem[],
  allowedModules: Set<string> | null | undefined
): FunctionItem[] {
  if (!allowedModules || allowedModules.size === 0) return items
  return items.filter((it) => allowedModules.has(it.code.split(':')[0]))
}

/** 搜索：按 label / sub 过滤所有分组项 */
export function searchFunctions(keyword: string): { groups: FunctionGroup[]; total: number } {
  const k = keyword.trim().toLowerCase()
  if (!k) return { groups: allGroups, total: countAll() }
  const groups: FunctionGroup[] = []
  for (const g of allGroups) {
    const items = g.items.filter(
      (it) => it.label.toLowerCase().includes(k) || (it.sub || '').toLowerCase().includes(k)
    )
    if (items.length) groups.push({ ...g, items })
  }
  return { groups, total: countItems(groups) }
}

function countAll(): number {
  let n = 0
  for (const g of allGroups) n += g.items.length
  return n
}

function countItems(groups: FunctionGroup[]): number {
  let n = 0
  for (const g of groups) n += g.items.length
  return n
}

export const DEFAULT_MENU_ICON = DEFAULT_ICON
