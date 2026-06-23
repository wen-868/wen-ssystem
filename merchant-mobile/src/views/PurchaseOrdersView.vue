<template>
  <div class="purchase-orders-view">
    <van-nav-bar title="采购订单" left-arrow @click-left="$router.back()">
      <template #right>
        <van-icon name="search" size="18" @click="showSearch = !showSearch" />
      </template>
    </van-nav-bar>

    <van-search
      v-if="showSearch"
      v-model="keyword"
      placeholder="搜索采购单号/供应商"
      @search="onSearch"
      @clear="onSearch"
    />

    <van-tabs v-model:active="activeTab" @change="loadData">
      <van-tab title="全部" name="all" />
      <van-tab title="待审核" name="PENDING" />
      <van-tab title="已审核" name="APPROVED" />
      <van-tab title="已入库" name="WAREHOUSED" />
      <van-tab title="已取消" name="CANCELLED" />
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
          :key="item.purchaseNo"
          class="order-card"
          @click="goDetail(item.purchaseNo)"
        >
          <div class="card-header">
            <div class="order-no">{{ item.purchaseNo }}</div>
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
              <span class="label">仓库：</span>
              <span class="value">{{ item.warehouseName }}</span>
            </div>
            <div class="info-row">
              <span class="label">采购金额：</span>
              <span class="value amount">¥{{ formatMoney(item.totalAmount) }}</span>
            </div>
            <div class="info-row">
              <span class="label">已付金额：</span>
              <span class="value">¥{{ formatMoney(item.paidAmount) }}</span>
            </div>
            <div class="info-row" v-if="item.expectedDate">
              <span class="label">预计到货：</span>
              <span class="value">{{ item.expectedDate }}</span>
            </div>
            <div class="info-row">
              <span class="label">创建时间：</span>
              <span class="value">{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>

          <div class="card-footer" v-if="item.status === 'PENDING' || (item.status === 'APPROVED' && item.warehouseStatus !== 'WAREHOUSED')">
            <van-button
              v-if="item.status === 'PENDING'"
              size="small"
              type="primary"
              @click.stop="handleApprove(item)"
            >
              审核通过
            </van-button>
            <van-button
              v-if="item.status === 'APPROVED' && item.warehouseStatus !== 'WAREHOUSED'"
              size="small"
              type="success"
              @click.stop="goWarehousing(item.purchaseNo)"
            >
              入库
            </van-button>
            <van-button
              v-if="item.status === 'PENDING'"
              size="small"
              plain
              @click.stop="handleCancel(item)"
            >
              取消
            </van-button>
          </div>
        </div>

        <van-empty v-if="!loading && list.length === 0" description="暂无采购订单" />
      </van-list>
    </van-pull-refresh>

    <van-button
      type="primary"
      block
      round
      class="create-btn"
      @click="$router.push('/purchase-orders/create')"
    >
      新建采购单
    </van-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import {
  fetchPurchaseOrders,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  type PurchaseOrderRecord
} from '../api'

const router = useRouter()

const keyword = ref('')
const activeTab = ref('all')
const showSearch = ref(false)
const list = ref<PurchaseOrderRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'primary',
    WAREHOUSED: 'success',
    CANCELLED: 'default'
  }
  return map[status] || 'default'
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '已审核',
    WAREHOUSED: '已入库',
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
    if (activeTab.value !== 'all') params.status = activeTab.value

    const res = await fetchPurchaseOrders(params as any)
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

function onSearch() {
  page.value = 1
  finished.value = false
  loadData()
}

function onRefresh() {
  refreshing.value = true
  loadData()
}

function goDetail(purchaseNo: string) {
  router.push(`/purchase-orders/${purchaseNo}`)
}

function goWarehousing(purchaseNo: string) {
  router.push(`/purchase-orders/${purchaseNo}/warehousing`)
}

async function handleApprove(item: PurchaseOrderRecord) {
  try {
    await showConfirmDialog({ title: '确认', message: `确定审核通过采购单 ${item.purchaseNo}？` })
    await approvePurchaseOrder(item.purchaseNo)
    showToast('审核成功')
    onSearch()
  } catch {
    // cancelled
  }
}

async function handleCancel(item: PurchaseOrderRecord) {
  try {
    await showConfirmDialog({ title: '确认', message: `确定取消采购单 ${item.purchaseNo}？` })
    await cancelPurchaseOrder(item.purchaseNo)
    showToast('已取消')
    onSearch()
  } catch {
    // cancelled
  }
}
</script>

<style scoped>
.purchase-orders-view {
  padding-bottom: 70px;
  background: #f5f5f5;
  min-height: 100vh;
}

.order-card {
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

.order-no {
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
