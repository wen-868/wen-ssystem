<template>
  <view class="records-page">
    <scroll-view class="record-list" scroll-y v-if="list.length > 0" @scrolltolower="onLoadMore">
      <view class="record-item" v-for="item in list" :key="item.id">
        <view class="record-header">
          <text class="record-name">{{ item.memberName }}</text>
          <text class="record-mobile">{{ item.memberMobile }}</text>
        </view>
        <view class="record-body">
          <view class="record-info">
            <text class="info-label">活动名称：</text>
            <text class="info-value">{{ item.activityName }}</text>
          </view>
          <view class="record-info">
            <text class="info-label">参与时间：</text>
            <text class="info-value">{{ formatTime(item.participationTime) }}</text>
          </view>
          <view class="record-info">
            <text class="info-label">状态：</text>
            <text class="info-value" :class="'status-' + item.status">{{ item.statusText || item.status }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">{{ emptyText }}</text>
    </view>

    <view class="load-more" v-if="list.length > 0 && !noMore">
      <text class="load-more-text">{{ loadingMore ? '加载中...' : '上拉加载更多' }}</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { activityApi, type ParticipationRecord } from '@/api/modules/marketing-activities'

const list = ref<ParticipationRecord[]>([])
const activityId = ref<number | undefined>(undefined)
const activityType = ref<'group_buy' | 'bargain' | 'seckill'>('group_buy')
const page = ref(1)
const pageSize = 20
const noMore = ref(false)
const loadingMore = ref(false)
const loading = ref(false)
const emptyText = ref('暂无参与记录')

function formatTime(time: string): string {
  return time.substring(0, 16).replace('T', ' ')
}

async function loadRecords() {
  if (loading.value) return
  loading.value = true
  try {
    // R100-02：拼团/砍价/秒杀参与记录已接真实接口（/api/marketing/*/:id/records）
    const result = await activityApi.participationRecords({
      activityId: activityId.value,
      type: activityType.value,
      page: page.value,
      pageSize,
    })
    const dataList = result.list || []
    if (page.value === 1) {
      list.value = dataList
    } else {
      list.value = [...list.value, ...dataList]
    }
    noMore.value = dataList.length < pageSize
    emptyText.value = '暂无参与记录'
  } catch (err) {
    console.error('加载参与记录失败:', err)
    if (page.value === 1) {
      list.value = []
      emptyText.value = '暂无参与记录'
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value || loading.value) return
  loadingMore.value = true
  page.value++
  await loadRecords()
}

async function resetAndLoad() {
  page.value = 1
  noMore.value = false
  list.value = []
  await loadRecords()
}

onMounted(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const options = currentPage?.options || {}

  if (options.activityId) {
    activityId.value = parseInt(options.activityId)
  }
  if (options.type === 'bargain') {
    activityType.value = 'bargain'
  } else if (options.type === 'seckill') {
    activityType.value = 'seckill'
  }

  // 满减活动无参与记录数据源（后端无对应记录表），展示空态，不发起不存在接口的请求
  if (options.type === 'full_reduction') {
    emptyText.value = '该活动暂无参与记录'
    return
  }
  resetAndLoad()
})
</script>

<style lang="scss" scoped>
.records-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.record-list {
  padding: $uni-spacing-sm $uni-spacing-lg;
}

.record-item {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-sm;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.record-name {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.record-mobile {
  font-size: 26rpx;
  color: $uni-gray-400;
}

.record-body {
  padding-top: $uni-spacing-sm;
  border-top: 1rpx solid $uni-bg-color-grey;
}

.record-info {
  display: flex;
  margin-bottom: $uni-spacing-sm;
}

.info-label {
  font-size: 26rpx;
  color: $uni-gray-400;
  width: 140rpx;
}

.info-value {
  font-size: 26rpx;
  color: $uni-gray-700;
}

.status-success { color: $uni-color-success; }
.status-failed { color: $uni-color-error; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: $uni-gray-300;
  margin-bottom: $uni-spacing-md;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.load-more {
  padding: $uni-spacing-md 0;
  text-align: center;
}

.load-more-text {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
