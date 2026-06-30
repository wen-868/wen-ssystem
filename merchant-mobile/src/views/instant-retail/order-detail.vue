<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showDialog, showLoadingToast, showSuccessToast, closeToast } from 'vant'
import {
  fetchInstantRetailOrderDetail,
  confirmInstantRetailOrder,
  startInstantRetailDelivery,
  completeInstantRetailDelivery,
  cancelInstantRetailOrder,
  type InstantRetailOrderDetail
} from '../../api'

const route = useRoute()
const router = useRouter()

const PLATFORM_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  JD: { label: '京东秒送', color: '#fff', bgColor: '#E2231A' },
  MEITUAN: { label: '美团外卖', color: '#fff', bgColor: '#FFD101' },
  ELEME: { label: '饿了么', color: '#fff', bgColor: '#0097FF' }
}

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  PENDING: { text: '待接单', type: 'warning' },
  CONFIRMED: { text: '已接单', type: 'primary' },
  DELIVERING: { text: '配送中', type: 'primary' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已取消', type: 'default' }
}

const order = ref<InstantRetailOrderDetail | null>(null)
const loading = ref(false)
const courierName = ref('')
const courierPhone = ref('')
const showCourierDialog = ref(false)

function getPlatformInfo(platform: string) {
  return PLATFORM_MAP[platform] || { label: platform, color: '#333', bgColor: '#eee' }
}

async function loadDetail() {
  const platformOrderId = route.params.platformOrderId as string
  if (!platformOrderId) return
  loading.value = true
  try {
    const res = await fetchInstantRetailOrderDetail(platformOrderId)
    order.value = res.data
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

async function handleConfirm() {
  if (!order.value) return
  try {
    await showDialog({
      title: '确认接单',
      message: '确认接受该订单？接单后请及时备货并安排配送。'
    })
    showLoadingToast({ message: '处理中...', forbidClick: true })
    await confirmInstantRetailOrder(order.value.platformOrderId)
    closeToast()
    showSuccessToast('接单成功')
    loadDetail()
  } catch {
    closeToast()
  }
}

function openCourierDialog() {
  showCourierDialog.value = true
}

async function handleStartDelivery() {
  if (!order.value) return
  showCourierDialog.value = false
  showLoadingToast({ message: '处理中...', forbidClick: true })
  try {
    await startInstantRetailDelivery(order.value.platformOrderId, {
      courierName: courierName.value,
      courierPhone: courierPhone.value
    })
    closeToast()
    showSuccessToast('已开始配送')
    loadDetail()
  } catch {
    closeToast()
  }
}

async function handleCompleteDelivery() {
  if (!order.value) return
  try {
    await showDialog({
      title: '确认完成',
      message: '确认配送已完成？完成后订单将标记为已完成状态。'
    })
    showLoadingToast({ message: '处理中...', forbidClick: true })
    await completeInstantRetailDelivery(order.value.platformOrderId)
    closeToast()
    showSuccessToast('配送已完成')
    loadDetail()
  } catch {
    closeToast()
  }
}

async function handleCancel() {
  if (!order.value) return
  try {
    await showDialog({
      title: '取消订单',
      message: '确认取消该订单？取消后将同步至平台。'
    })
    showLoadingToast({ message: '处理中...', forbidClick: true })
    await cancelInstantRetailOrder(order.value.platformOrderId, '商家取消')
    closeToast()
    showSuccessToast('已取消')
    router.back()
  } catch {
    closeToast()
  }
}

function canConfirm(status: string) {
  return status === 'PENDING'
}

function canStartDelivery(status: string) {
  return status === 'CONFIRMED'
}

function canComplete(status: string) {
  return status === 'DELIVERING'
}

function canCancel(status: string) {
  return status === 'PENDING' || status === 'CONFIRMED'
}

function callPhone(phone: string) {
  window.location.href = `tel:${phone}`
}

onMounted(() => {
  loadDetail()
})
</script>

<template>
  <section class="page">
    <div class="nav-bar">
      <van-icon name="arrow-left" size="20" @click="router.back()" />
      <span class="nav-title">订单详情</span>
      <span></span>
    </div>

    <div v-if="loading" class="loading-wrapper">
      <van-loading type="spinner" />
    </div>

    <template v-else-if="order">
      <!-- 订单状态 -->
      <div class="status-card" :class="order.status.toLowerCase()">
        <div class="status-header">
          <div class="platform-tag" :style="{ backgroundColor: getPlatformInfo(order.platform).bgColor, color: getPlatformInfo(order.platform).color }">
            {{ getPlatformInfo(order.platform).label }}
          </div>
          <van-tag :type="(STATUS_MAP[order.status]?.type as any) || 'default'" size="large">
            {{ STATUS_MAP[order.status]?.text || order.status }}
          </van-tag>
        </div>
        <div class="order-no">{{ order.platformOrderId }}</div>
        <div class="order-time">下单时间：{{ order.createdAt }}</div>
      </div>

      <!-- 配送信息 -->
      <div class="section-card">
        <div class="section-title">配送信息</div>
        <div class="delivery-info">
          <div class="info-row">
            <span class="info-label">收货人</span>
            <span class="info-value">{{ order.receiverName }}</span>
          </div>
          <div class="info-row phone-row" @click="callPhone(order.receiverPhone)">
            <span class="info-label">联系电话</span>
            <span class="info-value phone">
              {{ order.receiverPhone }}
              <van-icon name="phone-o" size="16" />
            </span>
          </div>
          <div class="info-row address-row">
            <span class="info-label">配送地址</span>
            <span class="info-value">{{ order.receiverAddress }}</span>
          </div>
        </div>
      </div>

      <!-- 商品明细 -->
      <div class="section-card">
        <div class="section-title">商品明细</div>
        <div class="goods-list">
          <div class="goods-item" v-for="(item, index) in order.items" :key="index">
            <div class="goods-info">
              <div class="goods-name">{{ item.skuName }}</div>
              <div class="goods-price">¥{{ Number(item.unitPrice).toFixed(2) }}</div>
            </div>
            <div class="goods-right">
              <span class="goods-qty">x{{ item.quantity }}</span>
              <span class="goods-subtotal">¥{{ Number(item.subtotal).toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 金额明细 -->
      <div class="section-card">
        <div class="section-title">金额明细</div>
        <div class="amount-list">
          <div class="amount-row">
            <span class="amount-label">商品总额</span>
            <span class="amount-value">¥{{ Number(order.orderAmount).toFixed(2) }}</span>
          </div>
          <div class="amount-row">
            <span class="amount-label">配送费</span>
            <span class="amount-value">¥{{ Number(order.deliveryFee).toFixed(2) }}</span>
          </div>
          <div class="amount-row">
            <span class="amount-label">优惠</span>
            <span class="amount-value discount">-¥{{ Number(order.discountAmount).toFixed(2) }}</span>
          </div>
          <div class="amount-row total">
            <span class="amount-label">实付金额</span>
            <span class="amount-value">¥{{ Number(order.actualAmount).toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="bottom-actions">
        <van-button
          v-if="canCancel(order.status)"
          type="default"
          block
          @click="handleCancel"
        >
          取消订单
        </van-button>
        <van-button
          v-if="canConfirm(order.status)"
          type="primary"
          block
          @click="handleConfirm"
        >
          确认接单
        </van-button>
        <van-button
          v-if="canStartDelivery(order.status)"
          type="primary"
          block
          @click="openCourierDialog"
        >
          开始配送
        </van-button>
        <van-button
          v-if="canComplete(order.status)"
          type="success"
          block
          @click="handleCompleteDelivery"
        >
          完成配送
        </van-button>
      </div>
    </template>

    <!-- 配送员信息弹窗 -->
    <van-popup v-model:show="showCourierDialog" position="bottom" round>
      <div class="courier-dialog">
        <h3>填写配送信息</h3>
        <van-cell-group inset>
          <van-field
            v-model="courierName"
            label="配送员姓名"
            placeholder="请输入配送员姓名"
          />
          <van-field
            v-model="courierPhone"
            type="tel"
            label="配送员电话"
            placeholder="请输入配送员电话"
          />
        </van-cell-group>
        <div class="dialog-actions">
          <van-button type="default" block @click="showCourierDialog = false">
            取消
          </van-button>
          <van-button type="primary" block @click="handleStartDelivery">
            确认开始配送
          </van-button>
        </div>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.page {
  padding-bottom: 80px;
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-card);
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.loading-wrapper {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.status-card {
  margin: 12px;
  padding: 16px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-primary) 0%, #4a7dff 100%);
  color: #fff;
}

.status-card.pending {
  background: linear-gradient(135deg, #ff976a 0%, #ff6b35 100%);
}

.status-card.delivering {
  background: linear-gradient(135deg, #1989fa 0%, #007aff 100%);
}

.status-card.completed {
  background: linear-gradient(135deg, #07c160 0%, #00a854 100%);
}

.status-card.cancelled {
  background: linear-gradient(135deg, #969799 0%, #646566 100%);
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.platform-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  font-weight: 500;
}

.order-no {
  font-size: 14px;
  margin-bottom: 4px;
  font-family: monospace;
  opacity: 0.9;
}

.order-time {
  font-size: 12px;
  opacity: 0.8;
}

.section-card {
  margin: 12px;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-card);
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.delivery-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.info-label {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 70px;
  flex-shrink: 0;
}

.info-value {
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
}

.phone-row {
  cursor: pointer;
}

.phone {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-primary);
}

.goods-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.goods-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.goods-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.goods-info {
  flex: 1;
}

.goods-name {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.goods-price {
  font-size: 13px;
  color: var(--text-secondary);
}

.goods-right {
  text-align: right;
}

.goods-qty {
  font-size: 13px;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 4px;
}

.goods-subtotal {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.amount-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.amount-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.amount-value {
  font-size: 13px;
  color: var(--text-primary);
}

.amount-value.discount {
  color: var(--color-danger);
}

.amount-row.total {
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

.amount-row.total .amount-label {
  font-weight: 600;
  color: var(--text-primary);
}

.amount-row.total .amount-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  background: var(--bg-card);
  display: flex;
  gap: 10px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.bottom-actions .van-button {
  flex: 1;
}

.courier-dialog {
  padding: 20px 16px;
}

.courier-dialog h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.dialog-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.dialog-actions .van-button {
  flex: 1;
}
</style>
