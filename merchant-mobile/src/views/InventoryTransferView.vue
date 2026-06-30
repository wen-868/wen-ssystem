<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchTransferOrders, type TransferOrderRecord } from '../api'

const router = useRouter()

const list = ref<TransferOrderRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const page = ref(1)
const statusFilter = ref('')

const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待审核',
  APPROVED: '已审核',
  TRANSIT: '已发货',
  RECEIVED: '已收货',
  CANCELLED: '已取消'
}

const STATUS_OPTIONS = [
  { text: '全部', value: '' },
  { text: '待发货', value: 'APPROVED' },
  { text: '已发货', value: 'TRANSIT' },
  { text: '已收货', value: 'RECEIVED' },
]

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.split('T')[0] || dateStr.slice(0, 10)
}

function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

async function loadData() {
  loading.value = true
  try {
    const res = await fetchTransferOrders({
      status: statusFilter.value || undefined,
      page: page.value,
      pageSize: 20
    })
    const data = (res.data as any)?.records ?? (res.data as any)?.list ?? res.data
    if (Array.isArray(data)) {
      if (page.value === 1) list.value = data
      else list.value.push(...data)
      if (data.length < 20) finished.value = true
    } else {
      finished.value = true
    }
  } catch {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

async function onLoad() {
  page.value++
  await loadData()
}

function onFilterChange() {
  page.value = 1
  list.value = []
  finished.value = false
  loadData()
}

function goDetail(transfer: TransferOrderRecord) {
  const no = transfer.transfer_no || transfer.transferNo || String(transfer.id)
  router.push(`/inventory-transfers/${no}`)
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="inventory-transfer-view">
    <van-nav-bar title="调拨管理" left-arrow @click-left="router.back()" />

    <!-- 状态筛选 -->
    <div class="filter-bar">
      <span
        v-for="opt in STATUS_OPTIONS"
        :key="opt.value"
        class="filter-chip"
        :class="{ active: statusFilter === opt.value }"
        @click="statusFilter = opt.value; onFilterChange()"
      >
        {{ opt.text }}
      </span>
    </div>

    <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad">
      <div v-for="item in list" :key="item.id" class="transfer-card" @click="goDetail(item)">
        <div class="transfer-header">
          <span class="transfer-no">{{ item.transfer_no || item.transferNo || '#' + item.id }}</span>
          <span class="transfer-status" :class="'status-' + (item.status?.toLowerCase() || '')">
            {{ STATUS_MAP[item.status] || item.status }}
          </span>
        </div>
        <div class="transfer-stores">
          <span>{{ item.fromStoreName || item.from_store_name || '-' }}</span>
          <van-icon name="arrow" size="12" />
          <span>{{ item.toStoreName || item.to_store_name || '-' }}</span>
        </div>
        <div class="transfer-meta">
          <span>金额：¥{{ formatPrice(item.totalAmount ?? item.total_amount) }}</span>
          <span>数量：{{ item.totalQty ?? item.total_qty ?? 0 }}</span>
          <span>{{ formatDate(item.createdAt || item.created_at) }}</span>
        </div>
        <van-icon name="arrow" class="arrow-icon" />
      </div>
    </van-list>

    <van-empty v-if="!loading && list.length === 0" description="暂无调拨单" />
  </div>
</template>

<style scoped>
.inventory-transfer-view {
  min-height: 100vh;
  background: var(--bg-page);
}

.filter-bar {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  overflow-x: auto;
}

.filter-chip {
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 13px;
  background: var(--bg-card);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.filter-chip.active {
  background: var(--color-primary);
  color: #fff;
}

.transfer-card {
  margin: 8px 16px;
  padding: 14px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  position: relative;
}

.transfer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.transfer-no {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.transfer-status {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
}

.status-draft { background: #f0f0f0; color: #999; }
.status-pending { background: var(--color-warning-soft); color: var(--color-warning); }
.status-approved { background: var(--color-primary-soft); color: var(--color-primary); }
.status-transit { background: var(--color-warning-soft); color: var(--color-warning); }
.status-received { background: var(--color-success-soft); color: var(--color-success); }
.status-cancelled { background: #f0f0f0; color: #999; }

.transfer-stores {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.transfer-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-hint);
}

.arrow-icon {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-hint);
}
</style>