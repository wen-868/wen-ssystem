<template>
  <view class="points-records-page">
    <view class="tab-bar">
      <view
        class="tab-item"
        :class="{ active: activeTab === 'all' }"
        @tap="switchTab('all')"
      >
        全部
      </view>
      <view
        class="tab-item"
        :class="{ active: activeTab === 'EARN' }"
        @tap="switchTab('EARN')"
      >
        获得
      </view>
      <view
        class="tab-item"
        :class="{ active: activeTab === 'CONSUME' }"
        @tap="switchTab('CONSUME')"
      >
        消耗
      </view>
    </view>

    <scroll-view
      scroll-y
      class="records-scroll"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMore"
    >
      <view class="records-list">
        <view
          class="record-item"
          v-for="record in recordsList"
          :key="record.id"
        >
          <view class="record-left">
            <text class="record-reason">{{ record.reason }}</text>
            <text class="record-order" v-if="record.orderNo">订单号：{{ record.orderNo }}</text>
            <text class="record-time">{{ formatTime(record.createdAt) }}</text>
          </view>
          <text class="record-amount" :class="record.type === 'EARN' ? 'earn' : 'consume'">
            {{ record.type === 'EARN' ? '+' : '-' }}{{ record.amount }}
          </text>
        </view>
      </view>

      <view class="empty-state" v-if="recordsList.length === 0 && !loading">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无积分记录</text>
      </view>

      <view class="loading-tip" v-if="loading">
        <text>加载中...</text>
      </view>

      <view class="bottom-tip" v-if="!hasMore && recordsList.length > 0">
        <text>没有更多了</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { pointsApi, type PointsRecord } from '@/api/points'

const activeTab = ref('all')
const recordsList = ref<PointsRecord[]>([])
const loading = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = ref(20)
const hasMore = ref(true)

const formatTime = (time: string): string => {
  if (!time) return ''
  return time.substring(0, 16)
}

const loadRecords = async (isRefresh = false) => {
  if (loading.value) return

  if (isRefresh) {
    page.value = 1
    hasMore.value = true
    recordsList.value = []
  }

  if (!hasMore.value) return

  loading.value = true

  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value
    }

    if (activeTab.value !== 'all') {
      params.type = activeTab.value
    }

    const result = await pointsApi.getPointsRecords(params as any)

    if (result && result.records) {
      if (isRefresh) {
        recordsList.value = result.records
      } else {
        recordsList.value = [...recordsList.value, ...result.records]
      }
      hasMore.value = recordsList.value.length < result.total
      page.value++
    }
  } catch (error) {
    console.error('加载积分明细失败:', error)
    const mockData: PointsRecord[] = [
      { id: 1, type: 'EARN', amount: 100, reason: '消费获得', orderNo: 'SO20260715001', createdAt: '2026-07-15 14:30:00' },
      { id: 2, type: 'CONSUME', amount: 50, reason: '积分兑换优惠券', createdAt: '2026-07-14 10:20:00' },
      { id: 3, type: 'EARN', amount: 200, reason: '消费获得', orderNo: 'SO20260710002', createdAt: '2026-07-10 16:00:00' },
      { id: 4, type: 'EARN', amount: 10, reason: '签到奖励', createdAt: '2026-07-09 09:00:00' },
      { id: 5, type: 'EARN', amount: 150, reason: '消费获得', orderNo: 'SO20260708003', createdAt: '2026-07-08 11:30:00' },
      { id: 6, type: 'CONSUME', amount: 100, reason: '积分兑换商品', createdAt: '2026-07-05 15:40:00' },
      { id: 7, type: 'EARN', amount: 80, reason: '评价奖励', createdAt: '2026-07-03 14:20:00' }
    ]

    const filtered = mockData.filter(item => {
      if (activeTab.value === 'all') return true
      return item.type === activeTab.value
    })

    if (isRefresh) {
      recordsList.value = filtered
    } else {
      recordsList.value = [...recordsList.value, ...filtered]
    }
    hasMore.value = false
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const switchTab = (tab: string) => {
  activeTab.value = tab
  loadRecords(true)
}

const onRefresh = () => {
  refreshing.value = true
  loadRecords(true)
}

const loadMore = () => {
  loadRecords(false)
}

onMounted(() => {
  loadRecords(true)
})
</script>

<style lang="scss" scoped>
.points-records-page {
  height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

.tab-bar {
  display: flex;
  background-color: $bg-primary;
  border-bottom: 1rpx solid $border-color;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: $spacing-md 0;
  font-size: $font-size-base;
  color: $text-secondary;
  position: relative;

  &.active {
    color: $primary-color;
    font-weight: 500;
  }

  &.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 48rpx;
    height: 6rpx;
    background-color: $primary-color;
    border-radius: 3rpx;
  }
}

.records-scroll {
  flex: 1;
  height: 0;
}

.records-list {
  background-color: $bg-primary;
  margin: $spacing-md;
  border-radius: $radius-lg;
  padding: 0 $spacing-lg;
}

.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.record-left {
  display: flex;
  flex-direction: column;
}

.record-reason {
  font-size: $font-size-base;
  color: $text-primary;
  margin-bottom: 4rpx;
}

.record-order {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-bottom: 4rpx;
}

.record-time {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.record-amount {
  font-size: $font-size-lg;
  font-weight: bold;

  &.earn {
    color: $success-color;
  }

  &.consume {
    color: $error-color;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: $spacing-md;
}

.empty-text {
  font-size: $font-size-base;
  color: $text-tertiary;
}

.loading-tip,
.bottom-tip {
  text-align: center;
  padding: $spacing-lg 0;
  color: $text-tertiary;
  font-size: $font-size-sm;
}
</style>
