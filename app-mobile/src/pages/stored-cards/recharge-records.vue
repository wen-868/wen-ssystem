<template>
  <view class="records-page">
    <view class="page-header">
      <view class="back-btn" @tap="goBack">
        <text class="back-icon">&#xe605;</text>
      </view>
      <text class="page-title">充值记录</text>
      <view class="header-right"></view>
    </view>

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
      <text class="empty-icon">&#xe631;</text>
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
  const cardId = Number(currentPage.options?.cardId)

  try {
    const result = await storedCardApi.rechargeRecords({
      cardId: cardId || undefined,
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

<style scoped>
.records-page {
  min-height: 100vh;
  background: #f0f5ff;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  background: #fff;
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
  color: #333;
}

.page-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
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
  background: #fff;
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
  background: #f6ffed;
}

.icon-recharge text {
  color: #52c41a;
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
  color: #333;
}

.record-time {
  font-size: 22rpx;
  color: #999;
}

.record-body {
  display: flex;
  flex-direction: column;
}

.record-member {
  font-size: 26rpx;
  color: #666;
}

.record-operator {
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}

.record-amount {
  text-align: right;
}

.amount-value {
  font-size: 30rpx;
  font-weight: 700;
  color: #52c41a;
}

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