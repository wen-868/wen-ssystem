<template>
  <view class="marketing-page">
    <view class="page-header">
      <text class="header-title">营销中心</text>
    </view>

    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索活动名称"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
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
        <view class="entry-icon entry-icon--coupon"><image class="ic" src="/static/icons/ic/ticket.svg" mode="aspectFit"/></view>
        <text class="entry-text">优惠券</text>
      </view>
      <view class="entry-item" @tap="goCreate('flashsale')">
        <view class="entry-icon entry-icon--flash"><image class="ic" src="/static/icons/ic/zap.svg" mode="aspectFit"/></view>
        <text class="entry-text">限时秒杀</text>
      </view>
      <view class="entry-item" @tap="goCreate('fullreduction')">
        <view class="entry-icon entry-icon--full"><image class="ic" src="/static/icons/ic/gift.svg" mode="aspectFit"/></view>
        <text class="entry-text">满减活动</text>
      </view>
      <view class="entry-item" @tap="goCreate('discount')">
        <view class="entry-icon entry-icon--discount"><image class="ic" src="/static/icons/ic/percent.svg" mode="aspectFit"/></view>
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
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无营销活动</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { activityApi, type Activity } from '@/api/modules/marketing-activities'

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
    uni.navigateTo({ url: '/pages-sub/marketing/marketing/activities' })
  }
}

function viewDetail(item: any) {
  // 查看详情：跳转营销活动管理页查看该活动（参与记录仅社群营销有数据源）
  uni.navigateTo({ url: '/pages-sub/marketing/marketing/activities' })
}

function editActivity(item: any) {
  // 编辑活动：跳转营销活动管理页（满减/折扣活动编辑入口）
  uni.navigateTo({ url: '/pages-sub/marketing/marketing/activities' })
}

/** 活动状态 → 页面 tab 口径 */
function mapStatus(status?: string): string {
  const map: Record<string, string> = {
    draft: 'not_started',
    active: 'ongoing',
    ended: 'ended',
    paused: 'paused',
  }
  return map[status ?? ''] ?? status ?? ''
}

/** 页面 tab → 后端状态参数 */
function statusParam(tab: string): string | undefined {
  const map: Record<string, string> = {
    not_started: 'draft',
    ongoing: 'active',
    ended: 'ended',
  }
  return tab === '' ? undefined : (map[tab] ?? tab)
}

async function loadActivities() {
  loading.value = true
  try {
    const result = await activityApi.list({
      keyword: searchForm.keyword || undefined,
      status: statusParam(activeTab.value),
      page: 1,
      pageSize: 20,
    })
    list.value = (result.list || []).map((item: Activity) => ({
      id: item.id,
      name: item.name,
      type: item.type === 'full_reduction' ? 'fullreduction' : item.type,
      typeLabel: item.typeText || '满减活动',
      status: mapStatus(item.status),
      statusLabel: item.statusText || item.status,
      startTime: item.startTime || '—',
      endTime: item.endTime || '—',
      productCount: Number((item as any).productCount ?? 0),
      issuedCount: Number((item as any).issuedCount ?? 0),
      usedCount: Number((item as any).usedCount ?? 0),
    }))
  } catch (err) {
    console.error('加载营销活动失败:', err)
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadActivities() })
</script>

<style lang="scss" scoped>
.marketing-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
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
.quick-entry {
  display: flex; justify-content: space-around;
  padding: 24rpx; background: $uni-bg-color;
  margin-bottom: 16rpx;
}
.entry-item { display: flex; flex-direction: column; align-items: center; }
.entry-icon {
  width: 80rpx; height: 80rpx;
  border-radius: 20rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 36rpx; color: $uni-text-color-inverse;
  margin-bottom: 12rpx;
}
.entry-icon--coupon { background: linear-gradient(135deg, $uni-color-error, $uni-color-warning); }
.entry-icon--flash { background: linear-gradient(135deg, $uni-color-warning, $uni-color-warning); }
.entry-icon--full { background: linear-gradient(135deg, $uni-color-success, $uni-color-success); }
.entry-icon--discount { background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary); }
.entry-text { font-size: 22rpx; color: $uni-gray-700; }
.activity-list { padding: 0 24rpx 24rpx; }
.activity-card {
  background: $uni-bg-color; border-radius: 16rpx;
  padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 16rpx; padding-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}
.activity-title-wrap { display: flex; flex-direction: column; gap: 8rpx; flex: 1; }
.activity-title { font-size: 28rpx; color: $uni-gray-700; font-weight: 600; }
.activity-type-tag { display: inline-block; padding: 2rpx 12rpx; border-radius: 16rpx; align-self: flex-start; }
.tag-coupon { background: $uni-color-error-soft; }
.tag-coupon .tag-text { color: $uni-color-error; }
.tag-flashsale { background: $uni-color-warning-soft; }
.tag-flashsale .tag-text { color: $uni-color-warning; }
.tag-fullreduction { background: $uni-color-success-soft; }
.tag-fullreduction .tag-text { color: $uni-color-success; }
.tag-discount { background: $uni-color-primary-soft; }
.tag-discount .tag-text { color: $uni-color-primary; }
.tag-text { font-size: 20rpx; }
.activity-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-not_started { background: $uni-color-primary-soft; }
.status-not_started .status-text { color: $uni-color-primary; }
.status-ongoing { background: $uni-color-success-soft; }
.status-ongoing .status-text { color: $uni-color-success; }
.status-ended { background: $uni-bg-color-grey; }
.status-ended .status-text { color: $uni-gray-400; }
.status-text { font-size: 22rpx; }
.card-body { display: flex; flex-direction: column; gap: 10rpx; }
.info-row { display: flex; justify-content: space-between; }
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.info-value--highlight { color: $uni-color-error; font-weight: 600; }
.card-actions {
  margin-top: 16rpx; padding-top: 16rpx;
  border-top: 1rpx solid $uni-gray-100;
  display: flex; gap: 16rpx;
}
.action-btn {
  flex: 1; height: 64rpx; border-radius: 32rpx;
  font-size: 26rpx;
  display: flex; align-items: center; justify-content: center;
  border: none;
}
.detail-btn { background: $uni-bg-color-grey; color: $uni-gray-700; }
.edit-btn { background: $uni-color-primary; color: $uni-text-color-inverse; }
.action-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.safe-bottom { height: 40rpx; }
</style>
