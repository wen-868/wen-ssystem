<template>
  <view class="audit-logs-page">
    <page-header title="权限审计日志" @back="goBack" />
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/chevron-left.svg" mode="aspectFit"/>
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
          <image class="arrow-icon ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/>
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
import pageHeader from '@/components/page-header/page-header.vue'

function goBack() {
  uni.navigateBack()
}
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

<style lang="scss" scoped>
.audit-logs-page {
  min-height: 100vh;
  background: $uni-bg-color-grey;
  padding-bottom: env(safe-area-inset-bottom);
}

/* 搜索栏 */
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

/* 筛选栏 */
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
  padding: $uni-spacing-sm 0;
  background: $uni-bg-color-grey;
  border-radius: $uni-border-radius-xs;
}

.filter-text {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.filter-divider {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin: 0 $uni-spacing-sm;
}

/* 操作类型筛选 */
.type-scroll {
  background: $uni-bg-color;
  border-top: 1rpx solid $uni-gray-100;
  white-space: nowrap;
}

.type-list {
  display: inline-flex;
  padding: $uni-spacing-sm $uni-spacing-lg;
}

.type-item {
  padding: $uni-spacing-sm $uni-spacing-base;
  margin-right: $uni-spacing-sm;
  background: $uni-bg-color-grey;
  border-radius: $uni-border-radius-sm;
}

.type-item.active {
  background: $uni-color-primary-soft;
}

.type-text {
  font-size: 26rpx;
}

.type-item .type-text {
  color: $uni-gray-500;
}

.type-item.active .type-text {
  color: $uni-color-primary;
}

/* 日志列表 */
.log-list {
  height: calc(100vh - 360rpx - env(safe-area-inset-bottom));
  padding: $uni-spacing-sm $uni-spacing-lg;
}

.log-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-md;
  box-shadow: 0 4rpx 20rpx $zx-black-40;
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
  gap: $uni-spacing-sm;
}

.operator-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 24rpx;
  color: $uni-text-color-inverse;
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
  color: $uni-gray-700;
}

.log-ip {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.log-time {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.log-body {
  margin-bottom: $uni-spacing-sm;
}

.log-type-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $uni-spacing-sm;
  margin-bottom: $uni-spacing-sm;
}

.type-tag {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.type-ROLE_PERMISSION_CHANGE {
  color: $uni-color-primary;
  background: $zx-antblue-100;
}

.type-DATA_SCOPE_CHANGE {
  color: $uni-color-success;
  background: $zx-antgreen-100;
}

.type-USER_ROLE_ASSIGN {
  color: $uni-color-purple;
  background: $zx-purple-soft-10;
}

.type-USER_PERMISSION_CHANGE {
  color: $uni-color-warning;
  background: $zx-antorange-100;
}

.type-ROLE_CREATE {
  color: $uni-color-cyan;
  background: $zx-cyan-soft-10;
}

.type-ROLE_DELETE {
  color: $uni-color-error;
  background: $zx-antred-100;
}

.target-text {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.log-content {
  font-size: 28rpx;
  color: $uni-gray-700;
  line-height: 1.6;
}

.log-arrow {
  text-align: right;
  padding-top: $uni-spacing-xs;
  border-top: 1rpx solid $uni-bg-color-grey;
}

.arrow-icon {
  font-size: 24rpx;
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
  padding: $uni-spacing-lg 0;
  text-align: center;
}

.load-more-text {
  font-size: 26rpx;
  color: $uni-gray-400;
}

.safe-bottom {
  height: 40rpx;
}
</style>
