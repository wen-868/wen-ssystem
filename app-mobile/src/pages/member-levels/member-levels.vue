<template>
  <view class="level-page">
    <view class="page-header">
      <view class="header-left">
        <text class="page-title">会员等级管理</text>
      </view>
      <view class="add-btn" @tap="goAdd">
        <text>+ 新增</text>
      </view>
    </view>

    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索等级名称"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
      </view>
    </view>

    <scroll-view class="level-list" scroll-y v-if="list.length > 0">
      <view class="level-item" v-for="item in list" :key="item.id">
        <view class="level-main" @tap="goEdit(item.id)">
          <view class="level-header">
            <view class="level-name-wrap">
              <text class="level-name">{{ item.name }}</text>
              <view class="status-tag" :class="'status-' + item.status">
                <text>{{ item.statusText }}</text>
              </view>
            </view>
            <text class="footer-arrow">&#xe60a;</text>
          </view>
          <view class="level-info">
            <view class="info-row">
              <text class="info-label">积分门槛</text>
              <text class="info-value">{{ item.minPoints }} 积分</text>
            </view>
            <view class="info-row">
              <text class="info-label">折扣率</text>
              <text class="info-value highlight">{{ item.discountRate }}%</text>
            </view>
            <view class="info-row" v-if="item.description">
              <text class="info-label">描述</text>
              <text class="info-value">{{ item.description }}</text>
            </view>
          </view>
        </view>
        <view class="level-actions">
          <view class="action-btn" @tap="toggleStatus(item)">
            <text>{{ item.status === 'active' ? '禁用' : '启用' }}</text>
          </view>
          <view class="action-btn delete" @tap="deleteLevel(item)">
            <text>删除</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无会员等级</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { memberLevelApi, type MemberLevel } from '@/api/modules/member-levels'

const searchForm = reactive({
  keyword: '',
})

const list = ref<MemberLevel[]>([])

function onSearch() {
  loadLevels()
}

function clearSearch() {
  searchForm.keyword = ''
  loadLevels()
}

function goAdd() {
  uni.navigateTo({
    url: '/pages/member-levels/level-config'
  })
}

function goEdit(id: number) {
  uni.navigateTo({
    url: `/pages/member-levels/level-config?id=${id}`
  })
}

async function toggleStatus(item: MemberLevel) {
  const newStatus = item.status === 'active' ? 'disabled' : 'active'
  const action = item.status === 'active' ? '禁用' : '启用'
  
  uni.showModal({
    title: `${action}确认`,
    content: `确定要${action}"${item.name}"等级吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await memberLevelApi.toggleStatus(item.id, newStatus)
          uni.showToast({ title: `${action}成功`, icon: 'success' })
          loadLevels()
        } catch (err) {
          uni.showToast({ title: `${action}失败`, icon: 'none' })
        }
      }
    }
  })
}

async function deleteLevel(item: MemberLevel) {
  uni.showModal({
    title: '删除确认',
    content: `确定要删除"${item.name}"等级吗？此操作不可恢复。`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await memberLevelApi.delete(item.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          loadLevels()
        } catch (err) {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    }
  })
}

async function loadLevels() {
  try {
    const result = await memberLevelApi.list({
      keyword: searchForm.keyword || undefined,
      page: 1,
      pageSize: 100
    })
    list.value = result.list
  } catch (err) {
    console.error('加载会员等级失败:', err)
  }
}

onMounted(() => {
  loadLevels()
})
</script>

<style scoped>
.level-page {
  min-height: 100vh;
  background: #f0f5ff;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
  background: #fff;
  padding-top: calc(20rpx + env(safe-area-inset-top));
}

.header-left {
  flex: 1;
}

.page-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}

.add-btn {
  padding: 12rpx 24rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 32rpx;
  font-size: 26rpx;
  color: #fff;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: #fff;
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

.level-list {
  padding: 16rpx 24rpx;
}

.level-item {
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.level-main {
  padding: 24rpx;
}

.level-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.level-name-wrap {
  display: flex;
  align-items: center;
}

.level-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-right: 12rpx;
}

.status-tag {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.status-active { background: #f6ffed; color: #52c41a; }
.status-disabled { background: #fff2f0; color: #ff4d4f; }

.footer-arrow {
  font-size: 28rpx;
  color: #ccc;
}

.level-info {
  background: #fafafa;
  border-radius: 12rpx;
  padding: 16rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  font-size: 26rpx;
  color: #999;
}

.info-value {
  font-size: 26rpx;
  color: #333;
}

.info-value.highlight {
  color: #1677FF;
  font-weight: 600;
}

.level-actions {
  display: flex;
  border-top: 1rpx solid #f5f5f5;
}

.action-btn {
  flex: 1;
  padding: 20rpx;
  text-align: center;
  font-size: 28rpx;
  color: #666;
  border-right: 1rpx solid #f5f5f5;
}

.action-btn:last-child {
  border-right: none;
}

.action-btn.delete {
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