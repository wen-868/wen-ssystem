<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchPaymentAnalysis,
  fetchReceivablePayable,
  fetchReceipts,
  type PaymentAnalysisItem,
  type ReceivablePayableData,
  type PaymentChannelItem,
  type ReceiptRecord
} from '../api'

const router = useRouter()

/* ========== 日期筛选 ========== */
const datePreset = ref<'thisMonth' | 'last30' | 'custom'>('thisMonth')
const presets = [
  { label: '本月', value: 'thisMonth' },
  { label: '近30天', value: 'last30' },
  { label: '自定义', value: 'custom' }
]
const customStart = ref('')
const customEnd = ref('')

function getDateRange(): { dateStart: string; dateEnd: string } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  if (datePreset.value === 'thisMonth') {
    return { dateStart: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), dateEnd: fmt(now) }
  }
  if (datePreset.value === 'last30') {
    const d = new Date(now)
    d.setDate(d.getDate() - 30)
    return { dateStart: fmt(d), dateEnd: fmt(now) }
  }
  return { dateStart: customStart.value || fmt(now), dateEnd: customEnd.value || fmt(now) }
}

/* ========== 数据 ========== */
const loading = ref(false)
const refreshing = ref(false)
const trendData = ref<PaymentAnalysisItem[]>([])
const channelData = ref<PaymentChannelItem[]>([])
const receivableData = ref<ReceivablePayableData | null>(null)
const receiptList = ref<ReceiptRecord[]>([])
const receiptPage = ref(1)
const receiptFinished = ref(false)

const maxTrendAmount = computed(() => {
  if (trendData.value.length === 0) return 0
  return Math.max(...trendData.value.map(d => d.totalAmount))
})

const totalCollection = computed(() => trendData.value.reduce((s, i) => s + i.totalAmount, 0))
async function loadData() {
  loading.value = true
  try {
    const range = getDateRange()
    const [trendRes, channelRes, receivableRes] = await Promise.all([
      fetchPaymentAnalysis({ ...range, groupBy: 'date' }),
      fetchPaymentAnalysis({ ...range, groupBy: 'customer' }),
      fetchReceivablePayable(range)
    ])
    trendData.value = trendRes.data || []
    channelData.value = channelRes.data || []
    receivableData.value = receivableRes.data || null
  } catch { /* ignore */ }
  finally { loading.value = false }
}

async function loadReceipts() {
  try {
    const range = getDateRange()
    const res = await fetchReceipts({ page: receiptPage.value, pageSize: 20, ...range })
    const records = res.data?.records ?? res.data ?? []
    if (receiptPage.value === 1) receiptList.value = records
    else receiptList.value = [...receiptList.value, ...records]
    receiptFinished.value = records.length < 20
  } catch { /* ignore */ }
}

function onRefresh() {
  refreshing.value = true
  receiptPage.value = 1
  Promise.all([loadData(), loadReceipts()]).finally(() => { refreshing.value = false })
}

function onLoadMore() {
  receiptPage.value++
  loadReceipts()
}

function onPresetChange() {
  receiptPage.value = 1
  loadData()
  loadReceipts()
}

onMounted(() => {
  loadData()
  loadReceipts()
})

/* ========== 工具函数 ========== */
function formatMoney(v: number): string {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}-${day}`
}

function barWidth(amount: number): string {
  if (maxTrendAmount.value === 0) return '0%'
  return Math.max(4, (amount / maxTrendAmount.value) * 100) + '%'
}

function statusLabel(s: string): string {
  const map: Record<string, string> = { 'COMPLETED': '已收款', 'PENDING': '待收款', 'VOIDED': '已作废' }
  return map[s] || s
}

function statusClass(s: string): string {
  const map: Record<string, string> = { 'COMPLETED': 's-done', 'PENDING': 's-pending', 'VOIDED': 's-void' }
  return map[s] || ''
}

function methodLabel(m: string): string {
  const map: Record<string, string> = { 'CASH': '现金', 'TRANSFER': '转账', 'OTHER_WECHAT': '微信', 'ALIPAY': '支付宝' }
  return map[m] || m
}
</script>

<template>
  <section class="page">
    <van-nav-bar title="收款分析" left-arrow @click-left="router.back()" />

    <!-- 日期筛选 -->
    <div class="preset-row">
      <span v-for="p in presets" :key="p.value" class="preset-chip" :class="{ active: datePreset === p.value }"
        @click="datePreset = p.value as any; onPresetChange()">{{ p.label }}</span>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-loading="loading">
        <!-- 收款总览卡片 -->
        <div class="card-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background:#ECFDF5;">
              <van-icon name="balance-o" color="#10B981" size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">累计收款</span>
              <span class="stat-value">¥{{ formatMoney(totalCollection) }}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#EFF6FF;">
              <van-icon name="chart-trending-o" color="#3B82F6" size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">本月收款</span>
              <span class="stat-value">¥{{ formatMoney(totalCollection) }}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#FEF2F2;">
              <van-icon name="warning-o" color="#EF4444" size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">待收金额</span>
              <span class="stat-value">¥{{ formatMoney(receivableData?.totalReceivable ?? 0) }}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#FFF7ED;">
              <van-icon name="exchange" color="#F59E0B" size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-label">退款率</span>
              <span class="stat-value">--%</span>
            </div>
          </div>
        </div>

        <!-- 收款趋势 -->
        <div class="section-header">
          <van-icon name="bar-chart-o" size="16" color="var(--color-primary)" />
          <span>收款趋势</span>
        </div>
        <div class="card">
          <div v-if="trendData.length === 0" class="empty-hint">暂无数据</div>
          <div v-for="item in trendData.slice(-14)" :key="item.period" class="trend-row">
            <span class="trend-date">{{ formatDate(item.period) }}</span>
            <div class="trend-bar-wrap">
              <div class="trend-bar" :style="{ width: barWidth(item.totalAmount) }"></div>
            </div>
            <div class="trend-meta">
              <span class="trend-count">{{ item.paymentCount }}笔</span>
              <span class="trend-amount">¥{{ formatMoney(item.totalAmount) }}</span>
            </div>
          </div>
        </div>

        <!-- 渠道分布 -->
        <div class="section-header">
          <van-icon name="pie-chart-o" size="16" color="var(--color-primary)" />
          <span>客户收款分布</span>
        </div>
        <div class="card">
          <div v-if="channelData.length === 0" class="empty-hint">暂无数据</div>
          <div v-for="(item, i) in channelData.slice(0, 10)" :key="item.customerId" class="rank-row">
            <span class="rank-idx" :class="{ 'rank-top': i < 3 }">{{ i + 1 }}</span>
            <span class="rank-name">{{ item.customerName }}</span>
            <span class="rank-qty">{{ item.paymentCount }}笔</span>
            <span class="rank-amount">¥{{ formatMoney(item.totalAmount) }}</span>
          </div>
        </div>

        <!-- 待收列表 -->
        <div class="section-header">
          <van-icon name="warning-o" size="16" color="#EF4444" />
          <span>待收客户</span>
        </div>
        <div class="card">
          <div v-if="!receivableData?.receivableList?.length" class="empty-hint">暂无待收</div>
          <div v-for="item in (receivableData?.receivableList ?? [])" :key="item.customerId" class="alert-row">
            <span class="alert-name">{{ item.customerName }}</span>
            <span class="stat-value" style="font-size:13px;color:var(--color-danger);">¥{{ formatMoney(item.totalUnreceived) }}</span>
          </div>
        </div>

        <!-- 收款记录列表 -->
        <div class="section-header">
          <van-icon name="description" size="16" color="var(--color-primary)" />
          <span>收款记录</span>
        </div>
        <div class="card">
          <div v-if="receiptList.length === 0" class="empty-hint">暂无收款记录</div>
          <div v-for="item in receiptList" :key="item.id" class="receipt-row">
            <div class="receipt-left">
              <span class="receipt-name">{{ item.customer_name || item.customerName }}</span>
              <span class="receipt-meta">{{ item.created_at || item.createdAt }} · {{ methodLabel(item.payment_method || item.paymentMethod) }}</span>
            </div>
            <div class="receipt-right">
              <span class="receipt-amount">¥{{ formatMoney(item.amount) }}</span>
              <span class="receipt-status" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
            </div>
          </div>
        </div>

        <div v-if="!receiptFinished" class="load-more" @click="onLoadMore">加载更多</div>
      </div>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page { padding: 0 4px; }
.preset-row { display: flex; gap: 8px; padding: 8px 0; }
.preset-chip { padding: 4px 12px; border-radius: 16px; font-size: 13px; color: var(--text-secondary); background: var(--bg-soft); cursor: pointer; }
.preset-chip.active { background: var(--color-primary); color: #fff; }

.section-header { display: flex; align-items: center; gap: 6px; padding: 16px 0 8px; font-size: 15px; font-weight: 600; color: var(--text-primary); }

.card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.stat-card { display: flex; align-items: center; gap: 8px; background: var(--bg-card); border-radius: 10px; padding: 12px 10px; box-shadow: var(--shadow-card); }
.stat-icon { flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.stat-info { display: flex; flex-direction: column; min-width: 0; }
.stat-label { font-size: 11px; color: var(--text-secondary); margin-bottom: 2px; }
.stat-value { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.unit { font-size: 11px; font-weight: 400; color: var(--text-secondary); margin-left: 2px; }

.card { background: var(--bg-card); border-radius: 10px; box-shadow: var(--shadow-card); padding: 10px 12px; margin-bottom: 8px; }
.empty-hint { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0; gap: 6px; font-size: 13px; color: var(--text-muted); }

.trend-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border-normal); }
.trend-row:last-child { border-bottom: none; }
.trend-date { flex-shrink: 0; width: 40px; font-size: 12px; color: var(--text-secondary); }
.trend-bar-wrap { flex: 1; height: 8px; background: var(--bg-soft); border-radius: 4px; overflow: hidden; }
.trend-bar { height: 100%; background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover)); border-radius: 4px; min-width: 4px; transition: width 0.3s; }
.trend-meta { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
.trend-count { font-size: 10px; color: var(--text-muted); }
.trend-amount { font-size: 12px; font-weight: 600; color: var(--text-primary); }

.rank-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border-normal); }
.rank-row:last-child { border-bottom: none; }
.rank-idx { width: 20px; height: 20px; border-radius: 50%; background: var(--bg-soft); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--text-secondary); flex-shrink: 0; }
.rank-top { background: var(--color-primary-soft); color: var(--color-primary); }
.rank-name { flex: 1; font-size: 13px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-qty { font-size: 11px; color: var(--text-muted); }
.rank-amount { font-size: 13px; font-weight: 600; color: var(--color-primary); }

.alert-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-normal); }
.alert-row:last-child { border-bottom: none; }
.alert-name { font-size: 13px; font-weight: 500; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.receipt-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-normal); }
.receipt-row:last-child { border-bottom: none; }
.receipt-left { display: flex; flex-direction: column; gap: 2px; }
.receipt-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.receipt-meta { font-size: 11px; color: var(--text-muted); }
.receipt-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.receipt-amount { font-size: 14px; font-weight: 600; color: var(--color-primary); }
.receipt-status { font-size: 10px; padding: 2px 6px; border-radius: 8px; }
.s-done { background: #ECFDF5; color: #10B981; }
.s-pending { background: #FFF7ED; color: #F59E0B; }
.s-void { background: #F3F4F6; color: #9CA3AF; }

.load-more { text-align: center; padding: 12px; font-size: 13px; color: var(--color-primary); cursor: pointer; }
</style>