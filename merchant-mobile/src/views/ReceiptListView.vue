<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showLoadingToast, closeToast } from 'vant'
import { fetchReceipts, createReceipt, type ReceiptRecord } from '../api'

const router = useRouter()

const list = ref<ReceiptRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const page = ref(1)
const statusFilter = ref('')

const showCreate = ref(false)
const createCustomerId = ref<number | null>(null)
const createCustomerName = ref('')
const createAmount = ref(0)
const createMethod = ref('CASH')
const createRemark = ref('')
const creating = ref(false)

const METHOD_MAP: Record<string, string> = { CASH: '现金', WECHAT: '微信', ALIPAY: '支付宝', TRANSFER: '转账' }

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
    const res = await fetchReceipts({
      status: statusFilter.value || undefined,
      page: page.value,
      pageSize: 20
    })
    const data = (res.data as any)?.records ?? (res.data as any)?.list ?? res.data
    if (Array.isArray(data)) {
      if (page.value === 1) list.value = data
      else list.value.push(...data)
      if (data.length < 20) finished.value = true
    } else { finished.value = true }
  } catch { showToast('加载失败') }
  finally { loading.value = false }
}

async function onLoad() { page.value++; await loadData() }
function onFilterChange() { page.value = 1; list.value = []; finished.value = false; loadData() }

async function handleCreate() {
  if (!createCustomerId.value || !createAmount.value) { showToast('请填写客户和金额'); return }
  creating.value = true
  showLoadingToast({ message: '提交中...', forbidClick: true })
  try {
    await createReceipt({
      customer_id: createCustomerId.value,
      customer_name: createCustomerName.value,
      amount: createAmount.value,
      payment_method: createMethod.value,
      remark: createRemark.value || undefined
    })
    closeToast()
    showSuccessToast('收款已登记')
    showCreate.value = false
    onFilterChange()
  } catch { closeToast(); showToast('操作失败') }
  finally { creating.value = false }
}

onMounted(() => { loadData() })
</script>

<template>
  <div class="receipt-list-view">
    <van-nav-bar title="收款记录" left-arrow @click-left="router.back()">
      <template #right><van-icon name="plus" size="20" @click="showCreate = true" /></template>
    </van-nav-bar>

    <div class="filter-bar">
      <span class="filter-chip" :class="{ active: statusFilter === '' }" @click="statusFilter = ''; onFilterChange()">全部</span>
      <span class="filter-chip" :class="{ active: statusFilter === 'SUCCESS' }" @click="statusFilter = 'SUCCESS'; onFilterChange()">成功</span>
      <span class="filter-chip" :class="{ active: statusFilter === 'VOIDED' }" @click="statusFilter = 'VOIDED'; onFilterChange()">已作废</span>
    </div>

    <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad">
      <div v-for="item in list" :key="item.id" class="receipt-card">
        <div class="receipt-header">
          <span class="receipt-no">{{ item.receipt_no || item.receiptNo || '#' + item.id }}</span>
          <span class="receipt-status" :class="(item.status || '').toLowerCase() === 'success' ? 'success' : 'voided'">
            {{ item.status === 'SUCCESS' ? '成功' : '已作废' }}
          </span>
        </div>
        <div class="receipt-customer">{{ item.customer_name || item.customerName || '未知客户' }}</div>
        <div class="receipt-info">
          <span class="receipt-amount">¥{{ formatPrice(item.amount) }}</span>
          <span>{{ METHOD_MAP[item.payment_method || item.paymentMethod] || item.payment_method || item.paymentMethod }}</span>
          <span>{{ formatDate(item.created_at || item.createdAt) }}</span>
        </div>
        <div v-if="item.remark" class="receipt-remark">{{ item.remark }}</div>
      </div>
    </van-list>

    <van-empty v-if="!loading && list.length === 0" description="暂无收款记录" />

    <!-- 快速收款弹窗 -->
    <van-popup v-model:show="showCreate" position="bottom" round>
      <div class="create-popup">
        <h3>快速收款</h3>
        <van-cell-group inset>
          <van-field v-model.number="createCustomerId as any" label="客户ID" placeholder="请输入客户ID" />
          <van-field v-model="createCustomerName" label="客户名称" placeholder="请输入客户名称" />
          <van-field v-model.number="createAmount" type="number" label="金额" placeholder="请输入收款金额" />
          <van-field v-model="createMethod" label="方式" placeholder="CASH/WECHAT/ALIPAY/TRANSFER" />
          <van-field v-model="createRemark" label="备注" placeholder="选填" />
        </van-cell-group>
        <div class="create-actions">
          <van-button block @click="showCreate = false">取消</van-button>
          <van-button type="primary" block :loading="creating" @click="handleCreate">确认收款</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.receipt-list-view { min-height: 100vh; background: var(--bg-page); }

.filter-bar { display: flex; gap: 8px; padding: 8px 16px; }
.filter-chip { padding: 5px 14px; border-radius: 20px; font-size: 13px; background: var(--bg-card); color: var(--text-secondary); }
.filter-chip.active { background: var(--color-primary); color: #fff; }

.receipt-card { margin: 8px 16px; padding: 14px; background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }
.receipt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.receipt-no { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.receipt-status { font-size: 12px; padding: 1px 8px; border-radius: 10px; }
.receipt-status.success { background: var(--color-success-soft); color: var(--color-success); }
.receipt-status.voided { background: #f0f0f0; color: #999; }
.receipt-customer { font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.receipt-info { display: flex; gap: 12px; font-size: 13px; color: var(--text-secondary); }
.receipt-amount { font-weight: 700; color: var(--color-primary); font-size: 16px; }
.receipt-remark { font-size: 12px; color: var(--text-hint); margin-top: 4px; }

.create-popup { padding: 24px 16px 32px; }
.create-popup h3 { text-align: center; margin: 0 0 16px; }
.create-actions { display: flex; gap: 10px; margin-top: 20px; }
</style>