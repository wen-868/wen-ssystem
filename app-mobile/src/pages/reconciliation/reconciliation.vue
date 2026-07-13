<template>
  <view class="reconciliation-page">
    <view class="page-header">
      <text class="header-title">财务对账</text>
    </view>

    <view class="tab-bar">
      <view class="tab-item" :class="{ 'tab-item--active': activeTab === 'customer' }" @tap="switchTab('customer')">
        <text>客户对账</text>
      </view>
      <view class="tab-item" :class="{ 'tab-item--active': activeTab === 'supplier' }" @tap="switchTab('supplier')">
        <text>供应商对账</text>
      </view>
    </view>

    <view class="search-bar">
      <input class="search-input" type="text" v-model="keyword" placeholder="搜索名称" @confirm="onSearch" />
    </view>

    <scroll-view class="content-scroll" scroll-y @scrolltolower="onLoadMore">
      <view class="recon-card" v-for="item in currentList" :key="getKey(item)" @tap="goDetail(item)">
        <view class="card-top">
          <text class="party-name">{{ getPartyName(item) }}</text>
          <view class="status-tag" :class="getStatusClass(item.status)">
            <text class="status-tag-text">{{ getStatusText(item.status) }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="amount-row">
            <view class="amount-block">
              <text class="amount-label">对账总额</text>
              <text class="amount-value">{{ formatMoney(getTotalAmount(item)) }}</text>
            </view>
            <view class="amount-block">
              <text class="amount-label">已确认</text>
              <text class="amount-value text-success">{{ formatMoney(getConfirmed(item)) }}</text>
            </view>
            <view class="amount-block">
              <text class="amount-label">未确认</text>
              <text class="amount-value text-danger">{{ formatMoney(getUnconfirmed(item)) }}</text>
            </view>
          </view>
        </view>
        <view class="card-arrow">
          <text class="arrow-icon">></text>
        </view>
      </view>

      <view class="load-more" v-if="currentList.length > 0">
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>
      <view class="empty-state" v-else-if="!loading">
        <text class="empty-text">暂无对账数据</text>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>

    <view class="detail-modal" v-if="detailVisible" @tap="closeDetail">
      <view class="detail-content" @tap.stop>
        <view class="detail-header">
          <text class="detail-title">{{ detailData?.partyName }} 对账详情</text>
          <text class="close-btn" @tap="closeDetail">X</text>
        </view>
        <scroll-view class="detail-scroll" scroll-y>
          <view class="detail-info">
            <view class="detail-row">
              <text class="detail-label">对账总额</text>
              <text class="detail-value">{{ formatMoney(detailData?.totalAmount ?? 0) }}</text>
            </view>
            <view class="detail-row">
              <text class="detail-label">已收/付</text>
              <text class="detail-value">{{ formatMoney(detailData?.receivedAmount ?? 0) }}</text>
            </view>
            <view class="detail-row">
              <text class="detail-label">余额</text>
              <text class="detail-value text-danger">{{ formatMoney(detailData?.balance ?? 0) }}</text>
            </view>
            <view class="detail-row" v-if="detailData?.startDate">
              <text class="detail-label">起始日期</text>
              <text class="detail-value">{{ detailData.startDate }}</text>
            </view>
            <view class="detail-row" v-if="detailData?.endDate">
              <text class="detail-label">截止日期</text>
              <text class="detail-value">{{ detailData.endDate }}</text>
            </view>
          </view>
          <view class="records-section">
            <text class="records-title">对账记录</text>
            <view class="record-item" v-for="record in detailData?.records" :key="record.id">
              <view class="record-top">
                <text class="record-no">{{ record.billNo }}</text>
                <text class="record-type">{{ record.billType }}</text>
              </view>
              <view class="record-info">
                <text class="record-amount" :class="{ 'text-success': record.amount > 0 }">{{ formatMoney(record.amount) }}</text>
                <text class="record-date">{{ record.date }}</text>
              </view>
              <text class="record-remark" v-if="record.remark">{{ record.remark }}</text>
            </view>
            <view class="empty-state" v-if="!detailData?.records || detailData.records.length === 0">
              <text class="empty-text">暂无记录</text>
            </view>
          </view>
        </scroll-view>
        <view class="detail-bottom">
          <button class="btn btn--primary btn--block" @tap="onConfirm">确认对账</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  reconciliationApi,
  type CustomerReconciliationItem,
  type SupplierReconciliationItem,
  type ReconciliationDetail,
} from '@/api/modules/reconciliation'

const activeTab = ref('customer')
const keyword = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const page = ref(1)
const pageSize = 20

const customerList = ref<CustomerReconciliationItem[]>([])
const supplierList = ref<SupplierReconciliationItem[]>([])

const currentList = computed(() => activeTab.value === 'customer' ? customerList.value : supplierList.value)

const detailVisible = ref(false)
const detailData = ref<ReconciliationDetail | null>(null)
const currentPartyId = ref(0)

function formatMoney(val: number): string {
  return '¥' + (val || 0).toFixed(2)
}

function getKey(item: any): number {
  return item.customerId ?? item.supplierId ?? 0
}
function getPartyName(item: any): string {
  return item.customerName ?? item.supplierName ?? '--'
}
function getTotalAmount(item: any): number {
  return item.totalAmount ?? 0
}
function getConfirmed(item: any): number {
  return item.confirmedAmount ?? 0
}
function getUnconfirmed(item: any): number {
  return item.unconfirmedAmount ?? 0
}
function getStatusText(status?: string): string {
  if (!status) return '待确认'
  const map: Record<string, string> = { PENDING: '待确认', CONFIRMED: '已确认', DISPUTED: '有争议' }
  return map[status] ?? status
}
function getStatusClass(status?: string): string {
  if (!status || status === 'PENDING') return 'status-tag--pending'
  if (status === 'CONFIRMED') return 'status-tag--confirmed'
  return 'status-tag--disputed'
}

function switchTab(tab: string) {
  activeTab.value = tab
  page.value = 1
  noMore.value = false
  if (tab === 'customer' && customerList.value.length === 0) loadCustomer()
  if (tab === 'supplier' && supplierList.value.length === 0) loadSupplier()
}

function onSearch() {
  page.value = 1
  noMore.value = false
  if (activeTab.value === 'customer') { customerList.value = []; loadCustomer() }
  else { supplierList.value = []; loadSupplier() }
}

async function loadCustomer() {
  loading.value = true
  try {
    const result = await reconciliationApi.listCustomerReconciliation({ page: page.value, pageSize, keyword: keyword.value || undefined })
    customerList.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载客户对账失败:', err)
  } finally {
    loading.value = false
  }
}

async function loadSupplier() {
  loading.value = true
  try {
    const result = await reconciliationApi.listSupplierReconciliation({ page: page.value, pageSize, keyword: keyword.value || undefined })
    supplierList.value = result.list
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载供应商对账失败:', err)
  } finally {
    loading.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    page.value++
    if (activeTab.value === 'customer') {
      const result = await reconciliationApi.listCustomerReconciliation({ page: page.value, pageSize, keyword: keyword.value || undefined })
      if (result.list.length === 0) { noMore.value = true; page.value-- }
      else customerList.value = [...customerList.value, ...result.list]
    } else {
      const result = await reconciliationApi.listSupplierReconciliation({ page: page.value, pageSize, keyword: keyword.value || undefined })
      if (result.list.length === 0) { noMore.value = true; page.value-- }
      else supplierList.value = [...supplierList.value, ...result.list]
    }
  } catch (err) {
    page.value--
    console.error('加载更多失败:', err)
  } finally {
    loadingMore.value = false
  }
}

async function goDetail(item: any) {
  const partyId = getKey(item)
  currentPartyId.value = partyId
  try {
    const detail = activeTab.value === 'customer'
      ? await reconciliationApi.customerDetail(partyId)
      : await reconciliationApi.supplierDetail(partyId)
    detailData.value = detail
    detailVisible.value = true
  } catch (err) {
    console.error('加载对账详情失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function closeDetail() {
  detailVisible.value = false
  detailData.value = null
}

async function onConfirm() {
  try {
    if (activeTab.value === 'customer') {
      await reconciliationApi.confirmCustomer(currentPartyId.value)
    } else {
      await reconciliationApi.confirmSupplier(currentPartyId.value)
    }
    uni.showToast({ title: '确认成功', icon: 'success' })
    closeDetail()
    page.value = 1
    noMore.value = false
    if (activeTab.value === 'customer') { customerList.value = []; loadCustomer() }
    else { supplierList.value = []; loadSupplier() }
  } catch (err) {
    console.error('确认对账失败:', err)
    uni.showToast({ title: '确认失败', icon: 'none' })
  }
}

loadCustomer()
</script>

<style scoped>
.reconciliation-page { min-height: 100vh; background: #f0f5ff; display: flex; flex-direction: column; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: #fff; }
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.tab-bar { display: flex; background: #fff; border-bottom: 1rpx solid #f0f0f0; }
.tab-item { flex: 1; text-align: center; padding: 24rpx 0; font-size: 28rpx; color: #666; position: relative; }
.tab-item--active { color: #1677FF; font-weight: 600; }
.tab-item--active::after { content: ''; position: absolute; bottom: 0; left: 30%; right: 30%; height: 4rpx; background: #1677FF; border-radius: 2rpx; }
.search-bar { padding: 16rpx 24rpx; background: #fff; }
.search-input { width: 100%; height: 64rpx; background: #f5f7fa; border-radius: 32rpx; padding: 0 32rpx; font-size: 26rpx; }
.content-scroll { flex: 1; padding: 0 24rpx; }
.recon-card { position: relative; background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; margin-top: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; padding-bottom: 12rpx; border-bottom: 1rpx solid #f0f0f0; }
.party-name { font-size: 30rpx; font-weight: 600; color: #333; }
.status-tag { padding: 4rpx 16rpx; border-radius: 8rpx; }
.status-tag--pending { background: rgba(250,173,20,0.1); }
.status-tag--confirmed { background: rgba(82,196,26,0.1); }
.status-tag--disputed { background: rgba(255,77,79,0.1); }
.status-tag-text { font-size: 22rpx; }
.status-tag--pending .status-tag-text { color: #faad14; }
.status-tag--confirmed .status-tag-text { color: #52c41a; }
.status-tag--disputed .status-tag-text { color: #ff4d4f; }
.card-body { }
.amount-row { display: flex; gap: 16rpx; }
.amount-block { flex: 1; display: flex; flex-direction: column; align-items: center; }
.amount-label { font-size: 22rpx; color: #999; margin-bottom: 6rpx; }
.amount-value { font-size: 26rpx; font-weight: 600; color: #333; }
.text-danger { color: #ff4d4f; }
.text-success { color: #52c41a; }
.card-arrow { position: absolute; right: 24rpx; top: 50%; transform: translateY(-50%); }
.arrow-icon { font-size: 28rpx; color: #ccc; }
.load-more { text-align: center; padding: 24rpx 0; }
.load-more-text { font-size: 24rpx; color: #bbb; }
.empty-state { display: flex; justify-content: center; padding: 100rpx 0; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }
.detail-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: flex-end; }
.detail-content { width: 100%; max-height: 80vh; background: #fff; border-radius: 24rpx 24rpx 0 0; display: flex; flex-direction: column; }
.detail-header { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 32rpx; border-bottom: 1rpx solid #f0f0f0; }
.detail-title { font-size: 30rpx; font-weight: 600; color: #333; }
.close-btn { font-size: 32rpx; color: #999; padding: 8rpx 16rpx; }
.detail-scroll { flex: 1; max-height: 50vh; padding: 16rpx 32rpx; }
.detail-info { padding: 16rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.detail-row { display: flex; justify-content: space-between; padding: 8rpx 0; }
.detail-label { font-size: 26rpx; color: #999; }
.detail-value { font-size: 28rpx; color: #333; font-weight: 500; }
.records-section { padding: 16rpx 0; }
.records-title { font-size: 28rpx; font-weight: 600; color: #333; display: block; margin-bottom: 12rpx; }
.record-item { padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.record-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8rpx; }
.record-no { font-size: 26rpx; color: #333; }
.record-type { font-size: 22rpx; color: #1677FF; background: rgba(22,119,255,0.08); padding: 2rpx 12rpx; border-radius: 6rpx; }
.record-info { display: flex; justify-content: space-between; }
.record-amount { font-size: 28rpx; font-weight: 600; color: #333; }
.record-date { font-size: 22rpx; color: #999; }
.record-remark { font-size: 22rpx; color: #999; margin-top: 4rpx; }
.detail-bottom { padding: 16rpx 32rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #f0f0f0; }
.btn { height: 80rpx; line-height: 80rpx; border-radius: 12rpx; font-size: 28rpx; text-align: center; border: none; }
.btn--primary { background: #1677FF; color: #fff; }
.btn--block { width: 100%; }
</style>
