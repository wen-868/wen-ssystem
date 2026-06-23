<template>
  <div class="sale-returns-view">
    <van-nav-bar title="销售退货" left-arrow @click-left="$router.back()" />
    
    <van-search
      v-model="keyword"
      placeholder="搜索退货单号/客户"
      @search="loadData"
    />
    
    <van-tabs v-model:active="activeTab" @change="loadData">
      <van-tab title="全部" name="all" />
      <van-tab title="待审核" name="PENDING" />
      <van-tab title="已完成" name="COMPLETED" />
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
          :key="item.returnNo"
          class="return-card"
          @click="goDetail(item.returnNo)"
        >
          <div class="card-header">
            <div class="return-no">{{ item.returnNo }}</div>
            <van-tag :type="getStatusType(item.returnStatus)">
              {{ getStatusText(item.returnStatus) }}
            </van-tag>
          </div>
          
          <div class="card-body">
            <div class="info-row">
              <span class="label">客户：</span>
              <span class="value">{{ item.customerName || '散客' }}</span>
            </div>
            <div class="info-row" v-if="item.sourceBillNo">
              <span class="label">原销售单：</span>
              <span class="value">{{ item.sourceBillNo }}</span>
            </div>
            <div class="info-row">
              <span class="label">退货金额：</span>
              <span class="value amount">¥{{ formatMoney(item.returnAmount) }}</span>
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
      @click="$router.push('/sale-returns/create')"
    >
      创建退货单
    </van-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchSaleReturns, type SaleReturnRecord } from '../api'

const router = useRouter()

const keyword = ref('')
const activeTab = ref('all')
const list = ref<SaleReturnRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)

async function loadData() {
  if (loading.value) return
  
  loading.value = true
  
  try {
    const params: any = {
      page: 1,
      pageSize: 20,
      keyword: keyword.value
    }
    
    if (activeTab.value !== 'all') {
      params.returnStatus = activeTab.value
    }
    
    const res = await fetchSaleReturns(params)
    const data = res.data
    
    if (refreshing.value) {
      list.value = []
      refreshing.value = false
    }
    
    list.value = [...list.value, ...(data.records || [])]
    finished.value = list.value.length >= (data.total || 0)
  } catch (error) {
    console.error('加载退货单失败', error)
  } finally {
    loading.value = false
  }
}

function onRefresh() {
  finished.value = false
  loadData()
}

function goDetail(returnNo: string) {
  router.push(`/sale-returns/${returnNo}`)
}

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

function formatMoney(amount: number) {
  return amount.toFixed(2)
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.sale-returns-view {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.return-card {
  background: white;
  margin: 12px;
  border-radius: 8px;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.return-no {
  font-weight: 500;
  font-size: 15px;
}

.card-body {
  padding: 12px 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.label {
  color: #999;
  font-size: 14px;
}

.value {
  color: #333;
  font-size: 14px;
}

.amount {
  color: #ee0a24;
  font-weight: 500;
}

.create-btn {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  margin: 12px;
  width: calc(100% - 24px);
}
</style>
