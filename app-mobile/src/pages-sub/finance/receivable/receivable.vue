<template>
  <view class="receivable-page">
    <page-header title="应收应付" @back="goBack" />

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
            <text class="overdue-text">逾期：{{ formatMoney(getOverdueAmount(item) ?? 0) }}</text>
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
function goBack(){ uni.navigateBack() }

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

<style lang="scss" scoped>
.receivable-page { min-height: 100vh; background: $uni-color-primary-soft; display: flex; flex-direction: column; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: $uni-bg-color; }
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.tab-bar { display: flex; background: $uni-bg-color; border-bottom: 1rpx solid $uni-gray-100; }
.tab-item { flex: 1; text-align: center; padding: 24rpx 0; font-size: 26rpx; color: $uni-gray-500; position: relative; }
.tab-item--active { color: $uni-color-primary; font-weight: 600; }
.tab-item--active::after { content: ''; position: absolute; bottom: 0; left: 25%; right: 25%; height: 4rpx; background: $uni-color-primary; border-radius: 2rpx; }
.content-scroll { flex: 1; padding: $uni-spacing-sm $uni-spacing-lg; }
.summary-row { padding: $uni-spacing-xs 0 $uni-spacing-sm; }
.summary-card { background: linear-gradient(135deg, $uni-color-warning-soft, $uni-bg-color); border-radius: $uni-border-radius-xs; padding: $uni-spacing-base $uni-spacing-lg; box-shadow: $uni-shadow-card-sm; }
.summary-label { font-size: 24rpx; color: $uni-gray-400; display: block; margin-bottom: $uni-spacing-xs; }
.summary-value { font-size: 40rpx; font-weight: 700; }
.item-card { background: $uni-bg-color; border-radius: $uni-border-radius-xs; padding: $uni-spacing-base; margin-bottom: $uni-spacing-md; box-shadow: $uni-shadow-card-sm; }
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: $uni-spacing-sm; padding-bottom: $uni-spacing-sm; border-bottom: 1rpx solid $uni-gray-100; }
.party-name { font-size: 30rpx; font-weight: 600; color: $uni-gray-700; }
.party-phone { font-size: 24rpx; color: $uni-gray-400; }
.card-body { display: flex; flex-direction: column; gap: $uni-spacing-sm; }
.amount-row { display: flex; gap: $uni-spacing-sm; }
.amount-block { flex: 1; display: flex; flex-direction: column; align-items: center; }
.amount-label { font-size: 22rpx; color: $uni-gray-400; margin-bottom: 6rpx; }
.amount-value { font-size: 26rpx; font-weight: 600; color: $uni-gray-700; }
.text-danger { color: $uni-color-error; }
.text-success { color: $uni-color-success; }
.overdue-row { padding-top: $uni-spacing-xs; }
.overdue-text { font-size: 24rpx; color: $uni-color-error; }
.date-row { }
.date-text { font-size: 22rpx; color: $uni-gray-400; }
.aging-section { background: $uni-bg-color; border-radius: $uni-border-radius-xs; padding: $uni-spacing-base; margin-bottom: $uni-spacing-sm; box-shadow: $uni-shadow-card-sm; }
.aging-title { font-size: 30rpx; font-weight: 600; color: $uni-gray-700; display: block; margin-bottom: $uni-spacing-sm; }
.aging-card { padding: $uni-spacing-sm 0; border-bottom: 1rpx solid $uni-bg-color-grey; }
.aging-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: $uni-spacing-xs; }
.aging-range { font-size: 26rpx; color: $uni-gray-700; }
.aging-amount { font-size: 28rpx; font-weight: 600; color: $uni-color-primary; }
.aging-bar { height: 8rpx; background: $uni-gray-100; border-radius: 4rpx; overflow: hidden; margin: 8rpx 0; }
.aging-bar-fill { height: 100%; background: $uni-color-primary; border-radius: 4rpx; }
.aging-bar-fill--payable { background: $uni-color-warning; }
.aging-prop { font-size: 22rpx; color: $uni-gray-400; }
.load-more { text-align: center; padding: $uni-spacing-base 0; }
.load-more-text { font-size: 24rpx; color: $uni-gray-300; }
.empty-state { display: flex; justify-content: center; padding: 100rpx 0; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.safe-bottom { height: 40rpx; }
</style>
