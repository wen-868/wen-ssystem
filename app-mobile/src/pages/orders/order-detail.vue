<template>
  <!-- 无表单交互，无需三件套（纯展示详情页，操作按钮为API调用） -->
  <scroll-view class="order-detail-page" scroll-y>
    <view class="detail-loading" v-if="loading">
      <text class="loading-text">加载中...</text>
    </view>

    <template v-else-if="order">
      <!-- 订单状态卡片 -->
      <view class="status-card" :class="'status-bg-' + order.status">
        <view class="status-icon-wrap">
          <text class="status-icon">{{ statusIcon }}</text>
        </view>
        <text class="status-title">{{ order.statusLabel }}</text>
        <text class="status-desc">{{ statusDesc }}</text>
      </view>

      <!-- 订单基本信息 -->
      <view class="info-card">
        <view class="info-title">订单信息</view>
        <view class="info-row">
          <text class="info-label">订单编号</text>
          <text class="info-value">{{ order.orderNo }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">订单金额</text>
          <text class="info-value info-value--amount">¥{{ order.totalAmount.toFixed(2) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">下单时间</text>
          <text class="info-value">{{ order.createdAt }}</text>
        </view>
        <view class="info-row" v-if="order.remark">
          <text class="info-label">备注</text>
          <text class="info-value">{{ order.remark }}</text>
        </view>
      </view>

      <!-- 客户信息 -->
      <view class="info-card">
        <view class="info-title">客户信息</view>
        <view class="info-row">
          <text class="info-label">客户名称</text>
          <text class="info-value">{{ order.customerName }}</text>
        </view>
        <view class="info-row" v-if="order.customerMobile">
          <text class="info-label">联系电话</text>
          <text class="info-value">{{ order.customerMobile }}</text>
        </view>
        <view class="info-row" v-if="order.customerAddress">
          <text class="info-label">地址</text>
          <text class="info-value">{{ order.customerAddress }}</text>
        </view>
      </view>

      <!-- 商品明细 -->
      <view class="info-card">
        <view class="info-title">商品明细</view>
        <view class="item-row" v-for="item in order.items" :key="item.id">
          <view class="item-info">
            <text class="item-name">{{ item.productName }}</text>
            <text class="item-spec">x{{ item.quantity }}</text>
          </view>
          <text class="item-price">¥{{ item.unitPrice.toFixed(2) }}</text>
          <text class="item-total">¥{{ (item.totalPrice ?? 0).toFixed(2) }}</text>
        </view>
        <view class="item-summary">
          <text class="summary-label">合计</text>
          <text class="summary-value">¥{{ order.totalAmount.toFixed(2) }}</text>
        </view>
      </view>

      <!-- 操作日志 -->
      <view class="info-card" v-if="order.logs && order.logs.length > 0">
        <view class="info-title">操作日志</view>
        <view class="log-item" v-for="log in order.logs" :key="log.id">
          <view class="log-dot"></view>
          <view class="log-content">
            <view class="log-header">
              <text class="log-action">{{ log.action }}</text>
              <text class="log-time">{{ log.createdAt }}</text>
            </view>
            <text class="log-operator">操作人：{{ log.operator }}</text>
            <text class="log-remark" v-if="log.remark">{{ log.remark }}</text>
          </view>
        </view>
      </view>

      <view class="safe-bottom"></view>
    </template>

    <!-- 错误状态 -->
    <view class="error-state" v-else>
      <text class="error-text">订单信息加载失败</text>
    </view>
  </scroll-view>

  <!-- 底部操作栏 -->
  <view class="bottom-actions" v-if="order && showActions">
    <button
      v-if="order.status === 'pending'"
      class="action-btn action-btn--primary"
      :disabled="actionLoading"
      @tap="handleDeliver"
    >
      {{ actionLoading ? '处理中...' : '开始配送' }}
    </button>
    <button
      v-if="order.status === 'delivering'"
      class="action-btn action-btn--success"
      :disabled="actionLoading"
      @tap="handleComplete"
    >
      {{ actionLoading ? '处理中...' : '完成配送' }}
    </button>
    <button
      v-if="order.status === 'pending' || order.status === 'delivering'"
      class="action-btn action-btn--danger"
      :disabled="actionLoading"
      @tap="handleCancel"
    >
      取消订单
    </button>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ordersApi, type OrderInfo } from '@/api/modules/orders'

const order = ref<OrderInfo | null>(null)
const loading = ref(true)
const actionLoading = ref(false)

const statusIcon = computed(() => {
  const map: Record<string, string> = {
    pending: '\ue620',
    delivering: '\ue621',
    completed: '\ue622',
    cancelled: '\ue623'
  }
  return order.value ? map[order.value.status] : '\ue620'
})

const statusDesc = computed(() => {
  const map: Record<string, string> = {
    pending: '订单待处理，请及时配送',
    delivering: '订单正在配送中',
    completed: '订单已完成',
    cancelled: '订单已取消'
  }
  return order.value ? map[order.value.status] : ''
})

const showActions = computed(() => {
  return order.value && (order.value.status === 'pending' || order.value.status === 'delivering')
})

async function loadDetail() {
  loading.value = true
  try {
    // 从页面参数获取订单号
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1] as any
    const orderNo = currentPage?.options?.orderNo
    if (!orderNo) {
      uni.showToast({ title: '订单号不存在', icon: 'none' })
      uni.navigateBack()
      return
    }
    order.value = await ordersApi.detail(orderNo)
  } catch (err) {
    console.error('加载订单详情失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function handleDeliver() {
  if (!order.value) return
  actionLoading.value = true
  try {
    await ordersApi.startDelivery(order.value!.orderNo)
    uni.showToast({ title: '已开始配送', icon: 'success' })
    await loadDetail()
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  } finally {
    actionLoading.value = false
  }
}

async function handleComplete() {
  if (!order.value) return
  actionLoading.value = true
  try {
    await ordersApi.completeDelivery(order.value!.orderNo)
    uni.showToast({ title: '配送完成', icon: 'success' })
    await loadDetail()
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  } finally {
    actionLoading.value = false
  }
}

async function handleCancel() {
  if (!order.value) return
  uni.showModal({
    title: '取消订单',
    content: '确定要取消该订单吗？',
    success: async (res) => {
      if (res.confirm) {
        actionLoading.value = true
        try {
          await ordersApi.cancel(order.value!.orderNo)
          uni.showToast({ title: '订单已取消', icon: 'success' })
          await loadDetail()
        } catch (err) {
          uni.showToast({ title: '操作失败', icon: 'none' })
        } finally {
          actionLoading.value = false
        }
      }
    }
  })
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.order-detail-page {
  min-height: 100vh;
  background: #f0f5ff;
  padding-bottom: 120rpx;
}

/* 加载状态 */
.detail-loading {
  display: flex;
  justify-content: center;
  padding: 200rpx 0;
}

.loading-text {
  font-size: 28rpx;
  color: #999;
}

/* 状态卡片 */
.status-card {
  padding: 48rpx 32rpx;
  text-align: center;
  padding-top: calc(48rpx + env(safe-area-inset-top));
}

.status-bg-pending { background: linear-gradient(135deg, #fa8c16, #ffa940); }
.status-bg-delivering { background: linear-gradient(135deg, #1677FF, #69b1ff); }
.status-bg-completed { background: linear-gradient(135deg, #52c41a, #95de64); }
.status-bg-cancelled { background: linear-gradient(135deg, #ff4d4f, #ff7875); }

.status-icon-wrap {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20rpx;
}

.status-icon {
  font-size: 48rpx;
  color: #fff;
}

.status-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  display: block;
  margin-bottom: 8rpx;
}

.status-desc {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
}

/* 信息卡片 */
.info-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 16rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.info-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
}

.info-label {
  font-size: 26rpx;
  color: #999;
}

.info-value {
  font-size: 28rpx;
  color: #333;
  text-align: right;
  max-width: 400rpx;
}

.info-value--amount {
  font-weight: 700;
  color: #1677FF;
  font-size: 30rpx;
}

/* 商品明细 */
.item-row {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
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
  font-size: 28rpx;
  color: #333;
}

.item-spec {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
}

.item-price {
  font-size: 26rpx;
  color: #666;
  margin: 0 20rpx;
}

.item-total {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.item-summary {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 20rpx;
  border-top: 1rpx solid #f5f5f5;
  margin-top: 8rpx;
}

.summary-label {
  font-size: 28rpx;
  color: #333;
  margin-right: 16rpx;
}

.summary-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #1677FF;
}

/* 操作日志 */
.log-item {
  display: flex;
  padding: 16rpx 0;
}

.log-item:last-child {
  padding-bottom: 0;
}

.log-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #1677FF;
  margin-top: 8rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.log-content {
  flex: 1;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4rpx;
}

.log-action {
  font-size: 28rpx;
  color: #333;
}

.log-time {
  font-size: 24rpx;
  color: #999;
}

.log-operator {
  font-size: 24rpx;
  color: #999;
}

.log-remark {
  font-size: 24rpx;
  color: #666;
  margin-top: 4rpx;
}

/* 错误状态 */
.error-state {
  display: flex;
  justify-content: center;
  padding: 200rpx 0;
}

.error-text {
  font-size: 28rpx;
  color: #999;
}

/* 底部操作栏 */
.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.06);
  gap: 20rpx;
}

.action-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.action-btn::after {
  border: none;
}

.action-btn--primary {
  background: linear-gradient(135deg, #1677FF, #4096ff);
  color: #fff;
}

.action-btn--success {
  background: linear-gradient(135deg, #52c41a, #73d13d);
  color: #fff;
}

.action-btn--danger {
  background: #fff;
  color: #ff4d4f;
  border: 2rpx solid #ff4d4f;
}

.safe-bottom {
  height: 40rpx;
}
</style>