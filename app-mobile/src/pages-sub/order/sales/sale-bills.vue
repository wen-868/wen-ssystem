<template>
  <view class="sale-bills-page">
    <page-header title="销售单" @back="goBack" />

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索销售单号 / 客户名称"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
        </view>
      </view>
    </form>

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
      </view>
    </view>

    <view class="loading-overlay" v-if="loading && list.length === 0">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 虚拟滚动销售单列表 -->
    <virtual-list
      v-if="list.length > 0"
      class="bill-list"
      :data="list"
      :item-size="itemSize"
      :height="0"
      :buffer="5"
      item-key="billNo"
      :refresher-enabled="true"
      :refresher-triggered="refresherTriggered"
      @load-more="onLoadMore"
      @refresh="onPullDownRefresh"
    >
      <template #default="{ item }">
        <view class="bill-card" @tap="goDetail(item)">
          <view class="card-header">
            <text class="bill-no">{{ item.billNo }}</text>
            <view class="bill-status" :class="'status-' + item.status">
              <text class="status-text">{{ item.statusLabel }}</text>
            </view>
          </view>
          <view class="card-body">
            <view class="info-row">
              <text class="info-label">客户</text>
              <text class="info-value">{{ item.customerName }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">商品数</text>
              <text class="info-value">{{ item.itemCount }} 种</text>
            </view>
            <view class="info-row">
              <text class="info-label">总金额</text>
              <text class="info-value info-value--price">¥{{ item.totalAmount }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">支付方式</text>
              <text class="info-value">{{ item.paymentMethod || '—' }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">销售日期</text>
              <text class="info-value">{{ item.saleDate }}</text>
            </view>
          </view>
        </view>
      </template>
    </virtual-list>

    <!-- 空状态 -->
    <view class="empty-state" v-if="!loading && list.length === 0">
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无销售单</text>
    </view>

    <!-- 加载更多 -->
    <view class="load-more" v-if="list.length > 0">
      <view class="loading-more-spinner" v-if="loadingMore"></view>
      <text class="load-more-text" v-if="loadingMore">加载中...</text>
      <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import VirtualList from '@/components/virtual-list.vue'
import { salesApi } from '@/api/modules/sales'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const tabs = [
  { label: '全部', value: '' },
  { label: '未收款', value: 'UNPAID' },
  { label: '部分收款', value: 'PARTIAL' },
  { label: '已收款', value: 'PAID' },
  { label: '已逾期', value: 'OVERDUE' },
]
const activeTab = ref('')
const list = ref<any[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const refresherTriggered = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

/** 单行高度（px），onMounted 时按 rpx 转 px 计算 */
const itemSize = ref(280)

function onSearch() {
  page.value = 1
  noMore.value = false
  list.value = []
  loadBills()
}

function clearSearch() {
  searchForm.keyword = ''
  page.value = 1
  noMore.value = false
  list.value = []
  loadBills()
}

function switchTab(val: string) {
  if (activeTab.value === val) return
  activeTab.value = val
  page.value = 1
  noMore.value = false
  list.value = []
  loadBills()
}

function goDetail(item: any) {
  uni.navigateTo({ url: `/pages-sub/order/sales/sale-detail?billNo=${item.billNo}` })
}

async function loadBills() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await salesApi.list({
      keyword: searchForm.keyword || undefined,
      status: activeTab.value || undefined,
      page: page.value,
      pageSize,
    })
    const rows: any[] = result.list || []
    const mapped = rows.map((r) => ({
      billNo: r.billNo,
      customerName: r.customerName || '散客',
      itemCount: Number(r.itemCount ?? r.item_count ?? 0),
      totalAmount: Number(r.receivableAmount ?? r.receivable_amount ?? 0),
      paymentMethod: mapPaymentMethod(r.paymentMethod, r.collectionStatus),
      saleDate: formatDate(r.createdAt),
      status: (r.collectionStatus ?? '').toLowerCase(),
      statusLabel: mapStatusLabel(r.collectionStatus),
    }))
    if (page.value === 1) {
      list.value = mapped
    } else {
      list.value = [...list.value, ...mapped]
    }
    noMore.value = mapped.length < pageSize
  } catch (err) {
    console.error('加载销售单失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
    loadingMore.value = false
    refresherTriggered.value = false
  }
}

/** 收款状态 → 中文标签 */
function mapStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    UNPAID: '未收款',
    PENDING: '待支付',
    SHARED: '分享中',
    PARTIAL: '部分收款',
    PAID: '已收款',
    OVERDUE: '已逾期',
    CLOSED: '已关闭',
  }
  return map[status ?? ''] ?? status ?? ''
}

/** 支付渠道 → 中文展示（无成功支付记录时按收款状态展示） */
function mapPaymentMethod(channel?: string, collectionStatus?: string): string {
  const map: Record<string, string> = {
    WECHAT: '微信支付',
    ALIPAY: '支付宝',
    CASH: '现金',
    TRANSFER: '银行转账',
    OTHER_WECHAT: '微信转账',
    BALANCE: '余额',
    BOX: '收款盒子',
    UNIONPAY: '云闪付',
  }
  if (channel && map[channel]) return map[channel]
  if (channel) return channel
  return mapStatusLabel(collectionStatus)
}

/** 时间格式化：yyyy-MM-dd HH:mm */
function formatDate(value?: string | Date): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  const h = `${d.getHours()}`.padStart(2, '0')
  const min = `${d.getMinutes()}`.padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

function onLoadMore() {
  if (loadingMore.value || noMore.value || loading.value) return
  loadingMore.value = true
  page.value++
  loadBills()
}

function onPullDownRefresh() {
  refresherTriggered.value = true
  page.value = 1
  noMore.value = false
  list.value = []
  loadBills()
}

onMounted(() => {
  // rpx 转 px：280rpx 适配不同设备宽度
  try {
    itemSize.value = uni.upx2px(280)
  } catch (e) {
    itemSize.value = 140
  }
  loadBills()
})
</script>

<style lang="scss" scoped>
.sale-bills-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
  display: flex;
  flex-direction: column;
}
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
.tab-bar {
  display: flex; background: $uni-bg-color;
  padding: 0 16rpx 16rpx; gap: 8rpx;
}
.tab-item {
  flex: 1; height: 60rpx;
  display: flex; align-items: center; justify-content: center;
  background: $uni-bg-color-page; border-radius: 30rpx;
}
.tab-item--active { background: $uni-color-warning; }
.tab-item--active .tab-text { color: $uni-text-color-inverse; }
.tab-text { font-size: 22rpx; color: $uni-gray-500; }
.bill-list { padding: $uni-spacing-sm $uni-spacing-lg; }
.bill-card {
  background: $uni-bg-color; border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base; margin-bottom: $uni-spacing-md;
  box-shadow: $uni-shadow-card-sm;
  box-sizing: border-box;
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.bill-no { font-size: 26rpx; color: $uni-gray-700; font-weight: 600; }
.bill-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-unpaid { background: $uni-color-warning-soft; }
.status-unpaid .status-text { color: $uni-color-warning; }
.status-pending { background: $uni-color-warning-soft; }
.status-pending .status-text { color: $uni-color-warning; }
.status-shared { background: $uni-color-primary-soft; }
.status-shared .status-text { color: $uni-color-primary; }
.status-partial { background: $uni-color-primary-soft; }
.status-partial .status-text { color: $uni-color-primary; }
.status-paid { background: $uni-color-success-soft; }
.status-paid .status-text { color: $uni-color-success; }
.status-overdue { background: $uni-color-error-soft; }
.status-overdue .status-text { color: $uni-color-error; }
.status-closed { background: $uni-bg-color-page; }
.status-closed .status-text { color: $uni-gray-400; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.info-value--price { color: $uni-color-warning; font-weight: 600; }
.loading-overlay {
  display: flex; flex-direction: column;
  align-items: center; padding: 120rpx 0;
}
.loading-spinner {
  width: 48rpx; height: 48rpx;
  border: 4rpx solid $ai-border;
  border-top-color: $uni-color-warning;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: $uni-spacing-sm;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 26rpx; color: $uni-gray-400; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: $uni-spacing-md; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.load-more {
  display: flex; align-items: center; justify-content: center;
  padding: $uni-spacing-base 0; gap: $uni-spacing-sm;
}
.loading-more-spinner {
  width: 32rpx; height: 32rpx;
  border: 3rpx solid $ai-border;
  border-top-color: $uni-color-warning;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.load-more-text { font-size: 24rpx; color: $uni-gray-400; }
.safe-bottom { height: 40rpx; }
</style>
