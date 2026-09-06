<template>
  <scroll-view class="order-detail-page" scroll-y>
    <page-header title="订单详情" @back="goBack" />
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
          <text class="info-label">已付金额</text>
          <text class="info-value">¥{{ order.paidAmount.toFixed(2) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">应收金额</text>
          <text class="info-value">¥{{ order.receivableAmount.toFixed(2) }}</text>
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
            <text class="item-name">{{ item.productName || item.skuName }}</text>
            <text class="item-spec">x{{ item.quantity || item.totalBottleQty }}</text>
          </view>
          <text class="item-price">¥{{ item.unitPrice.toFixed(2) }}</text>
          <text class="item-total">¥{{ (item.totalPrice || item.subtotalAmount || 0).toFixed(2) }}</text>
        </view>
        <view class="item-summary">
          <text class="summary-label">合计</text>
          <text class="summary-value">¥{{ order.totalAmount.toFixed(2) }}</text>
        </view>
      </view>

      <!-- 物流信息 -->
      <view class="info-card" v-if="order.logisticsInfo">
        <view class="info-title">物流信息</view>
        <view class="logistics-header" v-if="order.logisticsInfo.logisticsNo">
          <view class="logistics-company">
            <image class="logistics-icon ic" src="/static/icons/ic/truck.svg" mode="aspectFit"/>
            <text class="logistics-company-name">{{ order.logisticsInfo.logisticsCompany || '未知物流' }}</text>
          </view>
          <view class="logistics-status" :class="'logistics-status-' + (order.logisticsInfo.logisticsStatus || 'unknown')">
            {{ order.logisticsInfo.logisticsStatusLabel || '运输中' }}
          </view>
        </view>
        <view class="logistics-no" v-if="order.logisticsInfo.logisticsNo">
          <text class="info-label">运单号：</text>
          <text class="info-value logistics-no-text">{{ order.logisticsInfo.logisticsNo }}</text>
        </view>
        <!-- 物流追踪步骤 -->
        <view class="tracking-steps" v-if="order.logisticsInfo.trackingSteps && order.logisticsInfo.trackingSteps.length > 0">
          <view class="tracking-item" v-for="(step, index) in order.logisticsInfo.trackingSteps" :key="index">
            <view class="tracking-dot" :class="{ 'tracking-dot--active': index === 0 }"></view>
            <view class="tracking-line" v-if="index < order.logisticsInfo.trackingSteps.length - 1"></view>
            <view class="tracking-content">
              <text class="tracking-status" :class="{ 'tracking-status--active': index === 0 }">{{ step.status }}</text>
              <text class="tracking-desc">{{ step.description }}</text>
              <text class="tracking-time">{{ step.time }}</text>
            </view>
          </view>
        </view>
        <view class="no-logistics" v-else>
          <text class="no-logistics-text">暂无物流信息</text>
        </view>
      </view>

      <!-- 订单跟踪 -->
      <view class="info-card" v-if="order.logs && order.logs.length > 0">
        <view class="info-title">订单跟踪</view>
        <view class="timeline">
          <view class="timeline-item" v-for="(log, index) in order.logs" :key="log.id">
            <view class="timeline-dot"></view>
            <view class="timeline-line" v-if="index < order.logs.length - 1"></view>
            <view class="timeline-content">
              <view class="timeline-header">
                <text class="timeline-action">{{ log.action }}</text>
                <text class="timeline-time">{{ log.createdAt }}</text>
              </view>
              <text class="timeline-operator">操作人：{{ log.operator }}</text>
              <text class="timeline-remark" v-if="log.remark">{{ log.remark }}</text>
            </view>
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
      @tap="handleConfirm"
    >
      {{ actionLoading ? '处理中...' : '确认订单' }}
    </button>
    <button
      v-if="order.status === 'processing'"
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
      v-if="order.status === 'pending' || order.status === 'processing'"
      class="action-btn action-btn--danger"
      :disabled="actionLoading"
      @tap="handleCancel"
    >
      取消订单
    </button>
  </view>
</template>

<script setup lang="ts">
import pageHeader from '@/components/page-header/page-header.vue'

function goBack() {
  uni.navigateBack()
}
import { ref, computed, onMounted } from 'vue'
import { ordersApi, type OrderInfo } from '@/api/modules/orders'

const order = ref<OrderInfo | null>(null)
const loading = ref(true)
const actionLoading = ref(false)

const statusIcon = computed(() => {
  const map: Record<string, string> = {
    pending: '\ue620',
    processing: '\ue626',
    delivering: '\ue621',
    completed: '\ue622',
    cancelled: '\ue623'
  }
  return order.value ? map[order.value.status] : '\ue620'
})

const statusDesc = computed(() => {
  const map: Record<string, string> = {
    pending: '订单待确认，请及时处理',
    processing: '订单已确认，待安排配送',
    delivering: '订单正在配送中',
    completed: '订单已完成',
    cancelled: '订单已取消'
  }
  return order.value ? map[order.value.status] : ''
})

const showActions = computed(() => {
  return order.value && (order.value.status === 'pending' || order.value.status === 'processing' || order.value.status === 'delivering')
})

async function loadDetail() {
  loading.value = true
  try {
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

async function handleConfirm() {
  if (!order.value) return
  actionLoading.value = true
  try {
    await ordersApi.confirm(order.value!.orderNo)
    uni.showToast({ title: '订单已确认', icon: 'success' })
    await loadDetail()
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  } finally {
    actionLoading.value = false
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

<style lang="scss" scoped>
.order-detail-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
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
  color: $uni-gray-400;
}

/* 状态卡片 */
.status-card {
  padding: 48rpx 32rpx;
  text-align: center;
  padding-top: calc(48rpx + var(--safe-top));
}

.status-bg-pending { background: linear-gradient(135deg, $uni-color-warning, $uni-color-warning); }
.status-bg-processing { background: linear-gradient(135deg, $uni-color-warning, $uni-color-warning); }
.status-bg-delivering { background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary); }
.status-bg-completed { background: linear-gradient(135deg, $uni-color-success, $uni-color-success); }
.status-bg-cancelled { background: linear-gradient(135deg, $uni-color-error, $uni-color-error); }

.status-icon-wrap {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: $zx-white-250;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20rpx;
}

.status-icon {
  font-size: 48rpx;
  color: $uni-text-color-inverse;
}

.status-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
  display: block;
  margin-bottom: 8rpx;
}

.status-desc {
  font-size: 26rpx;
  color: $zx-white-850;
}

/* 信息卡片 */
.info-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin: $uni-spacing-sm $uni-spacing-base;
  box-shadow: 0 2rpx 12rpx $zx-black-40;
}

.info-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-md;
  padding-bottom: $uni-spacing-sm;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $uni-spacing-sm 0;
}

.info-label {
  font-size: 26rpx;
  color: $uni-gray-400;
}

.info-value {
  font-size: 28rpx;
  color: $uni-gray-700;
  text-align: right;
  max-width: 400rpx;
}

.info-value--amount {
  font-weight: 700;
  color: $uni-color-primary;
  font-size: 30rpx;
}

/* 商品明细 */
.item-row {
  display: flex;
  align-items: center;
  padding: $uni-spacing-sm 0;
  border-bottom: 1rpx solid $uni-gray-50;
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
  color: $uni-gray-700;
}

.item-spec {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin-top: 4rpx;
}

.item-price {
  font-size: 26rpx;
  color: $uni-gray-500;
  margin: 0 $uni-spacing-md;
}

.item-total {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.item-summary {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: $uni-spacing-md;
  border-top: 1rpx solid $uni-bg-color-grey;
  margin-top: $uni-spacing-xs;
}

.summary-label {
  font-size: 28rpx;
  color: $uni-gray-700;
  margin-right: $uni-spacing-sm;
}

.summary-value {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

/* 物流信息 */
.logistics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.logistics-company {
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
}

.logistics-icon {
  font-size: 32rpx;
  color: $uni-color-primary;
}

.logistics-company-name {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.logistics-status {
  padding: 6rpx 20rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.logistics-status-transporting {
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
}

.logistics-status-delivered {
  background: $uni-color-success-soft;
  color: $uni-color-success;
}

.logistics-status-unknown {
  background: $uni-bg-color-page;
  color: $uni-gray-500;
}

.logistics-no {
  display: flex;
  padding: $uni-spacing-sm 0;
}

.logistics-no-text {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-family: monospace;
}

/* 物流追踪 */
.tracking-steps {
  padding-top: $uni-spacing-sm;
}

.tracking-item {
  display: flex;
  padding-bottom: $uni-spacing-base;
  position: relative;
}

.tracking-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: $uni-gray-300;
  margin-top: $uni-spacing-xs;
  flex-shrink: 0;
}

.tracking-dot--active {
  background: $uni-color-primary;
}

.tracking-line {
  position: absolute;
  left: 7rpx;
  top: 24rpx;
  width: 2rpx;
  bottom: 0;
  background: $uni-gray-100;
}

.tracking-content {
  flex: 1;
  margin-left: $uni-spacing-sm;
}

.tracking-status {
  font-size: 28rpx;
  color: $uni-gray-400;
  display: block;
}

.tracking-status--active {
  color: $uni-gray-700;
  font-weight: 600;
}

.tracking-desc {
  font-size: 26rpx;
  color: $uni-gray-500;
  display: block;
  margin-top: 4rpx;
}

.tracking-time {
  font-size: 24rpx;
  color: $uni-gray-300;
  display: block;
  margin-top: 4rpx;
}

.no-logistics {
  padding: 40rpx 0;
  text-align: center;
}

.no-logistics-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

/* 订单跟踪时间线 */
.timeline {
  padding-top: $uni-spacing-xs;
}

.timeline-item {
  display: flex;
  padding-bottom: $uni-spacing-base;
  position: relative;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: $uni-color-primary;
  margin-top: 10rpx;
  flex-shrink: 0;
}

.timeline-line {
  position: absolute;
  left: 5rpx;
  top: 22rpx;
  width: 2rpx;
  bottom: 0;
  background: $uni-color-primary-soft;
}

.timeline-content {
  flex: 1;
  margin-left: $uni-spacing-sm;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4rpx;
}

.timeline-action {
  font-size: 28rpx;
  color: $uni-gray-700;
}

.timeline-time {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.timeline-operator {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.timeline-remark {
  font-size: 24rpx;
  color: $uni-gray-500;
  margin-top: 4rpx;
  display: block;
}

/* 错误状态 */
.error-state {
  display: flex;
  justify-content: center;
  padding: 200rpx 0;
}

.error-text {
  font-size: 28rpx;
  color: $uni-gray-400;
}

/* 底部操作栏 */
.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: $uni-spacing-md $uni-spacing-base;
  padding-bottom: calc($uni-spacing-md + env(safe-area-inset-bottom));
  background: $uni-bg-color;
  box-shadow: 0 -4rpx 20rpx $zx-black-60;
  gap: $uni-spacing-md;
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
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  color: $uni-text-color-inverse;
}

.action-btn--success {
  background: linear-gradient(135deg, $uni-color-success, $uni-color-success);
  color: $uni-text-color-inverse;
}

.action-btn--danger {
  background: $uni-bg-color;
  color: $uni-color-error;
  border: 2rpx solid $uni-color-error;
}

.safe-bottom {
  height: 40rpx;
}
</style>
