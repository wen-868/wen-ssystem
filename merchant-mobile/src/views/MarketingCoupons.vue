<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  fetchAvailableCoupons,
  fetchMyCoupons,
  fetchCouponStatistics,
  claimCoupon,
  type CouponTemplate,
  type UserCoupon,
  type CouponStatistics
} from '../api'
import CouponCard from '../components/CouponCard.vue'

const router = useRouter()
const loading = ref(false)
const refreshing = ref(false)

/* Tab */
const activeTab = ref('available')
const tabs = [
  { label: '可用券', value: 'available' },
  { label: '领取中心', value: 'claim' },
  { label: '我的券包', value: 'my' }
]

/* 我的券状态筛选 */
const myStatusFilter = ref('')
const myStatusOptions = [
  { label: '全部', value: '' },
  { label: '未使用', value: 'AVAILABLE' },
  { label: '已使用', value: 'USED' },
  { label: '已过期', value: 'EXPIRED' }
]

/* 可用券 */
const availableCoupons = ref<CouponTemplate[]>([])
/* 统计 */
const statistics = ref<CouponStatistics | null>(null)
/* 我的券 */
const myCoupons = ref<UserCoupon[]>([])
const myPage = ref(1)
const myFinished = ref(false)

async function loadAvailable() {
  loading.value = true
  try {
    const [couponRes, statsRes] = await Promise.all([
      fetchAvailableCoupons().catch(() => ({ data: { records: [] } })),
      fetchCouponStatistics().catch(() => ({ data: null }))
    ])
    availableCoupons.value = couponRes.data?.records ?? couponRes.data ?? []
    statistics.value = statsRes.data
  } catch { /* ignore */ }
  finally { loading.value = false }
}

async function loadMy() {
  try {
    const res = await fetchMyCoupons({ page: myPage.value, pageSize: 20, status: myStatusFilter.value || undefined })
    const records = (res.data?.records ?? res.data ?? []) as UserCoupon[]
    if (myPage.value === 1) myCoupons.value = records
    else myCoupons.value = [...myCoupons.value, ...records]
    myFinished.value = records.length < 20
  } catch { /* ignore */ }
}

async function onClaim(templateId: number) {
  try {
    await claimCoupon(templateId)
    showToast('领取成功')
    // 更新状态
    const idx = availableCoupons.value.findIndex(c => c.id === templateId)
    if (idx >= 0) {
      availableCoupons.value[idx].claimedCount++
    }
    loadMy()
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || '领取失败'
    showToast(msg)
  }
}

function onRefresh() {
  refreshing.value = true
  myPage.value = 1
  Promise.all([loadAvailable(), loadMy()]).finally(() => { refreshing.value = false })
}

function onLoadMore() {
  myPage.value++
  loadMy()
}

function onTabChange() {
  if (activeTab.value === 'available') loadAvailable()
  else if (activeTab.value === 'my') { myPage.value = 1; loadMy() }
}

onMounted(() => {
  loadAvailable()
})
</script>

<template>
  <section class="page">
    <van-nav-bar title="优惠券" left-arrow @click-left="router.back()" />

    <!-- 统计卡片 -->
    <div v-if="statistics" class="stats-row">
      <div class="stats-item">
        <span class="stats-value">{{ statistics.overall.totalIssued }}</span>
        <span class="stats-label">总发放</span>
      </div>
      <div class="stats-item">
        <span class="stats-value">{{ statistics.overall.totalClaimed }}</span>
        <span class="stats-label">已领取</span>
      </div>
      <div class="stats-item">
        <span class="stats-value">{{ statistics.overall.totalUsed }}</span>
        <span class="stats-label">已使用</span>
      </div>
      <div class="stats-item">
        <span class="stats-value">{{ statistics.overall.useRate }}</span>
        <span class="stats-label">使用率</span>
      </div>
    </div>

    <!-- Tab 切换 -->
    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab v-for="t in tabs" :key="t.value" :title="t.label" :name="t.value" />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-loading="loading">
        <!-- 可用券 -->
        <template v-if="activeTab === 'available'">
          <div v-if="availableCoupons.length === 0" class="empty-hint">
            <van-icon name="coupon-o" size="40" color="var(--text-muted)" />
            <span>暂无可用优惠券</span>
          </div>
          <CouponCard
            v-for="c in availableCoupons"
            :key="c.id"
            :id="c.id"
            :name="c.name"
            :type="c.type"
            :value="c.value"
            :min-amount="c.minAmount"
            :max-discount="c.maxDiscount"
            :start-time="c.startTime"
            :end-time="c.endTime"
            :description="c.description"
            :claimed-count="c.claimedCount"
            :total-count="c.totalCount"
            :applicable-scope="c.applicableScope"
            :disabled="c.totalCount > 0 && c.claimedCount >= c.totalCount"
            @claim="onClaim"
          />
        </template>

        <!-- 领取中心（同可用券） -->
        <template v-if="activeTab === 'claim'">
          <div v-if="availableCoupons.length === 0" class="empty-hint">
            <van-icon name="coupon-o" size="40" color="var(--text-muted)" />
            <span>暂无可领取优惠券</span>
          </div>
          <CouponCard
            v-for="c in availableCoupons"
            :key="c.id"
            :id="c.id"
            :name="c.name"
            :type="c.type"
            :value="c.value"
            :min-amount="c.minAmount"
            :max-discount="c.maxDiscount"
            :start-time="c.startTime"
            :end-time="c.endTime"
            :description="c.description"
            :claimed-count="c.claimedCount"
            :total-count="c.totalCount"
            :applicable-scope="c.applicableScope"
            :disabled="c.totalCount > 0 && c.claimedCount >= c.totalCount"
            @claim="onClaim"
          />
        </template>

        <!-- 我的券包 -->
        <template v-if="activeTab === 'my'">
          <div class="filter-row">
            <span
              v-for="o in myStatusOptions"
              :key="o.value"
              class="filter-chip"
              :class="{ active: myStatusFilter === o.value }"
              @click="myStatusFilter = o.value; myPage = 1; loadMy()"
            >{{ o.label }}</span>
          </div>
          <div v-if="myCoupons.length === 0" class="empty-hint">
            <van-icon name="coupon-o" size="40" color="var(--text-muted)" />
            <span>暂无优惠券</span>
          </div>
          <CouponCard
            v-for="c in myCoupons"
            :key="c.id"
            :id="c.templateId"
            :name="c.templateName"
            :type="c.couponType"
            :value="c.couponValue"
            :min-amount="c.minAmount"
            :max-discount="c.maxDiscount"
            :start-time="c.claimedAt"
            :end-time="c.expiresAt"
            :description="c.description"
            :claimed-count="0"
            :total-count="0"
            :applicable-scope="c.applicableScope"
            :status="c.status"
            :claimed="true"
            @claim="onClaim"
          />
          <div v-if="!myFinished" class="load-more" @click="onLoadMore">加载更多</div>
        </template>
      </div>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page { padding: 0 4px; }

.stats-row { display: flex; gap: 8px; padding: 12px 8px; background: var(--bg-card); border-radius: 10px; margin: 8px 0; box-shadow: var(--shadow-card); }
.stats-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.stats-value { font-size: 16px; font-weight: 700; color: var(--color-primary); }
.stats-label { font-size: 11px; color: var(--text-muted); }

.filter-row { display: flex; gap: 8px; padding: 8px 0; }
.filter-chip { padding: 4px 12px; border-radius: 16px; font-size: 13px; color: var(--text-secondary); background: var(--bg-soft); cursor: pointer; }
.filter-chip.active { background: var(--color-primary); color: #fff; }

.empty-hint { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0; gap: 8px; font-size: 13px; color: var(--text-muted); }

.load-more { text-align: center; padding: 12px; font-size: 13px; color: var(--color-primary); cursor: pointer; }
</style>