<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchBatchTrace, type BatchTraceRecord } from '../api'

const route = useRoute()
const router = useRouter()
const batchId = Number(route.params.batchId)

const trace = ref<BatchTraceRecord | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await fetchBatchTrace(batchId)
    trace.value = res.data as unknown as BatchTraceRecord
  } catch {
    // 加载失败
  } finally {
    loading.value = false
  }
})

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

const TYPE_ICON_MAP: Record<string, { icon: string; color: string }> = {
  purchase: { icon: 'logistics', color: 'var(--color-primary)' },
  inbound: { icon: 'add-o', color: 'var(--color-success)' },
  outbound: { icon: 'minus', color: 'var(--color-warning)' },
  current: { icon: 'shop-o', color: 'var(--color-danger)' }
}
</script>

<template>
  <div class="batch-trace-view">
    <van-nav-bar title="批次追溯" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="loading-center" />

    <template v-else-if="trace">
      <!-- 批次基本信息 -->
      <div class="batch-info-card">
        <div class="batch-info-header">
          <span class="batch-no">{{ trace.batch.batchNo }}</span>
          <span class="batch-qty">{{ formatNumber(trace.batch.quantity) }}</span>
        </div>
        <div class="batch-info-grid">
          <div class="info-item">
            <span class="info-label">商品</span>
            <span class="info-value">{{ trace.batch.productName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">SKU</span>
            <span class="info-value">{{ trace.batch.skuName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">生产日期</span>
            <span class="info-value">{{ formatDate(trace.batch.productionDate) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">有效期至</span>
            <span class="info-value">{{ formatDate(trace.batch.expiryDate) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">成本价</span>
            <span class="info-value">{{ formatPrice(trace.batch.costPrice) }}</span>
          </div>
        </div>
      </div>

      <!-- 追溯链 Step -->
      <div class="trace-section">
        <h3 class="trace-title">追溯链路</h3>
        <van-steps direction="vertical" :active="trace.chain.length - 1">
          <van-step v-for="(step, idx) in trace.chain" :key="idx">
            <template #active-icon>
              <van-icon
                :name="TYPE_ICON_MAP[step.type]?.icon || 'circle'"
                :color="TYPE_ICON_MAP[step.type]?.color || 'var(--text-muted)'"
                size="18"
              />
            </template>
            <template #inactive-icon>
              <van-icon
                :name="TYPE_ICON_MAP[step.type]?.icon || 'circle'"
                :color="TYPE_ICON_MAP[step.type]?.color || 'var(--text-muted)'"
                size="18"
              />
            </template>
            <h4 class="step-title">{{ step.title }}</h4>
            <p class="step-detail">{{ step.detail }}</p>
            <p class="step-time">{{ formatDate(step.time) }}</p>
          </van-step>
        </van-steps>
      </div>
    </template>

    <van-empty v-else description="加载追溯信息失败" />
  </div>
</template>

<style scoped>
.batch-trace-view {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 24px;
}

.loading-center {
  padding: 60px 0;
  display: flex;
  justify-content: center;
}

.batch-info-card {
  margin: 12px 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
}

.batch-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-normal);
}

.batch-no {
  font-size: 16px;
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

.batch-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 11px;
  color: var(--text-muted);
}

.info-value {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.trace-section {
  margin: 12px 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
}

.trace-title {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.step-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.step-detail {
  margin: 0 0 2px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.step-time {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
}
</style>