<template>
  <view class="more-page">
    <!-- 页头 -->
    <view class="mf-hd">
      <view class="header-back" @tap="goBack">
        <text class="header-back-icon">‹</text>
      </view>
      <text class="header-title">全部功能</text>
    </view>

    <!-- 高频功能 -->
    <view class="mf-section">
      <text class="mf-section-title">高频功能</text>
      <view class="mf-grid">
        <view class="mf-grid-item" v-for="item in hotActions" :key="item.label" @tap="goto(item.path)">
          <view class="mf-ico" :style="{ background: item.bg, color: item.color }">
            <image v-if="item.icon.startsWith('/static')" class="mf-ico-img" :src="item.icon" mode="aspectFit" />
            <text v-else class="mf-ico-text">{{ item.icon }}</text>
          </view>
          <text class="mf-label">{{ item.label }}</text>
        </view>
      </view>
    </view>

    <!-- 数据与工具 -->
    <view class="mf-section">
      <text class="mf-section-title">数据 · 工具</text>
      <view class="mf-list">
        <view class="mf-list-item" v-for="item in dataTools" :key="item.label" @tap="goto(item.path)">
          <view class="mf-li-ico" :style="{ background: item.bg, color: item.color }">
            <image v-if="item.icon.startsWith('/static')" class="mf-li-ico-img" :src="item.icon" mode="aspectFit" />
            <text v-else class="mf-li-ico-text">{{ item.icon }}</text>
          </view>
          <view class="mf-li-body">
            <text class="mf-li-title">{{ item.label }}</text>
            <text class="mf-li-desc">{{ item.sub }}</text>
          </view>
          <text class="mf-li-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import {
  AI_BG_SOFT,
  AI_TAB_ACTIVE,
  AI_SUCCESS,
  AI_SUCCESS_SOFT,
  AI_WARNING,
  AI_WARNING_SOFT,
  AI_DANGER,
  AI_DANGER_SOFT,
  AI_BG_GAP,
  AI_TEXT_MID,
} from '@/constants/colors'

const hotActions = [
  { icon: '/static/icons/fn-open.svg', label: '开单收银', path: '/pages/sales/create-sale', bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
  { icon: '/static/icons/fn-order.svg', label: '订单管理', path: '/pages/orders/orders', bg: AI_SUCCESS_SOFT, color: AI_SUCCESS },
  { icon: '/static/icons/fn-member.svg', label: '会员管理', path: '/pages-sub/marketing/member/member-list', bg: AI_WARNING_SOFT, color: AI_WARNING },
  { icon: '/static/icons/fn-stockin.svg', label: '进货入库', path: '/pages-sub/finance/purchase/in-stock', bg: AI_DANGER_SOFT, color: AI_DANGER },
  { icon: '/static/icons/fn-check.svg', label: '盘点调拨', path: '/pages-sub/product/stock-check/stock-checks', bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
  { icon: '/static/icons/fn-settle.svg', label: '收银对账', path: '/pages-sub/finance/reconciliation/reconciliation', bg: AI_SUCCESS_SOFT, color: AI_SUCCESS },
  { icon: '/static/icons/fn-inventory.svg', label: '库存管理', path: '/pages-sub/product/inventory/inventory', bg: AI_SUCCESS_SOFT, color: AI_SUCCESS },
  { icon: '/static/icons/fn-supplier.svg', label: '供应商管理', path: '/pages-sub/product/suppliers/suppliers', bg: AI_WARNING_SOFT, color: AI_WARNING },
  { icon: '/static/icons/fn-trace.svg', label: '溯源查询', path: '/pages-sub/product/trace/trace-query', bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
]

const dataTools = [
  { icon: '/static/icons/fn-report.svg', label: '经营报表', sub: '营业额、利润、趋势分析', path: '/pages-sub/finance/reports/reports', bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
  { icon: '/static/icons/fn-rank.svg', label: '销售排行', sub: '商品销量TOP排行', path: '/pages-sub/finance/reports/sales-reports', bg: AI_SUCCESS_SOFT, color: AI_SUCCESS },
  { icon: '/static/icons/fn-batch.svg', label: '批次管理', sub: '库存批次与出入库明细', path: '/pages-sub/product/batches/batch-list', bg: AI_WARNING_SOFT, color: AI_WARNING },
  { icon: '/static/icons/fn-alert.svg', label: '库存预警', sub: '低库存与临期提醒', path: '/pages-sub/product/stock-warning/stock-warning', bg: AI_DANGER_SOFT, color: AI_DANGER },
  { icon: '/static/icons/fn-price.svg', label: '价格管理', sub: '零售/批发价与调价', path: '/pages-sub/product/price/price-manage', bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
  { icon: '/static/icons/fn-batch-price.svg', label: '批量调价', sub: '按分类批量调整价格', path: '/pages-sub/product/price/batch-price', bg: AI_SUCCESS_SOFT, color: AI_SUCCESS },
  { icon: '/static/icons/fn-sales-report.svg', label: '销售报表', sub: '销售数据明细分析', path: '/pages-sub/finance/reports/sales-reports', bg: AI_WARNING_SOFT, color: AI_WARNING },
]

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: '/pages/functions/functions' })
  }
}

function goto(path: string) {
  if (path) {
    uni.navigateTo({ url: path })
  }
}
</script>

<style lang="scss" scoped>
.more-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

/* 页头 */
.mf-hd {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 32rpx 8rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}

.header-back {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $uni-bg-color-page;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-back-icon {
  font-size: 44rpx;
  color: $uni-gray-600;
  line-height: 1;
  margin-top: -4rpx;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color;
}

/* 区块 */
.mf-section {
  margin: 32rpx 28rpx 0;
}

.mf-section-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-gray-400;
  padding: 0 8rpx 16rpx;
  letter-spacing: 1rpx;
}

/* 高频宫格 */
.mf-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  padding: 24rpx 12rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.mf-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 0;
}

.mf-grid-item:active {
  transform: scale(0.94);
}

.mf-ico {
  width: 80rpx;
  height: 80rpx;
  border-radius: $uni-border-radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mf-ico-text {
  font-size: 32rpx;
  font-weight: 700;
}

.mf-ico-img {
  width: 48rpx;
  height: 48rpx;
}

.mf-label {
  font-size: 22rpx;
  color: $uni-gray-600;
  font-weight: 500;
}

/* 数据工具列表 */
.mf-list {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  overflow: hidden;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.mf-list-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  gap: 24rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.mf-list-item:last-child {
  border-bottom: none;
}

.mf-list-item:active {
  background: $uni-bg-color-grey;
}

.mf-li-ico {
  width: 72rpx;
  height: 72rpx;
  border-radius: $uni-border-radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mf-li-ico-text {
  font-size: 28rpx;
  font-weight: 700;
}

.mf-li-ico-img {
  width: 40rpx;
  height: 40rpx;
}

.mf-li-body {
  flex: 1;
  min-width: 0;
}

.mf-li-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color;
}

.mf-li-desc {
  display: block;
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-top: 6rpx;
}

.mf-li-arrow {
  font-size: 32rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
