<template>
  <view class="gain-list-page">
    <view class="page-header">
      <text class="header-title">报溢管理</text>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe623;</text>
        <input class="search-input" v-model="keyword" placeholder="搜索单号/原因" @confirm="onSearch" />
        <text class="search-clear" v-if="keyword" @tap="clearSearch">&#xe647;</text>
      </view>
      <view class="filter-btn" @tap="showFilter = !showFilter">
        <text class="filter-icon">&#xe642;</text>
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
            <text class="info-label">报溢数量</text>
            <text class="info-value">{{ item.totalQty }}件</text>
          </view>
          <view class="info-row">
            <text class="info-label">报溢原因</text>
            <text class="info-value">{{ item.reasonText }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">报溢金额</text>
            <text class="info-value info-value--success">¥{{ item.totalAmount.toFixed(2) }}</text>
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
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无报溢单</text>
    </view>

    <view class="fab-btn" @tap="goCreate">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
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
      type: 'GAIN',
      status: activeStatus.value || undefined,
      keyword: keyword.value || undefined,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
    })
    list.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载报溢单失败:', err)
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
      page: page.value, pageSize, type: 'GAIN',
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
  uni.navigateTo({ url: '/pages/loss-gain/create-gain' })
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/loss-gain/loss-gain-detail?id=${id}` })
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.gain-list-page { min-height: 100vh; background: #f0f5ff; display: flex; flex-direction: column; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: #fff; }
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }

.search-bar { display: flex; align-items: center; padding: 16rpx 24rpx; background: #fff; gap: 16rpx; border-bottom: 1rpx solid #f0f0f0; }
.search-input-wrap { flex: 1; display: flex; align-items: center; background: #f5f7fa; border-radius: 32rpx; padding: 0 20rpx; height: 64rpx; }
.search-icon { font-size: 28rpx; color: #999; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 26rpx; }
.search-clear { font-size: 28rpx; color: #ccc; padding: 0 8rpx; }
.filter-btn { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; background: #f5f7fa; border-radius: 50%; }
.filter-icon { font-size: 28rpx; color: #666; }

.filter-panel { background: #fff; padding: 20rpx 24rpx; border-bottom: 1rpx solid #f0f0f0; }
.filter-row { display: flex; align-items: center; margin-bottom: 20rpx; }
.filter-label { font-size: 26rpx; color: #666; width: 140rpx; flex-shrink: 0; }
.filter-values { flex: 1; display: flex; align-items: center; }
.date-picker { flex: 1; height: 64rpx; line-height: 64rpx; background: #f5f7fa; border-radius: 12rpx; text-align: center; font-size: 26rpx; color: #333; }
.date-sep { margin: 0 16rpx; font-size: 26rpx; color: #999; }
.filter-actions { display: flex; gap: 16rpx; margin-top: 24rpx; }
.filter-btn-reset { flex: 1; height: 72rpx; line-height: 72rpx; border-radius: 36rpx; font-size: 28rpx; background: #f5f7fa; color: #666; border: none; }
.filter-btn-confirm { flex: 1; height: 72rpx; line-height: 72rpx; border-radius: 36rpx; font-size: 28rpx; background: #1677FF; color: #fff; border: none; }

.status-bar { background: #fff; white-space: nowrap; padding: 12rpx 16rpx; border-bottom: 1rpx solid #f0f0f0; }
.status-item { display: inline-flex; padding: 12rpx 28rpx; margin: 0 8rpx; border-radius: 32rpx; background: #f5f7fa; font-size: 26rpx; color: #666; }
.status-item--active { background: #1677FF; color: #fff; font-weight: 600; }

.order-scroll { flex: 1; padding: 16rpx 24rpx; }
.order-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; padding-bottom: 16rpx; border-bottom: 1rpx solid #f0f0f0; }
.order-no { font-size: 26rpx; color: #999; }
.status-tag { padding: 4rpx 16rpx; border-radius: 8rpx; }
.status-tag--pending { background: rgba(250,173,20,0.1); }
.status-tag--approved { background: rgba(82,196,26,0.1); }
.status-tag--rejected { background: rgba(255,77,79,0.1); }
.status-tag-text { font-size: 22rpx; }
.status-tag--pending .status-tag-text { color: #faad14; }
.status-tag--approved .status-tag-text { color: #52c41a; }
.status-tag--rejected .status-tag-text { color: #ff4d4f; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.goods-info { margin-bottom: 8rpx; }
.goods-name { font-size: 28rpx; font-weight: 600; color: #333; }
.goods-more { font-size: 24rpx; color: #999; font-weight: 400; margin-left: 8rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.info-value--success { color: #52c41a; font-weight: 600; }
.load-more { text-align: center; padding: 24rpx 0; }
.load-more-text { font-size: 24rpx; color: #bbb; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 200rpx 0; }
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.fab-btn { position: fixed; right: 40rpx; bottom: calc(60rpx + env(safe-area-inset-bottom)); width: 100rpx; height: 100rpx; border-radius: 50%; background: linear-gradient(135deg, #52c41a, #73d13d); display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(82,196,26,0.4); }
.fab-icon { font-size: 56rpx; color: #fff; font-weight: 300; }
.safe-bottom { height: 40rpx; }
</style>
