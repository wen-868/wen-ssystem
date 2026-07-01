<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showSuccessToast, showDialog } from 'vant'
import { getInventoryCheckDetail, updateInventoryCheckItem, submitInventoryCheck, type InventoryCheckDetail, type InventoryCheckItem } from '../api'

const route = useRoute()
const router = useRouter()
const checkId = Number(route.params.checkNo)

const detail = ref<InventoryCheckDetail | null>(null)
const loading = ref(true)
const submitting = ref(false)

async function loadDetail() {
  loading.value = true
  try {
    const res = await getInventoryCheckDetail(checkId)
    detail.value = res.data as InventoryCheckDetail
  } catch {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

async function updateItem(item: InventoryCheckItem) {
  try {
    await updateInventoryCheckItem(checkId, item.id, {
      actualQty: item.actualQty ?? item.actual_qty ?? 0
    })
  } catch {
    showToast('更新失败')
  }
}

function onQtyChange(item: InventoryCheckItem, val: string) {
  const qty = parseInt(val) || 0
  if (item.actualQty != null) {
    item.actualQty = qty
    item.actual_qty = qty
    item.diffQty = qty - (item.bookQty ?? item.book_qty ?? 0)
    item.diff_qty = item.diffQty
  } else {
    item.actual_qty = qty
    item.diff_qty = qty - (item.bookQty ?? item.book_qty ?? 0)
  }
}

async function handleSubmit() {
  try {
    await showDialog({ title: '确认提交', message: '确认提交盘点结果？提交后将不可修改。' })
  } catch { return }

  submitting.value = true
  try {
    await submitInventoryCheck(checkId)
    showSuccessToast('盘点已提交')
    setTimeout(() => router.back(), 1000)
  } catch {
    showToast('提交失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<template>
  <div class="check-execute-view">
    <van-nav-bar title="执行盘点" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="loading-center" />

    <template v-else-if="detail">
      <!-- 基本信息 -->
      <div class="check-summary">
        <div class="summary-row">
          <span>盘点单号</span>
          <span>{{ detail.check_no || detail.checkNo || '#' + detail.id }}</span>
        </div>
        <div class="summary-row">
          <span>仓库</span>
          <span>{{ detail.warehouseName || detail.warehouse_name || '-' }}</span>
        </div>
        <div class="summary-row">
          <span>SKU数</span>
          <span>{{ detail.skuCount ?? detail.sku_count ?? detail.items?.length ?? 0 }}</span>
        </div>
      </div>

      <!-- SKU 盘点列表 -->
      <div class="sku-list">
        <div v-for="item in detail.items" :key="item.id" class="sku-card">
          <div class="sku-header">
            <span class="sku-name">{{ item.skuName }}</span>
            <span v-if="item.skuCode" class="sku-code">{{ item.skuCode }}</span>
          </div>
          <div class="sku-qty-row">
            <div class="qty-block">
              <div class="qty-label">账面数量</div>
              <div class="qty-value">{{ item.bookQty ?? item.book_qty }}</div>
            </div>
            <div class="qty-block qty-block--input">
              <div class="qty-label">实际数量</div>
              <van-field
                v-model="(item.actualQty ?? item.actual_qty) as any"
                type="digit"
                placeholder="输入"
                class="qty-input"
                @update:model-value="(val: string) => { onQtyChange(item, val); updateItem(item) }"
              />
            </div>
            <div class="qty-block" v-if="(item.diffQty ?? item.diff_qty) != null">
              <div class="qty-label">差异</div>
              <div class="qty-value" :class="{ 'diff-positive': (item.diffQty ?? item.diff_qty)! > 0, 'diff-negative': (item.diffQty ?? item.diff_qty)! < 0 }">
                {{ (item.diffQty ?? item.diff_qty)! > 0 ? '+' : '' }}{{ item.diffQty ?? item.diff_qty }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 提交按钮 -->
      <div class="submit-section" v-if="detail.status !== 'COMPLETED'">
        <van-button
          type="primary"
          size="large"
          round
          block
          :loading="submitting"
          loading-text="提交中..."
          @click="handleSubmit"
        >
          提交盘点
        </van-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.check-execute-view {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 24px;
}

.loading-center {
  padding: 60px 0;
  display: flex;
  justify-content: center;
}

.check-summary {
  margin: 0 16px 12px;
  padding: 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.summary-row span:last-child {
  color: var(--text-primary);
  font-weight: 500;
}

.sku-list {
  padding: 0 16px;
}

.sku-card {
  margin-bottom: 10px;
  padding: 14px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.sku-header {
  margin-bottom: 10px;
}

.sku-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.sku-code {
  font-size: 12px;
  color: var(--text-hint);
  margin-left: 8px;
}

.sku-qty-row {
  display: flex;
  gap: 8px;
}

.qty-block {
  flex: 1;
  text-align: center;
  padding: 8px;
  background: var(--bg-page);
  border-radius: 8px;
}

.qty-block--input {
  flex: 1.5;
}

.qty-label {
  font-size: 11px;
  color: var(--text-hint);
  margin-bottom: 4px;
}

.qty-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.qty-input {
  padding: 0;
  text-align: center;
}

.qty-input :deep(.van-field__control) {
  text-align: center;
  font-size: 18px;
  font-weight: 700;
}

.diff-positive {
  color: var(--color-success);
}

.diff-negative {
  color: var(--color-danger);
}

.submit-section {
  padding: 24px 16px;
}
</style>