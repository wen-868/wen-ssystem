<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import { fetchCustomerReconciliation, confirmCustomerReconciliation, type ReconciliationRecord } from '../api'

const router = useRouter()

const list = ref<ReconciliationRecord[]>([])
const loading = ref(false)
const statusFilter = ref('')

const STATUS_MAP: Record<string, string> = {
  DRAFT: '待确认', CONFIRMED: '已确认', PAID: '已结清', DISPUTED: '争议'
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.split('T')[0] || dateStr.slice(0, 10)
}
function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

async function loadData() {
  loading.value = true
  try {
    const res = await fetchCustomerReconciliation({
      status: statusFilter.value || undefined,
      page: 1,
      pageSize: 50
    })
    const data = (res.data as any)?.records ?? (res.data as any)?.list ?? res.data
    list.value = Array.isArray(data) ? data : []
  } catch { /* ignore */ }
  finally { loading.value = false }
}

async function handleConfirm(item: ReconciliationRecord) {
  try {
    await confirmCustomerReconciliation(item.statement_no || item.statementNo)
    showSuccessToast('已确认对账')
    await loadData()
  } catch { showToast('操作失败') }
}

function goDetail(item: ReconciliationRecord) {
  router.push(`/reconciliation/${item.statement_no || item.statementNo}`)
}

onMounted(() => { loadData() })
</script>

<template>
  <div class="reconciliation-view">
    <van-nav-bar title="对账单" left-arrow @click-left="router.back()" />

    <div class="filter-bar">
      <span class="filter-chip" :class="{ active: statusFilter === '' }" @click="statusFilter = ''; loadData()">全部</span>
      <span class="filter-chip" :class="{ active: statusFilter === 'DRAFT' }" @click="statusFilter = 'DRAFT'; loadData()">待确认</span>
      <span class="filter-chip" :class="{ active: statusFilter === 'CONFIRMED' }" @click="statusFilter = 'CONFIRMED'; loadData()">已确认</span>
      <span class="filter-chip" :class="{ active: statusFilter === 'PAID' }" @click="statusFilter = 'PAID'; loadData()">已结清</span>
    </div>

    <van-loading v-if="loading" class="loading-center" />

    <div v-else class="reconciliation-list">
      <div v-for="item in list" :key="item.id" class="rec-card" @click="goDetail(item)">
        <div class="rec-header">
          <span class="rec-no">{{ item.statement_no || item.statementNo }}</span>
          <span class="rec-status" :class="'status-' + (item.status || '').toLowerCase()">
            {{ STATUS_MAP[item.status] || item.status }}
          </span>
        </div>
        <div class="rec-customer">{{ item.customer_name || item.customerName || '未知客户' }}</div>
        <div class="rec-period">{{ formatDate(item.start_date || item.startDate) }} ~ {{ formatDate(item.end_date || item.endDate) }}</div>
        <div class="rec-amounts">
          <div class="rec-row">
            <span>期初</span><span>¥{{ formatPrice(item.opening_balance ?? item.openingBalance) }}</span>
          </div>
          <div class="rec-row">
            <span>本期</span><span class="positive">+¥{{ formatPrice(item.total_sales ?? item.totalSales) }}</span>
          </div>
          <div class="rec-row">
            <span>收款</span><span class="negative">-¥{{ formatPrice(item.total_received ?? item.totalReceived) }}</span>
          </div>
          <div class="rec-row rec-row--total">
            <span>余额</span><span class="closing">¥{{ formatPrice(item.closing_balance ?? item.closingBalance) }}</span>
          </div>
        </div>

        <div v-if="item.status === 'DRAFT'" class="rec-actions">
          <van-button size="small" type="primary" plain @click.stop="handleConfirm(item)">确认对账</van-button>
        </div>
      </div>
      <van-empty v-if="list.length === 0" description="暂无对账单" />
    </div>
  </div>
</template>

<style scoped>
.reconciliation-view { min-height: 100vh; background: var(--bg-page); }
.loading-center { padding: 60px 0; display: flex; justify-content: center; }

.filter-bar { display: flex; gap: 8px; padding: 8px 16px; }
.filter-chip { padding: 5px 14px; border-radius: 20px; font-size: 13px; background: var(--bg-card); color: var(--text-secondary); }
.filter-chip.active { background: var(--color-primary); color: #fff; }

.reconciliation-list { padding: 0 16px; }

.rec-card { margin-bottom: 10px; padding: 14px; background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }
.rec-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.rec-no { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.rec-status { font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.status-draft { background: #f0f0f0; color: #999; }
.status-confirmed { background: var(--color-primary-soft); color: var(--color-primary); }
.status-paid { background: var(--color-success-soft); color: var(--color-success); }
.status-disputed { background: var(--color-warning-soft); color: var(--color-warning); }
.rec-customer { font-size: 13px; color: var(--text-secondary); margin-bottom: 2px; }
.rec-period { font-size: 12px; color: var(--text-hint); margin-bottom: 8px; }

.rec-amounts { background: var(--bg-page); border-radius: 8px; padding: 8px; }
.rec-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); padding: 2px 0; }
.rec-row--total { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--border-normal); font-weight: 600; color: var(--text-primary); }
.positive { color: var(--color-success); }
.negative { color: var(--color-danger); }
.closing { color: var(--color-primary); font-weight: 700; }

.rec-actions { margin-top: 10px; display: flex; justify-content: flex-end; }
</style>