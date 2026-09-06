<template>
  <view class="coupons-page">
    <page-header title="优惠券" @back="goBack" />

    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索优惠券名称"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
        </view>
      </view>
    </form>

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

    <view class="create-section">
      <button class="create-btn" @tap="goCreate">
        <text>+ 新建优惠券</text>
      </button>
      <button class="verify-entry-btn" @tap="goVerify">
        <text>核销优惠券</text>
      </button>
    </view>

    <scroll-view class="coupon-list" scroll-y v-if="list.length > 0">
      <view class="coupon-card" v-for="item in list" :key="item.id">
        <view class="coupon-left" :class="'coupon-' + item.type">
          <text class="coupon-amount">
            <text class="amount-symbol">¥</text>
            <text class="amount-value">{{ item.amount }}</text>
          </text>
          <text class="coupon-condition">满{{ item.minAmount }}可用</text>
        </view>
        <view class="coupon-right">
          <view class="coupon-info">
            <text class="coupon-name">{{ item.name }}</text>
            <text class="coupon-type">{{ item.typeLabel }}</text>
          </view>
          <view class="coupon-meta">
            <text class="meta-text">{{ item.validityPeriod }}</text>
          </view>
          <view class="coupon-stats">
            <text class="stat-item">已领 {{ item.receivedCount }}/{{ item.totalCount }}</text>
            <text class="stat-item">已用 {{ item.usedCount }}</text>
          </view>
          <view class="coupon-actions">
            <button class="mini-btn" @tap="viewDetail(item)">详情</button>
            <button class="mini-btn primary" v-if="item.status === 'not_started'" @tap="editCoupon(item)">编辑</button>
            <button class="mini-btn danger" v-if="item.status === 'ongoing'" @tap="stopCoupon(item)">停用</button>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无优惠券</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { couponsApi, type CouponTemplate } from '@/api/modules/coupons'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const tabs = [
  { label: '全部', value: '' },
  { label: '未开始', value: 'not_started' },
  { label: '进行中', value: 'ongoing' },
  { label: '已结束', value: 'ended' },
]
const activeTab = ref('')
const list = ref<CouponTemplate[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)
const loadingMore = ref(false)

function onSearch() {
  page.value = 1
  noMore.value = false
  list.value = []
  loadCoupons()
}
function clearSearch() {
  searchForm.keyword = ''
  onSearch()
}
function switchTab(val: string) {
  activeTab.value = val
  page.value = 1
  noMore.value = false
  list.value = []
  loadCoupons()
}
function goCreate() {
  uni.navigateTo({ url: '/pages-sub/marketing/marketing/create-coupon' })
}

function goVerify() {
  uni.navigateTo({ url: '/pages-sub/marketing/marketing/coupon-verify' })
}
function viewDetail(item: CouponTemplate) {
  uni.showToast({ title: '查看详情', icon: 'none' })
}
function editCoupon(item: CouponTemplate) {
  uni.showToast({ title: '编辑优惠券', icon: 'none' })
}
function stopCoupon(item: CouponTemplate) {
  uni.showModal({
    title: '停用优惠券',
    content: '确认停用该优惠券？停用后无法领取但已领取的仍可使用。',
    success: async (res) => {
      if (res.confirm) {
        try {
          await couponsApi.pause(item.id)
          uni.showToast({ title: '已停用', icon: 'success' })
          loadCoupons()
        } catch (err) {
          console.error('停用优惠券失败:', err)
        }
      }
    }
  })
}

async function loadCoupons() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await couponsApi.list({
      keyword: searchForm.keyword || undefined,
      status: activeTab.value || undefined,
      page: page.value,
      pageSize,
    })
    const dataList = result.list || []
    if (page.value === 1) {
      list.value = dataList
    } else {
      list.value = [...list.value, ...dataList]
    }
    noMore.value = dataList.length < pageSize
  } catch (err) {
    console.error('加载优惠券失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function onLoadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  page.value++
  await loadCoupons()
}

onMounted(() => { loadCoupons() })
</script>

<style lang="scss" scoped>
.coupons-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + var(--safe-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.search-bar { padding: 16rpx 24rpx; background: $uni-bg-color; }
.search-input-wrap {
  display: flex; align-items: center;
  height: 72rpx; background: $uni-bg-color-page;
  border-radius: 36rpx; padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.search-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: $uni-gray-300; padding: 4rpx; }
.tab-bar {
  display: flex; background: $uni-bg-color;
  padding: 0 16rpx 16rpx; gap: 8rpx;
}
.tab-item {
  flex: 1; height: 60rpx;
  display: flex; align-items: center; justify-content: center;
  background: $uni-bg-color-page; border-radius: 30rpx;
}
.tab-item--active { background: $uni-color-primary; }
.tab-item--active .tab-text { color: $uni-text-color-inverse; }
.tab-text { font-size: 22rpx; color: $uni-gray-500; }
.create-section {
  padding: $uni-spacing-sm $uni-spacing-lg;
  display: flex;
  gap: $uni-spacing-sm;
}
.create-btn {
  flex: 1; height: 80rpx;
  background: linear-gradient(135deg, $uni-color-error, $uni-color-warning);
  border-radius: 40rpx; font-size: 28rpx;
  font-weight: 600; color: $uni-text-color-inverse;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.create-btn::after { border: none; }
.verify-entry-btn {
  flex: 1; height: 80rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 40rpx; font-size: 28rpx;
  font-weight: 600; color: $uni-text-color-inverse;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.verify-entry-btn::after { border: none; }
.coupon-list { padding: 0 $uni-spacing-lg $uni-spacing-base; }
.coupon-card {
  display: flex; background: $uni-bg-color;
  border-radius: $uni-border-radius-xs; overflow: hidden;
  margin-bottom: $uni-spacing-md;
  box-shadow: $uni-shadow-card-sm;
}
.coupon-left {
  width: 200rpx;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: $uni-spacing-base $uni-spacing-sm;
  position: relative;
}
.coupon-left::after {
  content: '';
  position: absolute;
  right: -1rpx; top: 0; bottom: 0;
  width: 2rpx;
  background-image: radial-gradient(circle, $uni-bg-color 3rpx, transparent 3rpx);
  background-size: 2rpx 12rpx;
}
.coupon-full { background: linear-gradient(135deg, $uni-color-error, $uni-color-error); }
.coupon-discount { background: linear-gradient(135deg, $uni-color-warning, $uni-color-warning); }
.coupon-shipping { background: linear-gradient(135deg, $uni-color-success, $uni-color-success); }
.coupon-amount {
  display: flex; align-items: baseline;
  color: $uni-text-color-inverse; margin-bottom: $uni-spacing-xs;
}
.amount-symbol { font-size: 24rpx; margin-right: 4rpx; }
.amount-value { font-size: 48rpx; font-weight: 700; }
.coupon-condition { font-size: 20rpx; color: $zx-white-850; }
.coupon-right {
  flex: 1; padding: $uni-spacing-md $uni-spacing-base;
  display: flex; flex-direction: column;
  justify-content: space-between;
}
.coupon-info { display: flex; flex-direction: column; gap: 4rpx; }
.coupon-name { font-size: 28rpx; color: $uni-gray-700; font-weight: 600; }
.coupon-type { font-size: 20rpx; color: $uni-gray-400; }
.coupon-meta { margin-top: 4rpx; }
.meta-text { font-size: 22rpx; color: $uni-gray-400; }
.coupon-stats {
  display: flex; gap: $uni-spacing-base;
  margin-top: $uni-spacing-xs;
}
.stat-item { font-size: 22rpx; color: $uni-gray-500; }
.coupon-actions {
  display: flex; gap: $uni-spacing-sm;
  margin-top: $uni-spacing-sm;
}
.mini-btn {
  height: 48rpx; padding: 0 20rpx;
  border-radius: 24rpx; font-size: 22rpx;
  display: flex; align-items: center; justify-content: center;
  background: $uni-bg-color-grey; color: $uni-gray-500; border: none;
}
.mini-btn.primary { background: $uni-color-primary; color: $uni-text-color-inverse; }
.mini-btn.danger { background: $uni-color-error-soft; color: $uni-color-error; }
.mini-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: $uni-spacing-md; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.safe-bottom { height: 40rpx; }
</style>
