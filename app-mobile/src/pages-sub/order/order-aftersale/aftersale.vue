<template>
  <view class="aftersale-page">
    <page-header title="售后管理" @back="goBack" />

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
      <view class="aftersale-card" v-for="item in list" :key="item.id">
        <view class="card-header">
          <view class="header-left">
            <text class="aftersale-type" :class="'type--' + typeClass(item.aftersaleType)">{{ item.aftersaleTypeLabel || item.aftersaleType }}</text>
            <text class="aftersale-no">{{ item.aftersaleNo }}</text>
          </view>
          <view class="aftersale-status" :class="'status--' + String(item.status || '').toLowerCase()">
            <text class="status-text">{{ item.statusLabel || item.status }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">关联订单</text>
            <text class="info-value">{{ item.orderNo }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">退款金额</text>
            <text class="info-value info-value--refund">¥{{ Number(item.refundAmount || 0).toFixed(2) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">申请原因</text>
            <text class="info-value info-value--reason">{{ item.reason || '—' }}</text>
          </view>
          <view class="info-row" v-if="item.returnLogisticsNo">
            <text class="info-label">退货物流</text>
            <text class="info-value">{{ item.returnLogisticsCompany || '' }} {{ item.returnLogisticsNo }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">申请时间</text>
            <text class="info-value">{{ formatDate(item.createdAt) }}</text>
          </view>
        </view>
        <view class="card-actions" v-if="item.status === 'PENDING'">
          <button class="action-btn approve-btn" :disabled="acting" @tap="handleApprove(item)">同意</button>
          <button class="action-btn reject-btn" :disabled="acting" @tap="handleReject(item)">拒绝</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else-if="!loading">
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">{{ loadError || '暂无售后申请' }}</text>
      <button class="empty-retry" v-if="loadError" @tap="loadAftersales">点击重试</button>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { aftersaleApi, type AftersaleRecord } from '@/api/modules/aftersale'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

// tab value 与后端售后状态枚举一致（大写），'' = 全部
const tabs = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已拒绝', value: 'REJECTED' },
]
const activeTab = ref('')
const list = ref<AftersaleRecord[]>([])
const loading = ref(false)
const loadError = ref('')
const acting = ref(false)

function onSearch() { loadAftersales() }
function clearSearch() { searchForm.keyword = ''; loadAftersales() }
function switchTab(val: string) { activeTab.value = val; loadAftersales() }

/** 后端售后类型 → 卡片配色 class */
function typeClass(type: string): string {
  const map: Record<string, string> = {
    REFUND_ONLY: 'refund',
    RETURN_REFUND: 'return',
    EXCHANGE: 'exchange',
    REPAIR: 'repair',
  }
  return map[type] ?? 'other'
}

function formatDate(date?: string): string {
  if (!date) return '—'
  return String(date).replace('T', ' ').slice(0, 16)
}

async function handleApprove(item: AftersaleRecord) {
  uni.showModal({
    title: '同意售后',
    content: `确认同意售后单 ${item.aftersaleNo} 的申请？`,
    success: async (res) => {
      if (!res.confirm) return
      acting.value = true
      uni.showLoading({ title: '提交中...' })
      try {
        await aftersaleApi.approve(item.id, '同意售后申请', (item as any).version)
        uni.hideLoading()
        uni.showToast({ title: '已同意', icon: 'success' })
        loadAftersales()
      } catch (err: any) {
        uni.hideLoading()
        uni.showToast({ title: err?.message || '操作失败', icon: 'none' })
      } finally {
        acting.value = false
      }
    }
  })
}

async function handleReject(item: AftersaleRecord) {
  uni.showModal({
    title: '拒绝售后',
    content: `确认拒绝售后单 ${item.aftersaleNo}？请填写拒绝原因`,
    editable: true,
    placeholderText: '请输入拒绝原因（必填）',
    success: async (res) => {
      if (!res.confirm) return
      // editable 为 H5/小程序 2.17.1+ / 新版 App 才支持的输入能力：
      // 不支持时 res.content 为 undefined（视为无需填写，用默认原因）；
      // 支持但用户留空则拦截，避免无理由拒绝。
      const hasInput = typeof (res as any).content === 'string'
      const remark = hasInput ? ((res as any).content || '').trim() : ''
      if (hasInput && !remark) {
        uni.showToast({ title: '请填写拒绝原因', icon: 'none' })
        return
      }
      acting.value = true
      uni.showLoading({ title: '提交中...' })
      try {
        await aftersaleApi.reject(item.id, remark || '商家拒绝售后申请', (item as any).version)
        uni.hideLoading()
        uni.showToast({ title: '已拒绝', icon: 'success' })
        loadAftersales()
      } catch (err: any) {
        uni.hideLoading()
        uni.showToast({ title: err?.message || '操作失败', icon: 'none' })
      } finally {
        acting.value = false
      }
    }
  })
}

async function loadAftersales() {
  loading.value = true
  loadError.value = ''
  try {
    const { records } = await aftersaleApi.list({
      status: activeTab.value || undefined,
      keyword: searchForm.keyword.trim() || undefined,
      page: 1,
      pageSize: 50,
    })
    list.value = records
  } catch (err: any) {
    console.error('加载售后列表失败:', err)
    loadError.value = '加载失败，请检查网络后重试'
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
  padding-top: calc(24rpx + var(--safe-top));
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
.aftersale-list { padding: $uni-spacing-sm $uni-spacing-lg; }
.aftersale-card {
  background: $uni-bg-color; border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base; margin-bottom: $uni-spacing-md;
  box-shadow: $uni-shadow-card-sm;
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.header-left { display: flex; align-items: center; gap: 12rpx; }
.aftersale-type {
  padding: 4rpx $uni-spacing-sm; border-radius: 8rpx; font-size: 22rpx;
}
.type--return { background: $uni-color-warning-soft; color: $uni-color-warning; }
.type--exchange { background: $uni-color-primary-soft; color: $uni-color-primary; }
.type--refund { background: $uni-color-error-soft; color: $uni-color-error; }
.type--repair { background: $uni-color-success-soft; color: $uni-color-success; }
.type--other { background: $uni-bg-color-grey; color: $uni-gray-500; }
.aftersale-no { font-size: 24rpx; color: $uni-gray-400; }
.aftersale-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status--pending { background: $uni-color-warning-soft; }
.status--pending .status-text { color: $uni-color-warning; }
.status--approved { background: $uni-color-primary-soft; }
.status--approved .status-text { color: $uni-color-primary; }
.status--returning, .status--received, .status--inspecting { background: $uni-color-primary-soft; }
.status--returning .status-text, .status--received .status-text, .status--inspecting .status-text { color: $uni-color-primary; }
.status--completed { background: $uni-color-success-soft; }
.status--completed .status-text { color: $uni-color-success; }
.status--rejected, .status--cancelled { background: $uni-color-error-soft; }
.status--rejected .status-text, .status--cancelled .status-text { color: $uni-color-error; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; flex-shrink: 0; margin-right: $uni-spacing-base; }
.info-value { font-size: 26rpx; color: $uni-gray-700; text-align: right; }
.info-value--refund { color: $uni-color-error; font-weight: 600; }
.info-value--reason { max-width: 440rpx; }
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
.approve-btn { background: $uni-color-success; color: $uni-text-color-inverse; }
.reject-btn { background: $uni-color-error-soft; color: $uni-color-error; }
.action-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: $uni-spacing-md; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.empty-retry {
  margin-top: $uni-spacing-md; padding: 0 $uni-spacing-lg; height: 64rpx; line-height: 64rpx;
  border-radius: 32rpx; font-size: 26rpx;
  background: $uni-bg-color; color: $uni-color-primary;
  border: 1rpx solid $uni-color-primary;
}
.empty-retry::after { border: none; }
.safe-bottom { height: 40rpx; }
</style>