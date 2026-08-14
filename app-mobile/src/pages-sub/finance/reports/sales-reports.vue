<template>
  <view class="sales-reports-page">
    <view class="page-header">
      <text class="header-title">销售报表</text>
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
              <text class="picker-arrow">&#xe612;</text>
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
              <text class="picker-arrow">&#xe612;</text>
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
        <text class="chart-icon">&#xe627;</text>
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

    <!-- 导出按钮 -->
    <view class="export-section">
      <button class="export-btn" @tap="onExport">
        <text class="export-icon">&#xe618;</text>
        <text>导出报表</text>
      </button>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
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
  loadReportData()
  loadFilterOptions()
})
</script>

<style lang="scss" scoped>
.sales-reports-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.filter-form {
  margin: 16rpx 24rpx;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.filter-row {
  display: flex;
  gap: 24rpx;
  padding: 12rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.filter-row:last-of-type { border-bottom: none; }
.filter-item {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 8rpx;
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
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 36rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  margin-top: 16rpx;
  border: none;
}
.query-btn::after { border: none; }
.summary-section { padding: 0 24rpx 24rpx; }
.summary-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.summary-row {
  display: flex;
  align-items: center;
  padding: 8rpx 0;
}
.summary-row--second {
  border-top: 1rpx dashed $uni-gray-100;
  margin-top: 16rpx;
  padding-top: 24rpx;
}
.summary-item {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.summary-value { font-size: 32rpx; font-weight: 700; color: $uni-gray-700; }
.summary-value--profit { color: $uni-color-success; }
.summary-label { font-size: 22rpx; color: $uni-gray-400; }
.summary-divider {
  width: 1rpx; height: 48rpx;
  background: $uni-gray-100;
}
.chart-section { padding: 0 24rpx 24rpx; }
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: 16rpx;
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
.category-section { padding: 0 24rpx 24rpx; }
.category-list {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.category-item:last-child { border-bottom: none; }
.category-info {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 12rpx;
  margin-right: 24rpx;
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
  background: linear-gradient(90deg, $uni-color-primary, $uni-color-primary);
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
.export-section { padding: 0 24rpx; }
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
</style>
