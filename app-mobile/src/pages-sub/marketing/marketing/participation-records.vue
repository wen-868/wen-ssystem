<template>
  <view class="records-page">
    <scroll-view class="record-list" scroll-y v-if="list.length > 0">
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
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无参与记录</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { activityApi, type ParticipationRecord } from '@/api/modules/marketing-activities'

const list = ref<ParticipationRecord[]>([])
const activityId = ref<number | undefined>(undefined)

function formatTime(time: string): string {
  return time.substring(0, 16).replace('T', ' ')
}

async function loadRecords() {
  try {
    const result = await activityApi.participationRecords({
      activityId: activityId.value,
      page: 1,
      pageSize: 100
    })
    list.value = result.list
  } catch (err) {
    console.error('加载参与记录失败:', err)
  }
}

onMounted(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const options = currentPage?.options || {}
  
  if (options.activityId) {
    activityId.value = parseInt(options.activityId)
  }
  
  loadRecords()
})
</script>

<style scoped>
.records-page {
  min-height: 100vh;
  background: #f0f5ff;
}

.record-list {
  padding: 16rpx 24rpx;
}

.record-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
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
  color: #333;
}

.record-mobile {
  font-size: 26rpx;
  color: #999;
}

.record-body {
  padding-top: 16rpx;
  border-top: 1rpx solid #f5f5f5;
}

.record-info {
  display: flex;
  margin-bottom: 12rpx;
}

.info-label {
  font-size: 26rpx;
  color: #999;
  width: 140rpx;
}

.info-value {
  font-size: 26rpx;
  color: #333;
}

.status-success { color: #52c41a; }
.status-failed { color: #ff4d4f; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: #ddd;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #bbb;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>