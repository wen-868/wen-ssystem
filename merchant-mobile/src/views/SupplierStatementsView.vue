<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showLoadingToast, closeToast } from 'vant'
import { fetchSupplierStatements, generateSupplierStatement, fetchSuppliers, type SupplierStatementRecord, type SupplierRecord } from '../api'

const router = useRouter()

const list = ref<SupplierStatementRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const page = ref(1)
const pageSize = 20

const statusFilter = ref('')
const generated = ref(false)

const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  DISPUTED: '争议',
  PAID: '已结清'
}

const STATUS_OPTIONS = [
  { text: '全部', value: '' },
  { text: '草稿', value: 'DRAFT' },
  { text: '已确认', value: 'CONFIRMED' },
  { text: '争议', value: 'DISPUTED' },
  { text: '已结清', value: 'PAID' },
]

// 生成对账单
const showGenerate = ref(false)
const showSupplierPicker = ref(false)
const suppliers = ref<SupplierRecord[]>([])
const genSupplierId = ref<number | null>(null)
const genSupplierName = ref('')
const genStartDate = ref('')
const genEndDate = ref('')
const genRemark = ref('')
const generating = ref(false)

function getDefaultMonthRange(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
    end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  }
}

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
    const res = await fetchSupplierStatements({
      status: statusFilter.value || undefined,
      page: page.value,
      pageSize
    })
    const data = (res.data as any)?.records ?? (res.data as any)?.list ?? res.data
    if (Array.isArray(data)) {
      if (page.value === 1) list.value = data
      else list.value.push(...data)
      if (data.length < pageSize) finished.value = true
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

async function openGenerate() {
  const range = getDefaultMonthRange()
  genStartDate.value = range.start
  genEndDate.value = range.end
  genRemark.value = ''
  genSupplierId.value = null
  genSupplierName.value = ''

  try {
    const res = await fetchSuppliers({ page: 1, pageSize: 200 })
    const data = (res.data as any)?.records ?? (res.data as any)?.list ?? res.data
    suppliers.value = Array.isArray(data) ? data : []
  } catch {
    showToast('加载供应商失败')
    return
  }
  showGenerate.value = true
}

function selectSupplier(s: SupplierRecord) {
  genSupplierId.value = s.id
  genSupplierName.value = s.name
}

async function handleGenerate() {
  if (!genSupplierId.value) {
    showToast('请选择供应商')
    return
  }
  if (!genStartDate.value || !genEndDate.value) {
    showToast('请选择日期范围')
    return
  }

  generating.value = true
  showLoadingToast({ message: '生成中...', forbidClick: true })
  try {
    await generateSupplierStatement({
      supplier_id: genSupplierId.value,
      supplier_name: genSupplierName.value,
      start_date: genStartDate.value,
      end_date: genEndDate.value,
      remark: genRemark.value || undefined
    })
    closeToast()
    showSuccessToast('对账单已生成')
    showGenerate.value = false
    generated.value = true
    onFilterChange()
  } catch {
    closeToast()
    showToast('生成失败')
  } finally {
    generating.value = false
  }
}

function goDetail(statementNo: string) {
  router.push(`/supplier-statements/${statementNo}`)
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="supplier-statements-view">
    <van-nav-bar title="供应商对账" left-arrow @click-left="router.back()">
      <template #right>
        <van-icon name="plus" size="20" @click="openGenerate" />
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

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="onLoad"
    >
      <div v-for="item in list" :key="item.id" class="statement-card" @click="goDetail(item.statement_no || item.statementNo)">
        <div class="statement-header">
          <span class="statement-no">{{ item.statement_no || item.statementNo }}</span>
          <span class="statement-status" :class="'status-' + (item.status?.toLowerCase() || '')">
            {{ STATUS_MAP[item.status] || item.status }}
          </span>
        </div>
        <div class="statement-supplier">{{ item.supplier_name || item.supplierName }}</div>
        <div class="statement-period">
          {{ formatDate(item.start_date || item.startDate) }} ~ {{ formatDate(item.end_date || item.endDate) }}
        </div>
        <div class="statement-amounts">
          <div class="amount-row">
            <span>期初余额</span>
            <span>¥{{ formatPrice(item.opening_balance ?? item.openingBalance) }}</span>
          </div>
          <div class="amount-row">
            <span>本期采购</span>
            <span class="amount-positive">+¥{{ formatPrice(item.total_purchase ?? item.totalPurchase) }}</span>
          </div>
          <div class="amount-row">
            <span>本期退货</span>
            <span class="amount-negative">-¥{{ formatPrice(item.total_returns ?? item.totalReturns) }}</span>
          </div>
          <div class="amount-row">
            <span>本期付款</span>
            <span class="amount-negative">-¥{{ formatPrice(item.total_payments ?? item.totalPayments) }}</span>
          </div>
          <div class="amount-row amount-row--total">
            <span>期末余额</span>
            <span class="amount-closing">¥{{ formatPrice(item.closing_balance ?? item.closingBalance) }}</span>
          </div>
        </div>
        <van-icon name="arrow" class="arrow-icon" />
      </div>
    </van-list>

    <van-empty v-if="!loading && list.length === 0" description="暂无对账单" />

    <!-- 生成对账单弹窗 -->
    <van-popup v-model:show="showGenerate" position="bottom" round :style="{ maxHeight: '80vh' }">
      <div class="generate-popup">
        <h3 class="generate-title">生成对账单</h3>

        <van-cell-group inset>
          <van-field
            v-model="genSupplierName"
            is-link
            readonly
            label="供应商"
            placeholder="点击选择供应商"
            @click="showSupplierPicker = true"
          />
          <van-field v-model="genStartDate" label="开始日期" placeholder="yyyy-MM-dd" />
          <van-field v-model="genEndDate" label="结束日期" placeholder="yyyy-MM-dd" />
          <van-field v-model="genRemark" label="备注" placeholder="选填" />
        </van-cell-group>

        <div class="generate-actions">
          <van-button block @click="showGenerate = false">取消</van-button>
          <van-button type="primary" block :loading="generating" @click="handleGenerate">生成对账单</van-button>
        </div>
      </div>
    </van-popup>

    <!-- 供应商选择器 -->
    <van-action-sheet
      v-model:show="showSupplierPicker"
      :actions="suppliers.map(s => ({ name: s.name, description: s.shortName || s.supplyType, value: s.id }))"
      @select="(a: any) => { selectSupplier(suppliers.find(s => s.id === a.value)!); showSupplierPicker = false }"
    />
  </div>
</template>

<style scoped>
.supplier-statements-view {
  min-height: 100vh;
  background: var(--bg-page);
}

.filter-bar {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  overflow-x: auto;
  white-space: nowrap;
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

.statement-card {
  margin: 8px 16px;
  padding: 14px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  position: relative;
}

.statement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.statement-no {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.statement-status {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
}

.status-draft {
  background: #f0f0f0;
  color: #999;
}

.status-confirmed {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.status-disputed {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.status-paid {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.statement-supplier {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.statement-period {
  font-size: 12px;
  color: var(--text-hint);
  margin-bottom: 8px;
}

.statement-amounts {
  background: var(--bg-page);
  border-radius: 8px;
  padding: 8px 10px;
}

.amount-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 2px 0;
}

.amount-row--total {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--border-normal);
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}

.amount-positive {
  color: var(--color-success);
}

.amount-negative {
  color: var(--color-danger);
}

.amount-closing {
  color: var(--color-primary);
  font-weight: 700;
}

.arrow-icon {
  position: absolute;
  right: 14px;
  top: 14px;
  color: var(--text-hint);
  font-size: 14px;
}

/* 生成弹窗 */
.generate-popup {
  padding: 24px 16px 32px;
}

.generate-title {
  margin: 0 0 16px;
  font-size: 17px;
  font-weight: 600;
  text-align: center;
}

.generate-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
</style>