<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchBatches, type BatchRecord } from '../api'

const route = useRoute()
const router = useRouter()
const spuId = Number(route.params.spuId)

const batches = ref<BatchRecord[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const res = await fetchBatches(spuId)
    const data = res.data as unknown as { records: BatchRecord[] }
    batches.value = data?.records ?? []
  } catch {
    batches.value = []
  } finally {
    loading.value = false
  }
})

function goTrace(batchId: number) {
  router.push(`/batches/${batchId}/trace`)
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  return String(dateStr).split('T')[0] ?? dateStr
}

function formatNumber(n: number | null | undefined): string {
  return n != null ? String(n) : '-'
}

function formatPrice(price: number | null | undefined): string {
  return price != null ? `¥${Number(price).toFixed(2)}` : '-'
}
</script>

<template>
  <div class="batch-list-view">
    <van-nav-bar title="批次列表" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="loading-center" />

    <van-empty v-else-if="batches.length === 0" description="暂无批次数据" />

    <div v-else class="batch-list">
      <div
        v-for="batch in batches"
        :key="batch.id"
        class="batch-card"
        @click="goTrace(batch.id)"
      >
        <div class="batch-header">
          <span class="batch-no">{{ batch.batchNo || batch.batch_no }}</span>
          <span class="batch-qty">{{ formatNumber(batch.quantity) }}</span>
        </div>
        <div class="batch-meta">
          <span class="batch-meta-item">SKU：{{ batch.skuName || batch.sku_name || '-' }}</span>
          <span v-if="batch.storeName" class="batch-meta-item">门店：{{ batch.storeName }}</span>
        </div>
        <div class="batch-dates">
          <div class="batch-date-row">
            <span class="batch-date-label">生产日期</span>
            <span class="batch-date-value">{{ formatDate(batch.productionDate || batch.production_date) }}</span>
          </div>
          <div class="batch-date-row">
            <span class="batch-date-label">有效期至</span>
            <span class="batch-date-value">{{ formatDate(batch.expiryDate || batch.expiry_date) }}</span>
          </div>
        </div>
        <div class="batch-bottom">
          <span class="batch-cost">成本 {{ formatPrice(batch.costPrice || batch.cost_price) }}</span>
          <van-icon name="arrow" color="var(--text-muted)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.batch-list-view {
  min-height: 100vh;
  background: var(--bg-page);
}

.loading-center {
  padding: 60px 0;
  display: flex;
  justify-content: center;
}

.batch-list {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.batch-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 14px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
}

.batch-card:active {
  background: var(--bg-soft);
}

.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.batch-no {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.batch-qty {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  padding: 2px 10px;
  border-radius: 12px;
}

.batch-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.batch-meta-item {
  font-size: 12px;
  color: var(--text-secondary);
}

.batch-dates {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

.batch-date-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.batch-date-label {
  font-size: 11px;
  color: var(--text-muted);
}

.batch-date-value {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.batch-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--border-normal);
}

.batch-cost {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>