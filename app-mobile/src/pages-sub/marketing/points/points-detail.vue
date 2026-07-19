<template>
  <view class="points-page">
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索会员姓名 / 手机号"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
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
      <text class="empty-icon">&#xe631;</text>
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

<style scoped>
.points-page {
  min-height: 100vh;
  background: #f0f5ff;
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

.tabs {
  display: flex;
  background: #fff;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.tab-item {
  flex: 1;
  padding: 24rpx 0;
  text-align: center;
  font-size: 28rpx;
  color: #999;
  position: relative;
}

.tab-item.active {
  color: #1677FF;
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
  background: #1677FF;
  border-radius: 2rpx;
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

.icon-earn {
  background: #f6ffed;
}

.icon-earn text {
  color: #52c41a;
  font-size: 32rpx;
  font-weight: 700;
}

.icon-spend {
  background: #fff7e6;
}

.icon-spend text {
  color: #fa8c16;
  font-size: 32rpx;
  font-weight: 700;
}

.icon-expire {
  background: #fff2f0;
}

.icon-expire text {
  color: #ff4d4f;
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

.record-reason {
  font-size: 22rpx;
  color: #999;
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
  color: #52c41a;
}

.points-spend {
  color: #fa8c16;
}

.points-expire {
  color: #ff4d4f;
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