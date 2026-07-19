<template>
  <view class="sale-bills-page">
    <view class="page-header">
      <text class="header-title">销售单</text>
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
            placeholder="搜索销售单号 / 客户名称"
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

    <view class="loading-overlay" v-if="loading && list.length === 0">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 虚拟滚动销售单列表 -->
    <virtual-list
      v-if="list.length > 0"
      class="bill-list"
      :data="list"
      :item-size="itemSize"
      :height="0"
      :buffer="5"
      item-key="billNo"
      :refresher-enabled="true"
      :refresher-triggered="refresherTriggered"
      @load-more="onLoadMore"
      @refresh="onPullDownRefresh"
    >
      <template #default="{ item }">
        <view class="bill-card" @tap="goDetail(item)">
          <view class="card-header">
            <text class="bill-no">{{ item.billNo }}</text>
            <view class="bill-status" :class="'status-' + item.status">
              <text class="status-text">{{ item.statusLabel }}</text>
            </view>
          </view>
          <view class="card-body">
            <view class="info-row">
              <text class="info-label">客户</text>
              <text class="info-value">{{ item.customerName }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">商品数</text>
              <text class="info-value">{{ item.itemCount }} 种</text>
            </view>
            <view class="info-row">
              <text class="info-label">总金额</text>
              <text class="info-value info-value--price">¥{{ item.totalAmount }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">支付方式</text>
              <text class="info-value">{{ item.paymentMethod || '—' }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">销售日期</text>
              <text class="info-value">{{ item.saleDate }}</text>
            </view>
          </view>
        </view>
      </template>
    </virtual-list>

    <!-- 空状态 -->
    <view class="empty-state" v-if="!loading && list.length === 0">
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无销售单</text>
    </view>

    <!-- 加载更多 -->
    <view class="load-more" v-if="list.length > 0">
      <view class="loading-more-spinner" v-if="loadingMore"></view>
      <text class="load-more-text" v-if="loadingMore">加载中...</text>
      <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import VirtualList from '@/components/virtual-list.vue'

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
  { label: '已作废', value: 'voided' },
]
const activeTab = ref('')
const list = ref<any[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const refresherTriggered = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

/** 单行高度（px），onMounted 时按 rpx 转 px 计算 */
const itemSize = ref(280)

function onSearch() {
  page.value = 1
  noMore.value = false
  list.value = []
  loadBills()
}

function clearSearch() {
  searchForm.keyword = ''
  page.value = 1
  noMore.value = false
  list.value = []
  loadBills()
}

function switchTab(val: string) {
  if (activeTab.value === val) return
  activeTab.value = val
  page.value = 1
  noMore.value = false
  list.value = []
  loadBills()
}

function goDetail(item: any) {
  uni.navigateTo({ url: `/pages-sub/order/sales/sale-detail?billNo=${item.billNo}` })
}

async function loadBills() {
  if (loading.value) return
  loading.value = true
  try {
    // 占位实现：保持原有逻辑，待后端 API 接入后替换为真实数据
    // 接入示例：
    // const result = await salesApi.list({
    //   keyword: searchForm.keyword || undefined,
    //   status: activeTab.value || undefined,
    //   page: page.value,
    //   pageSize
    // })
    // if (page.value === 1) {
    //   list.value = result.list || []
    // } else {
    //   list.value = [...list.value, ...(result.list || [])]
    // }
    // noMore.value = !result.list || result.list.length < pageSize
    list.value = []
    noMore.value = true
  } catch (err) {
    console.error('加载销售单失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
    loadingMore.value = false
    refresherTriggered.value = false
  }
}

function onLoadMore() {
  if (loadingMore.value || noMore.value || loading.value) return
  loadingMore.value = true
  page.value++
  loadBills()
}

function onPullDownRefresh() {
  refresherTriggered.value = true
  page.value = 1
  noMore.value = false
  list.value = []
  loadBills()
}

onMounted(() => {
  // rpx 转 px：280rpx 适配不同设备宽度
  try {
    itemSize.value = uni.upx2px(280)
  } catch (e) {
    itemSize.value = 140
  }
  loadBills()
})
</script>

<style scoped>
.sale-bills-page {
  min-height: 100vh;
  background: #f0f5ff;
  display: flex;
  flex-direction: column;
}
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
.tab-item--active { background: #fa8c16; }
.tab-item--active .tab-text { color: #fff; }
.tab-text { font-size: 22rpx; color: #666; }
.bill-list { padding: 16rpx 24rpx; }
.bill-card {
  background: #fff; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
  box-sizing: border-box;
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.bill-no { font-size: 26rpx; color: #333; font-weight: 600; }
.bill-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending { background: #fff7e6; }
.status-pending .status-text { color: #fa8c16; }
.status-approved { background: #e6f7ff; }
.status-approved .status-text { color: #1677FF; }
.status-completed { background: #f6ffed; }
.status-completed .status-text { color: #52c41a; }
.status-voided { background: #fff2f0; }
.status-voided .status-text { color: #ff4d4f; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.info-value--price { color: #fa8c16; font-weight: 600; }
.loading-overlay {
  display: flex; flex-direction: column;
  align-items: center; padding: 120rpx 0;
}
.loading-spinner {
  width: 48rpx; height: 48rpx;
  border: 4rpx solid #e5e7eb;
  border-top-color: #fa8c16;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16rpx;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 26rpx; color: #999; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.load-more {
  display: flex; align-items: center; justify-content: center;
  padding: 24rpx 0; gap: 12rpx;
}
.loading-more-spinner {
  width: 32rpx; height: 32rpx;
  border: 3rpx solid #e5e7eb;
  border-top-color: #fa8c16;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.load-more-text { font-size: 24rpx; color: #999; }
.safe-bottom { height: 40rpx; }
</style>
