<template>
  <view class="func-page">
    <!-- 搜索栏 -->
    <view class="func-search">
      <input class="search-input" placeholder="搜索功能、订单、客户" />
    </view>

    <!-- 高频操作 -->
    <view class="func-section">
      <view class="section-title">高频操作</view>
      <view class="func-grid">
        <view class="func-item" v-for="item in hotActions" :key="item.label" @tap="goto(item.path)">
          <view class="func-icon" :style="{ background: item.bg, color: item.color }">
            <text class="func-icon-text">{{ item.icon }}</text>
          </view>
          <text class="func-label">{{ item.label }}</text>
        </view>
      </view>
    </view>

    <!-- 业务管理 -->
    <view class="func-section">
      <view class="section-title">业务管理</view>
      <view class="func-grid">
        <view class="func-item" v-for="item in bizActions" :key="item.label" @tap="goto(item.path)">
          <view class="func-icon" :style="{ background: item.bg, color: item.color }">
            <text class="func-icon-text">{{ item.icon }}</text>
          </view>
          <text class="func-label">{{ item.label }}</text>
        </view>
      </view>
    </view>

    <!-- 数据工具 -->
    <view class="func-section">
      <view class="section-title">数据工具</view>
      <view class="data-grid">
        <view class="data-card" v-for="item in dataTools" :key="item.label" @tap="goto(item.path)">
          <text class="data-icon">{{ item.icon }}</text>
          <text class="data-name">{{ item.label }}</text>
          <text class="data-sub">{{ item.sub }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive } from 'vue'

const navigate = (path: string) => {
  if (path) {
    uni.navigateTo({ url: path })
  } else {
    uni.showToast({ title: '功能开发中', icon: 'none' })
  }
}

const goto = (path: string) => navigate(path)

const hotActions = reactive([
  { icon: '🧾', label: '开单收银', path: '/pages/sales/create-sale', bg: '#EEF2FF', color: '#6366F1' },
  { icon: '📦', label: '订单管理', path: '/pages/orders/orders', bg: '#ECFDF5', color: '#10B981' },
  { icon: '🔍', label: '库存盘点', path: '', bg: '#FFF7ED', color: '#F59E0B' },
  { icon: '🚚', label: '配送管理', path: '', bg: '#FEF2F2', color: '#EF4444' },
])

const bizActions = reactive([
  { icon: '👥', label: '客户管理', path: '/pages-sub/product/customers/customers', bg: '#EEF2FF', color: '#6366F1' },
  { icon: '🏷️', label: '商品管理', path: '/pages/products/products', bg: '#ECFDF5', color: '#10B981' },
  { icon: '💰', label: '价格管理', path: '', bg: '#FFF7ED', color: '#F59E0B' },
  { icon: '🧑‍💼', label: '员工管理', path: '', bg: '#F3F4F6', color: '#6B7280' },
])

const dataTools = reactive([
  { icon: '📊', label: '销售报表', sub: '经营数据分析', path: '/pages-sub/finance/reports/reports', bg: '#EEF2FF' },
  { icon: '📈', label: '库存报表', sub: '商品与库存', path: '', bg: '#ECFDF5' },
  { icon: '💹', label: '利润分析', sub: '毛利与成本', path: '', bg: '#FFF7ED' },
])
</script>

<style lang="scss" scoped>
@import '@/uni.scss';

.func-page {
  min-height: 100vh;
  background: $ai-bg-gap;
  padding: 16rpx 0 40rpx;
}

.func-search {
  padding: 16rpx 32rpx 24rpx;
}
.search-input {
  height: 72rpx;
  background: #FFFFFF;
  border-radius: 36rpx;
  padding: 0 32rpx;
  font-size: $ai-fs-body;
  color: $ai-text-body;
}

.func-section {
  margin-bottom: 24rpx;
  padding: 0 32rpx;
}
.section-title {
  font-size: $ai-fs-h3;
  font-weight: 600;
  color: $ai-text-main;
  margin-bottom: 16rpx;
}

.func-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}
.func-item {
  width: calc((100% - 60rpx) / 4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.func-icon {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.func-icon-text {
  font-size: 40rpx;
}
.func-label {
  font-size: $ai-fs-caption;
  color: $ai-text-body;
}

.data-grid {
  display: flex;
  gap: 20rpx;
}
.data-card {
  flex: 1;
  background: #FFFFFF;
  border-radius: $ai-radius-lg;
  padding: 24rpx 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.data-icon {
  font-size: 40rpx;
}
.data-name {
  font-size: $ai-fs-body;
  font-weight: 600;
  color: $ai-text-body;
}
.data-sub {
  font-size: $ai-fs-micro;
  color: $ai-text-sub;
}
</style>
