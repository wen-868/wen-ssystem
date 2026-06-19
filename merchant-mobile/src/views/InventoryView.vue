<script setup lang="ts">
import { ref, computed } from 'vue'
import { fetchInventory, type InventoryRecord } from '../api'

const keyword = ref('')
const records = ref<InventoryRecord[]>([])
const loading = ref(false)
const refreshing = ref(false)
const sortAsc = ref(true) // true = 可售库存升序（缺货优先）

const sortedRecords = computed(() => {
  const list = [...records.value]
  list.sort((a, b) => {
    return sortAsc.value
      ? Number(a.availableQty) - Number(b.availableQty)
      : Number(b.availableQty) - Number(a.availableQty)
  })
  return list
})

async function loadInventory() {
  loading.value = true
  try {
    const res = await fetchInventory({ keyword: keyword.value })
    records.value = res.data.data ?? []
  } catch {
    // ignore
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onSearch() {
  loadInventory()
}

function onRefresh() {
  refreshing.value = true
  loadInventory()
}

function toggleSort() {
  sortAsc.value = !sortAsc.value
}

function goToAdjust() {
  window.dispatchEvent(new CustomEvent('nav', { detail: 'inventory-adjust' }))
}
</script>

<template>
  <section class="page">
    <h2 class="page-title">库存</h2>

    <!-- 搜索栏 -->
    <van-search
      v-model="keyword"
      placeholder="搜索商品名/SKU"
      show-action
      @search="onSearch"
      @cancel="onSearch"
    />

    <!-- 操作栏 -->
    <div class="action-bar">
      <van-button size="small" plain @click="toggleSort">
        可售库存 {{ sortAsc ? '↑ 升序' : '↓ 降序' }}
      </van-button>
      <van-button size="small" type="primary" plain @click="goToAdjust">
        库存调整
      </van-button>
      <span class="record-count">共 {{ records.length }} 条</span>
    </div>

    <!-- 库存列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-if="loading" class="loading-wrapper">
        <van-loading type="spinner" />
      </div>
      <div v-else-if="sortedRecords.length === 0" class="empty-wrapper">
        <van-empty description="暂无库存数据" />
      </div>
      <van-cell-group v-else inset>
        <van-cell
          v-for="item in sortedRecords"
          :key="`${item.skuId}-${item.stockType}`"
          class="inventory-cell"
        >
          <template #title>
            <div class="inventory-name">{{ item.skuName }}</div>
            <div class="inventory-sku">SKU: {{ item.skuId }}</div>
          </template>
          <template #label>
            <div class="inventory-qty-row">
              <span class="qty-item">
                <span class="qty-label">实际</span>
                <span class="qty-value">{{ item.physicalQty }}</span>
              </span>
              <span class="qty-item">
                <span class="qty-label">占用</span>
                <span class="qty-value qty-locked">{{ item.lockedQty }}</span>
              </span>
              <span class="qty-item">
                <span class="qty-label">可售</span>
                <span
                  class="qty-value"
                  :class="{
                    'qty-low': item.availableQty <= 5,
                    'qty-ok': item.availableQty > 5
                  }"
                >
                  {{ item.availableQty }}
                </span>
              </span>
            </div>
          </template>
        </van-cell>
      </van-cell-group>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
}

.record-count {
  font-size: 13px;
  color: var(--text-muted);
  margin-left: auto;
}

.loading-wrapper,
.empty-wrapper {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.inventory-cell {
  margin-bottom: 8px;
}

.inventory-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.inventory-sku {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.inventory-qty-row {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.qty-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.qty-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.qty-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.qty-locked {
  color: var(--color-warning);
}

.qty-low {
  color: var(--color-danger);
}

.qty-ok {
  color: var(--color-success);
}
</style>
