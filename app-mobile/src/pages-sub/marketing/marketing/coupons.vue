<template>
  <view class="coupons-page">
    <view class="page-header">
      <text class="header-title">优惠券</text>
    </view>

    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <text class="search-icon">&#xe614;</text>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索优惠券名称"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
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
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无优惠券</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
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

<style scoped>
.coupons-page { min-height: 100vh; background: #f0f5ff; }
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
.create-section { padding: 16rpx 24rpx; }
.create-btn {
  width: 100%; height: 80rpx;
  background: linear-gradient(135deg, #ff6b6b, #ff8e53);
  border-radius: 40rpx; font-size: 28rpx;
  font-weight: 600; color: #fff;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.create-btn::after { border: none; }
.coupon-list { padding: 0 24rpx 24rpx; }
.coupon-card {
  display: flex; background: #fff;
  border-radius: 16rpx; overflow: hidden;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.coupon-left {
  width: 200rpx;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 24rpx 16rpx;
  position: relative;
}
.coupon-left::after {
  content: '';
  position: absolute;
  right: -1rpx; top: 0; bottom: 0;
  width: 2rpx;
  background-image: radial-gradient(circle, #fff 3rpx, transparent 3rpx);
  background-size: 2rpx 12rpx;
}
.coupon-full { background: linear-gradient(135deg, #ff6b6b, #ff4d4f); }
.coupon-discount { background: linear-gradient(135deg, #ffa940, #fa8c16); }
.coupon-shipping { background: linear-gradient(135deg, #52c41a, #389e0d); }
.coupon-amount {
  display: flex; align-items: baseline;
  color: #fff; margin-bottom: 8rpx;
}
.amount-symbol { font-size: 24rpx; margin-right: 4rpx; }
.amount-value { font-size: 48rpx; font-weight: 700; }
.coupon-condition { font-size: 20rpx; color: rgba(255,255,255,0.85); }
.coupon-right {
  flex: 1; padding: 20rpx 24rpx;
  display: flex; flex-direction: column;
  justify-content: space-between;
}
.coupon-info { display: flex; flex-direction: column; gap: 4rpx; }
.coupon-name { font-size: 28rpx; color: #333; font-weight: 600; }
.coupon-type { font-size: 20rpx; color: #999; }
.coupon-meta { margin-top: 4rpx; }
.meta-text { font-size: 22rpx; color: #999; }
.coupon-stats {
  display: flex; gap: 24rpx;
  margin-top: 8rpx;
}
.stat-item { font-size: 22rpx; color: #666; }
.coupon-actions {
  display: flex; gap: 12rpx;
  margin-top: 12rpx;
}
.mini-btn {
  height: 48rpx; padding: 0 20rpx;
  border-radius: 24rpx; font-size: 22rpx;
  display: flex; align-items: center; justify-content: center;
  background: #f5f5f5; color: #666; border: none;
}
.mini-btn.primary { background: #1677FF; color: #fff; }
.mini-btn.danger { background: #fff2f0; color: #ff4d4f; }
.mini-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }
</style>
