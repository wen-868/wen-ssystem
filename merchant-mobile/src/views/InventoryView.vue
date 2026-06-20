<script setup lang="ts">
import { ref, computed } from 'vue'
import { fetchInventory, type InventoryRecord } from '../api'

const keyword = ref('')
const records = ref<InventoryRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
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

async function loadInventory(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchInventory({
      keyword: keyword.value || undefined
    })
    const data = res.data
    const items = data?.records ?? data ?? []
    if (reset) {
      records.value = items
    } else {
      records.value.push(...items)
    }
    if (records.value.length >= (data?.total ?? items.length)) {
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

function onSearch() {
  loadInventory(true)
}

function onCancelSearch() {
  keyword.value = ''
  loadInventory(true)
}

function onRefresh() {
  refreshing.value = true
  loadInventory(true)
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
      shape="round"
      clearable
      @search="onSearch"
      @cancel="onCancelSearch"
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
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadInventory"
      >
        <div v-if="sortedRecords.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无库存数据" />
        </div>
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
      </van-list>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 12px;
  font-size: var(--text-page-title);
  font-weight: 600;
  color: var(--text-primary);
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px var(--space-page-padding);
}

.record-count {
  font-size: 13px;
  color: var(--text-muted);
  margin-left: auto;
}

.empty-wrapper {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.inventory-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
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
