<template>
  <view class="inventory-reports-page">
    <view class="page-header">
      <text class="header-title">库存报表</text>
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
      <button class="query-btn" @tap="onQuery">查询</button>
    </form>

    <view class="summary-section">
      <view class="summary-card">
        <view class="summary-row">
          <view class="summary-item">
            <text class="summary-value">{{ summary.totalQty }}</text>
            <text class="summary-label">库存总量</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">¥{{ summary.totalValue }}</text>
            <text class="summary-label">库存总值</text>
          </view>
          <view class="summary-divider"></view>
          <view class="summary-item">
            <text class="summary-value">{{ summary.warningCount }}</text>
            <text class="summary-label">预警商品</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">库存周转率</view>
      <view class="chart-placeholder">
        <text class="chart-icon">&#xe627;</text>
        <text class="chart-text">图表加载中...</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">商品库存排行</view>
      <view class="rank-list">
        <view class="rank-item" v-for="(item, idx) in rankList" :key="item.id">
          <view class="rank-num" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</view>
          <view class="rank-info">
            <text class="rank-name">{{ item.name }}</text>
            <text class="rank-spec">{{ item.spec }}</text>
          </view>
          <view class="rank-data">
            <text class="rank-qty">{{ item.qty }}件</text>
            <text class="rank-value">¥{{ item.value }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        <text>出入库明细</text>
        <text class="title-more" @tap="goDetail">查看全部</text>
      </view>
      <view class="detail-list">
        <view class="detail-item" v-for="item in detailList" :key="item.id">
          <view class="detail-left">
            <text class="detail-type" :class="item.type === 'in' ? 'type-in' : 'type-out'">
              {{ item.type === 'in' ? '入库' : '出库' }}
            </text>
            <text class="detail-name">{{ item.productName }}</text>
          </view>
          <view class="detail-right">
            <text class="detail-qty" :class="item.type === 'in' ? 'qty-in' : 'qty-out'">
              {{ item.type === 'in' ? '+' : '-' }}{{ item.qty }}
            </text>
            <text class="detail-date">{{ item.date }}</text>
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

const summary = ref<any>({
  totalQty: 12580,
  totalValue: '2,680,500.00',
  warningCount: 12,
})

const rankList = ref<any[]>([
  { id: 1, name: '茅台飞天53度', spec: '500ml', qty: 520, value: '884,000' },
  { id: 2, name: '五粮液52度', spec: '500ml', qty: 380, value: '456,000' },
  { id: 3, name: '洋河梦之蓝M6', spec: '500ml', qty: 650, value: '325,000' },
])

const detailList = ref<any[]>([
  { id: 1, type: 'in', productName: '茅台飞天53度', qty: 100, date: '2026-07-08' },
  { id: 2, type: 'out', productName: '五粮液52度', qty: 50, date: '2026-07-08' },
  { id: 3, type: 'in', productName: '洋河梦之蓝M6', qty: 200, date: '2026-07-07' },
])

function chooseStartDate() {
  uni.showToast({ title: '日期选择', icon: 'none' })
}
function chooseEndDate() {
  uni.showToast({ title: '日期选择', icon: 'none' })
}
async function onQuery() {
  await validate()
  loadReportData()
}
function goDetail() {
  uni.showToast({ title: '查看全部出入库明细', icon: 'none' })
}

async function loadReportData() {
  try {
    // TODO: 对接库存报表接口
  } catch (err) {
    console.error('加载库存报表失败:', err)
  }
}

onMounted(() => { loadReportData() })
</script>

<style scoped>
.inventory-reports-page { min-height: 100vh; background: #f0f5ff; }
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
}
.filter-item {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 8rpx;
}
.filter-label { font-size: 22rpx; color: #999; }
.filter-value { font-size: 26rpx; color: #333; font-weight: 500; }
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
}
.summary-item {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.summary-value { font-size: 32rpx; font-weight: 700; color: #333; }
.summary-label { font-size: 22rpx; color: #999; }
.summary-divider {
  width: 1rpx; height: 48rpx;
  background: #f0f0f0;
}
.section { padding: 0 24rpx 24rpx; }
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
.rank-qty { font-size: 24rpx; color: #666; }
.rank-value { font-size: 26rpx; color: #1677FF; font-weight: 600; }
.detail-list {
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.detail-item:last-child { border-bottom: none; }
.detail-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex: 1;
  min-width: 0;
}
.detail-type {
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  font-size: 20rpx;
  flex-shrink: 0;
}
.type-in { background: #f6ffed; color: #52c41a; }
.type-out { background: #fff2f0; color: #ff4d4f; }
.detail-name {
  font-size: 26rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
  flex-shrink: 0;
}
.detail-qty {
  font-size: 26rpx;
  font-weight: 600;
}
.qty-in { color: #52c41a; }
.qty-out { color: #ff4d4f; }
.detail-date { font-size: 22rpx; color: #999; }
.safe-bottom { height: 40rpx; }
</style>
