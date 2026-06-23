<script setup lang="ts">
import { ref } from 'vue'
import {
  fetchCollectionLinks,
  fetchPaymentOrders,
  fetchRefundOrders,
  type CollectionLinkRecord,
  type PaymentOrderRecord,
  type RefundOrderRecord
} from '../api'

const TAB_LIST = [
  { label: '收款链接', value: 'links' },
  { label: '支付记录', value: 'payments' },
  { label: '退款记录', value: 'refunds' }
]

const LINK_STATUS_MAP: Record<string, { text: string; type: string }> = {
  PENDING: { text: '待支付', type: 'warning' },
  EXPIRED: { text: '已过期', type: 'default' },
  PAID: { text: '已支付', type: 'success' }
}

const PAYMENT_STATUS_MAP: Record<string, { text: string; type: string }> = {
  SUCCESS: { text: '成功', type: 'success' },
  PENDING: { text: '处理中', type: 'warning' },
  FAILED: { text: '失败', type: 'danger' }
}

const REFUND_STATUS_MAP: Record<string, { text: string; type: string }> = {
  PENDING: { text: '待处理', type: 'warning' },
  APPROVED: { text: '已同意', type: 'success' },
  REJECTED: { text: '已拒绝', type: 'danger' },
  COMPLETED: { text: '已完成', type: 'success' }
}

const activeTab = ref('links')

const linkRecords = ref<CollectionLinkRecord[]>([])
const paymentRecords = ref<PaymentOrderRecord[]>([])
const refundRecords = ref<RefundOrderRecord[]>([])

const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

function currentRecords() {
  switch (activeTab.value) {
    case 'links':
      return linkRecords.value
    case 'payments':
      return paymentRecords.value
    case 'refunds':
      return refundRecords.value
    default:
      return []
  }
}

async function loadData(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    let res
    const params = { page: page.value, pageSize }
    if (activeTab.value === 'links') {
      res = await fetchCollectionLinks(params)
    } else if (activeTab.value === 'payments') {
      res = await fetchPaymentOrders(params)
    } else {
      res = await fetchRefundOrders(params)
    }
    const data = res.data
    const records = data.records ?? []
    if (activeTab.value === 'links') {
      if (reset) linkRecords.value = records as CollectionLinkRecord[]
      else linkRecords.value.push(...(records as CollectionLinkRecord[]))
    } else if (activeTab.value === 'payments') {
      if (reset) paymentRecords.value = records as PaymentOrderRecord[]
      else paymentRecords.value.push(...(records as PaymentOrderRecord[]))
    } else {
      if (reset) refundRecords.value = records as RefundOrderRecord[]
      else refundRecords.value.push(...(records as RefundOrderRecord[]))
    }
    const total = data.total ?? 0
    if (currentRecords().length >= total) {
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
  loadData(true)
}

function onTabChange() {
  loadData(true)
}

function goBack() {
  window.history.back()
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">分享收款</h2>
      <van-button type="default" size="small" icon="arrow-left" @click="goBack">
        返回
      </van-button>
    </div>

    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab
        v-for="tab in TAB_LIST"
        :key="tab.value"
        :title="tab.label"
        :name="tab.value"
      />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadData"
      >
        <div v-if="currentRecords().length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无数据" />
        </div>

        <!-- 收款链接列表 -->
        <template v-if="activeTab === 'links'">
          <van-cell
            v-for="item in linkRecords"
            :key="item.linkNo"
            class="record-cell"
          >
            <template #title>
              <div class="record-header">
                <span class="record-no">{{ item.linkNo }}</span>
                <van-tag
                  :type="(LINK_STATUS_MAP[item.status]?.type as any) || 'default'"
                  plain
                  size="medium"
                >
                  {{ LINK_STATUS_MAP[item.status]?.text || item.status }}
                </van-tag>
              </div>
            </template>
            <template #label>
              <div class="record-info">
                <span class="info-label">来源单号</span>
                <span class="info-value">{{ item.sourceNo }}</span>
              </div>
              <div class="record-amounts">
                <span class="amount-item">
                  <span class="amount-label">金额</span>
                  <span class="amount-value">¥{{ Number(item.amount).toFixed(2) }}</span>
                </span>
                <span class="amount-item">
                  <span class="amount-label">已付</span>
                  <span class="amount-value amount-received">¥{{ Number(item.paidAmount).toFixed(2) }}</span>
                </span>
              </div>
              <div class="record-meta">
                <span>过期时间：{{ item.expireAt }}</span>
              </div>
            </template>
          </van-cell>
        </template>

        <!-- 支付记录列表 -->
        <template v-if="activeTab === 'payments'">
          <van-cell
            v-for="item in paymentRecords"
            :key="item.payNo"
            class="record-cell"
          >
            <template #title>
              <div class="record-header">
                <span class="record-no">{{ item.payNo }}</span>
                <van-tag
                  :type="(PAYMENT_STATUS_MAP[item.status]?.type as any) || 'default'"
                  plain
                  size="medium"
                >
                  {{ PAYMENT_STATUS_MAP[item.status]?.text || item.status }}
                </van-tag>
              </div>
            </template>
            <template #label>
              <div class="record-info">
                <span class="info-label">来源单号</span>
                <span class="info-value">{{ item.sourceNo }}</span>
              </div>
              <div class="record-amounts">
                <span class="amount-item">
                  <span class="amount-label">金额</span>
                  <span class="amount-value">¥{{ Number(item.amount).toFixed(2) }}</span>
                </span>
                <span class="amount-item">
                  <span class="amount-label">支付方式</span>
                  <span class="info-value">{{ item.paymentMethod }}</span>
                </span>
              </div>
              <div class="record-meta">
                <span>支付时间：{{ item.paidAt || '-' }}</span>
              </div>
            </template>
          </van-cell>
        </template>

        <!-- 退款记录列表 -->
        <template v-if="activeTab === 'refunds'">
          <van-cell
            v-for="item in refundRecords"
            :key="item.refundNo"
            class="record-cell"
          >
            <template #title>
              <div class="record-header">
                <span class="record-no">{{ item.refundNo }}</span>
                <van-tag
                  :type="(REFUND_STATUS_MAP[item.status]?.type as any) || 'default'"
                  plain
                  size="medium"
                >
                  {{ REFUND_STATUS_MAP[item.status]?.text || item.status }}
                </van-tag>
              </div>
            </template>
            <template #label>
              <div class="record-info">
                <span class="info-label">支付单号</span>
                <span class="info-value">{{ item.payNo }}</span>
              </div>
              <div class="record-info">
                <span class="info-label">来源单号</span>
                <span class="info-value">{{ item.sourceNo }}</span>
              </div>
              <div class="record-amounts">
                <span class="amount-item">
                  <span class="amount-label">退款金额</span>
                  <span class="amount-value amount-danger">¥{{ Number(item.amount).toFixed(2) }}</span>
                </span>
                <span class="amount-item">
                  <span class="amount-label">原因</span>
                  <span class="info-value">{{ item.reason || '-' }}</span>
                </span>
              </div>
            </template>
          </van-cell>
        </template>
      </van-list>
    </van-pull-refresh>
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
  gap: 8px;
  margin-top: 4px;
  font-size: 13px;
}

.info-label {
  color: var(--text-muted);
}

.info-value {
  color: var(--text-secondary);
  font-weight: 500;
}

.record-amounts {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.amount-item {
  display: flex;
  flex-direction: column;
}

.amount-label {
  font-size: 11px;
  color: var(--text-muted);
}

.amount-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.amount-received {
  color: var(--color-success);
}

.amount-danger {
  color: var(--color-danger);
}

.record-meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
