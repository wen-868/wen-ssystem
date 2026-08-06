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
    // R94-03 核实：后端无营销活动参与记录接口，页面降级为「开发中」占位
    uni.showToast({ title: '参与记录功能开发中', icon: 'none' })
    list.value = []
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

<style lang="scss" scoped>
.records-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.record-list {
  padding: 16rpx 24rpx;
}

.record-item {
  background: $uni-bg-color;
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
  color: $uni-gray-700;
}

.record-mobile {
  font-size: 26rpx;
  color: $uni-gray-400;
}

.record-body {
  padding-top: 16rpx;
  border-top: 1rpx solid $uni-bg-color-grey;
}

.record-info {
  display: flex;
  margin-bottom: 12rpx;
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
