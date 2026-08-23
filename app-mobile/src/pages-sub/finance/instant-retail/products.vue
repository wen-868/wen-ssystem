<template>
  <view class="retail-products-page">
    <view class="page-header">
            <view class="header-back" @tap="goBack"><text class="header-back-icon">‹</text></view>
      <text class="header-title">商品上架管理</text>
    </view>

    <view class="filter-bar">
      <input class="search-input" type="text" v-model="keyword" placeholder="搜索商品名称" @confirm="onSearch" />
      <view class="status-filter" @tap="cycleStatusFilter">
        <text class="filter-text">{{ statusFilterText }}</text>
      </view>
    </view>

    <scroll-view class="product-scroll" scroll-y v-if="list.length > 0" @scrolltolower="onLoadMore">
      <view class="product-card" v-for="item in list" :key="item.id">
        <view class="card-top">
          <image class="product-img" v-if="item.image" :src="item.image" mode="aspectFill" />
          <view class="product-img-placeholder" v-else>
            <text class="placeholder-text">{{ item.name.charAt(0) }}</text>
          </view>
          <view class="product-info">
            <text class="product-name">{{ item.name }}</text>
            <text class="product-category" v-if="item.category">{{ item.category }}</text>
            <text class="product-sku" v-if="item.skuId">SKU: {{ item.skuId }}</text>
          </view>
          <view class="shelf-tag" :class="getShelfStatusClass(item.shelfStatus)">
            <text class="shelf-tag-text">{{ item.shelfStatusText || getShelfStatusText(item.shelfStatus) }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">零售价</text>
            <text class="info-value">¥{{ (item.price || 0).toFixed(2) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">库存</text>
            <text class="info-value">{{ item.stock }}</text>
          </view>
        </view>
        <view class="card-actions">
          <button class="btn-sm btn-sm--primary" v-if="item.shelfStatus !== 'ONLINE'" @tap="onEditPrice(item)">改价/上架</button>
          <button class="btn-sm btn-sm--warning" v-if="item.shelfStatus === 'ONLINE'" @tap="onEditPrice(item)">改价</button>
          <button class="btn-sm btn-sm--danger" @tap="onRemove(item)">下架</button>
        </view>
      </view>

      <view class="load-more" v-if="list.length > 0">
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>

    <view class="empty-state" v-else-if="!loading">
      <text class="empty-text">暂无零售商品</text>
    </view>

    <view class="fab-btn" @tap="onAddProduct">
      <text class="fab-icon">+</text>
    </view>

    <view class="edit-modal" v-if="editVisible" @tap="closeEdit">
      <view class="edit-content" @tap.stop>
        <view class="edit-header">
          <text class="edit-title">{{ editingItem ? '改价' : '添加商品' }}</text>
          <text class="close-btn" @tap="closeEdit">X</text>
        </view>
        <view class="edit-body">
          <view class="form-item" v-if="!editingItem">
            <text class="form-label">商品ID</text>
            <input class="form-input" type="number" v-model="addForm.productId" placeholder="请输入系统商品ID" />
          </view>
          <view class="form-item">
            <text class="form-label">零售价</text>
            <input class="form-input" type="digit" v-model="priceForm.price" placeholder="请输入零售价" />
          </view>
          <view class="form-item" v-if="!editingItem">
            <text class="form-label">分类</text>
            <input class="form-input" type="text" v-model="addForm.category" placeholder="请输入分类（选填）" />
          </view>
        </view>
        <view class="edit-footer">
          <button class="btn btn--primary btn--block" @tap="onSaveEdit">确认</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, computed } from 'vue'
import { instantRetailApi, type RetailProduct } from '@/api/modules/instant-retail'

const loading = ref(false)
const loadingMore = ref(false)
const list = ref<RetailProduct[]>([])
const keyword = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

const editVisible = ref(false)
const editingItem = ref<RetailProduct | null>(null)
const priceForm = reactive({ price: '' })
const addForm = reactive({ productId: '', category: '' })

const statusFilterText = computed(() => {
  const map: Record<string, string> = { '': '全部状态', ONLINE: '已上架', OFFLINE: '已下架', PENDING: '待上架' }
  return map[statusFilter.value] ?? '全部状态'
})

function getShelfStatusText(status?: string): string {
  const map: Record<string, string> = { ONLINE: '已上架', OFFLINE: '已下架', PENDING: '待上架' }
  return map[status ?? ''] ?? status ?? ''
}

function getShelfStatusClass(status?: string): string {
  if (status === 'ONLINE') return 'shelf-tag--online'
  if (status === 'OFFLINE') return 'shelf-tag--offline'
  return 'shelf-tag--pending'
}

function cycleStatusFilter() {
  const order = ['', 'ONLINE', 'OFFLINE', 'PENDING']
  const idx = order.indexOf(statusFilter.value)
  statusFilter.value = order[(idx + 1) % order.length]
  page.value = 1
  list.value = []
  noMore.value = false
  loadList()
}

async function loadList() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await instantRetailApi.listProducts({
      page: page.value, pageSize,
      keyword: keyword.value || undefined,
      shelfStatus: statusFilter.value || undefined,
    })
    list.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载商品列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    page.value++
    const result = await instantRetailApi.listProducts({
      page: page.value, pageSize,
      keyword: keyword.value || undefined,
      shelfStatus: statusFilter.value || undefined,
    })
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

function onAddProduct() {
  editingItem.value = null
  priceForm.price = ''
  addForm.productId = ''
  addForm.category = ''
  editVisible.value = true
}

function onEditPrice(item: RetailProduct) {
  editingItem.value = item
  priceForm.price = String(item.price)
  editVisible.value = true
}

function closeEdit() {
  editVisible.value = false
  editingItem.value = null
}

async function onSaveEdit() {
  if (editingItem.value) {
    try {
      await instantRetailApi.updateProduct(editingItem.value.id, { price: Number(priceForm.price) })
      uni.showToast({ title: '改价成功', icon: 'success' })
      closeEdit()
      page.value = 1; list.value = []; noMore.value = false; loadList()
    } catch (err) {
      console.error('改价失败:', err)
      uni.showToast({ title: '操作失败', icon: 'none' })
    }
  } else {
    if (!addForm.productId) {
      uni.showToast({ title: '请输入商品ID', icon: 'none' })
      return
    }
    try {
      await instantRetailApi.addProduct({
        productId: Number(addForm.productId),
        price: priceForm.price ? Number(priceForm.price) : undefined,
        category: addForm.category || undefined,
      })
      uni.showToast({ title: '上架成功', icon: 'success' })
      closeEdit()
      page.value = 1; list.value = []; noMore.value = false; loadList()
    } catch (err) {
      console.error('上架失败:', err)
      uni.showToast({ title: '操作失败', icon: 'none' })
    }
  }
}

function onRemove(item: RetailProduct) {
  uni.showModal({
    title: '确认下架',
    content: `确定要下架「${item.name}」吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await instantRetailApi.removeProduct(item.id)
          uni.showToast({ title: '下架成功', icon: 'success' })
          list.value = list.value.filter(p => p.id !== item.id)
        } catch (err) {
          console.error('下架失败:', err)
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    },
  })
}

loadList()
</script>

<style lang="scss" scoped>
.retail-products-page { min-height: 100vh; background: $uni-color-primary-soft; display: flex; flex-direction: column; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: $uni-bg-color; }
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.filter-bar { display: flex; gap: 16rpx; padding: 16rpx 24rpx; background: $uni-bg-color; }
.search-input { flex: 1; height: 64rpx; background: $uni-bg-color-page; border-radius: 32rpx; padding: 0 32rpx; font-size: 26rpx; }
.status-filter { background: $uni-bg-color-page; border-radius: 32rpx; padding: 0 24rpx; display: flex; align-items: center; }
.filter-text { font-size: 24rpx; color: $uni-gray-500; }
.product-scroll { flex: 1; padding: 16rpx 24rpx; }
.product-card { background: $uni-bg-color; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.card-top { display: flex; gap: 16rpx; margin-bottom: 16rpx; padding-bottom: 16rpx; border-bottom: 1rpx solid $uni-gray-100; }
.product-img { width: 100rpx; height: 100rpx; border-radius: 12rpx; flex-shrink: 0; }
.product-img-placeholder { width: 100rpx; height: 100rpx; border-radius: 12rpx; background: $uni-gray-100; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.placeholder-text { font-size: 32rpx; color: $uni-gray-300; }
.product-info { flex: 1; display: flex; flex-direction: column; gap: 6rpx; }
.product-name { font-size: 28rpx; font-weight: 600; color: $uni-gray-700; }
.product-category { font-size: 22rpx; color: $uni-gray-400; }
.product-sku { font-size: 22rpx; color: $uni-gray-400; }
.shelf-tag { padding: 4rpx 16rpx; border-radius: 8rpx; align-self: flex-start; }
.shelf-tag--online { background: rgba(82,196,26,0.1); }
.shelf-tag--offline { background: rgba(255,77,79,0.1); }
.shelf-tag--pending { background: rgba(250,173,20,0.1); }
.shelf-tag-text { font-size: 22rpx; }
.shelf-tag--online .shelf-tag-text { color: $uni-color-success; }
.shelf-tag--offline .shelf-tag-text { color: $uni-color-error; }
.shelf-tag--pending .shelf-tag-text { color: $uni-color-warning; }
.card-body { display: flex; gap: 32rpx; margin-bottom: 16rpx; }
.info-row { display: flex; gap: 8rpx; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; font-weight: 500; }
.card-actions { display: flex; gap: 12rpx; }
.btn-sm { flex: 1; font-size: 24rpx; padding: 12rpx 0; border-radius: 8rpx; border: none; line-height: 1.6; }
.btn-sm--primary { background: $uni-color-primary; color: $uni-text-color-inverse; }
.btn-sm--warning { background: rgba(250,173,20,0.1); color: $uni-color-warning; }
.btn-sm--danger { background: $uni-text-color-inverse; color: $uni-color-error; border: 1rpx solid $uni-color-error; }
.load-more { text-align: center; padding: 24rpx 0; }
.load-more-text { font-size: 24rpx; color: $uni-gray-300; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 200rpx 0; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.fab-btn { position: fixed; right: 40rpx; bottom: calc(60rpx + env(safe-area-inset-bottom)); width: 100rpx; height: 100rpx; border-radius: 50%; background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary); display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 24rpx rgba(22,119,255,0.4); }
.fab-icon { font-size: 56rpx; color: $uni-text-color-inverse; font-weight: 300; }
.safe-bottom { height: 40rpx; }
.edit-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: center; justify-content: center; }
.edit-content { width: 90%; max-width: 600rpx; background: $uni-bg-color; border-radius: 24rpx; }
.edit-header { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 32rpx; border-bottom: 1rpx solid $uni-gray-100; }
.edit-title { font-size: 30rpx; font-weight: 600; color: $uni-gray-700; }
.close-btn { font-size: 32rpx; color: $uni-gray-400; padding: 8rpx 16rpx; }
.edit-body { padding: 24rpx 32rpx; }
.form-item { display: flex; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid $uni-bg-color-grey; }
.form-label { font-size: 28rpx; color: $uni-gray-700; width: 160rpx; flex-shrink: 0; }
.form-input { flex: 1; height: 60rpx; font-size: 28rpx; color: $uni-gray-700; }
.edit-footer { padding: 16rpx 32rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); }
.btn { height: 80rpx; line-height: 80rpx; border-radius: 12rpx; font-size: 28rpx; text-align: center; border: none; }
.btn--primary { background: $uni-color-primary; color: $uni-text-color-inverse; }
.btn--block { width: 100%; }
</style>
