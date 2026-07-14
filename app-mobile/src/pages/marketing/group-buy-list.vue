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
  uni.navigateTo({ url: `/pages/marketing/group-buy-detail?id=${id}` })
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

<style scoped>
.group-buy-page {
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
  color: #52c41a;
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
  background: #52c41a;
  border-radius: 2rpx;
}

.group-list {
  padding: 0 24rpx 24rpx;
  height: calc(100vh - 220rpx);
}

.group-card {
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
  background: linear-gradient(135deg, #f6ffed, #d9f7be);
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
  background: #52c41a;
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

.group-price {
  font-size: 36rpx;
  font-weight: 700;
  color: #52c41a;
}

.original-price {
  font-size: 24rpx;
  color: #bbb;
  text-decoration: line-through;
}

.group-info {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.info-text {
  font-size: 22rpx;
  color: #999;
}

.info-divider {
  color: #ddd;
  font-size: 22rpx;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 20rpx;
  border-top: 1rpx solid #f5f5f5;
  background: #fafafa;
}

.time-info {
  display: flex;
  align-items: center;
}

.time-icon {
  font-size: 22rpx;
  color: #999;
  margin-right: 6rpx;
}

.time-text {
  font-size: 22rpx;
  color: #999;
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
