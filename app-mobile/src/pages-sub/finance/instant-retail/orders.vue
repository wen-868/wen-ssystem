<template>
  <view class="instant-retail-page">
    <view class="page-header">
      <text class="header-title">即时零售订单</text>
    </view>

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <text class="search-icon">&#xe614;</text>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索订单号 / 收件人 / 手机号"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
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
            <text class="delivery-icon">&#xe622;</text>
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
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无订单</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
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

<style scoped>
.instant-retail-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.search-bar { padding: 16rpx 24rpx; background: #fff; }
.search-input-wrap {
  display: flex; align-items: center;
  height: 72rpx; background: #f5f7fa;
  border-radius: 36rpx; padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: #999; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: #333; }
.search-placeholder { color: #bbb; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: #bbb; padding: 4rpx; }
.platform-bar {
  display: flex; background: #fff;
  padding: 0 16rpx 16rpx; gap: 8rpx;
}
.platform-item {
  height: 56rpx; padding: 0 24rpx;
  display: flex; align-items: center; justify-content: center;
  background: #f5f7fa; border-radius: 28rpx;
}
.platform-item--active { background: #e6f7ff; }
.platform-item--active .platform-text { color: #1677FF; font-weight: 600; }
.platform-text { font-size: 22rpx; color: #666; }
.tab-bar {
  display: flex; background: #fff;
  padding: 0 8rpx 16rpx; gap: 4rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.tab-item {
  flex: 1; height: 60rpx;
  display: flex; align-items: center; justify-content: center;
  gap: 6rpx; position: relative;
}
.tab-item--active .tab-text { color: #1677FF; font-weight: 600; }
.tab-text { font-size: 24rpx; color: #666; }
.tab-count {
  min-width: 32rpx; height: 32rpx;
  background: #ff4d4f; color: #fff;
  border-radius: 16rpx; font-size: 20rpx;
  display: flex; align-items: center; justify-content: center;
  padding: 0 8rpx;
}
.order-list { padding: 16rpx 24rpx 24rpx; }
.order-card {
  background: #fff; border-radius: 16rpx;
  margin-bottom: 16rpx; overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20rpx 24rpx;
  background: #fafafa;
}
.platform-tag { padding: 4rpx 16rpx; border-radius: 16rpx; }
.plat-meituan { background: #fff1f0; }
.plat-meituan .plat-text { color: #ff4d4f; }
.plat-eleme { background: #e6f7ff; }
.plat-eleme .plat-text { color: #1677FF; }
.plat-douyin { background: #f9f0ff; }
.plat-douyin .plat-text { color: #722ed1; }
.plat-text { font-size: 20rpx; font-weight: 600; }
.order-status { font-size: 24rpx; font-weight: 600; }
.status-pending { color: #fa8c16; }
.status-accepted { color: #1677FF; }
.status-shipping { color: #52c41a; }
.status-completed { color: #999; }
.card-body { padding: 20rpx 24rpx; }
.order-no-row {
  display: flex; justify-content: space-between;
  margin-bottom: 16rpx;
}
.order-no { font-size: 24rpx; color: #666; }
.order-time { font-size: 22rpx; color: #999; }
.goods-list { display: flex; flex-direction: column; gap: 16rpx; }
.goods-item { display: flex; align-items: center; gap: 16rpx; }
.goods-img {
  width: 80rpx; height: 80rpx;
  border-radius: 8rpx; background: #f5f5f5;
}
.goods-info { flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.goods-name { font-size: 26rpx; color: #333; line-height: 1.3; }
.goods-spec { font-size: 22rpx; color: #999; }
.goods-price-wrap {
  display: flex; flex-direction: column;
  align-items: flex-end; gap: 4rpx;
}
.goods-price { font-size: 26rpx; color: #333; font-weight: 600; }
.goods-qty { font-size: 22rpx; color: #999; }
.order-summary {
  display: flex; justify-content: space-between;
  align-items: center;
  margin-top: 16rpx; padding-top: 16rpx;
  border-top: 1rpx dashed #f0f0f0;
}
.summary-text { font-size: 24rpx; color: #999; }
.summary-total { font-size: 24rpx; color: #666; }
.total-price { font-size: 30rpx; color: #ff4d4f; font-weight: 700; }
.card-footer {
  padding: 16rpx 24rpx;
  background: #fafafa;
  display: flex; flex-direction: column;
  gap: 8rpx;
}
.delivery-info {
  font-size: 24rpx; color: #333;
  display: flex; align-items: center; gap: 8rpx;
}
.delivery-icon { font-size: 24rpx; color: #1677FF; }
.delivery-address { font-size: 22rpx; color: #999; line-height: 1.4; }
.card-actions {
  padding: 16rpx 24rpx;
  display: flex; justify-content: flex-end; gap: 16rpx;
  border-top: 1rpx solid #f0f0f0;
}
.action-btn {
  height: 60rpx; padding: 0 28rpx;
  border-radius: 30rpx; font-size: 24rpx;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.outline-btn { background: #f5f5f5; color: #666; }
.primary-btn { background: #1677FF; color: #fff; }
.danger-btn { background: #fff2f0; color: #ff4d4f; }
.action-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }
</style>
