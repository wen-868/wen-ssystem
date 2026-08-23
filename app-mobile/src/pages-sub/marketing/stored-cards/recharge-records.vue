<template>
  <view class="records-page">
    <page-header title="充值记录" @back="goBack" />

    <scroll-view class="records-list" scroll-y v-if="rechargeList.length > 0">
      <view class="record-item" v-for="item in rechargeList" :key="item.id">
        <view class="record-icon icon-recharge">
          <text>+</text>
        </view>
        <view class="record-info">
          <view class="record-header">
            <text class="record-card-no">{{ item.cardNo }}</text>
            <text class="record-time">{{ item.createTime }}</text>
          </view>
          <view class="record-body">
            <text class="record-member">{{ item.memberName }}</text>
            <text class="record-operator" v-if="item.operator">操作人: {{ item.operator }}</text>
          </view>
        </view>
        <view class="record-amount">
          <text class="amount-value">+¥{{ item.amount.toFixed(2) }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无充值记录</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storedCardApi, type RechargeRecord } from '@/api/modules/stored-cards'

const rechargeList = ref<RechargeRecord[]>([])

function goBack() {
  uni.navigateBack()
}

async function loadRecords() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const cardNo = String(currentPage.options?.cardNo ?? '')

  try {
    const result = await storedCardApi.rechargeRecords({
      cardNo: cardNo || undefined,
      page: 1,
      pageSize: 100
    })
    rechargeList.value = result.list
  } catch (err) {
    console.error('加载充值记录失败:', err)
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
  padding: 16rpx 32rpx;
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

.icon-recharge {
  background: $uni-color-success-soft;
}

.icon-recharge text {
  color: $uni-color-success;
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

.record-operator {
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
  color: $uni-color-success;
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
