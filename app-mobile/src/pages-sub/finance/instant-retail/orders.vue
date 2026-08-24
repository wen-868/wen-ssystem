<template>
  <view class="instant-retail-page">
    <page-header title="即时零售订单" @back="goBack" />

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索订单号 / 收件人 / 手机号"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
        </view>
      </view>
    </form>

    <!-- 平台筛选 -->
    <view class="platform-bar">
      <view
        v-for="plat in platforms"
        :key="plat.value"
        class="platform-item"
        :class="{ 'platform-item--active': activePlatform === plat.value }"
        @tap="switchPlatform(plat.value)"
      >
        <text class="platform-text">{{ plat.label }}</text>
      </view>
    </view>

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
        <text class="tab-count" v-if="tab.count > 0">{{ tab.count }}</text>
      </view>
    </view>

    <!-- 订单列表 -->
    <scroll-view class="order-list" scroll-y v-if="list.length > 0">
      <view class="order-card" v-for="item in list" :key="item.orderNo">
        <view class="card-header">
          <view class="platform-tag" :class="'plat-' + item.platform">
            <text class="plat-text">{{ item.platformLabel }}</text>
          </view>
          <text class="order-status" :class="'status-' + item.status">{{ item.statusLabel }}</text>
        </view>
        <view class="card-body">
          <view class="order-no-row">
            <text class="order-no">订单号：{{ item.orderNo }}</text>
            <text class="order-time">{{ item.createTime }}</text>
          </view>
          <view class="goods-list">
            <view class="goods-item" v-for="goods in item.goodsList" :key="goods.id">
              <image class="goods-img" :src="goods.image" mode="aspectFill" />
              <view class="goods-info">
                <text class="goods-name">{{ goods.name }}</text>
                <text class="goods-spec">{{ goods.spec }}</text>
              </view>
              <view class="goods-price-wrap">
                <text class="goods-price">¥{{ goods.price }}</text>
                <text class="goods-qty">x{{ goods.quantity }}</text>
              </view>
            </view>
          </view>
          <view class="order-summary">
            <text class="summary-text">共{{ item.totalQty }}件商品</text>
            <text class="summary-total">实付 <text class="total-price">¥{{ item.payAmount }}</text></text>
          </view>
        </view>
        <view class="card-footer">
          <text class="delivery-info">
            <image class="delivery-icon ic" src="/static/icons/ic/truck.svg" mode="aspectFit"/>
            {{ item.receiverName }} {{ item.receiverPhone }}
          </text>
          <text class="delivery-address">{{ item.receiverAddress }}</text>
        </view>
        <view class="card-actions">
          <button class="action-btn outline-btn" @tap="viewDetail(item)">订单详情</button>
          <button class="action-btn primary-btn" v-if="item.status === 'pending'" @tap="acceptOrder(item)">接单</button>
          <button class="action-btn primary-btn" v-else-if="item.status === 'accepted'" @tap="shipOrder(item)">发货</button>
          <button class="action-btn danger-btn" v-else-if="item.status === 'pending'" @tap="rejectOrder(item)">拒单</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无订单</text>
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

const platforms = [
  { label: '全部', value: '' },
  { label: '美团', value: 'meituan' },
  { label: '饿了么', value: 'eleme' },
  { label: '抖音', value: 'douyin' },
]
const activePlatform = ref('')

const tabs = [
  { label: '全部', value: '', count: 0 },
  { label: '待接单', value: 'pending', count: 0 },
  { label: '待发货', value: 'accepted', count: 0 },
  { label: '配送中', value: 'shipping', count: 0 },
  { label: '已完成', value: 'completed', count: 0 },
]
const activeTab = ref('')
const list = ref<any[]>([])
const loading = ref(false)

function onSearch() { loadOrders() }
function clearSearch() { searchForm.keyword = ''; loadOrders() }
function switchPlatform(val: string) { activePlatform.value = val; loadOrders() }
function switchTab(val: string) { activeTab.value = val; loadOrders() }

function viewDetail(item: any) {
  uni.showToast({ title: '查看详情', icon: 'none' })
}

function acceptOrder(item: any) {
  uni.showModal({
    title: '确认接单',
    content: '确认接收该订单？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已接单', icon: 'success' })
      }
    }
  })
}

function rejectOrder(item: any) {
  uni.showModal({
    title: '拒单',
    content: '确认拒绝该订单？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已拒单', icon: 'none' })
      }
    }
  })
}

function shipOrder(item: any) {
  uni.showModal({
    title: '确认发货',
    content: '确认商品已出库配送？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已发货', icon: 'success' })
      }
    }
  })
}

async function loadOrders() {
  loading.value = true
  try {
    list.value = []
  } catch (err) {
    console.error('加载即时零售订单失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadOrders() })
</script>

<style lang="scss" scoped>
.instant-retail-page { min-height: 100vh; background: $uni-color-primary-soft; }
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
.platform-bar {
  display: flex; background: $uni-bg-color;
  padding: 0 16rpx 16rpx; gap: 8rpx;
}
.platform-item {
  height: 56rpx; padding: 0 $uni-spacing-base;
  display: flex; align-items: center; justify-content: center;
  background: $uni-bg-color-page; border-radius: 28rpx;
}
.platform-item--active { background: $uni-color-primary-soft; }
.platform-item--active .platform-text { color: $uni-color-primary; font-weight: 600; }
.platform-text { font-size: 22rpx; color: $uni-gray-500; }
.tab-bar {
  display: flex; background: $uni-bg-color;
  padding: 0 8rpx 16rpx; gap: 4rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.tab-item {
  flex: 1; height: 60rpx;
  display: flex; align-items: center; justify-content: center;
  gap: 6rpx; position: relative;
}
.tab-item--active .tab-text { color: $uni-color-primary; font-weight: 600; }
.tab-text { font-size: 24rpx; color: $uni-gray-500; }
.tab-count {
  min-width: 32rpx; height: 32rpx;
  background: $uni-color-error; color: $uni-text-color-inverse;
  border-radius: 16rpx; font-size: 20rpx;
  display: flex; align-items: center; justify-content: center;
  padding: 0 8rpx;
}
.order-list { padding: $uni-spacing-sm $uni-spacing-lg $uni-spacing-base; }
.order-card {
  background: $uni-bg-color; border-radius: $uni-border-radius-xs;
  margin-bottom: $uni-spacing-md; overflow: hidden;
  box-shadow: $uni-shadow-card-sm;
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20rpx 24rpx;
  background: $uni-gray-50;
}
.platform-tag { padding: 4rpx 16rpx; border-radius: 16rpx; }
.plat-meituan { background: $uni-color-error-soft; }
.plat-meituan .plat-text { color: $uni-color-error; }
.plat-eleme { background: $uni-color-primary-soft; }
.plat-eleme .plat-text { color: $uni-color-primary; }
.plat-douyin { background: $uni-color-purple-soft; }
.plat-douyin .plat-text { color: $uni-color-purple; }
.plat-text { font-size: 20rpx; font-weight: 600; }
.order-status { font-size: 24rpx; font-weight: 600; }
.status-pending { color: $uni-color-warning; }
.status-accepted { color: $uni-color-primary; }
.status-shipping { color: $uni-color-success; }
.status-completed { color: $uni-gray-400; }
.card-body { padding: $uni-spacing-md $uni-spacing-base; }
.order-no-row {
  display: flex; justify-content: space-between;
  margin-bottom: $uni-spacing-sm;
}
.order-no { font-size: 24rpx; color: $uni-gray-500; }
.order-time { font-size: 22rpx; color: $uni-gray-400; }
.goods-list { display: flex; flex-direction: column; gap: $uni-spacing-sm; }
.goods-item { display: flex; align-items: center; gap: $uni-spacing-sm; }
.goods-img {
  width: 80rpx; height: 80rpx;
  border-radius: 8rpx; background: $uni-bg-color-grey;
}
.goods-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.goods-name { font-size: 26rpx; color: $uni-gray-700; line-height: 1.3; }
.goods-spec { font-size: 22rpx; color: $uni-gray-400; }
.goods-price-wrap {
  display: flex; flex-direction: column;
  align-items: flex-end; gap: 4rpx;
}
.goods-price { font-size: 26rpx; color: $uni-gray-700; font-weight: 600; }
.goods-qty { font-size: 22rpx; color: $uni-gray-400; }
.order-summary {
  display: flex; justify-content: space-between;
  align-items: center;
  margin-top: $uni-spacing-sm; padding-top: $uni-spacing-sm;
  border-top: 1rpx dashed $uni-gray-100;
}
.summary-text { font-size: 24rpx; color: $uni-gray-400; }
.summary-total { font-size: 24rpx; color: $uni-gray-500; }
.total-price { font-size: 30rpx; color: $uni-color-error; font-weight: 700; }
.card-footer {
  padding: $uni-spacing-sm $uni-spacing-base;
  background: $uni-gray-50;
  display: flex; flex-direction: column;
  gap: $uni-spacing-xs;
}
.delivery-info {
  font-size: 24rpx; color: $uni-gray-700;
  display: flex; align-items: center; gap: $uni-spacing-xs;
}
.delivery-icon { font-size: 24rpx; color: $uni-color-primary; }
.delivery-address { font-size: 22rpx; color: $uni-gray-400; line-height: 1.4; }
.card-actions {
  padding: $uni-spacing-sm $uni-spacing-base;
  display: flex; justify-content: flex-end; gap: $uni-spacing-sm;
  border-top: 1rpx solid $uni-gray-100;
}
.action-btn {
  height: 60rpx; padding: 0 28rpx;
  border-radius: 30rpx; font-size: 24rpx;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.outline-btn { background: $uni-bg-color-grey; color: $uni-gray-500; }
.primary-btn { background: $uni-color-primary; color: $uni-text-color-inverse; }
.danger-btn { background: $uni-color-error-soft; color: $uni-color-error; }
.action-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: $uni-spacing-md; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.safe-bottom { height: 40rpx; }
</style>
