<template>
  <div class="purchase-returns-view">
    <van-nav-bar title="采购退货" left-arrow @click-left="$router.back()" />

    <van-search
      v-model="keyword"
      placeholder="搜索退货单号/供应商"
      @search="loadData"
    />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadData"
      >
        <div
          v-for="item in list"
          :key="item.returnNo"
          class="return-card"
          @click="goDetail(item.returnNo)"
        >
          <div class="card-header">
            <div class="return-no">{{ item.returnNo }}</div>
            <van-tag :type="getStatusType(item.status) as any">
              {{ getStatusText(item.status) }}
            </van-tag>
          </div>

          <div class="card-body">
            <div class="info-row">
              <span class="label">供应商：</span>
              <span class="value">{{ item.supplierName }}</span>
            </div>
            <div class="info-row">
              <span class="label">采购单号：</span>
              <span class="value">{{ item.purchaseNo }}</span>
            </div>
            <div class="info-row">
              <span class="label">退货金额：</span>
              <span class="value amount">¥{{ formatMoney(item.returnAmount) }}</span>
            </div>
            <div class="info-row">
              <span class="label">退货原因：</span>
              <span class="value">{{ item.reason }}</span>
            </div>
            <div class="info-row">
              <span class="label">创建时间：</span>
              <span class="value">{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>
        </div>

        <van-empty v-if="!loading && list.length === 0" description="暂无退货单" />
      </van-list>
    </van-pull-refresh>

    <van-button
      type="primary"
      block
      round
      class="create-btn"
      @click="$router.push('/purchase-returns/create')"
    >
      创建退货单
    </van-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchPurchaseReturns, type PurchaseReturnRecord } from '../api'

const router = useRouter()

const keyword = ref('')
const list = ref<PurchaseReturnRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'primary',
    COMPLETED: 'success',
    CANCELLED: 'default'
  }
  return map[status] || 'default'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '已审核',
    COMPLETED: '已完成',
    CANCELLED: '已取消'
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

    const res = await fetchPurchaseReturns(params as any)
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

function goDetail(returnNo: string) {
  router.push(`/purchase-returns/${returnNo}`)
}
</script>

<style scoped>
.purchase-returns-view {
  padding-bottom: 70px;
  background: #f5f5f5;
  min-height: 100vh;
}

.return-card {
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

.return-no {
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
  color: #ee0a24;
  font-weight: 600;
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
