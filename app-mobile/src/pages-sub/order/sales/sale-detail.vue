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
      <view class="card-title">单据信息</view>
      <view class="info-row"><text class="info-label">单据编号</text><text class="info-value">{{ bill.billNo }}</text></view>
      <view class="info-row"><text class="info-label">单据类型</text><text class="info-value">{{ saleTypeText }}</text></view>
      <view class="info-row"><text class="info-label">客户</text><text class="info-value">{{ bill.customerName || '散客' }}</text></view>
      <view class="info-row" v-if="bill.customerMobile"><text class="info-label">联系电话</text><text class="info-value">{{ bill.customerMobile }}</text></view>
      <view class="info-row" v-if="bill.salesmanName"><text class="info-label">业务员</text><text class="info-value">{{ bill.salesmanName }}</text></view>
      <view class="info-row" v-if="bill.operatorName"><text class="info-label">经手人</text><text class="info-value">{{ bill.operatorName }}</text></view>
      <view class="info-row" v-if="bill.dueDate"><text class="info-label">赊销到期日</text><text class="info-value">{{ formatDate(bill.dueDate) }}</text></view>
      <view class="info-row"><text class="info-label">开单时间</text><text class="info-value">{{ formatDate(bill.createdAt) }}</text></view>
      <view class="info-row" v-if="bill.remark"><text class="info-label">备注</text><text class="info-value info-value--wrap">{{ bill.remark }}</text></view>
    </view>

    <view class="info-card" v-if="bill">
      <view class="card-title">金额信息</view>
      <view class="info-row"><text class="info-label">商品合计</text><text class="info-value">¥{{ formatAmount(bill.goodsAmount ?? 0) }}</text></view>
      <view class="info-row" v-if="Number(bill.discountAmount) > 0"><text class="info-label">优惠</text><text class="info-value">-¥{{ formatAmount(bill.discountAmount ?? 0) }}</text></view>
      <view class="info-row" v-if="Number(bill.roundingAmount) != 0"><text class="info-label">抹零</text><text class="info-value">-¥{{ formatAmount(bill.roundingAmount ?? 0) }}</text></view>
      <view class="info-row"><text class="info-label">应收金额</text><text class="info-value amount">¥{{ formatAmount(bill.receivableAmount) }}</text></view>
      <view class="info-row"><text class="info-label">已收金额</text><text class="info-value">¥{{ formatAmount(bill.receivedAmount) }}</text></view>
      <view class="info-row" v-if="Number(bill.unreceivedAmount) > 0"><text class="info-label">未收金额</text><text class="info-value amount">¥{{ formatAmount(bill.unreceivedAmount ?? 0) }}</text></view>
      <view class="info-row"><text class="info-label">收款状态</text><text class="info-value">{{ statusText }}</text></view>
    </view>

    <view class="info-card" v-if="bill && bill.items && bill.items.length">
      <view class="card-title">商品明细</view>
      <view class="goods-item" v-for="(item, idx) in bill.items" :key="idx">
        <view class="goods-header">
          <text class="goods-name">{{ item.productName || item.skuName || '商品' }}</text>
          <text class="goods-spec" v-if="item.skuSpec || item.specs">{{ item.skuSpec || item.specs }}</text>
        </view>
        <view class="goods-body">
          <view class="goods-info"><text class="goods-info-label">数量</text><text class="goods-info-value">{{ qtyText(item) }}</text></view>
          <view class="goods-info"><text class="goods-info-label">单价</text><text class="goods-info-value">¥{{ formatAmount(item.unitPrice ?? 0) }}</text></view>
          <view class="goods-info"><text class="goods-info-label">小计</text><text class="goods-info-value">¥{{ formatAmount(item.subtotalAmount ?? 0) }}</text></view>
        </view>
        <view class="goods-remark" v-if="item.remark">备注：{{ item.remark }}</view>
      </view>
    </view>

    <view class="bottom-bar" v-if="bill && needCollect">
      <button class="btn btn--primary" @tap="onCollect">确认收款</button>
    </view>

    <!-- 加载中 / 加载失败 / 缺少单号：避免无参或接口失败时整页空白 -->
    <view class="state-wrap" v-if="!bill">
      <text class="state-text" v-if="loading">加载中…</text>
      <template v-else>
        <text class="state-text">{{ loadError || '未指定销售单号' }}</text>
        <button class="state-retry" v-if="billNo" @tap="retry">点击重试</button>
      </template>
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
const billNo = ref('')
const loading = ref(false)
const loadError = ref('')

const statusMap: Record<string, string> = {
  UNPAID: '待收款',
  PARTIAL: '部分收款',
  PAID: '已结清',
  OVERDUE: '已逾期',
  CANCELLED: '已取消',
  COMPLETED: '已完成',
}
const statusClassMap: Record<string, string> = {
  UNPAID: 'status-badge--pending',
  PARTIAL: 'status-badge--pending',
  OVERDUE: 'status-badge--rejected',
  PAID: 'status-badge--approved',
  CANCELLED: 'status-badge--rejected',
  COMPLETED: 'status-badge--approved',
}

/** 收款状态优先 collectionStatus（R96-07 对齐后端真实字段，原 status 后端不返回） */
const statusText = computed(() => {
  if (!bill.value) return ''
  const s = bill.value.collectionStatus || bill.value.status || ''
  return statusMap[s] ?? s ?? '—'
})
const statusClass = computed(() => {
  if (!bill.value) return ''
  const s = bill.value.collectionStatus || bill.value.status || ''
  return statusClassMap[s] ?? ''
})

/** CASH 现金单 / CREDIT 赊销单 */
const saleTypeText = computed(() => {
  if (!bill.value) return '—'
  return bill.value.saleType === 'CREDIT' ? '赊销单' : '现金单'
})

/** 数量展示：箱/瓶分开（原 boxQty+bottleQty 直接相加语义错误），如 "2箱5瓶" 或 "5瓶" */
function qtyText(item: any): string {
  const box = Number(item?.boxQty ?? 0)
  const bottle = Number(item?.bottleQty ?? 0)
  const unit = item?.unit || '瓶'
  const parts: string[] = []
  if (box > 0) parts.push(`${box}箱`)
  if (bottle > 0) parts.push(`${bottle}${unit}`)
  if (!parts.length) parts.push(`0${unit}`)
  const total = Number(item?.totalBottleQty ?? 0)
  const base = parts.join(' + ')
  return total > 0 ? `${base}（共${total}${unit}）` : base
}
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

async function loadDetail(no: string) {
  loading.value = true
  loadError.value = ''
  try {
    const data = await salesApi.detail(no)
    bill.value = data
  } catch (err: any) {
    console.error('加载销售单详情失败:', err)
    loadError.value = '加载失败，请检查网络后重试'
  } finally {
    loading.value = false
  }
}

function retry() {
  if (billNo.value) loadDetail(billNo.value)
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
  billNo.value = options?.billNo ?? ''
  if (billNo.value) loadDetail(billNo.value)
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
.info-value--wrap { flex: 1; margin-left: 24rpx; text-align: right; word-break: break-all; }
.amount { color: $uni-color-error; font-weight: 600; }

.goods-item {
  background: $uni-gray-50; border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-md; margin-bottom: $uni-spacing-sm;
}
.goods-item:last-child { margin-bottom: 0; }
.goods-header { margin-bottom: 16rpx; display: flex; flex-direction: column; gap: 6rpx; }
.goods-name { font-size: 28rpx; font-weight: 500; color: $uni-gray-700; }
.goods-spec { font-size: 22rpx; color: $uni-gray-400; }
.goods-remark { margin-top: 12rpx; font-size: 22rpx; color: $uni-gray-400; }
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

.state-wrap {
  display: flex; flex-direction: column; align-items: center;
  padding: 200rpx 0; gap: $uni-spacing-md;
}
.state-text { font-size: 28rpx; color: $uni-gray-300; }
.state-retry {
  padding: 0 $uni-spacing-lg; height: 64rpx; line-height: 64rpx;
  border-radius: 32rpx; font-size: 26rpx;
  background: $uni-bg-color; color: $uni-color-primary;
  border: 1rpx solid $uni-color-primary;
}
.state-retry::after { border: none; }

.safe-bottom { height: 40rpx; }
</style>
