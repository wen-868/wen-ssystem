<template>
  <view class="aftersale-page">
    <view class="page-header">
            <view class="header-back" @tap="goBack"><text class="header-back-icon">‹</text></view>
      <text class="header-title">售后管理</text>
    </view>

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索售后单号 / 订单号 / 客户名称"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
        </view>
      </view>
    </form>

    <!-- 类型筛选 -->
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

    <!-- 售后列表 -->
    <scroll-view class="aftersale-list" scroll-y v-if="list.length > 0">
      <view class="aftersale-card" v-for="item in list" :key="item.aftersaleNo">
        <view class="card-header">
          <view class="header-left">
            <text class="aftersale-type" :class="'type-' + item.type">{{ item.typeLabel }}</text>
            <text class="aftersale-no">{{ item.aftersaleNo }}</text>
          </view>
          <view class="aftersale-status" :class="'status-' + item.status">
            <text class="status-text">{{ item.statusLabel }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">关联订单</text>
            <text class="info-value">{{ item.orderNo }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">客户</text>
            <text class="info-value">{{ item.customerName }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">商品</text>
            <text class="info-value">{{ item.productName }} × {{ item.qty }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">退款金额</text>
            <text class="info-value info-value--refund">¥{{ item.refundAmount }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">申请原因</text>
            <text class="info-value">{{ item.reason }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">申请时间</text>
            <text class="info-value">{{ item.createTime }}</text>
          </view>
        </view>
        <view class="card-actions" v-if="item.status === 'pending'">
          <button class="action-btn approve-btn" @tap="handleApprove(item)">同意</button>
          <button class="action-btn reject-btn" @tap="handleReject(item)">拒绝</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无售后申请</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const tabs = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已完成', value: 'completed' },
  { label: '已拒绝', value: 'rejected' },
]
const activeTab = ref('')
const list = ref<any[]>([])
const loading = ref(false)

function onSearch() { loadAftersales() }
function clearSearch() { searchForm.keyword = ''; loadAftersales() }
function switchTab(val: string) { activeTab.value = val; loadAftersales() }

function handleApprove(item: any) {
  uni.showModal({
    title: '同意售后',
    content: '确认同意该售后申请？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已同意', icon: 'success' })
      }
    }
  })
}

function handleReject(item: any) {
  uni.showModal({
    title: '拒绝售后',
    content: '确认拒绝该售后申请？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已拒绝', icon: 'success' })
      }
    }
  })
}

async function loadAftersales() {
  loading.value = true
  try {
    list.value = []
  } catch (err) {
    console.error('加载售后列表失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadAftersales() })
</script>

<style lang="scss" scoped>
.aftersale-page { min-height: 100vh; background: $uni-color-primary-soft; }
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
.tab-item--active { background: $uni-color-purple; }
.tab-item--active .tab-text { color: $uni-text-color-inverse; }
.tab-text { font-size: 22rpx; color: $uni-gray-500; }
.aftersale-list { padding: 16rpx 24rpx; }
.aftersale-card {
  background: $uni-bg-color; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.header-left { display: flex; align-items: center; gap: 12rpx; }
.aftersale-type {
  padding: 4rpx 14rpx; border-radius: 8rpx; font-size: 22rpx;
}
.type-return { background: $uni-color-warning-soft; color: $uni-color-warning; }
.type-exchange { background: $uni-color-primary-soft; color: $uni-color-primary; }
.type-refund { background: $uni-color-error-soft; color: $uni-color-error; }
.aftersale-no { font-size: 24rpx; color: $uni-gray-400; }
.aftersale-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending { background: $uni-color-warning-soft; }
.status-pending .status-text { color: $uni-color-warning; }
.status-processing { background: $uni-color-primary-soft; }
.status-processing .status-text { color: $uni-color-primary; }
.status-completed { background: $uni-color-success-soft; }
.status-completed .status-text { color: $uni-color-success; }
.status-rejected { background: $uni-color-error-soft; }
.status-rejected .status-text { color: $uni-color-error; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.info-value--refund { color: $uni-color-error; font-weight: 600; }
.card-actions {
  margin-top: 16rpx; padding-top: 16rpx;
  border-top: 1rpx solid $uni-gray-100;
  display: flex; gap: 16rpx;
}
.action-btn {
  flex: 1; height: 64rpx; border-radius: 32rpx;
  font-size: 26rpx;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.approve-btn { background: $uni-color-success; color: $uni-text-color-inverse; }
.reject-btn { background: $uni-color-error-soft; color: $uni-color-error; }
.action-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.safe-bottom { height: 40rpx; }
</style>