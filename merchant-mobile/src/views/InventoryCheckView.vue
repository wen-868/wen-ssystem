<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showLoadingToast, closeToast } from 'vant'
import { fetchInventoryChecks, createInventoryCheck, type InventoryCheckRecord } from '../api'

const router = useRouter()

const list = ref<InventoryCheckRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const page = ref(1)
const statusFilter = ref('')

const STATUS_MAP: Record<string, string> = {
  DRAFT: '待盘点',
  CHECKING: '盘点中',
  COMPLETED: '已完成',
  CANCELLED: '已取消'
}

const STATUS_OPTIONS = [
  { text: '全部', value: '' },
  { text: '待盘点', value: 'DRAFT' },
  { text: '盘点中', value: 'CHECKING' },
  { text: '已完成', value: 'COMPLETED' },
]

// 新建盘点单
const showCreate = ref(false)
const warehouseId = ref(1)
const createRemark = ref('')
const creating = ref(false)

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.split('T')[0] || dateStr.slice(0, 10)
}

async function loadData() {
  loading.value = true
  try {
    const res = await fetchInventoryChecks({
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

function goExecute(check: InventoryCheckRecord) {
  const id = check.id
  router.push(`/inventory-checks/${id}/execute`)
}

async function handleCreate() {
  creating.value = true
  showLoadingToast({ message: '创建中...', forbidClick: true })
  try {
    await createInventoryCheck({ warehouseId: warehouseId.value, remark: createRemark.value || undefined })
    closeToast()
    showSuccessToast('盘点单已创建')
    showCreate.value = false
    onFilterChange()
  } catch {
    closeToast()
    showToast('创建失败')
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="inventory-check-view">
    <van-nav-bar title="盘点管理" left-arrow @click-left="router.back()">
      <template #right>
        <van-icon name="plus" size="20" @click="showCreate = true" />
      </template>
    </van-nav-bar>

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
      <div v-for="item in list" :key="item.id" class="check-card" @click="goExecute(item)">
        <div class="check-header">
          <span class="check-no">{{ item.check_no || item.checkNo || '#' + item.id }}</span>
          <span class="check-status" :class="'status-' + (item.status?.toLowerCase() || '')">
            {{ STATUS_MAP[item.status] || item.status }}
          </span>
        </div>
        <div class="check-info">
          <span>仓库：{{ item.warehouseName || item.warehouse_name || '-' }}</span>
          <span>SKU数：{{ item.skuCount ?? item.sku_count ?? 0 }}</span>
        </div>
        <div class="check-meta">
          <span v-if="item.diffCount || item.diff_count" class="diff-count">
            差异：{{ item.diffCount ?? item.diff_count }} 项
          </span>
          <span>创建：{{ formatDate(item.createdAt || item.created_at) }}</span>
        </div>
        <van-icon name="arrow" class="arrow-icon" />
      </div>
    </van-list>

    <van-empty v-if="!loading && list.length === 0" description="暂无盘点单" />

    <!-- 新建盘点单弹窗 -->
    <van-popup v-model:show="showCreate" position="bottom" round>
      <div class="create-popup">
        <h3 class="create-title">新建盘点单</h3>
        <van-cell-group inset>
          <van-field v-model.number="warehouseId" label="仓库ID" placeholder="请输入仓库ID" />
          <van-field v-model="createRemark" label="备注" placeholder="选填" />
        </van-cell-group>
        <div class="create-actions">
          <van-button block @click="showCreate = false">取消</van-button>
          <van-button type="primary" block :loading="creating" @click="handleCreate">创建</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.inventory-check-view {
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

.check-card {
  margin: 8px 16px;
  padding: 14px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  position: relative;
}

.check-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.check-no {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.check-status {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
}

.status-draft { background: #f0f0f0; color: #999; }
.status-checking { background: var(--color-warning-soft); color: var(--color-warning); }
.status-completed { background: var(--color-success-soft); color: var(--color-success); }
.status-cancelled { background: #f0f0f0; color: #999; }

.check-info {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.check-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-hint);
}

.diff-count {
  color: var(--color-danger);
}

.arrow-icon {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-hint);
}

.create-popup {
  padding: 24px 16px 32px;
}

.create-title {
  margin: 0 0 16px;
  font-size: 17px;
  font-weight: 600;
  text-align: center;
}

.create-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
</style>