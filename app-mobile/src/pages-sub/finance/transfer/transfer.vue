<template>
  <view class="transfer-page">
    <view class="page-header">
            <view class="header-back" @tap="goBack"><text class="header-back-icon">‹</text></view>
      <text class="header-title">库存调拨</text>
    </view>

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索调拨单号 / 商品名称"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
        </view>
      </view>
    </form>

    <!-- 状态筛选 -->
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ 'tab-item--active': activeTab === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
      </view>
    </view>

    <!-- 新建按钮 -->
    <view class="create-section">
      <button class="create-btn" @tap="goCreate">
        <text>+ 新建调拨单</text>
      </button>
    </view>

    <!-- 调拨单列表 -->
    <scroll-view class="transfer-list" scroll-y v-if="list.length > 0">
      <view class="transfer-card" v-for="item in list" :key="item.transferNo">
        <view class="card-header">
          <text class="transfer-no">{{ item.transferNo }}</text>
          <view class="transfer-status" :class="'status-' + item.status">
            <text class="status-text">{{ item.statusLabel }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">调出仓库</text>
            <text class="info-value">{{ item.fromStore }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">调入仓库</text>
            <text class="info-value">{{ item.toStore }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">商品数</text>
            <text class="info-value">{{ item.itemCount }} 种</text>
          </view>
          <view class="info-row">
            <text class="info-label">调拨数量</text>
            <text class="info-value">{{ item.totalQty }} 件</text>
          </view>
          <view class="info-row">
            <text class="info-label">创建时间</text>
            <text class="info-value">{{ item.createTime }}</text>
          </view>
        </view>
        <view class="card-actions" v-if="item.status === 'pending'">
          <button class="action-btn approve-btn" @tap="handleApprove(item)">审核通过</button>
          <button class="action-btn reject-btn" @tap="handleReject(item)">驳回</button>
        </view>
        <view class="card-actions" v-else-if="item.status === 'approved'">
          <button class="action-btn stock-btn" @tap="handleInStock(item)">确认入库</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无调拨单</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const tabs = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'pending' },
  { label: '已审核', value: 'approved' },
  { label: '已完成', value: 'completed' },
  { label: '已驳回', value: 'rejected' },
]
const activeTab = ref('')
const list = ref<any[]>([])
const loading = ref(false)

function onSearch() { loadTransfers() }
function clearSearch() { searchForm.keyword = ''; loadTransfers() }
function switchTab(val: string) { activeTab.value = val; loadTransfers() }
function goCreate() {
  uni.navigateTo({ url: '/pages-sub/finance/transfer/create' })
}

function handleApprove(item: any) {
  uni.showModal({
    title: '审核通过',
    content: '确认审核通过该调拨单？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已通过', icon: 'success' })
      }
    }
  })
}

function handleReject(item: any) {
  uni.showModal({
    title: '驳回',
    content: '确认驳回该调拨单？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已驳回', icon: 'success' })
      }
    }
  })
}

function handleInStock(item: any) {
  uni.showModal({
    title: '确认入库',
    content: '确认商品已入库？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已入库', icon: 'success' })
      }
    }
  })
}

async function loadTransfers() {
  loading.value = true
  try {
    list.value = []
  } catch (err) {
    console.error('加载调拨单失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadTransfers() })
</script>

<style lang="scss" scoped>
.transfer-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.search-bar { padding: 16rpx 24rpx; background: $uni-bg-color; }
.search-input-wrap {
  display: flex; align-items: center;
  height: 72rpx; background: $uni-bg-color-page;
  border-radius: 36rpx; padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.search-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: $uni-gray-300; padding: 4rpx; }
.tab-bar {
  display: flex; background: $uni-bg-color;
  padding: 0 16rpx 16rpx; gap: 8rpx;
}
.tab-item {
  flex: 1; height: 60rpx;
  display: flex; align-items: center; justify-content: center;
  background: $uni-bg-color-page; border-radius: 30rpx;
}
.tab-item--active { background: $uni-color-primary; }
.tab-item--active .tab-text { color: $uni-text-color-inverse; }
.tab-text { font-size: 22rpx; color: $uni-gray-500; }
.create-section { padding: 16rpx 24rpx; }
.create-btn {
  width: 100%; height: 80rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 40rpx; font-size: 28rpx;
  font-weight: 600; color: $uni-text-color-inverse;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.create-btn::after { border: none; }
.transfer-list { padding: 0 24rpx 24rpx; }
.transfer-card {
  background: $uni-bg-color; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.transfer-no { font-size: 26rpx; color: $uni-gray-700; font-weight: 600; }
.transfer-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending { background: $uni-color-warning-soft; }
.status-pending .status-text { color: $uni-color-warning; }
.status-approved { background: $uni-color-primary-soft; }
.status-approved .status-text { color: $uni-color-primary; }
.status-completed { background: $uni-color-success-soft; }
.status-completed .status-text { color: $uni-color-success; }
.status-rejected { background: $uni-color-error-soft; }
.status-rejected .status-text { color: $uni-color-error; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.card-actions {
  margin-top: 16rpx; padding-top: 16rpx;
  border-top: 1rpx solid $uni-gray-100;
  display: flex; gap: 16rpx;
}
.action-btn {
  flex: 1; height: 64rpx; border-radius: 32rpx;
  font-size: 26rpx;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.approve-btn { background: $uni-color-success; color: $uni-text-color-inverse; }
.reject-btn { background: $uni-color-error-soft; color: $uni-color-error; }
.stock-btn { background: $uni-color-primary; color: $uni-text-color-inverse; }
.action-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.safe-bottom { height: 40rpx; }
</style>