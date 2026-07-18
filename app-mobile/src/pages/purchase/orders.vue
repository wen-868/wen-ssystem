<template>
  <view class="purchase-orders-page">
    <view class="page-header">
      <text class="header-title">采购订单</text>
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
            placeholder="搜索采购单号 / 供应商"
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

    <!-- 订单列表 -->
    <scroll-view class="order-list" scroll-y v-if="list.length > 0">
      <view class="order-card" v-for="item in list" :key="item.orderNo">
        <view class="order-header">
          <text class="order-no">采购单号：{{ item.orderNo }}</text>
          <view class="order-status" :class="'status-' + item.status">
            <text class="status-text">{{ item.statusLabel }}</text>
          </view>
        </view>
        <view class="order-body">
          <view class="order-info">
            <text class="info-label">供应商</text>
            <text class="info-value">{{ item.supplierName }}</text>
          </view>
          <view class="order-info">
            <text class="info-label">商品数</text>
            <text class="info-value">{{ item.itemCount }} 种</text>
          </view>
          <view class="order-info">
            <text class="info-label">采购金额</text>
            <text class="info-value info-value--price">¥{{ item.totalAmount }}</text>
          </view>
          <view class="order-info">
            <text class="info-label">下单时间</text>
            <text class="info-value">{{ item.createTime }}</text>
          </view>
        </view>
        <view class="order-actions" v-if="item.status === 'approved'">
          <button class="action-btn stock-btn" @tap="handleInStock(item)">入库</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无采购订单</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { purchaseApi } from '@/api/modules/purchase'

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
  { label: '已入库', value: 'stocked' },
  { label: '已取消', value: 'cancelled' },
]
const activeTab = ref('')
const list = ref<any[]>([])
const loading = ref(false)

function onSearch() { loadOrders() }
function clearSearch() { searchForm.keyword = ''; loadOrders() }
function switchTab(val: string) { activeTab.value = val; loadOrders() }

function handleInStock(item: any) {
  uni.navigateTo({ url: `/pages/purchase/in-stock?orderNo=${item.orderNo}` })
}

async function loadOrders() {
  loading.value = true
  try {
    const res = await purchaseApi.getOrderList({
      page: 1,
      pageSize: 50,
      keyword: searchForm.keyword || undefined,
      status: activeTab.value || undefined
    })
    list.value = res.list || []
  } catch (err) {
    console.error('加载采购订单失败:', err)
    uni.showToast({ title: '加载失败', icon: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadOrders() })
</script>

<style scoped>
.purchase-orders-page {
  min-height: 100vh;
  background: #f0f5ff;
}
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #333;
}
.search-bar {
  padding: 16rpx 24rpx;
  background: #fff;
}
.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: #f5f7fa;
  border-radius: 36rpx;
  padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: #999; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: #333; }
.search-placeholder { color: #bbb; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: #bbb; padding: 4rpx; }
.tab-bar {
  display: flex;
  background: #fff;
  padding: 0 16rpx 16rpx;
  gap: 8rpx;
}
.tab-item {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 32rpx;
}
.tab-item--active { background: #1677FF; }
.tab-item--active .tab-text { color: #fff; }
.tab-text { font-size: 24rpx; color: #666; }
.order-list { padding: 16rpx 24rpx; }
.order-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.order-no { font-size: 26rpx; color: #333; font-weight: 600; }
.order-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending { background: #fff7e6; }
.status-pending .status-text { color: #fa8c16; }
.status-approved { background: #e6f7ff; }
.status-approved .status-text { color: #1677FF; }
.status-stocked { background: #f6ffed; }
.status-stocked .status-text { color: #52c41a; }
.status-cancelled { background: #fff2f0; }
.status-cancelled .status-text { color: #ff4d4f; }
.status-text { font-size: 22rpx; }
.order-body { display: flex; flex-direction: column; gap: 12rpx; }
.order-info { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.info-value--price { color: #1677FF; font-weight: 600; }
.order-actions { margin-top: 16rpx; display: flex; gap: 16rpx; }
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
.stock-btn { background: #1677FF; color: #fff; }
.action-btn::after { border: none; }
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }
</style>