<template>
  <view class="detail-page">
    <view class="page-header">
      <text class="header-title">{{ order?.type === 'GAIN' ? '报溢详情' : '报损详情' }}</text>
    </view>

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
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { inventoryLossGainApi, type LossGainOrder } from '@/api/modules/inventory-loss-gain'

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

async function loadDetail(id: number) {
  loading.value = true
  try {
    const result = await inventoryLossGainApi.detail(id)
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
          await inventoryLossGainApi.approve(order.value!.id)
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
    await inventoryLossGainApi.reject(order.value.id, rejectReason.value)
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
    loadDetail(Number(options.id))
  }
})
</script>

<style scoped>
.detail-page { min-height: 100vh; background: #f0f5ff; padding-bottom: 140rpx; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: #fff; }
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }

.status-header {
  background: linear-gradient(135deg, #1677FF, #4096ff);
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
.status-badge-text { font-size: 24rpx; color: #fff; font-weight: 500; }
.order-no { font-size: 28rpx; color: #fff; font-weight: 600; }

.info-card {
  background: #fff;
  margin: 16rpx 24rpx;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
}
.info-label { font-size: 26rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }

/* 商品明细 */
.goods-item {
  background: #f9f9f9;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
}
.goods-item:last-child { margin-bottom: 0; }
.goods-header { margin-bottom: 16rpx; }
.goods-name { font-size: 28rpx; font-weight: 500; color: #333; }
.goods-body { display: flex; gap: 24rpx; }
.goods-info { flex: 1; display: flex; flex-direction: column; align-items: center; }
.goods-info-label { font-size: 22rpx; color: #999; margin-bottom: 8rpx; }
.goods-info-value { font-size: 28rpx; color: #333; font-weight: 500; }

.text-danger { color: #ff4d4f; }
.text-success { color: #52c41a; }

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
  color: #666;
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
  background: #1677FF;
}
.timeline-dot--last { background: #52c41a; }
.timeline-item::before {
  content: '';
  position: absolute;
  left: -25rpx;
  top: 24rpx;
  bottom: 0;
  width: 2rpx;
  background: #e8e8e8;
}
.timeline-item:last-child::before { display: none; }
.timeline-content {
  background: #f9f9f9;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
}
.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.timeline-action { font-size: 26rpx; font-weight: 500; color: #333; }
.timeline-time { font-size: 22rpx; color: #999; }
.timeline-operator { font-size: 24rpx; color: #666; display: block; margin-bottom: 4rpx; }
.timeline-remark { font-size: 24rpx; color: #ff4d4f; display: block; }

/* 合计卡片 */
.total-card {
  background: #fff;
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
  border-top: 1rpx solid #f0f0f0;
}
.total-label { font-size: 26rpx; color: #666; }
.total-value { font-size: 28rpx; color: #333; font-weight: 500; }
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
  background: #fff;
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
  background: #fff;
  color: #ff4d4f;
  border: 2rpx solid #ff4d4f;
}
.btn--primary {
  background: #52c41a;
  color: #fff;
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
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
}
.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  text-align: center;
  margin-bottom: 24rpx;
}
.modal-textarea {
  width: 100%;
  height: 200rpx;
  background: #f5f7fa;
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
  background: #f5f7fa;
  color: #666;
}
.modal-btn--confirm {
  background: #ff4d4f;
  color: #fff;
}
</style>
