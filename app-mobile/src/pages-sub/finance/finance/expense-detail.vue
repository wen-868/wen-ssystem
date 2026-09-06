<template>
  <view class="detail-page">
    <page-header title="费用详情" @back="goBack" />

    <view class="status-header" v-if="expense">
      <view class="status-badge" :class="statusClass">
        <text class="status-badge-text">{{ expense.statusName }}</text>
      </view>
      <text class="order-no">{{ expense.expenseNo }}</text>
    </view>

    <view class="info-card" v-if="expense">
      <view class="card-title">费用信息</view>
      <view class="info-row">
        <text class="info-label">费用类型</text>
        <text class="info-value">{{ expense.typeName || '—' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">金额</text>
        <text class="info-value amount">¥{{ formatAmount(expense.amount) }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">发生日期</text>
        <text class="info-value">{{ formatDate(expense.date) }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">提交人</text>
        <text class="info-value">{{ expense.submitterName || '—' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">创建时间</text>
        <text class="info-value">{{ formatDate(expense.createdAt) }}</text>
      </view>
    </view>

    <view class="info-card" v-if="expense && expense.remark">
      <view class="card-title">备注说明</view>
      <text class="remark-text">{{ expense.remark }}</text>
    </view>

    <view class="bottom-bar" v-if="expense && expense.status === 'PENDING'">
      <button class="btn btn--outline" @tap="onReject">驳回</button>
      <button class="btn btn--primary" @tap="onApprove">审核通过</button>
    </view>

    <view class="safe-bottom"></view>

    <view class="modal-mask" v-if="showRejectModal" @tap="showRejectModal = false">
      <view class="modal-content" @tap.stop>
        <view class="modal-title">驳回原因</view>
        <textarea class="modal-textarea" v-model="rejectReason" placeholder="请输入驳回原因" maxlength="200" />
        <view class="modal-actions">
          <button class="modal-btn modal-btn--cancel" @tap="showRejectModal = false">取消</button>
          <button class="modal-btn modal-btn--confirm" @tap="confirmReject">确认驳回</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
function goBack() { uni.navigateBack() }

import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { expenseApi, type Expense } from '@/api/modules/expenses'

const expense = ref<Expense | null>(null)
const showRejectModal = ref(false)
const rejectReason = ref('')

const statusClass = computed(() => {
  const map: Record<string, string> = {
    PENDING: 'status-badge--pending',
    APPROVED: 'status-badge--approved',
    REJECTED: 'status-badge--rejected',
  }
  return expense.value ? (map[expense.value.status] ?? '') : ''
})

function formatAmount(amount: number): string {
  return Number(amount || 0).toFixed(2)
}

function formatDate(date?: string): string {
  if (!date) return '—'
  return String(date).split('T')[0]
}

async function loadDetail(id: number) {
  try {
    const data = await expenseApi.getDetail(id)
    expense.value = data
  } catch (err) {
    console.error('加载费用详情失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function onApprove() {
  if (!expense.value) return
  uni.showModal({
    title: '确认通过',
    content: `确定要通过费用单 ${expense.value.expenseNo} 吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await expenseApi.approve(expense.value!.id)
          uni.showToast({ title: '审核通过', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 800)
        } catch (err) {
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
  if (!expense.value) return
  if (!rejectReason.value.trim()) {
    uni.showToast({ title: '请输入驳回原因', icon: 'none' })
    return
  }
  try {
    await expenseApi.reject(expense.value.id, rejectReason.value)
    uni.showToast({ title: '已驳回', icon: 'success' })
    showRejectModal.value = false
    setTimeout(() => uni.navigateBack(), 800)
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

onLoad((options: any) => {
  if (options.id) loadDetail(Number(options.id))
})
</script>

<style lang="scss" scoped>
.detail-page { min-height: 100vh; background: $uni-color-primary-soft; padding-bottom: 140rpx; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + var(--safe-top)); background: $uni-bg-color; }
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }

.status-header {
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  padding: 40rpx 32rpx;
  display: flex; flex-direction: column; align-items: center; gap: 16rpx;
}
.status-badge { padding: 8rpx 24rpx; border-radius: 24rpx; background: $zx-white-200; }
.status-badge--pending { background: $zx-orange2-300; }
.status-badge--approved { background: $zx-antgreen-300; }
.status-badge--rejected { background: $zx-antred-300; }
.status-badge-text { font-size: 24rpx; color: $uni-text-color-inverse; font-weight: 500; }
.order-no { font-size: 28rpx; color: $uni-text-color-inverse; font-weight: 600; }

.info-card {
  background: $uni-bg-color; margin: $uni-spacing-sm $uni-spacing-base;
  border-radius: $uni-border-radius-xs; padding: $uni-spacing-base; box-shadow: $uni-shadow-card-sm;
}
.card-title {
  font-size: 30rpx; font-weight: 600; color: $uni-gray-700; margin-bottom: $uni-spacing-md;
  padding-bottom: $uni-spacing-sm; border-bottom: 1rpx solid $uni-gray-100;
}
.info-row { display: flex; justify-content: space-between; align-items: center; padding: $uni-spacing-sm 0; }
.info-label { font-size: 26rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.amount { color: $uni-color-error; font-weight: 600; }
.remark-text { font-size: 26rpx; color: $uni-gray-500; line-height: 1.6; }

.bottom-bar {
  position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 16rpx;
  padding: 20rpx 24rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: $uni-bg-color; box-shadow: 0 -2rpx 12rpx $zx-black-60;
}
.btn {
  flex: 1; height: 80rpx; line-height: 80rpx; border-radius: 40rpx; font-size: 28rpx;
  text-align: center; border: none;
}
.btn--outline { background: $uni-bg-color; color: $uni-color-error; border: 2rpx solid $uni-color-error; }
.btn--primary { background: $uni-color-success; color: $uni-text-color-inverse; }
.safe-bottom { height: 40rpx; }

.modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: $zx-black-500;
  z-index: 1000; display: flex; align-items: center; justify-content: center;
}
.modal-content {
  width: 600rpx; background: $uni-bg-color; border-radius: $uni-border-radius-xs; padding: $uni-spacing-lg;
}
.modal-title { font-size: 32rpx; font-weight: 600; color: $uni-gray-700; text-align: center; margin-bottom: $uni-spacing-base; }
.modal-textarea {
  width: 100%; height: 200rpx; background: $uni-bg-color-page; border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-md; font-size: 28rpx; box-sizing: border-box; margin-bottom: $uni-spacing-base;
}
.modal-actions { display: flex; gap: $uni-spacing-sm; }
.modal-btn {
  flex: 1; height: 72rpx; line-height: 72rpx; border-radius: 36rpx; font-size: 28rpx; text-align: center; border: none;
}
.modal-btn--cancel { background: $uni-bg-color-page; color: $uni-gray-500; }
.modal-btn--confirm { background: $uni-color-error; color: $uni-text-color-inverse; }
</style>
