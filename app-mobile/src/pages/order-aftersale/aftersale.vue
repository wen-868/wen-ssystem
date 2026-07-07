<template>
  <view class="aftersale-page">
    <view class="page-header">
      <text class="header-title">售后管理</text>
    </view>

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <text class="search-icon">&#xe614;</text>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索售后单号 / 订单号 / 客户名称"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
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
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无售后申请</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
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

<style scoped>
.aftersale-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.search-bar { padding: 16rpx 24rpx; background: #fff; }
.search-input-wrap {
  display: flex; align-items: center;
  height: 72rpx; background: #f5f7fa;
  border-radius: 36rpx; padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: #999; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: #333; }
.search-placeholder { color: #bbb; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: #bbb; padding: 4rpx; }
.tab-bar {
  display: flex; background: #fff;
  padding: 0 16rpx 16rpx; gap: 8rpx;
}
.tab-item {
  flex: 1; height: 60rpx;
  display: flex; align-items: center; justify-content: center;
  background: #f5f7fa; border-radius: 30rpx;
}
.tab-item--active { background: #722ed1; }
.tab-item--active .tab-text { color: #fff; }
.tab-text { font-size: 22rpx; color: #666; }
.aftersale-list { padding: 16rpx 24rpx; }
.aftersale-card {
  background: #fff; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.header-left { display: flex; align-items: center; gap: 12rpx; }
.aftersale-type {
  padding: 4rpx 14rpx; border-radius: 8rpx; font-size: 22rpx;
}
.type-return { background: #fff7e6; color: #fa8c16; }
.type-exchange { background: #e6f7ff; color: #1677FF; }
.type-refund { background: #fff2f0; color: #ff4d4f; }
.aftersale-no { font-size: 24rpx; color: #999; }
.aftersale-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending { background: #fff7e6; }
.status-pending .status-text { color: #fa8c16; }
.status-processing { background: #e6f7ff; }
.status-processing .status-text { color: #1677FF; }
.status-completed { background: #f6ffed; }
.status-completed .status-text { color: #52c41a; }
.status-rejected { background: #fff2f0; }
.status-rejected .status-text { color: #ff4d4f; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.info-value--refund { color: #ff4d4f; font-weight: 600; }
.card-actions {
  margin-top: 16rpx; padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
  display: flex; gap: 16rpx;
}
.action-btn {
  flex: 1; height: 64rpx; border-radius: 32rpx;
  font-size: 26rpx;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.approve-btn { background: #52c41a; color: #fff; }
.reject-btn { background: #fff2f0; color: #ff4d4f; }
.action-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }
</style>