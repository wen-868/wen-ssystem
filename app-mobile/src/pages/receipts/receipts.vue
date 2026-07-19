<template>
  <view class="receipts-page">
    <view class="page-header">
      <text class="header-title">财务往来</text>
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
            placeholder="搜索收款单号 / 客户名称"
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

    <!-- 收款单列表 -->
    <scroll-view class="receipt-list" scroll-y v-if="list.length > 0">
      <view class="receipt-card" v-for="item in list" :key="item.receiptNo">
        <view class="card-header">
          <text class="receipt-no">{{ item.receiptNo }}</text>
          <view class="receipt-type" :class="'type-' + item.type">
            <text class="type-text">{{ item.typeLabel }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">客户</text>
            <text class="info-value">{{ item.customerName }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">收款金额</text>
            <text class="info-value info-value--amount">¥{{ item.amount }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">收款方式</text>
            <text class="info-value">{{ item.paymentMethod }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">收款日期</text>
            <text class="info-value">{{ item.receiptDate }}</text>
          </view>
          <view class="info-row" v-if="item.relatedOrder">
            <text class="info-label">关联订单</text>
            <text class="info-value">{{ item.relatedOrder }}</text>
          </view>
          <view class="info-row" v-if="item.remark">
            <text class="info-label">备注</text>
            <text class="info-value">{{ item.remark }}</text>
          </view>
        </view>
        <view class="card-actions" v-if="item.status === 'active'">
          <button class="action-btn void-btn" @tap="voidReceipt(item)">作废</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无财务往来记录</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { receiptApi } from '@/api/modules/receipts'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const tabs = [
  { label: '全部', value: '' },
  { label: '线上收款', value: 'online' },
  { label: '线下收款', value: 'offline' },
  { label: '已作废', value: 'voided' },
]
const activeTab = ref('')
const list = ref<any[]>([])
const loading = ref(false)

function onSearch() { loadReceipts() }
function clearSearch() { searchForm.keyword = ''; loadReceipts() }
function switchTab(val: string) { activeTab.value = val; loadReceipts() }

async function voidReceipt(item: any) {
  uni.showModal({
    title: '作废收款单',
    content: '确认作废该收款单？此操作不可撤销。',
    success: async (res) => {
      if (res.confirm) {
        try {
          await receiptApi.cancel(item.receiptNo, '用户作废')
          uni.showToast({ title: '已作废', icon: 'success' })
          loadReceipts()
        } catch (err) {
          uni.showToast({ title: '作废失败', icon: 'error' })
        }
      }
    }
  })
}

async function loadReceipts() {
  loading.value = true
  try {
    const res = await receiptApi.getList({
      page: 1,
      pageSize: 50,
      keyword: searchForm.keyword || undefined,
      type: activeTab.value || undefined
    })
    list.value = res.list || []
  } catch (err) {
    console.error('加载收款单失败:', err)
    uni.showToast({ title: '加载失败', icon: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadReceipts() })
</script>

<style scoped>
.receipts-page {
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
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 30rpx;
}
.tab-item--active { background: #52c41a; }
.tab-item--active .tab-text { color: #fff; }
.tab-text { font-size: 24rpx; color: #666; }
.receipt-list { padding: 16rpx 24rpx; }
.receipt-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.receipt-no { font-size: 26rpx; color: #333; font-weight: 600; }
.receipt-type { padding: 4rpx 16rpx; border-radius: 20rpx; }
.type-online { background: #e6f7ff; }
.type-online .type-text { color: #1677FF; }
.type-offline { background: #f6ffed; }
.type-offline .type-text { color: #52c41a; }
.type-voided { background: #fff2f0; }
.type-voided .type-text { color: #ff4d4f; }
.type-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 12rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.info-value--amount { color: #52c41a; font-weight: 600; font-size: 30rpx; }
.card-actions {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
  display: flex;
}
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
.void-btn { background: #f5f5f5; color: #ff4d4f; }
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