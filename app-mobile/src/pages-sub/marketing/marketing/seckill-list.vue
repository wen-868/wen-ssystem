<template>
  <view class="seckill-page">
    <page-header title="秒杀活动" @back="goBack" />
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索秒杀商品"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
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
              <image class="image-icon-img" src="/static/icons/ic/wine.svg" mode="aspectFit" />
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
      <image class="empty-icon-img" src="/static/icons/ic/zap.svg" mode="aspectFit" />
      <text class="empty-text">暂无秒杀活动</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import pageHeader from '@/components/page-header/page-header.vue'

function goBack() {
  uni.navigateBack()
}
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
  uni.navigateTo({ url: `/pages-sub/marketing/marketing/seckill-detail?id=${id}` })
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

<style lang="scss" scoped>
.seckill-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
  padding-top: calc(16rpx + var(--safe-top));
}

.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: $uni-bg-color-page;
  border-radius: 36rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 32rpx;
  color: $uni-gray-400;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: $uni-gray-700;
}

.search-placeholder {
  color: $uni-gray-300;
  font-size: 26rpx;
}

.search-clear {
  font-size: 32rpx;
  color: $uni-gray-300;
  padding: 4rpx;
}

.status-tabs {
  display: flex;
  background: $uni-bg-color;
  padding: 0 16rpx;
  margin-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}

.status-tab {
  flex: 1;
  padding: 24rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: $uni-gray-500;
  position: relative;
}

.status-tab.active {
  color: $uni-color-warning;
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
  background: $uni-color-warning;
  border-radius: 2rpx;
}

.seckill-list {
  padding: 0 $uni-spacing-lg $uni-spacing-base;
  height: calc(100vh - 220rpx);
}

.seckill-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  margin-bottom: $uni-spacing-md;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx $zx-black-40;
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
  border-radius: $uni-border-radius-xs;
  overflow: hidden;
}

.product-image-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, $uni-color-warning-soft, $uni-color-warning-soft);
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
  background: $uni-color-warning;
  color: $uni-text-color-inverse;
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
  color: $uni-gray-700;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: $uni-spacing-sm;
}

.seckill-price {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-color-warning;
}

.original-price {
  font-size: 24rpx;
  color: $uni-gray-300;
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
  color: $uni-gray-400;
}

.stock-value {
  font-size: 26rpx;
  color: $uni-color-warning;
  font-weight: 600;
}

.stock-unit {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.limit-info {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $uni-spacing-sm $uni-spacing-md;
  border-top: 1rpx solid $uni-bg-color-grey;
  background: $uni-gray-50;
}

.countdown-row {
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
}

.countdown-label {
  font-size: 22rpx;
  color: $uni-gray-500;
}

.countdown-time {
  display: flex;
  align-items: center;
  gap: 4rpx;
}

.time-block {
  background: $uni-color-warning;
  color: $uni-text-color-inverse;
  font-size: 22rpx;
  font-weight: 600;
  padding: 4rpx $uni-spacing-xs;
  border-radius: 6rpx;
  min-width: 36rpx;
  text-align: center;
}

.time-colon {
  color: $uni-color-warning;
  font-size: 22rpx;
  font-weight: 600;
}

.countdown-text {
  font-size: 22rpx;
  color: $uni-color-warning;
  font-weight: 500;
}

.status-tag {
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}

.tag-DRAFT { background: $uni-color-primary-soft; color: $uni-color-primary; }
.tag-ACTIVE { background: $uni-color-success-soft; color: $uni-color-success; }
.tag-ENDED { background: $uni-bg-color-grey; color: $uni-gray-400; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: $uni-spacing-md;
  opacity: 0.5;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}

.image-icon-img{width:120rpx;height:120rpx}
.empty-icon-img{width:96rpx;height:96rpx}
</style>