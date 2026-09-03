<template>
  <view class="doc-mask" v-if="modelValue" @tap="close">
    <view class="doc-panel" @tap.stop>
      <!-- 头部 -->
      <view class="doc-head">
        <view class="doc-head-bar"></view>
        <text class="doc-title">{{ title }}</text>
        <view class="doc-close" @tap="close">✕</view>
      </view>

      <!-- 汇总条 -->
      <view class="doc-summary">
        <view class="doc-summary-left">
          <text class="doc-summary-count">{{ docs.length }} 笔</text>
          <text class="doc-summary-label">{{ amountLabel }}</text>
        </view>
        <text class="doc-summary-amount">{{ formatMoney(total) }}</text>
      </view>

      <!-- 列表 -->
      <scroll-view class="doc-body" scroll-y>
        <view v-if="loading" class="doc-tip">
          <text class="doc-tip-text">加载中…</text>
        </view>

        <template v-else-if="docs.length">
          <view class="doc-item" v-for="(d, i) in docs" :key="d.no || i">
            <view class="doc-item-main">
              <text class="doc-item-no">{{ d.no || '—' }}</text>
              <view class="doc-status" :class="statusClass(d.statusType)">{{ d.status || '—' }}</view>
            </view>
            <view class="doc-item-sub">
              <text class="doc-item-date">{{ d.date || '' }}</text>
              <text class="doc-item-extra" v-if="d.sub">{{ d.sub }}</text>
            </view>
            <text class="doc-item-amount">{{ formatMoney(d.amount) }}</text>
          </view>
        </template>

        <view v-else class="doc-empty">
          <text class="doc-empty-text">暂无单据</text>
          <text class="doc-empty-hint" v-if="pendingBackend">（后端单据接口对接中）</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/** 单据行：由父级把真实接口数据归一化后传入，保证组件可复用（供应商/会员/公司通用） */
export interface DocRow {
  no: string
  date?: string
  amount: number
  status?: string
  statusType?: 'success' | 'warning' | 'danger' | 'info' | 'default'
  sub?: string
}

const props = withDefaults(
  defineProps<{
    /** 受控显隐（v-model） */
    modelValue: boolean
    title?: string
    docs: DocRow[]
    amountLabel?: string
    loading?: boolean
    /** 后端单据接口未就绪时的占位提示 */
    pendingBackend?: boolean
  }>(),
  { title: '历史单据', amountLabel: '合计金额', loading: false, pendingBackend: false }
)

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const total = computed(() =>
  props.docs.reduce((sum, d) => sum + Number(d.amount || 0), 0)
)

function close() {
  emit('update:modelValue', false)
}

function statusClass(t?: DocRow['statusType']): string {
  return t ? `status-tag ${t}` : 'status-tag default'
}

function formatMoney(n: number): string {
  const v = Number(n || 0)
  return '¥' + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<style lang="scss" scoped>
/* 复用全局 Token；结构对齐 BanksCard 的 .qa-mask/.qa-popup，但作为覆盖式子页（#docPage） */
.doc-mask {
  position: fixed;
  inset: 0;
  background: $uni-mask-bg;
  z-index: 500;
  display: flex;
  align-items: flex-end;
}

.doc-panel {
  width: 100%;
  height: 86vh;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-lg $uni-border-radius-lg 0 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding-bottom: env(safe-area-inset-bottom);
}

.doc-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28rpx 32rpx 20rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}

.doc-head-bar {
  position: absolute;
  top: 12rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 72rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: $uni-gray-200;
}

.doc-title {
  font-size: $uni-font-size-lg;
  font-weight: $uni-font-bold;
  color: $uni-text-color;
}

.doc-close {
  position: absolute;
  right: 28rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  color: $uni-gray-400;
  border-radius: $uni-border-radius-circle;
  background: $uni-bg-color-soft;
}

.doc-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  background: $uni-color-primary-soft;
}

.doc-summary-left {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.doc-summary-count {
  font-size: $uni-font-size-sm;
  font-weight: $uni-font-semibold;
  color: $uni-text-color-secondary;
}

.doc-summary-label {
  font-size: $uni-font-size-xs;
  color: $uni-text-color-grey;
}

.doc-summary-amount {
  font-size: $uni-font-size-xxl;
  font-weight: $uni-font-bold;
  color: $uni-color-primary;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.doc-body {
  flex: 1;
  min-height: 0;
  padding: 8rpx 32rpx 32rpx;
}

.doc-item {
  position: relative;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $uni-gray-100;
}

.doc-item-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.doc-item-no {
  font-size: $uni-font-size-base;
  font-weight: $uni-font-semibold;
  color: $uni-text-color;
}

.doc-item-sub {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 8rpx;
}

.doc-item-date {
  font-size: $uni-font-size-xs;
  color: $uni-text-color-grey;
}

.doc-item-extra {
  font-size: $uni-font-size-xs;
  color: $uni-gray-400;
}

.doc-item-amount {
  position: absolute;
  right: 0;
  bottom: 24rpx;
  font-size: $uni-font-size-lg;
  font-weight: $uni-font-semibold;
  color: $uni-text-color;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.doc-empty,
.doc-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 80rpx 0;
}

.doc-empty-text,
.doc-tip-text {
  font-size: $uni-font-size-sm;
  color: $uni-gray-300;
}

.doc-empty-hint {
  font-size: $uni-font-size-xs;
  color: $uni-gray-300;
}
</style>
