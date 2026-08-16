<template>
  <view class="expenses-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/chevron-left.svg" mode="aspectFit"/>
        <input class="search-input" placeholder="搜索费用单号/备注" v-model="keyword" @confirm="onSearch" />
      </view>
      <view class="search-btn" @tap="onSearch">搜索</view>
    </view>

    <!-- 筛选栏 -->
    <view class="filter-bar">
      <view class="filter-item" :class="{ active: statusFilter === '' }" @tap="statusFilter = ''">
        <text class="filter-text">全部</text>
      </view>
      <view class="filter-item" :class="{ active: statusFilter === 'PENDING' }" @tap="statusFilter = 'PENDING'">
        <text class="filter-text">待审核</text>
      </view>
      <view class="filter-item" :class="{ active: statusFilter === 'APPROVED' }" @tap="statusFilter = 'APPROVED'">
        <text class="filter-text">已通过</text>
      </view>
      <view class="filter-item" :class="{ active: statusFilter === 'REJECTED' }" @tap="statusFilter = 'REJECTED'">
        <text class="filter-text">已驳回</text>
      </view>
    </view>

    <!-- 费用列表 -->
    <scroll-view class="expense-list" scroll-y>
      <view class="expense-card" v-for="item in expenseList" :key="item.id" @tap="goDetail(item.id)">
        <view class="card-header">
          <text class="expense-no">{{ item.expenseNo }}</text>
          <view class="status-tag" :class="`status-tag--${item.status.toLowerCase()}`">
            <text class="status-text">{{ item.statusName }}</text>
          </view>
        </view>

        <view class="card-body">
          <view class="expense-info">
            <text class="expense-type">{{ item.typeName }}</text>
            <text class="expense-date">{{ formatDate(item.date) }}</text>
          </view>
          <text class="expense-amount">¥{{ formatAmount(item.amount) }}</text>
        </view>

        <view class="card-footer">
          <text class="submitter">{{ item.submitterName }}</text>
          <text class="remark" v-if="item.remark">{{ item.remark }}</text>
        </view>

        <view class="card-actions" v-if="item.status === 'PENDING'">
          <view class="action-btn action-btn--reject" @tap.stop="rejectExpense(item)">
            <text class="action-text">驳回</text>
          </view>
          <view class="action-btn action-btn--approve" @tap.stop="approveExpense(item)">
            <text class="action-text">通过</text>
          </view>
        </view>
      </view>

      <view class="empty-state" v-if="expenseList.length === 0">
        <text class="empty-text">暂无费用记录</text>
      </view>

      <!-- 分页加载 -->
      <view class="load-more" v-if="total > expenseList.length">
        <text class="load-more-text" v-if="loading">加载中...</text>
        <text class="load-more-text" v-else @tap="loadMore">点击加载更多</text>
      </view>
    </scroll-view>

    <!-- 新增按钮 -->
    <view class="fab-btn" @tap="goCreate">
      <image class="fab-icon ic" src="/static/icons/ic/plus.svg" mode="aspectFit"/>
    </view>

    <!-- 驳回弹窗 -->
    <view class="modal-overlay" v-if="showRejectModal" @tap="showRejectModal = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">驳回原因</text>
        <textarea class="modal-textarea" placeholder="请输入驳回原因" v-model="rejectReason"></textarea>
        <view class="modal-actions">
          <view class="modal-btn modal-btn--cancel" @tap="showRejectModal = false">取消</view>
          <view class="modal-btn modal-btn--confirm" @tap="confirmReject">确定</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { expenseApi, type Expense } from '@/api/modules/expenses'

const expenseList = ref<Expense[]>([])
const keyword = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)

const showRejectModal = ref(false)
const rejectReason = ref('')
const currentRejectId = ref<number | null>(null)

function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

function formatDate(date: string): string {
  return date.split('T')[0]
}

async function loadExpenses() {
  loading.value = true
  try {
    const res = await expenseApi.list({
      page: page.value,
      pageSize: pageSize.value,
      status: statusFilter.value || undefined,
      keyword: keyword.value || undefined
    })
    if (page.value === 1) {
      expenseList.value = res.list
      total.value = res.total
    } else {
      expenseList.value = [...expenseList.value, ...res.list]
    }
  } catch (err) {
    console.error('加载费用列表失败:', err)
    if (page.value === 1) {
      expenseList.value = []
      total.value = 0
    }
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  loadExpenses()
}

function loadMore() {
  if (loading.value) return
  page.value++
  loadExpenses()
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages-sub/finance/finance/expense-detail?id=${id}` })
}

function goCreate() {
  uni.navigateTo({ url: '/pages-sub/finance/finance/expense-create' })
}

function approveExpense(item: Expense) {
  uni.showModal({
    title: '确认通过',
    content: `确定要通过费用单 ${item.expenseNo} 吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await expenseApi.approve(item.id)
          uni.showToast({ title: '审核通过', icon: 'success' })
          loadExpenses()
        } catch (err) {
          uni.showToast({ title: '操作失败', icon: 'error' })
        }
      }
    }
  })
}

function rejectExpense(item: Expense) {
  currentRejectId.value = item.id
  rejectReason.value = ''
  showRejectModal.value = true
}

async function confirmReject() {
  if (!rejectReason.value.trim()) {
    uni.showToast({ title: '请输入驳回原因', icon: 'none' })
    return
  }
  if (!currentRejectId.value) return

  try {
    await expenseApi.reject(currentRejectId.value, rejectReason.value)
    uni.showToast({ title: '已驳回', icon: 'success' })
    showRejectModal.value = false
    loadExpenses()
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'error' })
  }
}

onMounted(() => {
  loadExpenses()
})
</script>

<style lang="scss" scoped>
.expenses-page {
  min-height: 100vh;
  background: $uni-bg-color-grey;
  padding-bottom: env(safe-area-inset-bottom);
}

/* --- 搜索栏 --- */
.search-bar {
  display: flex;
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: $uni-bg-color-grey;
  border-radius: 32rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 28rpx;
  color: $uni-gray-400;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  height: 64rpx;
  font-size: 28rpx;
}

.search-btn {
  margin-left: 16rpx;
  padding: 0 32rpx;
  height: 64rpx;
  background: $uni-color-primary;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn text {
  font-size: 28rpx;
  color: $uni-text-color-inverse;
}

/* --- 筛选栏 --- */
.filter-bar {
  display: flex;
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
  border-top: 1rpx solid $uni-gray-100;
}

.filter-item {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  border-radius: 8rpx;
}

.filter-item.active {
  background: $uni-color-primary-soft;
}

.filter-text {
  font-size: 26rpx;
}

.filter-item .filter-text { color: $uni-gray-500; }
.filter-item.active .filter-text { color: $uni-color-primary; }

/* --- 费用列表 --- */
.expense-list {
  height: calc(100vh - 240rpx - env(safe-area-inset-bottom));
}

.expense-card {
  margin: 20rpx 24rpx;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.expense-no {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.status-tag {
  padding: 6rpx 16rpx;
  border-radius: 12rpx;
}

.status-tag--pending { background: $uni-color-warning-soft; }
.status-tag--approved { background: $uni-color-success-soft; }
.status-tag--rejected { background: $uni-color-error-soft; }

.status-tag--pending .status-text { color: $uni-color-warning; }
.status-tag--approved .status-text { color: $uni-color-success; }
.status-tag--rejected .status-text { color: $uni-color-error; }

.status-text {
  font-size: 22rpx;
}

.card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.expense-info {
  display: flex;
  align-items: center;
}

.expense-type {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.expense-date {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin-left: 16rpx;
}

.expense-amount {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-color-error;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16rpx;
  border-top: 1rpx solid $uni-bg-color-grey;
}

.submitter {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.remark {
  font-size: 24rpx;
  color: $uni-gray-500;
}

.card-actions {
  display: flex;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid $uni-bg-color-grey;
}

.action-btn {
  flex: 1;
  height: 72rpx;
  border-radius: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn--reject {
  background: $uni-color-error-soft;
  margin-right: 16rpx;
}

.action-btn--reject .action-text { color: $uni-color-error; }

.action-btn--approve {
  background: $uni-color-success-soft;
}

.action-btn--approve .action-text { color: $uni-color-success; }

.action-text {
  font-size: 28rpx;
  font-weight: 600;
}

.empty-state {
  padding: 100rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.load-more {
  padding: 30rpx 0;
  text-align: center;
}

.load-more-text {
  font-size: 26rpx;
  color: $uni-gray-400;
}

/* --- 新增按钮 --- */
.fab-btn {
  position: fixed;
  right: 40rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  width: 100rpx;
  height: 100rpx;
  background: $uni-color-primary;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 30rpx rgba(24, 144, 255, 0.4);
}

.fab-icon {
  font-size: 48rpx;
  color: $uni-text-color-inverse;
}

/* --- 驳回弹窗 --- */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  width: 600rpx;
  background: $uni-bg-color;
  border-radius: 20rpx;
  padding: 40rpx;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
  text-align: center;
  margin-bottom: 30rpx;
}

.modal-textarea {
  width: 100%;
  height: 200rpx;
  background: $uni-bg-color-grey;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
}

.modal-actions {
  display: flex;
  margin-top: 40rpx;
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-btn--cancel {
  background: $uni-bg-color-grey;
  margin-right: 20rpx;
}

.modal-btn--cancel text { color: $uni-gray-500; }

.modal-btn--confirm {
  background: $uni-color-error;
}

.modal-btn--confirm text { color: $uni-text-color-inverse; }

.modal-btn text {
  font-size: 30rpx;
}
</style>
