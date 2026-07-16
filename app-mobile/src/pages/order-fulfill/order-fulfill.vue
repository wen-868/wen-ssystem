<template>
  <view class="fulfill-page">
    <view class="page-header">
      <text class="header-title">接单履约</text>
    </view>

    <!-- 状态切换 -->
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ 'tab-item--active': activeTab === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
        <view class="tab-badge" v-if="tab.count > 0">{{ tab.count }}</view>
      </view>
    </view>

    <!-- 订单列表 -->
    <scroll-view class="order-list" scroll-y :refresher-enabled="true" :refresher-triggered="refresherTriggered" @refresherrefresh="onRefresh">
      <view class="order-card" v-for="order in filteredOrders" :key="order.orderNo">
        <view class="card-top">
          <view class="order-no-wrap">
            <text class="order-source" :class="'source-' + order.source">{{ order.sourceLabel }}</text>
            <text class="order-no">{{ order.orderNo }}</text>
          </view>
          <view class="order-status" :class="'status-' + order.status">
            <text class="status-text">{{ order.statusLabel }}</text>
          </view>
        </view>

        <view class="card-body">
          <view class="info-row">
            <text class="info-label">客户</text>
            <text class="info-value">{{ order.customerName }}{{ order.customerMobile ? ' · ' + order.customerMobile : '' }}</text>
          </view>
          <view class="info-row" v-if="order.customerAddress">
            <text class="info-label">地址</text>
            <text class="info-value info-value--addr">{{ order.customerAddress }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">商品</text>
            <text class="info-value">{{ order.items.length }} 种 / 合计 ¥{{ order.totalAmount.toFixed(2) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">下单时间</text>
            <text class="info-value">{{ order.createdAt }}</text>
          </view>
          <view class="info-row" v-if="order.remark">
            <text class="info-label">备注</text>
            <text class="info-value info-value--remark">{{ order.remark }}</text>
          </view>
        </view>

        <!-- 商品明细折叠 -->
        <view class="items-toggle" @tap="toggleItems(order.orderNo)">
          <text class="toggle-text">{{ expandedOrders.includes(order.orderNo) ? '收起明细' : '查看明细' }}</text>
          <text class="toggle-arrow" :class="{ 'toggle-arrow--up': expandedOrders.includes(order.orderNo) }">&#xe616;</text>
        </view>
        <view class="items-detail" v-if="expandedOrders.includes(order.orderNo)">
          <view class="item-row" v-for="(item, idx) in order.items" :key="idx">
            <view class="item-info">
              <text class="item-name">{{ item.skuName }}</text>
              <text class="item-spec" v-if="item.productName">{{ item.productName }}</text>
            </view>
            <text class="item-qty">×{{ item.totalBottleQty }}</text>
            <text class="item-amount">¥{{ item.subtotalAmount.toFixed(2) }}</text>
          </view>
        </view>

        <!-- 操作按钮 -->
        <view class="card-actions">
          <template v-if="order.status === 'pending'">
            <button class="btn btn--reject" @tap="onReject(order)">拒单</button>
            <button class="btn btn--primary" @tap="onAccept(order)">接单</button>
          </template>
          <template v-else-if="order.status === 'accepted' || order.status === 'preparing'">
            <button class="btn btn--default" @tap="onStartDelivery(order)">开始配送</button>
          </template>
          <template v-else-if="order.status === 'delivering'">
            <button class="btn btn--primary" @tap="onComplete(order)">完成履约</button>
          </template>
          <template v-else-if="order.status === 'completed'">
            <view class="done-tip">
              <text class="done-icon">&#xe610;</text>
              <text class="done-text">已履约完成</text>
            </view>
          </template>
          <template v-else-if="order.status === 'rejected' || order.status === 'cancelled'">
            <view class="done-tip done-tip--cancelled">
              <text class="done-text">{{ order.statusLabel }}</text>
            </view>
          </template>
        </view>
      </view>

      <view class="empty-state" v-if="filteredOrders.length === 0">
        <text class="empty-icon">&#xe631;</text>
        <text class="empty-text">{{ loading ? '加载中...' : '暂无' + currentTabLabel + '订单' }}</text>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>

    <!-- 拒单弹窗 -->
    <view class="reject-mask" v-if="showRejectPanel" @tap="showRejectPanel = false">
      <view class="reject-panel" @tap.stop>
        <view class="reject-title">拒单原因</view>
        <textarea
          class="reject-input"
          v-model="rejectReason"
          placeholder="请输入拒单原因（必填）"
          placeholder-class="reject-placeholder"
          maxlength="200"
        />
        <view class="reject-actions">
          <button class="reject-cancel-btn" @tap="showRejectPanel = false">取消</button>
          <button class="reject-confirm-btn" @tap="confirmReject">确认拒单</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ordersApi, type OrderInfo } from '@/api/modules/orders'

interface FulfillOrder extends OrderInfo {
  source: string
  sourceLabel: string
}

const tabs = ref([
  { label: '待接单', value: 'pending', count: 0 },
  { label: '备货中', value: 'preparing', count: 0 },
  { label: '配送中', value: 'delivering', count: 0 },
  { label: '已完成', value: 'completed', count: 0 },
  { label: '全部', value: '', count: 0 },
])
const activeTab = ref('pending')
const orderList = ref<FulfillOrder[]>([])
const loading = ref(false)
const refresherTriggered = ref(false)
const expandedOrders = ref<string[]>([])

// 拒单
const showRejectPanel = ref(false)
const rejectReason = ref('')
const rejectTarget = ref<FulfillOrder | null>(null)

const currentTabLabel = computed(() => {
  const tab = tabs.value.find((t) => t.value === activeTab.value)
  return tab ? tab.label : ''
})

const filteredOrders = computed(() => {
  if (!activeTab.value) return orderList.value
  return orderList.value.filter((o) => o.status === activeTab.value)
})

function switchTab(val: string) {
  activeTab.value = val
}

function toggleItems(orderNo: string) {
  const idx = expandedOrders.value.indexOf(orderNo)
  if (idx >= 0) {
    expandedOrders.value.splice(idx, 1)
  } else {
    expandedOrders.value.push(orderNo)
  }
}

async function loadOrders() {
  loading.value = true
  try {
    const res = await ordersApi.list({ page: 1, pageSize: 50 })
    orderList.value = (res.list || []).map((o) => ({
      ...o,
      source: 'instant_retail',
      sourceLabel: '即时零售',
    }))
    updateTabCounts()
  } catch (err) {
    orderList.value = []
  } finally {
    loading.value = false
  }
}

function updateTabCounts() {
  const counts: Record<string, number> = {
    pending: 0,
    preparing: 0,
    delivering: 0,
    completed: 0,
    '': 0,
  }
  orderList.value.forEach((o) => {
    if (counts[o.status] !== undefined) counts[o.status]++
    counts['']++
  })
  tabs.value = tabs.value.map((t) => ({
    ...t,
    count: counts[t.value] || 0,
  }))
}

async function onAccept(order: FulfillOrder) {
  uni.showModal({
    title: '确认接单',
    content: `订单 ${order.orderNo}，合计 ¥${order.totalAmount.toFixed(2)}，确认接单？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        // 接单即开始备货，复用 startDelivery 接口标记进入履约流程
        await ordersApi.startDelivery(order.orderNo)
        uni.showToast({ title: '接单成功', icon: 'success' })
        loadOrders()
      } catch (err) {
        uni.showToast({ title: '接单失败', icon: 'none' })
      }
    }
  })
}

function onReject(order: FulfillOrder) {
  rejectTarget.value = order
  rejectReason.value = ''
  showRejectPanel.value = true
}

async function confirmReject() {
  if (!rejectTarget.value) return
  if (!rejectReason.value.trim()) {
    uni.showToast({ title: '请输入拒单原因', icon: 'none' })
    return
  }
  try {
    await ordersApi.reject(rejectTarget.value.orderNo, rejectReason.value.trim())
    uni.showToast({ title: '已拒单', icon: 'success' })
    showRejectPanel.value = false
    loadOrders()
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

async function onStartDelivery(order: FulfillOrder) {
  uni.showModal({
    title: '开始配送',
    content: `确认订单 ${order.orderNo} 开始配送？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await ordersApi.startDelivery(order.orderNo)
        uni.showToast({ title: '已开始配送', icon: 'success' })
        loadOrders()
      } catch (err) {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    }
  })
}

async function onComplete(order: FulfillOrder) {
  uni.showModal({
    title: '完成履约',
    content: `确认订单 ${order.orderNo} 已送达并完成履约？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await ordersApi.completeDelivery(order.orderNo)
        uni.showToast({ title: '履约完成', icon: 'success' })
        loadOrders()
      } catch (err) {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    }
  })
}

async function onRefresh() {
  refresherTriggered.value = true
  try {
    await loadOrders()
  } finally {
    refresherTriggered.value = false
  }
}

onMounted(() => {
  loadOrders()
})
</script>

<style scoped>
.fulfill-page {
  min-height: 100vh;
  background: #f0f5ff;
  display: flex;
  flex-direction: column;
}

.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #333;
}

/* 状态切换 */
.tab-bar {
  display: flex;
  background: #fff;
  padding: 0 16rpx 16rpx;
  gap: 8rpx;
  overflow-x: auto;
}

.tab-item {
  flex: 1;
  min-width: 120rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 30rpx;
  position: relative;
}

.tab-item--active {
  background: #1677FF;
}

.tab-item--active .tab-text {
  color: #fff;
}

.tab-text {
  font-size: 24rpx;
  color: #666;
}

.tab-badge {
  position: absolute;
  top: -8rpx;
  right: 8rpx;
  min-width: 28rpx;
  height: 28rpx;
  background: #ff4d4f;
  border-radius: 14rpx;
  font-size: 20rpx;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6rpx;
}

/* 订单列表 */
.order-list {
  flex: 1;
  padding: 16rpx 24rpx;
}

.order-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.order-no-wrap {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.order-source {
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
}

.source-instant_retail {
  background: #fff7e6;
  color: #fa8c16;
}

.order-no {
  font-size: 24rpx;
  color: #999;
}

.order-status {
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.status-pending {
  background: #fff7e6;
}

.status-pending .status-text {
  color: #fa8c16;
}

.status-accepted,
.status-preparing {
  background: #e6f4ff;
}

.status-accepted .status-text,
.status-preparing .status-text {
  color: #1677FF;
}

.status-delivering {
  background: #f9f0ff;
}

.status-delivering .status-text {
  color: #722ed1;
}

.status-completed {
  background: #f6ffed;
}

.status-completed .status-text {
  color: #52c41a;
}

.status-rejected,
.status-cancelled {
  background: #fff2f0;
}

.status-rejected .status-text,
.status-cancelled .status-text {
  color: #ff4d4f;
}

.status-text {
  font-size: 22rpx;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.info-row {
  display: flex;
  align-items: flex-start;
}

.info-label {
  font-size: 24rpx;
  color: #999;
  width: 120rpx;
  flex-shrink: 0;
}

.info-value {
  flex: 1;
  font-size: 26rpx;
  color: #333;
}

.info-value--addr {
  color: #666;
  font-size: 24rpx;
}

.info-value--remark {
  color: #fa8c16;
  font-size: 24rpx;
}

/* 明细折叠 */
.items-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx 0;
  border-top: 1rpx solid #f5f5f5;
  margin-top: 12rpx;
  gap: 8rpx;
}

.toggle-text {
  font-size: 24rpx;
  color: #1677FF;
}

.toggle-arrow {
  font-size: 24rpx;
  color: #1677FF;
  transform: rotate(90deg);
}

.toggle-arrow--up {
  transform: rotate(-90deg);
}

.items-detail {
  padding: 16rpx 0 0;
  border-top: 1rpx dashed #f0f0f0;
}

.item-row {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f9f9f9;
}

.item-row:last-child {
  border-bottom: none;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.item-name {
  font-size: 26rpx;
  color: #333;
  margin-bottom: 4rpx;
}

.item-spec {
  font-size: 22rpx;
  color: #999;
}

.item-qty {
  font-size: 24rpx;
  color: #999;
  margin: 0 24rpx;
}

.item-amount {
  font-size: 26rpx;
  color: #333;
  font-weight: 600;
  min-width: 120rpx;
  text-align: right;
}

/* 操作按钮 */
.card-actions {
  display: flex;
  gap: 16rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
  margin-top: 16rpx;
}

.btn {
  flex: 1;
  height: 72rpx;
  border-radius: 36rpx;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  line-height: 72rpx;
}

.btn::after {
  border: none;
}

.btn--primary {
  background: linear-gradient(135deg, #1677FF, #4096ff);
  color: #fff;
}

.btn--default {
  background: #e6f4ff;
  color: #1677FF;
}

.btn--reject {
  background: #fff2f0;
  color: #ff4d4f;
}

.done-tip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.done-icon {
  font-size: 28rpx;
  color: #52c41a;
}

.done-text {
  font-size: 26rpx;
  color: #52c41a;
}

.done-tip--cancelled .done-text {
  color: #999;
}

/* 空状态 */
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
  height: 40rpx;
}

/* 拒单弹窗 */
.reject-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 48rpx;
}

.reject-panel {
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx 24rpx;
}

.reject-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #333;
  margin-bottom: 20rpx;
  text-align: center;
}

.reject-input {
  width: 100%;
  height: 200rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
  margin-bottom: 24rpx;
}

.reject-placeholder {
  color: #bbb;
  font-size: 26rpx;
}

.reject-actions {
  display: flex;
  gap: 16rpx;
}

.reject-cancel-btn {
  flex: 1;
  height: 80rpx;
  background: #f5f7fa;
  border-radius: 40rpx;
  font-size: 28rpx;
  color: #666;
  border: none;
}

.reject-cancel-btn::after {
  border: none;
}

.reject-confirm-btn {
  flex: 1;
  height: 80rpx;
  background: #ff4d4f;
  border-radius: 40rpx;
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
  border: none;
}

.reject-confirm-btn::after {
  border: none;
}
</style>
