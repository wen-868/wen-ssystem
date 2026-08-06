<template>
  <view class="community-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索活动名称"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
      </view>
    </view>

    <!-- 分类Tab -->
    <view class="category-tabs">
      <view
        v-for="tab in categoryTabs"
        :key="tab.value"
        class="category-tab"
        :class="{ active: activeCategory === tab.value }"
        @tap="switchCategory(tab.value)"
      >
        <text class="tab-icon">{{ tab.icon }}</text>
        <text class="tab-label">{{ tab.label }}</text>
      </view>
    </view>

    <!-- 状态筛选Tab -->
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

    <!-- 活动列表 -->
    <scroll-view class="activity-list" scroll-y v-if="filteredList.length > 0">
      <view
        class="activity-card"
        v-for="item in filteredList"
        :key="item.id + '_' + item.type"
        @tap="goDetail(item)"
      >
        <view class="card-image-wrap">
          <view class="card-image-placeholder">
            <text class="placeholder-icon">{{ getCategoryIcon(item.type) }}</text>
          </view>
          <view class="card-type-badge" :class="'badge-' + item.type">
            <text>{{ getTypeLabel(item.type) }}</text>
          </view>
        </view>
        <view class="card-content">
          <text class="activity-name">{{ item.name }}</text>
          <view class="activity-price-row">
            <text class="price-label">活动价</text>
            <text class="price-value">¥{{ item.price }}</text>
            <text class="price-original">¥{{ item.originalPrice }}</text>
          </view>
          <view class="activity-info-row">
            <text class="info-text">{{ item.extraInfo }}</text>
          </view>
          <view class="activity-time-row">
            <text class="time-icon">&#xe617;</text>
            <text class="time-text">{{ formatDate(item.startTime) }} ~ {{ formatDate(item.endTime) }}</text>
          </view>
        </view>
        <view class="card-status" :class="'status-' + item.status">
          <text>{{ getStatusLabel(item.status) }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无活动</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { communityMarketingApi, type GroupBuyActivity, type BargainActivity, type SeckillActivity } from '@/api/modules/community-marketing'

interface ActivityItem {
  id: number
  type: 'group_buy' | 'bargain' | 'seckill'
  name: string
  price: number
  originalPrice: number
  extraInfo: string
  startTime: string
  endTime: string
  status: string
}

const searchForm = reactive({
  keyword: '',
})

const categoryTabs = [
  { label: '拼团', value: 'group_buy', icon: '👥' },
  { label: '砍价', value: 'bargain', icon: '🔪' },
  { label: '秒杀', value: 'seckill', icon: '⚡' },
]

const statusTabs = [
  { label: '全部', value: '' },
  { label: '进行中', value: 'ACTIVE' },
  { label: '未开始', value: 'DRAFT' },
  { label: '已结束', value: 'ENDED' },
]

const activeCategory = ref('group_buy')
const activeStatus = ref('')
const groupBuyList = ref<GroupBuyActivity[]>([])
const bargainList = ref<BargainActivity[]>([])
const seckillList = ref<SeckillActivity[]>([])
const loading = ref(false)

const filteredList = computed<ActivityItem[]>(() => {
  let list: ActivityItem[] = []

  if (activeCategory.value === 'group_buy') {
    list = groupBuyList.value.map(item => ({
      id: item.id,
      type: 'group_buy' as const,
      name: item.name,
      price: item.groupPrice,
      originalPrice: item.originalPrice,
      extraInfo: `${item.minGroupSize}人成团 · 已团${item.soldCount}人`,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.status,
    }))
  } else if (activeCategory.value === 'bargain') {
    list = bargainList.value.map(item => ({
      id: item.id,
      type: 'bargain' as const,
      name: item.activityName,
      price: item.minPrice,
      originalPrice: item.originalPrice,
      extraInfo: `最低¥${item.minPrice} · 已砍${item.soldCount}件`,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.status,
    }))
  } else {
    list = seckillList.value.map(item => ({
      id: item.id,
      type: 'seckill' as const,
      name: item.productName,
      price: item.seckillPrice,
      originalPrice: item.originalPrice,
      extraInfo: `剩余${item.availableStock}件 · 每人限购${item.limitPerUser}件`,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.status,
    }))
  }

  // 状态筛选
  if (activeStatus.value) {
    list = list.filter(item => item.status === activeStatus.value)
  }

  // 关键词搜索
  if (searchForm.keyword) {
    const kw = searchForm.keyword.toLowerCase()
    list = list.filter(item => item.name.toLowerCase().includes(kw))
  }

  return list
})

function getCategoryIcon(type: string): string {
  const map: Record<string, string> = {
    group_buy: '👥',
    bargain: '🔪',
    seckill: '⚡',
  }
  return map[type] || '🎁'
}

function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    group_buy: '拼团',
    bargain: '砍价',
    seckill: '秒杀',
  }
  return map[type] || '活动'
}

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
  // 搜索通过 computed 实时过滤，无需重新加载
}

function clearSearch() {
  searchForm.keyword = ''
}

function switchCategory(val: string) {
  activeCategory.value = val
}

function switchStatus(val: string) {
  activeStatus.value = val
}

function goDetail(item: ActivityItem) {
  let url = ''
  if (item.type === 'group_buy') {
    url = `/pages-sub/marketing/marketing/group-buy-detail?id=${item.id}`
  } else if (item.type === 'bargain') {
    url = `/pages-sub/marketing/marketing/bargain-detail?id=${item.id}`
  } else {
    url = `/pages-sub/marketing/marketing/seckill-detail?id=${item.id}`
  }
  uni.navigateTo({ url })
}

async function loadAllActivities() {
  loading.value = true
  try {
    const [groupRes, bargainRes, seckillRes] = await Promise.all([
      communityMarketingApi.listGroupBuys({ page: 1, pageSize: 50 }),
      communityMarketingApi.listBargains({ page: 1, pageSize: 50 }),
      communityMarketingApi.listSeckills({ page: 1, pageSize: 50 }),
    ])
    groupBuyList.value = groupRes.records || []
    bargainList.value = bargainRes.records || []
    seckillList.value = seckillRes.records || []
  } catch (err) {
    console.error('加载社群活动失败:', err)
    // 加载失败时使用空列表
    groupBuyList.value = []
    bargainList.value = []
    seckillList.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAllActivities()
})
</script>

<style lang="scss" scoped>
.community-page {
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

.category-tabs {
  display: flex;
  background: $uni-bg-color;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $uni-gray-100;
}

.category-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 0;
  position: relative;
}

.category-tab.active {
  color: $uni-color-primary;
}

.category-tab.active::after {
  content: '';
  position: absolute;
  bottom: -20rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: $uni-color-primary;
  border-radius: 2rpx;
}

.tab-icon {
  font-size: 40rpx;
  margin-bottom: 8rpx;
}

.tab-label {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.category-tab.active .tab-label {
  color: $uni-color-primary;
  font-weight: 600;
}

.status-tabs {
  display: flex;
  background: $uni-bg-color;
  padding: 0 16rpx;
  margin-bottom: 16rpx;
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
  color: $uni-color-primary;
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
  background: $uni-color-primary;
  border-radius: 2rpx;
}

.activity-list {
  padding: 0 24rpx 24rpx;
  height: calc(100vh - 360rpx);
}

.activity-card {
  display: flex;
  background: $uni-bg-color;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  position: relative;
}

.card-image-wrap {
  width: 200rpx;
  height: 200rpx;
  flex-shrink: 0;
  position: relative;
}

.card-image-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, $uni-color-primary-soft, $uni-color-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 60rpx;
}

.card-type-badge {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  padding: 4rpx 12rpx;
  border-radius: 16rpx;
  font-size: 20rpx;
  color: $uni-text-color-inverse;
}

.badge-group_buy { background: $uni-color-success; }
.badge-bargain { background: $uni-color-error; }
.badge-seckill { background: $uni-color-warning; }

.card-content {
  flex: 1;
  padding: 16rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.activity-name {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.activity-price-row {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.price-label {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.price-value {
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-color-error;
}

.price-original {
  font-size: 22rpx;
  color: $uni-gray-300;
  text-decoration: line-through;
}

.activity-info-row {
  display: flex;
  align-items: center;
}

.info-text {
  font-size: 22rpx;
  color: $uni-gray-500;
}

.activity-time-row {
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

.card-status {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
}

.status-DRAFT { background: $uni-color-primary-soft; color: $uni-color-primary; }
.status-ACTIVE { background: $uni-color-success-soft; color: $uni-color-success; }
.status-ENDED { background: $uni-bg-color-grey; color: $uni-gray-400; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: $uni-gray-300;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
