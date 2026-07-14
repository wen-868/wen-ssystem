<template>
  <view class="seckill-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索秒杀商品"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
      </view>
    </view>

    <!-- 状态Tab -->
    <view class="status-tabs">
      <view
        v-for="tab in statusTabs"
        :key="tab.value"
        class="status-tab"
        :class="{ active: activeStatus === tab.value }"
        @tap="switchStatus(tab.value)"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <!-- 秒杀列表 -->
    <scroll-view class="seckill-list" scroll-y v-if="filteredList.length > 0">
      <view
        class="seckill-card"
        v-for="item in filteredList"
        :key="item.id"
        @tap="goDetail(item.id)"
      >
        <view class="card-header">
          <view class="product-image-wrap">
            <view class="product-image-placeholder">
              <text class="image-icon">🍷</text>
            </view>
            <view class="seckill-badge">秒杀</view>
          </view>
          <view class="product-info">
            <text class="product-name">{{ item.productName }}</text>
            <view class="price-row">
              <text class="seckill-price">¥{{ item.seckillPrice }}</text>
              <text class="original-price">¥{{ item.originalPrice }}</text>
            </view>
            <view class="stock-row">
              <view class="stock-info">
                <text class="stock-label">剩余</text>
                <text class="stock-value">{{ item.availableStock }}</text>
                <text class="stock-unit">件</text>
              </view>
              <view class="limit-info">
                <text>每人限{{ item.limitPerUser }}件</text>
              </view>
            </view>
          </view>
        </view>
        <view class="card-footer">
          <view class="countdown-row" v-if="item.status === 'ACTIVE'">
            <text class="countdown-label">距结束</text>
            <view class="countdown-time">
              <text class="time-block">{{ getCountdown(item).hours }}</text>
              <text class="time-colon">:</text>
              <text class="time-block">{{ getCountdown(item).minutes }}</text>
              <text class="time-colon">:</text>
              <text class="time-block">{{ getCountdown(item).seconds }}</text>
            </view>
          </view>
          <view class="countdown-row" v-else-if="item.status === 'DRAFT'">
            <text class="countdown-label">距开始</text>
            <text class="countdown-text">{{ formatDate(item.startTime) }}</text>
          </view>
          <view class="status-tag" :class="'tag-' + item.status">
            <text>{{ getStatusLabel(item.status) }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <text class="empty-icon">⚡</text>
      <text class="empty-text">暂无秒杀活动</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { communityMarketingApi, type SeckillActivity } from '@/api/modules/community-marketing'

const searchForm = reactive({
  keyword: '',
})

const statusTabs = [
  { label: '全部', value: '' },
  { label: '进行中', value: 'ACTIVE' },
  { label: '即将开始', value: 'DRAFT' },
  { label: '已结束', value: 'ENDED' },
]

const activeStatus = ref('')
const list = ref<SeckillActivity[]>([])
const loading = ref(false)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

const filteredList = computed(() => {
  let result = [...list.value]
  if (activeStatus.value) {
    result = result.filter(item => item.status === activeStatus.value)
  }
  if (searchForm.keyword) {
    const kw = searchForm.keyword.toLowerCase()
    result = result.filter(item => item.productName.toLowerCase().includes(kw))
  }
  return result
})

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '即将开始',
    ACTIVE: '进行中',
    ENDED: '已结束',
  }
  return map[status] || status
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.substring(0, 10)
}

function padZero(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

function getCountdown(item: SeckillActivity) {
  const endTime = new Date(item.endTime).getTime()
  const diff = Math.max(0, endTime - now.value)

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return {
    hours: padZero(hours),
    minutes: padZero(minutes),
    seconds: padZero(seconds),
  }
}

function onSearch() {
  // 通过 computed 实时过滤
}

function clearSearch() {
  searchForm.keyword = ''
}

function switchStatus(val: string) {
  activeStatus.value = val
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/marketing/seckill-detail?id=${id}` })
}

async function loadList() {
  loading.value = true
  try {
    const result = await communityMarketingApi.listSeckills({ page: 1, pageSize: 50 })
    list.value = result.records || []
  } catch (err) {
    console.error('加载秒杀活动失败:', err)
    list.value = []
  } finally {
    loading.value = false
  }
}

function startTimer() {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onMounted(() => {
  loadList()
  startTimer()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.seckill-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: #fff;
  padding-top: calc(16rpx + env(safe-area-inset-top));
}

.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: #f5f7fa;
  border-radius: 36rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 32rpx;
  color: #999;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.search-placeholder {
  color: #bbb;
  font-size: 26rpx;
}

.search-clear {
  font-size: 32rpx;
  color: #bbb;
  padding: 4rpx;
}

.status-tabs {
  display: flex;
  background: #fff;
  padding: 0 16rpx;
  margin-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.status-tab {
  flex: 1;
  padding: 24rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #666;
  position: relative;
}

.status-tab.active {
  color: #fa8c16;
  font-weight: 600;
}

.status-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 3rpx;
  background: #fa8c16;
  border-radius: 2rpx;
}

.seckill-list {
  padding: 0 24rpx 24rpx;
  height: calc(100vh - 220rpx);
}

.seckill-card {
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  padding: 20rpx;
  gap: 20rpx;
}

.product-image-wrap {
  width: 180rpx;
  height: 180rpx;
  flex-shrink: 0;
  position: relative;
  border-radius: 12rpx;
  overflow: hidden;
}

.product-image-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #fff7e6, #ffd591);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-icon {
  font-size: 60rpx;
}

.seckill-badge {
  position: absolute;
  top: 0;
  left: 0;
  background: #fa8c16;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-bottom-right-radius: 12rpx;
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.product-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.seckill-price {
  font-size: 36rpx;
  font-weight: 700;
  color: #fa8c16;
}

.original-price {
  font-size: 24rpx;
  color: #bbb;
  text-decoration: line-through;
}

.stock-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stock-info {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}

.stock-label {
  font-size: 22rpx;
  color: #999;
}

.stock-value {
  font-size: 26rpx;
  color: #fa8c16;
  font-weight: 600;
}

.stock-unit {
  font-size: 22rpx;
  color: #999;
}

.limit-info {
  font-size: 22rpx;
  color: #999;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 20rpx;
  border-top: 1rpx solid #f5f5f5;
  background: #fafafa;
}

.countdown-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.countdown-label {
  font-size: 22rpx;
  color: #666;
}

.countdown-time {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.time-block {
  background: #fa8c16;
  color: #fff;
  font-size: 22rpx;
  font-weight: 600;
  padding: 4rpx 8rpx;
  border-radius: 6rpx;
  min-width: 36rpx;
  text-align: center;
}

.time-colon {
  color: #fa8c16;
  font-size: 22rpx;
  font-weight: 600;
}

.countdown-text {
  font-size: 22rpx;
  color: #fa8c16;
  font-weight: 500;
}

.status-tag {
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}

.tag-DRAFT { background: #e6f7ff; color: #1677FF; }
.tag-ACTIVE { background: #f6ffed; color: #52c41a; }
.tag-ENDED { background: #f5f5f5; color: #999; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
  opacity: 0.5;
}

.empty-text {
  font-size: 28rpx;
  color: #bbb;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
