<template>
  <view class="activity-page">
    <page-header title="营销活动" @back="goBack" />
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索活动名称"
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
            <image class="time-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
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
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无营销活动</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import pageHeader from '@/components/page-header/page-header.vue'

function goBack() {
  uni.navigateBack()
}
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
    // R100-02：满减活动暂无参与记录数据源，页面按 type=full_reduction 展示空态
    url: `/pages-sub/marketing/marketing/participation-records?activityId=${id}&type=full_reduction`
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

<style lang="scss" scoped>
.activity-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
  padding-top: calc(16rpx + var(--safe-top));
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

.activity-list {
  padding: $uni-spacing-sm $uni-spacing-lg;
}

.activity-item {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-sm;
  box-shadow: 0 2rpx 12rpx $zx-black-40;
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

.type-discount { background: $uni-color-warning-soft; color: $uni-color-warning; }
.type-full_reduction { background: $uni-color-success-soft; color: $uni-color-success; }
.type-points_mall { background: $uni-color-purple-soft; color: $uni-color-purple; }
.type-limited_discount { background: $uni-color-error-soft; color: $uni-color-error; }

.activity-name {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.status-tag {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.status-draft { background: $uni-bg-color-grey; color: $uni-gray-400; }
.status-active { background: $uni-color-success-soft; color: $uni-color-success; }
.status-paused { background: $uni-color-warning-soft; color: $uni-color-warning; }
.status-ended { background: $uni-gray-100; color: $uni-gray-300; }

.item-body {
  margin-bottom: $uni-spacing-sm;
}

.time-info {
  display: flex;
  align-items: center;
  margin-bottom: $uni-spacing-xs;
}

.time-icon {
  font-size: 26rpx;
  color: $uni-color-primary;
  margin-right: $uni-spacing-xs;
}

.time-text {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.activity-desc {
  font-size: 26rpx;
  color: $uni-gray-400;
  line-height: 1.5;
}

.item-footer {
  display: flex;
  gap: $uni-spacing-sm;
  padding-top: $uni-spacing-sm;
  border-top: 1rpx solid $uni-bg-color-grey;
}

.footer-btn {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $uni-bg-color-page;
  border-radius: 32rpx;
  font-size: 26rpx;
  color: $uni-gray-500;
}

.footer-btn.delete {
  background: $uni-color-error-soft;
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
  margin-bottom: $uni-spacing-md;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
