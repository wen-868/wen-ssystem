<script setup lang="ts">
import { ref } from 'vue'
import { showDialog, showLoadingToast, showSuccessToast, closeToast } from 'vant'
import {
  fetchOrders,
  fetchOrderDetail,
  startDelivery,
  completeDelivery,
  rejectOrder,
  type OrderRecord,
  type OrderDetail
} from '../api'

const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '待配送', value: 'WAIT_DELIVERY' },
  { label: '配送中', value: 'DELIVERING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已拒收', value: 'REJECTED' },
  { label: '已取消', value: 'CANCELLED' }
]

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  WAIT_DELIVERY: { text: '待配送', type: 'warning' },
  DELIVERING: { text: '配送中', type: 'primary' },
  COMPLETED: { text: '已完成', type: 'success' },
  REJECTED: { text: '已拒收', type: 'danger' },
  CANCELLED: { text: '已取消', type: 'default' },
  PENDING_PAYMENT: { text: '待支付', type: 'warning' }
}

const PAY_STATUS_MAP: Record<string, { text: string; type: string }> = {
  UNPAID: { text: '未支付', type: 'danger' },
  PAID: { text: '已支付', type: 'success' },
  PARTIAL_REFUND: { text: '部分退款', type: 'warning' },
  REFUNDED: { text: '已退款', type: 'default' }
}

const activeTab = ref('')
const searchKeyword = ref('')
const orders = ref<OrderRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

// 订单详情
const showDetail = ref(false)
const detail = ref<OrderDetail | null>(null)
const detailLoading = ref(false)

async function loadOrders(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchOrders({
      page: page.value,
      pageSize,
      status: activeTab.value || undefined
    })
    const data = res.data
    if (reset) {
      orders.value = data.records ?? []
    } else {
      orders.value.push(...(data.records ?? []))
    }
    if (orders.value.length >= (data.total ?? 0)) {
      finished.value = true
    }
    page.value++
  } catch {
    // ignore
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onRefresh() {
  refreshing.value = true
  loadOrders(true)
}

function onTabChange() {
  loadOrders(true)
}

function onSearch() {
  loadOrders(true)
}

function onCancelSearch() {
  searchKeyword.value = ''
  loadOrders(true)
}

async function viewDetail(orderNo: string) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await fetchOrderDetail(orderNo)
    detail.value = res.data
  } catch {
    // ignore
  } finally {
    detailLoading.value = false
  }
}

async function handleStartDelivery(orderNo: string) {
  try {
    await showDialog({
      title: '确认操作',
      message: '确认开始配送该订单？'
    })
    showLoadingToast({ message: '处理中...', forbidClick: true })
    await startDelivery(orderNo)
    closeToast()
    showSuccessToast('已开始配送')
    await loadOrders(true)
    if (showDetail.value && detail.value?.orderNo === orderNo) {
      await viewDetail(orderNo)
    }
  } catch {
    closeToast()
  }
}

async function handleComplete(orderNo: string) {
  try {
    await showDialog({
      title: '确认操作',
      message: '确认完成配送？完成后将扣减库存并生成应收。'
    })
    showLoadingToast({ message: '处理中...', forbidClick: true })
    await completeDelivery(orderNo)
    closeToast()
    showSuccessToast('配送已完成')
    await loadOrders(true)
    if (showDetail.value && detail.value?.orderNo === orderNo) {
      await viewDetail(orderNo)
    }
  } catch {
    closeToast()
  }
}

async function handleReject(orderNo: string) {
  try {
    await showDialog({
      title: '确认操作',
      message: '确认拒收该订单？拒收后将释放占用库存。'
    })
    showLoadingToast({ message: '处理中...', forbidClick: true })
    await rejectOrder(orderNo)
    closeToast()
    showSuccessToast('已标记拒收')
    await loadOrders(true)
    if (showDetail.value && detail.value?.orderNo === orderNo) {
      await viewDetail(orderNo)
    }
  } catch {
    closeToast()
  }
}

function canStartDelivery(status: string) {
  return status === 'WAIT_DELIVERY'
}

function canComplete(status: string) {
  return status === 'WAIT_DELIVERY' || status === 'DELIVERING'
}

function canReject(status: string) {
  return status === 'WAIT_DELIVERY' || status === 'DELIVERING'
}
</script>

<template>
  <section class="page">
    <h2 class="page-title">订单配送</h2>

    <!-- 搜索栏 -->
    <van-search
      v-model="searchKeyword"
      placeholder="搜索订单号/收货人"
      shape="round"
      clearable
      @search="onSearch"
      @cancel="onCancelSearch"
    />

    <!-- 状态筛选 -->
    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab
        v-for="tab in STATUS_TABS"
        :key="tab.value"
        :title="tab.label"
        :name="tab.value"
      />
    </van-tabs>

    <!-- 订单列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadOrders"
      >
        <div v-if="orders.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无订单" />
        </div>
        <van-cell
          v-for="order in orders"
          :key="order.orderNo"
          is-link
          class="order-cell"
          @click="viewDetail(order.orderNo)"
        >
          <template #title>
            <div class="order-header">
              <span class="order-no">{{ order.orderNo }}</span>
              <div class="order-tags">
                <van-tag
                  :type="(STATUS_MAP[order.orderStatus]?.type as any) || 'default'"
                  plain
                  size="medium"
                >
                  {{ STATUS_MAP[order.orderStatus]?.text || order.orderStatus }}
                </van-tag>
                <van-tag
                  v-if="order.payStatus"
                  :type="(PAY_STATUS_MAP[order.payStatus]?.type as any) || 'default'"
                  plain
                  size="medium"
                >
                  {{ PAY_STATUS_MAP[order.payStatus]?.text || order.payStatus }}
                </van-tag>
              </div>
            </div>
          </template>
          <template #label>
            <div class="order-info">
              <span>{{ order.receiverName }}</span>
              <span class="order-amount">¥{{ Number(order.payableAmount).toFixed(2) }}</span>
            </div>
            <div class="order-time">{{ order.createdAt }}</div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 订单详情弹窗 -->
    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      :style="{ maxHeight: '80%' }"
    >
      <div class="detail-panel">
        <h3>订单详情</h3>
        <div v-if="detailLoading" class="detail-loading">
          <van-loading type="spinner" />
        </div>
        <template v-else-if="detail">
          <van-cell-group inset>
            <van-cell title="订单号" :value="detail.orderNo" />
            <van-cell title="客户" :value="detail.receiverName" />
            <van-cell title="手机" :value="detail.receiverMobile" />
            <van-cell title="地址" :value="detail.receiverAddress || '-'" />
            <van-cell title="金额">
              <template #value>
                <span class="detail-amount">¥{{ Number(detail.payableAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
            <van-cell title="配送状态">
              <template #value>
                <van-tag
                  :type="(STATUS_MAP[detail.orderStatus]?.type as any) || 'default'"
                  plain
                >
                  {{ STATUS_MAP[detail.orderStatus]?.text || detail.orderStatus }}
                </van-tag>
              </template>
            </van-cell>
            <van-cell title="支付状态">
              <template #value>
                <van-tag
                  v-if="detail.payStatus"
                  :type="(PAY_STATUS_MAP[detail.payStatus]?.type as any) || 'default'"
                  plain
                >
                  {{ PAY_STATUS_MAP[detail.payStatus]?.text || detail.payStatus }}
                </van-tag>
                <span v-else>-</span>
              </template>
            </van-cell>
          </van-cell-group>

          <!-- 商品明细 -->
          <div class="detail-items">
            <h4>商品明细</h4>
            <van-cell-group inset>
              <van-cell
                v-for="item in detail.items"
                :key="item.skuId"
                :title="item.skuName"
                :label="`x${item.quantity}`"
              >
                <template #value>
                  ¥{{ Number(item.subtotalAmount).toFixed(2) }}
                </template>
              </van-cell>
            </van-cell-group>
          </div>

          <!-- 操作按钮 -->
          <div class="detail-actions">
            <van-button
              v-if="canStartDelivery(detail.orderStatus)"
              type="primary"
              block
              @click="handleStartDelivery(detail.orderNo)"
            >
              开始配送
            </van-button>
            <van-button
              v-if="canComplete(detail.orderStatus)"
              type="success"
              block
              @click="handleComplete(detail.orderNo)"
            >
              确认完成
            </van-button>
            <van-button
              v-if="canReject(detail.orderStatus)"
              type="danger"
              block
              plain
              @click="handleReject(detail.orderNo)"
            >
              拒收
            </van-button>
          </div>
        </template>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 12px;
  font-size: var(--text-page-title);
  font-weight: 600;
  color: var(--text-primary);
}

.empty-wrapper {
  padding: 40px 0;
}

.order-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.order-no {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.order-tags {
  display: flex;
  gap: 4px;
}

.order-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
}

.order-amount {
  font-weight: 600;
  color: var(--color-primary);
}

.order-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.detail-panel {
  padding: 20px var(--space-card-padding);
  max-height: 80vh;
  overflow-y: auto;
}

.detail-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.detail-loading {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.detail-amount {
  font-weight: 600;
  color: var(--color-primary);
  font-size: 16px;
}

.detail-items {
  margin-top: 12px;
}

.detail-items h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.detail-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
