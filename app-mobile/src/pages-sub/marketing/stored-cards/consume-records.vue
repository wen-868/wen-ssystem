<template>
  <view class="records-page">
    <view class="page-header">
      <view class="back-btn" @tap="goBack">
        <text class="back-icon">&#xe605;</text>
      </view>
      <text class="page-title">消费记录</text>
      <view class="header-right"></view>
    </view>

    <scroll-view class="records-list" scroll-y v-if="consumeList.length > 0">
      <view class="record-item" v-for="item in consumeList" :key="item.id">
        <view class="record-icon icon-consume">
          <text>-</text>
        </view>
        <view class="record-info">
          <view class="record-header">
            <text class="record-card-no">{{ item.cardNo }}</text>
            <text class="record-time">{{ item.createTime }}</text>
          </view>
          <view class="record-body">
            <text class="record-member">{{ item.memberName }}</text>
            <text class="record-order" v-if="item.orderNo">订单号: {{ item.orderNo }}</text>
          </view>
        </view>
        <view class="record-amount">
          <text class="amount-value">-¥{{ item.amount.toFixed(2) }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无消费记录</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storedCardApi, type ConsumeRecord } from '@/api/modules/stored-cards'

const consumeList = ref<ConsumeRecord[]>([])

function goBack() {
  uni.navigateBack()
}

async function loadRecords() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const cardId = Number(currentPage.options?.cardId)

  try {
    const result = await storedCardApi.consumeRecords({
      cardId: cardId || undefined,
      page: 1,
      pageSize: 100
    })
    consumeList.value = result.list
  } catch (err) {
    console.error('加载消费记录失败:', err)
  }
}

onMounted(() => {
  loadRecords()
})
</script>

<style lang="scss" scoped>
.records-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  background: $uni-bg-color;
  padding-top: calc(20rpx + env(safe-area-inset-top));
}

.back-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 36rpx;
  color: $uni-gray-700;
}

.page-title {
  font-size: 34rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.header-right {
  width: 64rpx;
}

.records-list {
  padding: 16rpx 24rpx;
}

.record-item {
  display: flex;
  align-items: center;
  background: $uni-bg-color;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
}

.record-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 16rpx;
}

.icon-consume {
  background: $uni-color-error-soft;
}

.icon-consume text {
  color: $uni-color-error;
  font-size: 32rpx;
  font-weight: 700;
}

.record-info {
  flex: 1;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.record-card-no {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.record-time {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.record-body {
  display: flex;
  flex-direction: column;
}

.record-member {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.record-order {
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-top: 4rpx;
}

.record-amount {
  text-align: right;
}

.amount-value {
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-color-error;
}

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