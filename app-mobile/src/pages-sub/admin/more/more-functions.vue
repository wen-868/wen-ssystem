<template>
  <view class="more-page">
    <!-- 页头 -->
    <page-header title="全部功能" @back="goBack" />

    <!-- 高频功能 -->
    <view class="mf-section">
      <text class="mf-section-title">高频功能</text>
      <view class="mf-grid">
        <view class="mf-grid-item" v-for="(item, idx) in roleHotActions" :key="item.code" @tap="goto(item.path)">
          <view class="mf-ico" :style="{ background: itemBg(item, idx), color: itemColor(item, idx) }">
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
        <view class="mf-list-item" v-for="(item, idx) in roleDataTools" :key="item.code" @tap="goto(item.path)">
          <view class="mf-li-ico" :style="{ background: itemBg(item, idx), color: itemColor(item, idx) }">
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

    <!-- 全部功能（数据驱动，按模块分组） -->
    <view class="mf-section" v-for="g in filteredGroups" :key="g.id">
      <text class="mf-section-title">{{ g.title }}</text>
      <view class="mf-list">
        <view class="mf-list-item" v-for="(item, idx) in g.items" :key="item.code" @tap="goto(item.path)">
          <view class="mf-li-ico" :style="{ background: itemBg(item, idx), color: itemColor(item, idx) }">
            <image v-if="item.icon.startsWith('/static')" class="mf-li-ico-img" :src="item.icon" mode="aspectFit" />
            <text v-else class="mf-li-ico-text">{{ item.icon }}</text>
          </view>
          <view class="mf-li-body">
            <text class="mf-li-title">{{ item.label }}</text>
            <text class="mf-li-desc" v-if="item.sub">{{ item.sub }}</text>
          </view>
          <text class="mf-li-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  hotActions,
  dataTools,
  filterGroupsByModules,
  filterItemsByModules,
  type FunctionItem,
} from '@/config/function-menu'
import { getUserMenus, toAllowedModules } from '@/api/modules/menu'
import {
  AI_BG_SOFT,
  AI_TAB_ACTIVE,
  AI_SUCCESS,
  AI_SUCCESS_SOFT,
  AI_WARNING,
  AI_WARNING_SOFT,
  AI_DANGER,
  AI_DANGER_SOFT,
} from '@/constants/colors'

const allowedModules = ref<Set<string> | undefined>(undefined)
const roleHotActions = computed(() => filterItemsByModules(hotActions, allowedModules.value))
const roleDataTools = computed(() => filterItemsByModules(dataTools, allowedModules.value))
const filteredGroups = computed(() => filterGroupsByModules(allowedModules.value))

/** 图标配色：按序循环蓝/绿/橙/红软底（沿用原稿观感） */
const PALETTE = [
  { bg: AI_BG_SOFT, color: AI_TAB_ACTIVE },
  { bg: AI_SUCCESS_SOFT, color: AI_SUCCESS },
  { bg: AI_WARNING_SOFT, color: AI_WARNING },
  { bg: AI_DANGER_SOFT, color: AI_DANGER },
]
function itemBg(_item: FunctionItem, idx: number) {
  return PALETTE[idx % PALETTE.length].bg
}
function itemColor(_item: FunctionItem, idx: number) {
  return PALETTE[idx % PALETTE.length].color
}

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

/** 角色过滤：拉取当前用户可见菜单 → 模块前缀集合；失败空则回退全量 */
async function loadRoleMenus() {
  try {
    const menus = await getUserMenus()
    allowedModules.value = toAllowedModules(menus)
  } catch {
    allowedModules.value = undefined
  }
}

onShow(() => {
  loadRoleMenus()
})
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
  gap: $uni-spacing-sm;
  padding: $uni-spacing-base $uni-spacing-lg $uni-spacing-xs;
  padding-top: calc($uni-spacing-base + env(safe-area-inset-top));
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
  margin: $uni-spacing-lg $uni-spacing-base 0;
}

.mf-section-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-gray-400;
  padding: 0 $uni-spacing-xs $uni-spacing-sm;
  letter-spacing: 1rpx;
}

/* 高频宫格 */
.mf-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  padding: $uni-spacing-base $uni-spacing-sm;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.mf-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $uni-spacing-sm;
  padding: $uni-spacing-md 0;
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
  padding: $uni-spacing-base $uni-spacing-base;
  gap: $uni-spacing-base;
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
