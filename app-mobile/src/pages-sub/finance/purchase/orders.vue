<template>
  <view class="purchase-orders-page">
    <page-header title="采购订单" @back="goBack" />

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索采购单号 / 供应商"
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

    <!-- 订单列表 -->
    <scroll-view class="order-list" scroll-y v-if="list.length > 0">
      <view class="order-card" v-for="item in list" :key="item.orderNo">
        <view class="order-header">
          <text class="order-no">采购单号：{{ item.orderNo }}</text>
          <view class="order-status" :class="'status-' + item.status">
            <text class="status-text">{{ item.statusLabel }}</text>
          </view>
        </view>
        <view class="order-body">
          <view class="order-info">
            <text class="info-label">供应商</text>
            <text class="info-value">{{ item.supplierName }}</text>
          </view>
          <view class="order-info">
            <text class="info-label">商品数</text>
            <text class="info-value">{{ item.itemCount }} 种</text>
          </view>
          <view class="order-info">
            <text class="info-label">采购金额</text>
            <text class="info-value info-value--price">¥{{ item.totalAmount }}</text>
          </view>
          <view class="order-info">
            <text class="info-label">下单时间</text>
            <text class="info-value">{{ item.createTime }}</text>
          </view>
        </view>
        <view class="order-actions" v-if="item.status === 'approved'">
          <button class="action-btn stock-btn" @tap="handleInStock(item)">入库</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无采购订单</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { purchaseApi } from '@/api/modules/purchase'

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
  { label: '已入库', value: 'stocked' },
  { label: '已取消', value: 'cancelled' },
]
const activeTab = ref('')
const list = ref<any[]>([])
const loading = ref(false)

function onSearch() { loadOrders() }
function clearSearch() { searchForm.keyword = ''; loadOrders() }
function switchTab(val: string) { activeTab.value = val; loadOrders() }

function handleInStock(item: any) {
  uni.navigateTo({ url: `/pages-sub/finance/purchase/in-stock?orderNo=${item.orderNo}` })
}

async function loadOrders() {
  loading.value = true
  try {
    const res = await purchaseApi.getOrderList({
      page: 1,
      pageSize: 50,
      keyword: searchForm.keyword || undefined,
      status: activeTab.value || undefined
    })
    list.value = res.list || []
  } catch (err) {
    console.error('加载采购订单失败:', err)
    uni.showToast({ title: '加载失败', icon: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadOrders() })
</script>

<style lang="scss" scoped>
.purchase-orders-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-gray-700;
}
.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
}
.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: $uni-bg-color-page;
  border-radius: 36rpx;
  padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.search-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: $uni-gray-300; padding: 4rpx; }
.tab-bar {
  display: flex;
  background: $uni-bg-color;
  padding: 0 16rpx 16rpx;
  gap: 8rpx;
}
.tab-item {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $uni-bg-color-page;
  border-radius: 32rpx;
}
.tab-item--active { background: $uni-color-primary; }
.tab-item--active .tab-text { color: $uni-text-color-inverse; }
.tab-text { font-size: 24rpx; color: $uni-gray-500; }
.order-list { padding: 16rpx 24rpx; }
.order-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.order-no { font-size: 26rpx; color: $uni-gray-700; font-weight: 600; }
.order-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending { background: $uni-color-warning-soft; }
.status-pending .status-text { color: $uni-color-warning; }
.status-approved { background: $uni-color-primary-soft; }
.status-approved .status-text { color: $uni-color-primary; }
.status-stocked { background: $uni-color-success-soft; }
.status-stocked .status-text { color: $uni-color-success; }
.status-cancelled { background: $uni-color-error-soft; }
.status-cancelled .status-text { color: $uni-color-error; }
.status-text { font-size: 22rpx; }
.order-body { display: flex; flex-direction: column; gap: 12rpx; }
.order-info { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.info-value--price { color: $uni-color-primary; font-weight: 600; }
.order-actions { margin-top: 16rpx; display: flex; gap: 16rpx; }
.action-btn {
  flex: 1;
  height: 64rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}
.stock-btn { background: $uni-color-primary; color: $uni-text-color-inverse; }
.action-btn::after { border: none; }
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.safe-bottom { height: 40rpx; }
</style>