<template>
  <view class="trace-page">
    <!-- 页头 -->
    <page-header title="溯源查询" @back="goBack" />

    <!-- 搜索 -->
    <view class="tr-search">
      <view class="search-bar">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="traceCode"
          type="text"
          placeholder="输入追溯码，如 TR202608010001"
          placeholder-class="search-placeholder"
          confirm-type="search"
          @confirm="onQuery"
        />
        <image class="search-clear ic" v-if="traceCode" @tap="clearCode" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
      </view>
      <view class="tr-query-btn" :class="{ 'tr-query-btn--disabled': querying }" @tap="onQuery">
        <text class="tr-query-text">{{ querying ? '查询中...' : '查询' }}</text>
      </view>
    </view>

    <!-- 初始空态 -->
    <view class="empty-state" v-if="!chain && !notFound && !querying">
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">输入追溯码查询商品来源与批次追踪</text>
    </view>

    <!-- 未找到 -->
    <view class="empty-state" v-else-if="notFound && !querying">
      <image class="empty-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
      <text class="empty-text">未查询到该追溯码</text>
      <text class="empty-sub">请核实追溯码后重试</text>
    </view>

    <!-- 查询结果 -->
    <scroll-view class="tr-result" scroll-y v-if="chain && !querying">
      <!-- 防伪验证结果 -->
      <view class="tr-verify-banner" v-if="verifyResult" :class="'tr-verify--' + verifyResult.result.toLowerCase()">
        <text class="tr-verify-title">{{ verifyResult.message }}</text>
        <text class="tr-verify-sub">扫码次数 {{ formatNumber(chain.scanCount) }}</text>
      </view>

      <!-- 商品信息卡 -->
      <view class="tr-card">
        <view class="tr-card-hd">
          <text class="tr-card-title">商品信息</text>
          <view class="tr-status" :class="'tr-status--' + statusTone(chain.currentStatus)">
            <text class="tr-status-text">{{ statusLabel(chain.currentStatus) }}</text>
          </view>
        </view>
        <view class="tr-row">
          <text class="tr-label">商品名称</text>
          <text class="tr-value">{{ chain.skuName || '—' }}</text>
        </view>
        <view class="tr-row">
          <text class="tr-label">追溯码</text>
          <text class="tr-value tr-value--mono">{{ chain.traceCode }}</text>
        </view>
        <view class="tr-row">
          <text class="tr-label">批次号</text>
          <text class="tr-value tr-value--mono">{{ chain.batchNo || '—' }}</text>
        </view>
        <view class="tr-row">
          <text class="tr-label">生产日期</text>
          <text class="tr-value">{{ chain.productionDate || '—' }}</text>
        </view>
        <view class="tr-row">
          <text class="tr-label">有效期至</text>
          <text class="tr-value" :class="{ 'tr-value--danger': isExpired(chain) }">{{ chain.expiryDate || '—' }}</text>
        </view>
        <view class="tr-row">
          <text class="tr-label">保质期</text>
          <text class="tr-value">{{ chain.shelfLifeDays ? chain.shelfLifeDays + ' 天' : '—' }}</text>
        </view>
        <view class="tr-row" v-if="chain.currentLocation">
          <text class="tr-label">当前位置</text>
          <text class="tr-value">{{ chain.currentLocation }}</text>
        </view>
        <view class="tr-row" v-if="chain.qualityCheckResult">
          <text class="tr-label">质检结果</text>
          <text class="tr-value" :class="qualityTone(chain.qualityCheckResult)">{{ qualityLabel(chain.qualityCheckResult) }}</text>
        </view>
      </view>

      <!-- 防伪验证按钮 -->
      <view class="tr-verify-btn" :class="{ 'tr-verify-btn--disabled': verifying }" @tap="onVerify">
        <text class="tr-verify-btn-text">{{ verifying ? '验证中...' : '防伪验证' }}</text>
      </view>

      <!-- 追溯链 -->
      <view class="tr-card" v-if="chain.events && chain.events.length > 0">
        <view class="tr-card-hd">
          <text class="tr-card-title">追溯链</text>
        </view>
        <view class="tr-timeline">
          <view class="tr-tl-item" v-for="(evt, idx) in chain.events" :key="evt.id || idx">
            <view class="tr-tl-left">
              <view class="tr-tl-dot" :class="{ 'tr-tl-dot--first': idx === 0 }"></view>
              <view class="tr-tl-line" v-if="idx < (chain.events?.length || 0) - 1"></view>
            </view>
            <view class="tr-tl-body">
              <view class="tr-tl-top">
                <text class="tr-tl-type">{{ eventLabel(evt.eventType) }}</text>
                <text class="tr-tl-time">{{ formatTime(evt.createdAt) }}</text>
              </view>
              <text class="tr-tl-desc" v-if="evt.remark">{{ evt.remark }}</text>
              <text class="tr-tl-desc" v-else-if="evt.toStatus">状态 → {{ statusLabel(evt.toStatus) }}</text>
              <view class="tr-tl-meta" v-if="evt.operatorName || evt.location">
                <text class="tr-tl-meta-item" v-if="evt.operatorName">{{ evt.operatorName }}</text>
                <text class="tr-tl-meta-item" v-if="evt.location">{{ evt.location }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { traceApi, type TraceChainResult, type TraceVerifyResult, type TraceStatus } from '@/api/modules/trace'

const traceCode = ref('')
const querying = ref(false)
const verifying = ref(false)
const chain = ref<TraceChainResult | null>(null)
const notFound = ref(false)
const verifyResult = ref<TraceVerifyResult | null>(null)

const STATUS_MAP: Record<string, string> = {
  PRODUCED: '已生产',
  PURCHASED: '已采购',
  TRANSFERRED: '已调拨',
  ALLOCATED: '已分配',
  ON_SHELF: '已上架',
  SOLD: '已销售',
  WHOLESALE_SOLD: '批发已售',
  DELIVERING: '配送中',
  DELIVERED: '已送达',
  RETURNED: '已退货',
  DESTROYED: '已销毁',
  EXPIRED: '已过期',
  RECALLED: '已召回',
}

const EVENT_MAP: Record<string, string> = {
  GENERATE: '生成追溯码',
  STATUS_CHANGE: '状态变更',
  RECALL: '召回',
}

const QUALITY_MAP: Record<string, string> = {
  PASS: '合格',
  FAIL: '不合格',
  PENDING: '待检',
}

function statusLabel(status: TraceStatus | string): string {
  return STATUS_MAP[status] || status
}

function eventLabel(type: string): string {
  return EVENT_MAP[type] || type
}

function qualityLabel(result: string | null): string {
  return result ? QUALITY_MAP[result] || result : ''
}

function statusTone(status: TraceStatus | string): string {
  if (['EXPIRED', 'RECALLED'].includes(status)) return 'danger'
  if (['SOLD', 'WHOLESALE_SOLD', 'DELIVERED', 'RETURNED', 'DESTROYED'].includes(status)) return 'muted'
  return 'active'
}

function qualityTone(result: string | null): string {
  if (result === 'FAIL') return 'tr-value--danger'
  if (result === 'PENDING') return 'tr-value--warning'
  return ''
}

function isExpired(item: TraceChainResult): boolean {
  if (!item.expiryDate) return false
  return new Date(item.expiryDate).getTime() < Date.now()
}

function formatNumber(value: number | string): string {
  return String(value ?? 0)
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

function clearCode() {
  traceCode.value = ''
  chain.value = null
  notFound.value = false
  verifyResult.value = null
}

async function onQuery() {
  const code = traceCode.value.trim()
  if (!code) {
    uni.showToast({ title: '请输入追溯码', icon: 'none' })
    return
  }
  if (querying.value) return
  querying.value = true
  chain.value = null
  notFound.value = false
  verifyResult.value = null
  try {
    const result = await traceApi.queryChain(code)
    chain.value = result
  } catch (err) {
    console.error('溯源查询失败:', err)
    notFound.value = true
  } finally {
    querying.value = false
  }
}

async function onVerify() {
  const code = traceCode.value.trim() || chain.value?.traceCode || ''
  if (!code) {
    uni.showToast({ title: '请输入追溯码', icon: 'none' })
    return
  }
  if (verifying.value) return
  verifying.value = true
  try {
    verifyResult.value = await traceApi.verify({ traceCode: code, scanType: 'ADMIN' })
  } catch (err) {
    console.error('防伪验证失败:', err)
  } finally {
    verifying.value = false
  }
}
</script>

<style lang="scss" scoped>
.trace-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
}

/* 页头 */
.tr-hd {
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

/* 搜索 */
.tr-search {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 28rpx;
}

.search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  height: 80rpx;
  background: $uni-bg-color;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  border-radius: $uni-border-radius-pill;
  padding: 0 28rpx;
  gap: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.search-icon {
  font-size: 30rpx;
  color: $uni-gray-400;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: $uni-text-color;
}

.search-placeholder {
  color: $uni-gray-400;
  font-size: 24rpx;
}

.search-clear {
  font-size: 30rpx;
  color: $uni-gray-300;
  padding: 4rpx;
}

.tr-query-btn {
  height: 80rpx;
  padding: 0 36rpx;
  background: $uni-gradient-blue;
  border-radius: $uni-border-radius-pill;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 20rpx rgba(37, 99, 235, 0.25);
}

.tr-query-btn:active {
  transform: scale(0.95);
}

.tr-query-btn--disabled {
  opacity: 0.6;
}

.tr-query-text {
  font-size: 26rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
}

/* 结果区 */
.tr-result {
  height: calc(100vh - 240rpx - env(safe-area-inset-top));
  padding: 8rpx 28rpx 40rpx;
  box-sizing: border-box;
}

/* 防伪验证结果横幅 */
.tr-verify-banner {
  border-radius: $uni-border-radius-base;
  padding: 24rpx 28rpx;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.tr-verify--success {
  background: $uni-color-success-soft;
}

.tr-verify--invalid,
.tr-verify--not_found {
  background: $uni-bg-color-soft;
}

.tr-verify--fraud_alert {
  background: $uni-color-error-soft;
}

.tr-verify--expired {
  background: $uni-color-warning-soft;
}

.tr-verify-title {
  font-size: 28rpx;
  font-weight: 700;
}

.tr-verify--success .tr-verify-title {
  color: $uni-color-success;
}

.tr-verify--invalid .tr-verify-title,
.tr-verify--not_found .tr-verify-title {
  color: $uni-gray-600;
}

.tr-verify--fraud_alert .tr-verify-title {
  color: $uni-color-error;
}

.tr-verify--expired .tr-verify-title {
  color: $uni-color-warning;
}

.tr-verify-sub {
  font-size: 22rpx;
  color: $uni-gray-500;
}

/* 信息卡 */
.tr-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: $uni-shadow-card;
  border: 1rpx solid rgba(0, 0, 0, 0.03);
}

.tr-card-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.tr-card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-text-color;
}

.tr-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24rpx;
  padding: 14rpx 0;
}

.tr-label {
  font-size: 24rpx;
  color: $uni-gray-400;
  flex-shrink: 0;
}

.tr-value {
  font-size: 26rpx;
  color: $uni-gray-700;
  text-align: right;
  word-break: break-all;
}

.tr-value--mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.tr-value--danger {
  color: $uni-color-error;
}

.tr-value--warning {
  color: $uni-color-warning;
}

.tr-status {
  padding: 6rpx 18rpx;
  border-radius: $uni-border-radius-xs;
}

.tr-status--active {
  background: $uni-color-primary-soft;
}

.tr-status--active .tr-status-text {
  color: $uni-color-primary;
}

.tr-status--muted {
  background: $uni-bg-color-soft;
}

.tr-status--muted .tr-status-text {
  color: $uni-gray-500;
}

.tr-status--danger {
  background: $uni-color-error-soft;
}

.tr-status--danger .tr-status-text {
  color: $uni-color-error;
}

.tr-status-text {
  font-size: 22rpx;
  font-weight: 600;
}

/* 防伪验证按钮 */
.tr-verify-btn {
  height: 88rpx;
  background: $uni-gradient-blue;
  border-radius: $uni-border-radius-pill;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
  box-shadow: 0 12rpx 28rpx rgba(37, 99, 235, 0.28);
}

.tr-verify-btn:active {
  transform: scale(0.97);
}

.tr-verify-btn--disabled {
  opacity: 0.6;
}

.tr-verify-btn-text {
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
}

/* 追溯链时间线 */
.tr-timeline {
  padding-top: 4rpx;
}

.tr-tl-item {
  display: flex;
  gap: 20rpx;
}

.tr-tl-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20rpx;
  flex-shrink: 0;
}

.tr-tl-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: $uni-gray-200;
  margin-top: 10rpx;
  flex-shrink: 0;
}

.tr-tl-dot--first {
  background: $uni-color-primary;
  box-shadow: 0 0 0 6rpx $uni-color-primary-soft;
}

.tr-tl-line {
  width: 2rpx;
  flex: 1;
  background: $uni-gray-100;
  margin: 6rpx 0;
}

.tr-tl-body {
  flex: 1;
  padding-bottom: 28rpx;
}

.tr-tl-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.tr-tl-type {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.tr-tl-time {
  font-size: 22rpx;
  color: $uni-gray-300;
  flex-shrink: 0;
}

.tr-tl-desc {
  display: block;
  font-size: 24rpx;
  color: $uni-gray-500;
  margin-top: 6rpx;
}

.tr-tl-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx 20rpx;
  margin-top: 8rpx;
}

.tr-tl-meta-item {
  font-size: 22rpx;
  color: $uni-gray-400;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 180rpx 40rpx;
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

.empty-sub {
  font-size: 24rpx;
  color: $uni-gray-200;
  margin-top: 8rpx;
}
</style>
