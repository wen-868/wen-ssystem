<template>
  <view class="sales-reports-page">
    <view class="page-header">
      <text class="header-title">销售报表</text>
    </view>

    <!-- 筛选表单：ref + :model + :rules -->
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
      <view class="filter-row">
        <view class="filter-item">
          <text class="filter-label">门店</text>
          <view class="filter-picker" @tap="chooseStore">
            <text class="picker-text">{{ filterForm.storeName || '全部门店' }}</text>
            <text class="picker-arrow">&#xe612;</text>
          </view>
        </view>
        <view class="filter-item">
          <text class="filter-label">销售员</text>
          <view class="filter-picker" @tap="chooseSalesman">
            <text class="picker-text">{{ filterForm.salesmanName || '全部' }}</text>
            <text class="picker-arrow">&#xe612;</text>
          </view>
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

const summary = ref<any>({
  totalSales: '0.00',
  orderCount: 0,
  itemCount: 0,
  profit: '0.00',
  avgPrice: '0.00',
  customerCount: 0,
})

const categoryList = ref<any[]>([])

function chooseStartDate() {
  uni.showToast({ title: '日期选择开发中', icon: 'none' })
}
function chooseEndDate() {
  uni.showToast({ title: '日期选择开发中', icon: 'none' })
}
function chooseStore() {
  uni.showToast({ title: '门店选择开发中', icon: 'none' })
}
function chooseSalesman() {
  uni.showToast({ title: '销售员选择开发中', icon: 'none' })
}
async function onQuery() {
  await validate()
  loadReportData()
}
function onExport() {
  uni.showModal({
    title: '导出报表',
    content: '确认导出当前筛选条件的销售报表？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '导出功能开发中', icon: 'none' })
      }
    }
  })
}

async function loadReportData() {
  try {
    // TODO: 对接销售报表接口
    categoryList.value = []
  } catch (err) {
    console.error('加载销售报表失败:', err)
  }
}

onMounted(() => { loadReportData() })
</script>

<style scoped>
.sales-reports-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.filter-form {
  margin: 16rpx 24rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.filter-row {
  display: flex;
  gap: 24rpx;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.filter-row:last-of-type { border-bottom: none; }
.filter-item {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 8rpx;
}
.filter-label { font-size: 22rpx; color: #999; }
.filter-value { font-size: 26rpx; color: #333; font-weight: 500; }
.filter-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.picker-text { font-size: 26rpx; color: #333; }
.picker-arrow { font-size: 22rpx; color: #999; }
.query-btn {
  width: 100%;
  height: 72rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 36rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
  margin-top: 16rpx;
  border: none;
}
.query-btn::after { border: none; }
.summary-section { padding: 0 24rpx 24rpx; }
.summary-card {
  background: #fff;
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
  border-top: 1rpx dashed #f0f0f0;
  margin-top: 16rpx;
  padding-top: 24rpx;
}
.summary-item {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.summary-value { font-size: 32rpx; font-weight: 700; color: #333; }
.summary-value--profit { color: #52c41a; }
.summary-label { font-size: 22rpx; color: #999; }
.summary-divider {
  width: 1rpx; height: 48rpx;
  background: #f0f0f0;
}
.chart-section { padding: 0 24rpx 24rpx; }
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
}
.chart-placeholder {
  background: #fff;
  border-radius: 16rpx;
  height: 360rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.chart-icon { font-size: 64rpx; color: #ddd; }
.chart-text { font-size: 26rpx; color: #bbb; }
.category-section { padding: 0 24rpx 24rpx; }
.category-list {
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.category-item:last-child { border-bottom: none; }
.category-info {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 12rpx;
  margin-right: 24rpx;
}
.category-name { font-size: 26rpx; color: #333; font-weight: 500; }
.category-bar-wrap {
  height: 12rpx;
  background: #f5f5f5;
  border-radius: 6rpx;
  overflow: hidden;
}
.category-bar {
  height: 100%;
  background: linear-gradient(90deg, #1677FF, #4096ff);
  border-radius: 6rpx;
  min-width: 20rpx;
}
.category-data {
  display: flex; flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  flex-shrink: 0;
}
.category-amount { font-size: 26rpx; color: #ff4d4f; font-weight: 600; }
.category-percent { font-size: 22rpx; color: #999; }
.export-section { padding: 0 24rpx; }
.export-btn {
  width: 100%;
  height: 80rpx;
  background: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  color: #1677FF;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  border: 2rpx solid #1677FF;
}
.export-btn::after { border: none; }
.export-icon { font-size: 28rpx; }
.safe-bottom { height: 40rpx; }
</style>
