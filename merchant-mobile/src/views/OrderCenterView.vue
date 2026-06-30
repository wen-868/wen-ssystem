<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchOrderCenterSummary,
  fetchChannelOrders,
  type ChannelOrder,
  type OrderCenterSummary
} from '../api'

const router = useRouter()

/* ========== 渠道配置 ========== */

const CHANNEL_TABS = [
  { label: '全部', value: '', color: '#1677FF' },
  { label: '微信', value: 'WECHAT', color: '#07C160' },
  { label: '抖音', value: 'DOUYIN', color: '#010101' },
  { label: '美团', value: 'MEITUAN', color: '#FFD101' },
  { label: '饿了么', value: 'ELEME', color: '#0097FF' },
  { label: '京东', value: 'JD', color: '#E2231A' },
  { label: '线下', value: 'OFFLINE', color: '#666' }
]

const CHANNEL_COLOR_MAP: Record<string, string> = {
  WECHAT: '#07C160',
  DOUYIN: '#010101',
  MEITUAN: '#FFD101',
  ELEME: '#0097FF',
  JD: '#E2231A',
  OFFLINE: '#666'
}

const CHANNEL_LABEL_MAP: Record<string, string> = {
  WECHAT: '微信',
  DOUYIN: '抖音',
  MEITUAN: '美团',
  ELEME: '饿了么',
  JD: '京东',
  OFFLINE: '线下'
}

/* ========== 状态配置 ========== */

const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'PENDING' },
  { label: '已确认', value: 'CONFIRMED' },
  { label: '配送中', value: 'DELIVERING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' }
]

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  PENDING: { text: '待处理', type: 'warning' },
  CONFIRMED: { text: '已确认', type: 'primary' },
  DELIVERING: { text: '配送中', type: 'primary' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已取消', type: 'default' }
}

const EXCEPTION_LEVEL_COLOR: Record<string, string> = {
  WARNING: '#F59E0B',
  ERROR: '#F97316',
  CRITICAL: '#EF4444'
}

/* ========== 数据概览 ========== */

const summary = ref<OrderCenterSummary>({
  todayCount: 0,
  todayAmount: 0,
  pendingCount: 0,
  exceptionCount: 0
})

/* ========== 筛选状态 ========== */

const activeChannel = ref('')
const activeStatus = ref('')
const searchKeyword = ref('')

/* ========== 列表状态 ========== */

const orders = ref<ChannelOrder[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

/* ========== 数据加载 ========== */

async function loadSummary() {
  try {
    const res = await fetchOrderCenterSummary()
    summary.value = res.data
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
    const res = await fetchChannelOrders({
      page: page.value,
      pageSize,
      channel: activeChannel.value || undefined,
      status: activeStatus.value || undefined,
      keyword: searchKeyword.value || undefined
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

/* ========== 事件处理 ========== */

function onRefresh() {
  refreshing.value = true
  loadSummary()
  loadOrders(true)
}

function onChannelChange() {
  loadOrders(true)
}

function onStatusChange() {
  loadOrders(true)
}

function onSearch() {
  loadOrders(true)
}

function onCancelSearch() {
  searchKeyword.value = ''
  loadOrders(true)
}

function goToDetail(channelOrderNo: string) {
  router.push(`/order-center/detail/${channelOrderNo}`)
}

function goToExceptionList() {
  router.push('/order-exception/list')
}

function goToOverviewFilter(type: string) {
  if (type === 'pending') {
    activeStatus.value = 'PENDING'
    onStatusChange()
  } else if (type === 'exception') {
    goToExceptionList()
  }
}

function getChannelInfo(channel: string) {
  return {
    label: CHANNEL_LABEL_MAP[channel] || channel,
    color: CHANNEL_COLOR_MAP[channel] || '#999'
  }
}

function getExceptionColor(level: string) {
  return EXCEPTION_LEVEL_COLOR[level] || '#EF4444'
}

function formatAmount(amount: number) {
  return Number(amount).toFixed(2)
}

onMounted(() => {
  loadSummary()
  loadOrders()
})
</script>

<template>
  <section class="page">
    <h2 class="page-title">订单中心</h2>

    <!-- 数据概览 -->
    <van-grid :column-num="4" :border="false" :gutter="8" class="overview-grid">
      <van-grid-item
        text="今日订单数"
        :badge="String(summary.todayCount)"
      />
      <van-grid-item
        text="今日金额"
        :badge="'¥' + formatAmount(summary.todayAmount)"
      />
      <van-grid-item
        text="待处理订单"
        :badge="String(summary.pendingCount)"
        @click="goToOverviewFilter('pending')"
      />
      <van-grid-item
        text="异常订单"
        :badge="String(summary.exceptionCount)"
        @click="goToOverviewFilter('exception')"
      />
    </van-grid>

    <!-- 异常提醒横幅 -->
    <van-notice-bar
      v-if="summary.exceptionCount > 0"
      left-icon="warning-o"
      color="#EF4444"
      background="#FFF2F0"
      :text="`您有 ${summary.exceptionCount} 笔异常订单需要处理，点击查看详情`"
      mode="link"
      @click="goToExceptionList"
    />

    <!-- 搜索框 -->
    <van-search
      v-model="searchKeyword"
      placeholder="搜索订单号/客户名/手机号"
      shape="round"
      clearable
      @search="onSearch"
      @cancel="onCancelSearch"
    />

    <!-- 渠道筛选 -->
    <van-tabs
      v-model:active="activeChannel"
      line-width="0"
      class="channel-tabs"
      @change="onChannelChange"
    >
      <van-tab
        v-for="tab in CHANNEL_TABS"
        :key="tab.value"
        :name="tab.value"
      >
        <template #title>
          <span
            class="channel-tab-label"
            :class="{ 'channel-tab-active': activeChannel === tab.value }"
            :style="activeChannel === tab.value ? { color: '#fff', backgroundColor: tab.color } : { color: tab.color }"
          >
            {{ tab.label }}
          </span>
        </template>
      </van-tab>
    </van-tabs>

    <!-- 状态筛选 -->
    <van-dropdown-menu class="status-dropdown">
      <van-dropdown-item
        v-model="activeStatus"
        :options="STATUS_TABS.map(t => ({ text: t.label, value: t.value }))"
        @change="onStatusChange"
      />
    </van-dropdown-menu>

    <!-- 订单列表 -->
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

        <div
          v-for="order in orders"
          :key="order.channelOrderNo"
          class="order-card"
          @click="goToDetail(order.channelOrderNo)"
        >
          <!-- 卡片头部：渠道标签 + 订单号 -->
          <div class="order-card-header">
            <div class="order-card-header-left">
              <van-tag
                :color="getChannelInfo(order.channel).color"
                text-color="#fff"
                size="medium"
              >
                {{ getChannelInfo(order.channel).label }}
              </van-tag>
              <span class="order-no">{{ order.channelOrderNo }}</span>
            </div>
            <!-- 异常标记 -->
            <div v-if="order.exceptionFlag" class="exception-tag">
              <span class="exception-icon">!</span>
              <span class="exception-text">{{ order.exceptionReason }}</span>
            </div>
          </div>

          <!-- 客户信息 -->
          <div class="order-customer">
            <span class="customer-name">{{ order.customerName }}</span>
            <span class="customer-phone">{{ order.customerPhone }}</span>
          </div>

          <!-- 商品摘要 -->
          <div class="order-items-summary">
            {{ order.itemsSummary }}
          </div>

          <!-- 底部：金额 + 状态 + 时间 -->
          <div class="order-card-footer">
            <span class="order-amount">¥{{ formatAmount(order.payAmount || order.totalAmount) }}</span>
            <div class="order-footer-right">
              <van-tag
                :type="(STATUS_MAP[order.orderStatus]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ STATUS_MAP[order.orderStatus]?.text || order.orderStatus }}
              </van-tag>
              <span class="order-time">{{ order.createdAt }}</span>
            </div>
          </div>
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

/* ========== 数据概览 ========== */

.overview-grid {
  margin-bottom: 12px;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 8px 0;
  box-shadow: var(--shadow-card);
}

.overview-grid :deep(.van-grid-item__content) {
  padding: 12px 4px;
}

.overview-grid :deep(.van-grid-item__text) {
  font-size: var(--text-hint);
  color: var(--text-secondary);
  margin-top: 4px;
}

.overview-grid :deep(.van-badge) {
  font-size: 16px;
  font-weight: 600;
  background: transparent;
  color: var(--text-primary);
  border: none;
  padding: 0;
}

/* ========== 渠道筛选 ========== */

.channel-tabs {
  margin-bottom: 0;
}

.channel-tabs :deep(.van-tabs__wrap) {
  padding: 0 8px;
}

.channel-tabs :deep(.van-tab) {
  padding: 0 6px;
  flex: none;
}

.channel-tab-label {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
  background: #F5F7FA;
  transition: all 0.2s ease;
}

.channel-tab-active {
  font-weight: 600;
}

.channel-tabs :deep(.van-tabs__line) {
  display: none;
}

/* ========== 状态筛选 ========== */

.status-dropdown {
  margin-bottom: 8px;
}

/* ========== 订单卡片 ========== */

.order-card {
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  padding: 14px var(--space-card-padding);
  margin-bottom: 10px;
  box-shadow: var(--shadow-card);
}

.order-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.order-card-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.order-no {
  font-size: 13px;
  color: var(--text-secondary);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 异常标记 */
.exception-tag {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  margin-left: 8px;
}

.exception-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #EF4444;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.exception-text {
  font-size: 11px;
  color: #EF4444;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 客户信息 */
.order-customer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.customer-name {
  font-weight: 500;
}

.customer-phone {
  color: var(--text-secondary);
}

/* 商品摘要 */
.order-items-summary {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 底部 */
.order-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--border-normal);
}

.order-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.order-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.order-time {
  font-size: 12px;
  color: var(--text-muted);
}

/* ========== 空状态 ========== */

.empty-wrapper {
  padding: 40px 0;
}
</style>