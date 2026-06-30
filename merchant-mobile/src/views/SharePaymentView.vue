<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchCollectionLinkByToken, payCollectionByToken, type ShareCollectionDetail } from '../api'

const route = useRoute()
const router = useRouter()
const token = route.params.token as string

const loading = ref(true)
const paying = ref(false)
const detail = ref<ShareCollectionDetail | null>(null)
const errorState = ref<'expired' | 'paid' | 'cancelled' | 'invalid' | null>(null)
const countdown = ref('')
let countdownTimer: ReturnType<typeof setInterval> | null = null

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
    // 跳转支付结果页
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
      <!-- 商家信息 -->
      <div class="store-card">
        <div class="store-icon">
          <van-icon name="shop-o" size="28" color="var(--color-primary)" />
        </div>
        <div class="store-info">
          <div class="store-name">{{ detail.storeName }}</div>
          <div class="store-customer">收款对象：{{ detail.customerName || '散客' }}</div>
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

      <!-- 商品明细 -->
      <div class="items-card">
        <h3 class="items-title">商品明细</h3>
        <div v-for="item in detail.items" :key="item.skuId" class="item-row">
          <div class="item-name">
            <span>{{ item.skuName }}</span>
            <span class="item-qty">×{{ item.totalBottleQty }}</span>
          </div>
          <div class="item-price">¥{{ formatPrice(item.unitPrice) }}</div>
        </div>
        <div class="items-total">
          <span>合计</span>
          <span class="items-total-amount">¥{{ formatPrice(detail.amount) }}</span>
        </div>
      </div>

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
  padding: 20px 16px;
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

.store-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 12px;
}

.store-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--color-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.store-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.store-customer {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.countdown-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  margin-bottom: 12px;
  background: #fff3e0;
  border-radius: 8px;
  font-size: 13px;
  color: #e65100;
  font-weight: 500;
}

.amount-card {
  text-align: center;
  padding: 24px;
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

.items-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.items-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
}

.item-row:last-of-type {
  border-bottom: none;
}

.item-name {
  font-size: 14px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-qty {
  font-size: 12px;
  color: var(--text-secondary);
}

.item-price {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.items-total {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #eee;
  margin-top: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.items-total-amount {
  color: var(--color-danger);
  font-size: 18px;
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