<template>
  <view class="roles-page">
    <view class="page-header">
            <view class="header-back" @tap="goBack"><text class="header-back-icon">‹</text></view>
      <text class="header-title">角色权限</text>
    </view>

    <view class="search-bar">
      <input class="search-input" type="text" v-model="keyword" placeholder="搜索角色名称" @confirm="onSearch" />
    </view>

    <scroll-view class="role-scroll" scroll-y v-if="list.length > 0" @scrolltolower="onLoadMore">
      <view class="role-card" v-for="role in list" :key="role.id" @tap="goEdit(role.id)">
        <view class="card-header">
          <view class="role-info">
            <text class="role-name">{{ role.name }}</text>
            <text class="role-code">{{ role.code }}</text>
          </view>
          <view class="status-tag" :class="role.status === 1 ? 'status-tag--on' : 'status-tag--off'">
            <text class="status-tag-text">{{ role.status === 1 ? '启用' : '禁用' }}</text>
          </view>
        </view>
        <view class="card-body">
          <text class="role-remark" v-if="role.remark">{{ role.remark }}</text>
          <view class="role-meta">
            <text class="meta-text" v-if="role.userCount != null">用户数：{{ role.userCount }}</text>
            <text class="meta-text" v-if="role.permissions">{{ role.permissions.length }}个权限</text>
          </view>
        </view>
        <view class="card-actions">
          <button class="btn-sm btn-sm--primary" @tap.stop="goEdit(role.id)">编辑</button>
          <button class="btn-sm btn-sm--danger" @tap.stop="onDelete(role)">删除</button>
        </view>
      </view>

      <view class="load-more" v-if="list.length > 0">
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>

    <view class="empty-state" v-else-if="!loading">
      <text class="empty-text">暂无角色</text>
    </view>

    <view class="fab-btn" @tap="goCreate">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref } from 'vue'
import { rolesApi, type RoleInfo } from '@/api/modules/roles'

const loading = ref(false)
const loadingMore = ref(false)
const list = ref<RoleInfo[]>([])
const keyword = ref('')
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

async function loadList() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await rolesApi.list({ page: page.value, pageSize, keyword: keyword.value || undefined })
    list.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载角色列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    page.value++
    const result = await rolesApi.list({ page: page.value, pageSize, keyword: keyword.value || undefined })
    if (result.list.length === 0) { noMore.value = true; page.value-- }
    else list.value = [...list.value, ...result.list]
  } catch (err) {
    page.value--
    console.error('加载更多失败:', err)
  } finally {
    loadingMore.value = false
  }
}

function onSearch() {
  page.value = 1
  list.value = []
  noMore.value = false
  loadList()
}

function goCreate() {
  uni.navigateTo({ url: '/pages-sub/admin/roles/role-edit' })
}

function goEdit(id: number) {
  uni.navigateTo({ url: `/pages-sub/admin/roles/role-edit?id=${id}` })
}

function onDelete(role: RoleInfo) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除角色「${role.name}」吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await rolesApi.remove(role.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          list.value = list.value.filter(r => r.id !== role.id)
        } catch (err) {
          console.error('删除失败:', err)
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    },
  })
}

loadList()
</script>

<style lang="scss" scoped>
.roles-page { min-height: 100vh; background: $uni-color-primary-soft; display: flex; flex-direction: column; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: $uni-bg-color; }
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.search-bar { padding: 16rpx 24rpx; background: $uni-bg-color; }
.search-input { width: 100%; height: 64rpx; background: $uni-bg-color-page; border-radius: 32rpx; padding: 0 32rpx; font-size: 26rpx; }
.role-scroll { flex: 1; padding: 16rpx 24rpx; }
.role-card { background: $uni-bg-color; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; padding-bottom: 12rpx; border-bottom: 1rpx solid $uni-gray-100; }
.role-info { display: flex; flex-direction: column; gap: 4rpx; }
.role-name { font-size: 30rpx; font-weight: 600; color: $uni-gray-700; }
.role-code { font-size: 22rpx; color: $uni-gray-400; }
.status-tag { padding: 4rpx 16rpx; border-radius: 8rpx; }
.status-tag--on { background: rgba(82,196,26,0.1); }
.status-tag--off { background: rgba(255,77,79,0.1); }
.status-tag-text { font-size: 22rpx; }
.status-tag--on .status-tag-text { color: $uni-color-success; }
.status-tag--off .status-tag-text { color: $uni-color-error; }
.card-body { margin-bottom: 16rpx; }
.role-remark { font-size: 26rpx; color: $uni-gray-500; display: block; margin-bottom: 8rpx; }
.role-meta { display: flex; gap: 24rpx; }
.meta-text { font-size: 22rpx; color: $uni-gray-400; }
.card-actions { display: flex; gap: 16rpx; justify-content: flex-end; padding-top: 12rpx; border-top: 1rpx solid $uni-gray-100; }
.btn-sm { font-size: 24rpx; padding: 8rpx 24rpx; border-radius: 8rpx; border: none; line-height: 1.8; }
.btn-sm--primary { background: $uni-color-primary; color: $uni-text-color-inverse; }
.btn-sm--danger { background: $uni-text-color-inverse; color: $uni-color-error; border: 1rpx solid $uni-color-error; }
.load-more { text-align: center; padding: 24rpx 0; }
.load-more-text { font-size: 24rpx; color: $uni-gray-300; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 200rpx 0; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.fab-btn { position: fixed; right: 40rpx; bottom: calc(60rpx + env(safe-area-inset-bottom)); width: 100rpx; height: 100rpx; border-radius: 50%; background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary); display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(22,119,255,0.4); }
.fab-icon { font-size: 56rpx; color: $uni-text-color-inverse; font-weight: 300; }
.safe-bottom { height: 40rpx; }
</style>
