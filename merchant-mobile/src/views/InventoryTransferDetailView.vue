<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showSuccessToast, showDialog } from 'vant'
import { getTransferOrderDetail, confirmTransferOut, confirmTransferIn, type TransferOrderDetail } from '../api'

const route = useRoute()
const router = useRouter()
const transferNo = route.params.transferNo as string

const detail = ref<TransferOrderDetail | null>(null)
const loading = ref(true)
const actionLoading = ref(false)

const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待审核',
  APPROVED: '已审核',
  TRANSIT: '已发货',
  RECEIVED: '已收货',
  CANCELLED: '已取消'
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.split('T')[0] || dateStr.slice(0, 10)
}

function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

async function loadDetail() {
  loading.value = true
  try {
    const res = await getTransferOrderDetail(Number(transferNo))
    detail.value = res.data as TransferOrderDetail
  } catch {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

async function handleShip() {
  try {
    await showDialog({ title: '确认出库', message: '确认执行出库操作？将减少调出仓库库存。' })
  } catch { return }

  actionLoading.value = true
  try {
    await confirmTransferOut(Number(transferNo))
    showSuccessToast('出库确认成功')
    await loadDetail()
  } catch {
    showToast('操作失败')
  } finally {
    actionLoading.value = false
  }
}

async function handleReceive() {
  try {
    await showDialog({ title: '确认入库', message: '确认执行入库操作？将增加调入仓库库存。' })
  } catch { return }

  if (!detail.value) return
  actionLoading.value = true
  try {
    await confirmTransferIn(Number(transferNo), detail.value.items.map(i => ({
      itemId: i.id,
      receivedQty: i.quantity
    })))
    showSuccessToast('入库确认成功')
    await loadDetail()
  } catch {
    showToast('操作失败')
  } finally {
    actionLoading.value = false
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<template>
  <div class="transfer-detail-view">
    <van-nav-bar title="调拨单详情" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="loading-center" />

    <template v-else-if="detail">
      <!-- 摘要 -->
      <div class="section-card">
        <h3 class="section-title">调拨信息</h3>
        <div class="summary-header">
          <span class="transfer-no">{{ detail.transfer_no || detail.transferNo || '#' + detail.id }}</span>
          <span class="transfer-status" :class="'status-' + (detail.status?.toLowerCase() || '')">
            {{ STATUS_MAP[detail.status] || detail.status }}
          </span>
        </div>
        <div class="transfer-direction">
          <div class="store-card">
            <div class="store-label">调出仓库</div>
            <div class="store-name">{{ detail.fromStoreName || detail.from_store_name || '-' }}</div>
          </div>
          <van-icon name="arrow" size="20" color="var(--color-primary)" />
          <div class="store-card">
            <div class="store-label">调入仓库</div>
            <div class="store-name">{{ detail.toStoreName || detail.to_store_name || '-' }}</div>
          </div>
        </div>
        <div class="transfer-meta">
          <span>金额：¥{{ formatPrice(detail.totalAmount ?? detail.total_amount) }}</span>
          <span>数量：{{ detail.totalQty ?? detail.total_qty ?? 0 }}</span>
        </div>
        <div v-if="detail.expectedDate || detail.expected_date" class="transfer-meta">
          <span>预计：{{ formatDate(detail.expectedDate || detail.expected_date) }}</span>
        </div>
      </div>

      <!-- 商品明细 -->
      <div class="section-card">
        <h3 class="section-title">商品明细</h3>
        <div v-for="item in detail.items" :key="item.id" class="item-row">
          <div class="item-info">
            <div class="item-name">{{ item.skuName }}</div>
            <div class="item-qty">
              数量：{{ item.quantity }} |
              发货：{{ item.shippedQty ?? item.shipped_qty ?? 0 }} |
              收货：{{ item.receivedQty ?? item.received_qty ?? 0 }}
            </div>
          </div>
          <div class="item-price">¥{{ formatPrice(item.unitPrice) }}</div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-section">
        <van-button
          v-if="detail.status === 'APPROVED'"
          type="primary"
          size="large"
          round
          block
          :loading="actionLoading"
          @click="handleShip"
        >
          确认出库
        </van-button>
        <van-button
          v-if="detail.status === 'TRANSIT'"
          type="success"
          size="large"
          round
          block
          :loading="actionLoading"
          @click="handleReceive"
        >
          确认入库
        </van-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.transfer-detail-view {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 24px;
}

.loading-center {
  padding: 60px 0;
  display: flex;
  justify-content: center;
}

.section-card {
  margin: 0 16px 12px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
}

.section-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.transfer-no {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.transfer-status {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
}

.status-draft { background: #f0f0f0; color: #999; }
.status-pending { background: var(--color-warning-soft); color: var(--color-warning); }
.status-approved { background: var(--color-primary-soft); color: var(--color-primary); }
.status-transit { background: var(--color-warning-soft); color: var(--color-warning); }
.status-received { background: var(--color-success-soft); color: var(--color-success); }
.status-cancelled { background: #f0f0f0; color: #999; }

.transfer-direction {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.store-card {
  flex: 1;
  text-align: center;
  padding: 10px;
  background: var(--bg-page);
  border-radius: 8px;
}

.store-label {
  font-size: 11px;
  color: var(--text-hint);
  margin-bottom: 4px;
}

.store-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.transfer-meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-normal);
}

.item-row:last-child {
  border-bottom: none;
}

.item-name {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.item-qty {
  font-size: 12px;
  color: var(--text-hint);
  margin-top: 2px;
}

.item-price {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

.action-section {
  padding: 24px 16px;
}
</style>