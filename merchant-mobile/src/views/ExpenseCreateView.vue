<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showLoadingToast, closeToast } from 'vant'
import { createExpense, fetchExpenses, type ExpenseRecord } from '../api'

const router = useRouter()

const tab = ref<'create' | 'list'>('create')
const expenses = ref<ExpenseRecord[]>([])
const listLoading = ref(false)

const type = ref('日常')
const category = ref('')
const amount = ref(0)
const payee = ref('')
const method = ref('CASH')
const remark = ref('')
const invoiceUrl = ref('')
const creating = ref(false)

const TYPES = ['日常', '差旅', '办公', '运输']
const TYPE_CATEGORIES: Record<string, string[]> = {
  '日常': ['水电', '房租', '工资', '通讯', '其他'],
  '差旅': ['交通', '住宿', '餐饮', '其他'],
  '办公': ['文具', '耗材', '设备', '其他'],
  '运输': ['油费', '过路费', '维修', '其他']
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.split('T')[0] || dateStr.slice(0, 10)
}
function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

async function loadExpenses() {
  listLoading.value = true
  try {
    const res = await fetchExpenses({ page: 1, pageSize: 30 })
    const data = (res.data as any)?.records ?? res.data
    expenses.value = Array.isArray(data) ? data : []
  } catch { /* ignore */ }
  finally { listLoading.value = false }
}

async function handleCreate() {
  if (!amount.value || !payee.value) { showToast('请填写金额和收款方'); return }
  creating.value = true
  showLoadingToast({ message: '提交中...', forbidClick: true })
  try {
    await createExpense({
      type: type.value,
      category: category.value || type.value,
      amount: amount.value,
      payee: payee.value,
      paymentMethod: method.value,
      remark: remark.value || undefined,
      invoiceUrl: invoiceUrl.value || undefined
    })
    closeToast()
    showSuccessToast('费用已登记')
    amount.value = 0; payee.value = ''; remark.value = ''; invoiceUrl.value = ''
    tab.value = 'list'
    await loadExpenses()
  } catch { closeToast(); showToast('操作失败') }
  finally { creating.value = false }
}

onMounted(() => { loadExpenses() })
</script>

<template>
  <div class="expense-create-view">
    <van-nav-bar title="费用登记" left-arrow @click-left="router.back()" />

    <van-tabs v-model:active="tab">
      <van-tab title="登记" name="create">
        <div class="form-section">
          <!-- 费用类型 -->
          <div class="field-group">
            <label>费用类型</label>
            <div class="type-chips">
              <span v-for="t in TYPES" :key="t" class="type-chip" :class="{ active: type === t }" @click="type = t">
                {{ t }}
              </span>
            </div>
          </div>

          <van-cell-group inset>
            <van-field
              v-model="category"
              is-link
              readonly
              label="分类"
              placeholder="选择分类"
              @click="showToast('开发中')"
            />
            <van-field v-model.number="amount" type="number" label="金额" placeholder="请输入金额" />
            <van-field v-model="payee" label="收款方" placeholder="请输入收款方" />
            <van-field v-model="method" label="支付方式" placeholder="CASH/WECHAT/ALIPAY/TRANSFER" />
            <van-field v-model="remark" label="备注" placeholder="选填" />
            <van-field
              v-model="invoiceUrl"
              label="发票"
              placeholder="点击上传发票照片"
              is-link
              readonly
              @click="showToast('拍照上传功能开发中')"
            />
          </van-cell-group>

          <div class="submit-section">
            <van-button type="primary" size="large" round block :loading="creating" @click="handleCreate">确认登记</van-button>
          </div>
        </div>
      </van-tab>

      <van-tab title="记录" name="list">
        <van-loading v-if="listLoading" class="loading-center" />
        <div v-else class="expense-list">
          <div v-for="e in expenses" :key="e.expenseNo || e.expense_no" class="expense-card">
            <div class="e-header">
              <span class="e-type">{{ e.type }} / {{ e.category }}</span>
              <span class="e-amount">¥{{ formatPrice(e.amount) }}</span>
            </div>
            <div class="e-info">
              <span>收款方：{{ e.payee }}</span>
              <span>{{ formatDate(e.createdAt || e.created_at) }}</span>
            </div>
            <div v-if="e.remark" class="e-remark">{{ e.remark }}</div>
          </div>
          <van-empty v-if="expenses.length === 0" description="暂无费用记录" />
        </div>
      </van-tab>
    </van-tabs>
  </div>
</template>

<style scoped>
.expense-create-view { min-height: 100vh; background: var(--bg-page); padding-bottom: 24px; }
.loading-center { padding: 40px 0; display: flex; justify-content: center; }

.form-section { padding: 12px 16px; }

.field-group { margin-bottom: 12px; }
.field-group label { font-size: 14px; font-weight: 500; color: var(--text-primary); display: block; margin-bottom: 8px; }

.type-chips { display: flex; gap: 8px; }
.type-chip { padding: 6px 16px; border-radius: 20px; font-size: 13px; background: var(--bg-card); color: var(--text-secondary); }
.type-chip.active { background: var(--color-primary); color: #fff; }

.submit-section { padding: 20px 0; }

.expense-list { padding: 12px 16px; }

.expense-card { margin-bottom: 10px; padding: 14px; background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }
.e-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.e-type { font-size: 14px; font-weight: 500; color: var(--text-primary); }
.e-amount { font-size: 16px; font-weight: 700; color: var(--color-danger); }
.e-info { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); }
.e-remark { font-size: 12px; color: var(--text-hint); margin-top: 4px; }
</style>