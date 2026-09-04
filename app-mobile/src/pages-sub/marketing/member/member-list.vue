<template>
  <view class="member-list-page">
    <page-header title="会员管理" @back="goBack">
      <template #right>
        <view class="hd-add" @tap="openNew">
          <text class="hd-add-text">新增</text>
        </view>
      </template>
    </page-header>

    <!-- 类型 Tab（全部 / 批发客户 / 零售客户） -->
    <view class="top-tabs">
      <view
        class="top-tab"
        v-for="t in typeTabs"
        :key="t.k"
        :class="{ 'top-tab--on': activeTab === t.k }"
        @tap="switchTab(t.k)"
      >{{ t.name }}</view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="keyword"
          type="text"
          placeholder="搜索客户名称 / 联系人 / 手机号 / 卡号"
          placeholder-class="search-placeholder"
          confirm-type="search"
          @confirm="reload"
        />
        <image class="search-clear ic" v-if="keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
      </view>
    </view>

    <!-- 汇总卡（批发/零售/储值余额） -->
    <view class="sum-row">
      <view class="sum-card">
        <text class="sum-lb">批发客户</text>
        <text class="sum-vl sum-vl--blue">{{ stats.wholesaleCount }} 家</text>
      </view>
      <view class="sum-card">
        <text class="sum-lb">零售客户</text>
        <text class="sum-vl sum-vl--gold">{{ stats.retailCount }} 人</text>
      </view>
      <view class="sum-card">
        <text class="sum-lb">储值余额合计</text>
        <text class="sum-vl sum-vl--plain">对接中</text>
      </view>
    </view>

    <view class="section-title">会员列表</view>

    <!-- 列表 -->
    <view class="loading-overlay" v-if="loading && list.length === 0">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <scroll-view class="member-scroll" scroll-y :show-scrollbar="false" @scrolltolower="onLoadMore">
      <view class="mem-card" v-for="m in filtered" :key="m.id" @tap="goDetail(m.id)">
        <view class="mc-body">
          <view class="mc-ava" :class="avatarClass(m)">{{ (m.name || '会').charAt(0) }}</view>
          <view class="mc-main">
            <view class="mc-t">
              <text class="mc-name">{{ m.name || '会员' }}</text>
              <text class="lv-badge" :class="avatarClass(m)">{{ levelName(m) }}</text>
              <text v-if="m.status === 0" class="st-badge st-badge--off">已冻结</text>
            </view>
            <view class="mc-mobile">
              <text>{{ m.mobile || '—' }}</text>
            </view>
            <view class="mc-addr">
              <text>{{ m.addressText || '—' }}</text>
            </view>
            <view class="mc-tags" v-if="typeName(m)">
              <text class="mc-tag">{{ typeName(m) }}</text>
            </view>
          </view>
        </view>
        <view class="mc-foot">
          <view class="mc-fi">
            <text class="mc-fl">积分</text>
            <text class="mc-fv mc-fv--gold">{{ m.points || 0 }}</text>
          </view>
          <view class="mc-fi">
            <text class="mc-fl">储值余额</text>
            <text class="mc-fv">对接中</text>
          </view>
          <view class="mc-fi">
            <text class="mc-fl">累计消费</text>
            <text class="mc-fv">¥{{ fmt(m.totalConsume) }}</text>
          </view>
        </view>
      </view>

      <view class="empty-state" v-if="!loading && filtered.length === 0">
        <text class="empty-text">没有符合条件的客户</text>
      </view>

      <view class="load-more" v-if="filtered.length > 0">
        <text class="load-more-text" v-if="loadingMore">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>
      <view class="safe-bottom"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { get } from '@/api/request'
import { memberLevelApi, type MemberLevel } from '@/api/modules/member-levels'

interface MemberRow {
  id: number
  name: string
  nickname?: string | null
  mobile: string
  customerType?: string | null
  levelCode?: string | null
  levelName?: string | null
  points: number
  status?: number
  lastOrderAt: string | null
  createdAt: string
  totalConsume: number
}

const typeTabs = [
  { k: 'all', name: '全部' },
  { k: 'WHOLESALE', name: '批发客户' },
  { k: 'RETAIL', name: '零售客户' },
] as const
type TabKey = 'all' | 'WHOLESALE' | 'RETAIL'

const list = ref<MemberRow[]>([])
const stats = ref({ totalMembers: 0, monthNew: 0, activeRate: 0, wholesaleCount: 0, retailCount: 0 })
const keyword = ref('')
const activeTab = ref<TabKey>('all')
const loading = ref(false)
const loadingMore = ref(false)
const page = ref(1)
const pageSize = 20
const noMore = ref(false)

// 会员等级（按 minPoints 真实驱动，复用详情页逻辑）
const levels = ref<MemberLevel[]>([])
const sortedLevels = computed(() =>
  [...levels.value].filter((l) => l.status === 'active').sort((a, b) => a.minPoints - b.minPoints)
)
function levelIndexOf(points: number): number {
  let idx = 0
  sortedLevels.value.forEach((l, i) => { if (points >= l.minPoints) idx = i })
  return idx
}
function isWholesale(m: MemberRow): boolean {
  return (m.customerType || '').toUpperCase() === 'WHOLESALE'
}
function avatarClass(m: MemberRow): string {
  if (isWholesale(m)) return 'mc-ava--wholesale'
  return 'mc-ava--lv' + levelIndexOf(m.points)
}
function levelName(m: MemberRow): string {
  if (isWholesale(m)) return '批发客户'
  return m.levelName || sortedLevels.value[levelIndexOf(m.points)]?.name || '零售普通'
}
function typeName(m: MemberRow): string {
  return isWholesale(m) ? '批发客户' : '零售客户'
}
function fmt(n: number): string {
  const v = Number(n) || 0
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const filtered = computed(() => {
  if (activeTab.value === 'all') return list.value
  const t = activeTab.value
  return list.value.filter((m) => (m.customerType || '').toUpperCase() === t)
})

function goBack() { uni.navigateBack({ delta: 1 }) }
function goDetail(id: number) { uni.navigateTo({ url: `/pages-sub/marketing/member/member-detail?id=${id}` }) }
function openNew() { uni.navigateTo({ url: `/pages-sub/marketing/member/member-detail?new=1` }) }

function switchTab(k: TabKey) {
  activeTab.value = k
}

async function loadLevels() {
  try {
    const res = await memberLevelApi.list({ page: 1, pageSize: 100 })
    levels.value = res.list ?? []
  } catch (e) { /* 等级缺失不影响列表渲染 */ }
}

async function load(reset = false) {
  if (loading.value) return
  loading.value = true
  try {
    const p = reset ? 1 : page.value
    const res: any = await get('/store/members/manage', { page: p, pageSize, keyword: keyword.value })
    const data = res?.data ?? res ?? {}
    const rows: MemberRow[] = data.records ?? []
    const mapped: MemberRow[] = rows.map((r: any) => ({
      ...r,
      name: r.name || r.nickname || '会员',
      totalConsume: Number(r.totalConsume ?? 0),
      addressText: [r.province, r.city, r.district, r.address].filter(Boolean).join('') || '',
    }))
    if (reset) list.value = mapped
    else list.value = list.value.concat(mapped)
    page.value = p + 1
    noMore.value = rows.length < pageSize
    if (data.stats) stats.value = { ...stats.value, ...data.stats }
  } catch (err) {
    console.error('加载会员列表失败:', err)
  } finally {
    loading.value = false
  }
}

function reload() {
  list.value = []
  page.value = 1
  noMore.value = false
  load(true)
}
function clearSearch() { keyword.value = ''; reload() }
function onLoadMore() {
  if (!noMore.value && !loadingMore.value) {
    loadingMore.value = true
    load(false).finally(() => (loadingMore.value = false))
  }
}

onMounted(() => { loadLevels(); load(true) })
</script>

<style lang="scss" scoped>
@import '@/uni.scss';

.member-list-page {
  min-height: 100vh;
  background: $uni-bg-color-page;
  display: flex;
  flex-direction: column;
}
.hd-add { padding: 8rpx 20rpx; }
.hd-add-text { font-size: 28rpx; color: $uni-color-primary; font-weight: 600; }

/* 类型 Tab */
.top-tabs {
  display: flex;
  gap: $uni-spacing-sm;
  padding: $uni-spacing-sm $uni-spacing-base;
  background: $uni-bg-color;
}
.top-tab {
  padding: 12rpx 28rpx;
  border-radius: $uni-border-radius-pill;
  font-size: 26rpx;
  color: $uni-gray-500;
  background: $uni-bg-color-page;
}
.top-tab--on {
  color: $uni-color-primary;
  background: $uni-color-primary-soft;
  font-weight: 600;
}

.search-bar { padding: 0 24rpx 16rpx; }
.search-input-wrap {
  display: flex;
  align-items: center;
  background: $uni-bg-color-page;
  border-radius: 40rpx;
  padding: 0 24rpx;
  height: 68rpx;
}
.search-icon { color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 26rpx; }
.search-clear { color: $uni-gray-400; }

/* 汇总卡 */
.sum-row {
  display: flex;
  gap: $uni-spacing-md;
  padding: $uni-spacing-sm $uni-spacing-base;
}
.sum-card {
  flex: 1;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  box-shadow: 0 2rpx 12rpx $zx-black-40;
}
.sum-lb { font-size: 22rpx; color: $uni-gray-400; }
.sum-vl { font-size: 32rpx; font-weight: 800; color: $uni-text-color; }
.sum-vl--blue { color: $uni-color-primary; }
.sum-vl--gold { color: $zx-badge-warning-strong; }
.sum-vl--plain { font-size: 26rpx; font-weight: 600; color: $uni-gray-400; }

.section-title {
  font-size: 24rpx;
  font-weight: 600;
  color: $uni-gray-500;
  padding: $uni-spacing-base $uni-spacing-base $uni-spacing-sm;
}

.member-scroll { flex: 1; padding: 0 $uni-spacing-lg; }

/* 会员卡片（对齐原稿 .mem-card） */
.mem-card {
  background: $uni-gray-0;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-md;
  box-shadow: 0 2rpx 10rpx $zx-black-30;
}
.mc-body { display: flex; }
.mc-ava {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: $uni-text-color-inverse;
  font-size: 30rpx;
  font-weight: 700;
}
.mc-ava--wholesale { background: $zx-lv-wholesale; }
.mc-ava--lv0 { background: $zx-lv-basic; }
.mc-ava--lv1 { background: $zx-lv-silver; }
.mc-ava--lv2 { background: $zx-badge-warning-strong; }
.mc-ava--lv3 { background: $zx-violet-600; }
.mc-main { flex: 1; min-width: 0; margin-left: $uni-spacing-base; overflow: hidden; }
.mc-t { display: flex; align-items: center; gap: 10rpx; }
.mc-name { font-size: 28rpx; font-weight: 600; color: $uni-text-color; }
.lv-badge {
  font-size: 20rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  border-radius: $uni-border-radius-pill;
  padding: 2rpx 12rpx;
}
.lv-badge.mc-ava--wholesale { background: $zx-lv-wholesale; }
.lv-badge.mc-ava--lv0 { background: $zx-lv-basic; }
.lv-badge.mc-ava--lv1 { background: $zx-lv-silver; }
.lv-badge.mc-ava--lv2 { background: $zx-badge-warning-strong; }
.lv-badge.mc-ava--lv3 { background: $zx-violet-600; }
.st-badge { font-size: 20rpx; padding: 2rpx 12rpx; border-radius: $uni-border-radius-pill; }
.st-badge--off { color: $uni-color-error; background: $zx-antred-100; }
.mc-mobile { margin-top: 8rpx; font-size: 24rpx; color: $uni-gray-600; }
.mc-addr {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: $uni-gray-400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mc-tags { margin-top: 10rpx; display: flex; gap: 10rpx; flex-wrap: wrap; }
.mc-tag {
  font-size: 20rpx;
  color: $uni-gray-500;
  background: $uni-bg-color-soft;
  border-radius: $uni-border-radius-pill;
  padding: 2rpx 12rpx;
}
.mc-foot {
  display: flex;
  margin-top: $uni-spacing-sm;
  padding-top: $uni-spacing-sm;
  border-top: 1rpx solid $uni-gray-100;
}
.mc-fi { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
.mc-fl { font-size: 20rpx; color: $uni-gray-400; }
.mc-fv { font-size: 26rpx; font-weight: 700; color: $uni-text-color; }
.mc-fv--gold { color: $zx-badge-warning-strong; }

.empty-state { padding: 120rpx 0; text-align: center; }
.empty-text { color: $uni-gray-300; font-size: 26rpx; }
.load-more { text-align: center; padding: $uni-spacing-sm 0; }
.load-more-text { color: $zx-gray-400; font-size: 22rpx; }
</style>
