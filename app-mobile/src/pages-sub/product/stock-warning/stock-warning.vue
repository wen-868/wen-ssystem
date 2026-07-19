<template>
  <view class="stock-warning-page">
    <view class="page-header">
      <text class="header-title">库存预警</text>
    </view>

    <view class="tab-bar">
      <view class="tab-item" :class="{ 'tab-item--active': activeTab === 'warning' }" @tap="switchTab('warning')">
        <text>预警列表</text>
      </view>
      <view class="tab-item" :class="{ 'tab-item--active': activeTab === 'config' }" @tap="switchTab('config')">
        <text>阈值设置</text>
      </view>
    </view>

    <scroll-view class="content-scroll" scroll-y v-if="activeTab === 'warning'" @scrolltolower="onLoadMore">
      <view class="warning-card" v-for="item in warningList" :key="item.productId">
        <view class="card-top">
          <text class="product-name">{{ item.productName }}</text>
          <view class="shortage-tag" v-if="item.shortage > 0">
            <text class="shortage-text">缺{{ item.shortage }}{{ item.unit || '' }}</text>
          </view>
        </view>
        <view class="card-info">
          <view class="info-block">
            <text class="info-label">当前库存</text>
            <text class="info-value" :class="{ 'text-danger': item.stock < item.safetyStock }">{{ item.stock }}{{ item.unit || '' }}</text>
          </view>
          <view class="info-block">
            <text class="info-label">安全库存</text>
            <text class="info-value">{{ item.safetyStock }}{{ item.unit || '' }}</text>
          </view>
          <view class="info-block" v-if="item.suggestQty">
            <text class="info-label">建议补货</text>
            <text class="info-value text-primary">{{ item.suggestQty }}{{ item.unit || '' }}</text>
          </view>
        </view>
        <view class="card-category" v-if="item.categoryName">
          <text class="category-text">分类：{{ item.categoryName }}</text>
        </view>
      </view>

      <view class="load-more" v-if="warningList.length > 0">
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>
      <view class="empty-state" v-else-if="!loading">
        <text class="empty-text">暂无预警商品</text>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>

    <scroll-view class="content-scroll" scroll-y v-if="activeTab === 'config'" @scrolltolower="onLoadMoreConfig">
      <view class="config-card" v-for="cfg in configList" :key="cfg.productId">
        <view class="config-top">
          <text class="config-name">{{ cfg.productName || '商品' + cfg.productId }}</text>
          <view class="config-status" :class="cfg.enabled === 1 ? 'config-status--on' : 'config-status--off'">
            <text class="config-status-text">{{ cfg.enabled === 1 ? '已启用' : '已禁用' }}</text>
          </view>
        </view>
        <view class="config-row">
          <text class="config-label">安全库存阈值</text>
          <input class="config-input" type="number" v-model="cfg.safetyStock" />
        </view>
      </view>

      <view class="load-more" v-if="configList.length > 0">
        <text class="load-more-text" v-if="loadingMoreConfig">加载中...</text>
        <text class="load-more-text" v-else-if="noMoreConfig">-- 没有更多了 --</text>
      </view>
      <view class="empty-state" v-else-if="!loadingConfig">
        <text class="empty-text">暂无阈值配置</text>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>

    <view class="bottom-bar" v-if="activeTab === 'config' && configList.length > 0">
      <button class="btn btn--primary btn--block" @tap="onSaveConfig">保存配置</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { stockWarningApi, type StockWarningItem, type WarningConfig } from '@/api/modules/stock-warning'

const activeTab = ref('warning')

const warningList = ref<StockWarningItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

const configList = ref<WarningConfig[]>([])
const loadingConfig = ref(false)
const loadingMoreConfig = ref(false)
const configPage = ref(1)
const noMoreConfig = ref(false)

function switchTab(tab: string) {
  activeTab.value = tab
  if (tab === 'warning' && warningList.value.length === 0) {
    loadWarningList()
  }
  if (tab === 'config' && configList.value.length === 0) {
    loadConfigList()
  }
}

async function loadWarningList() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await stockWarningApi.list({ page: page.value, pageSize })
    warningList.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载预警列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    page.value++
    const result = await stockWarningApi.list({ page: page.value, pageSize })
    if (result.list.length === 0) {
      noMore.value = true
      page.value--
    } else {
      warningList.value = [...warningList.value, ...result.list]
    }
  } catch (err) {
    page.value--
    console.error('加载更多失败:', err)
  } finally {
    loadingMore.value = false
  }
}

async function loadConfigList() {
  if (loadingConfig.value) return
  loadingConfig.value = true
  try {
    const result = await stockWarningApi.configs({ page: configPage.value, pageSize })
    configList.value = result.list
    noMoreConfig.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载配置列表失败:', err)
  } finally {
    loadingConfig.value = false
  }
}

async function onLoadMoreConfig() {
  if (loadingMoreConfig.value || noMoreConfig.value) return
  loadingMoreConfig.value = true
  try {
    configPage.value++
    const result = await stockWarningApi.configs({ page: configPage.value, pageSize })
    if (result.list.length === 0) {
      noMoreConfig.value = true
      configPage.value--
    } else {
      configList.value = [...configList.value, ...result.list]
    }
  } catch (err) {
    configPage.value--
    console.error('加载更多失败:', err)
  } finally {
    loadingMoreConfig.value = false
  }
}

async function onSaveConfig() {
  const items = configList.value.map(c => ({
    productId: c.productId,
    safetyStock: Number(c.safetyStock),
  }))
  try {
    await stockWarningApi.batchConfig({ items })
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch (err) {
    console.error('保存配置失败:', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

loadWarningList()
</script>

<style scoped>
.stock-warning-page { min-height: 100vh; background: #f0f5ff; display: flex; flex-direction: column; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: #fff; }
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.tab-bar { display: flex; background: #fff; border-bottom: 1rpx solid #f0f0f0; }
.tab-item { flex: 1; text-align: center; padding: 24rpx 0; font-size: 28rpx; color: #666; position: relative; }
.tab-item--active { color: #1677FF; font-weight: 600; }
.tab-item--active::after { content: ''; position: absolute; bottom: 0; left: 30%; right: 30%; height: 4rpx; background: #1677FF; border-radius: 2rpx; }
.content-scroll { flex: 1; padding: 16rpx 24rpx; padding-bottom: 120rpx; }
.warning-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.product-name { font-size: 30rpx; font-weight: 600; color: #333; }
.shortage-tag { background: rgba(255,77,79,0.1); padding: 4rpx 16rpx; border-radius: 8rpx; }
.shortage-text { font-size: 22rpx; color: #ff4d4f; }
.card-info { display: flex; gap: 24rpx; padding: 16rpx 0; border-top: 1rpx solid #f0f0f0; }
.info-block { flex: 1; display: flex; flex-direction: column; align-items: center; }
.info-label { font-size: 22rpx; color: #999; margin-bottom: 8rpx; }
.info-value { font-size: 32rpx; font-weight: 600; color: #333; }
.text-danger { color: #ff4d4f; }
.text-primary { color: #1677FF; }
.card-category { margin-top: 8rpx; }
.category-text { font-size: 22rpx; color: #999; }
.config-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.config-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.config-name { font-size: 28rpx; font-weight: 600; color: #333; }
.config-status { padding: 4rpx 16rpx; border-radius: 8rpx; }
.config-status--on { background: rgba(82,196,26,0.1); }
.config-status--off { background: rgba(0,0,0,0.05); }
.config-status-text { font-size: 22rpx; }
.config-status--on .config-status-text { color: #52c41a; }
.config-status--off .config-status-text { color: #999; }
.config-row { display: flex; justify-content: space-between; align-items: center; }
.config-label { font-size: 26rpx; color: #666; }
.config-input { width: 200rpx; height: 60rpx; border: 1rpx solid #d9d9d9; border-radius: 8rpx; text-align: center; font-size: 28rpx; }
.load-more { text-align: center; padding: 24rpx 0; }
.load-more-text { font-size: 24rpx; color: #bbb; }
.empty-state { display: flex; justify-content: center; padding: 200rpx 0; }
.empty-text { font-size: 28rpx; color: #bbb; }
.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 16rpx 24rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); background: #fff; box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06); }
.btn { height: 80rpx; line-height: 80rpx; border-radius: 12rpx; font-size: 28rpx; text-align: center; border: none; }
.btn--primary { background: #1677FF; color: #fff; }
.btn--block { width: 100%; }
.safe-bottom { height: 40rpx; }
</style>
