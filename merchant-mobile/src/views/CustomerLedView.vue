<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showToast } from 'vant'
import {
  fetchCustomerLedgers,
  fetchCustomerLedgerDetail,
  type CustomerLedgerSummary,
  type CustomerLedgerRecord,
  type CustomerLedgerDetail
} from '../api'

const activeTab = ref('all')
const keyword = ref('')
const dateRange = ref({ start: '', end: '' })

const ledgers = ref<CustomerLedgerSummary[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

// 详情弹窗
const showDetail = ref(false)
const detail = ref<CustomerLedgerDetail | null>(null)
const detailLoading = ref(false)

const TRANSACTION_TYPE_MAP: Record<string, { text: string; type: string; color: string }> = {
  RECEIVABLE: { text: '应收', type: 'warning', color: 'var(--color-warning)' },
  PAYABLE: { text: '应付', type: 'danger', color: 'var(--color-danger)' },
  RECEIPT: { text: '收款', type: 'success', color: 'var(--color-success)' },
  PAYMENT: { text: '付款', type: 'primary', color: 'var(--color-primary)' }
}

const SOURCE_TYPE_MAP: Record<string, string> = {
  SALE_BILL: '销售单',
  SALE_RETURN: '退货单',
  RECEIVABLE: '应收单',
  PAYMENT: '收款单'
}

async function loadLedgers(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchCustomerLedgers({
      page: page.value,
      pageSize,
      keyword: keyword.value || undefined
    })
    const data = res.data
    if (reset) {
      ledgers.value = data.records ?? []
    } else {
      ledgers.value.push(...(data.records ?? []))
    }
    if (ledgers.value.length >= (data.total ?? 0)) {
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
  loadLedgers(true)
}

function onTabChange() {
  loadLedgers(true)
}

function onSearch() {
  loadLedgers(true)
}

async function viewDetail(customerId: number) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await fetchCustomerLedgerDetail(customerId, {
      startDate: dateRange.value.start || undefined,
      endDate: dateRange.value.end || undefined
    })
    detail.value = res.data
  } catch {
    showToast('操作失败，请重试')
  } finally {
    detailLoading.value = false
  }
}

function getTransactionTypeText(type: string) {
  return TRANSACTION_TYPE_MAP[type]?.text || type
}

function getTransactionTypeColor(type: string) {
  return TRANSACTION_TYPE_MAP[type]?.color || 'var(--text-secondary)'
}

function getSourceTypeText(type: string) {
  return SOURCE_TYPE_MAP[type] || type
}

function formatAmount(amount: number, isDebit: boolean) {
  const formatted = Math.abs(amount).toFixed(2)
  if (isDebit) return `-${formatted}`
  return formatted
}

function goBack() {
  window.dispatchEvent(new CustomEvent('nav', { detail: 'home' }))
}

onMounted(() => {
  loadLedgers(true)
})
</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">客户往来账</h2>
      <van-button type="default" size="small" icon="arrow-left" @click="goBack">
        返回
      </van-button>
    </div>

    <!-- 搜索框 -->
    <van-search
      v-model="keyword"
      placeholder="搜索客户名称/手机号"
      show-action
      @search="onSearch"
      @cancel="onSearch"
    />

    <!-- 时间范围选择 -->
    <div class="date-filter">
      <van-field
        v-model="dateRange.start"
        type="date"
        label="开始日期"
        placeholder="选择开始日期"
      />
      <van-field
        v-model="dateRange.end"
        type="date"
        label="结束日期"
        placeholder="选择结束日期"
      />
      <van-button type="primary" size="small" @click="onSearch">查询</van-button>
    </div>

    <!-- 客户列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadLedgers"
      >
        <div v-if="ledgers.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无客户往来账" />
        </div>
        <van-cell
          v-for="ledger in ledgers"
          :key="ledger.customerId"
          is-link
          class="ledger-cell"
          @click="viewDetail(ledger.customerId)"
        >
          <template #title>
            <div class="ledger-header">
              <span class="customer-name">{{ ledger.customerName }}</span>
              <span class="balance" :class="{ 'positive': ledger.balance >= 0, 'negative': ledger.balance < 0 }">
                余额: ¥{{ ledger.balance.toFixed(2) }}
              </span>
            </div>
          </template>
          <template #label>
            <div class="ledger-info">
              <div class="info-item">
                <span class="label">应收:</span>
                <span class="amount">¥{{ ledger.totalReceivable.toFixed(2) }}</span>
              </div>
              <div class="info-item">
                <span class="label">已收:</span>
                <span class="amount received">¥{{ ledger.totalReceived.toFixed(2) }}</span>
              </div>
              <div class="info-item">
                <span class="label">应付:</span>
                <span class="amount">¥{{ ledger.totalPayable.toFixed(2) }}</span>
              </div>
              <div class="info-item">
                <span class="label">已付:</span>
                <span class="amount paid">¥{{ ledger.totalPaid.toFixed(2) }}</span>
              </div>
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
      :style="{ maxHeight: '90%' }"
    >
      <div class="detail-panel">
        <h3>客户往来明细</h3>
        <div v-if="detailLoading" class="detail-loading">
          <van-loading type="spinner" />
        </div>
        <template v-else-if="detail">
          <!-- 汇总信息 -->
          <div class="summary-section">
            <h4>汇总信息</h4>
            <div class="summary-grid">
              <div class="summary-item">
                <span class="label">期初余额</span>
                <span class="value">¥{{ detail.summary.balance.toFixed(2) }}</span>
              </div>
              <div class="summary-item">
                <span class="label">本期应收</span>
                <span class="value debit">¥{{ detail.summary.totalReceivable.toFixed(2) }}</span>
              </div>
              <div class="summary-item">
                <span class="label">本期已收</span>
                <span class="value credit">¥{{ detail.summary.totalReceived.toFixed(2) }}</span>
              </div>
              <div class="summary-item">
                <span class="label">期末余额</span>
                <span class="value" :class="{ 'positive': detail.summary.balance >= 0, 'negative': detail.summary.balance < 0 }">
                  ¥{{ detail.summary.balance.toFixed(2) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 往来记录 -->
          <div class="records-section">
            <h4>往来记录</h4>
            <div v-if="detail.records.length === 0" class="empty-records">
              暂无往来记录
            </div>
            <van-cell-group v-else inset>
              <van-cell
                v-for="record in detail.records"
                :key="record.id"
                class="record-cell"
              >
                <template #title>
                  <div class="record-header">
                    <span class="transaction-type" :style="{ color: getTransactionTypeColor(record.transactionType) }">
                      {{ getTransactionTypeText(record.transactionType) }}
                    </span>
                    <span class="transaction-no">{{ record.transactionNo }}</span>
                  </div>
                </template>
                <template #label>
                  <div class="record-info">
                    <div class="info-row">
                      <span class="source-type">{{ getSourceTypeText(record.sourceType) }}</span>
                      <span class="source-no">{{ record.sourceNo }}</span>
                    </div>
                    <div class="info-row">
                      <span class="date">{{ record.transactionDate }}</span>
                      <span v-if="record.remark" class="remark">{{ record.remark }}</span>
                    </div>
                  </div>
                </template>
                <template #value>
                  <div class="record-amount">
                    <div class="amount-row">
                      <span class="label">借方:</span>
                      <span class="value debit" v-if="['RECEIVABLE', 'PAYABLE'].includes(record.transactionType)">
                        ¥{{ record.amount.toFixed(2) }}
                      </span>
                      <span class="value" v-else>-</span>
                    </div>
                    <div class="amount-row">
                      <span class="label">贷方:</span>
                      <span class="value credit" v-if="['RECEIPT', 'PAYMENT'].includes(record.transactionType)">
                        ¥{{ record.amount.toFixed(2) }}
                      </span>
                      <span class="value" v-else>-</span>
                    </div>
                    <div class="amount-row balance-row">
                      <span class="label">余额:</span>
                      <span class="value" :class="{ 'positive': record.balance >= 0, 'negative': record.balance < 0 }">
                        ¥{{ record.balance.toFixed(2) }}
                      </span>
                    </div>
                  </div>
                </template>
              </van-cell>
            </van-cell-group>
          </div>
        </template>
      </div>
    </van-popup>
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

.date-filter {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
}

.date-filter :deep(.van-field) {
  flex: 1;
  padding: 0;
}

.date-filter :deep(.van-field__label) {
  width: auto;
  margin-right: 8px;
}

.empty-wrapper {
  padding: 40px 0;
}

.ledger-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.ledger-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.customer-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.balance {
  font-size: 14px;
  font-weight: 600;
}

.balance.positive {
  color: var(--color-success);
}

.balance.negative {
  color: var(--color-danger);
}

.ledger-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.info-item .label {
  color: var(--text-secondary);
}

.info-item .amount {
  font-weight: 500;
  color: var(--text-primary);
}

.info-item .amount.received {
  color: var(--color-success);
}

.info-item .amount.paid {
  color: var(--color-primary);
}

.detail-panel {
  padding: 20px 16px;
  max-height: 90vh;
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

.summary-section {
  margin-bottom: 20px;
}

.summary-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px;
  background: var(--bg-soft);
  border-radius: var(--radius-sm);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-item .label {
  font-size: 12px;
  color: var(--text-secondary);
}

.summary-item .value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.summary-item .value.debit {
  color: var(--color-warning);
}

.summary-item .value.credit {
  color: var(--color-success);
}

.summary-item .value.positive {
  color: var(--color-success);
}

.summary-item .value.negative {
  color: var(--color-danger);
}

.records-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.empty-records {
  padding: 40px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.record-cell {
  margin-bottom: 8px;
}

.record-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.transaction-type {
  font-size: 14px;
  font-weight: 600;
}

.transaction-no {
  font-size: 12px;
  color: var(--text-muted);
}

.record-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.source-type {
  color: var(--text-secondary);
}

.source-no {
  color: var(--text-muted);
}

.date {
  color: var(--text-muted);
}

.remark {
  color: var(--text-secondary);
  font-style: italic;
}

.record-amount {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: right;
}

.amount-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.amount-row .label {
  color: var(--text-secondary);
}

.amount-row .value {
  font-weight: 500;
}

.amount-row .value.debit {
  color: var(--color-warning);
}

.amount-row .value.credit {
  color: var(--color-success);
}

.amount-row .value.positive {
  color: var(--color-success);
}

.amount-row .value.negative {
  color: var(--color-danger);
}

.balance-row {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--border-normal);
}
</style>
