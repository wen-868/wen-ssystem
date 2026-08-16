<template>
  <view class="stock-checks-page">
    <view class="page-header">
      <text class="header-title">库存盘点</text>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-row">
      <view class="stat-card">
        <text class="stat-value">{{ stats.total }}</text>
        <text class="stat-label">总盘点</text>
      </view>
      <view class="stat-card stat-card--warning">
        <text class="stat-value">{{ stats.inProgress }}</text>
        <text class="stat-label">进行中</text>
      </view>
      <view class="stat-card stat-card--success">
        <text class="stat-value">{{ stats.completed }}</text>
        <text class="stat-label">已完成</text>
      </view>
      <view class="stat-card stat-card--info">
        <text class="stat-value">{{ stats.draft }}</text>
        <text class="stat-label">草稿</text>
      </view>
    </view>

    <!-- 状态筛选 -->
    <scroll-view class="status-bar" scroll-x :show-scrollbar="false">
      <view class="status-item" :class="{ 'status-item--active': activeStatus === '' }" @tap="switchStatus('')">
        <text>全部</text>
      </view>
      <view class="status-item" :class="{ 'status-item--active': activeStatus === 'DRAFT' }" @tap="switchStatus('DRAFT')">
        <text>草稿</text>
      </view>
      <view class="status-item" :class="{ 'status-item--active': activeStatus === 'IN_PROGRESS' }" @tap="switchStatus('IN_PROGRESS')">
        <text>进行中</text>
      </view>
      <view class="status-item" :class="{ 'status-item--active': activeStatus === 'COMPLETED' }" @tap="switchStatus('COMPLETED')">
        <text>已完成</text>
      </view>
    </scroll-view>

    <!-- 盘点单列表 -->
    <scroll-view class="check-scroll" scroll-y v-if="list.length > 0" @scrolltolower="onLoadMore">
      <view class="check-card" v-for="item in list" :key="item.id" @tap="goDetail(item.id)">
        <view class="card-header">
          <text class="check-no">{{ item.checkNo }}</text>
          <view class="status-tag" :class="getStatusClass(item.status)">
            <text class="status-tag-text">{{ getStatusText(item.status) }}</text>
          </view>
        </view>
        <view class="card-body">
          <text class="check-title">{{ item.title }}</text>
          <view class="info-row">
            <text class="info-label">商品数</text>
            <text class="info-value">{{ item.totalCount ?? '--' }}</text>
          </view>
          <view class="info-row" v-if="item.diffCount != null">
            <text class="info-label">差异数</text>
            <text class="info-value" :class="{ 'info-value--danger': item.diffCount > 0 }">{{ item.diffCount }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">盘点人</text>
            <text class="info-value">{{ item.operatorName || '--' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">创建时间</text>
            <text class="info-value">{{ item.createdAt || '--' }}</text>
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
      <text class="empty-text">暂无盘点单</text>
    </view>

    <view class="fab-btn" @tap="goCreate">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { stockCheckApi, type StockCheck, type CheckStatistics } from '@/api/modules/stock-check'

const loading = ref(false)
const loadingMore = ref(false)
const list = ref<StockCheck[]>([])
const activeStatus = ref('')
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

const stats = reactive<CheckStatistics>({
  total: 0, inProgress: 0, completed: 0, draft: 0, cancel: 0,
})

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '草稿', IN_PROGRESS: '进行中', COMPLETED: '已完成', CANCELLED: '已取消',
  }
  return map[status] ?? status
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'status-tag--draft', IN_PROGRESS: 'status-tag--progress',
    COMPLETED: 'status-tag--success', CANCELLED: 'status-tag--cancel',
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

async function loadList() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await stockCheckApi.list({
      page: page.value,
      pageSize,
      status: activeStatus.value || undefined,
    })
    list.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载盘点单失败:', err)
  } finally {
    loading.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    page.value++
    const result = await stockCheckApi.list({
      page: page.value, pageSize, status: activeStatus.value || undefined,
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

async function loadStats() {
  try {
    const result = await stockCheckApi.statistics()
    Object.assign(stats, result)
  } catch (err) {
    console.error('加载统计失败:', err)
  }
}

function goCreate() {
  uni.navigateTo({ url: '/pages-sub/product/stock-check/create-check' })
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages-sub/product/stock-check/check-detail?id=${id}` })
}

onMounted(() => {
  loadStats()
  loadList()
})
</script>

<style lang="scss" scoped>
.stock-checks-page { min-height: 100vh; background: $uni-color-primary-soft; display: flex; flex-direction: column; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: $uni-bg-color; }
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.stats-row { display: flex; padding: 20rpx 24rpx; gap: 16rpx; }
.stat-card {
  flex: 1; background: $uni-bg-color; border-radius: 16rpx; padding: 20rpx 0;
  display: flex; flex-direction: column; align-items: center;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.stat-value { font-size: 36rpx; font-weight: 700; color: $uni-color-primary; }
.stat-card--warning .stat-value { color: $uni-color-warning; }
.stat-card--success .stat-value { color: $uni-color-success; }
.stat-card--info .stat-value { color: $uni-gray-400; }
.stat-label { font-size: 22rpx; color: $uni-gray-400; margin-top: 4rpx; }
.status-bar { background: $uni-bg-color; white-space: nowrap; padding: 12rpx 16rpx; border-bottom: 1rpx solid $uni-gray-100; }
.status-item { display: inline-flex; padding: 12rpx 28rpx; margin: 0 8rpx; border-radius: 32rpx; background: $uni-bg-color-page; font-size: 26rpx; color: $uni-gray-500; }
.status-item--active { background: $uni-color-primary; color: $uni-text-color-inverse; font-weight: 600; }
.check-scroll { flex: 1; padding: 16rpx 24rpx; }
.check-card { background: $uni-bg-color; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; padding-bottom: 16rpx; border-bottom: 1rpx solid $uni-gray-100; }
.check-no { font-size: 26rpx; color: $uni-gray-400; }
.status-tag { padding: 4rpx 16rpx; border-radius: 8rpx; }
.status-tag--draft { background: rgba(0,0,0,0.05); }
.status-tag--progress { background: rgba(250,173,20,0.1); }
.status-tag--success { background: rgba(82,196,26,0.1); }
.status-tag--cancel { background: rgba(255,77,79,0.1); }
.status-tag-text { font-size: 22rpx; }
.status-tag--draft .status-tag-text { color: $uni-gray-400; }
.status-tag--progress .status-tag-text { color: $uni-color-warning; }
.status-tag--success .status-tag-text { color: $uni-color-success; }
.status-tag--cancel .status-tag-text { color: $uni-color-error; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.check-title { font-size: 30rpx; font-weight: 600; color: $uni-gray-700; margin-bottom: 8rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.info-value--danger { color: $uni-color-error; }
.load-more { text-align: center; padding: 24rpx 0; }
.load-more-text { font-size: 24rpx; color: $uni-gray-300; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 200rpx 0; }
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.fab-btn { position: fixed; right: 40rpx; bottom: calc(60rpx + env(safe-area-inset-bottom)); width: 100rpx; height: 100rpx; border-radius: 50%; background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary); display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(22,119,255,0.4); }
.fab-icon { font-size: 56rpx; color: $uni-text-color-inverse; font-weight: 300; }
.safe-bottom { height: 40rpx; }
</style>
