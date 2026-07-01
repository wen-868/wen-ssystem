<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showLoadingToast, closeToast } from 'vant'
import { fetchStoreValueCard, rechargeStoreValueCard, fetchStoreValueTransactions, type StoreValueCard, type StoreValueTransaction } from '../api'

const route = useRoute()
const router = useRouter()
const customerId = Number(route.params.customerId)

const card = ref<StoreValueCard | null>(null)
const transactions = ref<StoreValueTransaction[]>([])
const loading = ref(false)

const showRecharge = ref(false)
const rechargeAmount = ref(0)
const rechargeMethod = ref('CASH')
const recharging = ref(false)

const QUICK_AMOUNTS = [100, 200, 500, 1000]

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.replace('T', ' ').slice(0, 19)
}

async function loadData() {
  loading.value = true
  try {
    const res = await fetchStoreValueCard(customerId)
    card.value = res.data as StoreValueCard
    if (card.value?.cardNo) {
      const tRes = await fetchStoreValueTransactions(card.value.cardNo)
      const tData = (tRes.data as any)?.records ?? tRes.data
      transactions.value = Array.isArray(tData) ? tData : []
    }
  } catch { /* ignore */ }
  finally { loading.value = false }
}

function openRecharge(amount: number) {
  rechargeAmount.value = amount
  showRecharge.value = true
}

async function handleRecharge() {
  if (!rechargeAmount.value || rechargeAmount.value <= 0) {
    showToast('请输入金额')
    return
  }
  recharging.value = true
  showLoadingToast({ message: '充值中...', forbidClick: true })
  try {
    await rechargeStoreValueCard(customerId, { amount: rechargeAmount.value, paymentMethod: rechargeMethod.value })
    closeToast()
    showRecharge.value = false
    await loadData()
  } catch {
    closeToast()
    showToast('充值失败')
  } finally { recharging.value = false }
}

onMounted(() => { loadData() })
</script>

<template>
  <div class="store-value-card-view">
    <van-nav-bar title="储值卡" left-arrow @click-left="router.back()" />

    <!-- 卡片 -->
    <div class="card-box">
      <div class="card-front">
        <div class="card-bank">储值卡</div>
        <div class="card-balance">¥{{ card?.balance?.toFixed(2) ?? '0.00' }}</div>
        <div class="card-no">{{ card?.cardNo ?? '暂无储值卡' }}</div>
        <div class="card-status" :class="card?.status === 'ACTIVE' ? 'active' : ''">
          {{ card?.status === 'ACTIVE' ? '正常' : '未激活' }}
        </div>
      </div>
    </div>

    <!-- 快速充值 -->
    <div class="quick-recharge" v-if="card">
      <h3 class="section-title">快速充值</h3>
      <div class="quick-amounts">
        <span v-for="amt in QUICK_AMOUNTS" :key="amt" class="amt-chip" @click="openRecharge(amt)">
          ¥{{ amt }}
        </span>
      </div>
    </div>

    <!-- 消费记录 -->
    <div class="section-card">
      <h3 class="section-title">交易记录</h3>
      <div v-for="t in transactions" :key="t.id" class="tx-item">
        <div class="tx-left">
          <div class="tx-type">{{ t.type === 'RECHARGE' ? '充值' : '消费' }}</div>
          <div class="tx-time">{{ formatDateTime(t.createdAt) }}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount" :class="t.type === 'RECHARGE' ? 'earn' : 'spend'">
            {{ t.type === 'RECHARGE' ? '+' : '-' }}¥{{ t.amount?.toFixed(2) }}
          </div>
          <div class="tx-balance">余额 ¥{{ t.balance?.toFixed(2) }}</div>
        </div>
      </div>
      <van-empty v-if="transactions.length === 0" description="暂无记录" />
    </div>

    <!-- 充值弹窗 -->
    <van-popup v-model:show="showRecharge" position="bottom" round>
      <div class="recharge-popup">
        <h3>充值</h3>
        <van-cell-group inset>
          <van-field v-model.number="rechargeAmount" type="number" label="金额" placeholder="请输入充值金额" />
          <van-field v-model="rechargeMethod" label="方式" placeholder="CASH/WECHAT/ALIPAY" />
        </van-cell-group>
        <div class="recharge-actions">
          <van-button block @click="showRecharge = false">取消</van-button>
          <van-button type="primary" block :loading="recharging" @click="handleRecharge">确认充值</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.store-value-card-view { min-height: 100vh; background: var(--bg-page); padding-bottom: 24px; }

.card-box { padding: 12px 16px; }
.card-front {
  padding: 24px;
  background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%);
  border-radius: 16px;
  color: #fff;
  text-align: center;
}

.card-bank { font-size: 13px; opacity: 0.85; }
.card-balance { font-size: 36px; font-weight: 700; margin: 8px 0; }
.card-no { font-size: 12px; opacity: 0.7; }
.card-status { font-size: 12px; margin-top: 6px; padding: 2px 10px; border-radius: 10px; background: rgba(0,0,0,.15); display: inline-block; }
.card-status.active { background: rgba(255,255,255,.3); }

.quick-recharge { padding: 0 16px; margin-bottom: 12px; }
.quick-amounts { display: flex; gap: 8px; }
.amt-chip { padding: 8px 16px; border-radius: 20px; background: var(--color-primary-soft); color: var(--color-primary); font-weight: 600; font-size: 14px; }

.section-card { margin: 0 16px 12px; background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px; }
.section-title { margin: 0 0 10px; font-size: 15px; font-weight: 600; }

.tx-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-normal); }
.tx-item:last-child { border-bottom: none; }
.tx-type { font-size: 14px; color: var(--text-primary); }
.tx-time { font-size: 11px; color: var(--text-hint); margin-top: 2px; }
.tx-right { text-align: right; }
.tx-amount { font-size: 15px; font-weight: 600; }
.tx-amount.earn { color: var(--color-success); }
.tx-amount.spend { color: var(--color-danger); }
.tx-balance { font-size: 11px; color: var(--text-hint); }

.recharge-popup { padding: 24px 16px 32px; }
.recharge-popup h3 { text-align: center; margin: 0 0 16px; }
.recharge-actions { display: flex; gap: 10px; margin-top: 20px; }
</style>