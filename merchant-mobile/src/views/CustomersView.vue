<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  showToast,
  showLoadingToast,
  showSuccessToast,
  closeToast
} from 'vant'
import { fetchAdminCustomers, createCustomer, type AdminCustomerRecord } from '../api'

const router = useRouter()

const keyword = ref('')
const customers = ref<AdminCustomerRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const total = ref(0)

const CUSTOMER_TYPE_MAP: Record<string, { text: string; type: string }> = {
  WHOLESALE: { text: '批发', type: 'primary' },
  RETAIL: { text: '零售', type: 'success' }
}

function formatMoney(val: number | null | undefined): string {
  return Number(val ?? 0).toFixed(2)
}

async function loadCustomers(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchAdminCustomers({
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize: 20
    })
    const data = res.data as any
    const items = (data?.records ?? data ?? []) as AdminCustomerRecord[]
    total.value = data?.total ?? items.length
    if (reset) {
      customers.value = items
    } else {
      customers.value.push(...items)
    }
    if (customers.value.length >= total.value) {
      finished.value = true
    }
    page.value++
  } catch {
    showToast('操作失败，请重试')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onSearch() {
  loadCustomers(true)
}

function onCancelSearch() {
  keyword.value = ''
  loadCustomers(true)
}

function onRefresh() {
  refreshing.value = true
  loadCustomers(true)
}

function goToCustomerDetail(memberId: number) {
  router.push({ path: '/customer-detail', query: { memberId: String(memberId) } })
}

// 新增客户
const showCreatePopup = ref(false)
const showCustomerTypePicker = ref(false)
const form = ref({ name: '', mobile: '', customerType: 'WHOLESALE' })
const submitting = ref(false)

const CUSTOMER_TYPE_OPTIONS = [
  { text: '批发', value: 'WHOLESALE' },
  { text: '零售', value: 'RETAIL' }
]

function onCustomerTypeConfirm({ selectedOptions }: any) {
  form.value.customerType = selectedOptions[0]?.value || 'WHOLESALE'
  showCustomerTypePicker.value = false
}

function openCreatePopup() {
  form.value = { name: '', mobile: '', customerType: 'WHOLESALE' }
  showCreatePopup.value = true
}

async function onSubmitCreate() {
  if (!form.value.name.trim()) {
    showToast('请输入客户名称')
    return
  }
  if (!form.value.mobile.trim()) {
    showToast('请输入手机号')
    return
  }
  submitting.value = true
  showLoadingToast({ message: '创建中...', forbidClick: true })
  try {
    await createCustomer(form.value)
    showCreatePopup.value = false
    showSuccessToast('创建成功')
    loadCustomers(true)
  } catch (e: any) {
    showToast(e?.message || '创建失败')
  } finally {
    closeToast()
    submitting.value = false
  }
}
</script>

<template>
  <section class="page">
    <h2 class="page-title">客户</h2>

    <!-- 搜索栏 -->
    <van-search
      v-model="keyword"
      placeholder="搜索客户名/手机号"
      shape="round"
      clearable
      @search="onSearch"
      @cancel="onCancelSearch"
    />

    <div class="action-bar">
      <span class="record-count">共 {{ total }} 位客户</span>
      <van-button size="small" type="primary" @click="openCreatePopup">新增客户</van-button>
    </div>

    <!-- 客户列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadCustomers(false)"
      >
        <div v-if="customers.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无客户" />
        </div>
        <van-cell
          v-for="item in customers"
          :key="item.memberId"
          is-link
          class="customer-cell"
          @click="goToCustomerDetail(item.memberId)"
        >
          <template #title>
            <div class="customer-header">
              <span class="customer-name">{{ item.name }}</span>
              <van-tag
                :type="(CUSTOMER_TYPE_MAP[item.customerType]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ CUSTOMER_TYPE_MAP[item.customerType]?.text || item.customerType }}
              </van-tag>
            </div>
          </template>
          <template #label>
            <div class="customer-info">
              <span>{{ item.mobile || '-' }}</span>
              <span class="customer-stats">
                <span class="stat-item">累计消费 ¥{{ formatMoney(item.totalSpent) }}</span>
                <span v-if="item.arrears > 0" class="stat-item arrears">欠款 ¥{{ formatMoney(item.arrears) }}</span>
              </span>
            </div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 新增客户弹窗 -->
    <van-popup v-model:show="showCreatePopup" position="bottom" round :style="{ height: '60%' }">
      <div class="create-popup">
        <h3 class="popup-title">新增客户</h3>
        <van-form @submit="onSubmitCreate">
          <van-cell-group inset>
            <van-field
              v-model="form.name"
              name="name"
              label="客户名称"
              placeholder="请输入客户名称"
              :rules="[{ required: true, message: '请输入客户名称' }]"
            />
            <van-field
              v-model="form.mobile"
              name="mobile"
              label="手机号"
              placeholder="请输入手机号"
              type="tel"
              :rules="[{ required: true, message: '请输入手机号' }]"
            />
            <van-field
              v-model="form.customerType"
              name="customerType"
              label="客户类型"
              is-link
              readonly
              clickable
              @click="showCustomerTypePicker = true"
            />
          </van-cell-group>
          <div style="margin: 16px">
            <van-button round block type="primary" native-type="submit" :loading="submitting">
              提交
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>

    <!-- 客户类型选择器 -->
    <van-popup v-model:show="showCustomerTypePicker" position="bottom">
      <van-picker
        :columns="CUSTOMER_TYPE_OPTIONS"
        @confirm="onCustomerTypeConfirm"
        @cancel="showCustomerTypePicker = false"
      />
    </van-popup>
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
  justify-content: space-between;
  padding: 8px var(--space-page-padding);
}

.record-count {
  font-size: 13px;
  color: var(--text-muted);
}

.empty-wrapper {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.customer-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.customer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.customer-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.customer-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}

.customer-stats {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.stat-item {
  color: var(--text-secondary);
}

.stat-item.arrears {
  color: var(--color-danger);
}

.create-popup {
  padding: 20px 0;
}

.popup-title {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
}
</style>