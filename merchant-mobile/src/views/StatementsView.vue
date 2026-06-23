<template>
  <div class="statements-view">
    <van-nav-bar title="客户往来账" left-arrow @click-left="$router.back()" />

    <van-search
      v-model="keyword"
      placeholder="搜索对账单号/客户名"
      @search="loadData"
    />

    <van-tabs v-model:active="activeTab" @change="loadData">
      <van-tab title="全部" name="all" />
      <van-tab title="待确认" name="PENDING" />
      <van-tab title="已确认" name="CONFIRMED" />
      <van-tab title="有异议" name="DISPUTED" />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadData"
      >
        <div
          v-for="item in list"
          :key="item.statementNo"
          class="statement-card"
          @click="goDetail(item.statementNo)"
        >
          <div class="card-header">
            <div class="statement-no">{{ item.statementNo }}</div>
            <van-tag :type="getStatusType(item.status) as any">
              {{ getStatusText(item.status) }}
            </van-tag>
          </div>

          <div class="card-body">
            <div class="info-row">
              <span class="label">客户：</span>
              <span class="value">{{ item.customerName }}</span>
            </div>
            <div class="info-row">
              <span class="label">账期：</span>
              <span class="value">{{ item.periodStart }} ~ {{ item.periodEnd }}</span>
            </div>
            <div class="info-row">
              <span class="label">期初余额：</span>
              <span class="value">¥{{ formatMoney(item.openingBalance) }}</span>
            </div>
            <div class="info-row">
              <span class="label">本期应收：</span>
              <span class="value">¥{{ formatMoney(item.periodReceivable) }}</span>
            </div>
            <div class="info-row">
              <span class="label">本期已收：</span>
              <span class="value">¥{{ formatMoney(item.periodReceived) }}</span>
            </div>
            <div class="info-row">
              <span class="label">期末余额：</span>
              <span class="value amount" :class="{ positive: item.closingBalance > 0 }">
                ¥{{ formatMoney(item.closingBalance) }}
              </span>
            </div>
            <div class="info-row">
              <span class="label">生成时间：</span>
              <span class="value">{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>

          <div class="card-footer" v-if="item.status === 'CONFIRMED' && item.closingBalance > 0">
            <van-button
              size="small"
              type="primary"
              @click.stop="goPayment(item)"
            >
              登记付款
            </van-button>
          </div>
        </div>

        <van-empty v-if="!loading && list.length === 0" description="暂无对账单" />
      </van-list>
    </van-pull-refresh>

    <van-button
      type="primary"
      block
      round
      class="create-btn"
      @click="$router.push('/statements/create')"
    >
      生成对账单
    </van-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchStatements, type StatementRecord } from '../api'

const router = useRouter()

const keyword = ref('')
const activeTab = ref('all')
const list = ref<StatementRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: 'warning',
    CONFIRMED: 'primary',
    DISPUTED: 'danger'
  }
  return map[status] || 'default'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: '待确认',
    CONFIRMED: '已确认',
    DISPUTED: '有异议'
  }
  return map[status] || status
}

function formatMoney(val: number) {
  return (val || 0).toFixed(2)
}

function formatDate(str: string) {
  if (!str) return ''
  return str.replace('T', ' ').slice(0, 16)
}

async function loadData() {
  if (refreshing.value) {
    page.value = 1
    finished.value = false
    refreshing.value = false
  }

  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize
    }
    if (keyword.value) params.keyword = keyword.value
    if (activeTab.value !== 'all') params.status = activeTab.value

    const res = await fetchStatements(params as any)
    const data = res.data as any
    const records = data?.records || data?.list || data || []

    if (page.value === 1) {
      list.value = records
    } else {
      list.value.push(...records)
    }

    if (records.length < pageSize) {
      finished.value = true
    } else {
      page.value++
    }
  } catch {
    finished.value = true
  } finally {
    loading.value = false
  }
}

function onRefresh() {
  refreshing.value = true
  loadData()
}

function goDetail(statementNo: string) {
  router.push(`/statements/${statementNo}`)
}

function goPayment(item: StatementRecord) {
  router.push({
    path: `/statements/${item.statementNo}/payment`,
    query: {
      customerName: item.customerName,
      closingBalance: item.closingBalance.toString()
    }
  })
}
</script>

<style scoped>
.statements-view {
  padding-bottom: 70px;
  background: #f5f5f5;
  min-height: 100vh;
}

.statement-card {
  margin: 10px 12px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid #f0f0f0;
}

.statement-no {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.card-body {
  padding: 10px 14px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
}

.label {
  color: #999;
}

.value {
  color: #333;
}

.amount {
  color: #10b981;
  font-weight: 600;
}

.amount.positive {
  color: #ef4444;
}

.card-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 8px 14px 12px;
  border-top: 1px solid #f0f0f0;
}

.create-btn {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  margin: 0;
  border-radius: 0;
  z-index: 100;
}
</style>
