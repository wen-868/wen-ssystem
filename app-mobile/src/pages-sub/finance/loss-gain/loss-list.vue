<template>
  <view class="loss-list-page">
    <view class="page-header">
            <view class="header-back" @tap="goBack"><text class="header-back-icon">‹</text></view>
      <text class="header-title">报损管理</text>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/trash.svg" mode="aspectFit"/>
        <input class="search-input" v-model="keyword" placeholder="搜索单号/原因" @confirm="onSearch" />
        <image class="search-clear ic" v-if="keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
      </view>
      <view class="filter-btn" @tap="showFilter = !showFilter">
        <image class="filter-icon ic" src="/static/icons/ic/funnel.svg" mode="aspectFit"/>
      </view>
    </view>

    <!-- 筛选面板 -->
    <view class="filter-panel" v-if="showFilter">
      <view class="filter-row">
        <text class="filter-label">时间范围</text>
        <view class="filter-values">
          <picker mode="date" :value="startDate" @change="onStartDateChange">
            <view class="date-picker">
              <text>{{ startDate || '开始日期' }}</text>
            </view>
          </picker>
          <text class="date-sep">至</text>
          <picker mode="date" :value="endDate" @change="onEndDateChange">
            <view class="date-picker">
              <text>{{ endDate || '结束日期' }}</text>
            </view>
          </picker>
        </view>
      </view>
      <view class="filter-actions">
          <button class="filter-btn-reset" @tap="resetFilter">重置</button>
          <button class="filter-btn-confirm" @tap="onApplyFilter">确定</button>
        </view>
    </view>

    <!-- 状态Tab -->
    <scroll-view class="status-bar" scroll-x :show-scrollbar="false">
      <view class="status-item" :class="{ 'status-item--active': activeStatus === '' }" @tap="switchStatus('')">
        <text>全部</text>
      </view>
      <view class="status-item" :class="{ 'status-item--active': activeStatus === 'PENDING' }" @tap="switchStatus('PENDING')">
        <text>待审核</text>
      </view>
      <view class="status-item" :class="{ 'status-item--active': activeStatus === 'APPROVED' }" @tap="switchStatus('APPROVED')">
        <text>已通过</text>
      </view>
      <view class="status-item" :class="{ 'status-item--active': activeStatus === 'REJECTED' }" @tap="switchStatus('REJECTED')">
        <text>已驳回</text>
      </view>
    </scroll-view>

    <!-- 列表 -->
    <scroll-view class="order-scroll" scroll-y v-if="list.length > 0" @scrolltolower="onLoadMore">
      <view class="order-card" v-for="item in list" :key="item.id" @tap="goDetail(item.id)">
        <view class="card-header">
          <text class="order-no">{{ item.orderNo }}</text>
          <view class="status-tag" :class="getStatusClass(item.status)">
            <text class="status-tag-text">{{ getStatusText(item.status) }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="goods-info">
            <text class="goods-name" v-if="item.items && item.items.length > 0">
              {{ item.items[0].skuName }}
              <text v-if="item.items.length > 1" class="goods-more">等{{ item.items.length }}件商品</text>
            </text>
            <text class="goods-name" v-else>--</text>
          </view>
          <view class="info-row">
            <text class="info-label">报损数量</text>
            <text class="info-value">{{ item.totalQty }}件</text>
          </view>
          <view class="info-row">
            <text class="info-label">报损原因</text>
            <text class="info-value">{{ item.reasonText }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">报损金额</text>
            <text class="info-value info-value--danger">¥{{ item.totalAmount.toFixed(2) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">创建时间</text>
            <text class="info-value">{{ item.createdAt }}</text>
          </view>
        </view>
      </view>

      <view class="load-more" v-if="list.length > 0">
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>

    <view class="empty-state" v-else-if="!loading">
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无报损单</text>
    </view>

    <view class="fab-btn" @tap="goCreate">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, onMounted } from 'vue'
import { inventoryLossGainApi, type LossGainOrder } from '@/api/modules/inventory-loss-gain'

const loading = ref(false)
const loadingMore = ref(false)
const list = ref<LossGainOrder[]>([])
const activeStatus = ref('')
const keyword = ref('')
const showFilter = ref(false)
const startDate = ref('')
const endDate = ref('')
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回',
  }
  return map[status] ?? status
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'status-tag--pending', APPROVED: 'status-tag--approved',
    REJECTED: 'status-tag--rejected',
  }
  return map[status] ?? ''
}

function switchStatus(status: string) {
  activeStatus.value = status
  page.value = 1
  list.value = []
  noMore.value = false
  loadList()
}

function onSearch() {
  page.value = 1
  list.value = []
  noMore.value = false
  loadList()
}

function clearSearch() {
  keyword.value = ''
  page.value = 1
  list.value = []
  noMore.value = false
  loadList()
}

function onStartDateChange(e: any) {
  startDate.value = e.detail.value
}

function onEndDateChange(e: any) {
  endDate.value = e.detail.value
}

function resetFilter() {
  startDate.value = ''
  endDate.value = ''
}

function onApplyFilter() {
  showFilter.value = false
  page.value = 1
  list.value = []
  noMore.value = false
  loadList()
}

async function loadList() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await inventoryLossGainApi.list({
      page: page.value,
      pageSize,
      type: 'LOSS',
      status: activeStatus.value || undefined,
      keyword: keyword.value || undefined,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
    })
    list.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载报损单失败:', err)
  } finally {
    loading.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    page.value++
    const result = await inventoryLossGainApi.list({
      page: page.value, pageSize, type: 'LOSS',
      status: activeStatus.value || undefined,
      keyword: keyword.value || undefined,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
    })
    if (result.list.length === 0) {
      noMore.value = true
      page.value--
    } else {
      list.value = [...list.value, ...result.list]
    }
  } catch (err) {
    page.value--
    console.error('加载更多失败:', err)
  } finally {
    loadingMore.value = false
  }
}

function goCreate() {
  uni.navigateTo({ url: '/pages-sub/finance/loss-gain/create-loss' })
}

function goDetail(id: number) {
  // R94-03：详情接口按类型区分（loss-orders/profit-orders），列表已知 type=LOSS，随路由传递
  uni.navigateTo({ url: `/pages-sub/finance/loss-gain/loss-gain-detail?id=${id}&type=LOSS` })
}

onMounted(() => {
  loadList()
})
</script>

<style lang="scss" scoped>
.loss-list-page { min-height: 100vh; background: $uni-color-primary-soft; display: flex; flex-direction: column; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: $uni-bg-color; }
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }

.search-bar { display: flex; align-items: center; padding: 16rpx 24rpx; background: $uni-bg-color; gap: 16rpx; border-bottom: 1rpx solid $uni-gray-100; }
.search-input-wrap { flex: 1; display: flex; align-items: center; background: $uni-bg-color-page; border-radius: 32rpx; padding: 0 20rpx; height: 64rpx; }
.search-icon { font-size: 28rpx; color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 26rpx; }
.search-clear { font-size: 28rpx; color: $uni-gray-300; padding: 0 8rpx; }
.filter-btn { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; background: $uni-bg-color-page; border-radius: 50%; }
.filter-icon { font-size: 28rpx; color: $uni-gray-500; }

.filter-panel { background: $uni-bg-color; padding: 20rpx 24rpx; border-bottom: 1rpx solid $uni-gray-100; }
.filter-row { display: flex; align-items: center; margin-bottom: 20rpx; }
.filter-label { font-size: 26rpx; color: $uni-gray-500; width: 140rpx; flex-shrink: 0; }
.filter-values { flex: 1; display: flex; align-items: center; }
.date-picker { flex: 1; height: 64rpx; line-height: 64rpx; background: $uni-bg-color-page; border-radius: 12rpx; text-align: center; font-size: 26rpx; color: $uni-gray-700; }
.date-sep { margin: 0 16rpx; font-size: 26rpx; color: $uni-gray-400; }
.filter-actions { display: flex; gap: 16rpx; margin-top: 24rpx; }
.filter-btn-reset { flex: 1; height: 72rpx; line-height: 72rpx; border-radius: 36rpx; font-size: 28rpx; background: $uni-bg-color-page; color: $uni-gray-500; border: none; }
.filter-btn-confirm { flex: 1; height: 72rpx; line-height: 72rpx; border-radius: 36rpx; font-size: 28rpx; background: $uni-color-primary; color: $uni-text-color-inverse; border: none; }

.status-bar { background: $uni-bg-color; white-space: nowrap; padding: 12rpx 16rpx; border-bottom: 1rpx solid $uni-gray-100; }
.status-item { display: inline-flex; padding: 12rpx 28rpx; margin: 0 8rpx; border-radius: 32rpx; background: $uni-bg-color-page; font-size: 26rpx; color: $uni-gray-500; }
.status-item--active { background: $uni-color-primary; color: $uni-text-color-inverse; font-weight: 600; }

.order-scroll { flex: 1; padding: 16rpx 24rpx; }
.order-card { background: $uni-bg-color; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; padding-bottom: 16rpx; border-bottom: 1rpx solid $uni-gray-100; }
.order-no { font-size: 26rpx; color: $uni-gray-400; }
.status-tag { padding: 4rpx 16rpx; border-radius: 8rpx; }
.status-tag--pending { background: rgba(250,173,20,0.1); }
.status-tag--approved { background: rgba(82,196,26,0.1); }
.status-tag--rejected { background: rgba(255,77,79,0.1); }
.status-tag-text { font-size: 22rpx; }
.status-tag--pending .status-tag-text { color: $uni-color-warning; }
.status-tag--approved .status-tag-text { color: $uni-color-success; }
.status-tag--rejected .status-tag-text { color: $uni-color-error; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.goods-info { margin-bottom: 8rpx; }
.goods-name { font-size: 28rpx; font-weight: 600; color: $uni-gray-700; }
.goods-more { font-size: 24rpx; color: $uni-gray-400; font-weight: 400; margin-left: 8rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.info-value--danger { color: $uni-color-error; font-weight: 600; }
.load-more { text-align: center; padding: 24rpx 0; }
.load-more-text { font-size: 24rpx; color: $uni-gray-300; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 200rpx 0; }
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.fab-btn { position: fixed; right: 40rpx; bottom: calc(60rpx + env(safe-area-inset-bottom)); width: 100rpx; height: 100rpx; border-radius: 50%; background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary); display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(22,119,255,0.4); }
.fab-icon { font-size: 56rpx; color: $uni-text-color-inverse; font-weight: 300; }
.safe-bottom { height: 40rpx; }
</style>
