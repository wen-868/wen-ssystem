<template>
  <view class="audit-logs-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe605;</text>
        <input
          class="search-input"
          placeholder="搜索操作内容"
          v-model="keyword"
          @confirm="onSearch"
        />
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
        <view
          class="type-item"
          :class="{ active: typeFilter === '' }"
          @tap="typeFilter = ''; onSearch()"
        >
          <text class="type-text">全部</text>
        </view>
        <view
          class="type-item"
          v-for="item in operationTypes"
          :key="item.value"
          :class="{ active: typeFilter === item.value }"
          @tap="typeFilter = item.value; onSearch()"
        >
          <text class="type-text">{{ item.label }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 日志列表 -->
    <scroll-view class="log-list" scroll-y @scrolltolower="onLoadMore">
      <view class="log-card" v-for="item in logList" :key="item.id" @tap="goDetail(item.id)">
        <view class="log-header">
          <view class="log-operator">
            <view class="operator-avatar">
              <text class="avatar-text">{{ item.operator.charAt(0) }}</text>
            </view>
            <view class="operator-info">
              <text class="operator-name">{{ item.operator }}</text>
              <text class="log-ip">{{ item.ip }}</text>
            </view>
          </view>
          <text class="log-time">{{ formatTime(item.createdAt) }}</text>
        </view>

        <view class="log-body">
          <view class="log-type-row">
            <text class="type-tag" :class="'type-' + item.operationType">{{ item.operationTypeName }}</text>
            <text class="target-text" v-if="item.targetRole">角色：{{ item.targetRole }}</text>
            <text class="target-text" v-if="item.targetUser">用户：{{ item.targetUser }}</text>
          </view>
          <text class="log-content">{{ item.content }}</text>
        </view>

        <view class="log-arrow">
          <text class="arrow-icon">&#xe600;</text>
        </view>
      </view>

      <view class="empty-state" v-if="logList.length === 0 && !loading">
        <text class="empty-text">暂无操作日志</text>
      </view>

      <!-- 分页加载 -->
      <view class="load-more" v-if="logList.length > 0">
        <text class="load-more-text" v-if="loading">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>
    </scroll-view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  reportPermissionApi,
  type PermissionAuditLog,
} from '@/api/modules/report-permission'

const logList = ref<PermissionAuditLog[]>([])
const operationTypes = ref<{ value: string; label: string }[]>([])
const keyword = ref('')
const startDate = ref('')
const endDate = ref('')
const typeFilter = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const loading = ref(false)
const noMore = ref(false)

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
  if (loading.value) return
  loading.value = true
  try {
    const res = await reportPermissionApi.getAuditLogs({
      page: page.value,
      pageSize,
      startTime: startDate.value || undefined,
      endTime: endDate.value || undefined,
      operationType: typeFilter.value || undefined,
      keyword: keyword.value || undefined,
    })
    if (page.value === 1) {
      logList.value = res.list
    } else {
      logList.value = [...logList.value, ...res.list]
    }
    total.value = res.total
    noMore.value = res.list.length < pageSize
  } catch (err) {
    console.error('加载审计日志失败:', err)
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  logList.value = []
  noMore.value = false
  loadLogs()
}

function onStartDateChange(e: any) {
  startDate.value = e.detail.value
}

function onEndDateChange(e: any) {
  endDate.value = e.detail.value
}

function onLoadMore() {
  if (loading.value || noMore.value) return
  page.value++
  loadLogs()
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages-sub/admin/report-permission/audit-detail?id=${id}` })
}

async function loadTypes() {
  try {
    const types = await reportPermissionApi.getAuditTypes()
    operationTypes.value = types
  } catch (err) {
    console.error('加载操作类型失败:', err)
  }
}

onMounted(() => {
  loadTypes()
  loadLogs()
})
</script>

<style scoped>
.audit-logs-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: env(safe-area-inset-bottom);
}

/* 搜索栏 */
.search-bar {
  display: flex;
  padding: 16rpx 24rpx;
  background: #fff;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 32rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 28rpx;
  color: #999;
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
  background: #1677FF;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn text {
  font-size: 28rpx;
  color: #fff;
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  padding: 16rpx 24rpx;
  background: #fff;
  border-top: 1rpx solid #f0f0f0;
  align-items: center;
}

.filter-item {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  background: #f5f5f5;
  border-radius: 12rpx;
}

.filter-text {
  font-size: 26rpx;
  color: #666;
}

.filter-divider {
  font-size: 24rpx;
  color: #999;
  margin: 0 16rpx;
}

/* 操作类型筛选 */
.type-scroll {
  background: #fff;
  border-top: 1rpx solid #f0f0f0;
  white-space: nowrap;
}

.type-list {
  display: inline-flex;
  padding: 16rpx 24rpx;
}

.type-item {
  padding: 12rpx 24rpx;
  margin-right: 16rpx;
  background: #f5f5f5;
  border-radius: 24rpx;
}

.type-item.active {
  background: #e6f4ff;
}

.type-text {
  font-size: 26rpx;
}

.type-item .type-text {
  color: #666;
}

.type-item.active .type-text {
  color: #1677FF;
}

/* 日志列表 */
.log-list {
  height: calc(100vh - 360rpx - env(safe-area-inset-bottom));
  padding: 16rpx 24rpx;
}

.log-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
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
  gap: 12rpx;
}

.operator-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 24rpx;
  color: #fff;
  font-weight: 600;
}

.operator-info {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}

.operator-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.log-ip {
  font-size: 22rpx;
  color: #999;
}

.log-time {
  font-size: 24rpx;
  color: #999;
}

.log-body {
  margin-bottom: 12rpx;
}

.log-type-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.type-tag {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.type-ROLE_PERMISSION_CHANGE {
  color: #1677FF;
  background: rgba(22, 119, 255, 0.1);
}

.type-DATA_SCOPE_CHANGE {
  color: #52c41a;
  background: rgba(82, 196, 26, 0.1);
}

.type-USER_ROLE_ASSIGN {
  color: #722ed1;
  background: rgba(114, 46, 209, 0.1);
}

.type-USER_PERMISSION_CHANGE {
  color: #fa8c16;
  background: rgba(250, 140, 22, 0.1);
}

.type-ROLE_CREATE {
  color: #13c2c2;
  background: rgba(19, 194, 194, 0.1);
}

.type-ROLE_DELETE {
  color: #ff4d4f;
  background: rgba(255, 77, 79, 0.1);
}

.target-text {
  font-size: 22rpx;
  color: #999;
}

.log-content {
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
}

.log-arrow {
  text-align: right;
  padding-top: 8rpx;
  border-top: 1rpx solid #f5f5f5;
}

.arrow-icon {
  font-size: 24rpx;
  color: #ccc;
}

.empty-state {
  padding: 100rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: #bbb;
}

.load-more {
  padding: 30rpx 0;
  text-align: center;
}

.load-more-text {
  font-size: 26rpx;
  color: #999;
}

.safe-bottom {
  height: 40rpx;
}
</style>
