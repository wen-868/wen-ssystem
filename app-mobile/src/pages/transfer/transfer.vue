<template>
  <view class="transfer-page">
    <view class="page-header">
      <text class="header-title">库存调拨</text>
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
            placeholder="搜索调拨单号 / 商品名称"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
        </view>
      </view>
    </form>

    <!-- 状态筛选 -->
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

    <!-- 新建按钮 -->
    <view class="create-section">
      <button class="create-btn" @tap="goCreate">
        <text>+ 新建调拨单</text>
      </button>
    </view>

    <!-- 调拨单列表 -->
    <scroll-view class="transfer-list" scroll-y v-if="list.length > 0">
      <view class="transfer-card" v-for="item in list" :key="item.transferNo">
        <view class="card-header">
          <text class="transfer-no">{{ item.transferNo }}</text>
          <view class="transfer-status" :class="'status-' + item.status">
            <text class="status-text">{{ item.statusLabel }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">调出仓库</text>
            <text class="info-value">{{ item.fromStore }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">调入仓库</text>
            <text class="info-value">{{ item.toStore }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">商品数</text>
            <text class="info-value">{{ item.itemCount }} 种</text>
          </view>
          <view class="info-row">
            <text class="info-label">调拨数量</text>
            <text class="info-value">{{ item.totalQty }} 件</text>
          </view>
          <view class="info-row">
            <text class="info-label">创建时间</text>
            <text class="info-value">{{ item.createTime }}</text>
          </view>
        </view>
        <view class="card-actions" v-if="item.status === 'pending'">
          <button class="action-btn approve-btn" @tap="handleApprove(item)">审核通过</button>
          <button class="action-btn reject-btn" @tap="handleReject(item)">驳回</button>
        </view>
        <view class="card-actions" v-else-if="item.status === 'approved'">
          <button class="action-btn stock-btn" @tap="handleInStock(item)">确认入库</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无调拨单</text>
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
  { label: '待审核', value: 'pending' },
  { label: '已审核', value: 'approved' },
  { label: '已完成', value: 'completed' },
  { label: '已驳回', value: 'rejected' },
]
const activeTab = ref('')
const list = ref<any[]>([])
const loading = ref(false)

function onSearch() { loadTransfers() }
function clearSearch() { searchForm.keyword = ''; loadTransfers() }
function switchTab(val: string) { activeTab.value = val; loadTransfers() }
function goCreate() {
  uni.navigateTo({ url: '/pages/transfer/create' })
}

function handleApprove(item: any) {
  uni.showModal({
    title: '审核通过',
    content: '确认审核通过该调拨单？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已通过', icon: 'success' })
      }
    }
  })
}

function handleReject(item: any) {
  uni.showModal({
    title: '驳回',
    content: '确认驳回该调拨单？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已驳回', icon: 'success' })
      }
    }
  })
}

function handleInStock(item: any) {
  uni.showModal({
    title: '确认入库',
    content: '确认商品已入库？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已入库', icon: 'success' })
      }
    }
  })
}

async function loadTransfers() {
  loading.value = true
  try {
    list.value = []
  } catch (err) {
    console.error('加载调拨单失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadTransfers() })
</script>

<style scoped>
.transfer-page { min-height: 100vh; background: #f0f5ff; }
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
.tab-item--active { background: #1677FF; }
.tab-item--active .tab-text { color: #fff; }
.tab-text { font-size: 22rpx; color: #666; }
.create-section { padding: 16rpx 24rpx; }
.create-btn {
  width: 100%; height: 80rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 40rpx; font-size: 28rpx;
  font-weight: 600; color: #fff;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.create-btn::after { border: none; }
.transfer-list { padding: 0 24rpx 24rpx; }
.transfer-card {
  background: #fff; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.transfer-no { font-size: 26rpx; color: #333; font-weight: 600; }
.transfer-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending { background: #fff7e6; }
.status-pending .status-text { color: #fa8c16; }
.status-approved { background: #e6f7ff; }
.status-approved .status-text { color: #1677FF; }
.status-completed { background: #f6ffed; }
.status-completed .status-text { color: #52c41a; }
.status-rejected { background: #fff2f0; }
.status-rejected .status-text { color: #ff4d4f; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
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
.stock-btn { background: #1677FF; color: #fff; }
.action-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }
</style>