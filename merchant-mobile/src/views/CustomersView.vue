<script setup lang="ts">
import { ref } from 'vue'
import {
  showLoadingToast,
  showSuccessToast,
  showToast,
  closeToast
} from 'vant'
import { fetchCustomers, createCustomer, type CustomerRecord } from '../api'

const keyword = ref('')
const customers = ref<CustomerRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)

// 新增客户弹窗
const showAddPopup = ref(false)
const addForm = ref({
  name: '',
  mobile: '',
  customerType: 'RETAIL',
  settlementType: 'CASH'
})

const CUSTOMER_TYPE_MAP: Record<string, { text: string; type: string }> = {
  WHOLESALE: { text: '批发', type: 'primary' },
  RETAIL: { text: '零售', type: 'success' }
}

const SETTLEMENT_TYPE_MAP: Record<string, string> = {
  CASH: '现结',
  ACCOUNT: '账期'
}

async function loadCustomers(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchCustomers({
      keyword: keyword.value || undefined
    })
    const data = res.data
    const items = data?.records ?? data ?? []
    if (reset) {
      customers.value = items
    } else {
      customers.value.push(...items)
    }
    if (customers.value.length >= (data?.total ?? items.length)) {
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

function openAddPopup() {
  addForm.value = { name: '', mobile: '', customerType: 'RETAIL', settlementType: 'CASH' }
  showAddPopup.value = true
}

async function submitAdd() {
  if (!addForm.value.name.trim()) {
    showToast('请输入客户名称')
    return
  }
  if (!addForm.value.mobile.trim()) {
    showToast('请输入手机号')
    return
  }
  if (!/^1[3-9]\d{9}$/.test(addForm.value.mobile)) {
    showToast('手机号格式不正确')
    return
  }
  try {
    showLoadingToast({ message: '提交中...', forbidClick: true })
    await createCustomer(addForm.value)
    closeToast()
    showSuccessToast('客户创建成功')
    showAddPopup.value = false
    await loadCustomers(true)
  } catch {
    closeToast()
    showToast('操作失败，请重试')
  }
}

function goToCustomerDetail(memberId: number) {
  window.dispatchEvent(new CustomEvent('nav', { detail: 'customer-detail' }))
  // 存储当前查看的客户ID
  localStorage.setItem('merchant_customer_detail_id', String(memberId))
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

    <!-- 新增按钮 -->
    <div class="action-bar">
      <van-button type="primary" size="small" icon="plus" @click="openAddPopup">
        新增客户
      </van-button>
      <span class="record-count">共 {{ customers.length }} 位客户</span>
    </div>

    <!-- 客户列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadCustomers"
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
              <span class="settlement-type">
                {{ SETTLEMENT_TYPE_MAP[item.settlementType || 'CASH'] || '现结' }}
              </span>
            </div>
            <div class="customer-stats">
              <span class="stat-item">
                <span class="stat-label">累计消费</span>
                <span class="stat-value">-</span>
              </span>
              <span class="stat-item">
                <span class="stat-label">欠款</span>
                <span class="stat-value stat-value--debt">-</span>
              </span>
            </div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 新增客户弹窗 -->
    <van-popup
      v-model:show="showAddPopup"
      position="bottom"
      round
      :style="{ maxHeight: '70%' }"
    >
      <div class="add-panel">
        <h3>新增客户</h3>
        <van-cell-group inset>
          <van-field
            v-model="addForm.name"
            label="客户名"
            placeholder="请输入客户名称"
            required
          />
          <van-field
            v-model="addForm.mobile"
            label="手机号"
            placeholder="请输入手机号"
            type="tel"
            required
          />
          <van-cell title="客户类型" is-link>
            <template #value>
              <van-radio-group v-model="addForm.customerType" direction="horizontal">
                <van-radio name="RETAIL">零售</van-radio>
                <van-radio name="WHOLESALE">批发</van-radio>
              </van-radio-group>
            </template>
          </van-cell>
          <van-cell title="结算方式" is-link>
            <template #value>
              <van-radio-group v-model="addForm.settlementType" direction="horizontal">
                <van-radio name="CASH">现结</van-radio>
                <van-radio name="ACCOUNT">账期</van-radio>
              </van-radio-group>
            </template>
          </van-cell>
        </van-cell-group>
        <div class="add-actions">
          <van-button block type="primary" @click="submitAdd">确认新增</van-button>
        </div>
      </div>
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

.settlement-type {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-soft);
  padding: 2px 8px;
  border-radius: 4px;
}

.customer-stats {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 11px;
  color: var(--text-muted);
}

.stat-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-value--debt {
  color: var(--color-danger);
}

.add-panel {
  padding: 20px var(--space-card-padding);
}

.add-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.add-actions {
  margin-top: 20px;
}
</style>
