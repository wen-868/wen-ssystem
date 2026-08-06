<template>
  <view class="group-buy-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索拼团活动"
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

    <!-- 拼团列表 -->
    <scroll-view class="group-list" scroll-y v-if="filteredList.length > 0">
      <view
        class="group-card"
        v-for="item in filteredList"
        :key="item.id"
        @tap="goDetail(item.id)"
      >
        <view class="card-header">
          <view class="product-image-wrap">
            <view class="product-image-placeholder">
              <text class="image-icon">🍷</text>
            </view>
            <view class="group-badge">拼团</view>
          </view>
          <view class="product-info">
            <text class="product-name">{{ item.name }}</text>
            <view class="price-row">
              <text class="group-price">¥{{ item.groupPrice }}</text>
              <text class="original-price">¥{{ item.originalPrice }}</text>
            </view>
            <view class="group-info">
              <text class="info-text">{{ item.minGroupSize }}人成团</text>
              <text class="info-divider">·</text>
              <text class="info-text">已团{{ item.soldCount }}人</text>
            </view>
          </view>
        </view>
        <view class="card-footer">
          <view class="time-info">
            <text class="time-icon">&#xe617;</text>
            <text class="time-text">{{ formatDate(item.startTime) }} ~ {{ formatDate(item.endTime) }}</text>
          </view>
          <view class="status-tag" :class="'tag-' + item.status">
            <text>{{ getStatusLabel(item.status) }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <text class="empty-icon">👥</text>
      <text class="empty-text">暂无拼团活动</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { communityMarketingApi, type GroupBuyActivity } from '@/api/modules/community-marketing'

const searchForm = reactive({
  keyword: '',
})

const statusTabs = [
  { label: '全部', value: '' },
  { label: '进行中', value: 'ACTIVE' },
  { label: '未开始', value: 'DRAFT' },
  { label: '已结束', value: 'ENDED' },
]

const activeStatus = ref('')
const list = ref<GroupBuyActivity[]>([])
const loading = ref(false)

const filteredList = computed(() => {
  let result = [...list.value]
  if (activeStatus.value) {
    result = result.filter(item => item.status === activeStatus.value)
  }
  if (searchForm.keyword) {
    const kw = searchForm.keyword.toLowerCase()
    result = result.filter(item => item.name.toLowerCase().includes(kw))
  }
  return result
})

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '未开始',
    ACTIVE: '进行中',
    ENDED: '已结束',
  }
  return map[status] || status
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.substring(0, 10)
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
  uni.navigateTo({ url: `/pages-sub/marketing/marketing/group-buy-detail?id=${id}` })
}

async function loadList() {
  loading.value = true
  try {
    const result = await communityMarketingApi.listGroupBuys({ page: 1, pageSize: 50 })
    list.value = result.records || []
  } catch (err) {
    console.error('加载拼团活动失败:', err)
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadList()
})
</script>

<style lang="scss" scoped>
.group-buy-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
  padding-top: calc(16rpx + env(safe-area-inset-top));
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
  color: $uni-color-success;
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
  background: $uni-color-success;
  border-radius: 2rpx;
}

.group-list {
  padding: 0 24rpx 24rpx;
  height: calc(100vh - 220rpx);
}

.group-card {
  background: $uni-bg-color;
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
  background: linear-gradient(135deg, $uni-color-success-soft, $uni-color-success-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-icon {
  font-size: 60rpx;
}

.group-badge {
  position: absolute;
  top: 0;
  left: 0;
  background: $uni-color-success;
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
  gap: 12rpx;
}

.group-price {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-color-success;
}

.original-price {
  font-size: 24rpx;
  color: $uni-gray-300;
  text-decoration: line-through;
}

.group-info {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.info-text {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.info-divider {
  color: $uni-gray-300;
  font-size: 22rpx;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 20rpx;
  border-top: 1rpx solid $uni-bg-color-grey;
  background: $uni-gray-50;
}

.time-info {
  display: flex;
  align-items: center;
}

.time-icon {
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-right: 6rpx;
}

.time-text {
  font-size: 22rpx;
  color: $uni-gray-400;
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
  margin-bottom: 20rpx;
  opacity: 0.5;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
