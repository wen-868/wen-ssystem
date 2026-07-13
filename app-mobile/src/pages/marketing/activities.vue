<template>
  <view class="activity-page">
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索活动名称"
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
      <view class="tab-item" :class="{ active: activeTab === 'active' }" @tap="switchTab('active')">
        <text>进行中</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'ended' }" @tap="switchTab('ended')">
        <text>已结束</text>
      </view>
    </view>

    <scroll-view class="activity-list" scroll-y v-if="list.length > 0">
      <view class="activity-item" v-for="item in list" :key="item.id">
        <view class="item-header">
          <view class="header-left">
            <view class="type-tag" :class="'type-' + item.type">
              <text>{{ item.typeText }}</text>
            </view>
            <text class="activity-name">{{ item.name }}</text>
          </view>
          <view class="status-tag" :class="'status-' + item.status">
            <text>{{ item.statusText }}</text>
          </view>
        </view>
        <view class="item-body">
          <view class="time-info">
            <text class="time-icon">&#xe617;</text>
            <text class="time-text">{{ formatTime(item.startTime) }} ~ {{ formatTime(item.endTime) }}</text>
          </view>
          <text class="activity-desc" v-if="item.description">{{ item.description }}</text>
        </view>
        <view class="item-footer">
          <view class="footer-btn" @tap="goRecords(item.id)">
            <text>参与记录</text>
          </view>
          <view class="footer-btn" v-if="item.status === 'draft'" @tap="handleStart(item)">
            <text>开始活动</text>
          </view>
          <view class="footer-btn" v-if="item.status === 'active'" @tap="handlePause(item)">
            <text>暂停活动</text>
          </view>
          <view class="footer-btn" v-if="item.status === 'paused'" @tap="handleStart(item)">
            <text>继续活动</text>
          </view>
          <view class="footer-btn delete" v-if="item.status !== 'active'" @tap="handleDelete(item)">
            <text>删除</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无营销活动</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { activityApi, type Activity } from '@/api/modules/marketing-activities'

const searchForm = reactive({
  keyword: '',
})

const activeTab = ref('all')
const list = ref<Activity[]>([])

function onSearch() {
  loadActivities()
}

function clearSearch() {
  searchForm.keyword = ''
  loadActivities()
}

function switchTab(tab: string) {
  activeTab.value = tab
  loadActivities()
}

function formatTime(time: string): string {
  return time.substring(0, 10)
}

function goRecords(id: number) {
  uni.navigateTo({
    url: `/pages/marketing/participation-records?activityId=${id}`
  })
}

async function handleStart(item: Activity) {
  uni.showModal({
    title: '确认开始',
    content: `确定要开始"${item.name}"活动吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await activityApi.start(item.id)
          uni.showToast({ title: '活动已开始', icon: 'success' })
          loadActivities()
        } catch (err) {
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}

async function handlePause(item: Activity) {
  uni.showModal({
    title: '确认暂停',
    content: `确定要暂停"${item.name}"活动吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await activityApi.pause(item.id)
          uni.showToast({ title: '活动已暂停', icon: 'success' })
          loadActivities()
        } catch (err) {
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}

async function handleDelete(item: Activity) {
  uni.showModal({
    title: '删除确认',
    content: `确定要删除"${item.name}"活动吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await activityApi.delete(item.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          loadActivities()
        } catch (err) {
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}

async function loadActivities() {
  try {
    const result = await activityApi.list({
      keyword: searchForm.keyword || undefined,
      status: activeTab.value === 'all' ? undefined : activeTab.value,
      page: 1,
      pageSize: 100
    })
    list.value = result.list
  } catch (err) {
    console.error('加载营销活动失败:', err)
  }
}

onMounted(() => {
  loadActivities()
})
</script>

<style scoped>
.activity-page {
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

.activity-list {
  padding: 16rpx 24rpx;
}

.activity-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16rpx;
}

.header-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.type-tag {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  margin-right: 12rpx;
  margin-bottom: 8rpx;
}

.type-discount { background: #fff7e6; color: #fa8c16; }
.type-full_reduction { background: #f6ffed; color: #52c41a; }
.type-points_mall { background: #f9f0ff; color: #722ed1; }
.type-limited_discount { background: #fff2f0; color: #ff4d4f; }

.activity-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.status-tag {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.status-draft { background: #f5f5f5; color: #999; }
.status-active { background: #f6ffed; color: #52c41a; }
.status-paused { background: #fff7e6; color: #fa8c16; }
.status-ended { background: #f0f0f0; color: #bbb; }

.item-body {
  margin-bottom: 16rpx;
}

.time-info {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.time-icon {
  font-size: 26rpx;
  color: #1677FF;
  margin-right: 8rpx;
}

.time-text {
  font-size: 26rpx;
  color: #666;
}

.activity-desc {
  font-size: 26rpx;
  color: #999;
  line-height: 1.5;
}

.item-footer {
  display: flex;
  gap: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f5f5f5;
}

.footer-btn {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 32rpx;
  font-size: 26rpx;
  color: #666;
}

.footer-btn.delete {
  background: #fff2f0;
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