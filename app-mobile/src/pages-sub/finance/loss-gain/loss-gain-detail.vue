<template>
  <view class="detail-page">
    <page-header :title="order?.type === 'GAIN' ? '报溢详情' : '报损详情'" @back="goBack" />

    <!-- 状态头 -->
    <view class="status-header" v-if="order">
      <view class="status-badge" :class="getStatusClass(order.status)">
        <text class="status-badge-text">{{ getStatusText(order.status) }}</text>
      </view>
      <text class="order-no">{{ order.orderNo }}</text>
    </view>

    <!-- 基本信息 -->
    <view class="info-card" v-if="order">
      <view class="card-title">基本信息</view>
      <view class="info-row">
        <text class="info-label">单据类型</text>
        <text class="info-value">{{ order.type === 'GAIN' ? '报溢单' : '报损单' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">{{ order.type === 'GAIN' ? '报溢原因' : '报损原因' }}</text>
        <text class="info-value">{{ order.reasonText }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">门店</text>
        <text class="info-value">{{ order.storeName || '--' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">制单人</text>
        <text class="info-value">{{ order.operatorName || '--' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">创建时间</text>
        <text class="info-value">{{ order.createdAt }}</text>
      </view>
      <view class="info-row" v-if="order.auditorName">
        <text class="info-label">审核人</text>
        <text class="info-value">{{ order.auditorName }}</text>
      </view>
      <view class="info-row" v-if="order.auditedAt">
        <text class="info-label">审核时间</text>
        <text class="info-value">{{ order.auditedAt }}</text>
      </view>
    </view>

    <!-- 商品明细 -->
    <view class="info-card" v-if="order && order.items && order.items.length > 0">
      <view class="card-title">商品明细</view>
      <view class="goods-item" v-for="item in order.items" :key="item.id">
        <view class="goods-header">
          <text class="goods-name">{{ item.skuName }}</text>
        </view>
        <view class="goods-body">
          <view class="goods-info">
            <text class="goods-info-label">数量</text>
            <text class="goods-info-value">{{ item.quantity }}{{ item.unit || '' }}</text>
          </view>
          <view class="goods-info" v-if="item.costPrice != null">
            <text class="goods-info-label">成本价</text>
            <text class="goods-info-value">¥{{ item.costPrice.toFixed(2) }}</text>
          </view>
          <view class="goods-info" v-if="item.subtotalAmount != null">
            <text class="goods-info-label">小计</text>
            <text
              class="goods-info-value"
              :class="order.type === 'LOSS' ? 'text-danger' : 'text-success'"
            >¥{{ item.subtotalAmount.toFixed(2) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 照片凭证 -->
    <view class="info-card" v-if="order && order.photos && order.photos.length > 0">
      <view class="card-title">照片凭证</view>
      <view class="photo-list">
        <image
          class="photo-item"
          v-for="(photo, index) in order.photos"
          :key="index"
          :src="photo"
          mode="aspectFill"
          @tap="previewPhoto(index)"
        />
      </view>
    </view>

    <!-- 备注 -->
    <view class="info-card" v-if="order && order.remark">
      <view class="card-title">备注说明</view>
      <text class="remark-text">{{ order.remark }}</text>
    </view>

    <!-- 审核记录 -->
    <view class="info-card" v-if="order && order.auditLogs && order.auditLogs.length > 0">
      <view class="card-title">审核记录</view>
      <view class="timeline">
        <view class="timeline-item" v-for="(log, index) in order.auditLogs" :key="log.id">
          <view class="timeline-dot" :class="{ 'timeline-dot--last': index === order.auditLogs!.length - 1 }"></view>
          <view class="timeline-content">
            <view class="timeline-header">
              <text class="timeline-action">{{ log.actionText }}</text>
              <text class="timeline-time">{{ log.operatedAt }}</text>
            </view>
            <text class="timeline-operator">操作人：{{ log.operatorName }}</text>
            <text class="timeline-remark" v-if="log.remark">备注：{{ log.remark }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 合计 -->
    <view class="total-card" v-if="order">
      <view class="total-row">
        <text class="total-label">商品总数</text>
        <text class="total-value">{{ order.totalQty }} 件</text>
      </view>
      <view class="total-row total-row--main">
        <text class="total-label">{{ order.type === 'GAIN' ? '报溢总金额' : '报损总金额' }}</text>
        <text
          class="total-amount"
          :class="order.type === 'LOSS' ? 'text-danger' : 'text-success'"
        >¥{{ order.totalAmount.toFixed(2) }}</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="bottom-bar" v-if="order && order.status === 'PENDING'">
      <button class="btn btn--outline" @tap="onReject">驳回</button>
      <button class="btn btn--primary" @tap="onApprove">审核通过</button>
    </view>

    <view class="safe-bottom"></view>

    <!-- 驳回弹窗 -->
    <view class="modal-mask" v-if="showRejectModal" @tap="showRejectModal = false">
      <view class="modal-content" @tap.stop>
        <view class="modal-title">驳回原因</view>
        <textarea
          class="modal-textarea"
          v-model="rejectReason"
          placeholder="请输入驳回原因"
          maxlength="200"
        />
        <view class="modal-actions">
          <button class="modal-btn modal-btn--cancel" @tap="showRejectModal = false">取消</button>
          <button class="modal-btn modal-btn--confirm" @tap="confirmReject">确认驳回</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { inventoryLossGainApi, type LossGainOrder, type LossGainType } from '@/api/modules/inventory-loss-gain'

const order = ref<LossGainOrder | null>(null)
const loading = ref(false)
const showRejectModal = ref(false)
const rejectReason = ref('')

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回',
  }
  return map[status] ?? status
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'status-badge--pending', APPROVED: 'status-badge--approved',
    REJECTED: 'status-badge--rejected',
  }
  return map[status] ?? ''
}

function previewPhoto(index: number) {
  if (!order.value?.photos) return
  uni.previewImage({
    urls: order.value.photos,
    current: index,
  })
}

async function loadDetail(id: number, type: LossGainType = 'LOSS') {
  loading.value = true
  try {
    const result = await inventoryLossGainApi.detail(id, type)
    order.value = result
  } catch (err) {
    console.error('加载详情失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function onApprove() {
  if (!order.value) return
  uni.showModal({
    title: '确认通过',
    content: '确定要审核通过此单据吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await inventoryLossGainApi.approve(order.value!.id, order.value!.type)
          uni.showToast({ title: '审核通过', icon: 'success' })
          loadDetail(order.value!.id)
        } catch (err) {
          console.error('审核失败:', err)
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    },
  })
}

function onReject() {
  rejectReason.value = ''
  showRejectModal.value = true
}

async function confirmReject() {
  if (!order.value) return
  if (!rejectReason.value.trim()) {
    uni.showToast({ title: '请输入驳回原因', icon: 'none' })
    return
  }
  try {
    await inventoryLossGainApi.reject(order.value.id, rejectReason.value, order.value.type)
    uni.showToast({ title: '已驳回', icon: 'success' })
    showRejectModal.value = false
    loadDetail(order.value.id)
  } catch (err) {
    console.error('驳回失败:', err)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

onLoad((options: any) => {
  if (options.id) {
    loadDetail(Number(options.id), options.type === 'GAIN' ? 'GAIN' : 'LOSS')
  }
})
</script>

<style lang="scss" scoped>
.detail-page { min-height: 100vh; background: $uni-color-primary-soft; padding-bottom: 140rpx; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: $uni-bg-color; }
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }

.status-header {
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.status-badge {
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(255,255,255,0.2);
}
.status-badge--pending { background: rgba(250,173,20,0.3); }
.status-badge--approved { background: rgba(82,196,26,0.3); }
.status-badge--rejected { background: rgba(255,77,79,0.3); }
.status-badge-text { font-size: 24rpx; color: $uni-text-color-inverse; font-weight: 500; }
.order-no { font-size: 28rpx; color: $uni-text-color-inverse; font-weight: 600; }

.info-card {
  background: $uni-bg-color;
  margin: 16rpx 24rpx;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
}
.info-label { font-size: 26rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }

/* 商品明细 */
.goods-item {
  background: $uni-gray-50;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
}
.goods-item:last-child { margin-bottom: 0; }
.goods-header { margin-bottom: 16rpx; }
.goods-name { font-size: 28rpx; font-weight: 500; color: $uni-gray-700; }
.goods-body { display: flex; gap: 24rpx; }
.goods-info { flex: 1; display: flex; flex-direction: column; align-items: center; }
.goods-info-label { font-size: 22rpx; color: $uni-gray-400; margin-bottom: 8rpx; }
.goods-info-value { font-size: 28rpx; color: $uni-gray-700; font-weight: 500; }

.text-danger { color: $uni-color-error; }
.text-success { color: $uni-color-success; }

/* 照片 */
.photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.photo-item {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
}

/* 备注 */
.remark-text {
  font-size: 26rpx;
  color: $uni-gray-500;
  line-height: 1.6;
}

/* 审核记录时间线 */
.timeline {
  position: relative;
  padding-left: 32rpx;
}
.timeline-item {
  position: relative;
  padding-bottom: 24rpx;
}
.timeline-item:last-child { padding-bottom: 0; }
.timeline-dot {
  position: absolute;
  left: -32rpx;
  top: 8rpx;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: $uni-color-primary;
}
.timeline-dot--last { background: $uni-color-success; }
.timeline-item::before {
  content: '';
  position: absolute;
  left: -25rpx;
  top: 24rpx;
  bottom: 0;
  width: 2rpx;
  background: $uni-gray-200;
}
.timeline-item:last-child::before { display: none; }
.timeline-content {
  background: $uni-gray-50;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
}
.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.timeline-action { font-size: 26rpx; font-weight: 500; color: $uni-gray-700; }
.timeline-time { font-size: 22rpx; color: $uni-gray-400; }
.timeline-operator { font-size: 24rpx; color: $uni-gray-500; display: block; margin-bottom: 4rpx; }
.timeline-remark { font-size: 24rpx; color: $uni-color-error; display: block; }

/* 合计卡片 */
.total-card {
  background: $uni-bg-color;
  margin: 16rpx 24rpx;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0;
}
.total-row--main {
  padding-top: 16rpx;
  margin-top: 8rpx;
  border-top: 1rpx solid $uni-gray-100;
}
.total-label { font-size: 26rpx; color: $uni-gray-500; }
.total-value { font-size: 28rpx; color: $uni-gray-700; font-weight: 500; }
.total-amount { font-size: 36rpx; font-weight: 700; }

/* 底部操作栏 */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: $uni-bg-color;
  box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06);
}
.btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  text-align: center;
  border: none;
}
.btn--outline {
  background: $uni-bg-color;
  color: $uni-color-error;
  border: 2rpx solid $uni-color-error;
}
.btn--primary {
  background: $uni-color-success;
  color: $uni-text-color-inverse;
}

.safe-bottom { height: 40rpx; }

/* 驳回弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-content {
  width: 600rpx;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 32rpx;
}
.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
  text-align: center;
  margin-bottom: 24rpx;
}
.modal-textarea {
  width: 100%;
  height: 200rpx;
  background: $uni-bg-color-page;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  margin-bottom: 24rpx;
}
.modal-actions {
  display: flex;
  gap: 16rpx;
}
.modal-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 36rpx;
  font-size: 28rpx;
  text-align: center;
  border: none;
}
.modal-btn--cancel {
  background: $uni-bg-color-page;
  color: $uni-gray-500;
}
.modal-btn--confirm {
  background: $uni-color-error;
  color: $uni-text-color-inverse;
}
</style>
