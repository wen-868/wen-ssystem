<template>
  <view class="sales-reports-page">
    <page-header title="销售报表" @back="goBack" />

    <!-- 周期快捷选择（原稿：今日/本周/本月/本年） -->
    <view class="period-tabs">
      <view
        v-for="t in periodTabs"
        :key="t.value"
        class="period-tab"
        :class="{ 'period-tab--active': period === t.value }"
        @tap="onPeriodChange(t.value)"
      >{{ t.label }}</view>
    </view>

    <!-- 筛选表单：ref + :model + :rules -->
    <form ref="formRef" :model="filterForm" class="filter-form">
      <view class="filter-row">
        <picker mode="date" :value="filterForm.startDate" @change="onStartDateChange">
          <view class="filter-item">
            <text class="filter-label">开始日期</text>
            <text class="filter-value">{{ filterForm.startDate || '请选择' }}</text>
          </view>
        </picker>
        <picker mode="date" :value="filterForm.endDate" @change="onEndDateChange">
          <view class="filter-item">
            <text class="filter-label">结束日期</text>
            <text class="filter-value">{{ filterForm.endDate || '请选择' }}</text>
          </view>
        </picker>
      </view>
      <view class="filter-row">
        <view class="filter-item">
          <text class="filter-label">门店</text>
          <picker
            mode="selector"
            :range="storeOptions"
            range-key="name"
            @change="onStoreChange"
          >
            <view class="filter-picker">
              <text class="picker-text">{{ filterForm.storeName || '全部门店' }}</text>
              <image class="picker-arrow ic" src="/static/icons/ic/chevron-down.svg" mode="aspectFit"/>
            </view>
          </picker>
        </view>
        <view class="filter-item">
          <text class="filter-label">销售员</text>
          <picker
            mode="selector"
            :range="staffOptions"
            range-key="realName"
            @change="onSalesmanChange"
          >
            <view class="filter-picker">
              <text class="picker-text">{{ filterForm.salesmanName || '全部' }}</text>
              <image class="picker-arrow ic" src="/static/icons/ic/chevron-down.svg" mode="aspectFit"/>
            </view>
          </picker>
        </view>
      </view>
      <button class="query-btn" @tap="onQuery">查询</button>
    </form>

    <!-- 数据概览 -->
    <view class="summary-section">
      <view class="summary-card">
        <view class="summary-row">
          <view class="summary-item">
            <text class="summary-value">¥{{ summary.totalSales }}</text>
            <text class="summary-label">销售总额</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">{{ summary.orderCount }}</text>
            <text class="summary-label">订单数</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">{{ summary.itemCount }}</text>
            <text class="summary-label">商品件数</text>
          </view>
        </view>
        <view class="summary-row summary-row--second">
          <view class="summary-item">
            <text class="summary-value summary-value--profit">¥{{ summary.profit }}</text>
            <text class="summary-label">毛利润</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">¥{{ summary.avgPrice }}</text>
            <text class="summary-label">客单价</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">{{ summary.customerCount }}</text>
            <text class="summary-label">客户数</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 日销售趋势 -->
    <view class="chart-section">
      <view class="section-title">日销售趋势</view>
      <view class="chart-placeholder">
        <image class="chart-icon ic" src="/static/icons/ic/chart.svg" mode="aspectFit"/>
        <text class="chart-text">图表加载中...</text>
      </view>
    </view>

    <!-- 分类销售占比 -->
    <view class="category-section">
      <view class="section-title">分类销售占比</view>
      <view class="category-list">
        <view class="category-item" v-for="item in categoryList" :key="item.id">
          <view class="category-info">
            <text class="category-name">{{ item.name }}</text>
            <view class="category-bar-wrap">
              <view class="category-bar" :style="{ width: item.percent + '%' }"></view>
            </view>
          </view>
          <view class="category-data">
            <text class="category-amount">¥{{ item.amount }}</text>
            <text class="category-percent">{{ item.percent }}%</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 销售排行（原稿：销售排行 + Top 商品） -->
    <view class="rank-section">
      <view class="section-title">销售排行</view>
      <view class="rank-list">
        <view class="rank-item" v-for="(item, idx) in rankList" :key="item.id">
          <text class="rank-no" :class="idx < 3 ? 'rank-no--top' : 'rank-no--normal'">{{ idx + 1 }}</text>
          <view class="rank-info">
            <text class="rank-name">{{ item.name }}</text>
            <text class="rank-spec" v-if="item.spec">{{ item.spec }}</text>
          </view>
          <text class="rank-val">¥{{ item.salesAmount }}</text>
        </view>
      </view>
    </view>

    <!-- 导出按钮 -->
    <view class="export-section">
      <button class="export-btn" @tap="onExport">
        <image class="export-icon ic" src="/static/icons/ic/download.svg" mode="aspectFit"/>
        <text>导出报表</text>
      </button>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { reportsApi } from '@/api/modules/reports'
import { get } from '@/api/request'

const formRef = ref<any>(null)
const filterForm = reactive({
  startDate: '',
  endDate: '',
  storeId: '',
  storeName: '',
  salesmanId: '',
  salesmanName: '',
})
const filterRules: Rules = {
  startDate: [{ required: false }],
  endDate: [{ required: false }],
}
const { errors, validate, clearError } = useFormValidation(filterForm, filterRules)

// 周期快捷选择（原稿：今日/本周/本月/本年）
type PeriodKey = 'today' | 'week' | 'month' | 'year'
const period = ref<PeriodKey>('week')
const periodTabs = [
  { label: '今日', value: 'today' as PeriodKey },
  { label: '本周', value: 'week' as PeriodKey },
  { label: '本月', value: 'month' as PeriodKey },
  { label: '本年', value: 'year' as PeriodKey },
]
function fmtDate(dt: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`
}
function computePeriodDates(p: PeriodKey): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  let start: Date
  let end: Date
  if (p === 'today') {
    start = new Date(y, m, d, 0, 0, 0)
    end = new Date(y, m, d, 23, 59, 59)
  } else if (p === 'week') {
    const day = now.getDay() || 7
    start = new Date(y, m, d - day + 1, 0, 0, 0)
    end = new Date(y, m, d + (7 - day), 23, 59, 59)
  } else if (p === 'month') {
    start = new Date(y, m, 1, 0, 0, 0)
    end = new Date(y, m + 1, 0, 23, 59, 59)
  } else {
    start = new Date(y, 0, 1, 0, 0, 0)
    end = new Date(y, 11, 31, 23, 59, 59)
  }
  return { start: fmtDate(start), end: fmtDate(end) }
}
function onPeriodChange(p: PeriodKey) {
  period.value = p
  const { start, end } = computePeriodDates(p)
  filterForm.startDate = start
  filterForm.endDate = end
  loadReportData()
}

const storeOptions = ref<any[]>([])
const staffOptions = ref<any[]>([])

const summary = ref<any>({
  totalSales: '0.00',
  orderCount: 0,
  itemCount: 0,
  profit: '0.00',
  avgPrice: '0.00',
  customerCount: 0,
})

const categoryList = ref<any[]>([])
const rankList = ref<any[]>([])

function onStartDateChange(e: any) {
  filterForm.startDate = e?.detail?.value || ''
}
function onEndDateChange(e: any) {
  filterForm.endDate = e?.detail?.value || ''
}
function onStoreChange(e: any) {
  const idx = Number(e?.detail?.value ?? -1)
  if (idx >= 0 && storeOptions.value[idx]) {
    filterForm.storeId = String(storeOptions.value[idx].id)
    filterForm.storeName = storeOptions.value[idx].name
  }
}
function onSalesmanChange(e: any) {
  const idx = Number(e?.detail?.value ?? -1)
  if (idx >= 0 && staffOptions.value[idx]) {
    filterForm.salesmanId = String(staffOptions.value[idx].id)
    filterForm.salesmanName = staffOptions.value[idx].realName
  }
}

async function loadFilterOptions() {
  try {
    const [stores, staff] = await Promise.allSettled([
      get('/admin/system/stores'),
      get('/admin/staff', { page: 1, pageSize: 100 }),
    ])
    if (stores.status === 'fulfilled') {
      const list = (stores.value as any)?.records || (stores.value as any) || []
      storeOptions.value = list.map((s: any) => ({ id: s.id, name: s.name || s.storeName }))
    }
    if (staff.status === 'fulfilled') {
      const list = (staff.value as any)?.records || (staff.value as any) || []
      staffOptions.value = list.map((s: any) => ({ id: s.id, realName: s.realName || s.username }))
    }
  } catch { /* 加载失败保持空选项 */ }
}
async function onQuery() {
  await validate()
  loadReportData()
}
async function onExport() {
  uni.showModal({
    title: '导出报表',
    content: '确认导出当前筛选条件的销售报表？',
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '导出中...' })
      try {
        const result = await reportsApi.exportSalesReport({
          startDate: filterForm.startDate || undefined,
          endDate: filterForm.endDate || undefined,
          storeId: filterForm.storeId || undefined,
        })
        if (result.format === 'csv' && typeof result.data === 'string' && result.data) {
          saveCsv(result.data, `销售报表_${formatDate(new Date())}.csv`)
        } else {
          uni.showToast({ title: '暂无可导出的数据', icon: 'none' })
        }
      } catch (err) {
        console.error('导出销售报表失败:', err)
        uni.showToast({ title: '导出失败，请稍后重试', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    }
  })
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}${m}${d}`
}

function saveCsv(csv: string, fileName: string) {
  // H5 端：通过 Blob 触发浏览器下载
  // #ifdef H5
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
  uni.showToast({ title: '导出成功', icon: 'none' })
  // #endif
  // APP 原生端：写入应用文档目录并提示
  // #ifdef APP-PLUS
  const plusObj: any = (globalThis as any).plus
  if (plusObj?.io) {
    plusObj.io.requestFileSystem(plusObj.io.PRIVATE_DOC, (fs: any) => {
      fs.root.getFile(fileName, { create: true }, (entry: any) => {
        entry.createWriter(
          (writer: any) => {
            writer.onwrite = () => {
              uni.showToast({ title: '导出成功，已保存至应用文档目录', icon: 'none' })
            }
            writer.onerror = () => {
              uni.showToast({ title: '导出文件保存失败', icon: 'none' })
            }
            writer.write(csv)
          },
          () => uni.showToast({ title: '导出文件保存失败', icon: 'none' })
        )
      }, () => uni.showToast({ title: '导出文件保存失败', icon: 'none' }))
    }, () => uni.showToast({ title: '导出文件保存失败', icon: 'none' }))
  } else {
    uni.showToast({ title: '当前环境暂不支持导出', icon: 'none' })
  }
  // #endif
}

async function loadReportData() {
  try {
    const [summaryData, trendData, rankData] = await Promise.all([
      reportsApi.getSalesSummary({
        startDate: filterForm.startDate || undefined,
        endDate: filterForm.endDate || undefined,
        storeId: filterForm.storeId || undefined,
        salesmanId: filterForm.salesmanId || undefined
      }),
      reportsApi.getSalesTrend({
        granularity: 'day'
      }),
      reportsApi.getSalesRank({
        startDate: filterForm.startDate || undefined,
        endDate: filterForm.endDate || undefined,
        limit: 10
      })
    ])
    summary.value = {
      totalSales: summaryData.totalSales.toFixed(2),
      orderCount: summaryData.orderCount,
      itemCount: summaryData.itemCount,
      profit: summaryData.profit.toFixed(2),
      avgPrice: summaryData.avgPrice.toFixed(2),
      customerCount: summaryData.customerCount,
    }
    categoryList.value = trendData
    rankList.value = rankData
  } catch (err) {
    console.error('加载销售报表失败:', err)
  }
}

onMounted(() => {
  const { start, end } = computePeriodDates(period.value)
  filterForm.startDate = start
  filterForm.endDate = end
  loadReportData()
  loadFilterOptions()
})
</script>

<style lang="scss" scoped>
.sales-reports-page { min-height: 100vh; background: $uni-bg-color-page; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.filter-form {
  margin: $uni-spacing-sm $uni-spacing-base;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-md $uni-spacing-base;
  box-shadow: $uni-shadow-card-sm;
}
.filter-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $uni-spacing-base;
  padding: $uni-spacing-sm 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.filter-row:last-of-type { border-bottom: none; }
.filter-item {
  flex: 1;
  display: flex; flex-direction: column;
  gap: $uni-spacing-xs;
}
.filter-label { font-size: 22rpx; color: $uni-gray-400; }
.filter-value { font-size: 26rpx; color: $uni-gray-700; font-weight: 500; }
.filter-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.picker-text { font-size: 26rpx; color: $uni-gray-700; }
.picker-arrow { font-size: 22rpx; color: $uni-gray-400; }
.query-btn {
  width: 100%;
  height: 72rpx;
  background: $uni-gradient-blue;
  border-radius: 36rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  margin-top: 16rpx;
  border: none;
}
.query-btn::after { border: none; }
.summary-section { padding: 0 $uni-spacing-lg $uni-spacing-base; }
.summary-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  box-shadow: $uni-shadow-card-sm;
  position: relative;
  overflow: hidden;
}
.summary-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4rpx;
  background: $uni-color-primary;
}
.summary-row {
  display: flex;
  align-items: center;
  padding: $uni-spacing-xs 0;
}
.summary-row--second {
  border-top: 1rpx dashed $uni-gray-100;
  margin-top: $uni-spacing-sm;
  padding-top: $uni-spacing-base;
}
.summary-item {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center;
  gap: $uni-spacing-xs;
}
.summary-value { font-size: 32rpx; font-weight: 700; color: $uni-gray-700; }
.summary-value--profit { color: $uni-color-success; }
.summary-label { font-size: 22rpx; color: $uni-gray-400; }
.summary-divider {
  width: 1rpx; height: 48rpx;
  background: $uni-gray-100;
}
.chart-section { padding: 0 $uni-spacing-lg $uni-spacing-base; }
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-sm;
}
.chart-placeholder {
  background: $uni-bg-color;
  border-radius: 16rpx;
  height: 360rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.chart-icon { font-size: 64rpx; color: $uni-gray-300; }
.chart-text { font-size: 26rpx; color: $uni-gray-300; }
.category-section { padding: 0 $uni-spacing-lg $uni-spacing-base; }
.category-list {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-lg;
  box-shadow: $uni-shadow-card-sm;
}
.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $uni-spacing-base 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.category-item:last-child { border-bottom: none; }
.category-info {
  flex: 1;
  display: flex; flex-direction: column;
  gap: $uni-spacing-sm;
  margin-right: $uni-spacing-base;
}
.category-name { font-size: 26rpx; color: $uni-gray-700; font-weight: 500; }
.category-bar-wrap {
  height: 12rpx;
  background: $uni-bg-color-grey;
  border-radius: 6rpx;
  overflow: hidden;
}
.category-bar {
  height: 100%;
  background: $uni-gradient-blue;
  border-radius: 6rpx;
  min-width: 20rpx;
}
.category-data {
  display: flex; flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  flex-shrink: 0;
}
.category-amount { font-size: 26rpx; color: $uni-color-error; font-weight: 600; }
.category-percent { font-size: 22rpx; color: $uni-gray-400; }
.export-section { padding: 0 $uni-spacing-lg; }
.export-btn {
  width: 100%;
  height: 80rpx;
  background: $uni-bg-color;
  border-radius: 40rpx;
  font-size: 28rpx;
  color: $uni-color-primary;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  border: 2rpx solid $uni-color-primary;
}
.export-btn::after { border: none; }
.export-icon { font-size: 28rpx; }
.safe-bottom { height: 40rpx; }

/* 周期快捷选择（对齐原稿 rpt-period） */
.period-tabs {
  display: flex;
  margin: 16rpx 24rpx;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-pill;
  padding: 6rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.period-tab {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: $uni-border-radius-pill;
  font-size: 26rpx;
  font-weight: 500;
  color: $uni-gray-500;
}
.period-tab--active {
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
  font-weight: 600;
}

/* 销售排行（对齐原稿 rpt-rank） */
.rank-section { padding: 0 $uni-spacing-lg $uni-spacing-base; }
.rank-list {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-lg;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.rank-item {
  display: flex;
  align-items: center;
  gap: $uni-spacing-md;
  padding: $uni-spacing-base 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.rank-item:last-child { border-bottom: none; }
.rank-no {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  text-align: center;
  line-height: 40rpx;
  font-size: 24rpx;
  font-weight: 700;
  background: $uni-bg-color-soft;
  color: $uni-gray-500;
  flex-shrink: 0;
}
.rank-no--top {
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
}
.rank-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  overflow: hidden;
}
.rank-name {
  font-size: 26rpx;
  color: $uni-gray-700;
  font-weight: 500;
}
.rank-spec {
  font-size: 22rpx;
  color: $uni-gray-400;
}
.rank-val {
  font-size: 28rpx;
  font-weight: 700;
  color: $uni-text-color;
  font-family: 'SF Mono', 'Fira Code', monospace;
}
</style>
