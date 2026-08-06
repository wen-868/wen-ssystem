<template>
  <view class="logs-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe605;</text>
        <input class="search-input" placeholder="搜索操作内容" v-model="keyword" @confirm="onSearch" />
      </view>
      <view class="search-btn" @tap="onSearch">搜索</view>
    </view>

    <!-- 筛选栏 -->
    <view class="filter-bar">
      <picker mode="date" :value="startDate" @change="onStartDateChange">
        <view class="filter-item">
          <text class="filter-text">{{ startDate || '开始时间' }}</text>
        </view>
      </picker>
      <text class="filter-divider">至</text>
      <picker mode="date" :value="endDate" @change="onEndDateChange">
        <view class="filter-item">
          <text class="filter-text">{{ endDate || '结束时间' }}</text>
        </view>
      </picker>
    </view>

    <!-- 操作类型筛选 -->
    <scroll-view class="type-scroll" scroll-x>
      <view class="type-list">
        <view class="type-item" :class="{ active: typeFilter === '' }" @tap="typeFilter = ''">
          <text class="type-text">全部</text>
        </view>
        <view class="type-item" v-for="item in operationTypes" :key="item.value" :class="{ active: typeFilter === item.value }" @tap="typeFilter = item.value">
          <text class="type-text">{{ item.label }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 日志列表 -->
    <scroll-view class="log-list" scroll-y>
      <view class="log-card" v-for="item in logList" :key="item.id" @tap="goDetail(item.id)">
        <view class="log-header">
          <view class="log-operator">
            <text class="operator-icon">&#xe606;</text>
            <text class="operator-name">{{ item.operator }}</text>
          </view>
          <text class="log-time">{{ formatTime(item.createdAt) }}</text>
        </view>

        <view class="log-body">
          <view class="log-type">
            <text class="type-tag">{{ item.operationTypeName }}</text>
            <text class="module-name" v-if="item.moduleName">{{ item.moduleName }}</text>
          </view>
          <text class="log-content">{{ item.content }}</text>
        </view>

        <view class="log-footer">
          <text class="log-ip">{{ item.ip }}</text>
        </view>
      </view>

      <view class="empty-state" v-if="logList.length === 0">
        <text class="empty-text">暂无操作日志</text>
      </view>

      <!-- 分页加载 -->
      <view class="load-more" v-if="total > logList.length">
        <text class="load-more-text" v-if="loading">加载中...</text>
        <text class="load-more-text" v-else @tap="loadMore">点击加载更多</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { operationLogApi, type OperationLog, type OperationType } from '@/api/modules/operation-logs'

const logList = ref<OperationLog[]>([])
const operationTypes = ref<OperationType[]>([])
const keyword = ref('')
const startDate = ref('')
const endDate = ref('')
const typeFilter = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)

function formatTime(time: string): string {
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return time.split('T')[0]
}

async function loadLogs() {
  loading.value = true
  try {
    const res = await operationLogApi.list({
      page: page.value,
      pageSize: page.value,
      startTime: startDate.value || undefined,
      endTime: endDate.value || undefined,
      operationType: typeFilter.value || undefined,
      keyword: keyword.value || undefined
    })
    if (page.value === 1) {
      logList.value = res.list
      total.value = res.total
    } else {
      logList.value = [...logList.value, ...res.list]
    }
  } catch (err) {
    console.error('加载操作日志失败:', err)
    if (page.value === 1) {
      logList.value = []
      total.value = 0
    }
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  loadLogs()
}

function onStartDateChange(e: any) {
  startDate.value = e.detail.value
}

function onEndDateChange(e: any) {
  endDate.value = e.detail.value
}

function loadMore() {
  if (loading.value) return
  page.value++
  loadLogs()
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages-sub/admin/system/log-detail?id=${id}` })
}

async function loadTypes() {
  try {
    const types = await operationLogApi.getTypes()
    operationTypes.value = types
  } catch (err) {
    console.error('加载操作类型失败:', err)
  }
}

onMounted(() => {
  loadLogs()
  loadTypes()
})
</script>

<style lang="scss" scoped>
.logs-page {
  min-height: 100vh;
  background: $uni-bg-color-grey;
  padding-bottom: env(safe-area-inset-bottom);
}

/* --- 搜索栏 --- */
.search-bar {
  display: flex;
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: $uni-bg-color-grey;
  border-radius: 32rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 28rpx;
  color: $uni-gray-400;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  height: 64rpx;
  font-size: 28rpx;
}

.search-btn {
  margin-left: 16rpx;
  padding: 0 32rpx;
  height: 64rpx;
  background: $uni-color-primary;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn text {
  font-size: 28rpx;
  color: $uni-text-color-inverse;
}

/* --- 筛选栏 --- */
.filter-bar {
  display: flex;
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
  border-top: 1rpx solid $uni-gray-100;
  align-items: center;
}

.filter-item {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
}

.filter-text {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.filter-divider {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin: 0 16rpx;
}

/* --- 操作类型筛选 --- */
.type-scroll {
  background: $uni-bg-color;
  border-top: 1rpx solid $uni-gray-100;
  white-space: nowrap;
}

.type-list {
  display: inline-flex;
  padding: 16rpx 24rpx;
}

.type-item {
  padding: 12rpx 24rpx;
  margin-right: 16rpx;
  background: $uni-bg-color-grey;
  border-radius: 24rpx;
}

.type-item.active {
  background: $uni-color-primary-soft;
}

.type-text {
  font-size: 26rpx;
}

.type-item .type-text { color: $uni-gray-500; }
.type-item.active .type-text { color: $uni-color-primary; }

/* --- 日志列表 --- */
.log-list {
  height: calc(100vh - 320rpx - env(safe-area-inset-bottom));
}

.log-card {
  margin: 20rpx 24rpx;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.log-operator {
  display: flex;
  align-items: center;
}

.operator-icon {
  font-size: 32rpx;
  color: $uni-color-primary;
  margin-right: 12rpx;
}

.operator-name {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.log-time {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.log-body {
  margin-bottom: 16rpx;
}

.log-type {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.type-tag {
  font-size: 24rpx;
  color: $uni-color-primary;
  padding: 4rpx 12rpx;
  background: $uni-color-primary-soft;
  border-radius: 8rpx;
}

.module-name {
  font-size: 24rpx;
  color: $uni-gray-500;
  margin-left: 12rpx;
}

.log-content {
  font-size: 28rpx;
  color: $uni-gray-700;
  line-height: 1.6;
}

.log-footer {
  padding-top: 16rpx;
  border-top: 1rpx solid $uni-bg-color-grey;
}

.log-ip {
  font-size: 22rpx;
  color: $uni-gray-300;
}

.empty-state {
  padding: 100rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.load-more {
  padding: 30rpx 0;
  text-align: center;
}

.load-more-text {
  font-size: 26rpx;
  color: $uni-gray-400;
}
</style>
