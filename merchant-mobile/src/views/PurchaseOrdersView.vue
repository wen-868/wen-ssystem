<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  showToast,
  showLoadingToast,
  showSuccessToast,
  closeToast
} from 'vant'
import {
  fetchPurchaseOrders,
  fetchPurchaseOrderDetail,
  confirmPurchaseOrder,
  cancelPurchaseOrder,
  type PurchaseOrderRecord,
  type PurchaseOrderDetail
} from '../api'

const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'PENDING' },
  { label: '待入库', value: 'CONFIRMED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' }
]

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  DRAFT: { text: '草稿', type: 'default' },
  PENDING: { text: '待审核', type: 'warning' },
  CONFIRMED: { text: '待入库', type: 'primary' },
  PARTIAL: { text: '部分入库', type: 'primary' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已取消', type: 'danger' }
}

const activeTab = ref('')
const orders = ref<PurchaseOrderRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

// 详情弹窗
const showDetail = ref(false)
const detail = ref<PurchaseOrderDetail | null>(null)
const detailLoading = ref(false)

// 确认取消弹窗
const showConfirmDialog = ref(false)
const confirmAction = ref<'confirm' | 'cancel'>('confirm')
const currentOrderId = ref<number>(0)

async function loadOrders(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchPurchaseOrders({
      page: page.value,
      pageSize,
      orderStatus: activeTab.value || undefined
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
    showToast('操作失败，请重试')
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

async function viewDetail(id: number) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await fetchPurchaseOrderDetail(id)
    detail.value = res.data
  } catch {
    showToast('操作失败，请重试')
  } finally {
    detailLoading.value = false
  }
}

function openConfirmDialog(id: number, action: 'confirm' | 'cancel') {
  currentOrderId.value = id
  confirmAction.value = action
  showConfirmDialog.value = true
}

async function handleConfirm() {
  try {
    showLoadingToast({ message: '处理中...', forbidClick: true })
    if (confirmAction.value === 'confirm') {
      await confirmPurchaseOrder(currentOrderId.value)
      showSuccessToast('审核成功')
    } else {
      await cancelPurchaseOrder(currentOrderId.value)
      showSuccessToast('取消成功')
    }
    closeToast()
    showConfirmDialog.value = false
    await loadOrders(true)
    if (showDetail.value && detail.value?.id === currentOrderId.value) {
      await viewDetail(currentOrderId.value)
    }
  } catch (err: any) {
    closeToast()
    showToast(err.response?.data?.message || '操作失败')
  }
}

function canConfirm(status: string) {
  return status === 'PENDING'
}

function canCancel(status: string) {
  return status === 'PENDING' || status === 'DRAFT'
}

function goBack() {
  window.dispatchEvent(new CustomEvent('nav', { detail: 'home' }))
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">采购订单</h2>
      <van-button type="default" size="small" icon="arrow-left" @click="goBack">
        返回
      </van-button>
    </div>

    <!-- 状态筛选 -->
    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab
        v-for="tab in STATUS_TABS"
        :key="tab.value"
        :title="tab.label"
        :name="tab.value"
      />
    </van-tabs>

    <!-- 列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadOrders"
      >
        <div v-if="orders.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无采购订单" />
        </div>
        <van-cell
          v-for="order in orders"
          :key="order.id"
          is-link
          class="order-cell"
          @click="viewDetail(order.id)"
        >
          <template #title>
            <div class="order-header">
              <span class="order-no">{{ order.orderNo }}</span>
              <van-tag
                :type="(STATUS_MAP[order.orderStatus]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ STATUS_MAP[order.orderStatus]?.text || order.orderStatus }}
              </van-tag>
            </div>
          </template>
          <template #label>
            <div class="order-info">
              <span>{{ order.supplierName }}</span>
              <span class="order-amount">¥{{ Number(order.payableAmount).toFixed(2) }}</span>
            </div>
            <div class="order-meta">
              <span class="order-time">{{ order.createdAt }}</span>
              <span v-if="order.expectedDate" class="order-expected">
                预计到货: {{ order.expectedDate }}
              </span>
            </div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 详情弹窗 -->
    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      :style="{ maxHeight: '85%' }"
    >
      <div class="detail-panel">
        <h3>采购订单详情</h3>
        <div v-if="detailLoading" class="detail-loading">
          <van-loading type="spinner" />
        </div>
        <template v-else-if="detail">
          <van-cell-group inset>
            <van-cell title="单号" :value="detail.orderNo" />
            <van-cell title="供应商" :value="detail.supplierName" />
            <van-cell title="状态">
              <template #value>
                <van-tag
                  :type="(STATUS_MAP[detail.orderStatus]?.type as any) || 'default'"
                  plain
                >
                  {{ STATUS_MAP[detail.orderStatus]?.text || detail.orderStatus }}
                </van-tag>
              </template>
            </van-cell>
            <van-cell v-if="detail.expectedDate" title="预计到货" :value="detail.expectedDate" />
            <van-cell v-if="detail.actualDate" title="实际到货" :value="detail.actualDate" />
            <van-cell title="商品金额">
              <template #value>
                <span>¥{{ Number(detail.goodsAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
            <van-cell v-if="detail.taxAmount" title="税额" :value="`¥${Number(detail.taxAmount).toFixed(2)}`" />
            <van-cell v-if="detail.discountAmount" title="折扣" :value="`¥${Number(detail.discountAmount).toFixed(2)}`" />
            <van-cell title="应付金额">
              <template #value>
                <span class="detail-amount">¥{{ Number(detail.payableAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
            <van-cell title="已付金额" :value="`¥${Number(detail.paidAmount).toFixed(2)}`" />
            <van-cell title="未付金额">
              <template #value>
                <span class="detail-unpaid">¥{{ Number(detail.unpaidAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
            <van-cell v-if="detail.remark" title="备注" :value="detail.remark" />
          </van-cell-group>

          <!-- 商品明细 -->
          <div class="detail-items">
            <h4>商品明细</h4>
            <van-cell-group inset>
              <van-cell
                v-for="item in detail.items"
                :key="item.id"
                :title="item.skuName"
                :label="`${item.boxQty}箱${item.bottleQty}瓶 / 共${item.totalBottleQty}瓶`"
              >
                <template #value>
                  <div class="item-detail">
                    <div>¥{{ Number(item.unitPrice).toFixed(2) }} × {{ item.totalBottleQty }}</div>
                    <div class="item-subtotal">¥{{ Number(item.subtotalAmount).toFixed(2) }}</div>
                  </div>
                </template>
              </van-cell>
            </van-cell-group>
          </div>

          <!-- 操作按钮 -->
          <div class="detail-actions">
            <van-button
              v-if="canConfirm(detail.orderStatus)"
              type="primary"
              block
              @click="openConfirmDialog(detail.id, 'confirm')"
            >
              审核通过
            </van-button>
            <van-button
              v-if="canCancel(detail.orderStatus)"
              type="danger"
              block
              plain
              @click="openConfirmDialog(detail.id, 'cancel')"
            >
              取消订单
            </van-button>
          </div>
        </template>
      </div>
    </van-popup>

    <!-- 确认弹窗 -->
    <van-dialog
      v-model:show="showConfirmDialog"
      :title="confirmAction === 'confirm' ? '确认审核' : '确认取消'"
      :message="confirmAction === 'confirm' ? '确认审核通过该采购订单？' : '确认取消该采购订单？'"
      show-cancel-button
      @confirm="handleConfirm"
    />
  </section>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-title {
  margin: 0;
  font-size: 18px;
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

.order-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.order-expected {
  color: var(--color-warning);
}

.detail-panel {
  padding: 20px 16px;
  max-height: 85vh;
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

.detail-unpaid {
  font-weight: 600;
  color: var(--color-danger);
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

.item-detail {
  text-align: right;
  font-size: 12px;
}

.item-subtotal {
  font-weight: 600;
  color: var(--color-primary);
  margin-top: 2px;
}

.detail-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
