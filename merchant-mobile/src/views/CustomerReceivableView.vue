<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchCustomerReceivables, type CustomerReceivable } from '../api'

const route = useRoute()
const router = useRouter()
const customerId = Number(route.params.customerId)

const list = ref<CustomerReceivable[]>([])
const loading = ref(true)

const summary = computed(() => {
  const total = list.value.reduce((s, r) => s + (r.receivableAmount ?? r.receivable_amount ?? 0), 0)
  const received = list.value.reduce((s, r) => s + (r.receivedAmount ?? r.received_amount ?? 0), 0)
  const unreceived = total - received
  const overdue = list.value.filter(r => {
    const date = new Date(r.createdAt || r.created_at || '')
    return (Date.now() - date.getTime()) > 30 * 86400000 && (r.status !== 'PAID')
  }).length
  return { total, received, unreceived, overdue }
})

const STATUS_MAP: Record<string, string> = {
  UNPAID: '未收', PARTIAL: '部分', PAID: '已收', OVERDUE: '逾期'
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.split('T')[0] || dateStr.slice(0, 10)
}
function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}
function getDays(dateStr: string): number {
  const d = new Date(dateStr || '')
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

onMounted(async () => {
  try {
    const res = await fetchCustomerReceivables(customerId)
    const data = (res.data as any)?.records ?? (res.data as any)?.list ?? res.data
    list.value = Array.isArray(data) ? data : []
  } catch { /* ignore */ }
  finally { loading.value = false }
})
</script>

<template>
  <div class="customer-receivable-view">
    <van-nav-bar title="客户应收" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="loading-center" />

    <template v-else>
      <!-- 汇总卡片 -->
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-value">¥{{ formatPrice(summary.total) }}</div>
          <div class="summary-label">应收总额</div>
        </div>
        <div class="summary-card summary-card--green">
          <div class="summary-value">¥{{ formatPrice(summary.received) }}</div>
          <div class="summary-label">已收</div>
        </div>
        <div class="summary-card summary-card--red">
          <div class="summary-value">¥{{ formatPrice(summary.unreceived) }}</div>
          <div class="summary-label">未收</div>
        </div>
        <div class="summary-card" :class="{ 'summary-card--warning': summary.overdue > 0 }">
          <div class="summary-value">{{ summary.overdue }}</div>
          <div class="summary-label">逾期</div>
        </div>
      </div>

      <!-- 应收明细 -->
      <div class="list-section">
        <div v-for="item in list" :key="item.receivableNo || item.receivable_no" class="receivable-card">
          <div class="r-header">
            <span class="r-no">{{ item.receivable_no || item.receivableNo }}</span>
            <span class="r-status" :class="'status-' + (item.status || '').toLowerCase()">
              {{ STATUS_MAP[item.status] || item.status }}
            </span>
          </div>
          <div class="r-source">{{ item.source_no || item.sourceNo || item.sourceType || item.source_type }}</div>
          <div class="r-amounts">
            <div class="r-row">
              <span>应收：¥{{ formatPrice(item.receivableAmount ?? item.receivable_amount) }}</span>
              <span>已收：¥{{ formatPrice(item.receivedAmount ?? item.received_amount) }}</span>
            </div>
            <div class="r-row">
              <span>余额：¥{{ formatPrice(item.unreceivedAmount ?? item.unreceived_amount) }}</span>
              <span class="r-date">{{ formatDate(item.createdAt || item.created_at) }}</span>
            </div>
          </div>
          <div v-if="getDays(item.createdAt || item.created_at) > 30 && item.status !== 'PAID'" class="overdue-tag">
            逾期 {{ getDays(item.createdAt || item.created_at) }} 天
          </div>
        </div>
        <van-empty v-if="list.length === 0" description="暂无应收" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.customer-receivable-view { min-height: 100vh; background: var(--bg-page); padding-bottom: 24px; }
.loading-center { padding: 60px 0; display: flex; justify-content: center; }

.summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; padding: 12px 16px; }
.summary-card { background: var(--bg-card); border-radius: 10px; padding: 12px 8px; text-align: center; box-shadow: var(--shadow-card); }
.summary-card--green .summary-value { color: var(--color-success); }
.summary-card--red .summary-value { color: var(--color-danger); }
.summary-card--warning .summary-value { color: var(--color-warning); }
.summary-value { font-size: 16px; font-weight: 700; color: var(--color-primary); }
.summary-label { font-size: 11px; color: var(--text-hint); margin-top: 2px; }

.list-section { padding: 0 16px; }

.receivable-card { margin-bottom: 10px; padding: 14px; background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); position: relative; }
.r-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
.r-no { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.r-status { font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.status-unpaid { background: var(--color-warning-soft); color: var(--color-warning); }
.status-partial { background: var(--color-primary-soft); color: var(--color-primary); }
.status-paid { background: var(--color-success-soft); color: var(--color-success); }
.status-overdue { background: #fff1f0; color: #f5222d; }
.r-source { font-size: 12px; color: var(--text-hint); margin-bottom: 6px; }
.r-amounts { background: var(--bg-page); border-radius: 8px; padding: 8px; }
.r-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); padding: 2px 0; }
.r-date { color: var(--text-hint); }

.overdue-tag { position: absolute; top: 8px; right: 8px; padding: 2px 8px; background: #fff1f0; color: #f5222d; border-radius: 10px; font-size: 11px; font-weight: 600; }
</style>