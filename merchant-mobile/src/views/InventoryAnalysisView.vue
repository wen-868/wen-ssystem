<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchInventorySummary,
  fetchInventoryAgeData,
  fetchInventoryAlerts,
  fetchInventoryLogs,
  type InventorySummaryItem,
  type InventoryAgeData,
  type InventoryAlertRecord,
  type InventoryLogRecord
} from '../api'

const router = useRouter()

/* ========== 数据 ========== */
const loading = ref(false)
const refreshing = ref(false)
const summary = ref<InventorySummaryItem[]>([])
const ageData = ref<InventoryAgeData | null>(null)
const alerts = ref<InventoryAlertRecord[]>([])
const logs = ref<InventoryLogRecord[]>([])
const logsPage = ref(1)
const logsFinished = ref(false)
const alertFilter = ref<'all' | 'danger' | 'warn' | 'normal'>('all')

const totalValue = ref(0)
const skuCount = ref(0)
const slowMovingCount = ref(0)
const totalAlerts = ref(0)

async function loadData() {
  loading.value = true
  try {
    const [summaryRes, ageRes, alertRes] = await Promise.all([
      fetchInventorySummary({ groupBy: 'product' }),
      fetchInventoryAgeData(),
      fetchInventoryAlerts()
    ])
    summary.value = summaryRes.data || []
    ageData.value = ageRes.data || null
    alerts.value = alertRes.data || []

    totalValue.value = summary.value.reduce((s, i) => s + i.totalAmount, 0)
    skuCount.value = summary.value.length
    slowMovingCount.value = ageData.value?.summary?.over180?.count ?? 0
    totalAlerts.value = alerts.value.length
  } catch { /* ignore */ }
  finally { loading.value = false }
}

async function loadLogs() {
  try {
    const res = await fetchInventoryLogs({ page: logsPage.value, pageSize: 20 })
    const records = res.data?.records ?? res.data ?? []
    if (logsPage.value === 1) logs.value = records
    else logs.value = [...logs.value, ...records]
    logsFinished.value = records.length < 20
  } catch { /* ignore */ }
}

function onRefresh() {
  refreshing.value = true
  logsPage.value = 1
  Promise.all([loadData(), loadLogs()]).finally(() => { refreshing.value = false })
}

function onLoadMore() {
  logsPage.value++
  loadLogs()
}

onMounted(() => {
  loadData()
  loadLogs()
})

/* ========== 工具函数 ========== */
function formatMoney(v: number): string {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ageLevel(days: number): string {
  if (days <= 30) return 'age-normal'
  if (days <= 90) return 'age-warn'
  if (days <= 180) return 'age-alert'
  return 'age-danger'
}

function ageLabel(days: number): string {
  if (days <= 30) return '正常'
  if (days <= 90) return '预警'
  if (days <= 180) return '注意'
  return '呆滞'
}

function alertLevel(qty: number): string {
  if (qty <= 0) return 'age-danger'
  if (qty <= 5) return 'age-alert'
  if (qty <= 20) return 'age-warn'
  return 'age-normal'
}

function alertLevelLabel(qty: number): string {
  if (qty <= 0) return '缺货'
  if (qty <= 5) return '紧缺'
  if (qty <= 20) return '偏低'
  return '正常'
}

const filteredAlerts = ref<InventoryAlertRecord[]>([])

function applyAlertFilter() {
  if (alertFilter.value === 'danger') filteredAlerts.value = alerts.value.filter(a => a.availableQty <= 0)
  else if (alertFilter.value === 'warn') filteredAlerts.value = alerts.value.filter(a => a.availableQty > 0 && a.availableQty <= 5)
  else if (alertFilter.value === 'normal') filteredAlerts.value = alerts.value.filter(a => a.availableQty > 5)
  else filteredAlerts.value = alerts.value
}

function onAlertFilterChange() {
  applyAlertFilter()
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.slice(0, 10)
}

function logTypeLabel(t: string): string {
  return t === 'IN' ? '入库' : t === 'OUT' ? '出库' : '调整'
}
</script>

<template>
  <section class="page">
    <van-nav-bar title="库存分析" left-arrow @click-left="router.back()" />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-loading="loading">
        <!-- 库存概览卡片 -->
        <div class="card-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background:#EFF6FF;">
              <van-icon name="balance-o" color="#3B82F6" size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">库存总额</span>
              <span class="stat-value">¥{{ formatMoney(totalValue) }}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#ECFDF5;">
              <van-icon name="label-o" color="#10B981" size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">库存SKU数</span>
              <span class="stat-value">{{ skuCount }}<span class="unit">个</span></span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#FEF2F2;">
              <van-icon name="warning-o" color="#EF4444" size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">呆滞品</span>
              <span class="stat-value">{{ slowMovingCount }}<span class="unit">个</span></span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#FFF7ED;">
              <van-icon name="clock-o" color="#F59E0B" size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">预警商品</span>
              <span class="stat-value">{{ totalAlerts }}<span class="unit">个</span></span>
            </div>
          </div>
        </div>

        <!-- 库存预警列表 -->
        <div class="section-header">
          <van-icon name="warning-o" size="16" color="#EF4444" />
          <span>库存预警</span>
        </div>
        <div class="filter-row">
          <span v-for="f in [{ label: '全部', value: 'all' }, { label: '缺货', value: 'danger' }, { label: '紧缺', value: 'warn' }, { label: '正常', value: 'normal' }]" :key="f.value"
            class="preset-chip" :class="{ active: alertFilter === f.value }"
            @click="alertFilter = f.value; onAlertFilterChange()">{{ f.label }}</span>
        </div>
        <div class="card">
          <div v-if="filteredAlerts.length === 0" class="empty-hint">暂无预警</div>
          <div v-for="item in filteredAlerts" :key="item.skuId" class="alert-row">
            <span class="alert-name">{{ item.skuName }}</span>
            <span class="age-tag" :class="alertLevel(item.availableQty)">{{ alertLevelLabel(item.availableQty) }}</span>
            <span class="alert-qty">可售: {{ item.availableQty }}</span>
          </div>
        </div>

        <!-- 呆滞品列表 -->
        <div class="section-header">
          <van-icon name="clock-o" size="16" color="#F59E0B" />
          <span>呆滞品列表</span>
        </div>
        <div class="card">
          <div v-if="!ageData?.details?.length" class="empty-hint">暂无呆滞品</div>
          <div v-for="item in (ageData?.details ?? [])" :key="item.skuId + item.batchNo" class="alert-row">
            <span class="alert-name">{{ item.skuName }}</span>
            <span class="age-tag" :class="ageLevel(item.ageDays)">{{ ageLabel(item.ageDays) }}</span>
            <span class="alert-qty">{{ item.ageDays }}天</span>
          </div>
        </div>

        <!-- 库存价值排行 -->
        <div class="section-header">
          <van-icon name="hot-o" size="16" color="#EF4444" />
          <span>库存价值排行 TOP10</span>
        </div>
        <div class="card">
          <div v-if="summary.length === 0" class="empty-hint">暂无数据</div>
          <div v-for="(item, i) in summary.slice(0, 10)" :key="item.skuId" class="rank-row">
            <span class="rank-idx" :class="{ 'rank-top': i < 3 }">{{ i + 1 }}</span>
            <span class="rank-name">{{ item.skuName }}</span>
            <span class="rank-qty">{{ item.totalAvailableQty }}{{ item.barcode ? '件' : '个' }}</span>
            <span class="rank-amount">¥{{ formatMoney(item.totalAmount) }}</span>
          </div>
        </div>

        <!-- 出入库记录 -->
        <div class="section-header">
          <van-icon name="description" size="16" color="var(--color-primary)" />
          <span>出入库记录</span>
        </div>
        <div class="card">
          <div v-if="logs.length === 0" class="empty-hint">暂无记录</div>
          <div v-for="item in logs" :key="item.logNo" class="log-row">
            <div class="log-left">
              <span class="log-name">{{ item.skuName }}</span>
              <span class="log-meta">{{ formatDate(item.createdAt) }}</span>
            </div>
            <div class="log-right">
              <span class="log-type" :class="{ 'log-in': item.reason === 'PURCHASE_IN', 'log-out': item.reason !== 'PURCHASE_IN' }">{{ logTypeLabel(item.reason === 'PURCHASE_IN' ? 'IN' : 'OUT') }}</span>
              <span class="log-qty">{{ item.changeQty > 0 ? '+' : '' }}{{ item.changeQty }}</span>
            </div>
          </div>
        </div>

        <div v-if="!logsFinished" class="load-more" @click="onLoadMore">加载更多</div>
      </div>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page { padding: 0 4px; }

.section-header { display: flex; align-items: center; gap: 6px; padding: 16px 0 8px; font-size: 15px; font-weight: 600; color: var(--text-primary); }
.filter-row { display: flex; gap: 8px; padding: 0 0 8px; }
.preset-chip { padding: 4px 12px; border-radius: 16px; font-size: 13px; color: var(--text-secondary); background: var(--bg-soft); cursor: pointer; }
.preset-chip.active { background: var(--color-primary); color: #fff; }

.card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.stat-card { display: flex; align-items: center; gap: 8px; background: var(--bg-card); border-radius: 10px; padding: 12px 10px; box-shadow: var(--shadow-card); }
.stat-icon { flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.stat-info { display: flex; flex-direction: column; min-width: 0; }
.stat-label { font-size: 11px; color: var(--text-secondary); margin-bottom: 2px; }
.stat-value { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.unit { font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left: 2px; }

.card { background: var(--bg-card); border-radius: 10px; box-shadow: var(--shadow-card); padding: 10px 12px; margin-bottom: 8px; }
.empty-hint { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0; gap: 6px; font-size: 13px; color: var(--text-muted); }

.alert-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-normal); }
.alert-row:last-child { border-bottom: none; }
.alert-name { font-size: 13px; font-weight: 500; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.alert-qty { font-size: 12px; color: var(--text-secondary); margin-left: 8px; }

.age-tag { font-size: 10px; padding: 2px 6px; border-radius: 8px; margin-left: 6px; }
.age-normal { background: #ECFDF5; color: #10B981; }
.age-warn { background: #FFF7ED; color: #F59E0B; }
.age-alert { background: #FEF2F2; color: #EF4444; }
.age-danger { background: #FEF2F2; color: #DC2626; font-weight: 600; }

.rank-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border-normal); }
.rank-row:last-child { border-bottom: none; }
.rank-idx { width: 20px; height: 20px; border-radius: 50%; background: var(--bg-soft); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--text-secondary); flex-shrink: 0; }
.rank-top { background: var(--color-primary-soft); color: var(--color-primary); }
.rank-name { flex: 1; font-size: 13px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-qty { font-size: 11px; color: var(--text-muted); }
.rank-amount { font-size: 13px; font-weight: 600; color: var(--color-primary); }

.log-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-normal); }
.log-row:last-child { border-bottom: none; }
.log-left { display: flex; flex-direction: column; gap: 2px; }
.log-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.log-meta { font-size: 11px; color: var(--text-muted); }
.log-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.log-type { font-size: 10px; padding: 2px 6px; border-radius: 8px; }
.log-in { background: #ECFDF5; color: #10B981; }
.log-out { background: #FEF2F2; color: #EF4444; }
.log-qty { font-size: 13px; font-weight: 600; color: var(--text-primary); }

.load-more { text-align: center; padding: 12px; font-size: 13px; color: var(--color-primary); cursor: pointer; }
</style>