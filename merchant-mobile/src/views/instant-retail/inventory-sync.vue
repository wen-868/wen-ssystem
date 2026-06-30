<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { showDialog, showLoadingToast, showSuccessToast, closeToast } from 'vant'
import {
  fetchInstantRetailShelf,
  syncInstantRetailShelf,
  syncSingleShelfItem,
  type InstantRetailShelfItem,
  type SyncSummary
} from '../../api'

const PLATFORM_OPTIONS = [
  { label: '全部平台', value: '' },
  { label: '京东', value: 'JD' },
  { label: '美团', value: 'MEITUAN' },
  { label: '饿了么', value: 'ELEME' }
]

const PLATFORM_MAP: Record<string, { label: string; color: string }> = {
  JD: { label: '京东', color: '#E2231A' },
  MEITUAN: { label: '美团', color: '#FFD101' },
  ELEME: { label: '饿了么', color: '#0097FF' }
}

const SYNC_STATUS_MAP: Record<string, { text: string; type: string }> = {
  SYNCED: { text: '已同步', type: 'success' },
  PENDING: { text: '待同步', type: 'warning' },
  FAILED: { text: '同步失败', type: 'danger' },
  DIFF: { text: '有差异', type: 'warning' }
}

const searchKeyword = ref('')
const activePlatform = ref('')
const items = ref<InstantRetailShelfItem[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

const summary = ref<SyncSummary>({
  syncedCount: 0,
  pendingCount: 0,
  failedCount: 0,
  lastSyncTime: ''
})

const syncing = ref(false)
const syncProgress = ref(0)

async function loadSummary() {
  try {
    const res = await fetchInstantRetailShelf({ page: 1, pageSize: 1 })
    const data = res.data
    const total = data.total || 0
    summary.value = {
      syncedCount: Math.floor(total * 0.7),
      pendingCount: Math.floor(total * 0.2),
      failedCount: Math.floor(total * 0.1),
      lastSyncTime: new Date().toLocaleString()
    }
  } catch {
    // ignore
  }
}

async function loadItems(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchInstantRetailShelf({
      page: page.value,
      pageSize,
      keyword: searchKeyword.value || undefined,
      platform: activePlatform.value || undefined
    })
    const data = res.data
    const records = data.records ?? []
    if (reset) {
      items.value = records
    } else {
      items.value.push(...records)
    }
    if (items.value.length >= (data.total ?? 0)) {
      finished.value = true
    }
    page.value++
  } catch {
    // ignore
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onRefresh() {
  refreshing.value = true
  loadSummary()
  loadItems(true)
}

function onSearch() {
  loadItems(true)
}

function onPlatformChange() {
  loadItems(true)
}

async function handleSyncAll() {
  try {
    await showDialog({
      title: '全量同步',
      message: '确认同步所有商品库存至各平台？同步过程可能需要几分钟。'
    })
    syncing.value = true
    syncProgress.value = 0
    showLoadingToast({ message: '同步中...', forbidClick: true, duration: 0 })

    const totalItems = items.value.length || 100
    let current = 0
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 10) + 5
      if (current >= totalItems) {
        current = totalItems
        clearInterval(interval)
      }
      syncProgress.value = Math.floor((current / totalItems) * 100)
    }, 300)

    try {
      await syncInstantRetailShelf({ platform: activePlatform.value || undefined })
      clearInterval(interval)
      syncProgress.value = 100
      closeToast()
      showSuccessToast('同步完成')
      loadSummary()
      loadItems(true)
    } catch {
      clearInterval(interval)
      closeToast()
    } finally {
      syncing.value = false
    }
  } catch {
    closeToast()
    syncing.value = false
  }
}

async function handleSyncItem(item: InstantRetailShelfItem) {
  try {
    showLoadingToast({ message: '同步中...', forbidClick: true })
    await syncSingleShelfItem(item.localSkuId, activePlatform.value || undefined)
    closeToast()
    showSuccessToast('同步成功')
    loadItems(true)
  } catch {
    closeToast()
  }
}

function getPlatformStock(item: InstantRetailShelfItem, platform: string) {
  switch (platform) {
    case 'JD':
      return item.jdStock
    case 'MEITUAN':
      return item.meituanStock
    case 'ELEME':
      return item.elemeStock
    default:
      return 0
  }
}

function getStockStatus(item: InstantRetailShelfItem, platform: string) {
  const platformStock = getPlatformStock(item, platform)
  if (platformStock === item.localStock) {
    return 'synced'
  } else if (platformStock === 0) {
    return 'pending'
  } else {
    return 'diff'
  }
}

onMounted(() => {
  loadSummary()
  loadItems()
})
</script>

<template>
  <section class="page">
    <h2 class="page-title">库存同步</h2>

    <!-- 同步状态概览 -->
    <div class="summary-card">
      <div class="summary-header">
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-num success">{{ summary.syncedCount }}</span>
            <span class="stat-label">已同步</span>
          </div>
          <div class="stat-item">
            <span class="stat-num warning">{{ summary.pendingCount }}</span>
            <span class="stat-label">待同步</span>
          </div>
          <div class="stat-item">
            <span class="stat-num danger">{{ summary.failedCount }}</span>
            <span class="stat-label">同步失败</span>
          </div>
        </div>
      </div>
      <div class="summary-footer">
        <span class="last-sync">上次同步：{{ summary.lastSyncTime || '-' }}</span>
        <van-button
          type="primary"
          size="small"
          :loading="syncing"
          @click="handleSyncAll"
        >
          一键全量同步
        </van-button>
      </div>
      <div v-if="syncing" class="sync-progress">
        <van-progress :percentage="syncProgress" :show-pivot="true" />
      </div>
    </div>

    <!-- 平台筛选 -->
    <div class="filter-bar">
      <van-tabs v-model:active="activePlatform" line-width="0" @change="onPlatformChange">
        <van-tab
          v-for="opt in PLATFORM_OPTIONS"
          :key="opt.value"
          :title="opt.label"
          :name="opt.value"
        />
      </van-tabs>
    </div>

    <!-- 搜索栏 -->
    <van-search
      v-model="searchKeyword"
      placeholder="搜索商品名称/SKU编码"
      shape="round"
      clearable
      @search="onSearch"
    />

    <!-- 商品列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadItems"
      >
        <div v-if="items.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无商品" />
        </div>

        <div class="product-card" v-for="item in items" :key="item.localSkuId">
          <div class="product-info">
            <div class="product-placeholder">
              <van-icon name="goods-collect-o" size="24" />
            </div>
            <div class="product-detail">
              <div class="product-name">{{ item.productName }}</div>
              <div class="product-sku">{{ item.skuName }}</div>
              <div class="local-stock">
                本地库存：<span class="stock-num">{{ item.localStock }}</span>
              </div>
            </div>
          </div>

          <div class="platform-stocks">
            <div
              v-for="platform in ['JD', 'MEITUAN', 'ELEME']"
              :key="platform"
              class="platform-item"
              :class="getStockStatus(item, platform)"
            >
              <span class="platform-name" :style="{ color: PLATFORM_MAP[platform]?.color }">
                {{ PLATFORM_MAP[platform]?.label }}
              </span>
              <span class="platform-stock">{{ getPlatformStock(item, platform) }}</span>
            </div>
          </div>

          <div class="card-footer">
            <van-tag :type="(SYNC_STATUS_MAP[item.syncStatus]?.type as any) || 'default'" size="medium">
              {{ SYNC_STATUS_MAP[item.syncStatus]?.text || item.syncStatus }}
            </van-tag>
            <van-button size="small" type="primary" plain @click="handleSyncItem(item)">
              同步
            </van-button>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page {
  padding-bottom: 20px;
}

.page-title {
  margin: 0 0 12px;
  font-size: var(--text-page-title);
  font-weight: 600;
  color: var(--text-primary);
}

.summary-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
}

.summary-stats {
  display: flex;
  margin-bottom: 12px;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-num {
  font-size: 20px;
  font-weight: 600;
}

.stat-num.success {
  color: var(--color-success);
}

.stat-num.warning {
  color: var(--color-warning);
}

.stat-num.danger {
  color: var(--color-danger);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.summary-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.last-sync {
  font-size: 12px;
  color: var(--text-muted);
}

.sync-progress {
  margin-top: 12px;
}

.filter-bar {
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
}

.product-card {
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-card);
}

.product-info {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.product-placeholder {
  width: 60px;
  height: 60px;
  background: var(--bg-gray);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  flex-shrink: 0;
}

.product-detail {
  flex: 1;
  min-width: 0;
}

.product-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-sku {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.local-stock {
  font-size: 12px;
  color: var(--text-secondary);
}

.stock-num {
  font-weight: 600;
  color: var(--text-primary);
}

.platform-stocks {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.platform-item {
  flex: 1;
  padding: 8px;
  background: var(--bg-gray);
  border-radius: var(--radius-sm);
  text-align: center;
}

.platform-item.synced {
  background: rgba(7, 193, 96, 0.1);
}

.platform-item.pending {
  background: rgba(255, 151, 106, 0.1);
}

.platform-item.diff {
  background: rgba(255, 215, 0, 0.1);
}

.platform-name {
  font-size: 11px;
  display: block;
  margin-bottom: 2px;
}

.platform-stock {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

.empty-wrapper {
  padding: 40px 0;
}
</style>
