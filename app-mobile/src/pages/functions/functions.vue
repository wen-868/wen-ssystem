<template>
  <view class="func-page">
    <!-- 顶部标题栏（与子页面统一：page-header 组件，主 tab 页无返回键） -->
    <page-header title="功能" :show-back="false" />
    <!-- 搜索栏（UI1.2 打磨：头部区块删除，safe-area 移至顶部） -->
    <view class="func-search">
      <view class="search-bar">
        <image class="search-icon" src="/static/icons/sc-search.svg" mode="aspectFit" />
        <input class="search-input" v-model="keyword" placeholder="搜索功能、订单、客户" placeholder-class="search-placeholder" @confirm="doSearch" />
      </view>
    </view>

    <!-- 权限信息加载失败明示（S3-136-F1：不再静默回退全量） -->
    <view
      class="func-banner"
      :style="{ background: AI_WARNING_SOFT, borderColor: AI_WARNING }"
      v-if="menuStore.bannerText"
    >
      <text class="func-banner-text">{{ menuStore.bannerText }}</text>
      <text class="func-banner-retry" :style="{ color: AI_WARNING }" v-if="menuStore.showRetry" @tap="retryMenus">重试</text>
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
import { onShow } from '@dcloudio/uni-app'
import CustomTabBar from '@/components/custom-tab-bar.vue'
import {
  hotActions,
  dataTools,
  filterGroupsByCodes,
  filterItemsByCodes,
  type FunctionItem,
} from '@/config/function-menu'
import { useMenuStore } from '@/stores/menu'
import { AI_BG_SOFT, AI_TAB_ACTIVE, AI_WARNING, AI_WARNING_SOFT } from '@/constants/colors'

const keyword = ref('')
/**
 * 角色可见性：共用 stores/menu.ts（functions.vue 与 more-functions.vue 同一份，不再各拉一次）；
 * 判定口径见 config/function-menu.ts 的 isPageVisible（兼容态：code 精确命中 + 前缀回落）
 */
const menuStore = useMenuStore()
const allowedVisibility = computed(() => menuStore.visibility)
/** 按角色过滤后的高频 / 数据工具 */
const roleHotActions = computed(() => filterItemsByCodes(hotActions, allowedVisibility.value))
const roleDataTools = computed(() => filterItemsByCodes(dataTools, allowedVisibility.value))

const navigate = (path: string) => {
  if (path) {
    uni.navigateTo({ url: path })
  }
}

const goto = (path: string) => navigate(path)

/** 真实搜索：按关键词过滤宫格与工具列表，无匹配显示空态 */
const filteredHotActions = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return roleHotActions.value
  return roleHotActions.value.filter((a) => a.label.toLowerCase().includes(k))
})

const filteredDataTools = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return roleDataTools.value
  return roleDataTools.value.filter(
    (a) => a.label.toLowerCase().includes(k) || a.sub!.toLowerCase().includes(k)
  )
})

const filteredGroups = computed(() => {
  // 排除 tool 项：「数据 · 工具」区块已单独展示（R96-07 去重复排列），避免同一功能两处出现
  const base = filterGroupsByCodes(allowedVisibility.value, false)
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.tool) }))
    .filter((g) => g.items.length > 0)
  const k = keyword.value.trim().toLowerCase()
  if (!k) return base
  return base
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (it) => it.label.toLowerCase().includes(k) || (it.sub || '').toLowerCase().includes(k)
      ),
    }))
    .filter((g) => g.items.length > 0)
})

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

/** 权限信息加载失败时的重试 */
function retryMenus() {
  menuStore.refresh()
}

onShow(() => {
  // 共用 store：会话内只拉一次；失败回退由 store 负责（缓存集 / 失败关闭 + 明示）
  menuStore.ensureLoaded()
})
</script>

<style lang="scss" scoped>
/* R96-01: 已删除冗余的 @import '@/uni.scss' —— uni-app 会自动把 uni.scss 全文注入每个 scss 文件 */

.func-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  padding-bottom: calc(136rpx + env(safe-area-inset-bottom));
}

/* 搜索栏（顶部承接状态栏 safe-area） */
.func-search {
  padding: 24rpx 28rpx 20rpx;
}

.search-bar {
  display: flex;
  align-items: center;
  height: 80rpx;
  background: $uni-bg-color;
  border: 1rpx solid $zx-black-60;
  border-radius: $uni-border-radius-pill;
  padding: 0 28rpx;
  gap: 16rpx;
  box-shadow: 0 2rpx 8rpx $zx-black-30;
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

/* 权限信息加载失败明示条（S3-136-F1：失败不再静默回退全量） */
.func-banner {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 0 $uni-spacing-base 8rpx;
  padding: 16rpx 24rpx;
  border: 1rpx solid $zx-black-30;
  border-radius: $uni-border-radius-base;
}

.func-banner-text {
  flex: 1;
  font-size: 24rpx;
  line-height: 1.4;
}

.func-banner-retry {
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 600;
}

/* 高频宫格 */
.func-grid {
  margin: $uni-spacing-base $uni-spacing-base 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: $uni-bg-color;
  border-radius: $uni-border-radius-lg;
  padding: 40rpx $uni-spacing-md;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid $zx-black-30;
}

.func-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $uni-spacing-md;
  padding: $uni-spacing-base 0;
  transition: transform 0.15s;
}

.func-grid-item:active {
  transform: scale(0.94);
}

.fg-ico {
  width: 88rpx;
  height: 88rpx;
  border-radius: $uni-border-radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fg-ico-img {
  width: 40rpx;
  height: 40rpx;
}

  .fg-label {
    font-size: 24rpx;
    color: $uni-text-color;
    font-weight: 500;
    line-height: 1.2;
    text-align: center;
  }

/* 搜索无结果空态 */
.func-empty {
  margin: 40rpx $uni-spacing-base 0;
  padding: 80rpx $uni-spacing-base;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid $zx-black-30;
  text-align: center;
}

.func-empty-text {
  font-size: 26rpx;
  color: $uni-gray-500;
}

/* 数据工具 */
.func-section {
  margin: 36rpx $uni-spacing-base $uni-spacing-base;
}

.func-section-title {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: $uni-gray-500;
  padding: 0 $uni-spacing-xs $uni-spacing-md;
  letter-spacing: 1rpx;
  text-transform: uppercase;
}

.func-group {
  margin-top: $uni-spacing-xs;
}

.func-group-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-gray-600;
  padding: $uni-spacing-sm $uni-spacing-xs $uni-spacing-xs;
}

.func-list {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-lg;
  overflow: hidden;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid $zx-black-30;
}

.list-item {
  display: flex;
  align-items: center;
  padding: $uni-spacing-lg 36rpx;
  gap: $uni-spacing-base;
  border-bottom: 1rpx solid $zx-black-30;
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
  border-radius: $uni-border-radius-sm;
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
  font-size: 24rpx;
  font-weight: 500;
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
