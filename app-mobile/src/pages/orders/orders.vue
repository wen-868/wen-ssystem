<template>
  <view class="orders-page">
    <!-- 页头（原稿 pg-hd：返回 + 标题 + 右侧筛选胶囊） -->
    <view class="pg-hd">
      <view class="hd-back" @tap="goBack">
        <image class="hd-back-img" src="/static/icons/ic/back.svg" mode="aspectFit" />
      </view>
      <text class="hd-title">订单管理</text>
      <view class="hd-filter" :class="{ 'hd-filter--active': filterOpen || activeFilterCount }" @tap="toggleFilter">
        <image class="hd-filter-ico" src="/static/icons/ic/funnel.svg" mode="aspectFit" />
        <text>筛选</text>
        <view class="hd-filter-badge" v-if="activeFilterCount">{{ activeFilterCount }}</view>
      </view>
    </view>

    <!-- 主段 tab（原稿 top-tabs：门店销售单据/即时零售单据/采购单据） -->
    <view class="top-tabs">
      <view
        class="top-tab"
        v-for="cat in cats"
        :key="cat.key"
        :class="{ 'top-tab--active': activeCat === cat.key }"
        @tap="switchCat(cat.key)"
      >{{ cat.name }}</view>
    </view>

    <!-- 子段 tab（原稿 sub-tabs：单据类型 / 即时零售平台） -->
    <view class="sub-tabs">
      <scroll-view class="sub-tabs-scroll" scroll-x :show-scrollbar="false">
        <view class="sub-tabs-inner">
          <view
            class="sub-tab"
            v-for="t in activeCatTypes"
            :key="t.key"
            :class="{ 'sub-tab--active': (activeCatDef.mode === 'channel' ? activeChannel : activeType) === t.key }"
            @tap="switchType(t.key)"
          >{{ t.name }}</view>
        </view>
      </scroll-view>
    </view>

    <!-- 搜索（原稿 search-bar） -->
    <view class="search-bar">
      <view class="search-inner">
        <image class="search-ico" src="/static/icons/ic/search.svg" mode="aspectFit" />
        <input
          class="search-input"
          :value="keyword"
          type="text"
          placeholder="搜索订单号 / 客户 / 商品"
          placeholder-class="search-ph"
          @input="onSearchInput"
        />
        <text class="search-clear" v-if="keyword" @tap="clearSearch">×</text>
      </view>
    </view>

    <!-- 筛选面板（原稿 filter-panel：可折叠，状态标签 + 属性） -->
    <view class="filter-panel" :class="{ 'filter-panel--open': filterOpen }">
      <view class="filter-panel-inner">
        <view class="fp-head">
          <text class="fp-title">筛选条件</text>
          <text class="fp-reset" @tap="resetFilter">重置</text>
        </view>
        <view class="fp-group">
          <text class="fp-label">订单状态</text>
          <view class="fp-tags fp-tags--row">
            <view
              class="tag-chip"
              v-for="tag in statusTags"
              :key="tag.key"
              :class="{ 'tag-chip--active': activeStatusTags.includes(tag.key) }"
              @tap="toggleStatus(tag.key)"
            ><text class="tag-dot"></text>{{ tag.txt }}</view>
          </view>
        </view>
        <view class="fp-group">
          <text class="fp-label">属性</text>
          <view class="fp-tags">
            <view
              class="tag-chip"
              v-for="tag in attrTags"
              :key="tag.key"
              :class="{ 'tag-chip--active': activeAttrTags.includes(tag.key) }"
              @tap="toggleAttr(tag.key)"
            >{{ tag.txt }}</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 列表（原稿：日期分节 list-section + order-card oc 结构） -->
    <scroll-view
      class="content-area"
      scroll-y
      @scrolltolower="onLoadMore"
      refresher-enabled
      :refresher-triggered="refresherTriggered"
      @refresherrefresh="onPullDownRefresh"
    >
      <template v-for="group in displayedGroups" :key="group.date">
        <view class="list-section">{{ group.date }} · 共 {{ group.items.length }} 笔</view>
        <view class="order-card" v-for="item in group.items" :key="item.billNo" @tap="onCardTap(item)">
          <view class="oc-top">
            <view class="oc-no-wrap">
              <text class="oc-no">{{ item.billNo }}</text>
              <text class="oc-type">{{ billShort(item.billType) }}</text>
            </view>
            <view class="oc-status" :class="statusBadgeClass(item.status)">
              <text class="oc-status-text">{{ statusText(item.status) }}</text>
            </view>
          </view>
          <view class="oc-mid">
            <view class="oc-chan" :class="chanClass(item)">
              <text class="oca-letter">{{ chanLetter(item) }}</text>
              <text>{{ chanText(item) }}</text>
            </view>
            <text class="oc-partner">{{ item.billType.indexOf('purchase') === 0 ? '供应商：' : '' }}{{ item.partyName || '—' }}</text>
          </view>
          <view class="oc-bot">
            <text class="oc-meta">{{ formatTime(item.createdAt) }}</text>
            <text class="oc-amount" :class="{ 'oc-amount--red': isRedAmount(item) }"><text class="cur">¥</text>{{ fmtAmount(item.amount) }}</text>
          </view>
          <view class="oc-actions" v-if="item.billType === 'sale_order'">
            <view class="oc-action" @tap.stop="goDetail(item.billNo)">
              <text class="oc-action-text">详情</text>
            </view>
            <view
              class="oc-action oc-action--primary"
              v-if="item.status === 'PENDING_PAYMENT' || item.status === 'UNPAID'"
              @tap.stop="confirmReceive(item)"
            >
              <text class="oc-action-text">确认收款</text>
            </view>
          </view>
        </view>
      </template>

      <view class="empty" v-if="displayedOrders.length === 0 && !loading">
        <image class="empty-img" src="/static/icons/od-empty.svg" mode="aspectFit" />
        <text class="empty-text">没有找到匹配的订单</text>
      </view>

      <view class="load-more" v-if="orderList.length > 0">
        <view class="loading-more-spinner" v-if="loadingMore"></view>
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>
    </scroll-view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ordersApi, billHistoryApi, storeSaleBillsApi, type BillHistoryItem } from '@/api/modules/orders'
import { instantRetailApi, type RetailOrder } from '@/api/modules/instant-retail'
import { saleReturnApi, purchaseReturnApi } from '@/api/modules/returns'
import { receiptApi } from '@/api/modules/receipts'
import { paymentNewApi } from '@/api/modules/finance'

/** 列表统一条目：历史单据 + 即时零售平台单 */
interface OrderListItem extends BillHistoryItem {
  /** 即时零售平台 jd/mt/ele（仅即时零售单据） */
  platform?: string
}

// ===== 三大分类与单据类型（原稿 top-tabs/sub-tabs；billType 对齐 bills/history 契约） =====
interface CatDef {
  key: string
  name: string
  /** doc=按单据类型细分；channel=按平台细分（即时零售） */
  mode: 'doc' | 'channel'
  /** doc 模式的类型项（key=bills/history 的 billType，仅列接口支持的类型，避免空壳） */
  types?: Array<{ key: string; name: string; short: string }>
  /** channel 模式的平台项 */
  channels?: Array<{ key: string; name: string }>
}

const cats: CatDef[] = [
  {
    key: 'store', name: '门店销售单据', mode: 'doc',
    types: [
      { key: 'sale_order', name: '销售订单', short: '订单' },
      { key: 'sale_bill', name: '销售单', short: '开单' },
      { key: 'sale_return', name: '销售退货', short: '退货' },
      { key: 'sale_receipt', name: '收款单', short: '收款' },
    ],
  },
  {
    key: 'instant', name: '即时零售单据', mode: 'channel',
    channels: [
      { key: 'jd', name: '京东秒送' },
      { key: 'mt', name: '美团' },
      { key: 'ele', name: '饿了么' },
    ],
  },
  {
    key: 'purchase', name: '采购单据', mode: 'doc',
    types: [
      { key: 'purchase_order', name: '采购订单', short: '采订' },
      { key: 'purchase_in_stock', name: '采购入库', short: '入库' },
      { key: 'purchase_return', name: '采购退货', short: '采退' },
      { key: 'purchase_payment', name: '付款单', short: '付款' },
    ],
  },
]

// 单据类型短名（原稿 DOC_TYPES.short，卡片 oc-type 用）
const BILL_SHORT: Record<string, string> = {
  sale_order: '订单',
  sale_bill: '开单',
  sale_return: '退货',
  sale_receipt: '收款',
  purchase_order: '采订',
  purchase_in_stock: '入库',
  purchase_return: '采退',
  purchase_payment: '付款',
  instant: '即时',
}

// 单据类型全名（原稿 DOC_TYPES.name，采购卡 oc-chan 显示单据全名）
const DOC_FULL: Record<string, string> = {
  sale_order: '销售订单',
  sale_bill: '销售单',
  sale_return: '销售退货',
  sale_receipt: '收款单',
  purchase_order: '采购订单',
  purchase_in_stock: '采购入库',
  purchase_return: '采购退货',
  purchase_payment: '付款单',
  instant: '即时零售',
}

// 即时零售平台名（原稿 CHANNELS jd/mt/ele）
const PLATFORM_NAME: Record<string, string> = {
  jd: '京东秒送',
  mt: '美团',
  ele: '饿了么',
}

// 状态维度（原稿 STATUS_TAGS 五格，keys 为真实后端状态，可多选 OR 匹配）
// 第五格按真实数据为「已完成」而非原稿的「已发货」（单据历史无 shipped 状态）
const statusTags = [
  { key: 'unpaid', keys: ['UNPAID', 'PENDING_PAYMENT'], txt: '待收款' },
  { key: 'paid', keys: ['PAID'], txt: '已收款' },
  { key: 'pending', keys: ['PENDING'], txt: '待确认' },
  { key: 'confirmed', keys: ['CONFIRMED', 'ACCEPTED', 'APPROVED'], txt: '已确认' },
  { key: 'completed', keys: ['COMPLETED'], txt: '已完成' },
]

// 属性维度（原稿 ATTR_TAGS：零售/批发/门店/小程序）
const attrTags = [
  { key: 'retail', txt: '零售' },
  { key: 'wholesale', txt: '批发' },
  { key: 'store', txt: '门店' },
  { key: 'mini', txt: '小程序' },
]

// ===== 状态 =====
const activeCat = ref('store')
const activeType = ref('')
const activeChannel = ref('')
const activeStatusTags = ref<string[]>([])
const activeAttrTags = ref<string[]>([])
const keyword = ref('')
const filterOpen = ref(false)
let filterLockUntil = 0
const orderList = ref<OrderListItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const refresherTriggered = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)
const navigating = ref(false)
const itemSize = ref(105)

const activeCatDef = computed(() => cats.find(c => c.key === activeCat.value)!)
const activeCatTypes = computed(() => {
  const cat = activeCatDef.value
  return cat.mode === 'channel'
    ? (cat.channels || []).map(c => ({ key: c.key, name: c.name }))
    : (cat.types || [])
})

// 筛选徽标数（原稿 renderTags：选中的标签数 = 状态 + 属性）
const activeFilterCount = computed(() => activeStatusTags.value.length + activeAttrTags.value.length)

let searchTimer: ReturnType<typeof setTimeout> | null = null

// 客户端筛选（状态多选 OR；属性 OR；原稿：状态组与属性组之间 AND）
const displayedOrders = computed<OrderListItem[]>(() => {
  let list = orderList.value
  const cat = activeCatDef.value
  if (cat.mode === 'doc') {
    const typeKeys = (cat.types || []).map(t => t.key)
    if (activeType.value) list = list.filter(o => o.billType === activeType.value)
    else list = list.filter(o => typeKeys.includes(o.billType))
  } else {
    // 即时零售：按平台细分（activeChannel 为空 = 全部）
    if (activeChannel.value) list = list.filter(o => o.platform === activeChannel.value)
    else list = list.filter(o => o.billType === 'instant')
  }
  if (activeStatusTags.value.length) {
    const statuses = new Set<string>()
    activeStatusTags.value.forEach(k => {
      const tag = statusTags.find(t => t.key === k)
      tag?.keys.forEach(s => statuses.add(s))
    })
    list = list.filter(o => statuses.has((o.status || '').toUpperCase()))
  }
  if (activeAttrTags.value.length) {
    list = list.filter(o => activeAttrTags.value.some(k => matchAttr(o, k)))
  }
  return list
})

// 日期分节（原稿 list-section：X月X日 · 共 N 笔）
const displayedGroups = computed(() => {
  const groups = new Map<string, BillHistoryItem[]>()
  displayedOrders.value.forEach(o => {
    const d = o.createdAt ? new Date(o.createdAt) : null
    const key = d ? (d.getMonth() + 1) + '月' + d.getDate() + '日' : '其他'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(o)
  })
  return Array.from(groups.entries()).map(([date, items]) => ({ date, items }))
})

function switchCat(key: string) {
  if (activeCat.value === key) return
  activeCat.value = key
  activeType.value = ''
  activeChannel.value = ''
  activeStatusTags.value = []
  activeAttrTags.value = []
  reload()
}

function switchType(key: string) {
  // 原稿 selectType：再次点击取消选择（回到该分类全部）
  if (activeCatDef.value.mode === 'doc') {
    activeType.value = activeType.value === key ? '' : key
    activeChannel.value = ''
  } else {
    activeChannel.value = activeChannel.value === key ? '' : key
    activeType.value = ''
  }
  reload()
}

function toggleFilter() {
  // 防双触发（部分环境 tap 事件会连续派发两次，导致面板开即关）
  const now = Date.now()
  if (now < filterLockUntil) return
  filterLockUntil = now + 300
  filterOpen.value = !filterOpen.value
}

function toggleStatus(key: string) {
  // 原稿 toggleTag：数组多选，再次点击取消
  activeStatusTags.value = activeStatusTags.value.includes(key)
    ? activeStatusTags.value.filter(k => k !== key)
    : [...activeStatusTags.value, key]
}

function toggleAttr(key: string) {
  activeAttrTags.value = activeAttrTags.value.includes(key)
    ? activeAttrTags.value.filter(k => k !== key)
    : [...activeAttrTags.value, key]
}

function resetFilter() {
  // 原稿 resetFilter：仅清空标签（状态 + 属性）；客户端筛选即时生效，无需重新请求
  activeStatusTags.value = []
  activeAttrTags.value = []
}

/** 属性匹配（原稿 matchAttr）。渠道由单据类型+客户类型真实推导：
 *  批发=采购单据 或 customer_type=WHOLESALE 的销售单；零售/批发销售单区分依赖 store 接口的 customerType。 */
function matchAttr(o: OrderListItem, key: string): boolean {
  if (key === 'wholesale') {
    if (o.billType.indexOf('purchase') === 0) return true
    return o.billType === 'sale_bill' && String(o.customerType || '').toUpperCase() === 'WHOLESALE'
  }
  if (key === 'store') return o.billType === 'sale_bill' || o.billType === 'sale_return' || o.billType === 'sale_receipt'
  if (key === 'mini') return o.billType === 'sale_order'
  return false
}

// ===== 数据加载（真实接口：doc 分类→/admin/bills/history；即时零售→/admin/instant-retail/orders） =====
/** 即时零售平台单 → 列表统一条目 */
function toOrderItem(r: RetailOrder): OrderListItem {
  return {
    billType: 'instant',
    billNo: r.orderNo,
    partyName: r.customerName || '',
    amount: r.totalAmount || 0,
    status: r.status,
    createdAt: r.createdAt,
    platform: String(r.platform || '').toLowerCase(),
  }
}

async function loadPage(pageNo: number): Promise<OrderListItem[]> {
  // 即时零售：按平台（京东秒送/美团/饿了么）细分
  if (activeCatDef.value.mode === 'channel') {
    const res = await instantRetailApi.listOrders({
      page: pageNo,
      pageSize,
      platform: activeChannel.value || undefined,
    })
    return res.list.map(toOrderItem)
  }

  // 门店销售 / 采购：按单据类型分流到各自真实接口
  // （bills/history 仅聚合 4 类主单据，退货/收款/付款单走各自独立接口）
  if (activeType.value) {
    return loadTypePage(activeType.value, pageNo)
  }

  // 全部（未选类型）：主聚合 + 当前分类下的退货/收款/付款单合并，按时间倒序
  const mainList = await billHistoryApi.list({
    keyword: keyword.value || undefined,
    page: pageNo,
    pageSize,
  })
  if (pageNo > 1) return mainList.list
  // 主聚合的销售单不含 customerType，用 store 接口按单号补齐（渠道来源区分零售/批发）
  if (mainList.list.some(i => i.billType === 'sale_bill')) {
    try {
      const sb = await storeSaleBillsApi.list({ page: 1, pageSize: 100, keyword: keyword.value || undefined })
      const ctMap = new Map(sb.list.map(i => [i.billNo, i.customerType]))
      mainList.list.forEach(i => {
        if (i.billType === 'sale_bill' && i.customerType == null) {
          i.customerType = ctMap.get(i.billNo) ?? null
        }
      })
    } catch { /* 补齐失败时按列默认 RETAIL 展示门店零售 */ }
  }
  const extraTypes = (activeCatDef.value.types || [])
    .map(t => t.key)
    .filter(k => !['sale_order', 'sale_bill', 'purchase_order', 'purchase_in_stock'].includes(k))
  if (extraTypes.length === 0) return mainList.list
  const extraRows = (await Promise.all(extraTypes.map(k => loadTypePage(k, 1)))).flat()
  return [...mainList.list, ...extraRows].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)))
}

/** 按单据类型加载（主单据走 bills/history，退货/收款/付款走各自独立接口） */
async function loadTypePage(type: string, pageNo: number): Promise<OrderListItem[]> {
  if (type === 'sale_return') {
    const res = await saleReturnApi.list({ page: pageNo, pageSize })
    return res.records.map((r: any): OrderListItem => ({
      billType: 'sale_return',
      billNo: r.return_no ?? '',
      partyName: r.customer_name ?? '',
      amount: Number(r.refund_amount ?? 0),
      status: r.return_status ?? '',
      createdAt: r.created_at ?? '',
    }))
  }
  if (type === 'sale_receipt') {
    const res: any = await receiptApi.getList({ page: pageNo, pageSize })
    const rows = res?.records ?? res?.list ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any): OrderListItem => ({
      billType: 'sale_receipt',
      billNo: r.receiptNo ?? '',
      partyName: r.customerName ?? '',
      amount: Number(r.amount ?? 0),
      status: r.status ?? '',
      createdAt: r.createdAt ?? '',
    }))
  }
  if (type === 'sale_bill') {
    // 销售单走 store 接口分流：比 bills/history 多返回 customerType，
    // 渠道来源才能真实区分 门店零售/门店批发（原稿 storeLabel 渠道维度）
    const res = await storeSaleBillsApi.list({ page: pageNo, pageSize, keyword: keyword.value || undefined })
    return res.list
  }
  if (type === 'purchase_return') {
    const res = await purchaseReturnApi.list({ page: pageNo, pageSize })
    return res.records.map((r: any): OrderListItem => ({
      billType: 'purchase_return',
      billNo: r.return_no ?? '',
      partyName: r.supplier_name ?? '',
      amount: Number(r.total_amount ?? 0),
      status: r.return_status ?? '',
      createdAt: r.created_at ?? '',
    }))
  }
  if (type === 'purchase_payment') {
    const res: any = await paymentNewApi.list({ page: pageNo, pageSize })
    const rows = res?.records ?? res?.list ?? (Array.isArray(res) ? res : [])
    return rows.map((r: any): OrderListItem => ({
      billType: 'purchase_payment',
      billNo: r.paymentNo ?? '',
      partyName: r.supplierName ?? '',
      amount: Number(r.amount ?? 0),
      status: r.status ?? '',
      createdAt: r.createdAt ?? '',
    }))
  }

  // 主单据（销售订单/销售单/采购订单/采购入库）
  const result = await billHistoryApi.list({
    keyword: keyword.value || undefined,
    billType: type,
    page: pageNo,
    pageSize,
  })
  return result.list
}

async function loadOrders() {
  if (loading.value) return
  loading.value = true
  try {
    const rows = await loadPage(page.value)
    if (page.value === 1) {
      orderList.value = rows
    } else {
      orderList.value = [...orderList.value, ...rows]
    }
    noMore.value = rows.length < pageSize
  } catch (err) {
    console.error('加载单据失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
    refresherTriggered.value = false
  }
}

function reload() {
  page.value = 1
  noMore.value = false
  orderList.value = []
  loadOrders()
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value || loading.value) return
  loadingMore.value = true
  try {
    page.value++
    const rows = await loadPage(page.value)
    if (rows.length === 0) {
      noMore.value = true
      page.value--
    } else {
      orderList.value = [...orderList.value, ...rows]
    }
  } catch (err) {
    page.value--
    console.error('加载更多失败:', err)
  } finally {
    loadingMore.value = false
  }
}

async function onPullDownRefresh() {
  refresherTriggered.value = true
  page.value = 1
  noMore.value = false
  await loadOrders()
}

// 搜索（300ms 防抖）
function onSearchInput(e: any) {
  keyword.value = e.detail.value || ''
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => reload(), 300)
}

function clearSearch() {
  keyword.value = ''
  reload()
}

// ===== 展示辅助 =====
function billShort(t: string): string {
  return BILL_SHORT[t] || t
}

/** oc-chan 文案（原稿：销售卡=渠道标签 门店/小程序；采购卡=单据全名；即时零售=平台名）。
 *  渠道由单据类型真实推导：t_sale_bill=门店开单、t_miniapp_order=小程序订单；
 *  退货/收款单同为门店侧单据（t_sale_return/t_receipt 均含 store 上下文）。 */
/** 单据类型+客户类型 → 渠道来源（真实渠道：门店零售/门店批发/小程序零售 + 即时零售平台） */
const CHANNEL_LABEL: Record<string, string> = {
  sale_bill: '门店零售',
  sale_order: '小程序零售',
  sale_return: '门店零售',
  sale_receipt: '门店零售',
}

function chanText(o: OrderListItem): string {
  if (o.platform) return PLATFORM_NAME[o.platform] || '即时零售'
  if (o.billType.indexOf('purchase') === 0) return DOC_FULL[o.billType] || o.billType
  // 销售单按客户类型区分 门店零售/门店批发（t_sale_bill.customer_type，列默认 RETAIL）
  if (o.billType === 'sale_bill') {
    return String(o.customerType || '').toUpperCase() === 'WHOLESALE' ? '门店批发' : '门店零售'
  }
  return CHANNEL_LABEL[o.billType] || DOC_FULL[o.billType] || '销售单'
}

function chanClass(o: OrderListItem): string {
  if (o.platform) return 'oc-chan--instant'
  if (o.billType.indexOf('purchase') === 0) return 'oc-chan--purchase'
  // 销售卡：门店橙色 / 小程序蓝色（原稿 CHANNELS store=$zx-amber-700、mini=$uni-color-primary）
  return o.billType === 'sale_order' ? 'oc-chan--mini' : 'oc-chan--store'
}

function chanLetter(o: OrderListItem): string {
  return chanText(o).charAt(0) || '单'
}

function statusText(status: string): string {
  const s = (status || '').toUpperCase()
  const map: Record<string, string> = {
    UNPAID: '待收款',
    PENDING_PAYMENT: '待收款',
    PAID: '已收款',
    PARTIAL: '部分收款',
    PENDING: '待确认',
    CONFIRMED: '已确认',
    APPROVED: '已确认',
    COMPLETED: '已完成',
    // 退货/收款/付款单状态（销售退货 REJECTED、收款单 VOIDED、采购退货 VOIDED 等）
    REJECTED: '已驳回',
    VOIDED: '已作废',
    // 即时零售平台状态（原稿 STATUS）
    ACCEPTED: '待配送',
    DELIVERING: '配送中',
    CANCELLED: '已取消',
    REFUNDING: '退款中',
  }
  return map[s] || status || '—'
}

function statusBadgeClass(status: string): string {
  const s = (status || '').toUpperCase()
  if (s === 'UNPAID' || s === 'PENDING_PAYMENT' || s === 'REFUNDING' || s === 'REJECTED') return 'oc-status--danger'
  if (s === 'PAID' || s === 'COMPLETED') return 'oc-status--paid'
  if (s === 'CONFIRMED') return 'oc-status--confirmed'
  return 'oc-status--pending'
}

/** 金额标红（原稿：o.status==='unpaid' || o.amount<0） */
function isRedAmount(o: OrderListItem): boolean {
  const s = (o.status || '').toUpperCase()
  return s === 'UNPAID' || s === 'PENDING_PAYMENT' || o.amount < 0
}

/** 金额千分位（原稿 fmt：¥ + 两位小数） */
function fmtAmount(n: number): string {
  return (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ===== 动作：点击卡片进详情（订单→订单详情；销售单→销售单详情；其余类型详情页陆续接入） =====
function onCardTap(item: BillHistoryItem) {
  if (item.billType === 'sale_order') {
    // 小程序订单：订单详情页（含确认收款/配送流转操作）
    goDetail(item.billNo)
    return
  }
  if (item.billType === 'sale_bill') {
    // 门店销售单：销售单详情页（真实详情接口 salesApi.detail）
    uni.navigateTo({ url: `/pages-sub/order/sales/sale-detail?billNo=${item.billNo}` })
    return
  }
  uni.showToast({ title: '该单据类型详情页即将开放', icon: 'none' })
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: '/pages/home/home' })
  }
}

function goDetail(orderNo: string) {
  if (navigating.value) return
  navigating.value = true
  uni.navigateTo({
    url: `/pages/orders/order-detail?orderNo=${orderNo}`,
    complete: () => { navigating.value = false },
  })
}

async function confirmReceive(item: BillHistoryItem) {
  try {
    uni.showLoading({ title: '处理中...' })
    await ordersApi.confirm(item.billNo)
    uni.hideLoading()
    uni.showToast({ title: '已确认收款', icon: 'success' })
    reload()
  } catch (err) {
    uni.hideLoading()
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

// 点击面板外收起筛选（原稿：composedPath 判断是否在面板内）
function onDocClickForFilter(e: any) {
  if (!filterOpen.value) return
  const path = e.composedPath ? e.composedPath() : []
  const inScope = path.some((el: any) => {
    const cls = el && el.classList
    return !!(cls && (cls.contains('filter-panel') || cls.contains('hd-filter')))
  })
  if (!inScope) filterOpen.value = false
}

onMounted(() => {
  try {
    itemSize.value = uni.upx2px(210)
  } catch (err) {
    itemSize.value = 105
  }
  loadOrders()
  // #ifdef H5
  // 点击面板以外区域自动收起筛选（原稿 document click）
  document.addEventListener('click', onDocClickForFilter)
  // #endif
})

// #ifdef H5
// 修复内存泄漏：订单页离开后点击任意处仍会执行该回调并操作已卸载组件的筛选状态
onUnmounted(() => {
  document.removeEventListener('click', onDocClickForFilter)
})
// #endif
</script>

<style lang="scss" scoped>
.orders-page {
  min-height: 100vh;
  background: $uni-bg-color-grey;
  display: flex;
  flex-direction: column;
}

/* 页头（原稿 pg-hd：88rpx 行高、左右 32rpx、白底带阴影、右侧筛选胶囊）
   sticky：H5 整文档滚动，sticky 保证标题栏不随列表滚出视口（与 page-header 组件一致） */
.pg-hd {
  display: flex;
  align-items: center;
  gap: 24rpx;
  height: calc(88rpx + var(--safe-top));
  padding: var(--safe-top) 32rpx 0;
  background: $uni-bg-color;
  box-shadow: 0 2rpx 8rpx $zx-black-40;
  position: sticky;
  top: 0;
  z-index: 5;
  flex-shrink: 0;
}

.hd-back {
  width: 88rpx;
  height: 88rpx;
  margin-left: -28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hd-back:active {
  transform: scale(0.88);
}

.hd-back-img {
  width: 44rpx;
  height: 44rpx;
}

.hd-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color;
  flex: 1;
  letter-spacing: -0.6rpx;
}

/* 筛选胶囊（原稿 hd-filter） */
.hd-filter {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 14rpx 26rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-gray-600;
  background: $uni-gray-50;
  border: 1rpx solid $uni-gray-100;
  transition: all 0.18s;
  flex-shrink: 0;
  position: relative;
}

.hd-filter:active {
  transform: scale(0.96);
}

.hd-filter--active {
  color: $uni-color-primary;
  background: $uni-color-primary-soft;
  border-color: $zx-primary-220;
}

.hd-filter-ico {
  width: 30rpx;
  height: 30rpx;
}

.hd-filter-badge {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 8rpx;
  border-radius: 16rpx;
  background: $uni-color-error;
  color: $ai-bg-page;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 30rpx;
  text-align: center;
  box-sizing: border-box;
}

/* 主段 tab（原稿 top-tabs） */
.top-tabs {
  display: flex;
  justify-content: center;
  gap: 12rpx;
  padding: 12rpx 24rpx;
  background: $uni-bg-color;
  border-bottom: 1rpx solid $zx-black-40;
  flex-shrink: 0;
}

.top-tab {
  flex: 1;
  max-width: 360rpx;
  padding: 12rpx 0;
  font-size: 28rpx;
  font-weight: 500;
  text-align: center;
  color: $uni-gray-400;
  border-radius: 24rpx;
  background: $uni-gray-50;
  border: 1rpx solid transparent;
  transition: all 0.2s;
}

.top-tab--active {
  color: $uni-text-color-inverse;
  font-weight: 700;
  background: $uni-color-primary;
  border-color: $uni-color-primary;
  box-shadow: 0 8rpx 24rpx $zx-primary-250;
}

/* 子段 tab（原稿 sub-tabs） */
.sub-tabs {
  background: $uni-bg-color;
  border-bottom: 1rpx solid $zx-black-50;
  flex-shrink: 0;
}

.sub-tabs-scroll {
  white-space: nowrap;
}

.sub-tabs-inner {
  display: flex;
  gap: 16rpx;
  padding: 12rpx 24rpx;
}

.sub-tab {
  flex: 1;
  min-width: 0;
  padding: 12rpx 16rpx;
  font-size: 24rpx;
  font-weight: 400;
  color: $uni-gray-500;
  text-align: center;
  white-space: nowrap;
  border-radius: 24rpx;
  background: $uni-gray-50;
  border: 1rpx solid transparent;
  transition: all 0.2s;
}

.sub-tab--active {
  color: $uni-color-primary;
  font-weight: 600;
  background: $uni-color-primary-soft;
  border-color: $zx-primary-150;
}

/* 搜索（原稿 search-bar） */
.search-bar {
  padding: 20rpx 32rpx 8rpx;
  background: $uni-bg-color;
  flex-shrink: 0;
}

.search-inner {
  display: flex;
  align-items: center;
  gap: 16rpx;
  height: 76rpx;
  background: $uni-gray-50;
  border-radius: 999rpx;
  padding: 0 28rpx;
}

.search-ico {
  width: 34rpx;
  height: 34rpx;
  flex-shrink: 0;
  opacity: 0.5;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: $uni-text-color;
  background: transparent;
}

.search-ph {
  color: $uni-gray-400;
}

.search-clear {
  color: $uni-gray-400;
  font-size: 36rpx;
  line-height: 1;
  padding: 0 8rpx;
}

/* 筛选面板（原稿 filter-panel：max-height 折叠动画） */
.filter-panel {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  background: $uni-bg-color;
  transition: max-height 0.3s ease, opacity 0.22s ease;
  flex-shrink: 0;
}

.filter-panel--open {
  max-height: 640rpx;
  opacity: 1;
  box-shadow: 0 12rpx 28rpx $zx-black-50;
}

.filter-panel-inner {
  padding: 28rpx 32rpx 32rpx;
  border-bottom: 1rpx solid $zx-black-50;
}

.fp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.fp-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $uni-text-color;
}

.fp-reset {
  font-size: 26rpx;
  color: $uni-color-primary;
  font-weight: 600;
  padding: 8rpx 4rpx;
}

.fp-reset:active {
  opacity: 0.6;
}

.fp-group {
  margin-bottom: 24rpx;
}

.fp-group:last-of-type {
  margin-bottom: 0;
}

.fp-label {
  display: block;
  font-size: 22rpx;
  color: $uni-gray-400;
  font-weight: 600;
  letter-spacing: 1rpx;
  margin-bottom: 16rpx;
}

.fp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.tag-chip {
  padding: 16rpx 30rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: $uni-gray-500;
  background: $uni-gray-50;
  border: 1rpx solid $uni-gray-100;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;
}

/* 状态五格一行均分（不换行，等宽缩排） */
.fp-tags--row {
  flex-wrap: nowrap;
}

.fp-tags--row .tag-chip {
  flex: 1;
  min-width: 0;
  padding: 16rpx 0;
  text-align: center;
  font-size: 24rpx;
}

.tag-chip--active {
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
  font-weight: 700;
  border-color: $zx-primary-220;
  box-shadow: 0 4rpx 12rpx $uni-color-info-soft;
}

/* 状态标签前置圆点（原稿 tag-dot） */
.tag-dot {
  display: inline-block;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: $uni-gray-400;
  margin-right: 12rpx;
  vertical-align: middle;
}

.tag-chip--active .tag-dot {
  background: $uni-color-primary;
}

/* 列表（原稿 content-inner + order-card） */
.content-area {
  flex: 1;
  min-height: 0;
  padding: 8rpx 32rpx 48rpx;
  box-sizing: border-box;
}

.order-card {
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 8rpx $zx-black-60, 0 2rpx 6rpx $zx-black-40;
  transition: transform 0.12s;
}

.order-card:active {
  transform: scale(0.985);
}

.oc-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.oc-no-wrap {
  display: flex;
  align-items: baseline;
  min-width: 0;
}

.oc-no {
  font-size: 26rpx;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-text-color;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oc-type {
  font-size: 22rpx;
  color: $uni-gray-400;
  font-weight: 500;
  margin-left: 12rpx;
  flex-shrink: 0;
}

.oc-status {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
  flex-shrink: 0;
}

.oc-status--paid {
  background: $zx-badge-success-bg;
}

.oc-status--paid .oc-status-text {
  color: $zx-badge-success-strong;
}

.oc-status--pending {
  background: $zx-badge-warning-bg;
}

.oc-status--pending .oc-status-text {
  color: $zx-badge-warning-strong;
}

.oc-status--confirmed {
  background: $uni-color-primary-soft;
}

.oc-status--confirmed .oc-status-text {
  color: $uni-color-primary;
}

.oc-status--danger {
  background: $zx-badge-danger-bg;
}

.oc-status--danger .oc-status-text {
  color: $zx-badge-danger-strong;
}

.oc-mid {
  margin-bottom: 20rpx;
}

.oc-partner {
  font-size: 26rpx;
  color: $uni-text-color;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 日期分节标题（原稿 list-section） */
.list-section {
  font-size: 24rpx;
  color: $uni-gray-400;
  font-weight: 600;
  margin: 28rpx 8rpx 16rpx;
  letter-spacing: 1rpx;
}

/* 渠道/类型胶囊（原稿 oc-chan：彩色小方块 + 文案） */
.oc-chan {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  font-size: 24rpx;
  color: $uni-text-color-secondary;
  background: $uni-gray-50;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
}

.oca-letter {
  width: 28rpx;
  height: 28rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $ai-bg-page;
  font-size: 18rpx;
  font-weight: 700;
  line-height: 1;
}

.oc-chan--store .oca-letter {
  background: $zx-badge-warning-strong;
}

.oc-chan--mini .oca-letter {
  background: $ai-primary;
}

.oc-chan--purchase .oca-letter {
  background: $zx-green-600;
}

.oc-chan--instant .oca-letter {
  background: $zx-store;
}

.oc-bot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.oc-meta {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.oc-amount {
  font-size: 34rpx;
  font-weight: 800;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: $uni-text-color;
}

.oc-amount .cur {
  font-size: 24rpx;
  font-weight: 600;
  margin-right: 2rpx;
}

.oc-amount--red {
  color: $zx-badge-danger-strong;
}

.oc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  padding-top: 20rpx;
  margin-top: 20rpx;
  border-top: 1rpx solid $uni-gray-100;
}

.oc-action {
  padding: 12rpx 32rpx;
  border-radius: 999rpx;
  border: 1rpx solid $uni-border-color;
}

.oc-action:active {
  background: $uni-gray-50;
}

.oc-action-text {
  font-size: 24rpx;
  color: $uni-gray-600;
}

.oc-action--primary {
  background: $uni-gradient-blue;
  border-color: $uni-color-primary;
}

.oc-action--primary .oc-action-text {
  color: $ai-bg-page;
  font-weight: 600;
}

/* 空态 / 加载 */
.empty {
  text-align: center;
  padding: 120rpx 40rpx;
}

.empty-img {
  width: 128rpx;
  height: 128rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 26rpx;
  color: $uni-gray-400;
}

.load-more {
  text-align: center;
  padding: 24rpx 0;
}

.loading-more-spinner {
  width: 32rpx;
  height: 32rpx;
  margin: 0 auto 8rpx;
  border: 3rpx solid $uni-gray-100;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.load-more-text {
  font-size: 22rpx;
  color: $uni-gray-300;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.safe-bottom {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
