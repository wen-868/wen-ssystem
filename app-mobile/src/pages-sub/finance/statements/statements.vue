<template>
  <view class="statements-page">
    <page-header title="客户对账" @back="goBack" />

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索对账单号 / 客户名称"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
        </view>
      </view>
    </form>

    <!-- 对账单列表 -->
    <scroll-view class="statement-list" scroll-y v-if="list.length > 0">
      <view class="statement-card" v-for="item in list" :key="item.statementNo">
        <view class="card-header">
          <text class="statement-no">{{ item.statementNo }}</text>
          <view class="statement-status" :class="'status-' + item.status">
            <text class="status-text">{{ item.statusLabel }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">客户</text>
            <text class="info-value">{{ item.customerName }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">对账期间</text>
            <text class="info-value">{{ item.periodStart }} ~ {{ item.periodEnd }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">本期采购</text>
            <text class="info-value info-value--price">¥{{ item.purchaseAmount }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">已付金额</text>
            <text class="info-value info-value--paid">¥{{ item.paidAmount }}</text>
          </view>
          <view class="info-row info-row--total">
            <text class="info-label">未付金额</text>
            <text class="info-value info-value--unpaid">¥{{ item.unpaidAmount }}</text>
          </view>
        </view>
        <view class="card-actions" v-if="item.status === 'pending'">
          <button class="action-btn confirm-btn" @tap="confirmStatement(item)">确认</button>
          <button class="action-btn dispute-btn" @tap="disputeStatement(item)">有争议</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无对账单</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { statementApi } from '@/api/modules/statements'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const list = ref<any[]>([])
const loading = ref(false)

function onSearch() { loadStatements() }
function clearSearch() { searchForm.keyword = ''; loadStatements() }

async function confirmStatement(item: any) {
  uni.showModal({
    title: '确认对账',
    content: '确认对账单无误？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await statementApi.confirm(item.statementNo)
          uni.showToast({ title: '已确认', icon: 'success' })
          loadStatements()
        } catch (err) {
          uni.showToast({ title: '确认失败', icon: 'error' })
        }
      }
    }
  })
}

function disputeStatement(item: any) {
  uni.showModal({
    title: '争议处理',
    content: '标记对账单为有争议？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已标记争议', icon: 'success' })
      }
    }
  })
}

async function loadStatements() {
  loading.value = true
  try {
    const res = await statementApi.getList({
      page: 1,
      pageSize: 50,
      keyword: searchForm.keyword || undefined
    })
    list.value = res.list || []
  } catch (err) {
    console.error('加载对账单失败:', err)
    uni.showToast({ title: '加载失败', icon: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadStatements() })
</script>

<style lang="scss" scoped>
.statements-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-gray-700;
}
.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
}
.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: $uni-bg-color-page;
  border-radius: 36rpx;
  padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.search-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: $uni-gray-300; padding: 4rpx; }
.statement-list { padding: 16rpx 24rpx; }
.statement-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.statement-no { font-size: 26rpx; color: $uni-gray-700; font-weight: 600; }
.statement-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending { background: $uni-color-warning-soft; }
.status-pending .status-text { color: $uni-color-warning; }
.status-confirmed { background: $uni-color-success-soft; }
.status-confirmed .status-text { color: $uni-color-success; }
.status-disputed { background: $uni-color-error-soft; }
.status-disputed .status-text { color: $uni-color-error; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 12rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-row--total {
  margin-top: 8rpx;
  padding-top: 12rpx;
  border-top: 1rpx dashed $uni-gray-100;
}
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.info-value--price { color: $uni-gray-700; font-weight: 600; }
.info-value--paid { color: $uni-color-success; font-weight: 600; }
.info-value--unpaid { color: $uni-color-error; font-weight: 600; font-size: 30rpx; }
.card-actions {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid $uni-gray-100;
  display: flex;
  gap: 16rpx;
}
.action-btn {
  flex: 1;
  height: 64rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}
.confirm-btn { background: $uni-color-primary; color: $uni-text-color-inverse; }
.dispute-btn { background: $uni-bg-color-grey; color: $uni-color-error; }
.action-btn::after { border: none; }
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.safe-bottom { height: 40rpx; }
</style>