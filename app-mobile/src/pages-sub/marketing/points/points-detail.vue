<template>
  <view class="points-page">
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索会员姓名 / 手机号"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
      </view>
    </view>

    <view class="tabs">
      <view class="tab-item" :class="{ active: activeTab === 'all' }" @tap="switchTab('all')">
        <text>全部</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'earn' }" @tap="switchTab('earn')">
        <text>获得</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'spend' }" @tap="switchTab('spend')">
        <text>消费</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'expire' }" @tap="switchTab('expire')">
        <text>过期</text>
      </view>
    </view>

    <scroll-view class="records-list" scroll-y v-if="list.length > 0">
      <view class="record-item" v-for="item in list" :key="item.id">
        <view class="record-icon" :class="getIconClass(item.type)">
          <text>{{ getIconText(item.type) }}</text>
        </view>
        <view class="record-info">
          <view class="record-header">
            <text class="record-type">{{ item.typeText }}</text>
            <text class="record-time">{{ item.createTime }}</text>
          </view>
          <view class="record-body">
            <text class="record-member">{{ item.memberName }} {{ item.memberMobile }}</text>
            <text class="record-reason">{{ item.reason }}</text>
          </view>
        </view>
        <view class="record-points">
          <text class="points-value" :class="getPointsClass(item.type)">{{ getPointsPrefix(item.type) }}{{ item.points }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无积分记录</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { pointsApi, type PointsRecord } from '@/api/modules/points'

const searchForm = reactive({
  keyword: '',
})

const activeTab = ref('all')
const list = ref<PointsRecord[]>([])

function onSearch() {
  loadRecords()
}

function clearSearch() {
  searchForm.keyword = ''
  loadRecords()
}

function switchTab(tab: string) {
  activeTab.value = tab
  loadRecords()
}

function getIconClass(type: string): string {
  return `icon-${type}`
}

function getIconText(type: string): string {
  if (type === 'earn') return '+'
  if (type === 'spend') return '-'
  return '×'
}

function getPointsClass(type: string): string {
  if (type === 'earn') return 'points-earn'
  if (type === 'spend') return 'points-spend'
  return 'points-expire'
}

function getPointsPrefix(type: string): string {
  if (type === 'earn') return '+'
  if (type === 'spend') return '-'
  return '-'
}

async function loadRecords() {
  try {
    const result = await pointsApi.records({
      type: activeTab.value === 'all' ? undefined : activeTab.value,
      page: 1,
      pageSize: 100
    })
    list.value = result.list
  } catch (err) {
    console.error('加载积分记录失败:', err)
  }
}

onMounted(() => {
  loadRecords()
})
</script>

<style lang="scss" scoped>
.points-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
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

.tabs {
  display: flex;
  background: $uni-bg-color;
  padding: 0 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.tab-item {
  flex: 1;
  padding: 24rpx 0;
  text-align: center;
  font-size: 28rpx;
  color: $uni-gray-400;
  position: relative;
}

.tab-item.active {
  color: $uni-color-primary;
  font-weight: 600;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: $uni-color-primary;
  border-radius: 2rpx;
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

.icon-earn {
  background: $uni-color-success-soft;
}

.icon-earn text {
  color: $uni-color-success;
  font-size: 32rpx;
  font-weight: 700;
}

.icon-spend {
  background: $uni-color-warning-soft;
}

.icon-spend text {
  color: $uni-color-warning;
  font-size: 32rpx;
  font-weight: 700;
}

.icon-expire {
  background: $uni-color-error-soft;
}

.icon-expire text {
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

.record-type {
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

.record-reason {
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-top: 4rpx;
}

.record-points {
  text-align: right;
}

.points-value {
  font-size: 30rpx;
  font-weight: 700;
}

.points-earn {
  color: $uni-color-success;
}

.points-spend {
  color: $uni-color-warning;
}

.points-expire {
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