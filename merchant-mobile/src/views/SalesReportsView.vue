<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchSalesTrend, fetchProductRanking, fetchSalesRanking } from '../api'

const router = useRouter()

/* ========== 日期范围 ========== */
const showDatePicker = ref(false)
const dateRange = ref<[string, string]>(['', ''])
const tempDateRange = ref<[string, string]>(['', ''])

function formatDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDefaultRange(): [string, string] {
  const now = new Date()
  const ago = new Date(now)
  ago.setDate(ago.getDate() - 7)
  return [formatDateParam(ago), formatDateParam(now)]
}

function getMonthRange(): [string, string] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return [formatDateParam(start), formatDateParam(now)]
}

function onDateConfirm(values: [Date, Date]) {
  tempDateRange.value = [formatDateParam(values[0]), formatDateParam(values[1])]
}

function applyDateRange() {
  dateRange.value = tempDateRange.value
  showDatePicker.value = false
  loadAll()
}

const rangeLabel = computed(() => {
  if (!dateRange.value[0]) return '近7天'
  return `${dateRange.value[0]} ~ ${dateRange.value[1]}`
})

/* ========== 汇总卡片 ========== */
const summary = ref({
  todaySales: 0,
  monthSales: 0,
  orderCount: 0,
  avgOrderValue: 0
})

/* ========== 排行榜 ========== */
const activeRankTab = ref(0)
const productRank = ref<any[]>([])
const staffRank = ref<any[]>([])

/* ========== 每日趋势 ========== */
const dailyTrend = ref<any[]>([])
const maxDailyAmount = ref(0)

async function loadAll() {
  const [start, end] = dateRange.value[0] ? dateRange.value : getDefaultRange()
  const params = { startDate: start, endDate: end }

  try {
    const [trendRes, rankingRes, staffRes] = await Promise.all([
      fetchSalesTrend({ startDate: start, endDate: end }).catch(() => ({ data: null })),
      fetchProductRanking(params).catch(() => ({ data: null })),
      fetchSalesRanking(params).catch(() => ({ data: null }))
    ])

    // 趋势数据
    const trendData = trendRes.data as any
    dailyTrend.value = (trendData?.dailyTrend ?? trendData?.trend ?? []).slice(-7)
    if (dailyTrend.value.length > 0) {
      maxDailyAmount.value = Math.max(...dailyTrend.value.map((d: any) => d.amount ?? d.salesAmount ?? 0), 1)
    }

    // 汇总数据
    summary.value = {
      todaySales: trendData?.todaySales ?? 0,
      monthSales: trendData?.monthSales ?? 0,
      orderCount: trendData?.orderCount ?? trendData?.totalOrders ?? 0,
      avgOrderValue: trendData?.avgOrderValue ?? 0
    }

    // 商品排行
    const ranking = rankingRes.data as any
    if (ranking) {
      productRank.value = (ranking.products ?? ranking.records ?? []).slice(0, 10)
    }

    // 人员排名
    const staff = staffRes.data as any
    if (staff) {
      staffRank.value = (staff.records ?? staff.customers ?? []).slice(0, 10)
    }
  } catch {
    // 静默处理
  }
}

function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

function formatNumber(n: number | null | undefined): string {
  return n != null ? String(n) : '0'
}

onMounted(() => {
  loadAll()
})
</script>

<template>
  <section class="page">
    <div class="page-header">
      <van-icon name="arrow-left" size="20" @click="router.back()" />
      <h2 class="page-title">销售报表</h2>
      <span style="width: 20px;"></span>
    </div>

    <!-- 日期选择 -->
    <div class="date-selector" @click="showDatePicker = true">
      <van-icon name="calendar-o" size="16" />
      <span class="date-label">{{ rangeLabel }}</span>
      <van-icon name="arrow-down" size="12" />
    </div>
    <van-calendar
      v-model:show="showDatePicker"
      type="range"
      :min-date="new Date(2024, 0, 1)"
      :max-date="new Date()"
      @confirm="onDateConfirm"
    >
      <template #footer>
        <div class="cal-footer">
          <van-button size="small" @click="showDatePicker = false">取消</van-button>
          <van-button size="small" type="primary" @click="applyDateRange">确定</van-button>
        </div>
      </template>
    </van-calendar>

    <!-- 汇总卡片 -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-value">¥{{ formatPrice(summary.todaySales) }}</div>
        <div class="summary-label">今日销售额</div>
      </div>
      <div class="summary-card summary-card--green">
        <div class="summary-value">¥{{ formatPrice(summary.monthSales) }}</div>
        <div class="summary-label">本月销售额</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ formatNumber(summary.orderCount) }}</div>
        <div class="summary-label">订单数</div>
      </div>
      <div class="summary-card summary-card--orange">
        <div class="summary-value">¥{{ formatPrice(summary.avgOrderValue) }}</div>
        <div class="summary-label">客单价</div>
      </div>
    </div>

    <!-- 每日趋势（CSS柱状图） -->
    <div class="section-card">
      <h3 class="section-title">每日趋势</h3>
      <div v-if="dailyTrend.length > 0" class="bar-chart">
        <div v-for="item in dailyTrend" :key="item.date" class="bar-column">
          <div class="bar-value">{{ formatPrice(item.amount ?? item.salesAmount) }}</div>
          <div
            class="bar-fill"
            :style="{ height: `${((item.amount ?? item.salesAmount ?? 0) / maxDailyAmount) * 100}%` }"
          />
          <div class="bar-label">{{ (item.date ?? '').slice(-5) }}</div>
        </div>
      </div>
      <van-empty v-else description="暂无数据" />
    </div>

    <!-- 排行榜 Tabs -->
    <div class="section-card">
      <van-tabs v-model:active="activeRankTab" type="card">
        <van-tab title="商品排行">
          <div class="rank-list">
            <div v-for="(item, idx) in productRank" :key="item.skuId ?? item.productId ?? idx" class="rank-item">
              <span class="rank-num" :class="{ 'rank-top': idx < 3 }">{{ idx + 1 }}</span>
              <div class="rank-info">
                <div class="rank-name">{{ item.skuName ?? item.productName ?? item.name }}</div>
                <div class="rank-meta">
                  <span>销量 {{ formatNumber(item.qty ?? item.quantity ?? item.salesQty) }}</span>
                  <span>金额 ¥{{ formatPrice(item.amount ?? item.salesAmount) }}</span>
                </div>
              </div>
            </div>
            <van-empty v-if="productRank.length === 0" description="暂无数据" />
          </div>
        </van-tab>
        <van-tab title="人员排名">
          <div class="rank-list">
            <div v-for="(item, idx) in staffRank" :key="item.staffId ?? item.memberId ?? idx" class="rank-item">
              <span class="rank-num" :class="{ 'rank-top': idx < 3 }">{{ idx + 1 }}</span>
              <div class="rank-info">
                <div class="rank-name">{{ item.staffName ?? item.name }}</div>
                <div class="rank-meta">
                  <span>订单 {{ formatNumber(item.orderCount ?? item.orders) }}</span>
                  <span>金额 ¥{{ formatPrice(item.amount ?? item.totalAmount) }}</span>
                </div>
              </div>
            </div>
            <van-empty v-if="staffRank.length === 0" description="暂无数据" />
          </div>
        </van-tab>
      </van-tabs>
    </div>
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

/* ===== 日期选择器 ===== */
.date-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  margin-bottom: 12px;
  background: var(--bg-card);
  border-radius: 20px;
  cursor: pointer;
  border: 1px solid var(--border-normal);
  width: fit-content;
}

.date-label {
  font-size: 13px;
  color: var(--text-primary);
}

.cal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px;
}

/* ===== 汇总卡片 ===== */
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.summary-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 14px;
  box-shadow: var(--shadow-card);
  text-align: center;
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
}

.summary-card--green .summary-value {
  color: var(--color-success);
}

.summary-card--orange .summary-value {
  color: var(--color-warning);
}

.summary-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* ===== 通用区块 ===== */
.section-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
}

.section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ===== CSS柱状图 ===== */
.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 160px;
  padding: 8px 0;
}

.bar-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
  justify-content: flex-end;
}

.bar-value {
  font-size: 10px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.bar-fill {
  width: 20px;
  max-width: 36px;
  background: linear-gradient(to top, var(--color-primary), var(--color-primary-soft));
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: height 0.3s;
}

.bar-label {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 6px;
}

/* ===== 排行榜 ===== */
.rank-list {
  padding: 8px 0;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-normal);
}

.rank-item:last-child {
  border-bottom: none;
}

.rank-num {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.rank-num.rank-top {
  background: var(--color-primary);
  color: #fff;
}

.rank-info {
  flex: 1;
  min-width: 0;
}

.rank-name {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}
</style>