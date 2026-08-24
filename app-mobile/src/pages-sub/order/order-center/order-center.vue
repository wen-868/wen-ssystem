<template>
  <view class="order-center-page">
    <page-header title="订单中心" @back="goBack" />

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索订单号 / 客户名称 / 手机号"
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
          <text class="order-no">{{ item.orderNo }}</text>
          <view class="order-status" :class="'status-' + item.status">
            <text class="status-text">{{ item.statusLabel }}</text>
          </view>
        </view>
        <view class="order-body">
<view class="order-info">
  <text class="info-label">客户</text>
  <view class="info-value"><text>{{ item.customerName }}</text></view>
</view>
<view class="order-info">
  <text class="info-label">商品数</text>
  <view class="info-value"><text>{{ item.itemCount }} 种</text></view>
</view>
<view class="order-info">
  <text class="info-label">订单金额</text>
  <view class="info-value info-value--price"><text>¥{{ item.totalAmount }}</text></view>
</view>
<view class="order-info" v-if="item.channel">
  <text class="info-label">渠道</text>
  <view class="info-value"><text>{{ item.channel }}</text></view>
</view>
<view class="order-info">
  <text class="info-label">下单时间</text>
  <view class="info-value"><text>{{ item.createTime }}</text></view>
</view>
        </view>
        <view class="order-actions">
          <button class="action-btn detail-btn" @tap="goDetail(item)">详情</button>
          <button
            v-if="item.status === 'pending'"
            class="action-btn process-btn"
            @tap="handleProcess(item)"
          >
            处理
          </button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无订单数据</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { ordersApi, type OrderInfo } from '@/api/modules/orders'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const tabs = [
  { label: '全部', value: '' },
  { label: '待付款', value: 'pending_pay' },
  { label: '待发货', value: 'pending_ship' },
  { label: '待收货', value: 'pending_recv' },
  { label: '已完成', value: 'completed' },
  { label: '售后', value: 'aftersale' },
]
const activeTab = ref('')
const list = ref<OrderInfo[]>([])
const loading = ref(false)

function onSearch() { loadOrders() }
function clearSearch() { searchForm.keyword = ''; loadOrders() }
function switchTab(val: string) { activeTab.value = val; loadOrders() }

function goDetail(item: OrderInfo) {
  uni.navigateTo({ url: `/pages/orders/order-detail?orderNo=${item.orderNo}` })
}

function handleProcess(item: OrderInfo) {
  uni.navigateTo({ url: `/pages/orders/order-detail?orderNo=${item.orderNo}&action=process` })
}

async function loadOrders() {
  loading.value = true
  try {
    const params: any = {
      page: 1,
      pageSize: 20
    }
    if (searchForm.keyword) {
      params.keyword = searchForm.keyword
    }
    if (activeTab.value) {
      params.status = activeTab.value
    }
    
    const result = await ordersApi.list(params)
    list.value = result.list
  } catch (err) {
    console.error('加载订单失败:', err)
    uni.showToast({ title: '加载失败', icon: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadOrders() })
</script>

<style lang="scss" scoped>
.order-center-page {
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
  flex-wrap: wrap;
}
.tab-item {
  height: 60rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $uni-bg-color-page;
  border-radius: 30rpx;
}
.tab-item--active { background: $uni-color-primary; }
.tab-item--active .tab-text { color: $uni-text-color-inverse; }
.tab-text { font-size: 24rpx; color: $uni-gray-500; white-space: nowrap; }
.order-list { padding: $uni-spacing-sm $uni-spacing-lg; }
.order-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-md;
  box-shadow: $uni-shadow-card-sm;
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
.status-pending_pay { background: $uni-color-warning-soft; }
.status-pending_pay .status-text { color: $uni-color-warning; }
.status-pending_ship { background: $uni-color-primary-soft; }
.status-pending_ship .status-text { color: $uni-color-primary; }
.status-pending_recv { background: $uni-color-primary-soft; }
.status-pending_recv .status-text { color: $uni-color-purple; }
.status-completed { background: $uni-color-success-soft; }
.status-completed .status-text { color: $uni-color-success; }
.status-aftersale { background: $uni-color-error-soft; }
.status-aftersale .status-text { color: $uni-color-error; }
.status-text { font-size: 22rpx; }
.order-body { display: flex; flex-direction: column; gap: $uni-spacing-sm; }
.order-info { display: flex; justify-content: space-between; align-items: center; gap: 16rpx; min-width: 0; }
.info-label { font-size: 24rpx; color: $uni-gray-400; flex-shrink: 0; }
.info-value { flex: 1; min-width: 0; display: flex; justify-content: flex-end; align-items: center; overflow: hidden; }
.info-value text { display: block; font-size: 26rpx; color: $uni-gray-700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.info-value--price text { color: $uni-color-primary; font-weight: 600; }
.order-actions { margin-top: $uni-spacing-sm; display: flex; gap: $uni-spacing-sm; }
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
.detail-btn { background: $uni-bg-color-grey; color: $uni-gray-700; }
.process-btn { background: $uni-color-primary; color: $uni-text-color-inverse; }
.action-btn::after { border: none; }
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: $uni-spacing-md; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.safe-bottom { height: 40rpx; }
</style>
