<template>
  <view class="func-page">
    <!-- 搜索栏（UI1.2 打磨：头部区块删除，safe-area 移至顶部） -->
    <view class="func-search">
      <view class="search-bar">
        <image class="search-icon" src="/static/icons/sc-search.svg" mode="aspectFit" />
        <input class="search-input" v-model="keyword" placeholder="搜索功能、订单、客户" placeholder-class="search-placeholder" @confirm="doSearch" />
      </view>
    </view>

    <!-- 高频宫格（真实搜索过滤） -->
    <view class="func-grid" v-if="filteredHotActions.length > 0">
      <view class="func-grid-item" v-for="item in filteredHotActions" :key="item.label" @tap="goto(item.path)">
        <view class="fg-ico" :style="{ background: itemBg(item) }">
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
        <view class="list-item" v-for="(item, idx) in filteredDataTools" :key="item.code" @tap="goto(item.path)">
          <view class="li-ico" :style="{ background: itemBg(item, idx), color: itemColor(item, idx) }">
            <image class="li-ico-img" :src="item.icon" mode="aspectFit" />
          </view>
          <view class="li-body">
            <text class="li-title">{{ item.label }}</text>
            <text class="li-desc">{{ item.sub }}</text>
          </view>
          <text class="li-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 全部功能（数据驱动，自动排列系统全部功能） -->
    <view class="func-section" v-if="filteredGroups.length > 0">
      <text class="func-section-title">全部功能</text>
      <view class="func-group" v-for="g in filteredGroups" :key="g.id">
        <text class="func-group-title">{{ g.title }}</text>
        <view class="func-list">
          <view class="list-item" v-for="item in g.items" :key="item.code" @tap="goto(item.path)">
            <view class="li-ico" :style="{ background: itemBg(item), color: itemColor(item) }">
              <image class="li-ico-img" :src="item.icon" mode="aspectFit" />
            </view>
            <view class="li-body">
              <text class="li-title">{{ item.label }}</text>
              <text class="li-desc" v-if="item.sub">{{ item.sub }}</text>
            </view>
            <text class="li-arrow">›</text>
          </view>
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
import { hotActions, dataTools, searchFunctions, type FunctionItem } from '@/config/function-menu'
import { AI_BG_SOFT, AI_TAB_ACTIVE } from '@/constants/colors'

const keyword = ref('')

const navigate = (path: string) => {
  if (path) {
    uni.navigateTo({ url: path })
  }
}

const goto = (path: string) => navigate(path)

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

const filteredGroups = computed(() => searchFunctions(keyword.value).groups)

const hasResults = computed(
  () =>
    filteredHotActions.value.length > 0 ||
    filteredDataTools.value.length > 0 ||
    filteredGroups.value.length > 0
)

/** 宫格/列表图标配色（沿用原稿：蓝底浅蓝） */
function itemBg(_item: FunctionItem, _idx?: number) {
  return AI_BG_SOFT
}
function itemColor(_item: FunctionItem, _idx?: number) {
  return AI_TAB_ACTIVE
}

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
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
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
  margin: 28rpx 28rpx 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: $uni-bg-color;
  border-radius: 40rpx;
  padding: 40rpx 20rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.func-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 0;
  transition: transform 0.15s;
}

.func-grid-item:active {
  transform: scale(0.94);
}

.fg-ico {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fg-ico-img {
  width: 40rpx;
  height: 40rpx;
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
  margin: 36rpx 28rpx 28rpx;
}

.func-section-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-gray-500;
  padding: 0 8rpx 20rpx;
  letter-spacing: 1rpx;
  text-transform: uppercase;
}

.func-group {
  margin-top: 8rpx;
}

.func-group-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-gray-600;
  padding: 16rpx 8rpx 8rpx;
}

.func-list {
  background: $uni-bg-color;
  border-radius: 40rpx;
  overflow: hidden;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.list-item {
  display: flex;
  align-items: center;
  padding: 30rpx 36rpx;
  gap: 28rpx;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.03);
}

.list-item:last-child {
  border-bottom: none;
}

.list-item:active {
  background: $uni-bg-color-grey;
}

.li-ico {
  width: 76rpx;
  height: 76rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.li-ico-img {
  width: 36rpx;
  height: 36rpx;
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
  color: $uni-gray-500;
  margin-top: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.li-arrow {
  font-size: 32rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: 40rpx;
}
</style>
