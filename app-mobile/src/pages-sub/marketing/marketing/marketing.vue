<template>
  <view class="marketing-page">
    <view class="page-header">
      <text class="header-title">营销中心</text>
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
            placeholder="搜索活动名称"
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

    <!-- 活动类型快捷入口 -->
    <view class="quick-entry">
      <view class="entry-item" @tap="goCreate('coupon')">
        <view class="entry-icon entry-icon--coupon">&#xe623;</view>
        <text class="entry-text">优惠券</text>
      </view>
      <view class="entry-item" @tap="goCreate('flashsale')">
        <view class="entry-icon entry-icon--flash">&#xe624;</view>
        <text class="entry-text">限时秒杀</text>
      </view>
      <view class="entry-item" @tap="goCreate('fullreduction')">
        <view class="entry-icon entry-icon--full">&#xe625;</view>
        <text class="entry-text">满减活动</text>
      </view>
      <view class="entry-item" @tap="goCreate('discount')">
        <view class="entry-icon entry-icon--discount">&#xe626;</view>
        <text class="entry-text">折扣活动</text>
      </view>
    </view>

    <!-- 活动列表 -->
    <scroll-view class="activity-list" scroll-y v-if="list.length > 0">
      <view class="activity-card" v-for="item in list" :key="item.id">
        <view class="card-header">
          <view class="activity-title-wrap">
            <text class="activity-title">{{ item.name }}</text>
            <view class="activity-type-tag" :class="'tag-' + item.type">
              <text class="tag-text">{{ item.typeLabel }}</text>
            </view>
          </view>
          <view class="activity-status" :class="'status-' + item.status">
            <text class="status-text">{{ item.statusLabel }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">活动时间</text>
            <text class="info-value">{{ item.startTime }} ~ {{ item.endTime }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">参与商品</text>
            <text class="info-value">{{ item.productCount }} 件</text>
          </view>
          <view class="info-row">
            <text class="info-label">已发券数</text>
            <text class="info-value">{{ item.issuedCount }} 张</text>
          </view>
          <view class="info-row">
            <text class="info-label">核销数量</text>
            <text class="info-value info-value--highlight">{{ item.usedCount }} 张</text>
          </view>
        </view>
        <view class="card-actions">
          <button class="action-btn detail-btn" @tap="viewDetail(item)">查看详情</button>
          <button class="action-btn edit-btn" @tap="editActivity(item)" v-if="item.status === 'not_started'">编辑</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无营销活动</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

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
const list = ref<any[]>([])
const loading = ref(false)

function onSearch() { loadActivities() }
function clearSearch() { searchForm.keyword = ''; loadActivities() }
function switchTab(val: string) { activeTab.value = val; loadActivities() }

function goCreate(type: string) {
  if (type === 'coupon') {
    uni.navigateTo({ url: '/pages-sub/marketing/marketing/coupons' })
  } else if (type === 'flashsale') {
    // 秒杀活动列表页（社群营销模块）
    uni.navigateTo({ url: '/pages-sub/marketing/marketing/seckill-list' })
  } else if (type === 'fullreduction' || type === 'discount') {
    // 满减/折扣活动统一走营销活动管理页
    uni.navigateTo({ url: '/pages-sub/marketing/marketing/activities' })
  } else {
    uni.showToast({ title: '该功能开发中', icon: 'none' })
  }
}

function viewDetail(item: any) {
  uni.showToast({ title: '查看详情', icon: 'none' })
}

function editActivity(item: any) {
  uni.showToast({ title: '编辑活动', icon: 'none' })
}

async function loadActivities() {
  loading.value = true
  try {
    list.value = []
  } catch (err) {
    console.error('加载营销活动失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadActivities() })
</script>

<style scoped>
.marketing-page { min-height: 100vh; background: #f0f5ff; }
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
.quick-entry {
  display: flex; justify-content: space-around;
  padding: 24rpx; background: #fff;
  margin-bottom: 16rpx;
}
.entry-item { display: flex; flex-direction: column; align-items: center; }
.entry-icon {
  width: 80rpx; height: 80rpx;
  border-radius: 20rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 36rpx; color: #fff;
  margin-bottom: 12rpx;
}
.entry-icon--coupon { background: linear-gradient(135deg, #ff6b6b, #ff8e53); }
.entry-icon--flash { background: linear-gradient(135deg, #ffa940, #ff7a45); }
.entry-icon--full { background: linear-gradient(135deg, #52c41a, #73d13d); }
.entry-icon--discount { background: linear-gradient(135deg, #1677FF, #4096ff); }
.entry-text { font-size: 22rpx; color: #333; }
.activity-list { padding: 0 24rpx 24rpx; }
.activity-card {
  background: #fff; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.activity-title-wrap { display: flex; flex-direction: column; gap: 8rpx; flex: 1; }
.activity-title { font-size: 28rpx; color: #333; font-weight: 600; }
.activity-type-tag { display: inline-block; padding: 2rpx 12rpx; border-radius: 16rpx; align-self: flex-start; }
.tag-coupon { background: #fff1f0; }
.tag-coupon .tag-text { color: #ff4d4f; }
.tag-flashsale { background: #fff7e6; }
.tag-flashsale .tag-text { color: #fa8c16; }
.tag-fullreduction { background: #f6ffed; }
.tag-fullreduction .tag-text { color: #52c41a; }
.tag-discount { background: #e6f7ff; }
.tag-discount .tag-text { color: #1677FF; }
.tag-text { font-size: 20rpx; }
.activity-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-not_started { background: #e6f7ff; }
.status-not_started .status-text { color: #1677FF; }
.status-ongoing { background: #f6ffed; }
.status-ongoing .status-text { color: #52c41a; }
.status-ended { background: #f5f5f5; }
.status-ended .status-text { color: #999; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.info-value--highlight { color: #ff4d4f; font-weight: 600; }
.card-actions {
  margin-top: 16rpx; padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
  display: flex; gap: 16rpx;
}
.action-btn {
  flex: 1; height: 64rpx; border-radius: 32rpx;
  font-size: 26rpx;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.detail-btn { background: #f5f5f5; color: #333; }
.edit-btn { background: #1677FF; color: #fff; }
.action-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }
</style>
