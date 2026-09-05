<template>
  <view class="suppliers-page">
    <page-header title="供应商管理" @back="goBack">
      <template #right>
        <view class="hd-add" @tap="openCreate">
          <text class="hd-add-text">+ 新增</text>
        </view>
      </template>
    </page-header>

    <!-- 状态 Tab（对齐原稿：全部 / 合作中 / 已停用） -->
    <view class="status-tabs">
      <view
        class="status-tab"
        v-for="t in statusTabs"
        :key="t.k"
        :class="{ 'status-tab--on': activeTab === t.k }"
        @tap="setTab(t.k)"
      >
        <text>{{ t.name }}</text>
      </view>
    </view>

    <!-- 搜索表单：名称 / 编码 / 联系人 -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索供应商名称 / 编码 / 联系人"
            placeholder-class="search-placeholder"
            @input="onSearch"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
        </view>
      </view>
    </form>

    <!-- 汇总卡（合作中供应商家数 + 待付款合计 = Σ unpaid_amount，均真实） -->
    <view class="sum-row">
      <view class="sum-card">
        <text class="sum-lb">合作中供应商</text>
        <text class="sum-vl sum-vl--blue">{{ onCount }} 家</text>
      </view>
      <view class="sum-card">
        <text class="sum-lb">待付款合计</text>
        <text class="sum-vl sum-vl--warn">{{ payableLabel }}</text>
      </view>
    </view>

    <!-- 供应商列表 -->
    <scroll-view class="supplier-list" scroll-y v-if="filtered.length > 0">
      <view class="sup-card" v-for="item in filtered" :key="item.id" @tap="goDetail(item.id)">
        <view class="sc-body">
          <view class="sc-ava" :class="item.status === 1 ? 'sc-ava--on' : 'sc-ava--off'">{{ avatarText(item) }}</view>
          <view class="sc-main">
            <view class="sc-t">
              <text class="sc-name">{{ item.name || '未命名供应商' }}</text>
              <text class="st-badge" :class="item.status === 1 ? 'st-on' : 'st-off'">{{ item.status === 1 ? '合作中' : '已停用' }}</text>
            </view>
            <view class="sc-sub">
              <text>{{ contactLine(item) }}</text>
            </view>
            <view class="sc-sub sc-sub--muted">
              <text class="sc-code">{{ item.supplierCode || '—' }}</text>
              <text class="sc-dot">·</text>
              <text>{{ item.supplyType || '未分类' }}</text>
            </view>
            <!-- 标签行（对齐原稿：账期/信用；应付合计接口未提供不造假） -->
            <view class="sc-tags" v-if="tagList(item).length">
              <text
                class="sc-tag"
                v-for="(t, i) in tagList(item)"
                :key="i"
                :class="t.warn ? 'sc-tag--warn' : ''"
              >{{ t.label }}</text>
            </view>
          </view>
        </view>
        <view class="sc-foot">
          <view class="sc-fi">
            <text class="sc-fl">累计采购</text>
            <text class="sc-fv">{{ purchaseText(item) }}</text>
          </view>
          <view class="sc-fi">
            <text class="sc-fl">结算方式</text>
            <text class="sc-fv sc-fv--sm">{{ settleLabel(item) }}</text>
          </view>
          <view class="sc-fi">
            <text class="sc-fl">最近采购</text>
            <text class="sc-fv sc-fv--sm">{{ lastPurchaseText(item) }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">{{ list.length ? '没有符合条件的供应商' : '暂无供应商数据' }}</text>
      <text class="empty-hint" v-if="!list.length">点右上角「+ 新增」创建第一家供应商</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { supplierApi, type Supplier } from '@/api/modules/suppliers'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })

const statusTabs = [
  { k: 'all', name: '全部' },
  { k: 'on', name: '合作中' },
  { k: 'off', name: '已停用' },
] as const
const activeTab = ref<'all' | 'on' | 'off'>('all')

const list = ref<Supplier[]>([])
const loading = ref(false)

// 列表接口已联 t_purchase_order 聚合：totalPurchase/unpaidTotal/lastPurchase 均为真实数据；
// 后端未部署新字段时（undefined）优雅降级回「对接中」
const onCount = computed(() => list.value.filter((s) => s.status === 1).length)
const hasAgg = computed(() => list.value.some((s) => s.unpaidTotal !== undefined))
const payableSum = computed(() => list.value.reduce((sum, s) => sum + Number(s.unpaidTotal || 0), 0))
const payableLabel = computed(() => (hasAgg.value ? `¥${fmtMoney(payableSum.value)}` : '对接中'))

function fmtMoney(n: number): string {
  const v = Number(n) || 0
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function purchaseText(item: Supplier): string {
  return item.totalPurchase !== undefined ? `¥${fmtMoney(item.totalPurchase || 0)}` : '对接中'
}
function lastPurchaseText(item: Supplier): string {
  if (item.lastPurchase === undefined) return '对接中'
  return item.lastPurchase ? String(item.lastPurchase).slice(0, 10) : '—'
}

const filtered = computed<Supplier[]>(() => {
  let arr = list.value
  if (activeTab.value !== 'all') {
    const wantOn = activeTab.value === 'on'
    arr = arr.filter((s) => (s.status === 1) === wantOn)
  }
  const kw = searchForm.keyword.trim().toLowerCase()
  if (kw) {
    arr = arr.filter((s) =>
      (s.name || '').toLowerCase().includes(kw) ||
      (s.supplierCode || '').toLowerCase().includes(kw) ||
      (s.contactPerson || '').toLowerCase().includes(kw) ||
      (s.contactMobile || '').toLowerCase().includes(kw)
    )
  }
  return arr
})

function avatarText(item: Supplier): string {
  return (item.name || '供').trim().charAt(0) || '供'
}

/** 联系人行（对齐原稿「陈志明 · 13802345678」，缺省不显示占位符） */
function contactLine(item: Supplier): string {
  const parts = [item.contactPerson, item.contactMobile].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

const SETTLE_MAP: Record<string, string> = { CASH: '现结', MONTHLY: '月结', QUARTERLY: '季结' }
function settleLabel(item: Supplier): string {
  const base = item.settlementType ? SETTLE_MAP[item.settlementType] || item.settlementType : '—'
  return item.settlementDay ? `${base}${item.settlementDay}天` : base
}

/** 标签行：账期（结算方式派生，非现结才显示）+ 信用等级 + 应付（未付合计>0 时橙色显示，均真实字段） */
function tagList(item: Supplier): { label: string; warn?: boolean }[] {
  const tags: { label: string; warn?: boolean }[] = []
  if (item.settlementType && item.settlementType !== 'CASH') {
    tags.push({ label: item.settlementDay ? `账期${item.settlementDay}天` : SETTLE_MAP[item.settlementType] || item.settlementType, warn: true })
  }
  if (item.creditLevel) tags.push({ label: `信用 ${item.creditLevel}` })
  if (Number(item.unpaidTotal || 0) > 0) tags.push({ label: `应付 ¥${fmtMoney(item.unpaidTotal || 0)}`, warn: true })
  return tags
}

// —— 新增供应商（对齐原稿 openNew：详情页承接编辑，保存走 POST） ——
function openCreate() {
  uni.navigateTo({ url: '/pages-sub/product/suppliers/detail?id=new' })
}

function setTab(k: 'all' | 'on' | 'off') { activeTab.value = k }
function onSearch() { /* 客户端过滤，实时生效 */ }
function clearSearch() { searchForm.keyword = '' }
function goDetail(id: number) { uni.navigateTo({ url: `/pages-sub/product/suppliers/detail?id=${id}` }) }

/**
 * 本页搜索/状态 Tab 均为客户端过滤，需要一次性拉取全量供应商；
 * 上限 500 条——超出该规模应改走后端关键字分页搜索，而不是继续调大。
 * （此前硬编码 100 会静默截断列表，导致搜索/汇总失真）
 */
const LIST_PAGE_SIZE = 500

async function loadSuppliers() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await supplierApi.getList({ page: 1, pageSize: LIST_PAGE_SIZE })
    list.value = res.records || []
  } catch (err) {
    console.error('加载供应商失败:', err)
    uni.showToast({ title: '供应商列表加载失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadSuppliers() })
// 新增/编辑保存后返回时刷新列表；loading 守卫防止与 onMounted 首载并发重叠
onShow(() => { if (list.value.length > 0) loadSuppliers() })
</script>

<style lang="scss" scoped>
.suppliers-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}

/* 状态 Tab */
.status-tabs {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
}
.status-tab {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-gray-400;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-sm;
  border: 1rpx solid transparent;
}
.status-tab--on {
  color: $uni-text-color-inverse;
  background: $uni-color-primary;
  box-shadow: $uni-shadow-primary-sm;
}

/* 搜索 */
.search-bar { padding: 0 24rpx 16rpx; background: $uni-bg-color; }
.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: $uni-bg-color-page;
  border-radius: 36rpx;
  padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.search-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: $uni-gray-300; padding: 4rpx; }

/* 汇总卡 */
.sum-row { display: flex; gap: 16rpx; padding: 8rpx 24rpx 20rpx; }
.sum-card {
  flex: 1;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-sm;
  padding: 20rpx 24rpx;
  box-shadow: $uni-shadow-card-sm;
}
.sum-lb { font-size: 24rpx; color: $uni-gray-400; margin-bottom: 8rpx; display: block; }
.sum-vl { font-size: 34rpx; font-weight: 700; }
.sum-vl--blue { color: $uni-color-primary; }
.sum-vl--warn { color: $uni-color-warning; }

/* 列表 */
.supplier-list { padding: 0 24rpx; }
.sup-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  margin-bottom: 20rpx;
  box-shadow: $uni-shadow-card-sm;
  overflow: hidden;
}
.sc-body { display: flex; gap: 20rpx; padding: 24rpx; }
.sc-ava {
  width: 80rpx;
  height: 80rpx;
  border-radius: $uni-border-radius-sm;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
}
.sc-ava--on { background: $uni-color-primary; }
.sc-ava--off { background: $uni-gray-300; }
.sc-main { flex: 1; min-width: 0; }
.sc-t { display: flex; align-items: center; gap: 12rpx; margin-bottom: 8rpx; }
.sc-name { font-size: 30rpx; font-weight: 600; color: $uni-gray-700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-sub { font-size: 24rpx; color: $uni-gray-600; display: flex; align-items: center; gap: 8rpx; margin-bottom: 4rpx; }
.sc-sub--muted { color: $uni-gray-400; }
.sc-dot { color: $uni-gray-300; }
.sc-code { letter-spacing: 0.5rpx; }

/* 状态徽标 */
.st-badge { font-size: 21rpx; font-weight: 700; padding: 4rpx 14rpx; border-radius: 999rpx; flex-shrink: 0; }
.st-on { background: $zx-badge-success-bg; color: $zx-badge-success-strong; }
.st-off { background: $uni-gray-100; color: $uni-gray-400; }

/* 卡片底部指标 */
.sc-foot { display: flex; border-top: 1rpx solid $uni-gray-100; background: $uni-bg-color-page; }
.sc-fi { flex: 1; padding: 16rpx 12rpx; text-align: center; }
.sc-fi + .sc-fi { border-left: 1rpx solid $uni-gray-100; }
.sc-fl { font-size: 21rpx; color: $uni-gray-400; margin-bottom: 6rpx; display: block; }
.sc-fv { font-size: 26rpx; font-weight: 700; color: $uni-gray-700; }
.sc-fv--sm { font-size: 23rpx; }

/* 卡片操作（保留采购订单 / 对账单导航） */

/* 空态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: $uni-spacing-md; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.empty-hint { font-size: 24rpx; color: $uni-gray-300; margin-top: 8rpx; }

/* 头部新增入口（对齐原稿：右上角 + 新增） */
.hd-add { padding: 8rpx 20rpx; }
.hd-add-text { font-size: 28rpx; color: $uni-color-primary; font-weight: 600; }

/* 标签行 */
.sc-tags { display: flex; gap: 10rpx; flex-wrap: wrap; margin-top: 10rpx; }
.sc-tag {
  font-size: 20rpx;
  color: $uni-gray-500;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-pill;
  padding: 2rpx 12rpx;
}
.sc-tag--warn { color: $uni-color-warning; background: $uni-color-warning-soft; font-weight: 600; }

/* 新增供应商弹层 */
.overlay {
  position: fixed;
  inset: 0;
  background: $uni-mask-bg;
  z-index: 400;
  display: flex;
  align-items: flex-end;
}
.panel {
  width: 100%;
  background: $uni-color-primary-soft;
  border-radius: 40rpx 40rpx 0 0;
  padding: 36rpx 32rpx calc(44rpx + env(safe-area-inset-bottom));
  max-height: 84vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.panel-title { font-size: 32rpx; font-weight: 700; margin-bottom: 28rpx; color: $uni-text-color; }
.panel-body { max-height: 56vh; }
.form-item { margin-bottom: 24rpx; }
.form-label { display: block; font-size: 26rpx; color: $uni-gray-500; margin-bottom: 12rpx; }
.required { color: $uni-color-error; }
.form-input {
  width: 100%;
  height: 84rpx;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-sm;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}
.form-ph { color: $uni-gray-300; }
.settle-chips { display: flex; gap: 16rpx; }
.settle-chip {
  flex: 1;
  height: 76rpx;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: $uni-gray-500;
  border: 2rpx solid transparent;
}
.settle-chip--on {
  background: $zx-primary-80;
  border-color: $uni-color-primary;
  color: $uni-color-primary;
  font-weight: 600;
}
.panel-ft { display: flex; gap: 18rpx; margin-top: 28rpx; }
.m-btn {
  flex: 1;
  height: 88rpx;
  border-radius: $uni-border-radius-sm;
  font-size: 29rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.m-btn--primary { background: $uni-color-primary; color: $ai-bg-page; }
.m-btn--ghost { background: $uni-bg-color; color: $uni-gray-600; border: 1rpx solid $uni-border-color; }
.safe-bottom { height: 40rpx; }
</style>
