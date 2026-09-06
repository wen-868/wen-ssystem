<template>
  <view class="detail-page">
    <page-header title="销售单详情" @back="goBack" />

    <view class="status-header" v-if="bill">
      <view class="status-badge" :class="statusClass">
        <text class="status-badge-text">{{ statusText }}</text>
      </view>
      <text class="order-no">{{ bill.billNo }}</text>
    </view>

    <view class="info-card" v-if="bill">
      <view class="card-title">订单信息</view>
      <view class="info-row"><text class="info-label">客户</text><text class="info-value">{{ bill.customerName || '散客' }}</text></view>
      <view class="info-row" v-if="bill.customerMobile"><text class="info-label">联系电话</text><text class="info-value">{{ bill.customerMobile }}</text></view>
      <view class="info-row"><text class="info-label">总金额</text><text class="info-value amount">¥{{ formatAmount(bill.totalAmount) }}</text></view>
      <view class="info-row"><text class="info-label">应收金额</text><text class="info-value">¥{{ formatAmount(bill.receivableAmount) }}</text></view>
      <view class="info-row"><text class="info-label">已收金额</text><text class="info-value">¥{{ formatAmount(bill.receivedAmount) }}</text></view>
      <view class="info-row"><text class="info-label">状态</text><text class="info-value">{{ statusText }}</text></view>
      <view class="info-row"><text class="info-label">创建时间</text><text class="info-value">{{ formatDate(bill.createdAt) }}</text></view>
    </view>

    <view class="info-card" v-if="bill && bill.items && bill.items.length">
      <view class="card-title">商品明细</view>
      <view class="goods-item" v-for="(item, idx) in bill.items" :key="idx">
        <view class="goods-header"><text class="goods-name">{{ item.productName || item.skuName || '商品' }}</text></view>
        <view class="goods-body">
          <view class="goods-info"><text class="goods-info-label">单价</text><text class="goods-info-value">¥{{ formatAmount(item.unitPrice ?? 0) }}</text></view>
          <view class="goods-info"><text class="goods-info-label">数量</text><text class="goods-info-value">{{ (item.boxQty ?? 0) + (item.bottleQty ?? 0) }} {{ item.unit || '' }}</text></view>
          <view class="goods-info"><text class="goods-info-label">小计</text><text class="goods-info-value">¥{{ formatAmount(item.subtotalAmount ?? 0) }}</text></view>
        </view>
      </view>
    </view>

    <view class="bottom-bar" v-if="bill && needCollect">
      <button class="btn btn--primary" @tap="onCollect">确认收款</button>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack() { uni.navigateBack() }

import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { salesApi, type SaleBillInfo } from '@/api/modules/sales'

const bill = ref<SaleBillInfo | null>(null)

const statusMap: Record<string, string> = {
  PENDING: '待收款',
  PAID: '已结清',
  PARTIAL: '部分收款',
  CANCELLED: '已取消',
  COMPLETED: '已完成',
}
const statusClassMap: Record<string, string> = {
  PENDING: 'status-badge--pending',
  PAID: 'status-badge--approved',
  PARTIAL: 'status-badge--pending',
  CANCELLED: 'status-badge--rejected',
  COMPLETED: 'status-badge--approved',
}

const statusText = computed(() => {
  if (!bill.value) return ''
  return statusMap[bill.value.status] ?? bill.value.status ?? '—'
})
const statusClass = computed(() => {
  if (!bill.value) return ''
  return statusClassMap[bill.value.status] ?? ''
})
const needCollect = computed(() => {
  if (!bill.value) return false
  const receivable = Number(bill.value.receivableAmount ?? 0)
  const received = Number(bill.value.receivedAmount ?? 0)
  return receivable - received > 0.001
})

function formatAmount(amount: number): string {
  return Number(amount || 0).toFixed(2)
}
function formatDate(date?: string): string {
  if (!date) return '—'
  return String(date).split('T')[0]
}

async function loadDetail(billNo: string) {
  try {
    const data = await salesApi.detail(billNo)
    bill.value = data
  } catch (err) {
    console.error('加载销售单详情失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

async function onCollect() {
  if (!bill.value) return
  const amount = Number(bill.value.receivableAmount ?? 0) - Number(bill.value.receivedAmount ?? 0)
  if (amount <= 0) return
  uni.showModal({
    title: '确认收款',
    content: `确认收款 ¥${amount.toFixed(2)}？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await salesApi.offlinePayment(bill.value!.billNo, amount, 'CASH')
          uni.showToast({ title: '收款成功', icon: 'success' })
          loadDetail(bill.value!.billNo)
        } catch (err) {
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    },
  })
}

onLoad((options: any) => {
  if (options.billNo) loadDetail(options.billNo)
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

.goods-item {
  background: $uni-gray-50; border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-md; margin-bottom: $uni-spacing-sm;
}
.goods-item:last-child { margin-bottom: 0; }
.goods-header { margin-bottom: 16rpx; }
.goods-name { font-size: 28rpx; font-weight: 500; color: $uni-gray-700; }
.goods-body { display: flex; gap: $uni-spacing-base; }
.goods-info { flex: 1; display: flex; flex-direction: column; align-items: center; }
.goods-info-label { font-size: 22rpx; color: $uni-gray-400; margin-bottom: $uni-spacing-xs; }
.goods-info-value { font-size: 28rpx; color: $uni-gray-700; font-weight: 500; }

.bottom-bar {
  position: fixed; left: 0; right: 0; bottom: 0; display: flex;
  padding: 20rpx 24rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: $uni-bg-color; box-shadow: 0 -2rpx 12rpx $zx-black-60;
}
.btn {
  flex: 1; height: 80rpx; line-height: 80rpx; border-radius: 40rpx; font-size: 28rpx;
  text-align: center; border: none;
}
.btn--primary { background: $uni-color-success; color: $uni-text-color-inverse; }
.safe-bottom { height: 40rpx; }
</style>
