<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  showToast,
  showLoadingToast,
  showSuccessToast,
  closeToast
} from 'vant'
import {
  fetchPurchaseInStocks,
  fetchPurchaseInStockDetail,
  confirmPurchaseInStock,
  type PurchaseStockRecord,
  type PurchaseStockDetail
} from '../api'

const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '待入库', value: 'PENDING' },
  { label: '已入库', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' }
]

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  PENDING: { text: '待入库', type: 'warning' },
  COMPLETED: { text: '已入库', type: 'success' },
  CANCELLED: { text: '已取消', type: 'danger' }
}

const activeTab = ref('')
const stocks = ref<PurchaseStockRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

// 详情弹窗
const showDetail = ref(false)
const detail = ref<PurchaseStockDetail | null>(null)
const detailLoading = ref(false)

async function loadStocks(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchPurchaseInStocks({
      page: page.value,
      pageSize,
      stockStatus: activeTab.value || undefined
    })
    const data = res.data
    if (reset) {
      stocks.value = data.records ?? []
    } else {
      stocks.value.push(...(data.records ?? []))
    }
    if (stocks.value.length >= (data.total ?? 0)) {
      finished.value = true
    }
    page.value++
  } catch {
    showToast('操作失败，请重试')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onRefresh() {
  refreshing.value = true
  loadStocks(true)
}

function onTabChange() {
  loadStocks(true)
}

async function viewDetail(id: number) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await fetchPurchaseInStockDetail(id)
    detail.value = res.data
  } catch {
    showToast('操作失败，请重试')
  } finally {
    detailLoading.value = false
  }
}

async function handleConfirm(id: number) {
  try {
    showLoadingToast({ message: '处理中...', forbidClick: true })
    await confirmPurchaseInStock(id)
    showSuccessToast('入库成功')
    closeToast()
    await loadStocks(true)
    if (showDetail.value && detail.value?.id === id) {
      await viewDetail(id)
    }
  } catch (err: any) {
    closeToast()
    showToast(err.response?.data?.message || '操作失败')
  }
}

function canConfirm(status: string) {
  return status === 'PENDING'
}

function goBack() {
  window.dispatchEvent(new CustomEvent('nav', { detail: 'home' }))
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">采购入库</h2>
      <van-button type="default" size="small" icon="arrow-left" @click="goBack">
        返回
      </van-button>
    </div>

    <!-- 状态筛选 -->
    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab
        v-for="tab in STATUS_TABS"
        :key="tab.value"
        :title="tab.label"
        :name="tab.value"
      />
    </van-tabs>

    <!-- 列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadStocks"
      >
        <div v-if="stocks.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无入库单" />
        </div>
        <van-cell
          v-for="stock in stocks"
          :key="stock.id"
          is-link
          class="stock-cell"
          @click="viewDetail(stock.id)"
        >
          <template #title>
            <div class="stock-header">
              <span class="stock-no">{{ stock.stockNo }}</span>
              <van-tag
                :type="(STATUS_MAP[stock.stockStatus]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ STATUS_MAP[stock.stockStatus]?.text || stock.stockStatus }}
              </van-tag>
            </div>
          </template>
          <template #label>
            <div class="stock-info">
              <span>{{ stock.supplierName }}</span>
              <span class="stock-amount">¥{{ Number(stock.totalAmount).toFixed(2) }}</span>
            </div>
            <div class="stock-meta">
              <span class="stock-time">{{ stock.createdAt }}</span>
              <span v-if="stock.orderNo" class="stock-order">
                采购单: {{ stock.orderNo }}
              </span>
            </div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 详情弹窗 -->
    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      :style="{ maxHeight: '85%' }"
    >
      <div class="detail-panel">
        <h3>入库单详情</h3>
        <div v-if="detailLoading" class="detail-loading">
          <van-loading type="spinner" />
        </div>
        <template v-else-if="detail">
          <van-cell-group inset>
            <van-cell title="单号" :value="detail.stockNo" />
            <van-cell title="采购单号" :value="detail.orderNo" />
            <van-cell title="供应商" :value="detail.supplierName" />
            <van-cell title="状态">
              <template #value>
                <van-tag
                  :type="(STATUS_MAP[detail.stockStatus]?.type as any) || 'default'"
                  plain
                >
                  {{ STATUS_MAP[detail.stockStatus]?.text || detail.stockStatus }}
                </van-tag>
              </template>
            </van-cell>
            <van-cell title="商品金额">
              <template #value>
                <span>¥{{ Number(detail.goodsAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
            <van-cell v-if="detail.taxAmount" title="税额" :value="`¥${Number(detail.taxAmount).toFixed(2)}`" />
            <van-cell title="总金额">
              <template #value>
                <span class="detail-amount">¥{{ Number(detail.totalAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
            <van-cell v-if="detail.remark" title="备注" :value="detail.remark" />
          </van-cell-group>

          <!-- 商品明细 -->
          <div class="detail-items">
            <h4>商品明细</h4>
            <van-cell-group inset>
              <van-cell
                v-for="item in detail.items"
                :key="item.id"
                :title="item.skuName"
                :label="`${item.boxQty}箱${item.bottleQty}瓶 / 共${item.totalBottleQty}瓶`"
              >
                <template #value>
                  <div class="item-detail">
                    <div>¥{{ Number(item.unitPrice).toFixed(2) }} × {{ item.totalBottleQty }}</div>
                    <div class="item-subtotal">¥{{ Number(item.subtotalAmount).toFixed(2) }}</div>
                  </div>
                </template>
              </van-cell>
            </van-cell-group>
          </div>

          <!-- 操作按钮 -->
          <div class="detail-actions">
            <van-button
              v-if="canConfirm(detail.stockStatus)"
              type="primary"
              block
              @click="handleConfirm(detail.id)"
            >
              确认入库
            </van-button>
          </div>
        </template>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-wrapper {
  padding: 40px 0;
}

.stock-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.stock-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.stock-no {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.stock-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
}

.stock-amount {
  font-weight: 600;
  color: var(--color-primary);
}

.stock-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.stock-order {
  color: var(--color-warning);
}

.detail-panel {
  padding: 20px 16px;
  max-height: 85vh;
  overflow-y: auto;
}

.detail-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.detail-loading {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.detail-amount {
  font-weight: 600;
  color: var(--color-primary);
  font-size: 16px;
}

.detail-items {
  margin-top: 12px;
}

.detail-items h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.item-detail {
  text-align: right;
  font-size: 12px;
}

.item-subtotal {
  font-weight: 600;
  color: var(--color-primary);
  margin-top: 2px;
}

.detail-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
