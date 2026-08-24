<template>
  <view class="price-manage-page">
    <page-header title="价格管理" @back="goBack" />

    <!-- 概览卡片 -->
    <view class="overview-card">
      <view class="overview-item">
        <text class="overview-value">{{ levelList.length }}</text>
        <text class="overview-label">价格体系</text>
      </view>
      <view class="overview-divider"></view>
      <view class="overview-item">
        <text class="overview-value">{{ enabledCount }}</text>
        <text class="overview-label">启用中</text>
      </view>
      <view class="overview-divider"></view>
      <view class="overview-item" @tap="goBatchLogs">
        <text class="overview-value">{{ batchCount }}</text>
        <text class="overview-label">调价记录</text>
      </view>
    </view>

    <!-- 操作入口 -->
    <view class="action-row">
      <view class="action-card" @tap="goBatchAdjust">
        <view class="action-icon-wrap action-icon-wrap--blue">
          <image class="action-icon ic" src="/static/icons/ic/pen.svg" mode="aspectFit"/>
        </view>
        <view class="action-info">
          <text class="action-title">批量调价</text>
          <text class="action-desc">按比例/固定额调整商品价格</text>
        </view>
      </view>
    </view>

    <!-- 价格体系列表 -->
    <view class="section-header">
      <text class="section-title">价格体系</text>
    </view>

    <view class="level-list" v-if="levelList.length > 0">
      <view class="level-card" v-for="level in levelList" :key="level.id">
        <view class="level-header">
          <view class="level-name-wrap">
            <text class="level-name">{{ level.name }}</text>
            <view class="level-badge" v-if="level.status === 1">
              <text class="level-badge-text">启用</text>
            </view>
            <view class="level-badge level-badge--disabled" v-else>
              <text class="level-badge-text">已禁用</text>
            </view>
          </view>
          <text class="level-code">{{ level.code }}</text>
        </view>
        <view class="level-body">
          <view class="info-row" v-if="level.discount != null">
            <text class="info-label">折扣</text>
            <text class="info-value">{{ level.discount }}%</text>
          </view>
          <view class="info-row" v-if="level.levelType">
            <text class="info-label">类型</text>
            <text class="info-value">{{ level.levelType }}</text>
          </view>
          <view class="info-row" v-if="level.remark">
            <text class="info-label">备注</text>
            <text class="info-value">{{ level.remark }}</text>
          </view>
        </view>
        <view class="level-actions">
          <button class="action-btn" @tap="onEditLevel(level)">编辑</button>
          <button class="action-btn action-btn--ghost" @tap="onToggleLevel(level)">
            {{ level.status === 1 ? '禁用' : '启用' }}
          </button>
        </view>
      </view>
    </view>

    <view class="empty-state" v-else-if="!loading">
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无价格体系</text>
    </view>

    <view class="fab-btn" @tap="onAddLevel">
      <text class="fab-icon">+</text>
    </view>
    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, computed, onMounted } from 'vue'
import { priceApi, type PriceLevel } from '@/api/modules/price'

const loading = ref(false)
const levelList = ref<PriceLevel[]>([])
const batchCount = ref(0)

const enabledCount = computed(() => levelList.value.filter((l) => l.status === 1).length)

async function loadLevels() {
  loading.value = true
  try {
    levelList.value = await priceApi.listLevels()
  } catch (err) {
    console.error('加载价格体系失败:', err)
  } finally {
    loading.value = false
  }
}

async function loadBatchCount() {
  try {
    const res: any = await priceApi.listBatchLogs({ page: 1, pageSize: 1 })
    batchCount.value = res?.total ?? 0
  } catch (err) {
    // R94-03：调价记录入口受 price-guard 权限控制（仅管理员/店长/财务），店员无权限时静默置 0
    batchCount.value = 0
  }
}

function onAddLevel() {
  uni.showModal({
    title: '新建价格体系',
    editable: true,
    placeholderText: '请输入名称（如：批发价）',
    success: async (res) => {
      if (res.confirm && res.content) {
        try {
          await priceApi.createLevel({ name: res.content, code: res.content, status: 1 })
          uni.showToast({ title: '创建成功', icon: 'success' })
          loadLevels()
        } catch (err) {
          console.error('创建失败:', err)
        }
      }
    },
  })
}

function onEditLevel(level: PriceLevel) {
  uni.showModal({
    title: '编辑价格体系',
    editable: true,
    placeholderText: '请输入名称',
    content: level.name,
    success: async (res) => {
      if (res.confirm && res.content) {
        try {
          await priceApi.updateLevel(level.id, { name: res.content })
          uni.showToast({ title: '修改成功', icon: 'success' })
          loadLevels()
        } catch (err) {
          console.error('修改失败:', err)
        }
      }
    },
  })
}

async function onToggleLevel(level: PriceLevel) {
  const newStatus = level.status === 1 ? 0 : 1
  try {
    await priceApi.updateLevel(level.id, { status: newStatus })
    uni.showToast({ title: newStatus === 1 ? '已启用' : '已禁用', icon: 'success' })
    loadLevels()
  } catch (err) {
    console.error('操作失败:', err)
  }
}

function goBatchAdjust() {
  uni.navigateTo({ url: '/pages-sub/product/price/batch-adjust' })
}

/** 调价记录（R94-01：接入真实记录页 batch-logs；R94-03：进入前先探测权限，403 时提示） */
function goBatchLogs() {
  priceApi
    .listBatchLogs({ page: 1, pageSize: 1 })
    .then(() => {
      uni.navigateTo({ url: '/pages-sub/product/price/batch-logs' })
    })
    .catch(() => {
      uni.showToast({ title: '仅管理员、店长、财务可用', icon: 'none' })
    })
}

onMounted(() => {
  loadLevels()
  loadBatchCount()
})
</script>

<style lang="scss" scoped>
.price-manage-page { min-height: 100vh; background: $uni-color-primary-soft; padding-bottom: 40rpx; }
.page-header {
  padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.overview-card {
  display: flex; align-items: center; margin: $uni-spacing-md $uni-spacing-base;
  background: $uni-bg-color; border-radius: $uni-border-radius-xs; padding: $uni-spacing-base 0;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
}
.overview-item { flex: 1; display: flex; flex-direction: column; align-items: center; }
.overview-value { font-size: 40rpx; font-weight: 700; color: $uni-color-primary; }
.overview-label { font-size: 24rpx; color: $uni-gray-400; margin-top: $uni-spacing-xs; }
.overview-divider { width: 1rpx; height: 60rpx; background: $uni-gray-100; }
.action-row { margin: 0 $uni-spacing-base; }
.action-card {
  display: flex; align-items: center; background: $uni-bg-color; border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
}
.action-icon-wrap {
  width: 80rpx; height: 80rpx; border-radius: $uni-border-radius-xs;
  display: flex; align-items: center; justify-content: center; margin-right: $uni-spacing-md;
}
.action-icon-wrap--blue { background: linear-gradient(135deg, $uni-color-primary-soft, $uni-color-primary-soft); }
.action-icon { font-size: 40rpx; color: $uni-color-primary; }
.action-info { flex: 1; display: flex; flex-direction: column; }
.action-title { font-size: 30rpx; font-weight: 600; color: $uni-gray-700; }
.action-desc { font-size: 24rpx; color: $uni-gray-400; margin-top: 4rpx; }
.section-header { padding: 24rpx 32rpx 12rpx; }
.section-title { font-size: 30rpx; font-weight: 600; color: $uni-gray-700; }
.level-list { padding: 0 $uni-spacing-lg; }
.level-card {
  background: $uni-bg-color; border-radius: $uni-border-radius-xs; padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-md; box-shadow: $uni-shadow-card-sm;
}
.level-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.level-name-wrap { display: flex; align-items: center; gap: $uni-spacing-sm; }
.level-name { font-size: 30rpx; font-weight: 600; color: $uni-gray-700; }
.level-badge { padding: 2rpx 12rpx; background: rgba(22,119,255,0.1); border-radius: 6rpx; }
.level-badge--disabled { background: rgba(0,0,0,0.05); }
.level-badge-text { font-size: 20rpx; color: $uni-color-primary; }
.level-badge--disabled .level-badge-text { color: $uni-gray-400; }
.level-code { font-size: 24rpx; color: $uni-gray-400; }
.level-body { display: flex; flex-direction: column; gap: 10rpx; margin-bottom: $uni-spacing-sm; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.level-actions { display: flex; gap: $uni-spacing-sm; }
.action-btn {
  flex: 1; height: 64rpx; border-radius: 32rpx; font-size: 26rpx;
  display: flex; align-items: center; justify-content: center; border: none;
  background: $uni-color-primary; color: $uni-text-color-inverse;
}
.action-btn--ghost { background: $uni-bg-color-grey; color: $uni-gray-700; }
.action-btn::after { border: none; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 180rpx 0; }
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: $uni-spacing-md; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.fab-btn {
  position: fixed; right: 40rpx; bottom: calc(60rpx + env(safe-area-inset-bottom));
  width: 100rpx; height: 100rpx; border-radius: 50%;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(22,119,255,0.4);
}
.fab-icon { font-size: 56rpx; color: $uni-text-color-inverse; font-weight: 300; }
.safe-bottom { height: 40rpx; }
</style>
