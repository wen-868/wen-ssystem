<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showLoadingToast, showSuccessToast, closeToast } from 'vant'
import {
  fetchInstantRetailOrders,
  confirmInstantRetailOrder,
  cancelInstantRetailOrder,
  type InstantRetailOrder
} from '../../api'

const router = useRouter()

const PLATFORM_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
  JD: { label: '京东秒送', color: '#fff', bgColor: '#E2231A' },
  MEITUAN: { label: '美团外卖', color: '#fff', bgColor: '#FFD101' },
  ELEME: { label: '饿了么', color: '#fff', bgColor: '#0097FF' }
}

const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '待接单', value: 'PENDING' },
  { label: '已接单', value: 'CONFIRMED' },
  { label: '配送中', value: 'DELIVERING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' }
]

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  PENDING: { text: '待接单', type: 'warning' },
  CONFIRMED: { text: '已接单', type: 'primary' },
  DELIVERING: { text: '配送中', type: 'primary' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已取消', type: 'default' }
}

const PLATFORM_TABS = [
  { label: '全部平台', value: '' },
  { label: '京东', value: 'JD' },
  { label: '美团', value: 'MEITUAN' },
  { label: '饿了么', value: 'ELEME' }
]

const activeTab = ref('')
const activePlatform = ref('')
const orders = ref<InstantRetailOrder[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

const summary = ref({
  todayCount: 0,
  pendingCount: 0,
  deliveringCount: 0,
  completedCount: 0
})

async function loadSummary() {
  try {
    const res = await fetchInstantRetailOrders({ page: 1, pageSize: 1 })
    const data = res.data
    summary.value = {
      todayCount: data.total || 0,
      pendingCount: 0,
      deliveringCount: 0,
      completedCount: 0
    }
  } catch {
    // ignore
  }
}

async function loadOrders(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchInstantRetailOrders({
      page: page.value,
      pageSize,
      platform: activePlatform.value || undefined,
      status: activeTab.value || undefined
    })
    const data = res.data
    const records = data.records ?? []
    if (reset) {
      orders.value = records
    } else {
      orders.value.push(...records)
    }
    if (orders.value.length >= (data.total ?? 0)) {
      finished.value = true
    }
    page.value++
  } catch {
    // ignore
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onRefresh() {
  refreshing.value = true
  loadSummary()
  loadOrders(true)
}

function onTabChange() {
  loadOrders(true)
}

function onPlatformChange() {
  loadOrders(true)
}

function goToDetail(order: InstantRetailOrder) {
  router.push({
    name: 'instant-retail-order-detail',
    params: { platformOrderId: order.platformOrderId }
  })
}

async function handleConfirm(order: InstantRetailOrder) {
  try {
    await showDialog({
      title: '确认接单',
      message: '确认接受该订单？接单后请及时备货并安排配送。'
    })
    showLoadingToast({ message: '处理中...', forbidClick: true })
    await confirmInstantRetailOrder(order.platformOrderId)
    closeToast()
    showSuccessToast('接单成功')
    loadSummary()
    loadOrders(true)
  } catch {
    closeToast()
  }
}

async function handleCancel(order: InstantRetailOrder) {
  try {
    await showDialog({
      title: '取消订单',
      message: '确认取消该订单？取消后将同步至平台。'
    })
    showLoadingToast({ message: '处理中...', forbidClick: true })
    await cancelInstantRetailOrder(order.platformOrderId, '商家取消')
    closeToast()
    showSuccessToast('已取消')
    loadOrders(true)
  } catch {
    closeToast()
  }
}

function getPlatformInfo(platform: string) {
  return PLATFORM_MAP[platform] || { label: platform, color: '#333', bgColor: '#eee' }
}

function parseOrderItems(order: InstantRetailOrder) {
  try {
    const data = JSON.parse(order.orderDataJson || '{}')
    return data.items || []
  } catch {
    return []
  }
}

onMounted(() => {
  loadSummary()
  loadOrders()
})
</script>

<template>
  <section class="page">
    <h2 class="page-title">即时零售订单</h2>

    <!-- 数据概览 -->
    <div class="overview-card">
      <div class="overview-item">
        <span class="overview-num">{{ summary.todayCount }}</span>
        <span class="overview-label">今日订单</span>
      </div>
      <div class="overview-item warning">
        <span class="overview-num">{{ summary.pendingCount }}</span>
        <span class="overview-label">待接单</span>
      </div>
      <div class="overview-item primary">
        <span class="overview-num">{{ summary.deliveringCount }}</span>
        <span class="overview-label">配送中</span>
      </div>
      <div class="overview-item success">
        <span class="overview-num">{{ summary.completedCount }}</span>
        <span class="overview-label">已完成</span>
      </div>
    </div>

    <!-- 平台筛选 -->
    <div class="platform-filter">
      <van-tabs v-model:active="activePlatform" line-width="0" @change="onPlatformChange">
        <van-tab
          v-for="tab in PLATFORM_TABS"
          :key="tab.value"
          :title="tab.label"
          :name="tab.value"
        />
      </van-tabs>
    </div>

    <!-- 状态筛选 -->
    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab
        v-for="tab in STATUS_TABS"
        :key="tab.value"
        :title="tab.label"
        :name="tab.value"
      />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadOrders"
      >
        <div v-if="orders.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无订单" />
        </div>
      <div class="order-card" v-for="order in orders" :key="order.id" @click="goToDetail(order)">
        <div class="order-header">
          <div class="platform-tag" :style="{ backgroundColor: getPlatformInfo(order.platform).bgColor, color: getPlatformInfo(order.platform).color }">
            {{ getPlatformInfo(order.platform).label }}
          </div>
          <van-tag :type="(STATUS_MAP[order.status]?.type as any) || 'default'" plain size="medium">
            {{ STATUS_MAP[order.status]?.text || order.status }}
          </van-tag>
        </div>

        <div class="order-no">{{ order.platformOrderId }}</div>

        <div class="order-goods">
          <span class="goods-count">{{ parseOrderItems(order).length }}件商品</span>
          <span class="order-amount">¥{{ Number(order.actualAmount).toFixed(2) }}</span>
        </div>

        <div class="order-user">
          <span>{{ order.receiverName }}</span>
          <span class="user-phone">{{ order.receiverPhone }}</span>
        </div>

        <div class="order-address">{{ order.receiverAddress }}</div>

        <div class="order-time">{{ order.createdAt }}</div>

        <div class="order-actions" v-if="order.status === 'PENDING'">
          <van-button size="small" plain type="danger" @click.stop="handleCancel(order)">
            拒单
          </van-button>
          <van-button size="small" type="primary" @click.stop="handleConfirm(order)">
            确认接单
          </van-button>
        </div>
      </van-list>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page {
  padding-bottom: 20px;
}

.page-title {
  margin: 0 0 12px;
  font-size: var(--text-page-title);
  font-weight: 600;
  color: var(--text-primary);
}

.overview-card {
  display: flex;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 16px 8px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
}

.overview-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.overview-num {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.overview-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.overview-item.warning .overview-num {
  color: var(--color-warning);
}

.overview-item.primary .overview-num {
  color: var(--color-primary);
}

.overview-item.success .overview-num {
  color: var(--color-success);
}

.platform-filter {
  margin-bottom: 8px;
  background: var(--bg-card);
  border-radius: var(--radius-sm);
}

.order-card {
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-card);
}

.order-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.platform-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.order-no {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  font-family: monospace;
}

.order-goods {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.goods-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.order-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.order-user {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.user-phone {
  color: var(--text-secondary);
}

.order-address {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.order-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

.empty-wrapper {
  padding: 40px 0;
}
</style>
