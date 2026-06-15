<script setup lang="ts">
import { ref } from 'vue'
import {
  showLoadingToast,
  showSuccessToast,
  closeToast
} from 'vant'
import {
  fetchReceivables,
  registerReceivablePayment,
  type ReceivableRecord
} from '../api'

const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '未收款', value: 'UNPAID' },
  { label: '部分收款', value: 'PARTIAL' },
  { label: '已结清', value: 'PAID' }
]

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  UNPAID: { text: '未收款', type: 'danger' },
  PARTIAL: { text: '部分收款', type: 'warning' },
  PAID: { text: '已结清', type: 'success' },
  CLOSED: { text: '已关闭', type: 'default' }
}

const activeTab = ref('')
const records = ref<ReceivableRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

// 收款登记弹窗
const showPaymentPopup = ref(false)
const paymentTarget = ref<ReceivableRecord | null>(null)
const paymentAmount = ref('')
const paymentMethod = ref('TRANSFER')
const paymentRemark = ref('')

async function loadReceivables(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchReceivables({
      page: page.value,
      pageSize,
      status: activeTab.value || undefined
    })
    const data = res.data.data
    if (reset) {
      records.value = data.records ?? []
    } else {
      records.value.push(...(data.records ?? []))
    }
    if (records.value.length >= (data.total ?? 0)) {
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
  loadReceivables(true)
}

function onTabChange() {
  loadReceivables(true)
}

function openPaymentDialog(item: ReceivableRecord) {
  paymentTarget.value = item
  paymentAmount.value = String(item.unreceivedAmount)
  paymentMethod.value = 'TRANSFER'
  paymentRemark.value = ''
  showPaymentPopup.value = true
}

async function submitPayment() {
  if (!paymentTarget.value) return
  const amount = Number(paymentAmount.value)
  if (!amount || amount <= 0) {
    showSuccessToast({ message: '请输入有效金额', position: 'bottom' })
    return
  }
  if (amount > Number(paymentTarget.value.unreceivedAmount)) {
    showSuccessToast({ message: '收款金额不能超过未收金额', position: 'bottom' })
    return
  }
  try {
    showLoadingToast({ message: '提交中...', forbidClick: true })
    await registerReceivablePayment(paymentTarget.value.receivableNo, {
      amount,
      paymentMethod: paymentMethod.value,
      remark: paymentRemark.value || undefined
    })
    closeToast()
    showSuccessToast('收款登记成功')
    showPaymentPopup.value = false
    await loadReceivables(true)
  } catch {
    closeToast()
  }
}
</script>

<template>
  <section class="page">
    <h2 class="page-title">应收</h2>

    <!-- 状态筛选 -->
    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab
        v-for="tab in STATUS_TABS"
        :key="tab.value"
        :title="tab.label"
        :name="tab.value"
      />
    </van-tabs>

    <!-- 应收列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadReceivables"
      >
        <div v-if="records.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无应收" />
        </div>
        <van-cell
          v-for="item in records"
          :key="item.receivableNo"
          class="receivable-cell"
        >
          <template #title>
            <div class="receivable-header">
              <span class="receivable-no">{{ item.receivableNo }}</span>
              <van-tag
                :type="(STATUS_MAP[item.status]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ STATUS_MAP[item.status]?.text || item.status }}
              </van-tag>
            </div>
          </template>
          <template #label>
            <div class="receivable-info">
              <span class="customer-name">{{ item.customerName }}</span>
              <span class="customer-mobile">{{ item.customerMobile || '-' }}</span>
            </div>
            <div class="receivable-amounts">
              <span class="amount-item">
                <span class="amount-label">应收</span>
                <span class="amount-value">¥{{ Number(item.receivableAmount).toFixed(2) }}</span>
              </span>
              <span class="amount-item">
                <span class="amount-label">已收</span>
                <span class="amount-value amount-received">¥{{ Number(item.receivedAmount).toFixed(2) }}</span>
              </span>
              <span class="amount-item">
                <span class="amount-label">未收</span>
                <span class="amount-value amount-unreceived">¥{{ Number(item.unreceivedAmount).toFixed(2) }}</span>
              </span>
            </div>
          </template>
          <template #extra>
            <van-button
              v-if="Number(item.unreceivedAmount) > 0"
              size="small"
              type="primary"
              @click="openPaymentDialog(item)"
            >
              收款
            </van-button>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 收款登记弹窗 -->
    <van-popup
      v-model:show="showPaymentPopup"
      position="bottom"
      round
      :style="{ maxHeight: '70%' }"
    >
      <div class="payment-panel">
        <h3>收款登记</h3>
        <van-cell-group inset>
          <van-cell
            title="应收单号"
            :value="paymentTarget?.receivableNo || '-'"
          />
          <van-cell
            title="客户"
            :value="paymentTarget?.customerName || '-'"
          />
          <van-cell title="未收金额">
            <template #value>
              <span class="unreceived-highlight">
                ¥{{ paymentTarget ? Number(paymentTarget.unreceivedAmount).toFixed(2) : '0.00' }}
              </span>
            </template>
          </van-cell>
          <van-field
            v-model="paymentAmount"
            label="收款金额"
            type="number"
            placeholder="请输入收款金额"
            required
          />
          <van-cell title="收款方式" is-link>
            <template #value>
              <van-radio-group v-model="paymentMethod" direction="horizontal">
                <van-radio name="CASH">现金</van-radio>
                <van-radio name="TRANSFER">转账</van-radio>
                <van-radio name="OTHER_WECHAT">微信</van-radio>
                <van-radio name="ALIPAY">支付宝</van-radio>
              </van-radio-group>
            </template>
          </van-cell>
          <van-field
            v-model="paymentRemark"
            label="备注"
            type="textarea"
            placeholder="可选"
            rows="2"
          />
        </van-cell-group>
        <div class="payment-actions">
          <van-button block type="primary" @click="submitPayment">确认收款</van-button>
        </div>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-wrapper {
  padding: 40px 0;
}

.receivable-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.receivable-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.receivable-no {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.receivable-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}

.customer-name {
  font-weight: 500;
}

.customer-mobile {
  color: var(--text-muted);
}

.receivable-amounts {
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

.amount-unreceived {
  color: var(--color-danger);
}

.payment-panel {
  padding: 20px 16px;
}

.payment-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.unreceived-highlight {
  font-weight: 600;
  color: var(--color-danger);
  font-size: 16px;
}

.payment-actions {
  margin-top: 20px;
}
</style>
