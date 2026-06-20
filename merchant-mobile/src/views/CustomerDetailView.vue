<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showToast } from 'vant'
import {
  fetchCustomerDetail,
  fetchCustomerStats,
  fetchCustomerSales,
  fetchCustomerPayments,
  fetchCustomerDebts,
  type CustomerRecord
} from '../api'

const props = defineProps<{ memberId: number }>()

/* ========== 客户基本信息 ========== */
const customer = ref<CustomerRecord | null>(null)
const loading = ref(false)

/* ========== 统计数据 ========== */
const stats = ref({
  totalConsumption: 0,
  totalOrders: 0,
  currentDebt: 0,
  lastPurchaseDate: ''
})
const statsLoading = ref(false)

/* ========== Tab 数据 ========== */
const activeTab = ref('sales')

interface SalesRecord {
  billNo: string
  amount: number
  status: string
  createdAt: string
}

interface PaymentRecord {
  payNo: string
  amount: number
  paymentMethod: string
  paidAt: string
}

interface DebtRecord {
  receivableNo: string
  amount: number
  receivedAmount: number
  unreceivedAmount: number
  status: string
  createdAt: string
}

const salesRecords = ref<SalesRecord[]>([])
const paymentRecords = ref<PaymentRecord[]>([])
const debtRecords = ref<DebtRecord[]>([])
const tabLoading = ref(false)

const CUSTOMER_TYPE_MAP: Record<string, { text: string; type: string }> = {
  WHOLESALE: { text: '批发', type: 'primary' },
  RETAIL: { text: '零售', type: 'success' }
}

/* ========== 数据加载 ========== */
async function loadCustomer() {
  loading.value = true
  try {
    const res = await fetchCustomerDetail(props.memberId)
    customer.value = res.data
  } catch {
    showToast('加载客户信息失败')
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  statsLoading.value = true
  try {
    const res = await fetchCustomerStats(props.memberId)
    const data = res.data || {}
    stats.value = {
      totalConsumption: Number(data.totalConsumption || 0),
      totalOrders: Number(data.totalOrders || 0),
      currentDebt: Number(data.currentDebt || 0),
      lastPurchaseDate: data.lastPurchaseDate || ''
    }
  } catch {
    // ignore
  } finally {
    statsLoading.value = false
  }
}

async function loadTabData() {
  tabLoading.value = true
  try {
    if (activeTab.value === 'sales') {
      const res = await fetchCustomerSales(props.memberId, { page: 1, pageSize: 20 })
      salesRecords.value = res.data?.records ?? res.data ?? []
    } else if (activeTab.value === 'payments') {
      const res = await fetchCustomerPayments(props.memberId, { page: 1, pageSize: 20 })
      paymentRecords.value = res.data?.records ?? res.data ?? []
    } else if (activeTab.value === 'debts') {
      const res = await fetchCustomerDebts(props.memberId, { page: 1, pageSize: 20 })
      debtRecords.value = res.data?.records ?? res.data ?? []
    }
  } catch {
    // ignore
  } finally {
    tabLoading.value = false
  }
}

function onTabChange() {
  loadTabData()
}

function goBack() {
  window.dispatchEvent(new CustomEvent('nav', { detail: 'customers' }))
}

function callPhone() {
  if (customer.value?.mobile) {
    window.location.href = `tel:${customer.value.mobile}`
  } else {
    showToast('该客户没有手机号')
  }
}

function sendMessage() {
  if (customer.value?.mobile) {
    window.location.href = `sms:${customer.value.mobile}`
  } else {
    showToast('该客户没有手机号')
  }
}

function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

onMounted(async () => {
  await Promise.all([loadCustomer(), loadStats()])
  await loadTabData()
})
</script>

<template>
  <section class="page customer-detail-page">
    <!-- 顶部导航 -->
    <div class="detail-header">
      <van-icon name="arrow-left" size="20" @click="goBack" />
      <h2 class="page-title">客户详情</h2>
      <span style="width: 20px;"></span>
    </div>

    <div v-if="loading" class="loading-wrapper">
      <van-loading type="spinner" />
    </div>

    <template v-else-if="customer">
      <!-- 客户基本信息卡片 -->
      <div class="card customer-info-card">
        <div class="customer-top">
          <div class="customer-avatar">
            <van-icon name="manager-o" size="36" color="var(--color-primary)" />
          </div>
          <div class="customer-meta">
            <div class="customer-name-row">
              <span class="customer-name">{{ customer.name }}</span>
              <van-tag
                :type="(CUSTOMER_TYPE_MAP[customer.customerType]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ CUSTOMER_TYPE_MAP[customer.customerType]?.text || customer.customerType }}
              </van-tag>
            </div>
            <div class="customer-mobile">
              <van-icon name="phone-o" size="14" />
              <span>{{ customer.mobile || '未填写' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 统计卡片 -->
      <div class="stats-grid" v-loading="statsLoading">
        <div class="stats-card">
          <span class="stats-label">累计消费</span>
          <span class="stats-value">¥{{ formatMoney(stats.totalConsumption) }}</span>
        </div>
        <div class="stats-card">
          <span class="stats-label">累计订单</span>
          <span class="stats-value">{{ stats.totalOrders }}<span class="stats-unit"> 单</span></span>
        </div>
        <div class="stats-card">
          <span class="stats-label">当前欠款</span>
          <span class="stats-value" :class="{ 'stats-value--danger': stats.currentDebt > 0 }">
            ¥{{ formatMoney(stats.currentDebt) }}
          </span>
        </div>
        <div class="stats-card">
          <span class="stats-label">最近购买</span>
          <span class="stats-value stats-value--date">{{ stats.lastPurchaseDate || '暂无' }}</span>
        </div>
      </div>

      <!-- Tab 切换 -->
      <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
        <van-tab title="销售记录" name="sales" />
        <van-tab title="收款记录" name="payments" />
        <van-tab title="欠款明细" name="debts" />
      </van-tabs>

      <div v-if="tabLoading" class="loading-wrapper">
        <van-loading type="spinner" />
      </div>

      <!-- 销售记录 -->
      <template v-else-if="activeTab === 'sales'">
        <div v-if="salesRecords.length === 0" class="empty-wrapper">
          <van-empty description="暂无销售记录" />
        </div>
        <van-cell-group v-else inset>
          <van-cell
            v-for="item in salesRecords"
            :key="item.billNo"
            class="record-cell"
          >
            <template #title>
              <div class="record-header">
                <span class="record-no">{{ item.billNo }}</span>
                <van-tag plain size="medium">{{ item.status }}</van-tag>
              </div>
            </template>
            <template #label>
              <div class="record-info">
                <span>{{ item.createdAt }}</span>
                <span class="record-amount">¥{{ formatMoney(item.amount) }}</span>
              </div>
            </template>
          </van-cell>
        </van-cell-group>
      </template>

      <!-- 收款记录 -->
      <template v-else-if="activeTab === 'payments'">
        <div v-if="paymentRecords.length === 0" class="empty-wrapper">
          <van-empty description="暂无收款记录" />
        </div>
        <van-cell-group v-else inset>
          <van-cell
            v-for="item in paymentRecords"
            :key="item.payNo"
            class="record-cell"
          >
            <template #title>
              <div class="record-header">
                <span class="record-no">{{ item.payNo }}</span>
                <van-tag type="success" plain size="medium">{{ item.paymentMethod }}</van-tag>
              </div>
            </template>
            <template #label>
              <div class="record-info">
                <span>{{ item.paidAt }}</span>
                <span class="record-amount record-amount--success">¥{{ formatMoney(item.amount) }}</span>
              </div>
            </template>
          </van-cell>
        </van-cell-group>
      </template>

      <!-- 欠款明细 -->
      <template v-else-if="activeTab === 'debts'">
        <div v-if="debtRecords.length === 0" class="empty-wrapper">
          <van-empty description="暂无欠款" />
        </div>
        <van-cell-group v-else inset>
          <van-cell
            v-for="item in debtRecords"
            :key="item.receivableNo"
            class="record-cell"
          >
            <template #title>
              <div class="record-header">
                <span class="record-no">{{ item.receivableNo }}</span>
                <van-tag
                  :type="item.status === 'PAID' ? 'success' : 'danger'"
                  plain
                  size="medium"
                >
                  {{ item.status === 'PAID' ? '已结清' : '未结清' }}
                </van-tag>
              </div>
            </template>
            <template #label>
              <div class="record-info">
                <span>{{ item.createdAt }}</span>
                <span class="record-amount record-amount--danger">¥{{ formatMoney(item.unreceivedAmount) }}</span>
              </div>
              <div class="debt-detail">
                <span>应收: ¥{{ formatMoney(item.amount) }}</span>
                <span>已收: ¥{{ formatMoney(item.receivedAmount) }}</span>
              </div>
            </template>
          </van-cell>
        </van-cell-group>
      </template>
    </template>

    <!-- 底部操作栏 -->
    <div v-if="customer" class="bottom-actions">
      <van-button type="default" size="small" icon="edit" @click="goBack">编辑</van-button>
      <van-button type="primary" size="small" icon="phone-o" @click="callPhone">拨打电话</van-button>
      <van-button type="default" size="small" icon="chat-o" @click="sendMessage">发送消息</van-button>
    </div>
  </section>
</template>

<style scoped>
.customer-detail-page {
  padding-bottom: 80px;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-title {
  margin: 0;
  font-size: var(--text-page-title);
  font-weight: 600;
  color: var(--text-primary);
}

.loading-wrapper,
.empty-wrapper {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

/* 客户信息卡片 */
.customer-info-card {
  padding: var(--space-card-padding);
}

.customer-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.customer-avatar {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md);
  background: var(--color-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.customer-meta {
  flex: 1;
  min-width: 0;
}

.customer-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.customer-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.customer-mobile {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.stats-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: 14px 12px;
}

.stats-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.stats-value {
  font-size: var(--text-amount);
  font-weight: 600;
  color: var(--text-primary);
}

.stats-unit {
  font-size: var(--text-caption);
  font-weight: 400;
  color: var(--text-secondary);
}

.stats-value--danger {
  color: var(--color-danger);
}

.stats-value--date {
  font-size: var(--text-caption);
  font-weight: 400;
  color: var(--text-muted);
}

/* 记录列表 */
.record-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.record-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.record-no {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.record-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-caption);
  color: var(--text-muted);
  margin-top: 4px;
}

.record-amount {
  font-weight: 600;
  color: var(--color-primary);
}

.record-amount--success {
  color: var(--color-success);
}

.record-amount--danger {
  color: var(--color-danger);
}

.debt-detail {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

/* 底部操作栏 */
.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-card);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  z-index: 100;
}
</style>
