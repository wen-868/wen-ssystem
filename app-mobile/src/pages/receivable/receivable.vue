<template>
  <view class="receivable-page">
    <view class="page-header">
      <text class="header-title">应收应付</text>
    </view>

    <view class="tab-bar">
      <view class="tab-item" :class="{ 'tab-item--active': activeTab === 'receivable' }" @tap="switchTab('receivable')">
        <text>应收(客户)</text>
      </view>
      <view class="tab-item" :class="{ 'tab-item--active': activeTab === 'payable' }" @tap="switchTab('payable')">
        <text>应付(供应商)</text>
      </view>
      <view class="tab-item" :class="{ 'tab-item--active': activeTab === 'aging' }" @tap="switchTab('aging')">
        <text>账龄分析</text>
      </view>
    </view>

    <scroll-view class="content-scroll" scroll-y v-if="activeTab !== 'aging'" @scrolltolower="onLoadMore">
      <view class="summary-row">
        <view class="summary-card">
          <text class="summary-label">未收/付总额</text>
          <text class="summary-value text-danger">{{ formatMoney(totalUnpaid) }}</text>
        </view>
      </view>

      <view class="item-card" v-for="item in currentList" :key="item.id">
        <view class="card-top">
          <text class="party-name">{{ getPartyName(item) }}</text>
          <text class="party-phone" v-if="getPartyPhone(item)">{{ getPartyPhone(item) }}</text>
        </view>
        <view class="card-body">
          <view class="amount-row">
            <view class="amount-block">
              <text class="amount-label">总额</text>
              <text class="amount-value">{{ formatMoney(getTotalAmount(item)) }}</text>
            </view>
            <view class="amount-block">
              <text class="amount-label">已收/付</text>
              <text class="amount-value text-success">{{ formatMoney(getPaidAmount(item)) }}</text>
            </view>
            <view class="amount-block">
              <text class="amount-label">未收/付</text>
              <text class="amount-value text-danger">{{ formatMoney(getUnpaidAmount(item)) }}</text>
            </view>
          </view>
          <view class="overdue-row" v-if="getOverdueAmount(item) != null">
            <text class="overdue-text">逾期：{{ formatMoney(getOverdueAmount(item)) }}</text>
          </view>
          <view class="date-row" v-if="getLastDate(item)">
            <text class="date-text">最后付款：{{ getLastDate(item) }}</text>
          </view>
        </view>
      </view>

      <view class="load-more" v-if="currentList.length > 0">
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>
      <view class="empty-state" v-else-if="!loading">
        <text class="empty-text">暂无数据</text>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>

    <scroll-view class="content-scroll" scroll-y v-if="activeTab === 'aging'">
      <view class="aging-section">
        <text class="aging-title">应收账龄</text>
        <view class="aging-card" v-for="(item, idx) in receivableAging" :key="'r' + idx">
          <view class="aging-row">
            <text class="aging-range">{{ item.range }}</text>
            <text class="aging-amount">{{ formatMoney(item.amount) }}</text>
          </view>
          <view class="aging-bar" v-if="item.proportion != null">
            <view class="aging-bar-fill" :style="{ width: item.proportion + '%' }"></view>
          </view>
          <text class="aging-prop" v-if="item.proportion != null">{{ item.proportion }}%</text>
        </view>
        <view class="empty-state" v-if="receivableAging.length === 0">
          <text class="empty-text">暂无应收数据</text>
        </view>
      </view>

      <view class="aging-section">
        <text class="aging-title">应付账龄</text>
        <view class="aging-card" v-for="(item, idx) in payableAging" :key="'p' + idx">
          <view class="aging-row">
            <text class="aging-range">{{ item.range }}</text>
            <text class="aging-amount">{{ formatMoney(item.amount) }}</text>
          </view>
          <view class="aging-bar" v-if="item.proportion != null">
            <view class="aging-bar-fill aging-bar-fill--payable" :style="{ width: item.proportion + '%' }"></view>
          </view>
          <text class="aging-prop" v-if="item.proportion != null">{{ item.proportion }}%</text>
        </view>
        <view class="empty-state" v-if="payableAging.length === 0">
          <text class="empty-text">暂无应付数据</text>
        </view>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { receivableApi, type ReceivableItem, type PayableItem, type AgingItem } from '@/api/modules/receivable'

const activeTab = ref('receivable')
const loading = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const page = ref(1)
const pageSize = 20

const receivableList = ref<ReceivableItem[]>([])
const payableList = ref<PayableItem[]>([])
const receivableAging = ref<AgingItem[]>([])
const payableAging = ref<AgingItem[]>([])

const currentList = computed(() => activeTab.value === 'receivable' ? receivableList.value : payableList.value)
const totalUnpaid = computed(() => currentList.value.reduce((sum, item) => sum + getUnpaidAmount(item), 0))

function formatMoney(val: number): string {
  return '¥' + (val || 0).toFixed(2)
}

function getPartyName(item: any): string {
  return item.customerName ?? item.supplierName ?? '--'
}
function getPartyPhone(item: any): string {
  return item.customerPhone ?? ''
}
function getTotalAmount(item: any): number {
  return item.totalAmount ?? 0
}
function getPaidAmount(item: any): number {
  return item.paidAmount ?? 0
}
function getUnpaidAmount(item: any): number {
  return item.unpaidAmount ?? 0
}
function getOverdueAmount(item: any): number | undefined {
  return item.overdueAmount
}
function getLastDate(item: any): string {
  return item.lastPaymentDate ?? ''
}

function switchTab(tab: string) {
  activeTab.value = tab
  page.value = 1
  noMore.value = false
  if (tab === 'receivable' && receivableList.value.length === 0) loadReceivables()
  if (tab === 'payable' && payableList.value.length === 0) loadPayables()
  if (tab === 'aging' && receivableAging.value.length === 0) loadAging()
}

async function loadReceivables() {
  loading.value = true
  try {
    const result = await receivableApi.listReceivables({ page: page.value, pageSize })
    receivableList.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载应收列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function loadPayables() {
  loading.value = true
  try {
    const result = await receivableApi.listPayables({ page: page.value, pageSize })
    payableList.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载应付列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function loadAging() {
  try {
    const [rAging, pAging] = await Promise.all([
      receivableApi.receivableAging(),
      receivableApi.payableAging(),
    ])
    receivableAging.value = rAging
    payableAging.value = pAging
  } catch (err) {
    console.error('加载账龄分析失败:', err)
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    page.value++
    if (activeTab.value === 'receivable') {
      const result = await receivableApi.listReceivables({ page: page.value, pageSize })
      if (result.list.length === 0) { noMore.value = true; page.value-- }
      else receivableList.value = [...receivableList.value, ...result.list]
    } else {
      const result = await receivableApi.listPayables({ page: page.value, pageSize })
      if (result.list.length === 0) { noMore.value = true; page.value-- }
      else payableList.value = [...payableList.value, ...result.list]
    }
  } catch (err) {
    page.value--
    console.error('加载更多失败:', err)
  } finally {
    loadingMore.value = false
  }
}

loadReceivables()
</script>

<style scoped>
.receivable-page { min-height: 100vh; background: #f0f5ff; display: flex; flex-direction: column; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: #fff; }
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.tab-bar { display: flex; background: #fff; border-bottom: 1rpx solid #f0f0f0; }
.tab-item { flex: 1; text-align: center; padding: 24rpx 0; font-size: 26rpx; color: #666; position: relative; }
.tab-item--active { color: #1677FF; font-weight: 600; }
.tab-item--active::after { content: ''; position: absolute; bottom: 0; left: 25%; right: 25%; height: 4rpx; background: #1677FF; border-radius: 2rpx; }
.content-scroll { flex: 1; padding: 16rpx 24rpx; }
.summary-row { padding: 8rpx 0 16rpx; }
.summary-card { background: linear-gradient(135deg, #fff4e6, #fff); border-radius: 16rpx; padding: 28rpx 32rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.summary-label { font-size: 24rpx; color: #999; display: block; margin-bottom: 8rpx; }
.summary-value { font-size: 40rpx; font-weight: 700; }
.item-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; padding-bottom: 12rpx; border-bottom: 1rpx solid #f0f0f0; }
.party-name { font-size: 30rpx; font-weight: 600; color: #333; }
.party-phone { font-size: 24rpx; color: #999; }
.card-body { display: flex; flex-direction: column; gap: 12rpx; }
.amount-row { display: flex; gap: 16rpx; }
.amount-block { flex: 1; display: flex; flex-direction: column; align-items: center; }
.amount-label { font-size: 22rpx; color: #999; margin-bottom: 6rpx; }
.amount-value { font-size: 26rpx; font-weight: 600; color: #333; }
.text-danger { color: #ff4d4f; }
.text-success { color: #52c41a; }
.overdue-row { padding-top: 8rpx; }
.overdue-text { font-size: 24rpx; color: #ff4d4f; }
.date-row { }
.date-text { font-size: 22rpx; color: #999; }
.aging-section { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.aging-title { font-size: 30rpx; font-weight: 600; color: #333; display: block; margin-bottom: 16rpx; }
.aging-card { padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.aging-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8rpx; }
.aging-range { font-size: 26rpx; color: #333; }
.aging-amount { font-size: 28rpx; font-weight: 600; color: #1677FF; }
.aging-bar { height: 8rpx; background: #f0f0f0; border-radius: 4rpx; overflow: hidden; margin: 8rpx 0; }
.aging-bar-fill { height: 100%; background: #1677FF; border-radius: 4rpx; }
.aging-bar-fill--payable { background: #faad14; }
.aging-prop { font-size: 22rpx; color: #999; }
.load-more { text-align: center; padding: 24rpx 0; }
.load-more-text { font-size: 24rpx; color: #bbb; }
.empty-state { display: flex; justify-content: center; padding: 100rpx 0; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }
</style>
