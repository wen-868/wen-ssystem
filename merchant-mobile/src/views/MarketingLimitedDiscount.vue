<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchActiveLimitedDiscounts,
  fetchActiveFlashSales,
  type FullReductionItem,
  type FlashSaleItem
} from '../api'
import CountdownTimer from '../components/CountdownTimer.vue'
import DiscountProductCard from '../components/DiscountProductCard.vue'

const router = useRouter()
const loading = ref(false)
const refreshing = ref(false)

const activeTab = ref('discount')
const tabs = [
  { label: '限时折扣', value: 'discount' },
  { label: '秒杀', value: 'seckill' }
]

const discounts = ref<FullReductionItem[]>([])
const flashSales = ref<FlashSaleItem[]>([])

/* 最近结束的活动时间 */
const nearestEndTime = ref('')

async function loadData() {
  loading.value = true
  try {
    const [discountRes, flashRes] = await Promise.all([
      fetchActiveLimitedDiscounts().catch(() => ({ data: [] })),
      fetchActiveFlashSales().catch(() => ({ data: [] }))
    ])
    discounts.value = (discountRes.data?.records ?? discountRes.data ?? []) as FullReductionItem[]
    flashSales.value = (flashRes.data?.records ?? flashRes.data ?? []) as FlashSaleItem[]

    // 找最近的结束时间
    const allEndTimes = [
      ...discounts.value.map(d => d.endTime),
      ...flashSales.value.map(f => f.endTime)
    ].filter(Boolean)
    if (allEndTimes.length > 0) {
      nearestEndTime.value = allEndTimes.sort()[0]
    }
  } catch { /* ignore */ }
  finally { loading.value = false }
}

function onRefresh() {
  refreshing.value = true
  loadData().finally(() => { refreshing.value = false })
}

function onProductClick(id: number) {
  router.push(`/products/${id}`)
}

function onTabChange() {
  loadData()
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <section class="page">
    <van-nav-bar title="限时折扣" left-arrow @click-left="router.back()" />

    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab v-for="t in tabs" :key="t.value" :title="t.label" :name="t.value" />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-loading="loading">
        <!-- 限时折扣 -->
        <template v-if="activeTab === 'discount'">
          <!-- 倒计时 Banner -->
          <div v-if="nearestEndTime" class="countdown-banner">
            <div class="countdown-label">距活动结束</div>
            <CountdownTimer :end-time="nearestEndTime" @timeup="loadData" />
          </div>

          <div v-if="discounts.length === 0" class="empty-hint">
            <van-icon name="clock-o" size="40" color="var(--text-muted)" />
            <span>暂无进行中的限时折扣活动</span>
          </div>

          <div v-else class="product-grid">
            <DiscountProductCard
              v-for="d in discounts"
              :key="d.id"
              :id="d.id"
              :product-name="d.name"
              :product-image="''"
              :discount-price="d.minAmount - (d.reduceAmount || 0)"
              :original-price="d.minAmount"
              :sold-count="0"
              :total-stock="100"
              :end-time="d.endTime"
              @click="onProductClick"
            />
          </div>
        </template>

        <!-- 秒杀（占位） -->
        <template v-if="activeTab === 'seckill'">
          <div class="empty-hint">
            <van-icon name="flash" size="48" color="var(--text-muted)" />
            <span class="empty-title">秒杀功能即将上线</span>
            <span class="empty-desc">敬请期待</span>
          </div>
        </template>
      </div>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page { padding: 0 4px; }

.countdown-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #EF4444, #F97316);
  border-radius: 12px;
  padding: 16px;
  margin: 8px 0;
  color: #fff;
}
.countdown-label { font-size: 13px; opacity: 0.9; }

.product-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }

.empty-hint { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 0; gap: 8px; font-size: 13px; color: var(--text-muted); }
.empty-title { font-size: 15px; font-weight: 500; color: var(--text-secondary); }
.empty-desc { font-size: 12px; color: var(--text-muted); }
</style>