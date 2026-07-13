<template>
  <view class="reports-page">
    <view class="page-header">
      <text class="header-title">数据报表</text>
    </view>

    <form ref="formRef" :model="filterForm" class="filter-form">
      <view class="filter-row">
        <view class="filter-item" @tap="chooseStartDate">
          <text class="filter-label">开始日期</text>
          <text class="filter-value">{{ filterForm.startDate || '请选择' }}</text>
        </view>
        <view class="filter-item" @tap="chooseEndDate">
          <text class="filter-label">结束日期</text>
          <text class="filter-value">{{ filterForm.endDate || '请选择' }}</text>
        </view>
      </view>
      <picker mode="date" :value="filterForm.startDate" @change="onStartDateChange" :id="'start-date-picker'" style="display:none;">
        <view></view>
      </picker>
      <picker mode="date" :value="filterForm.endDate" @change="onEndDateChange" :id="'end-date-picker'" style="display:none;">
        <view></view>
      </picker>
    </form>

    <view class="quick-date-bar">
      <view
        v-for="item in quickDates"
        :key="item.value"
        class="quick-date-item"
        :class="{ 'quick-date-item--active': activeQuickDate === item.value }"
        @tap="chooseQuickDate(item.value)"
      >
        <text class="quick-date-text">{{ item.label }}</text>
      </view>
    </view>

    <view class="stats-section">
      <view class="section-title">核心数据</view>
      <view class="stats-grid">
        <view class="stats-card stats-card--primary">
          <text class="stats-value">¥{{ summary.totalSales }}</text>
          <text class="stats-label">销售总额</text>
          <text class="stats-trend stats-trend--up" v-if="summary.salesGrowth > 0">
            ↑ {{ summary.salesGrowth }}%
          </text>
        </view>
        <view class="stats-card">
          <text class="stats-value">{{ summary.orderCount }}</text>
          <text class="stats-label">订单数</text>
        </view>
        <view class="stats-card">
          <text class="stats-value">{{ summary.customerCount }}</text>
          <text class="stats-label">客户数</text>
        </view>
        <view class="stats-card">
          <text class="stats-value">¥{{ summary.profit }}</text>
          <text class="stats-label">毛利润</text>
        </view>
      </view>
    </view>

    <view class="report-entries">
      <view class="section-title">报表分类</view>
      <view class="entries-grid">
        <view class="entry-card" @tap="goReport('sales')">
          <view class="entry-icon entry-icon--sales">&#xe620;</view>
          <text class="entry-title">销售报表</text>
          <text class="entry-desc">销售额、订单、客单价</text>
        </view>
        <view class="entry-card" @tap="goReport('inventory')">
          <view class="entry-icon entry-icon--inventory">&#xe621;</view>
          <text class="entry-title">库存报表</text>
          <text class="entry-desc">库存周转、出入库明细</text>
        </view>
        <view class="entry-card" @tap="goReport('purchase')">
          <view class="entry-icon entry-icon--purchase">&#xe617;</view>
          <text class="entry-title">采购报表</text>
          <text class="entry-desc">采购金额、供应商分析</text>
        </view>
        <view class="entry-card" @tap="goReport('customer')">
          <view class="entry-icon entry-icon--customer">&#xe616;</view>
          <text class="entry-title">客户报表</text>
          <text class="entry-desc">客户消费、等级分布</text>
        </view>
        <view class="entry-card" @tap="goReport('finance')">
          <view class="entry-icon entry-icon--finance">&#xe618;</view>
          <text class="entry-title">财务报表</text>
          <text class="entry-desc">收支统计、利润分析</text>
        </view>
      </view>
    </view>

    <view class="rank-section">
      <view class="section-title">
        <text>商品销售排行</text>
        <text class="title-more" @tap="goReport('sales')">查看全部</text>
      </view>
      <view class="rank-list">
        <view class="rank-item" v-for="(item, idx) in rankList" :key="item.id">
          <view class="rank-num" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</view>
          <image class="rank-img" :src="item.image" mode="aspectFill" />
          <view class="rank-info">
            <text class="rank-name">{{ item.name }}</text>
            <text class="rank-spec">{{ item.spec }}</text>
          </view>
          <view class="rank-data">
            <text class="rank-sales">¥{{ item.salesAmount }}</text>
            <text class="rank-qty">{{ item.soldQty }}件</text>
          </view>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

const formRef = ref<any>(null)
const filterForm = reactive({
  startDate: '',
  endDate: '',
})
const filterRules: Rules = {
  startDate: [{ required: false }],
  endDate: [{ required: false }],
}
const { errors, validate, clearError } = useFormValidation(filterForm, filterRules)

const quickDates = [
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '全年', value: 'year' },
]
const activeQuickDate = ref('month')

const summary = ref<any>({
  totalSales: '0.00',
  orderCount: 0,
  customerCount: 0,
  profit: '0.00',
  salesGrowth: 0,
})

const rankList = ref<any[]>([])

function chooseStartDate() {
  const picker = document.getElementById('start-date-picker') as any
  if (picker) picker.click()
}
function chooseEndDate() {
  const picker = document.getElementById('end-date-picker') as any
  if (picker) picker.click()
}
function onStartDateChange(e: any) {
  filterForm.startDate = e.detail.value
  activeQuickDate.value = ''
  loadReportData()
}
function onEndDateChange(e: any) {
  filterForm.endDate = e.detail.value
  activeQuickDate.value = ''
  loadReportData()
}
function chooseQuickDate(val: string) {
  activeQuickDate.value = val
  loadReportData()
}
function goReport(type: string) {
  const urlMap: Record<string, string> = {
    sales: '/pages/reports/sales-reports',
    inventory: '/pages/reports/inventory-reports',
    purchase: '/pages/reports/purchase-reports',
    customer: '/pages/reports/customer-reports',
    finance: '/pages/reports/finance-reports',
  }
  const url = urlMap[type]
  if (url) {
    uni.navigateTo({ url })
  }
}

async function loadReportData() {
  try {
    rankList.value = []
  } catch (err) {
    console.error('加载报表数据失败:', err)
  }
}

onMounted(() => { loadReportData() })
</script>

<style scoped>
.reports-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: linear-gradient(135deg, #1677FF, #4096ff);
}
.header-title { font-size: 34rpx; font-weight: 700; color: #fff; }
.filter-form {
  margin: 16rpx 24rpx 0;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.filter-row { display: flex; gap: 24rpx; }
.filter-item {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 8rpx;
  padding: 12rpx 0;
}
.filter-label { font-size: 22rpx; color: #999; }
.filter-value { font-size: 26rpx; color: #333; font-weight: 500; }
.quick-date-bar {
  display: flex;
  margin: 16rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 8rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.quick-date-item {
  flex: 1;
  height: 60rpx;
  display: flex; align-items: center; justify-content: center;
  border-radius: 12rpx;
}
.quick-date-item--active { background: #1677FF; }
.quick-date-item--active .quick-date-text { color: #fff; font-weight: 600; }
.quick-date-text { font-size: 24rpx; color: #666; }
.stats-section { padding: 24rpx; }
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title-more { font-size: 24rpx; color: #1677FF; font-weight: 400; }
.stats-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.stats-card {
  width: calc(50% - 8rpx);
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.stats-card--primary {
  background: linear-gradient(135deg, #ff6b6b, #ff8e53);
}
.stats-card--primary .stats-value,
.stats-card--primary .stats-label { color: #fff; }
.stats-card--primary .stats-trend { color: rgba(255,255,255,0.85); }
.stats-value { font-size: 36rpx; font-weight: 700; color: #333; }
.stats-label { font-size: 22rpx; color: #999; }
.stats-trend { font-size: 20rpx; margin-top: 4rpx; }
.stats-trend--up { color: #52c41a; }
.report-entries { padding: 0 24rpx 24rpx; }
.entries-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.entry-card {
  width: calc(50% - 8rpx);
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.entry-icon {
  width: 64rpx; height: 64rpx;
  border-radius: 16rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; color: #fff;
  margin-bottom: 8rpx;
}
.entry-icon--sales { background: linear-gradient(135deg, #ff6b6b, #ff8e53); }
.entry-icon--inventory { background: linear-gradient(135deg, #1677FF, #4096ff); }
.entry-icon--purchase { background: linear-gradient(135deg, #52c41a, #73d13d); }
.entry-icon--customer { background: linear-gradient(135deg, #722ed1, #9254de); }
.entry-icon--finance { background: linear-gradient(135deg, #fa8c16, #ffa940); }
.entry-title { font-size: 28rpx; color: #333; font-weight: 600; }
.entry-desc { font-size: 22rpx; color: #999; }
.rank-section { padding: 0 24rpx 24rpx; }
.rank-list {
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.rank-item:last-child { border-bottom: none; }
.rank-num {
  width: 40rpx; height: 40rpx;
  border-radius: 20rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 22rpx;
  font-weight: 600;
  background: #f5f5f5;
  color: #999;
  flex-shrink: 0;
}
.rank-1 { background: #ff6b6b; color: #fff; }
.rank-2 { background: #ffa940; color: #fff; }
.rank-3 { background: #ffd666; color: #fff; }
.rank-img {
  width: 72rpx; height: 72rpx;
  border-radius: 8rpx;
  background: #f5f5f5;
  flex-shrink: 0;
}
.rank-info {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}
.rank-name {
  font-size: 26rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rank-spec { font-size: 22rpx; color: #999; }
.rank-data {
  display: flex; flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  flex-shrink: 0;
}
.rank-sales { font-size: 26rpx; color: #ff4d4f; font-weight: 600; }
.rank-qty { font-size: 22rpx; color: #999; }
.safe-bottom { height: 40rpx; }
</style>
