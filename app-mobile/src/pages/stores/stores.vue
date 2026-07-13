<template>
  <view class="stores-page">
    <view class="page-header">
      <text class="header-title">门店管理</text>
    </view>

    <view class="search-bar">
      <input class="search-input" type="text" v-model="keyword" placeholder="搜索门店名称" @confirm="onSearch" />
    </view>

    <scroll-view class="store-scroll" scroll-y v-if="list.length > 0" @scrolltolower="onLoadMore">
      <view class="store-card" v-for="store in list" :key="store.id" @tap="goEdit(store.id)">
        <view class="card-header">
          <text class="store-name">{{ store.name }}</text>
          <view class="status-tag" :class="store.status === 1 ? 'status-tag--on' : 'status-tag--off'">
            <text class="status-tag-text">{{ store.status === 1 ? '营业中' : '已停业' }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row" v-if="store.code">
            <text class="info-label">门店编码</text>
            <text class="info-value">{{ store.code }}</text>
          </view>
          <view class="info-row" v-if="store.phone">
            <text class="info-label">联系电话</text>
            <text class="info-value">{{ store.phone }}</text>
          </view>
          <view class="info-row" v-if="store.contactName">
            <text class="info-label">联系人</text>
            <text class="info-value">{{ store.contactName }}</text>
          </view>
          <view class="info-row" v-if="store.address">
            <text class="info-label">地址</text>
            <text class="info-value">{{ store.address }}</text>
          </view>
          <view class="info-row" v-if="store.businessHours">
            <text class="info-label">营业时间</text>
            <text class="info-value">{{ store.businessHours }}</text>
          </view>
        </view>
        <view class="card-footer">
          <button class="btn-sm" :class="store.status === 1 ? 'btn-sm--danger' : 'btn-sm--success'" @tap.stop="toggleStatus(store)">
            {{ store.status === 1 ? '停业' : '恢复营业' }}
          </button>
        </view>
      </view>

      <view class="load-more" v-if="list.length > 0">
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>

    <view class="empty-state" v-else-if="!loading">
      <text class="empty-text">暂无门店</text>
    </view>

    <view class="fab-btn" @tap="goCreate">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storesApi, type StoreInfo } from '@/api/modules/stores'

const loading = ref(false)
const loadingMore = ref(false)
const list = ref<StoreInfo[]>([])
const keyword = ref('')
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

async function loadList() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await storesApi.list({ page: page.value, pageSize, keyword: keyword.value || undefined })
    list.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载门店列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    page.value++
    const result = await storesApi.list({ page: page.value, pageSize, keyword: keyword.value || undefined })
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
  uni.navigateTo({ url: '/pages/stores/store-edit' })
}

function goEdit(id: number) {
  uni.navigateTo({ url: `/pages/stores/store-edit?id=${id}` })
}

async function toggleStatus(store: StoreInfo) {
  const newStatus = store.status === 1 ? 0 : 1
  const action = newStatus === 1 ? '恢复营业' : '停业'
  uni.showModal({
    title: '确认操作',
    content: `确定要${action}「${store.name}」吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await storesApi.updateStatus(store.id, newStatus)
          uni.showToast({ title: '操作成功', icon: 'success' })
          store.status = newStatus
        } catch (err) {
          console.error('切换状态失败:', err)
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    },
  })
}

loadList()
</script>

<style scoped>
.stores-page { min-height: 100vh; background: #f0f5ff; display: flex; flex-direction: column; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: #fff; }
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.search-bar { padding: 16rpx 24rpx; background: #fff; }
.search-input { width: 100%; height: 64rpx; background: #f5f7fa; border-radius: 32rpx; padding: 0 32rpx; font-size: 26rpx; }
.store-scroll { flex: 1; padding: 16rpx 24rpx; }
.store-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; padding-bottom: 12rpx; border-bottom: 1rpx solid #f0f0f0; }
.store-name { font-size: 30rpx; font-weight: 600; color: #333; }
.status-tag { padding: 4rpx 16rpx; border-radius: 8rpx; }
.status-tag--on { background: rgba(82,196,26,0.1); }
.status-tag--off { background: rgba(255,77,79,0.1); }
.status-tag-text { font-size: 22rpx; }
.status-tag--on .status-tag-text { color: #52c41a; }
.status-tag--off .status-tag-text { color: #ff4d4f; }
.card-body { display: flex; flex-direction: column; gap: 8rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.card-footer { display: flex; justify-content: flex-end; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid #f0f0f0; }
.btn-sm { font-size: 24rpx; padding: 8rpx 24rpx; border-radius: 8rpx; border: none; line-height: 1.8; }
.btn-sm--danger { background: #fff; color: #ff4d4f; border: 1rpx solid #ff4d4f; }
.btn-sm--success { background: #52c41a; color: #fff; }
.load-more { text-align: center; padding: 24rpx 0; }
.load-more-text { font-size: 24rpx; color: #bbb; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 200rpx 0; }
.empty-text { font-size: 28rpx; color: #bbb; }
.fab-btn { position: fixed; right: 40rpx; bottom: calc(60rpx + env(safe-area-inset-bottom)); width: 100rpx; height: 100rpx; border-radius: 50%; background: linear-gradient(135deg, #1677FF, #4096ff); display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(22,119,255,0.4); }
.fab-icon { font-size: 56rpx; color: #fff; font-weight: 300; }
.safe-bottom { height: 40rpx; }
</style>
