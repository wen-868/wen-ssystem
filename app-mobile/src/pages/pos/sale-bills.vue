<template>
  <view class="sale-bills-page">
    <view class="page-header">
      <text class="header-title">销售单据</text>
    </view>

    <!-- 搜索 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索单号 / 客户名称"
          placeholder-class="search-placeholder"
          confirm-type="search"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
      </view>
    </view>

    <!-- 收款状态筛选 -->
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

    <!-- 单据列表 -->
    <scroll-view
      class="bill-list"
      scroll-y
      v-if="list.length > 0"
      @scrolltolower="loadMore"
    >
      <view class="bill-card" v-for="item in list" :key="item.billNo" @tap="goDetail(item)">
        <view class="card-header">
          <text class="bill-no">{{ item.billNo }}</text>
          <view class="bill-status" :class="'status-' + (item.collectionStatus || item.status)">
            <text class="status-text">{{ getStatusLabel(item) }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">客户</text>
            <text class="info-value">{{ item.customerName || '散客' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">总金额</text>
            <text class="info-value info-value--price">¥{{ Number(item.totalAmount || 0).toFixed(2) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">已收</text>
            <text class="info-value">¥{{ Number(item.receivedAmount || 0).toFixed(2) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">创建时间</text>
            <text class="info-value">{{ item.createdAt || item.saleDate || '-' }}</text>
          </view>
        </view>
        <view class="card-footer" v-if="needCollect(item)">
          <view class="action-btn action-btn--primary" @tap.stop="onCollect(item)">收款</view>
          <view class="action-btn" @tap.stop="onShareLink(item)">收款链接</view>
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
      <text class="empty-text">暂无销售单</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { storeApi, type StoreSaleBill } from '@/api/modules/store'

const searchForm = reactive({ keyword: '' })
const tabs = [
  { label: '全部', value: '' },
  { label: '待收款', value: 'pending' },
  { label: '部分收款', value: 'partial' },
  { label: '已收款', value: 'paid' },
  { label: '已作废', value: 'voided' },
]
const activeTab = ref('')
const list = ref<StoreSaleBill[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

function onSearch() { resetAndLoad() }
function clearSearch() { searchForm.keyword = ''; resetAndLoad() }
function switchTab(val: string) { activeTab.value = val; resetAndLoad() }

function resetAndLoad() {
  page.value = 1
  noMore.value = false
  list.value = []
  loadBills()
}

function getStatusLabel(item: StoreSaleBill): string {
  const status = item.collectionStatus || item.status
  const map: Record<string, string> = {
    pending: '待收款',
    partial: '部分收款',
    paid: '已收款',
    voided: '已作废',
    unpaid: '待收款',
  }
  return map[status || ''] || status || '-'
}

function needCollect(item: StoreSaleBill): boolean {
  const status = item.collectionStatus || item.status
  return status === 'pending' || status === 'partial' || status === 'unpaid'
}

function goDetail(item: StoreSaleBill) {
  uni.navigateTo({ url: `/pages/pos/sale-bills?billNo=${item.billNo}` })
}

async function loadBills() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await storeApi.fetchSaleBills({
      page: page.value,
      pageSize,
      keyword: searchForm.keyword || undefined,
      collectionStatus: activeTab.value || undefined,
    })
    const rows = res?.list || res?.records || []
    if (page.value === 1) {
      list.value = rows
    } else {
      list.value.push(...rows)
    }
    noMore.value = rows.length < pageSize
  } catch (err) {
    console.error('加载销售单失败:', err)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (noMore.value || loading.value) return
  page.value += 1
  loadBills()
}

function onCollect(item: StoreSaleBill) {
  const remain = Number(item.totalAmount || 0) - Number(item.receivedAmount || 0)
  uni.showActionSheet({
    itemList: ['现金收款', '微信收款', '支付宝收款'],
    success: async (res) => {
      const methods = ['cash', 'wechat', 'alipay']
      const method = methods[res.tapIndex]
      try {
        uni.showLoading({ title: '处理中...' })
        await storeApi.offlinePayment(item.billNo, remain, method)
        uni.showToast({ title: '收款成功', icon: 'success' })
        resetAndLoad()
      } catch (err) {
        console.error('收款失败:', err)
      } finally {
        uni.hideLoading()
      }
    },
  })
}

async function onShareLink(item: StoreSaleBill) {
  const remain = Number(item.totalAmount || 0) - Number(item.receivedAmount || 0)
  if (remain <= 0) {
    uni.showToast({ title: '该单已收清', icon: 'none' })
    return
  }
  try {
    uni.showLoading({ title: '生成链接...' })
    const res = await storeApi.createCollectionLink(item.billNo, { amount: remain })
    if (res?.shareUrl) {
      uni.setClipboardData({
        data: res.shareUrl,
        success: () => uni.showToast({ title: '链接已复制', icon: 'success' }),
      })
    }
  } catch (err) {
    console.error('生成收款链接失败:', err)
  } finally {
    uni.hideLoading()
  }
}

onMounted(() => { loadBills() })
</script>

<style scoped>
.sale-bills-page { min-height: 100vh; background: #f0f5ff; }
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
.bill-list { padding: 16rpx 24rpx; height: calc(100vh - 280rpx); }
.bill-card {
  background: #fff; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.bill-no { font-size: 26rpx; color: #333; font-weight: 600; }
.bill-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending, .status-unpaid { background: #fff7e6; }
.status-pending .status-text, .status-unpaid .status-text { color: #fa8c16; }
.status-partial { background: #fff2e8; }
.status-partial .status-text { color: #ff7a45; }
.status-paid { background: #f6ffed; }
.status-paid .status-text { color: #52c41a; }
.status-voided { background: #fff2f0; }
.status-voided .status-text { color: #ff4d4f; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.info-value--price { color: #fa8c16; font-weight: 600; }
.card-footer {
  display: flex; gap: 16rpx;
  margin-top: 16rpx; padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
}
.action-btn {
  flex: 1; height: 60rpx;
  display: flex; align-items: center; justify-content: center;
  border-radius: 30rpx; font-size: 24rpx;
  background: #f5f7fa; color: #666;
}
.action-btn--primary { background: #fa8c16; color: #fff; }
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
