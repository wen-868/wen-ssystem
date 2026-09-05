<template>
  <view class="transfer-page">
    <page-header title="库存调拨" @back="goBack" />

    <!-- 搜索：后端列表无 keyword 参数，按单号/门店名对已加载记录做本地过滤 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索调拨单号 / 门店名称"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
      </view>
    </view>

    <!-- 状态筛选（与后端真实状态一一对应） -->
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ 'tab-item--active': activeTab === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
      </view>
    </view>

    <!-- 新建按钮 -->
    <view class="create-section">
      <button class="create-btn" @tap="goCreate">
        <text>+ 新建调拨单</text>
      </button>
    </view>

    <!-- 调拨单列表 -->
    <scroll-view class="transfer-list" scroll-y @scrolltolower="onLoadMore" v-if="filteredList.length > 0">
      <view class="transfer-card" v-for="item in filteredList" :key="item.id">
        <view class="card-header">
          <text class="transfer-no">{{ item.transferNo }}</text>
          <view class="transfer-status" :class="'st-' + item.status.toLowerCase()">
            <text class="status-text">{{ item.statusLabel }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">调出门店</text>
            <text class="info-value">{{ item.fromStore }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">调入门店</text>
            <text class="info-value">{{ item.toStore }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">商品种类</text>
            <text class="info-value">{{ item.itemCount }} 种</text>
          </view>
          <view class="info-row">
            <text class="info-label">调拨金额</text>
            <text class="info-value info-amount">¥{{ item.amountText }}</text>
          </view>
          <view class="info-row" v-if="item.expectedDate">
            <text class="info-label">期望到货</text>
            <text class="info-value">{{ item.expectedDate }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">创建时间</text>
            <text class="info-value">{{ item.createTime }}</text>
          </view>
        </view>
        <!-- 状态流转动作（真实后端流转：DRAFT→PENDING→APPROVED→TRANSIT→RECEIVED） -->
        <view class="card-actions" v-if="item.status === 'DRAFT'">
          <button class="action-btn ghost-btn" @tap="handleCancel(item)">取消单据</button>
          <button class="action-btn stock-btn" @tap="handleSubmit(item)">提交审核</button>
        </view>
        <view class="card-actions" v-else-if="item.status === 'PENDING'">
          <button class="action-btn reject-btn" @tap="handleReject(item)">驳回</button>
          <button class="action-btn approve-btn" @tap="handleApprove(item)">审核通过</button>
        </view>
        <view class="card-actions" v-else-if="item.status === 'APPROVED'">
          <button class="action-btn stock-btn" @tap="handleShip(item)">确认发货</button>
        </view>
        <view class="card-actions" v-else-if="item.status === 'TRANSIT'">
          <button class="action-btn stock-btn" @tap="handleReceive(item)">确认收货</button>
        </view>
      </view>
      <view class="list-footer" v-if="list.length < total">
        <text class="footer-text">{{ loading ? '加载中…' : '上拉加载更多' }}</text>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">{{ searchForm.keyword ? '没有匹配的调拨单' : '暂无调拨单' }}</text>
      <text class="empty-hint" v-if="!searchForm.keyword">点上方「+ 新建调拨单」创建第一笔调拨</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  transferApi,
  TRANSFER_STATUS_LABEL,
  type TransferStatus,
  type TransferOrderRow,
} from '@/api/modules/transfer'

const searchForm = reactive({ keyword: '' })

// Tab 与后端状态一一对应（驳回是打回草稿不是终态，故无"已驳回"tab，取消单在"已取消"）
const tabs = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'PENDING' },
  { label: '调拨中', value: 'TRANSIT' },
  { label: '已完成', value: 'RECEIVED' },
  { label: '已取消', value: 'CANCELLED' },
]
const activeTab = ref('')

interface CardItem {
  id: number
  transferNo: string
  fromStore: string
  toStore: string
  itemCount: number
  amountText: string
  expectedDate: string
  createTime: string
  status: TransferStatus
  statusLabel: string
}

const list = ref<CardItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)

const filteredList = computed(() => {
  const kw = searchForm.keyword.trim().toLowerCase()
  if (!kw) return list.value
  return list.value.filter((it) =>
    it.transferNo.toLowerCase().includes(kw) ||
    it.fromStore.toLowerCase().includes(kw) ||
    it.toStore.toLowerCase().includes(kw)
  )
})

function fmtDate(v: string | null): string {
  if (!v) return ''
  return String(v).slice(0, 16).replace('T', ' ')
}

function fmtAmount(v: number | string): string {
  const n = Number(v ?? 0)
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

function mapRow(r: TransferOrderRow): CardItem {
  return {
    id: r.id,
    transferNo: r.transfer_no,
    fromStore: r.from_store_name || `门店#${r.from_store_id}`,
    toStore: r.to_store_name || `门店#${r.to_store_id}`,
    itemCount: Number(r.total_items ?? 0),
    amountText: fmtAmount(r.total_amount),
    expectedDate: r.expected_date ? String(r.expected_date).slice(0, 10) : '',
    createTime: fmtDate(r.created_at),
    status: r.status,
    statusLabel: TRANSFER_STATUS_LABEL[r.status] ?? r.status,
  }
}

async function loadTransfers(reset = true) {
  if (loading.value) return
  loading.value = true
  try {
    if (reset) page.value = 1
    const res = await transferApi.list({
      page: page.value,
      pageSize,
      status: (activeTab.value || undefined) as TransferStatus | undefined,
    })
    const rows = (res?.records ?? []).map(mapRow)
    list.value = reset ? rows : [...list.value, ...rows]
    total.value = Number(res?.total ?? 0)
  } catch (err) {
    console.error('加载调拨单失败:', err)
  } finally {
    loading.value = false
  }
}

function onLoadMore() {
  if (loading.value || list.value.length >= total.value) return
  page.value += 1
  loadTransfers(false)
}

function onSearch() { loadTransfers() }
function clearSearch() { searchForm.keyword = '' }
function switchTab(val: string) { activeTab.value = val; loadTransfers() }
function goCreate() {
  uni.navigateTo({ url: '/pages-sub/finance/transfer/create' })
}

/** 统一动作确认框：确认后调接口，成功刷新列表 */
function confirmAction(title: string, content: string, run: () => Promise<unknown>, successMsg: string) {
  uni.showModal({
    title,
    content,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await run()
        uni.showToast({ title: successMsg, icon: 'success' })
        loadTransfers()
      } catch (err: any) {
        // request 层已 toast 具体失败原因，这里不重复弹
        console.error(`${title}失败:`, err?.message || err)
      }
    },
  })
}

function handleSubmit(item: CardItem) {
  confirmAction('提交审核', `调拨单 ${item.transferNo} 提交后进入待审核，确认提交？`,
    () => transferApi.submit(item.id), '已提交审核')
}

function handleApprove(item: CardItem) {
  confirmAction('审核通过', `确认审核通过调拨单 ${item.transferNo}？`,
    () => transferApi.approve(item.id), '已审核通过')
}

function handleReject(item: CardItem) {
  confirmAction('驳回', `确认驳回调拨单 ${item.transferNo}？单据将打回草稿。`,
    () => transferApi.reject(item.id), '已驳回')
}

function handleCancel(item: CardItem) {
  confirmAction('取消单据', `确认取消调拨单 ${item.transferNo}？取消后不可恢复。`,
    () => transferApi.cancel(item.id), '已取消')
}

function handleShip(item: CardItem) {
  confirmAction('确认发货', `确认调拨单 ${item.transferNo} 已从调出门店发货？`,
    () => transferApi.ship(item.id), '已发货，等待收货')
}

function handleReceive(item: CardItem) {
  // 收货需明细行 itemId；按足额收货提交（实收=应收），后续差异收货再扩展
  uni.showModal({
    title: '确认收货',
    content: `确认调拨单 ${item.transferNo} 商品已全部收到并入库？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        const detail = await transferApi.detail(item.id)
        const items = (detail?.items ?? []).map((it) => ({
          itemId: it.id,
          receivedQty: Number(it.quantity ?? 0),
        }))
        if (items.length === 0) {
          uni.showToast({ title: '单据无明细，无法收货', icon: 'none' })
          return
        }
        await transferApi.receive(item.id, items)
        uni.showToast({ title: '收货成功', icon: 'success' })
        loadTransfers()
      } catch (err: any) {
        console.error('确认收货失败:', err?.message || err)
      }
    },
  })
}

// 返回/进入都刷新（新建、详情操作后回到列表保持最新）
onShow(() => { loadTransfers() })
</script>

<style lang="scss" scoped>
.transfer-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.search-bar { padding: 16rpx 24rpx; background: $uni-bg-color; }
.search-input-wrap {
  display: flex; align-items: center;
  height: 72rpx; background: $uni-bg-color-page;
  border-radius: 36rpx; padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.search-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: $uni-gray-300; padding: 4rpx; }
.tab-bar {
  display: flex; background: $uni-bg-color;
  padding: 0 16rpx 16rpx; gap: 8rpx;
}
.tab-item {
  flex: 1; height: 60rpx;
  display: flex; align-items: center; justify-content: center;
  background: $uni-bg-color-page; border-radius: 30rpx;
}
.tab-item--active { background: $uni-color-primary; }
.tab-item--active .tab-text { color: $uni-text-color-inverse; }
.tab-text { font-size: 22rpx; color: $uni-gray-500; }
.create-section { padding: $uni-spacing-sm $uni-spacing-lg; }
.create-btn {
  width: 100%; height: 80rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 40rpx; font-size: 28rpx;
  font-weight: 600; color: $uni-text-color-inverse;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.create-btn::after { border: none; }
.transfer-list { padding: 0 $uni-spacing-lg $uni-spacing-base; }
.transfer-card {
  background: $uni-bg-color; border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base; margin-bottom: $uni-spacing-md;
  box-shadow: $uni-shadow-card-sm;
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.transfer-no { font-size: 26rpx; color: $uni-gray-700; font-weight: 600; }
.transfer-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.st-draft { background: $uni-gray-100; }
.st-draft .status-text { color: $uni-gray-500; }
.st-pending { background: $uni-color-warning-soft; }
.st-pending .status-text { color: $uni-color-warning; }
.st-approved { background: $uni-color-primary-soft; }
.st-approved .status-text { color: $uni-color-primary; }
.st-transit { background: $uni-color-primary-soft; }
.st-transit .status-text { color: $uni-color-primary; }
.st-received { background: $uni-color-success-soft; }
.st-received .status-text { color: $uni-color-success; }
.st-cancelled { background: $uni-color-error-soft; }
.st-cancelled .status-text { color: $uni-color-error; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.info-amount { font-weight: 600; }
.card-actions {
  margin-top: $uni-spacing-sm; padding-top: $uni-spacing-sm;
  border-top: 1rpx solid $uni-gray-100;
  display: flex; gap: $uni-spacing-sm;
}
.action-btn {
  flex: 1; height: 64rpx; border-radius: 32rpx;
  font-size: 26rpx;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.ghost-btn { background: $uni-bg-color-page; color: $uni-gray-500; }
.approve-btn { background: $uni-color-success; color: $uni-text-color-inverse; }
.reject-btn { background: $uni-color-error-soft; color: $uni-color-error; }
.stock-btn { background: $uni-color-primary; color: $uni-text-color-inverse; }
.action-btn::after { border: none; }
.list-footer { display: flex; justify-content: center; padding: 20rpx 0 40rpx; }
.footer-text { font-size: 24rpx; color: $uni-gray-400; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: $uni-spacing-md; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.empty-hint { font-size: 24rpx; color: $uni-gray-400; margin-top: 12rpx; }
.safe-bottom { height: 40rpx; }
</style>
