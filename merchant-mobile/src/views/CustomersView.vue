<script setup lang="ts">
import { ref } from 'vue'
import {
  showLoadingToast,
  showSuccessToast,
  closeToast
} from 'vant'
import { fetchCustomers, createCustomer, type CustomerRecord } from '../api'

const keyword = ref('')
const customers = ref<CustomerRecord[]>([])
const loading = ref(false)
const refreshing = ref(false)

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

async function loadCustomers() {
  loading.value = true
  try {
    const res = await fetchCustomers({ keyword: keyword.value })
    customers.value = res.data.data.records ?? res.data.data ?? []
  } catch {
    // ignore
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onSearch() {
  loadCustomers()
}

function onRefresh() {
  refreshing.value = true
  loadCustomers()
}

function openAddPopup() {
  addForm.value = { name: '', mobile: '', customerType: 'RETAIL', settlementType: 'CASH' }
  showAddPopup.value = true
}

async function submitAdd() {
  if (!addForm.value.name.trim()) {
    showSuccessToast({ message: '请输入客户名称', position: 'bottom' })
    return
  }
  if (!addForm.value.mobile.trim()) {
    showSuccessToast({ message: '请输入手机号', position: 'bottom' })
    return
  }
  try {
    showLoadingToast({ message: '提交中...', forbidClick: true })
    await createCustomer(addForm.value)
    closeToast()
    showSuccessToast('客户创建成功')
    showAddPopup.value = false
    await loadCustomers()
  } catch {
    closeToast()
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
      show-action
      @search="onSearch"
      @cancel="onSearch"
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
      <div v-if="loading" class="loading-wrapper">
        <van-loading type="spinner" />
      </div>
      <div v-else-if="customers.length === 0" class="empty-wrapper">
        <van-empty description="暂无客户" />
      </div>
      <van-cell-group v-else inset>
        <van-cell
          v-for="item in customers"
          :key="item.memberId"
          class="customer-cell"
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
          </template>
        </van-cell>
      </van-cell-group>
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
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
}

.record-count {
  font-size: 13px;
  color: var(--text-muted);
}

.loading-wrapper,
.empty-wrapper {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.customer-cell {
  margin-bottom: 8px;
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

.add-panel {
  padding: 20px 16px;
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
