<template>
  <view class="hold-page">
    <view class="page-header">
      <text class="header-title">挂单管理</text>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="searchKeyword"
          type="text"
          placeholder="搜索挂单号 / 会员名称"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="searchKeyword" @tap="clearSearch">&#xe615;</text>
      </view>
    </view>

    <!-- 挂单列表 -->
    <scroll-view class="hold-list" scroll-y :refresher-enabled="true" :refresher-triggered="refresherTriggered" @refresherrefresh="onRefresh">
      <view class="hold-card" v-for="item in filteredList" :key="item.id" @tap="showDetail(item)">
        <view class="card-header">
          <text class="hold-no">{{ item.holdNo }}</text>
          <text class="hold-time">{{ item.createdAt }}</text>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">会员</text>
            <text class="info-value">{{ item.memberName || '散客' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">商品数</text>
            <text class="info-value">{{ item.items.length }} 种</text>
          </view>
          <view class="info-row">
            <text class="info-label">操作员</text>
            <text class="info-value">{{ item.operatorName }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">总金额</text>
            <text class="info-value info-value--price">¥{{ formatAmount(item.totalAmount) }}</text>
          </view>
        </view>
        <view class="card-actions">
          <view class="action-btn action-btn--resume" @tap.stop="onResume(item)">
            <text class="action-text action-text--resume">恢复收银</text>
          </view>
          <view class="action-btn action-btn--delete" @tap.stop="onDelete(item)">
            <text class="action-text action-text--delete">删除</text>
          </view>
        </view>
      </view>

      <view class="empty-state" v-if="filteredList.length === 0">
        <text class="empty-icon">&#xe631;</text>
        <text class="empty-text">{{ loading ? '加载中...' : '暂无挂单记录' }}</text>
        <text class="empty-tip" v-if="!loading">在收银页面点击"挂单"可暂存订单</text>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>

    <!-- 详情弹窗 -->
    <view class="detail-mask" v-if="showDetailPanel && detailItem" @tap="showDetailPanel = false">
      <view class="detail-panel" @tap.stop>
        <view class="detail-header">
          <text class="detail-title">挂单详情</text>
          <text class="detail-close" @tap="showDetailPanel = false">&#xe615;</text>
        </view>
        <scroll-view class="detail-body" scroll-y>
          <view class="detail-info-section">
            <view class="detail-info-row">
              <text class="detail-label">挂单号</text>
              <text class="detail-value">{{ detailItem.holdNo }}</text>
            </view>
            <view class="detail-info-row">
              <text class="detail-label">挂单时间</text>
              <text class="detail-value">{{ detailItem.createdAt }}</text>
            </view>
            <view class="detail-info-row">
              <text class="detail-label">会员</text>
              <text class="detail-value">{{ detailItem.memberName || '散客' }}</text>
            </view>
            <view class="detail-info-row" v-if="detailItem.remark">
              <text class="detail-label">备注</text>
              <text class="detail-value">{{ detailItem.remark }}</text>
            </view>
          </view>
          <view class="detail-items-title">商品明细</view>
          <view class="detail-item" v-for="(item, idx) in detailItem.items" :key="idx">
            <view class="detail-item-info">
              <text class="detail-item-name">{{ item.productName }}</text>
              <text class="detail-item-price">¥{{ item.price.toFixed(2) }} × {{ item.quantity }}</text>
            </view>
            <text class="detail-item-subtotal">¥{{ item.subtotal.toFixed(2) }}</text>
          </view>
          <view class="detail-total">
            <text class="detail-total-label">合计</text>
            <text class="detail-total-value">¥{{ formatAmount(detailItem.totalAmount) }}</text>
          </view>
        </scroll-view>
        <view class="detail-actions">
          <button class="detail-resume-btn" @tap="onResume(detailItem)">恢复收银</button>
          <button class="detail-delete-btn" @tap="onDelete(detailItem)">删除挂单</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { holdOrderApi, type HoldOrder } from '@/api/modules/cashier'

const searchKeyword = ref('')
const list = ref<HoldOrder[]>([])
const loading = ref(false)
const refresherTriggered = ref(false)
const showDetailPanel = ref(false)
const detailItem = ref<HoldOrder | null>(null)

const filteredList = computed(() => {
  const kw = searchKeyword.value.trim()
  if (!kw) return list.value
  return list.value.filter((item) => {
    return item.holdNo.toLowerCase().includes(kw.toLowerCase()) ||
      (item.memberName || '').toLowerCase().includes(kw.toLowerCase())
  })
})

function formatAmount(amount: number): string {
  return (amount || 0).toFixed(2)
}

function onSearch() {
  // 搜索已通过 computed 实时过滤，此处仅做交互反馈
}

function clearSearch() {
  searchKeyword.value = ''
}

async function loadList() {
  loading.value = true
  try {
    list.value = await holdOrderApi.list({})
  } catch (err) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function showDetail(item: HoldOrder) {
  detailItem.value = item
  showDetailPanel.value = true
}

async function onResume(item: HoldOrder) {
  uni.showModal({
    title: '确认恢复挂单',
    content: `将恢复挂单 ${item.holdNo}，金额 ¥${formatAmount(item.totalAmount)}，前往收银台继续结算？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await holdOrderApi.resume(item.id)
        uni.showToast({ title: '恢复成功', icon: 'success' })
        setTimeout(() => {
          uni.navigateTo({ url: '/pages/cashier/checkout' })
        }, 1000)
      } catch (err) {
        uni.showToast({ title: '恢复失败', icon: 'none' })
      }
    }
  })
}

function onDelete(item: HoldOrder) {
  uni.showModal({
    title: '确认删除',
    content: `删除挂单 ${item.holdNo} 后不可恢复，确认删除？`,
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await holdOrderApi.remove(item.id)
        uni.showToast({ title: '删除成功', icon: 'success' })
        showDetailPanel.value = false
        loadList()
      } catch (err) {
        uni.showToast({ title: '删除失败', icon: 'none' })
      }
    }
  })
}

async function onRefresh() {
  refresherTriggered.value = true
  try {
    await loadList()
  } finally {
    refresherTriggered.value = false
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.hold-page {
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

.search-icon {
  font-size: 32rpx;
  color: #999;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.search-placeholder {
  color: #bbb;
  font-size: 26rpx;
}

.search-clear {
  font-size: 32rpx;
  color: #bbb;
  padding: 4rpx;
}

.hold-list {
  flex: 1;
  padding: 16rpx 24rpx;
}

.hold-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.hold-no {
  font-size: 26rpx;
  color: #333;
  font-weight: 600;
}

.hold-time {
  font-size: 24rpx;
  color: #999;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-bottom: 20rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 24rpx;
  color: #999;
}

.info-value {
  font-size: 26rpx;
  color: #333;
}

.info-value--price {
  color: #fa8c16;
  font-weight: 600;
}

.card-actions {
  display: flex;
  gap: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
}

.action-btn {
  flex: 1;
  height: 64rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn--resume {
  background: #e6f4ff;
}

.action-text--resume {
  font-size: 26rpx;
  color: #1677FF;
  font-weight: 600;
}

.action-btn--delete {
  background: #fff2f0;
}

.action-text--delete {
  font-size: 26rpx;
  color: #ff4d4f;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: #ddd;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #bbb;
  margin-bottom: 12rpx;
}

.empty-tip {
  font-size: 24rpx;
  color: #ccc;
}

.safe-bottom {
  height: 40rpx;
}

/* 详情弹窗 */
.detail-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.detail-panel {
  width: 100%;
  max-height: 80vh;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx 24rpx 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.detail-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #333;
}

.detail-close {
  font-size: 32rpx;
  color: #999;
  padding: 4rpx;
}

.detail-body {
  max-height: 60vh;
  padding: 24rpx;
}

.detail-info-section {
  background: #f9fbff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 24rpx;
}

.detail-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0;
}

.detail-label {
  font-size: 26rpx;
  color: #999;
}

.detail-value {
  font-size: 26rpx;
  color: #333;
}

.detail-items-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.detail-item-name {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 4rpx;
}

.detail-item-price {
  font-size: 24rpx;
  color: #999;
}

.detail-item-subtotal {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}

.detail-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-top: 2rpx solid #f0f0f0;
  margin-top: 16rpx;
}

.detail-total-label {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}

.detail-total-value {
  font-size: 40rpx;
  color: #ff4d4f;
  font-weight: 700;
}

.detail-actions {
  display: flex;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  border-top: 1rpx solid #f0f0f0;
}

.detail-resume-btn {
  flex: 1;
  height: 80rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
  border: none;
}

.detail-resume-btn::after {
  border: none;
}

.detail-delete-btn {
  flex: 1;
  height: 80rpx;
  background: #fff2f0;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #ff4d4f;
  border: none;
}

.detail-delete-btn::after {
  border: none;
}
</style>
