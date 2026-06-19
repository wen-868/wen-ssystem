<script setup lang="ts">
import { ref } from 'vue'
import { showLoadingToast, showSuccessToast, closeToast } from 'vant'
import {
  fetchProducts,
  adjustInventory,
  fetchInventoryLogs,
  type ProductRecord,
  type InventoryLogRecord
} from '../api'

/* ========== 搜索商品 ========== */
const keyword = ref('')
const products = ref<ProductRecord[]>([])
const searchLoading = ref(false)

async function onSearch() {
  if (!keyword.value.trim()) return
  searchLoading.value = true
  try {
    const res = await fetchProducts({ keyword: keyword.value })
    products.value = res.data.data ?? []
  } catch {
    // ignore
  } finally {
    searchLoading.value = false
  }
}

/* ========== 调整面板 ========== */
const selectedProduct = ref<ProductRecord | null>(null)
const showAdjustPopup = ref(false)
const stockType = ref('OFFLINE')
const changeQty = ref<number | string>('')
const reason = ref('')
const submitting = ref(false)

function selectProduct(product: ProductRecord) {
  selectedProduct.value = product
  showAdjustPopup.value = true
  stockType.value = 'OFFLINE'
  changeQty.value = ''
  reason.value = ''
}

function cancelAdjust() {
  showAdjustPopup.value = false
  selectedProduct.value = null
}

async function submitAdjust() {
  if (!selectedProduct.value) return
  if (changeQty.value === '' || changeQty.value === 0) {
    showSuccessToast('请输入调整数量')
    return
  }
  submitting.value = true
  showLoadingToast({ message: '提交中...', forbidClick: true })
  try {
    await adjustInventory({
      skuId: selectedProduct.value.skuId,
      stockType: stockType.value,
      change: Number(changeQty.value),
      remark: reason.value || undefined
    })
    closeToast()
    showSuccessToast('调整成功')
    showAdjustPopup.value = false
    selectedProduct.value = null
    // 刷新日志
    loadLogs(true)
  } catch {
    closeToast()
  } finally {
    submitting.value = false
  }
}

/* ========== 库存变动日志 ========== */
const logs = ref<InventoryLogRecord[]>([])
const logsLoading = ref(false)
const logsFinished = ref(false)
const logsRefreshing = ref(false)
const logsPage = ref(1)
const logsPageSize = 20

async function loadLogs(reset = false) {
  if (reset) {
    logsPage.value = 1
    logsFinished.value = false
  }
  logsLoading.value = true
  try {
    const res = await fetchInventoryLogs({
      page: logsPage.value,
      pageSize: logsPageSize
    })
    const data = res.data.data
    if (reset) {
      logs.value = data.records ?? []
    } else {
      logs.value.push(...(data.records ?? []))
    }
    if (logs.value.length >= (data.total ?? 0)) {
      logsFinished.value = true
    }
    logsPage.value++
  } catch {
    // ignore
  } finally {
    logsLoading.value = false
    logsRefreshing.value = false
  }
}

function onLogsRefresh() {
  logsRefreshing.value = true
  loadLogs(true)
}

function formatTime(time: string) {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}
</script>

<template>
  <section class="page">
    <h2 class="page-title">库存调整</h2>

    <!-- 搜索栏 -->
    <van-search
      v-model="keyword"
      placeholder="搜索商品名/SKU"
      show-action
      @search="onSearch"
      @cancel="onSearch"
    />

    <!-- 搜索结果 -->
    <div v-if="searchLoading" class="loading-wrapper">
      <van-loading type="spinner" />
    </div>
    <div v-else-if="products.length > 0" class="search-results">
      <van-cell-group inset>
        <van-cell
          v-for="item in products"
          :key="item.skuId"
          is-link
          class="product-cell"
          @click="selectProduct(item)"
        >
          <template #title>
            <div class="product-name">{{ item.skuName }}</div>
            <div class="product-spec">规格: {{ item.skuCode }}</div>
          </template>
          <template #label>
            <div class="product-stock">当前库存: {{ item.availableQty }}</div>
          </template>
        </van-cell>
      </van-cell-group>
    </div>

    <!-- 调整面板 -->
    <van-popup
      v-model:show="showAdjustPopup"
      position="bottom"
      round
      :style="{ maxHeight: '70%' }"
      :closeable="true"
      @close="cancelAdjust"
    >
      <div v-if="selectedProduct" class="adjust-panel">
        <h3 class="adjust-title">库存调整</h3>

        <van-cell-group inset>
          <van-cell title="商品" :value="selectedProduct.skuName" />
          <van-cell title="当前库存" :value="String(selectedProduct.availableQty)" />
        </van-cell-group>

        <div class="adjust-form">
          <!-- 库存类型 -->
          <div class="form-label">库存类型</div>
          <van-radio-group v-model="stockType" direction="horizontal">
            <van-radio name="ONLINE">线上</van-radio>
            <van-radio name="OFFLINE">线下</van-radio>
          </van-radio-group>

          <!-- 调整数量 -->
          <div class="form-label">调整数量</div>
          <van-field
            v-model="changeQty"
            type="number"
            placeholder="正数增加，负数减少"
          />

          <!-- 调整原因 -->
          <div class="form-label">调整原因</div>
          <van-field
            v-model="reason"
            type="textarea"
            placeholder="请输入调整原因"
            rows="2"
            autosize
          />

          <van-button
            type="primary"
            block
            :loading="submitting"
            :disabled="changeQty === '' || changeQty === 0"
            class="submit-btn"
            @click="submitAdjust"
          >
            确认调整
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 库存变动日志 -->
    <div class="log-section">
      <h3 class="section-title">库存变动日志</h3>
      <van-pull-refresh v-model="logsRefreshing" @refresh="onLogsRefresh">
        <van-list
          v-model:loading="logsLoading"
          :finished="logsFinished"
          finished-text="没有更多了"
          @load="loadLogs"
        >
          <div v-if="logs.length === 0 && !logsLoading" class="empty-wrapper">
            <van-empty description="暂无变动记录" />
          </div>
          <van-cell-group v-else inset>
            <van-cell
              v-for="log in logs"
              :key="log.logNo"
              class="log-cell"
            >
              <template #title>
                <div class="log-header">
                  <span class="log-name">{{ log.skuName }}</span>
                  <span
                    class="log-qty"
                    :class="{
                      'qty-positive': log.changeQty > 0,
                      'qty-negative': log.changeQty < 0
                    }"
                  >
                    {{ log.changeQty > 0 ? '+' : '' }}{{ log.changeQty }}
                  </span>
                </div>
              </template>
              <template #label>
                <div class="log-detail">
                  <span>{{ log.beforeQty }} → {{ log.afterQty }}</span>
                  <span class="log-reason" v-if="log.reason">{{ log.reason }}</span>
                </div>
                <div class="log-time">{{ formatTime(log.createdAt) }}</div>
              </template>
            </van-cell>
          </van-cell-group>
        </van-list>
      </van-pull-refresh>
    </div>
  </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.loading-wrapper {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.empty-wrapper {
  padding: 40px 0;
}

/* 搜索结果 */
.search-results {
  margin-bottom: 16px;
}

.product-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.product-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.product-spec {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.product-stock {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* 调整面板 */
.adjust-panel {
  padding: 20px 16px;
  max-height: 70vh;
  overflow-y: auto;
}

.adjust-title {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.adjust-form {
  margin-top: 16px;
  padding: 0 16px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 16px 0 8px;
}

.form-label:first-child {
  margin-top: 0;
}

.submit-btn {
  margin-top: 24px;
}

/* 日志区域 */
.log-section {
  margin-top: 24px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.log-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.log-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.log-qty {
  font-size: 16px;
  font-weight: 600;
}

.qty-positive {
  color: var(--color-success);
}

.qty-negative {
  color: var(--color-danger);
}

.log-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.log-reason {
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.log-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
</style>
