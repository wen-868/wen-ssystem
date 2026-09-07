<template>
  <view class="instant-retail-page">
    <page-header title="即时零售订单" @back="goBack" />

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索订单号 / 收件人 / 手机号"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
        </view>
      </view>
    </form>

    <!-- 平台筛选 -->
    <view class="platform-bar">
      <view
        v-for="plat in platforms"
        :key="plat.value"
        class="platform-item"
        :class="{ 'platform-item--active': activePlatform === plat.value }"
        @tap="switchPlatform(plat.value)"
      >
        <text class="platform-text">{{ plat.label }}</text>
      </view>
    </view>

    <!-- 状态筛选 -->
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ 'tab-item--active': activeTab === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
        <text class="tab-count" v-if="tab.count > 0">{{ tab.count }}</text>
      </view>
    </view>

    <!-- 订单列表 -->
    <scroll-view class="order-list" scroll-y v-if="filteredList.length > 0">
      <view class="order-card" v-for="item in filteredList" :key="item.orderNo || item.id">
        <view class="card-header">
          <view class="platform-tag" :class="'plat--' + platformClass(item.platform)">
            <text class="plat-text">{{ item.platformText || item.platform }}</text>
          </view>
          <text class="order-status" :class="'status--' + statusClass(item.status)">{{ item.statusText || statusLabel(item.status) }}</text>
        </view>
        <view class="card-body">
          <view class="order-no-row">
            <text class="order-no">订单号：{{ item.orderNo }}</text>
            <text class="order-time">{{ formatDate(item.createdAt) }}</text>
          </view>
          <view class="goods-list" v-if="item.items && item.items.length">
            <view class="goods-item" v-for="(goods, gIdx) in item.items" :key="gIdx">
              <image class="goods-img" v-if="(goods as any).image" :src="(goods as any).image" mode="aspectFill" />
              <view class="goods-img goods-img--placeholder" v-else><text class="goods-img-text">酒</text></view>
              <view class="goods-info">
                <text class="goods-name">{{ goods.name }}</text>
              </view>
              <view class="goods-price-wrap">
                <text class="goods-price">¥{{ goods.price }}</text>
                <text class="goods-qty">x{{ goods.qty }}</text>
              </view>
            </view>
          </view>
          <view class="order-summary">
            <text class="summary-text">共{{ totalQty(item) }}件商品</text>
            <text class="summary-total">实付 <text class="total-price">¥{{ Number(item.totalAmount || 0).toFixed(2) }}</text></text>
          </view>
        </view>
        <view class="card-footer" v-if="item.customerName || item.customerPhone || item.address">
          <text class="delivery-info" v-if="item.customerName || item.customerPhone">
            <image class="delivery-icon ic" src="/static/icons/ic/truck.svg" mode="aspectFit"/>
            {{ item.customerName }} {{ item.customerPhone }}
          </text>
          <text class="delivery-address" v-if="item.address">{{ item.address }}</text>
        </view>
        <view class="card-actions">
          <button class="action-btn outline-btn" @tap="viewDetail(item)">订单详情</button>
          <button class="action-btn primary-btn" v-if="canAccept(item)" @tap="acceptOrder(item)">接单</button>
          <button class="action-btn primary-btn" v-if="canShip(item)" @tap="shipOrder(item)">发货</button>
          <button class="action-btn danger-btn" v-if="canAccept(item)" @tap="rejectOrder(item)">拒单</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else-if="!loading">
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">{{ loadError || '暂无订单' }}</text>
      <button class="empty-retry" v-if="loadError" @tap="loadOrders">点击重试</button>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, computed, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { instantRetailApi, type RetailOrder } from '@/api/modules/instant-retail'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const platforms = [
  { label: '全部', value: '' },
  { label: '美团', value: 'meituan' },
  { label: '饿了么', value: 'eleme' },
  { label: '抖音', value: 'douyin' },
]
const activePlatform = ref('')

const tabs = [
  { label: '全部', value: '', count: 0 },
  { label: '待接单', value: 'pending', count: 0 },
  { label: '待发货', value: 'accepted', count: 0 },
  { label: '配送中', value: 'shipping', count: 0 },
  { label: '已完成', value: 'completed', count: 0 },
]
const activeTab = ref('')
const list = ref<RetailOrder[]>([])
const loading = ref(false)
const loadError = ref('')

const PLATFORM_ALIASES: Record<string, string> = {
  meituan: 'meituan', mt: 'meituan', eleme: 'eleme', 'ele.ma': 'eleme', elm: 'eleme', douyin: 'douyin', dy: 'douyin',
}

/** 订单状态归一化（各平台原始状态 → 本页 5 个 tab 语义） */
function statusBucket(status?: string): string {
  const s = String(status ?? '').toUpperCase()
  if (!s) return ''
  if (s.includes('PENDING') || s.includes('CREATED') || s.includes('NEW') || s.includes('PAID')) return 'pending'
  if (s.includes('ACCEPT') || s.includes('CONFIRM') || s.includes('PREPARE') || s.includes('WAIT')) return 'accepted'
  if (s.includes('SHIP') || s.includes('DELIVER') || s.includes('DELIVERY') || s.includes('RIDING') || s.includes('TRANSIT')) return 'shipping'
  if (s.includes('COMPLETE') || s.includes('FINISH') || s.includes('DONE') || s.includes('RECEIVED')) return 'completed'
  if (s.includes('CANCEL') || s.includes('REFUND') || s.includes('CLOSE')) return 'cancelled'
  return 'other'
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待接单', accepted: '待发货', shipping: '配送中',
  completed: '已完成', cancelled: '已取消', other: '—',
}

const filteredList = computed(() => {
  const kw = searchForm.keyword.trim().toLowerCase()
  return list.value.filter((o) => {
    if (activePlatform.value && PLATFORM_ALIASES[String(o.platform ?? '').toLowerCase()] !== activePlatform.value) return false
    if (activeTab.value && statusBucket(o.status) !== activeTab.value) return false
    if (kw) {
      const hay = `${o.orderNo} ${o.customerName ?? ''} ${o.customerPhone ?? ''}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
})

function refreshCounts() {
  for (const tab of tabs) {
    tab.count = tab.value === ''
      ? list.value.length
      : list.value.filter((o) => statusBucket(o.status) === tab.value).length
  }
}

function platformClass(platform?: string): string {
  return PLATFORM_ALIASES[String(platform ?? '').toLowerCase()] ?? 'other'
}
function statusClass(status?: string): string {
  return statusBucket(status) || 'other'
}
function statusLabel(status?: string): string {
  return STATUS_LABELS[statusBucket(status)] ?? '—'
}
function formatDate(date?: string): string {
  if (!date) return '—'
  return String(date).replace('T', ' ').slice(0, 16)
}
function totalQty(item: RetailOrder): number {
  return (item.items ?? []).reduce((sum, it) => sum + Number(it.qty ?? 0), 0)
}
function canAccept(item: RetailOrder): boolean {
  return statusBucket(item.status) === 'pending'
}
function canShip(item: RetailOrder): boolean {
  return statusBucket(item.status) === 'accepted'
}

function onSearch() { loadOrders() }
function clearSearch() { searchForm.keyword = ''; loadOrders() }
function switchPlatform(val: string) { activePlatform.value = val; refreshCounts() }
function switchTab(val: string) { activeTab.value = val; refreshCounts() }

function viewDetail(item: RetailOrder) {
  const lines = [
    `订单号：${item.orderNo}`,
    `平台：${item.platformText || item.platform}`,
    `金额：¥${Number(item.totalAmount || 0).toFixed(2)}`,
    `收件人：${item.customerName || '—'} ${item.customerPhone || ''}`,
    `地址：${item.address || '—'}`,
    item.remark ? `备注：${item.remark}` : '',
  ].filter(Boolean).join('\n')
  uni.showModal({ title: '订单详情', content: lines, showCancel: false })
}

function acceptOrder(item: RetailOrder) {
  uni.showModal({
    title: '确认接单',
    content: `确认接收订单 ${item.orderNo}？`,
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '提交中...' })
      try {
        await instantRetailApi.confirmOrder(item.orderNo)
        uni.hideLoading()
        uni.showToast({ title: '已接单', icon: 'success' })
        await loadOrders()
      } catch (err: any) {
        uni.hideLoading()
        uni.showToast({ title: err?.message || '接单失败', icon: 'none' })
      }
    }
  })
}

function rejectOrder(item: RetailOrder) {
  uni.showModal({
    title: '拒单',
    content: `确认拒绝订单 ${item.orderNo}？请填写拒单原因`,
    editable: true,
    placeholderText: '请输入拒单原因',
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '提交中...' })
      try {
        await instantRetailApi.cancelOrder(item.orderNo, (res.content || '').trim() || '商家拒单')
        uni.hideLoading()
        uni.showToast({ title: '已拒单', icon: 'none' })
        await loadOrders()
      } catch (err: any) {
        uni.hideLoading()
        uni.showToast({ title: err?.message || '拒单失败', icon: 'none' })
      }
    }
  })
}

function shipOrder(item: RetailOrder) {
  uni.showModal({
    title: '确认发货',
    content: '确认商品已出库配送？',
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '提交中...' })
      try {
        await instantRetailApi.updateOrderStatus(item.orderNo, 'SHIPPING')
        uni.hideLoading()
        uni.showToast({ title: '已发货', icon: 'success' })
        await loadOrders()
      } catch (err: any) {
        uni.hideLoading()
        uni.showToast({ title: err?.message || '发货失败', icon: 'none' })
      }
    }
  })
}

async function loadOrders() {
  loading.value = true
  loadError.value = ''
  try {
    const { list: rows } = await instantRetailApi.listOrders({ page: 1, pageSize: 100 })
    list.value = rows
    refreshCounts()
  } catch (err: any) {
    console.error('加载即时零售订单失败:', err)
    loadError.value = '加载失败，请检查网络后重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadOrders() })
</script>

<style lang="scss" scoped>
.instant-retail-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + var(--safe-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.search-bar { padding: 16rpx 24rpx; background: $uni-bg-color; }
.search-input-wrap {
  display: flex; align-items: center;
  height: 72rpx; background: $uni-bg-color-page;
  border-radius: 36rpx; padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.search-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: $uni-gray-300; padding: 4rpx; }
.platform-bar {
  display: flex; background: $uni-bg-color;
  padding: 0 16rpx 16rpx; gap: 8rpx;
}
.platform-item {
  height: 56rpx; padding: 0 $uni-spacing-base;
  display: flex; align-items: center; justify-content: center;
  background: $uni-bg-color-page; border-radius: 28rpx;
}
.platform-item--active { background: $uni-color-primary-soft; }
.platform-item--active .platform-text { color: $uni-color-primary; font-weight: 600; }
.platform-text { font-size: 22rpx; color: $uni-gray-500; }
.tab-bar {
  display: flex; background: $uni-bg-color;
  padding: 0 8rpx 16rpx; gap: 4rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.tab-item {
  flex: 1; height: 60rpx;
  display: flex; align-items: center; justify-content: center;
  gap: 6rpx; position: relative;
}
.tab-item--active .tab-text { color: $uni-color-primary; font-weight: 600; }
.tab-text { font-size: 24rpx; color: $uni-gray-500; }
.tab-count {
  min-width: 32rpx; height: 32rpx;
  background: $uni-color-error; color: $uni-text-color-inverse;
  border-radius: 16rpx; font-size: 20rpx;
  display: flex; align-items: center; justify-content: center;
  padding: 0 8rpx;
}
.order-list { padding: $uni-spacing-sm $uni-spacing-lg $uni-spacing-base; }
.order-card {
  background: $uni-bg-color; border-radius: $uni-border-radius-xs;
  margin-bottom: $uni-spacing-md; overflow: hidden;
  box-shadow: $uni-shadow-card-sm;
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20rpx 24rpx;
  background: $uni-gray-50;
}
.platform-tag { padding: 4rpx 16rpx; border-radius: 16rpx; }
.plat--meituan { background: $uni-color-error-soft; }
.plat--meituan .plat-text { color: $uni-color-error; }
.plat--eleme { background: $uni-color-primary-soft; }
.plat--eleme .plat-text { color: $uni-color-primary; }
.plat--douyin { background: $uni-color-purple-soft; }
.plat--douyin .plat-text { color: $uni-color-purple; }
.plat--other { background: $uni-bg-color-grey; }
.plat--other .plat-text { color: $uni-gray-500; }
.plat-text { font-size: 20rpx; font-weight: 600; }
.order-status { font-size: 24rpx; font-weight: 600; }
.status--pending { color: $uni-color-warning; }
.status--accepted { color: $uni-color-primary; }
.status--shipping { color: $uni-color-success; }
.status--completed { color: $uni-gray-400; }
.status--cancelled, .status--other { color: $uni-gray-400; }
.card-body { padding: $uni-spacing-md $uni-spacing-base; }
.order-no-row {
  display: flex; justify-content: space-between;
  margin-bottom: $uni-spacing-sm;
}
.order-no { font-size: 24rpx; color: $uni-gray-500; }
.order-time { font-size: 22rpx; color: $uni-gray-400; }
.goods-list { display: flex; flex-direction: column; gap: $uni-spacing-sm; }
.goods-item { display: flex; align-items: center; gap: $uni-spacing-sm; }
.goods-img {
  width: 80rpx; height: 80rpx;
  border-radius: 8rpx; background: $uni-bg-color-grey;
}
.goods-img--placeholder {
  display: flex; align-items: center; justify-content: center;
}
.goods-img-text { font-size: 32rpx; color: $uni-gray-300; }
.goods-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.goods-name { font-size: 26rpx; color: $uni-gray-700; line-height: 1.3; }
.goods-price-wrap {
  display: flex; flex-direction: column;
  align-items: flex-end; gap: 4rpx;
}
.goods-price { font-size: 26rpx; color: $uni-gray-700; font-weight: 600; }
.goods-qty { font-size: 22rpx; color: $uni-gray-400; }
.order-summary {
  display: flex; justify-content: space-between;
  align-items: center;
  margin-top: $uni-spacing-sm; padding-top: $uni-spacing-sm;
  border-top: 1rpx dashed $uni-gray-100;
}
.summary-text { font-size: 24rpx; color: $uni-gray-400; }
.summary-total { font-size: 24rpx; color: $uni-gray-500; }
.total-price { font-size: 30rpx; color: $uni-color-error; font-weight: 700; }
.card-footer {
  padding: $uni-spacing-sm $uni-spacing-base;
  background: $uni-gray-50;
  display: flex; flex-direction: column;
  gap: $uni-spacing-xs;
}
.delivery-info {
  font-size: 24rpx; color: $uni-gray-700;
  display: flex; align-items: center; gap: $uni-spacing-xs;
}
.delivery-icon { font-size: 24rpx; color: $uni-color-primary; }
.delivery-address { font-size: 22rpx; color: $uni-gray-400; line-height: 1.4; }
.card-actions {
  padding: $uni-spacing-sm $uni-spacing-base;
  display: flex; justify-content: flex-end; gap: $uni-spacing-sm;
  border-top: 1rpx solid $uni-gray-100;
}
.action-btn {
  height: 60rpx; padding: 0 28rpx;
  border-radius: 30rpx; font-size: 24rpx;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.outline-btn { background: $uni-bg-color-grey; color: $uni-gray-500; }
.primary-btn { background: $uni-color-primary; color: $uni-text-color-inverse; }
.danger-btn { background: $uni-color-error-soft; color: $uni-color-error; }
.action-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: $uni-spacing-md; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.empty-retry {
  margin-top: $uni-spacing-md; padding: 0 $uni-spacing-lg; height: 64rpx; line-height: 64rpx;
  border-radius: 32rpx; font-size: 26rpx;
  background: $uni-bg-color; color: $uni-color-primary;
  border: 1rpx solid $uni-color-primary;
}
.empty-retry::after { border: none; }
.safe-bottom { height: 40rpx; }
</style>
