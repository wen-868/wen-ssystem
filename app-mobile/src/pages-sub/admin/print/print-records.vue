<template>
  <view class="print-page">
    <!-- 页头 -->
    <page-header title="单据打印" @back="goBack" />

    <!-- 状态筛选 tab -->
    <view class="pr-tabs">
      <view
        v-for="tab in statusTabs"
        :key="tab.value"
        class="pr-tab"
        :class="{ 'pr-tab--active': activeTab === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="pr-tab-text">{{ tab.label }}</text>
      </view>
    </view>

    <!-- 记录列表 -->
    <scroll-view
      class="pr-list"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="refresherTriggered"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
      v-if="records.length > 0"
    >
      <view class="pr-card" v-for="item in records" :key="item.id">
        <view class="pr-card-top">
          <text class="pr-bill-type">{{ billTypeLabel(item.bill_type) }}</text>
          <view class="pr-status" :class="'pr-status--' + item.status.toLowerCase()">
            <text class="pr-status-text">{{ statusLabel(item.status) }}</text>
          </view>
        </view>
        <view class="pr-bill-no">
          <text class="pr-bill-no-label">单据编号</text>
          <text class="pr-bill-no-value">{{ item.bill_no }}</text>
        </view>
        <view class="pr-meta">
          <text class="pr-meta-item">打印份数 {{ item.copies }}</text>
          <text class="pr-meta-item" v-if="item.printer_mac">打印机 {{ item.printer_mac }}</text>
          <text class="pr-meta-item" v-if="item.operator_id">操作员 #{{ item.operator_id }}</text>
        </view>
        <view class="pr-time">{{ formatTime(item.created_at) }}</view>
        <view class="pr-actions">
          <view class="pr-btn pr-btn--ghost" @tap="showDetail(item)">详情</view>
          <view class="pr-btn pr-btn--primary" @tap="onReprint(item)">重打</view>
        </view>
      </view>

      <view class="pr-load-more" v-if="records.length > 0">
        <text class="pr-load-text">{{ loadingMore ? '加载中...' : noMore ? '没有更多了' : '上拉加载更多' }}</text>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>

    <!-- 空状态 -->
    <view class="empty-state" v-else-if="!loading">
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无打印记录</text>
    </view>

    <!-- 详情弹层 -->
    <view class="pr-mask" v-if="detailVisible" @tap="closeDetail">
      <view class="pr-detail" @tap.stop>
        <view class="pr-detail-hd">
          <text class="pr-detail-title">打印记录详情</text>
          <text class="pr-detail-close" @tap="closeDetail">×</text>
        </view>
        <scroll-view class="pr-detail-body" scroll-y>
          <view class="pr-detail-row">
            <text class="pr-detail-label">记录ID</text>
            <text class="pr-detail-value">{{ currentDetail?.id }}</text>
          </view>
          <view class="pr-detail-row">
            <text class="pr-detail-label">单据类型</text>
            <text class="pr-detail-value">{{ currentDetail ? billTypeLabel(currentDetail.bill_type) : '' }}</text>
          </view>
          <view class="pr-detail-row">
            <text class="pr-detail-label">单据编号</text>
            <text class="pr-detail-value">{{ currentDetail?.bill_no }}</text>
          </view>
          <view class="pr-detail-row">
            <text class="pr-detail-label">打印状态</text>
            <text class="pr-detail-value">{{ currentDetail ? statusLabel(currentDetail.status) : '' }}</text>
          </view>
          <view class="pr-detail-row">
            <text class="pr-detail-label">打印份数</text>
            <text class="pr-detail-value">{{ currentDetail?.copies }}</text>
          </view>
          <view class="pr-detail-row" v-if="currentDetail?.printer_mac">
            <text class="pr-detail-label">打印机</text>
            <text class="pr-detail-value">{{ currentDetail.printer_mac }}</text>
          </view>
          <view class="pr-detail-row" v-if="currentDetail?.error_msg">
            <text class="pr-detail-label">错误信息</text>
            <text class="pr-detail-value pr-detail-value--error">{{ currentDetail.error_msg }}</text>
          </view>
          <view class="pr-detail-row" v-if="currentDetail?.original_id">
            <text class="pr-detail-label">关联原记录</text>
            <text class="pr-detail-value">#{{ currentDetail.original_id }}</text>
          </view>
          <view class="pr-detail-row">
            <text class="pr-detail-label">创建时间</text>
            <text class="pr-detail-value">{{ formatTime(currentDetail?.created_at) }}</text>
          </view>
          <view class="pr-detail-block" v-if="currentDetail?.print_content">
            <text class="pr-detail-label">打印内容</text>
            <text class="pr-detail-content">{{ currentDetail.print_content }}</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { printApi, type PrintRecord, type PrintRecordStatus } from '@/api/modules/print'

interface StatusTab {
  label: string
  value: '' | PrintRecordStatus
}

const statusTabs: StatusTab[] = [
  { label: '全部', value: '' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILED' },
  { label: '待打印', value: 'PENDING' },
]

const BILL_TYPE_MAP: Record<string, string> = {
  SALE_BILL: '销售单',
  SALE_RETURN: '销售退货',
  SHIFT: '班结单',
  DAILY_SETTLE: '日结单',
  REPRINT: '重打单',
}

const STATUS_MAP: Record<PrintRecordStatus, string> = {
  SUCCESS: '成功',
  FAILED: '失败',
  PENDING: '待打印',
}

const records = ref<PrintRecord[]>([])
const activeTab = ref<'' | PrintRecordStatus>('')
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const refresherTriggered = ref(false)
const detailVisible = ref(false)
const currentDetail = ref<PrintRecord | null>(null)

function billTypeLabel(type: string): string {
  return BILL_TYPE_MAP[type] || type
}

function statusLabel(status: PrintRecordStatus): string {
  return STATUS_MAP[status] || status
}

function formatTime(value?: string | Date | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: '/pages/functions/functions' })
  }
}

function switchTab(tab: '' | PrintRecordStatus) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  page.value = 1
  records.value = []
  noMore.value = false
  loadRecords()
}

async function loadRecords() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await printApi.listRecords({
      page: page.value,
      pageSize,
      status: activeTab.value || undefined,
    })
    if (page.value === 1) {
      records.value = result.records
    } else {
      records.value = records.value.concat(result.records)
    }
    noMore.value = result.records.length < pageSize
  } catch (err) {
    console.error('加载打印记录失败:', err)
  } finally {
    loading.value = false
    refresherTriggered.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value || loading.value) return
  loadingMore.value = true
  try {
    page.value++
    const result = await printApi.listRecords({
      page: page.value,
      pageSize,
      status: activeTab.value || undefined,
    })
    if (result.records.length === 0) {
      noMore.value = true
      page.value--
    } else {
      records.value = records.value.concat(result.records)
      noMore.value = result.records.length < pageSize
    }
  } catch (err) {
    console.error('加载更多打印记录失败:', err)
    page.value--
  } finally {
    loadingMore.value = false
  }
}

function onRefresh() {
  refresherTriggered.value = true
  page.value = 1
  noMore.value = false
  loadRecords()
}

function showDetail(item: PrintRecord) {
  currentDetail.value = item
  detailVisible.value = true
}

function closeDetail() {
  detailVisible.value = false
  currentDetail.value = null
}

function onReprint(item: PrintRecord) {
  uni.showModal({
    title: '确认重打',
    content: `重打单据「${item.bill_no}」将生成一条新的打印记录，是否继续？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await printApi.reprint(item.id)
        uni.showToast({ title: '已提交重打', icon: 'success' })
        page.value = 1
        records.value = []
        noMore.value = false
        loadRecords()
      } catch (err) {
        console.error('重打失败:', err)
      }
    },
  })
}

onMounted(() => {
  loadRecords()
})
</script>

<style lang="scss" scoped>
.print-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
}

/* 页头 */
.pr-hd {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 32rpx 8rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}

.header-back {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $uni-bg-color-page;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-back-icon {
  font-size: 44rpx;
  color: $uni-gray-600;
  line-height: 1;
  margin-top: -4rpx;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color;
}

/* 状态筛选 tab */
.pr-tabs {
  display: flex;
  gap: 8rpx;
  padding: 20rpx 28rpx 8rpx;
}

.pr-tab {
  padding: 12rpx 28rpx;
  border-radius: $uni-border-radius-pill;
  background: $uni-bg-color;
  border: 1rpx solid rgba(0, 0, 0, 0.04);
}

.pr-tab--active {
  background: $uni-color-primary-soft;
  border-color: $uni-color-primary;
}

.pr-tab-text {
  font-size: 24rpx;
  color: $uni-gray-600;
  font-weight: 500;
}

.pr-tab--active .pr-tab-text {
  color: $uni-color-primary;
  font-weight: 700;
}

/* 记录列表 */
.pr-list {
  height: calc(100vh - 260rpx - env(safe-area-inset-top));
  padding: 8rpx 32rpx 0;
  box-sizing: border-box;
}

.pr-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.pr-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.pr-bill-type {
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-text-color;
}

.pr-status {
  padding: 6rpx 18rpx;
  border-radius: $uni-border-radius-xs;
}

.pr-status--success {
  background: $uni-color-success-soft;
}

.pr-status--success .pr-status-text {
  color: $uni-color-success;
}

.pr-status--failed {
  background: $uni-color-error-soft;
}

.pr-status--failed .pr-status-text {
  color: $uni-color-error;
}

.pr-status--pending {
  background: $uni-color-warning-soft;
}

.pr-status--pending .pr-status-text {
  color: $uni-color-warning;
}

.pr-status-text {
  font-size: 22rpx;
  font-weight: 600;
}

.pr-bill-no {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.pr-bill-no-label {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.pr-bill-no-value {
  font-size: 26rpx;
  color: $uni-gray-700;
  font-weight: 600;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.pr-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx 24rpx;
  margin-bottom: 10rpx;
}

.pr-meta-item {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.pr-time {
  font-size: 22rpx;
  color: $uni-gray-300;
  margin-bottom: 20rpx;
}

.pr-actions {
  display: flex;
  justify-content: flex-end;
  gap: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(0, 0, 0, 0.04);
}

.pr-btn {
  padding: 14rpx 40rpx;
  border-radius: $uni-border-radius-pill;
  font-size: 26rpx;
  font-weight: 600;
}

.pr-btn:active {
  transform: scale(0.95);
}

.pr-btn--ghost {
  background: $uni-bg-color-page;
  color: $uni-gray-600;
  border: 1rpx solid $uni-gray-200;
}

.pr-btn--primary {
  background: $uni-gradient-blue;
  color: $uni-text-color-inverse;
  box-shadow: 0 8rpx 20rpx rgba(37, 99, 235, 0.25);
}

/* 加载更多 */
.pr-load-more {
  text-align: center;
  padding: 20rpx 0;
}

.pr-load-text {
  font-size: 22rpx;
  color: $uni-gray-300;
}

/* 详情弹层 */
.pr-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 99;
  display: flex;
  align-items: flex-end;
}

.pr-detail {
  width: 100%;
  max-height: 75vh;
  background: $uni-bg-color;
  border-radius: 40rpx 40rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.pr-detail-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.pr-detail-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-text-color;
}

.pr-detail-close {
  font-size: 44rpx;
  color: $uni-gray-400;
  padding: 8rpx;
  line-height: 1;
}

.pr-detail-body {
  max-height: 55vh;
}

.pr-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.pr-detail-label {
  font-size: 24rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
}

.pr-detail-value {
  font-size: 24rpx;
  color: $uni-gray-700;
  text-align: right;
  word-break: break-all;
}

.pr-detail-value--error {
  color: $uni-color-error;
}

.pr-detail-block {
  padding: 20rpx 0;
}

.pr-detail-block .pr-detail-label {
  display: block;
  margin-bottom: 12rpx;
}

.pr-detail-content {
  font-size: 24rpx;
  color: $uni-gray-600;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-sm;
  padding: 20rpx;
  display: block;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: $uni-gray-300;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>
