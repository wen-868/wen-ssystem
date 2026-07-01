<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchAvailableCoupons,
  fetchActiveFlashSales,
  fetchActiveLimitedDiscounts,
  fetchMyPoints,
  type CouponTemplate,
  type FlashSaleItem,
  type FullReductionItem
} from '../api'

const router = useRouter()
const loading = ref(false)
const refreshing = ref(false)

/* 可用券数量 */
const couponCount = ref(0)
const activeFlashCount = ref(0)
const activeDiscountCount = ref(0)
const myPoints = ref(0)

/* 活动总数量（用于角标） */
const activeCount = ref(0)

/* Banner 轮播 */
const banners = ref<{ id: number; title: string; desc: string; color: string }[]>([
  { id: 1, title: '全场满200减30', desc: '限时优惠进行中', color: '#EF4444' },
  { id: 2, title: '限时折扣专区', desc: '精选商品低至5折', color: '#F97316' },
  { id: 3, title: '积分兑好礼', desc: '积分当钱花', color: '#F9CA24' }
])
const bannerIdx = ref(0)

function startBanner() {
  setInterval(() => {
    bannerIdx.value = (bannerIdx.value + 1) % banners.value.length
  }, 3000)
}

async function loadData() {
  loading.value = true
  try {
    const [couponRes, flashRes, discountRes, pointsRes] = await Promise.all([
      fetchAvailableCoupons().catch(() => ({ data: { records: [] } })),
      fetchActiveFlashSales().catch(() => ({ data: [] })),
      fetchActiveLimitedDiscounts().catch(() => ({ data: [] })),
      fetchMyPoints().catch(() => ({ data: { points: 0 } }))
    ])
    const coupons = (couponRes.data?.records ?? couponRes.data ?? []) as CouponTemplate[]
    const flashes = (flashRes.data?.records ?? flashRes.data ?? []) as FlashSaleItem[]
    const discounts = (discountRes.data?.records ?? discountRes.data ?? []) as FullReductionItem[]
    couponCount.value = coupons.length
    activeFlashCount.value = flashes.length
    activeDiscountCount.value = discounts.length
    myPoints.value = pointsRes.data?.points ?? 0
    activeCount.value = couponCount.value + activeFlashCount.value + activeDiscountCount.value
  } catch { /* ignore */ }
  finally { loading.value = false }
}

function onRefresh() {
  refreshing.value = true
  loadData().finally(() => { refreshing.value = false })
}

function navTo(path: string) {
  router.push(path)
}

onMounted(() => {
  loadData()
  startBanner()
})
</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">营销中心</h2>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-loading="loading">
        <!-- Banner 轮播 -->
        <div class="banner" @click="navTo('/marketing/coupons')">
          <div
            v-for="(b, i) in banners"
            :key="b.id"
            class="banner-item"
            :class="{ active: i === bannerIdx }"
            :style="{ background: b.color }"
          >
            <div class="banner-content">
              <div class="banner-title">{{ b.title }}</div>
              <div class="banner-desc">{{ b.desc }}</div>
            </div>
          </div>
          <div class="banner-dots">
            <span v-for="(b, i) in banners" :key="b.id" class="dot" :class="{ active: i === bannerIdx }"></span>
          </div>
        </div>

        <!-- 活动入口卡片 -->
        <div class="card-grid">
          <div class="entry-card" @click="navTo('/marketing/coupons')">
            <div class="entry-icon" style="background:#FFF7ED;">
              <van-icon name="coupon-o" color="#F97316" size="24" />
            </div>
            <div class="entry-info">
              <span class="entry-title">优惠券</span>
              <span class="entry-desc">领券享优惠</span>
            </div>
            <van-badge v-if="couponCount > 0" :content="couponCount" class="entry-badge" />
          </div>

          <div class="entry-card" @click="navTo('/marketing/limited-discount')">
            <div class="entry-icon" style="background:#FEF2F2;">
              <van-icon name="clock-o" color="#EF4444" size="24" />
            </div>
            <div class="entry-info">
              <span class="entry-title">限时折扣</span>
              <span class="entry-desc">限时特价抢购</span>
            </div>
            <van-badge v-if="activeDiscountCount > 0" :content="activeDiscountCount" class="entry-badge" />
          </div>

          <div class="entry-card" @click="navTo('/marketing/points-mall')">
            <div class="entry-icon" style="background:#FFFDE7;">
              <van-icon name="gold-coin-o" color="#F9CA24" size="24" />
            </div>
            <div class="entry-info">
              <span class="entry-title">积分商城</span>
              <span class="entry-desc">积分兑好礼</span>
            </div>
            <span class="entry-badge-points">{{ myPoints }}积分</span>
          </div>

          <div class="entry-card disabled">
            <div class="entry-icon" style="background:#F3F4F6;">
              <van-icon name="flash" color="#9CA3AF" size="24" />
            </div>
            <div class="entry-info">
              <span class="entry-title">秒杀</span>
              <span class="entry-desc">即将上线</span>
            </div>
            <van-tag type="default" plain size="medium" class="entry-tag">即将上线</van-tag>
          </div>
        </div>

        <!-- 活动数据 -->
        <div class="section-header">
          <van-icon name="chart-trending-o" size="16" color="var(--color-primary)" />
          <span>活动数据</span>
        </div>
        <div class="stat-grid">
          <div class="stat-card">
            <span class="stat-label">进行中活动</span>
            <span class="stat-value">{{ activeCount }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">可领优惠券</span>
            <span class="stat-value">{{ couponCount }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">限时折扣</span>
            <span class="stat-value">{{ activeDiscountCount }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">我的积分</span>
            <span class="stat-value">{{ myPoints }}</span>
          </div>
        </div>
      </div>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page { padding: 0 4px 60px; }
.page-header { padding: 12px 0 8px; }
.page-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--text-primary); }

/* Banner */
.banner { position: relative; height: 120px; border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
.banner-item { position: absolute; inset: 0; display: flex; align-items: center; padding: 20px; opacity: 0; transition: opacity 0.5s; }
.banner-item.active { opacity: 1; }
.banner-content { color: #fff; }
.banner-title { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
.banner-desc { font-size: 13px; opacity: 0.9; }
.banner-dots { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.4); }
.dot.active { background: #fff; }

/* 入口卡片 */
.card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
.entry-card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; background: var(--bg-card); border-radius: 12px; padding: 20px 12px 16px; box-shadow: var(--shadow-card); cursor: pointer; }
.entry-card.disabled { opacity: 0.5; cursor: not-allowed; }
.entry-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.entry-info { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.entry-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.entry-desc { font-size: 11px; color: var(--text-muted); }
.entry-badge { position: absolute; top: 10px; right: 10px; }
.entry-badge-points { position: absolute; top: 10px; right: 10px; font-size: 10px; color: #F9CA24; font-weight: 600; }
.entry-tag { position: absolute; top: 8px; right: 8px; }

/* 统计 */
.section-header { display: flex; align-items: center; gap: 6px; padding: 8px 0; font-size: 15px; font-weight: 600; color: var(--text-primary); }
.stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.stat-card { background: var(--bg-card); border-radius: 10px; padding: 12px 14px; box-shadow: var(--shadow-card); display: flex; flex-direction: column; gap: 4px; }
.stat-label { font-size: 12px; color: var(--text-secondary); }
.stat-value { font-size: 20px; font-weight: 700; color: var(--color-primary); }
</style>