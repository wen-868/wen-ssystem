<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showLoadingToast, showSuccessToast, closeToast, showDialog } from 'vant'
import { fetchShiftSummary, submitShiftSettlement, type ShiftData } from '../api'

const router = useRouter()
const shiftData = ref<ShiftData | null>(null)
const loading = ref(false)
const settling = ref(false)

// 差异核对
const actualAmount = ref<number | null>(null)
const difference = computed(() => {
  if (actualAmount.value == null || !shiftData.value) return null
  return actualAmount.value - shiftData.value.totalReceived
})

const SHIFTING_LABELS: Record<string, string> = {
  CASH: '现金',
  WECHAT: '微信',
  ALIPAY: '支付宝',
  TRANSFER: '转账',
  OTHER: '其他'
}

async function loadShift() {
  loading.value = true
  try {
    const res = await fetchShiftSummary()
    shiftData.value = res.data as ShiftData
  } catch {
    shiftData.value = null
  } finally {
    loading.value = false
  }
}

function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

async function handleSettle() {
  try {
    await showDialog({
      title: '确认班结',
      message: '确认执行班结操作？班结后将生成结算单据。'
    })
  } catch {
    return
  }

  settling.value = true
  showLoadingToast({ message: '班结中...', forbidClick: true })
  try {
    const res = await submitShiftSettlement({
      actualAmount: actualAmount.value ?? shiftData.value!.totalReceived
    })
    const data = res.data as ShiftData
    closeToast()
    showSuccessToast(`班结成功 (${data.settleNo})`)
    shiftData.value = data
    setTimeout(() => router.back(), 1500)
  } catch {
    closeToast()
  } finally {
    settling.value = false
  }
}

onMounted(() => {
  loadShift()
})
</script>

<template>
  <div class="shift-settlement-view">
    <van-nav-bar title="班结" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="loading-center" />

    <template v-else-if="shiftData">
      <!-- 班次信息 -->
      <div class="section-card">
        <h3 class="section-title">班次信息</h3>
        <van-cell-group inset>
          <van-cell title="班次日期" :value="shiftData.shiftDate" />
          <van-cell title="开始时间" :value="shiftData.startTime" />
          <van-cell title="已营业时长" :value="shiftData.operatingHours" />
        </van-cell-group>
      </div>

      <!-- 收款汇总 -->
      <div class="section-card">
        <h3 class="section-title">收款汇总</h3>
        <div v-if="shiftData.paymentBreakdown?.length > 0" class="method-list">
          <div v-for="method in shiftData.paymentBreakdown" :key="method.channel" class="method-item">
            <div class="method-header">
              <span class="method-name">{{ SHIFTING_LABELS[method.channel] || method.channel }}</span>
              <span class="method-amount">¥{{ formatPrice(method.amount) }}</span>
            </div>
            <van-progress
              :percentage="shiftData.totalReceived > 0 ? (method.amount / shiftData.totalReceived) * 100 : 0"
              :stroke-width="8"
              :show-pivot="false"
              :color="'var(--color-primary)'"
            />
          </div>
        </div>
        <div class="total-row">
          <span>合计收款</span>
          <span class="total-amount">¥{{ formatPrice(shiftData.totalReceived) }}</span>
        </div>
      </div>

      <!-- 订单汇总 -->
      <div class="section-card">
        <h3 class="section-title">订单汇总</h3>
        <van-cell-group inset>
          <van-cell title="总订单数" :value="String(shiftData.orderCount)" />
          <van-cell title="现金订单" :value="String(shiftData.cashOrderCount)" />
          <van-cell title="赊销订单" :value="String(shiftData.creditOrderCount)" />
          <van-cell title="退货订单" :value="String(shiftData.returnOrderCount)" />
        </van-cell-group>
      </div>

      <!-- 汇总卡片 -->
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-value">¥{{ formatPrice(shiftData.totalSales) }}</div>
          <div class="summary-label">总销售额</div>
        </div>
        <div class="summary-card summary-card--green">
          <div class="summary-value">¥{{ formatPrice(shiftData.totalReceived) }}</div>
          <div class="summary-label">总收款</div>
        </div>
      </div>

      <!-- 差异核对 -->
      <div class="section-card" v-if="!shiftData.settleNo">
        <h3 class="section-title">差异核对</h3>
        <van-cell-group inset>
          <van-cell title="系统金额">
            <template #value>
              <span class="system-amount">¥{{ formatPrice(shiftData.totalReceived) }}</span>
            </template>
          </van-cell>
          <van-field
            v-model.number="actualAmount as any"
            label="实际金额"
            type="number"
            placeholder="请输入实际清点金额"
            :rules="[{ required: false }]"
          />
        </van-cell-group>
        <div v-if="difference !== null" class="difference-row">
          <span>差异：</span>
          <span :class="['difference-value', difference >= 0 ? 'positive' : 'negative']">
            {{ difference >= 0 ? '+' : '' }}¥{{ formatPrice(difference) }}
          </span>
        </div>
      </div>

      <!-- 班结按钮 -->
      <div class="settle-section">
        <van-button
          v-if="!shiftData.settleNo"
          type="primary"
          size="large"
          round
          block
          :loading="settling"
          loading-text="班结中..."
          @click="handleSettle"
        >
          执行班结
        </van-button>
        <div v-else class="settled-badge">
          <van-icon name="checked" size="20" color="var(--color-success)" />
          <span>已班结 · {{ shiftData.settleNo }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.shift-settlement-view {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 24px;
}

.loading-center {
  padding: 60px 0;
  display: flex;
  justify-content: center;
}

/* ===== 区块卡片 ===== */
.section-card {
  margin: 0 16px 12px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
}

.section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ===== 收款方式 ===== */
.method-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.method-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.method-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.method-name {
  font-size: 13px;
  color: var(--text-primary);
}

.method-amount {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border-normal);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.total-amount {
  font-size: 16px;
  color: var(--color-danger);
}

/* ===== 汇总卡片 ===== */
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 0 16px 12px;
}

.summary-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
  text-align: center;
}

.summary-card--green .summary-value {
  color: var(--color-success);
}

.summary-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary);
}

.summary-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* ===== 差异核对 ===== */
.system-amount {
  font-weight: 600;
  color: var(--color-primary);
  font-size: 15px;
}

.difference-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 14px;
  color: var(--text-secondary);
}

.difference-value {
  font-weight: 700;
  font-size: 16px;
}

.difference-value.positive {
  color: var(--color-success);
}

.difference-value.negative {
  color: var(--color-danger);
}

/* ===== 班结按钮 ===== */
.settle-section {
  padding: 24px 16px;
}

.settled-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-success-soft);
  border-radius: var(--radius-md);
  font-size: 15px;
  color: var(--color-success);
  font-weight: 500;
}
</style>