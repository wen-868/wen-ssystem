<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showSuccessToast, showDialog } from 'vant'
import { getSupplierStatementDetail, confirmSupplierStatement, disputeSupplierStatement, type SupplierStatementDetail } from '../api'

const route = useRoute()
const router = useRouter()
const statementNo = route.params.statementNo as string

const detail = ref<SupplierStatementDetail | null>(null)
const loading = ref(true)

const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  DISPUTED: '争议',
  PAID: '已结清'
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
    const res = await getSupplierStatementDetail(statementNo)
    detail.value = res.data as SupplierStatementDetail
  } catch {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

async function handleConfirm() {
  try {
    await showDialog({ title: '确认对账', message: '确认该对账单无误？' })
  } catch { return }

  try {
    await confirmSupplierStatement(statementNo)
    showSuccessToast('对账确认成功')
    await loadDetail()
  } catch {
    showToast('操作失败')
  }
}

async function handleDispute() {
  try {
    await showDialog({ title: '发起争议', message: '确认对该对账单发起争议？' })
  } catch { return }

  try {
    await disputeSupplierStatement(statementNo, '供应商发起争议')
    showSuccessToast('争议已提交')
    await loadDetail()
  } catch {
    showToast('操作失败')
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<template>
  <div class="statement-detail-view">
    <van-nav-bar title="对账单详情" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="loading-center" />

    <template v-else-if="detail">
      <!-- 摘要 -->
      <div class="section-card">
        <h3 class="section-title">对账摘要</h3>
        <div class="summary-header">
          <span class="statement-no">{{ statementNo }}</span>
          <span class="statement-status" :class="'status-' + (detail.status?.toLowerCase() || '')">
            {{ STATUS_MAP[detail.status] || detail.status }}
          </span>
        </div>
        <div class="supplier-name">{{ detail.supplier_name || detail.supplierName }}</div>
        <div class="period">
          {{ formatDate(detail.start_date || detail.startDate) }} ~ {{ formatDate(detail.end_date || detail.endDate) }}
        </div>
      </div>

      <!-- 金额汇总 -->
      <div class="section-card">
        <h3 class="section-title">金额汇总</h3>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">期初余额</div>
            <div class="summary-value">¥{{ formatPrice(detail.opening_balance ?? detail.openingBalance) }}</div>
          </div>
          <div class="summary-item summary-item--positive">
            <div class="summary-label">本期采购</div>
            <div class="summary-value">¥{{ formatPrice(detail.total_purchase ?? detail.totalPurchase) }}</div>
          </div>
          <div class="summary-item summary-item--negative">
            <div class="summary-label">本期退货</div>
            <div class="summary-value">¥{{ formatPrice(detail.total_returns ?? detail.totalReturns) }}</div>
          </div>
          <div class="summary-item summary-item--negative">
            <div class="summary-label">本期付款</div>
            <div class="summary-value">¥{{ formatPrice(detail.total_payments ?? detail.totalPayments) }}</div>
          </div>
        </div>
        <div class="closing-row">
          <span>期末余额</span>
          <span class="closing-value">¥{{ formatPrice(detail.closing_balance ?? detail.closingBalance) }}</span>
        </div>
      </div>

      <!-- 采购明细 -->
      <div class="section-card" v-if="detail.purchases?.length > 0">
        <h3 class="section-title">采购明细</h3>
        <div v-for="(p, idx) in detail.purchases" :key="idx" class="detail-item">
          <div class="detail-info">
            <div class="detail-no">{{ p.purchase_no }}</div>
            <div class="detail-date">{{ formatDate(p.created_at) }}</div>
          </div>
          <div class="detail-amount">¥{{ formatPrice(p.total_amount) }}</div>
        </div>
      </div>

      <!-- 退货明细 -->
      <div class="section-card" v-if="detail.returns?.length > 0">
        <h3 class="section-title">退货明细</h3>
        <div v-for="(r, idx) in detail.returns" :key="idx" class="detail-item">
          <div class="detail-info">
            <div class="detail-no">{{ r.return_no }}</div>
            <div class="detail-date">{{ formatDate(r.created_at) }}</div>
          </div>
          <div class="detail-amount detail-amount--negative">¥{{ formatPrice(r.return_amount) }}</div>
        </div>
      </div>

      <!-- 付款明细 -->
      <div class="section-card" v-if="detail.payments?.length > 0">
        <h3 class="section-title">付款明细</h3>
        <div v-for="(pay, idx) in detail.payments" :key="idx" class="detail-item">
          <div class="detail-info">
            <div class="detail-no">{{ pay.payment_no }}</div>
            <div class="detail-date">{{ formatDate(pay.payment_date) }}</div>
          </div>
          <div class="detail-amount detail-amount--negative">¥{{ formatPrice(pay.amount) }}</div>
        </div>
      </div>

      <!-- 操作 -->
      <div class="action-section" v-if="detail.status === 'DRAFT'">
        <van-button type="primary" size="large" round block @click="handleConfirm">确认对账</van-button>
        <van-button plain type="danger" size="large" round block style="margin-top: 10px" @click="handleDispute">发起争议</van-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.statement-detail-view {
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
  margin-bottom: 4px;
}

.statement-no {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.statement-status {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
}

.status-draft { background: #f0f0f0; color: #999; }
.status-confirmed { background: var(--color-success-soft); color: var(--color-success); }
.status-disputed { background: var(--color-warning-soft); color: var(--color-warning); }
.status-paid { background: var(--color-primary-soft); color: var(--color-primary); }

.supplier-name {
  font-size: 14px;
  color: var(--text-secondary);
}

.period {
  font-size: 12px;
  color: var(--text-hint);
  margin-top: 2px;
}

/* 金额汇总 */
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.summary-item {
  background: var(--bg-page);
  border-radius: 8px;
  padding: 10px;
  text-align: center;
}

.summary-item--positive .summary-value {
  color: var(--color-success);
}

.summary-item--negative .summary-value {
  color: var(--color-danger);
}

.summary-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 4px;
}

.closing-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-normal);
  font-size: 14px;
  font-weight: 600;
}

.closing-value {
  font-size: 18px;
  color: var(--color-primary);
}

/* 明细 */
.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-normal);
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-no {
  font-size: 13px;
  color: var(--text-primary);
}

.detail-date {
  font-size: 11px;
  color: var(--text-hint);
  margin-top: 2px;
}

.detail-amount {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.detail-amount--negative {
  color: var(--color-danger);
}

.action-section {
  padding: 16px;
}
</style>