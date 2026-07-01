<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showDialog, showLoadingToast, showSuccessToast, closeToast } from 'vant'
import {
  fetchChannelOrderDetail,
  confirmChannelOrder,
  dispatchChannelOrder,
  completeChannelOrder,
  cancelChannelOrder,
  type ChannelOrderDetail
} from '../api'

const route = useRoute()
const router = useRouter()

/* ========== 渠道颜色映射 ========== */

const CHANNEL_COLOR_MAP: Record<string, string> = {
  WECHAT: '#07C160',
  DOUYIN: '#010101',
  MEITUAN: '#FFD101',
  ELEME: '#0097FF',
  JD: '#E2231A',
  OFFLINE: '#666'
}

const CHANNEL_LABEL_MAP: Record<string, string> = {
  WECHAT: '微信',
  DOUYIN: '抖音',
  MEITUAN: '美团',
  ELEME: '饿了么',
  JD: '京东',
  OFFLINE: '线下'
}

/* ========== 状态映射 ========== */

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  PENDING: { text: '待处理', type: 'warning' },
  CONFIRMED: { text: '已确认', type: 'primary' },
  DELIVERING: { text: '配送中', type: 'primary' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已取消', type: 'default' }
}

/* ========== 状态背景渐变 ========== */

const STATUS_BG_MAP: Record<string, string> = {
  PENDING: 'linear-gradient(135deg, #ff976a 0%, #ff6b35 100%)',
  CONFIRMED: 'linear-gradient(135deg, #1989fa 0%, #007aff 100%)',
  DELIVERING: 'linear-gradient(135deg, #1989fa 0%, #007aff 100%)',
  COMPLETED: 'linear-gradient(135deg, #07c160 0%, #00a854 100%)',
  CANCELLED: 'linear-gradient(135deg, #969799 0%, #646566 100%)'
}

/* ========== 拒单原因 ========== */

const REJECT_REASONS = ['缺货', '无法配送', '客户取消', '其他']

/* ========== 数据 ========== */

const order = ref<ChannelOrderDetail | null>(null)
const loading = ref(false)

/* ========== 配送弹窗 ========== */

const showCourierDialog = ref(false)
const courierName = ref('')
const courierPhone = ref('')

/* ========== 拒单弹窗 ========== */

const showRejectDialog = ref(false)
const rejectReason = ref(REJECT_REASONS[0])

/* ========== 工具函数 ========== */

function getChannelInfo(channel: string) {
  return {
    label: CHANNEL_LABEL_MAP[channel] || channel,
    color: CHANNEL_COLOR_MAP[channel] || '#999'
  }
}

function getStatusBg(status: string) {
  return STATUS_BG_MAP[status] || STATUS_BG_MAP.PENDING
}

function formatAmount(amount: number) {
  return Number(amount).toFixed(2)
}

/* ========== 数据加载 ========== */

async function loadDetail() {
  const id = route.params.id as string
  if (!id) return
  loading.value = true
  try {
    const res = await fetchChannelOrderDetail(id)
    order.value = res.data
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

/* ========== 操作处理 ========== */

async function handleConfirm() {
  if (!order.value) return
  try {
    await showDialog({
      title: '确认接单',
      message: '确认接受该订单？接单后请及时备货并安排配送。'
    })
    showLoadingToast({ message: '处理中...', forbidClick: true })
    await confirmChannelOrder(order.value.channelOrderNo)
    closeToast()
    showSuccessToast('接单成功')
    loadDetail()
  } catch {
    closeToast()
  }
}

function openRejectDialog() {
  rejectReason.value = REJECT_REASONS[0]
  showRejectDialog.value = true
}

async function handleReject() {
  if (!order.value) return
  showRejectDialog.value = false
  showLoadingToast({ message: '处理中...', forbidClick: true })
  try {
    await cancelChannelOrder(order.value.channelOrderNo, rejectReason.value)
    closeToast()
    showSuccessToast('已拒单')
    router.back()
  } catch {
    closeToast()
  }
}

function openCourierDialog() {
  courierName.value = ''
  courierPhone.value = ''
  showCourierDialog.value = true
}

async function handleDispatch() {
  if (!order.value) return
  showCourierDialog.value = false
  showLoadingToast({ message: '处理中...', forbidClick: true })
  try {
    await dispatchChannelOrder(order.value.channelOrderNo, {
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

async function handleComplete() {
  if (!order.value) return
  try {
    await showDialog({
      title: '确认完成',
      message: '确认配送已完成？完成后订单将标记为已完成状态。'
    })
    showLoadingToast({ message: '处理中...', forbidClick: true })
    await completeChannelOrder(order.value.channelOrderNo)
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
    await cancelChannelOrder(order.value.channelOrderNo, '商家取消')
    closeToast()
    showSuccessToast('已取消')
    loadDetail()
  } catch {
    closeToast()
  }
}

function goToAftersale() {
  router.push('/order-aftersale/list')
}

function callPhone(phone: string) {
  window.location.href = `tel:${phone}`
}

/* ========== 状态判断 ========== */

function canConfirm(status: string) {
  return status === 'PENDING'
}

function canStartDelivery(status: string) {
  return status === 'CONFIRMED'
}

function canComplete(status: string) {
  return status === 'DELIVERING'
}

function isCompleted(status: string) {
  return status === 'COMPLETED'
}

onMounted(() => {
  loadDetail()
})
</script>

<template>
  <section class="page">
    <!-- 顶部导航栏 -->
    <div class="nav-bar">
      <van-icon name="arrow-left" size="20" @click="router.back()" />
      <span class="nav-title">订单详情</span>
      <span></span>
    </div>

    <div v-if="loading" class="loading-wrapper">
      <van-loading type="spinner" />
    </div>

    <template v-else-if="order">
      <!-- 订单状态卡片 -->
      <div class="status-card" :style="{ background: getStatusBg(order.orderStatus) }">
        <div class="status-header">
          <div class="status-header-left">
            <van-tag
              :color="getChannelInfo(order.channel).color"
              text-color="#fff"
              size="medium"
            >
              {{ getChannelInfo(order.channel).label }}
            </van-tag>
            <van-tag
              :type="(STATUS_MAP[order.orderStatus]?.type as any) || 'default'"
              size="medium"
              text-color="#fff"
              style="background: transparent; border-color: rgba(255,255,255,0.6);"
            >
              {{ STATUS_MAP[order.orderStatus]?.text || order.orderStatus }}
            </van-tag>
          </div>
          <!-- 异常标记 -->
          <div v-if="order.exceptionFlag" class="exception-tag">
            <van-icon name="warning-o" size="16" color="#fff" />
            <span class="exception-text">{{ order.exceptionReason }}</span>
          </div>
        </div>
        <div class="order-no">{{ order.channelOrderNo }}</div>
        <div class="order-time">下单时间：{{ order.createdAt }}</div>
      </div>

      <!-- 商品明细 -->
      <van-cell-group title="商品明细" class="section-group">
        <van-cell
          v-for="(item, index) in order.items"
          :key="index"
          :title="item.channelSkuName"
          :label="item.localSkuName"
          center
        >
          <template #value>
            <div class="goods-value">
              <span class="goods-price">¥{{ formatAmount(item.price) }}</span>
              <span class="goods-qty">x{{ item.quantity }}</span>
              <span class="goods-subtotal">¥{{ formatAmount(item.subtotal) }}</span>
            </div>
          </template>
        </van-cell>
        <van-cell class="total-cell">
          <template #title>
            <span class="total-label">合计</span>
          </template>
          <template #value>
            <span class="total-amount">¥{{ formatAmount(order.payAmount || order.totalAmount) }}</span>
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 金额明细 -->
      <van-cell-group title="金额明细" class="section-group">
        <van-cell title="商品总额" :value="'¥' + formatAmount(order.totalAmount)" />
        <van-cell title="优惠金额" :value="'-¥' + formatAmount(order.discountAmount)" value-class="discount-value" />
        <van-cell title="配送费" :value="'¥' + formatAmount(order.deliveryFee)" />
        <van-cell title="实付金额" value-class="pay-amount-value">
          <template #title>
            <span class="pay-amount-label">实付金额</span>
          </template>
          <template #value>
            <span class="pay-amount">¥{{ formatAmount(order.payAmount || order.totalAmount) }}</span>
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 配送信息 -->
      <van-cell-group title="配送信息" class="section-group">
        <van-cell title="收货人" :value="order.receiverName" />
        <van-cell title="联系电话" :value="order.receiverPhone" is-link @click="callPhone(order.receiverPhone)">
          <template #value>
            <span class="phone-value">
              {{ order.receiverPhone }}
              <van-icon name="phone-o" size="14" />
            </span>
          </template>
        </van-cell>
        <van-cell title="收货地址" :value="order.receiverAddress" />
        <van-cell title="配送方式" :value="order.deliveryMethod" />
        <van-cell v-if="order.remark" title="备注" :value="order.remark" />
      </van-cell-group>

      <!-- 状态流转时间线 -->
      <van-cell-group v-if="order.statusTimeline && order.statusTimeline.length" title="状态流转" class="section-group">
        <div class="timeline-wrapper">
          <van-steps
            direction="vertical"
            :active="order.statusTimeline.length - 1"
            active-color="#1989fa"
          >
            <van-step v-for="(step, index) in order.statusTimeline" :key="index">
              <template #active-icon>
                <van-icon name="checked" color="#1989fa" />
              </template>
              <template #inactive-icon>
                <van-icon name="clock-o" color="#c8c9cc" />
              </template>
              <div class="step-content">
                <div class="step-label">{{ step.label }}</div>
                <div class="step-time">{{ step.time }}</div>
              </div>
            </van-step>
          </van-steps>
        </div>
      </van-cell-group>
    </template>

    <!-- 底部操作栏 -->
    <van-action-bar v-if="order" :safe-area-inset-bottom="true">
      <van-action-bar-button
        v-if="canConfirm(order.orderStatus)"
        type="danger"
        text="拒单"
        @click="openRejectDialog"
      />
      <van-action-bar-button
        v-if="canConfirm(order.orderStatus)"
        type="primary"
        text="确认接单"
        @click="handleConfirm"
      />
      <van-action-bar-button
        v-if="canStartDelivery(order.orderStatus)"
        type="default"
        text="取消订单"
        @click="handleCancel"
      />
      <van-action-bar-button
        v-if="canStartDelivery(order.orderStatus)"
        type="primary"
        text="开始配送"
        @click="openCourierDialog"
      />
      <van-action-bar-button
        v-if="canComplete(order.orderStatus)"
        type="success"
        text="完成配送"
        @click="handleComplete"
      />
      <van-action-bar-button
        v-if="isCompleted(order.orderStatus)"
        type="primary"
        text="查看售后"
        @click="goToAftersale"
      />
    </van-action-bar>

    <!-- 配送员信息弹窗 -->
    <van-popup v-model:show="showCourierDialog" position="bottom" round>
      <div class="popup-dialog">
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
          <van-button type="primary" block @click="handleDispatch">
            确认开始配送
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 拒单原因选择器 -->
    <van-popup v-model:show="showRejectDialog" position="bottom" round>
      <div class="popup-dialog">
        <h3>选择拒单原因</h3>
        <van-picker
          :columns="REJECT_REASONS as any"
          v-model="rejectReason as any"
          title=""
        />
        <div class="dialog-actions">
          <van-button type="default" block @click="showRejectDialog = false">
            取消
          </van-button>
          <van-button type="danger" block @click="handleReject">
            确认拒单
          </van-button>
        </div>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.page {
  padding-bottom: 80px;
  background: var(--bg-page);
  min-height: 100vh;
}

/* ========== 导航栏 ========== */

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-card);
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.nav-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ========== 加载 ========== */

.loading-wrapper {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

/* ========== 状态卡片 ========== */

.status-card {
  margin: 12px;
  padding: 18px 16px;
  border-radius: 12px;
  color: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.status-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.exception-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 10px;
  border-radius: 12px;
}

.exception-text {
  font-size: 12px;
  color: #fff;
}

.order-no {
  font-size: 14px;
  margin-bottom: 6px;
  font-family: monospace;
  opacity: 0.9;
  word-break: break-all;
}

.order-time {
  font-size: 12px;
  opacity: 0.8;
}

/* ========== 分组 ========== */

.section-group {
  margin: 12px;
  border-radius: 8px;
  overflow: hidden;
}

/* ========== 商品明细 ========== */

.goods-value {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: right;
}

.goods-price {
  font-size: 13px;
  color: var(--text-secondary);
}

.goods-qty {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 28px;
  text-align: center;
}

.goods-subtotal {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 60px;
}

.total-cell {
  font-weight: 600;
}

.total-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.total-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

/* ========== 金额明细 ========== */

.discount-value {
  color: var(--color-danger) !important;
}

.pay-amount-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.pay-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.pay-amount-value {
  font-weight: 600;
}

/* ========== 配送信息 ========== */

.phone-value {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-primary);
}

/* ========== 时间线 ========== */

.timeline-wrapper {
  padding: 16px;
}

.step-content {
  padding-bottom: 4px;
}

.step-label {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 2px;
}

.step-time {
  font-size: 12px;
  color: var(--text-muted);
}

/* ========== 弹窗 ========== */

.popup-dialog {
  padding: 20px 16px;
}

.popup-dialog h3 {
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