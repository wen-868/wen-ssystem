<template>
  <view class="func-page">
    <!-- 搜索栏（UI1.2 打磨：头部区块删除，safe-area 移至顶部） -->
    <view class="func-search">
      <view class="search-bar">
        <text class="search-icon">&#xe614;</text>
        <input class="search-input" v-model="keyword" placeholder="搜索功能、订单、客户" placeholder-class="search-placeholder" @confirm="doSearch" />
      </view>
    </view>

    <!-- 高频宫格（真实搜索过滤） -->
    <view class="func-grid" v-if="filteredHotActions.length > 0">
      <view class="func-grid-item" v-for="item in filteredHotActions" :key="item.label" @tap="goto(item.path)">
        <view class="fg-ico" :style="{ background: item.bg }">
          <image v-if="item.icon.startsWith('/static')" class="fg-ico-img" :src="item.icon" mode="aspectFit" />
          <text v-else class="fg-ico-text">{{ item.icon }}</text>
        </view>
        <text class="fg-label">{{ item.label }}</text>
      </view>
    </view>

    <!-- 搜索无结果空态 -->
    <view class="func-empty" v-if="keyword && !hasResults">
      <text class="func-empty-text">未找到「{{ keyword }}」相关功能</text>
    </view>

    <!-- 数据工具 -->
    <view class="func-section" v-if="filteredDataTools.length > 0">
      <text class="func-section-title">数据 · 工具</text>
      <view class="func-list">
        <view class="list-item" v-for="item in filteredDataTools" :key="item.label" @tap="goto(item.path)">
          <view class="li-ico" :style="{ background: item.bg, color: item.color }">
            <text class="li-ico-text">{{ item.icon }}</text>
          </view>
          <view class="li-body">
            <text class="li-title">{{ item.label }}</text>
            <text class="li-desc">{{ item.sub }}</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
    <custom-tab-bar :current="'functions'" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CustomTabBar from '@/components/custom-tab-bar.vue'
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

const keyword = ref('')

const navigate = (path: string) => {
  if (path) {
    uni.navigateTo({ url: path })
  }
}

const goto = (path: string) => navigate(path)

const hotActions = [
  { icon: '/static/icons/fn-open.svg', label: '开单收银', path: '/pages/sales/create-sale', bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
  { icon: '/static/icons/fn-member.svg', label: '会员管理', path: '/pages-sub/marketing/member/member-list', bg: AI_WARNING_SOFT, color: AI_WARNING },
  { icon: '/static/icons/fn-stockin.svg', label: '进货入库', path: '/pages-sub/finance/purchase/in-stock', bg: AI_DANGER_SOFT, color: AI_DANGER },
  { icon: '/static/icons/fn-check.svg', label: '盘点调拨', path: '/pages-sub/product/stock-check/stock-checks', bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
  { icon: '/static/icons/fn-settle.svg', label: '收银对账', path: '/pages-sub/finance/reconciliation/reconciliation', bg: AI_SUCCESS_SOFT, color: AI_SUCCESS },
  { icon: '/static/icons/fn-store.svg', label: '门店管理', path: '/pages-sub/admin/stores/stores', bg: AI_WARNING_SOFT, color: AI_WARNING },
  { icon: '/static/icons/fn-print.svg', label: '单据打印', path: '/pages-sub/admin/print/print-records', bg: AI_BG_GAP, color: AI_TEXT_MID },
  { icon: '/static/icons/fn-more.svg', label: '更多', path: '/pages-sub/admin/more/more-functions', bg: AI_BG_GAP, color: AI_TEXT_MID },
]

const dataTools = [
  { icon: '报', label: '经营报表', sub: '营业额、利润、趋势分析', path: '/pages-sub/finance/reports/reports', bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
  { icon: '排', label: '销售排行', sub: '商品销量TOP排行', path: '/pages-sub/finance/reports/sales-reports', bg: AI_SUCCESS_SOFT, color: AI_SUCCESS },
  { icon: '溯', label: '溯源查询', sub: '商品来源与批次追踪', path: '/pages-sub/product/trace/trace-query', bg: AI_WARNING_SOFT, color: AI_WARNING },
  { icon: '供', label: '供应商管理', sub: '12家合作供应商', path: '/pages-sub/product/suppliers/suppliers', bg: AI_DANGER_SOFT, color: AI_DANGER },
]

/** 真实搜索：按关键词过滤宫格与工具列表，无匹配显示空态 */
const filteredHotActions = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return hotActions
  return hotActions.filter((a) => a.label.toLowerCase().includes(k))
})

const filteredDataTools = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return dataTools
  return dataTools.filter((a) => a.label.toLowerCase().includes(k) || a.sub.toLowerCase().includes(k))
})

const hasResults = computed(() => filteredHotActions.value.length > 0 || filteredDataTools.value.length > 0)

function doSearch() {
  // 确认搜索：结果由 computed 实时渲染，无需额外处理
}
</script>

<style lang="scss" scoped>
@import '@/uni.scss';

.func-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  padding-bottom: calc(136rpx + env(safe-area-inset-bottom));
}

/* 搜索栏（顶部承接状态栏 safe-area） */
.func-search {
  padding: 24rpx 28rpx 20rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
}

.search-bar {
  display: flex;
  align-items: center;
  height: 80rpx;
  background: $uni-bg-color;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  border-radius: $uni-border-radius-pill;
  padding: 0 28rpx;
  gap: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.search-icon {
  font-size: 30rpx;
  color: $uni-gray-400;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: $uni-text-color;
}

.search-placeholder {
  color: $uni-gray-400;
}

/* 高频宫格 */
.func-grid {
  margin: 8rpx 28rpx 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: $uni-bg-color;
  border-radius: 32rpx;
  padding: 24rpx 12rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.func-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 0;
  transition: transform 0.15s;
}

.func-grid-item:active {
  transform: scale(0.94);
}

.fg-ico {
  width: 80rpx;
  height: 80rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fg-ico-img {
  width: 44rpx;
  height: 44rpx;
}

.fg-label {
  font-size: 22rpx;
  color: $uni-gray-600;
  font-weight: 500;
}

/* 搜索无结果空态 */
.func-empty {
  margin: 40rpx 28rpx 0;
  padding: 80rpx 24rpx;
  background: $uni-bg-color;
  border-radius: 32rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
  text-align: center;
}

.func-empty-text {
  font-size: 26rpx;
  color: $uni-gray-500;
}

/* 数据工具 */
.func-section {
  margin: 36rpx 28rpx 0;
}

.func-section-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-gray-400;
  padding: 0 8rpx 16rpx;
  letter-spacing: 1rpx;
}

.func-list {
  background: $uni-bg-color;
  border-radius: 32rpx;
  overflow: hidden;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.list-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  gap: 24rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.list-item:last-child {
  border-bottom: none;
}

.list-item:active {
  background: $uni-bg-color-grey;
}

.li-ico {
  width: 72rpx;
  height: 72rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.li-ico-text {
  font-size: 28rpx;
  font-weight: 700;
}

.li-body {
  flex: 1;
  min-width: 0;
}

.li-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color;
}

.li-desc {
  display: block;
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-top: 6rpx;
}

.li-arrow {
  font-size: 32rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: 40rpx;
}
</style>
