<template>
  <view class="exception-page">
    <page-header title="异常订单" @back="goBack" />

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索订单号 / 客户名称"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
        </view>
      </view>
    </form>

    <!-- 异常类型筛选 -->
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

    <!-- 异常订单列表 -->
    <scroll-view class="exception-list" scroll-y v-if="list.length > 0" @scrolltolower="onLoadMore">
      <view class="exception-card" v-for="item in list" :key="item.exceptionNo">
        <view class="card-header">
          <view class="header-left">
            <text class="exception-type" :class="'type-' + item.type">{{ item.typeLabel }}</text>
            <text class="exception-no">{{ item.exceptionNo }}</text>
          </view>
          <view class="exception-status" :class="'status-' + item.status">
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
            <text class="info-label">异常描述</text>
            <text class="info-value">{{ item.description }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">发生时间</text>
            <text class="info-value">{{ item.createTime }}</text>
          </view>
        </view>
        <view class="card-actions" v-if="item.status === 'pending'">
          <button class="action-btn handle-btn" @tap="handleException(item)">处理</button>
          <button class="action-btn ignore-btn" @tap="ignoreException(item)">忽略</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else-if="!loading">
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无异常订单</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { exceptionApi } from '@/api/modules/exceptions'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const tabs = [
  { label: '全部', value: '' },
  { label: '超时未处理', value: 'timeout' },
  { label: '库存不足', value: 'stockout' },
  { label: '物流异常', value: 'logistics' },
  { label: '其他', value: 'other' },
]
const activeTab = ref('')
const list = ref<any[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)
/** tab → 后端异常类型（空=全部） */
const TYPE_MAP: Record<string, string> = {
  timeout: 'TIMEOUT',
  stockout: 'STOCKOUT',
  logistics: 'LOGISTICS',
  other: 'OTHER',
}

function onSearch() { page.value = 1; loadExceptions() }
function clearSearch() { searchForm.keyword = ''; page.value = 1; loadExceptions() }
function switchTab(val: string) { activeTab.value = val; page.value = 1; loadExceptions() }

async function handleException(item: any) {
  uni.showModal({
    title: '处理异常',
    content: '确认处理该异常订单？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await exceptionApi.handle(item.id, '已处理', 'RESOLVED')
          uni.showToast({ title: '已处理', icon: 'success' })
          loadExceptions()
        } catch (err) {
          console.error('处理失败:', err)
          uni.showToast({ title: '处理失败', icon: 'none' })
        }
      }
    }
  })
}

function ignoreException(item: any) {
  uni.showModal({
    title: '忽略异常',
    content: '确认忽略该异常？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await exceptionApi.handle(item.id, '已忽略', 'CLOSED')
          uni.showToast({ title: '已忽略', icon: 'success' })
          loadExceptions()
        } catch (err) {
          console.error('忽略失败:', err)
          uni.showToast({ title: '忽略失败', icon: 'none' })
        }
      }
    }
  })
}

async function loadExceptions() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await exceptionApi.getList({
      keyword: searchForm.keyword || undefined,
      status: activeTab.value || undefined,
      exceptionType: activeTab.value ? TYPE_MAP[activeTab.value] : undefined,
      page: page.value,
      pageSize,
    })
    const rows = result.records || []
    if (page.value === 1) {
      list.value = rows
    } else {
      list.value = [...list.value, ...rows]
    }
    noMore.value = rows.length < pageSize
  } catch (err) {
    console.error('加载异常订单失败:', err)
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadExceptions() })

/** 触底加载更多 */
function onLoadMore() {
  if (loading.value || noMore.value) return
  page.value += 1
  loadExceptions()
}
</script>

<style lang="scss" scoped>
.exception-page {
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
.tab-bar {
  display: flex;
  background: $uni-bg-color;
  padding: 0 16rpx 16rpx;
  gap: 8rpx;
}
.tab-item {
  flex: 1;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $uni-bg-color-page;
  border-radius: 30rpx;
}
.tab-item--active { background: $uni-color-error; }
.tab-item--active .tab-text { color: $uni-text-color-inverse; }
.tab-text { font-size: 22rpx; color: $uni-gray-500; }
.exception-list { padding: 16rpx 24rpx; height: calc(100vh - 340rpx); }
.exception-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
  border-left: 6rpx solid $uni-color-error;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.header-left { display: flex; align-items: center; gap: 12rpx; }
.exception-type {
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}
.type-timeout { background: $uni-color-warning-soft; color: $uni-color-warning; }
.type-stockout { background: $uni-color-error-soft; color: $uni-color-error; }
.type-logistics { background: $uni-color-primary-soft; color: $uni-color-primary; }
.type-other { background: $uni-bg-color-grey; color: $uni-gray-500; }
.exception-no { font-size: 24rpx; color: $uni-gray-400; }
.exception-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending { background: $uni-color-warning-soft; }
.status-pending .status-text { color: $uni-color-warning; }
.status-resolved { background: $uni-color-success-soft; }
.status-resolved .status-text { color: $uni-color-success; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 12rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; flex: 1; text-align: right; }
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
.handle-btn { background: $uni-color-primary; color: $uni-text-color-inverse; }
.ignore-btn { background: $uni-bg-color-grey; color: $uni-gray-400; }
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
