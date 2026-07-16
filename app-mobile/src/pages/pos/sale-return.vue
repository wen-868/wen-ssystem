<template>
  <view class="sale-return-page">
    <view class="page-header">
      <text class="header-title">销售退货</text>
    </view>

    <!-- 搜索 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">&#xe614;</text>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索退货单号 / 原单号"
          placeholder-class="search-placeholder"
          confirm-type="search"
          @confirm="onSearch"
        />
        <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
      </view>
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
      </view>
    </view>

    <!-- 退货列表 -->
    <scroll-view
      class="return-list"
      scroll-y
      v-if="list.length > 0"
      @scrolltolower="loadMore"
    >
      <view class="return-card" v-for="item in list" :key="item.returnNo">
        <view class="card-header">
          <text class="return-no">{{ item.returnNo }}</text>
          <view class="return-status" :class="'status-' + item.status">
            <text class="status-text">{{ getStatusLabel(item.status) }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">原单号</text>
            <text class="info-value">{{ item.sourceBillNo }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">退货金额</text>
            <text class="info-value info-value--price">¥{{ Number(item.totalAmount || 0).toFixed(2) }}</text>
          </view>
          <view class="info-row" v-if="item.remark">
            <text class="info-label">备注</text>
            <text class="info-value info-value--remark">{{ item.remark }}</text>
          </view>
          <view class="info-row" v-if="item.createdAt">
            <text class="info-label">创建时间</text>
            <text class="info-value">{{ item.createdAt }}</text>
          </view>
        </view>
        <view class="card-footer" v-if="item.status === 'pending'">
          <view class="action-btn action-btn--danger" @tap="onReject(item)">拒绝</view>
          <view class="action-btn action-btn--primary" @tap="onApprove(item)">通过</view>
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
      <text class="empty-text">暂无退货单</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { storeApi, type SaleReturn } from '@/api/modules/store'

const searchForm = reactive({ keyword: '' })
const tabs = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
]
const activeTab = ref('')
const list = ref<SaleReturn[]>([])
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
  loadReturns()
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
    completed: '已完成',
  }
  return map[status] || status
}

async function loadReturns() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await storeApi.fetchSaleReturns({
      page: page.value,
      pageSize,
      returnStatus: activeTab.value || undefined,
    })
    const rows = res?.list || res?.records || []
    if (page.value === 1) {
      list.value = rows
    } else {
      list.value.push(...rows)
    }
    noMore.value = rows.length < pageSize
  } catch (err) {
    console.error('加载退货单失败:', err)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (noMore.value || loading.value) return
  page.value += 1
  loadReturns()
}

function onApprove(item: SaleReturn) {
  uni.showModal({
    title: '审核通过',
    content: `退货单 ${item.returnNo}，确认审核通过吗？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        uni.showLoading({ title: '处理中...' })
        await storeApi.approveSaleReturn(item.returnNo)
        uni.showToast({ title: '审核通过', icon: 'success' })
        resetAndLoad()
      } catch (err) {
        console.error('审核失败:', err)
      } finally {
        uni.hideLoading()
      }
    },
  })
}

function onReject(item: SaleReturn) {
  uni.showModal({
    title: '拒绝退货',
    editable: true,
    placeholderText: '请输入拒绝原因',
    confirmColor: '#ff4d4f',
    success: async (res) => {
      if (!res.confirm) return
      const reason = res.content || ''
      if (!reason.trim()) {
        uni.showToast({ title: '请输入拒绝原因', icon: 'none' })
        return
      }
      try {
        uni.showLoading({ title: '处理中...' })
        await storeApi.rejectSaleReturn(item.returnNo, reason.trim())
        uni.showToast({ title: '已拒绝', icon: 'success' })
        resetAndLoad()
      } catch (err) {
        console.error('拒绝失败:', err)
      } finally {
        uni.hideLoading()
      }
    },
  })
}

onMounted(() => { loadReturns() })
</script>

<style scoped>
.sale-return-page { min-height: 100vh; background: #f0f5ff; }
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
.return-list { padding: 16rpx 24rpx; height: calc(100vh - 280rpx); }
.return-card {
  background: #fff; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.return-no { font-size: 26rpx; color: #333; font-weight: 600; }
.return-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending { background: #fff7e6; }
.status-pending .status-text { color: #fa8c16; }
.status-approved, .status-completed { background: #f6ffed; }
.status-approved .status-text, .status-completed .status-text { color: #52c41a; }
.status-rejected { background: #fff2f0; }
.status-rejected .status-text { color: #ff4d4f; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; flex-shrink: 0; }
.info-value { font-size: 26rpx; color: #333; text-align: right; flex: 1; margin-left: 24rpx; }
.info-value--price { color: #ff4d4f; font-weight: 600; }
.info-value--remark { font-size: 24rpx; color: #666; }
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
.action-btn--primary { background: #52c41a; color: #fff; }
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
