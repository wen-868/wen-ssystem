<template>
  <view class="price-manage-page">
    <view class="page-header">
      <text class="header-title">价格管理</text>
    </view>

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
          <text class="action-icon">&#xe611;</text>
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
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无价格体系</text>
    </view>

    <view class="fab-btn" @tap="onAddLevel">
      <text class="fab-icon">+</text>
    </view>
    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
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
    console.error('加载调价记录数失败:', err)
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
  uni.navigateTo({ url: '/pages/price/batch-adjust' })
}

function goBatchLogs() {
  uni.showToast({ title: '调价记录功能开发中', icon: 'none' })
}

onMounted(() => {
  loadLevels()
  loadBatchCount()
})
</script>

<style scoped>
.price-manage-page { min-height: 100vh; background: #f0f5ff; padding-bottom: 40rpx; }
.page-header {
  padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.overview-card {
  display: flex; align-items: center; margin: 20rpx 24rpx;
  background: #fff; border-radius: 20rpx; padding: 28rpx 0;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
}
.overview-item { flex: 1; display: flex; flex-direction: column; align-items: center; }
.overview-value { font-size: 40rpx; font-weight: 700; color: #1677FF; }
.overview-label { font-size: 24rpx; color: #999; margin-top: 8rpx; }
.overview-divider { width: 1rpx; height: 60rpx; background: #f0f0f0; }
.action-row { margin: 0 24rpx; }
.action-card {
  display: flex; align-items: center; background: #fff; border-radius: 20rpx;
  padding: 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
}
.action-icon-wrap {
  width: 80rpx; height: 80rpx; border-radius: 20rpx;
  display: flex; align-items: center; justify-content: center; margin-right: 20rpx;
}
.action-icon-wrap--blue { background: linear-gradient(135deg, #e6f4ff, #bae0ff); }
.action-icon { font-size: 40rpx; color: #1677FF; }
.action-info { flex: 1; display: flex; flex-direction: column; }
.action-title { font-size: 30rpx; font-weight: 600; color: #333; }
.action-desc { font-size: 24rpx; color: #999; margin-top: 4rpx; }
.section-header { padding: 24rpx 32rpx 12rpx; }
.section-title { font-size: 30rpx; font-weight: 600; color: #333; }
.level-list { padding: 0 24rpx; }
.level-card {
  background: #fff; border-radius: 16rpx; padding: 24rpx;
  margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.level-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.level-name-wrap { display: flex; align-items: center; gap: 12rpx; }
.level-name { font-size: 30rpx; font-weight: 600; color: #333; }
.level-badge { padding: 2rpx 12rpx; background: rgba(22,119,255,0.1); border-radius: 6rpx; }
.level-badge--disabled { background: rgba(0,0,0,0.05); }
.level-badge-text { font-size: 20rpx; color: #1677FF; }
.level-badge--disabled .level-badge-text { color: #999; }
.level-code { font-size: 24rpx; color: #999; }
.level-body { display: flex; flex-direction: column; gap: 10rpx; margin-bottom: 16rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.level-actions { display: flex; gap: 16rpx; }
.action-btn {
  flex: 1; height: 64rpx; border-radius: 32rpx; font-size: 26rpx;
  display: flex; align-items: center; justify-content: center; border: none;
  background: #1677FF; color: #fff;
}
.action-btn--ghost { background: #f5f5f5; color: #333; }
.action-btn::after { border: none; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 180rpx 0; }
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.fab-btn {
  position: fixed; right: 40rpx; bottom: calc(60rpx + env(safe-area-inset-bottom));
  width: 100rpx; height: 100rpx; border-radius: 50%;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(22,119,255,0.4);
}
.fab-icon { font-size: 56rpx; color: #fff; font-weight: 300; }
.safe-bottom { height: 40rpx; }
</style>
