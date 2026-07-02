<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchCollectionLinkByToken, payCollectionByToken, type ShareCollectionDetail, type ShareDisplayConfig } from '../api'

const route = useRoute()
const router = useRouter()
const token = route.params.token as string

const loading = ref(true)
const paying = ref(false)
const detail = ref<ShareCollectionDetail | null>(null)
const errorState = ref<'expired' | 'paid' | 'cancelled' | 'invalid' | null>(null)
const countdown = ref('')
const showFullVoucher = ref(false)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const displayConfig = computed<ShareDisplayConfig>(() => {
  return detail.value?.displayConfig ?? { showBarcode: true, showUnit: true, showSpec: true, showTax: false }
})

const documentTitle = computed(() => {
  return detail.value?.documentTitle || '销售单'
})

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function startCountdown(expireAt: string) {
  stopCountdown()
  const tick = () => {
    const diff = new Date(expireAt).getTime() - Date.now()
    if (diff <= 0) {
      countdown.value = '已过期'
      errorState.value = 'expired'
      stopCountdown()
      return
    }
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    countdown.value = `${h}时${m}分${s}秒`
  }
  tick()
  countdownTimer = setInterval(tick, 1000)
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

onUnmounted(() => {
  stopCountdown()
})

onMounted(async () => {
  try {
    const res = await fetchCollectionLinkByToken(token)
    const data = res.data as ShareCollectionDetail
    detail.value = data

    if (data.status === 'PAID') {
      errorState.value = 'paid'
    } else if (data.status === 'CANCELLED') {
      errorState.value = 'cancelled'
    } else if (data.expireAt && new Date(data.expireAt) < new Date()) {
      errorState.value = 'expired'
    } else if (data.expireAt) {
      startCountdown(data.expireAt)
    }
  } catch (e: any) {
    const status = e?.response?.status
    if (status === 404) {
      errorState.value = 'invalid'
    } else {
      errorState.value = 'expired'
    }
  } finally {
    loading.value = false
  }
})

function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

async function handlePay() {
  if (paying.value) return
  paying.value = true
  try {
    await payCollectionByToken(token)
    showToast('支付成功')
    detail.value!.status = 'PAID'
    errorState.value = 'paid'
    stopCountdown()
    router.replace({ name: 'share-payment-result', query: { status: 'success', token } })
  } catch {
    showToast('支付失败，请重试')
  } finally {
    paying.value = false
  }
}
</script>

<template>
  <div class="share-payment-view">
    <van-loading v-if="loading" class="loading-center" />

    <!-- 错误状态 -->
    <template v-else-if="errorState">
      <div class="error-card">
        <van-icon
          :name="errorState === 'paid' ? 'checked' : 'warning-o'"
          :size="60"
          :color="errorState === 'paid' ? 'var(--color-success)' : 'var(--color-warning)'"
        />
        <h2 class="error-title">
          {{ errorState === 'paid' ? '已支付' : errorState === 'cancelled' ? '已撤销' : errorState === 'expired' ? '链接已过期' : '链接无效' }}
        </h2>
        <p class="error-desc">
          <template v-if="errorState === 'paid'">该收款单已完成支付，无需重复操作</template>
          <template v-else-if="errorState === 'cancelled'">该收款单已被商家撤销</template>
          <template v-else-if="errorState === 'expired'">该收款链接已超过有效期，请联系商家重新生成</template>
          <template v-else>未找到对应的收款单信息</template>
        </p>
      </div>
    </template>

    <!-- 正常内容 -->
    <template v-else-if="detail">
      <!-- 单据标题 -->
      <div class="document-header">
        <h1 class="document-title">{{ documentTitle }}</h1>
        <div class="document-meta">
          <span class="doc-no">单号：{{ detail.billNo }}</span>
          <span class="doc-type">{{ detail.saleType === 'CREDIT' ? '赊销' : '现销' }}</span>
        </div>
      </div>

      <!-- 倒计时 -->
      <div v-if="countdown" class="countdown-bar">
        <van-icon name="clock-o" size="14" />
        <span>剩余 {{ countdown }}</span>
      </div>

      <!-- 金额 -->
      <div class="amount-card">
        <div class="amount-label">应付金额</div>
        <div class="amount-value">¥{{ formatPrice(detail.amount) }}</div>
        <div v-if="detail.paidAmount > 0" class="amount-paid">
          已付 ¥{{ formatPrice(detail.paidAmount) }}
        </div>
      </div>

      <!-- 往来方信息 -->
      <div class="party-card">
        <div class="party-section">
          <div class="party-label">销售方（供方）</div>
          <div class="party-name">{{ detail.storeName }}</div>
          <div v-if="detail.storeAddress" class="party-detail">{{ detail.storeAddress }}</div>
          <div v-if="detail.storeContact" class="party-detail">电话：{{ detail.storeContact }}</div>
        </div>
        <div class="party-divider"></div>
        <div class="party-section">
          <div class="party-label">购买方（需方）</div>
          <div class="party-name">{{ detail.customerName || '散客' }}</div>
          <div v-if="detail.customerMobile" class="party-detail">电话：{{ detail.customerMobile }}</div>
        </div>
      </div>

      <!-- 商品明细 — 法律凭证核心 -->
      <div class="voucher-card">
        <h3 class="voucher-title">商品明细</h3>
        <div class="voucher-table">
          <div class="voucher-header">
            <span class="col-name">产品名称</span>
            <span v-if="displayConfig.showSpec" class="col-spec">规格</span>
            <span v-if="displayConfig.showUnit" class="col-unit">单位</span>
            <span class="col-qty">数量</span>
            <span class="col-price">单价</span>
            <span v-if="displayConfig.showBarcode" class="col-barcode">条形码</span>
            <span class="col-subtotal">金额</span>
          </div>
          <div v-for="item in detail.items" :key="item.skuId" class="voucher-row">
            <span class="col-name">{{ item.skuName }}</span>
            <span v-if="displayConfig.showSpec" class="col-spec">{{ item.spec || '--' }}</span>
            <span v-if="displayConfig.showUnit" class="col-unit">{{ item.unit || '瓶' }}</span>
            <span class="col-qty">{{ item.totalBottleQty }}</span>
            <span class="col-price">¥{{ formatPrice(item.unitPrice) }}</span>
            <span v-if="displayConfig.showBarcode" class="col-barcode">{{ item.barcode || '--' }}</span>
            <span class="col-subtotal">¥{{ formatPrice(item.subtotalAmount) }}</span>
          </div>
        </div>

        <!-- 金额汇总 -->
        <div class="voucher-summary">
          <div class="summary-row">
            <span>商品金额</span>
            <span>¥{{ formatPrice(detail.goodsAmount) }}</span>
          </div>
          <div v-if="detail.discountAmount > 0" class="summary-row discount">
            <span>优惠金额</span>
            <span>-¥{{ formatPrice(detail.discountAmount) }}</span>
          </div>
          <div v-if="detail.taxEnabled && displayConfig.showTax" class="summary-row tax">
            <span>税额（{{ (detail.taxRate * 100).toFixed(0) }}%）</span>
            <span>¥{{ formatPrice(detail.taxAmount) }}</span>
          </div>
          <div class="summary-row total">
            <span>应收金额</span>
            <span class="total-amount">¥{{ formatPrice(detail.receivableAmount) }}</span>
          </div>
          <div v-if="detail.receivedAmount > 0" class="summary-row">
            <span>已收金额</span>
            <span>¥{{ formatPrice(detail.receivedAmount) }}</span>
          </div>
          <div v-if="detail.unreceivedAmount > 0" class="summary-row unreceived">
            <span>未收金额</span>
            <span>¥{{ formatPrice(detail.unreceivedAmount) }}</span>
          </div>
        </div>
      </div>

      <!-- 单据备注 -->
      <div class="voucher-footer">
        <div class="footer-item">
          <span class="footer-label">开单日期</span>
          <span>{{ formatDate(detail.createdAt) }}</span>
        </div>
        <div class="footer-item">
          <span class="footer-label">单据状态</span>
          <span class="status-tag" :class="'status-' + (detail.businessStatus || '').toLowerCase()">
            {{ detail.businessStatus === 'CREATED' ? '已开单' : detail.businessStatus === 'COMPLETED' ? '已完成' : detail.businessStatus === 'VOIDED' ? '已作废' : detail.businessStatus || '--' }}
          </span>
        </div>
      </div>

      <!-- 法律声明 -->
      <p class="legal-notice">本单据为电子凭证，与纸质单据具有同等法律效力</p>

      <!-- 支付按钮 -->
      <div class="pay-section">
        <van-button
          type="primary"
          size="large"
          round
          block
          :loading="paying"
          loading-text="支付中..."
          @click="handlePay"
          :disabled="detail.status === 'PAID' || detail.status === 'CANCELLED'"
        >
          {{ detail.status === 'PAID' ? '已支付' : detail.status === 'CANCELLED' ? '已撤销' : '微信支付 ¥' + formatPrice(detail.amount) }}
        </van-button>
        <p class="pay-tip">点击按钮模拟支付，实际环境将唤起微信支付</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.share-payment-view {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 16px;
  padding-bottom: 32px;
}

.loading-center {
  padding: 100px 0;
  display: flex;
  justify-content: center;
}

.error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
}

.error-title {
  margin: 16px 0 8px;
  font-size: 20px;
  color: var(--text-primary);
}

.error-desc {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.6;
}

/* 单据标题 */
.document-header {
  text-align: center;
  padding: 16px 0 8px;
}

.document-title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 2px;
}

.document-meta {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.doc-type {
  display: inline-block;
  padding: 2px 8px;
  background: #e8f5e9;
  color: #2e7d32;
  border-radius: 4px;
  font-size: 12px;
}

.countdown-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  margin: 8px 0 12px;
  background: #fff3e0;
  border-radius: 8px;
  font-size: 13px;
  color: #e65100;
  font-weight: 500;
}

.amount-card {
  text-align: center;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 12px;
}

.amount-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.amount-value {
  font-size: 36px;
  font-weight: 700;
  color: var(--text-primary);
}

.amount-paid {
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-success);
}

/* 往来方信息 */
.party-card {
  display: flex;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.party-section {
  flex: 1;
}

.party-divider {
  width: 1px;
  background: #eee;
  margin: 0 16px;
}

.party-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.party-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.party-detail {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* 商品明细表格 */
.voucher-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  overflow-x: auto;
}

.voucher-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.voucher-table {
  min-width: 100%;
}

.voucher-header {
  display: flex;
  padding: 8px 0;
  border-bottom: 2px solid #333;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.voucher-row {
  display: flex;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
  color: var(--text-primary);
}

.voucher-row:last-child {
  border-bottom: none;
}

.col-name { flex: 2; min-width: 80px; }
.col-spec { flex: 1; min-width: 60px; text-align: center; }
.col-unit { flex: 0.5; min-width: 40px; text-align: center; }
.col-qty { flex: 0.5; min-width: 40px; text-align: right; }
.col-price { flex: 1; min-width: 60px; text-align: right; }
.col-barcode { flex: 1; min-width: 80px; text-align: center; font-size: 11px; color: var(--text-muted); word-break: break-all; }
.col-subtotal { flex: 1; min-width: 60px; text-align: right; font-weight: 500; }

/* 金额汇总 */
.voucher-summary {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

.summary-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
  padding: 4px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.summary-row.discount {
  color: var(--color-danger);
}

.summary-row.tax {
  color: #f57c00;
}

.summary-row.total {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  padding-top: 8px;
  border-top: 1px dashed #ddd;
  margin-top: 4px;
}

.total-amount {
  color: var(--color-danger);
  font-size: 18px;
}

.summary-row.unreceived {
  color: var(--color-warning);
  font-weight: 500;
}

/* 单据尾部 */
.voucher-footer {
  background: #fff;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
}

.footer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
}

.footer-label {
  color: var(--text-secondary);
}

.status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-created { background: #e3f2fd; color: #1565c0; }
.status-completed { background: #e8f5e9; color: #2e7d32; }
.status-voided { background: #fbe9e7; color: #bf360c; }

/* 法律声明 */
.legal-notice {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  margin: 0 0 20px;
  padding: 0 16px;
  line-height: 1.5;
}

.pay-section {
  padding: 0 8px;
}

.pay-tip {
  text-align: center;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>