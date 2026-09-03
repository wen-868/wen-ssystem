<template>
  <view class="banks-card">
    <view class="banks-head" v-if="showHead">
      <view class="banks-title-wrap">
        <view class="gt-bar"></view>
        <text class="banks-title">{{ title }}</text>
      </view>
      <view class="banks-add" v-if="editable" @tap="openAdd">＋ 添加</view>
    </view>

    <view class="banks-list" v-if="modelValue.length">
      <view class="bank-item" v-for="(b, i) in modelValue" :key="b.id ?? i">
        <view class="bank-main">
          <text class="bank-name">{{ b.bankName || '未命名账户' }}</text>
          <view class="bank-default" v-if="b.isDefault">默认</view>
        </view>
        <view class="bank-sub">
          <text class="bank-no">{{ maskNo(b.accountNo) }}</text>
          <text class="bank-owner" v-if="b.accountName">{{ b.accountName }}</text>
        </view>
        <view class="bank-del" v-if="editable" @tap.stop="remove(i)">删除</view>
      </view>
    </view>
    <view class="banks-empty" v-else>
      <text class="banks-empty-text">暂无银行账户</text>
      <text class="banks-empty-hint" v-if="pendingBackend">（后端 banks 接口对接中）</text>
    </view>

    <!-- 添加银行账户弹层 -->
    <view class="qa-mask" v-if="adding" @tap="adding = false">
      <view class="qa-popup" @tap.stop>
        <view class="qa-title">添加银行账户</view>
        <view class="f-row">
          <text class="f-label">开户行</text>
          <input class="f-input" v-model="form.bankName" placeholder="如 工商银行" placeholder-class="f-ph" />
        </view>
        <view class="f-row">
          <text class="f-label">账号</text>
          <input class="f-input" v-model="form.accountNo" placeholder="银行卡号" placeholder-class="f-ph" />
        </view>
        <view class="f-row">
          <text class="f-label">户名</text>
          <input class="f-input" v-model="form.accountName" placeholder="选填" placeholder-class="f-ph" />
        </view>
        <view class="qa-acts">
          <view class="qa-btn qa-btn--ghost" @tap="adding = false">取消</view>
          <view class="qa-btn" @tap="confirmAdd">保存</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

export interface BankAccount {
  id?: number
  bankName?: string
  accountNo?: string
  accountName?: string
  isDefault?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue: BankAccount[]
    editable?: boolean
    title?: string
    showHead?: boolean
    /** 后端 banks 接口未就绪时的占位提示 */
    pendingBackend?: boolean
  }>(),
  { editable: false, title: '银行账户', showHead: true, pendingBackend: false }
)

const emit = defineEmits<{ (e: 'update:modelValue', v: BankAccount[]): void }>()

const adding = ref(false)
const form = reactive({ bankName: '', accountNo: '', accountName: '' })

function maskNo(no?: string): string {
  const s = (no || '').trim()
  if (!s) return '—'
  if (s.length <= 4) return s
  return '**** **** ' + s.slice(-4)
}

function openAdd() {
  form.bankName = ''
  form.accountNo = ''
  form.accountName = ''
  adding.value = true
}

function confirmAdd() {
  if (!form.bankName.trim() && !form.accountNo.trim()) {
    uni.showToast({ title: '请填写开户行或账号', icon: 'none' })
    return
  }
  const next: BankAccount[] = [...props.modelValue]
  next.push({
    bankName: form.bankName.trim(),
    accountNo: form.accountNo.trim(),
    accountName: form.accountName.trim(),
    isDefault: next.length === 0,
  })
  emit('update:modelValue', next)
  adding.value = false
  uni.showToast({ title: '已添加', icon: 'none' })
}

function remove(i: number) {
  const next = props.modelValue.filter((_, idx) => idx !== i)
  emit('update:modelValue', next)
}
</script>

<style lang="scss" scoped>
/* 复用全局 Token，结构对齐 .pd-group / .pd-gtitle（与商品详情分组一致） */
.banks-card {
  margin: $uni-spacing-sm $uni-spacing-lg;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-base;
  box-shadow: $uni-shadow-card-sm;
  overflow: hidden;
}

.banks-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx 16rpx;
}

.banks-title-wrap {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.gt-bar {
  width: 6rpx;
  height: 24rpx;
  border-radius: 4rpx;
  background: $uni-color-primary;
}

.banks-title {
  font-size: 24rpx;
  font-weight: 700;
  color: $uni-gray-500;
}

.banks-add {
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-color-primary;
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  background: $uni-color-primary-soft;
}

.banks-list {
  padding: 0 32rpx 12rpx;
}

.bank-item {
  position: relative;
  padding: 20rpx 0;
  border-top: 1rpx solid $uni-gray-100;
}

.bank-main {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.bank-name {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color;
}

.bank-default {
  font-size: 20rpx;
  font-weight: 600;
  color: $uni-color-primary;
  background: $uni-color-primary-soft;
  padding: 2rpx 14rpx;
  border-radius: 8rpx;
}

.bank-sub {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 8rpx;
}

.bank-no {
  font-size: 24rpx;
  color: $uni-gray-500;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.bank-owner {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.bank-del {
  position: absolute;
  right: 0;
  top: 20rpx;
  font-size: 24rpx;
  color: $uni-color-error;
  padding: 4rpx 16rpx;
}

.banks-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 40rpx 0;
}

.banks-empty-text {
  font-size: 24rpx;
  color: $uni-gray-300;
}

.banks-empty-hint {
  font-size: 20rpx;
  color: $uni-gray-300;
}

/* 添加弹层（视觉对齐商品详情 .qa-mask/.qa-popup） */
.qa-mask {
  position: fixed;
  inset: 0;
  background: $uni-mask-bg;
  z-index: 400;
  display: flex;
  align-items: flex-end;
}

.qa-popup {
  width: 100%;
  background: $uni-color-primary-soft;
  border-radius: 40rpx 40rpx 0 0;
  padding: 36rpx 32rpx calc(44rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.qa-title {
  font-size: 32rpx;
  font-weight: 700;
  margin-bottom: 28rpx;
  color: $uni-text-color;
}

.f-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid $uni-gray-100;
}

.f-label {
  width: 120rpx;
  font-size: 26rpx;
  color: $uni-gray-500;
  flex-shrink: 0;
}

.f-input {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: $uni-text-color;
  text-align: left;
}

.f-ph {
  color: $uni-gray-300;
}

.qa-acts {
  display: flex;
  gap: 18rpx;
  margin-top: 28rpx;
}

.qa-btn {
  flex: 1;
  height: 88rpx;
  border-radius: $uni-border-radius-sm;
  font-size: 29rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
}

.qa-btn--ghost {
  background: $uni-bg-color;
  color: $uni-gray-600;
  border: 1rpx solid $uni-border-color;
}
</style>
