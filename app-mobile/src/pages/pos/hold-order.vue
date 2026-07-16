<template>
  <view class="hold-order-page">
    <view class="page-header">
      <text class="header-title">挂单管理</text>
      <text class="header-count" v-if="list.length > 0">共 {{ total }} 单</text>
    </view>

    <!-- 挂单列表 -->
    <scroll-view
      class="hold-list"
      scroll-y
      v-if="list.length > 0"
      @scrolltolower="loadMore"
    >
      <view class="hold-card" v-for="item in list" :key="item.holdNo">
        <view class="card-header">
          <text class="hold-no">{{ item.holdNo }}</text>
          <text class="hold-amount">¥{{ Number(item.amount || 0).toFixed(2) }}</text>
        </view>
        <view class="card-body">
          <view class="info-row" v-if="item.customerName">
            <text class="info-label">客户</text>
            <text class="info-value">{{ item.customerName }}</text>
          </view>
          <view class="info-row" v-if="item.customerMobile">
            <text class="info-label">电话</text>
            <text class="info-value">{{ item.customerMobile }}</text>
          </view>
          <view class="info-row" v-if="item.remark">
            <text class="info-label">备注</text>
            <text class="info-value info-value--remark">{{ item.remark }}</text>
          </view>
          <view class="info-row" v-if="item.createdAt">
            <text class="info-label">挂单时间</text>
            <text class="info-value">{{ item.createdAt }}</text>
          </view>
        </view>

        <view class="goods-list" v-if="item.items && item.items.length > 0">
          <view class="goods-item" v-for="(g, idx) in item.items" :key="idx">
            <text class="goods-name">{{ g.skuName }}</text>
            <text class="goods-qty">x{{ g.quantity }}</text>
            <text class="goods-price">¥{{ Number(g.subtotalAmount || 0).toFixed(2) }}</text>
          </view>
        </view>

        <view class="card-footer">
          <view class="action-btn action-btn--danger" @tap="onDelete(item)">删除</view>
          <view class="action-btn action-btn--primary" @tap="onRestore(item)">恢复开单</view>
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
      <text class="empty-icon">&#xe613;</text>
      <text class="empty-text">暂无挂单</text>
      <text class="empty-hint">收银台挂起的订单会显示在此</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeApi, type HoldOrder } from '@/api/modules/store'

const list = ref<HoldOrder[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = 30
const noMore = ref(false)

async function loadHoldOrders() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await storeApi.fetchHoldOrders({ page: page.value, pageSize })
    const rows = res?.list || res?.records || []
    if (page.value === 1) {
      list.value = rows
    } else {
      list.value.push(...rows)
    }
    total.value = res?.total ?? list.value.length
    noMore.value = rows.length < pageSize
  } catch (err) {
    console.error('加载挂单失败:', err)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (noMore.value || loading.value) return
  page.value += 1
  loadHoldOrders()
}

function onRestore(item: HoldOrder) {
  uni.showModal({
    title: '恢复挂单',
    content: `确认恢复挂单 ${item.holdNo} 到收银台吗？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        uni.showLoading({ title: '处理中...' })
        await storeApi.restoreHoldOrder(item.holdNo)
        uni.showToast({ title: '已恢复', icon: 'success' })
        uni.navigateTo({ url: '/pages/pos/cashier' })
        page.value = 1
        loadHoldOrders()
      } catch (err) {
        console.error('恢复挂单失败:', err)
      } finally {
        uni.hideLoading()
      }
    },
  })
}

function onDelete(item: HoldOrder) {
  uni.showModal({
    title: '删除挂单',
    content: `确认删除挂单 ${item.holdNo} 吗？删除后无法恢复。`,
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (!res.confirm) return
      try {
        uni.showLoading({ title: '删除中...' })
        await storeApi.deleteHoldOrder(item.holdNo)
        uni.showToast({ title: '已删除', icon: 'success' })
        page.value = 1
        loadHoldOrders()
      } catch (err) {
        console.error('删除挂单失败:', err)
      } finally {
        uni.hideLoading()
      }
    },
  })
}

onMounted(() => { loadHoldOrders() })
</script>

<style scoped>
.hold-order-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.header-count { font-size: 24rpx; color: #999; }

.hold-list { padding: 16rpx 24rpx; height: calc(100vh - 140rpx); }
.hold-card {
  background: #fff; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.hold-no { font-size: 26rpx; color: #333; font-weight: 600; }
.hold-amount { font-size: 30rpx; color: #fa8c16; font-weight: 700; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; flex-shrink: 0; }
.info-value { font-size: 26rpx; color: #333; text-align: right; flex: 1; margin-left: 24rpx; }
.info-value--remark { font-size: 24rpx; color: #666; }
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
.action-btn--primary { background: #fa8c16; color: #fff; }
.action-btn--danger { background: #fff2f0; color: #ff4d4f; }
.load-tip { padding: 24rpx 0; text-align: center; }
.load-tip-text { font-size: 24rpx; color: #bbb; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; margin-bottom: 8rpx; }
.empty-hint { font-size: 22rpx; color: #ccc; }
.safe-bottom { height: 40rpx; }
</style>
