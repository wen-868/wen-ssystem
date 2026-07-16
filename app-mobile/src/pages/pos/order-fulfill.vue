<template>
  <view class="order-fulfill-page">
    <view class="page-header">
      <text class="header-title">接单履约</text>
    </view>

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
        <view class="tab-badge" v-if="tab.count !== undefined && tab.count > 0">
          <text class="tab-badge-text">{{ tab.count }}</text>
        </view>
      </view>
    </view>

    <!-- 订单列表 -->
    <scroll-view
      class="order-list"
      scroll-y
      v-if="list.length > 0"
      @scrolltolower="loadMore"
    >
      <view class="order-card" v-for="item in list" :key="item.orderNo">
        <view class="card-header">
          <view class="channel-tag" :class="'channel-' + (item.channel || 'default')">
            <text class="channel-text">{{ getChannelLabel(item.channel) }}</text>
          </view>
          <text class="order-no">{{ item.orderNo }}</text>
          <view class="order-status" :class="'status-' + item.status">
            <text class="status-text">{{ getStatusLabel(item.status) }}</text>
          </view>
        </view>

        <view class="card-body">
          <view class="info-row">
            <text class="info-label">客户</text>
            <text class="info-value">{{ item.customerName || '散客' }}</text>
          </view>
          <view class="info-row" v-if="item.customerMobile">
            <text class="info-label">电话</text>
            <text class="info-value" @tap="callPhone(item.customerMobile!)">{{ item.customerMobile }}</text>
          </view>
          <view class="info-row" v-if="item.address">
            <text class="info-label">地址</text>
            <text class="info-value info-value--addr">{{ item.address }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">金额</text>
            <text class="info-value info-value--price">¥{{ Number(item.totalAmount || 0).toFixed(2) }}</text>
          </view>
          <view class="info-row" v-if="item.acceptDeadline">
            <text class="info-label">接单截止</text>
            <text class="info-value info-value--warn">{{ item.acceptDeadline }}</text>
          </view>
        </view>

        <view class="goods-list" v-if="item.items && item.items.length > 0">
          <view class="goods-item" v-for="(g, idx) in item.items" :key="idx">
            <text class="goods-name">{{ g.skuName }}</text>
            <text class="goods-qty">x{{ g.quantity }}</text>
            <text class="goods-price">¥{{ Number(g.unitPrice || 0).toFixed(2) }}</text>
          </view>
        </view>

        <view class="card-footer">
          <template v-if="item.status === 'pending'">
            <view class="action-btn action-btn--danger" @tap="onReject(item)">拒单</view>
            <view class="action-btn action-btn--primary" @tap="onAccept(item)">接单</view>
          </template>
          <template v-else-if="item.status === 'accepted'">
            <view class="action-btn action-btn--primary" @tap="onStartDelivery(item)">开始配送</view>
          </template>
          <template v-else-if="item.status === 'delivering'">
            <view class="action-btn action-btn--primary" @tap="onComplete(item)">完成订单</view>
          </template>
          <view class="action-btn" @tap="goDetail(item)">详情</view>
        </view>
      </view>

      <view class="load-tip" v-if="loading">
        <text class="load-tip-text">加载中...</text>
      </view>
      <view class="load-tip" v-else-if="noMore">
        <text class="load-tip-text">没有更多了</text>
      </view>
    </scroll-view>

    <view class="empty-state" v-else-if="!loading">
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无订单</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeApi, type StoreOrder } from '@/api/modules/store'

const tabs = ref([
  { label: '待接单', value: 'pending', count: 0 },
  { label: '已接单', value: 'accepted', count: undefined },
  { label: '配送中', value: 'delivering', count: undefined },
  { label: '已完成', value: 'completed', count: undefined },
  { label: '全部', value: '', count: undefined },
])
const activeTab = ref('pending')
const list = ref<StoreOrder[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

function switchTab(val: string) {
  activeTab.value = val
  page.value = 1
  noMore.value = false
  list.value = []
  loadOrders()
}

function getChannelLabel(channel?: string): string {
  const map: Record<string, string> = {
    meituan: '美团',
    eleme: '饿了么',
    douyin: '抖音',
    jd: '京东到家',
    default: '门店',
  }
  return map[channel || 'default'] || channel || '门店'
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待接单',
    accepted: '已接单',
    delivering: '配送中',
    completed: '已完成',
    rejected: '已拒单',
    cancelled: '已取消',
  }
  return map[status] || status
}

function callPhone(mobile: string) {
  uni.makePhoneCall({ phoneNumber: mobile })
}

function goDetail(item: StoreOrder) {
  uni.navigateTo({ url: `/pages/pos/order-fulfill?orderNo=${item.orderNo}` })
}

async function loadOrders() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await storeApi.fetchOrders({ page: page.value, pageSize })
    const rows = res?.list || res?.records || []
    const filtered = activeTab.value ? rows.filter((o: StoreOrder) => o.status === activeTab.value) : rows
    if (page.value === 1) {
      list.value = filtered
    } else {
      list.value.push(...filtered)
    }
    noMore.value = rows.length < pageSize
    // 更新待接单数量
    if (activeTab.value === 'pending' && page.value === 1) {
      tabs.value[0].count = filtered.length
    }
  } catch (err) {
    console.error('加载订单失败:', err)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (noMore.value || loading.value) return
  page.value += 1
  loadOrders()
}

function onAccept(item: StoreOrder) {
  uni.showModal({
    title: '确认接单',
    content: `订单 ${item.orderNo}，确认接单吗？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        uni.showLoading({ title: '处理中...' })
        await storeApi.acceptOrder(item.orderNo)
        uni.showToast({ title: '接单成功', icon: 'success' })
        switchTab(activeTab.value)
      } catch (err) {
        console.error('接单失败:', err)
      } finally {
        uni.hideLoading()
      }
    },
  })
}

function onReject(item: StoreOrder) {
  uni.showModal({
    title: '确认拒单',
    content: `订单 ${item.orderNo}，确认拒单吗？拒单后无法恢复。`,
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (!res.confirm) return
      try {
        uni.showLoading({ title: '处理中...' })
        await storeApi.rejectOrder(item.orderNo)
        uni.showToast({ title: '已拒单', icon: 'success' })
        switchTab(activeTab.value)
      } catch (err) {
        console.error('拒单失败:', err)
      } finally {
        uni.hideLoading()
      }
    },
  })
}

function onStartDelivery(item: StoreOrder) {
  uni.showModal({
    title: '开始配送',
    content: `订单 ${item.orderNo}，确认开始配送吗？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        uni.showLoading({ title: '处理中...' })
        await storeApi.startDelivery(item.orderNo)
        uni.showToast({ title: '已开始配送', icon: 'success' })
        switchTab(activeTab.value)
      } catch (err) {
        console.error('操作失败:', err)
      } finally {
        uni.hideLoading()
      }
    },
  })
}

function onComplete(item: StoreOrder) {
  uni.showModal({
    title: '完成订单',
    content: `订单 ${item.orderNo}，确认已完成吗？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        uni.showLoading({ title: '处理中...' })
        await storeApi.completeOrder(item.orderNo)
        uni.showToast({ title: '订单已完成', icon: 'success' })
        switchTab(activeTab.value)
      } catch (err) {
        console.error('操作失败:', err)
      } finally {
        uni.hideLoading()
      }
    },
  })
}

onMounted(() => { loadOrders() })
</script>

<style scoped>
.order-fulfill-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.tab-bar {
  display: flex; background: #fff;
  padding: 0 16rpx 16rpx; gap: 8rpx;
}
.tab-item {
  flex: 1; height: 60rpx;
  display: flex; align-items: center; justify-content: center;
  background: #f5f7fa; border-radius: 30rpx;
  position: relative;
}
.tab-item--active { background: #1677FF; }
.tab-item--active .tab-text { color: #fff; }
.tab-text { font-size: 22rpx; color: #666; }
.tab-badge {
  position: absolute; top: -6rpx; right: 12rpx;
  min-width: 28rpx; height: 28rpx;
  background: #ff4d4f; border-radius: 14rpx;
  display: flex; align-items: center; justify-content: center;
  padding: 0 6rpx;
}
.tab-badge-text { font-size: 20rpx; color: #fff; }
.order-list { padding: 16rpx 24rpx; height: calc(100vh - 220rpx); }
.order-card {
  background: #fff; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; align-items: center; gap: 12rpx;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.channel-tag {
  padding: 4rpx 12rpx; border-radius: 8rpx;
}
.channel-meituan { background: #fff8e6; }
.channel-meituan .channel-text { color: #ffb000; }
.channel-eleme { background: #e6f7ff; }
.channel-eleme .channel-text { color: #00a0ff; }
.channel-douyin { background: #fff0f5; }
.channel-douyin .channel-text { color: #ff0050; }
.channel-jd { background: #fff2f0; }
.channel-jd .channel-text { color: #ff4d4f; }
.channel-default { background: #f5f7fa; }
.channel-default .channel-text { color: #666; }
.channel-text { font-size: 20rpx; }
.order-no { flex: 1; font-size: 26rpx; color: #333; font-weight: 600; }
.order-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending { background: #fff7e6; }
.status-pending .status-text { color: #fa8c16; }
.status-accepted { background: #e6f7ff; }
.status-accepted .status-text { color: #1677FF; }
.status-delivering { background: #f0f5ff; }
.status-delivering .status-text { color: #2f54eb; }
.status-completed { background: #f6ffed; }
.status-completed .status-text { color: #52c41a; }
.status-rejected, .status-cancelled { background: #fff2f0; }
.status-rejected .status-text, .status-cancelled .status-text { color: #ff4d4f; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; flex-shrink: 0; }
.info-value { font-size: 26rpx; color: #333; text-align: right; flex: 1; margin-left: 24rpx; }
.info-value--addr { font-size: 24rpx; color: #666; }
.info-value--price { color: #fa8c16; font-weight: 600; }
.info-value--warn { color: #ff4d4f; }
.goods-list {
  margin-top: 16rpx; padding: 16rpx;
  background: #fafafa; border-radius: 12rpx;
}
.goods-item {
  display: flex; align-items: center; gap: 16rpx;
  padding: 6rpx 0;
}
.goods-name { flex: 1; font-size: 24rpx; color: #333; }
.goods-qty { font-size: 22rpx; color: #999; }
.goods-price { font-size: 24rpx; color: #666; }
.card-footer {
  display: flex; gap: 16rpx;
  margin-top: 16rpx; padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
}
.action-btn {
  flex: 1; height: 64rpx;
  display: flex; align-items: center; justify-content: center;
  border-radius: 32rpx; font-size: 24rpx;
  background: #f5f7fa; color: #666;
}
.action-btn--primary { background: #1677FF; color: #fff; }
.action-btn--danger { background: #fff2f0; color: #ff4d4f; }
.load-tip { padding: 24rpx 0; text-align: center; }
.load-tip-text { font-size: 24rpx; color: #bbb; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }
</style>
