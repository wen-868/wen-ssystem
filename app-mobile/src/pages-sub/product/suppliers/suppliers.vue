<template>
  <view class="suppliers-page">
    <page-header title="供应商管理" @back="goBack" />

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

    <!-- 汇总卡（合作中供应商家数真实；待付款合计列表接口未聚合，标注对接中，不造假） -->
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
              <text>{{ item.contactPerson || '—' }}</text>
              <text class="sc-dot">·</text>
              <text>{{ item.contactMobile || '—' }}</text>
            </view>
            <view class="sc-sub sc-sub--muted">
              <text class="sc-code">{{ item.supplierCode || '—' }}</text>
              <text class="sc-dot">·</text>
              <text>{{ item.supplyType || '未分类' }}</text>
            </view>
          </view>
        </view>
        <view class="sc-foot">
          <view class="sc-fi">
            <text class="sc-fl">累计采购</text>
            <text class="sc-fv">对接中</text>
          </view>
          <view class="sc-fi">
            <text class="sc-fl">结算方式</text>
            <text class="sc-fv sc-fv--sm">{{ settleLabel(item) }}</text>
          </view>
          <view class="sc-fi">
            <text class="sc-fl">最近采购</text>
            <text class="sc-fv">对接中</text>
          </view>
        </view>
        <view class="sc-actions">
          <button class="action-btn order-btn" @tap.stop="viewOrders(item)">采购订单</button>
          <button class="action-btn statement-btn" @tap.stop="viewStatements(item)">对账单</button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">{{ list.length ? '没有符合条件的供应商' : '暂无供应商数据' }}</text>
      <text class="empty-hint" v-if="!list.length">点右下角 + 新增第一家供应商</text>
    </view>

    <!-- 新增供应商 -->
    <view class="fab-btn" @tap="openCreate">
      <text class="fab-icon">+</text>
    </view>

    <!-- 新增供应商弹层 -->
    <view class="overlay" v-if="showCreate" @tap="showCreate = false">
      <view class="panel" @tap.stop>
        <view class="panel-title"><text>新增供应商</text></view>
        <scroll-view class="panel-body" scroll-y>
          <view class="form-item">
            <text class="form-label">供应商名称 <text class="required">*</text></text>
            <input class="form-input" v-model="createForm.name" placeholder="请输入供应商名称" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">分类</text>
            <input class="form-input" v-model="createForm.supplyType" placeholder="如 食品饮料 / 日用百货" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">联系人</text>
            <input class="form-input" v-model="createForm.contactPerson" placeholder="请输入联系人姓名" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">联系电话</text>
            <input class="form-input" v-model="createForm.contactMobile" type="number" placeholder="请输入联系电话" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">地址</text>
            <input class="form-input" v-model="createForm.address" placeholder="请输入供应商地址（选填）" placeholder-class="form-ph" />
          </view>
          <view class="form-item">
            <text class="form-label">结算方式</text>
            <view class="settle-chips">
              <view
                class="settle-chip"
                v-for="opt in settleOptions"
                :key="opt.value"
                :class="{ 'settle-chip--on': createForm.settlementType === opt.value }"
                @tap="createForm.settlementType = opt.value"
              >
                <text>{{ opt.label }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
        <view class="panel-ft">
          <view class="m-btn m-btn--ghost" @tap="showCreate = false"><text>取消</text></view>
          <view class="m-btn m-btn--primary" @tap="submitCreate"><text>保存</text></view>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, computed, onMounted } from 'vue'
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

// 列表接口仅返回名称/编码/分类/联系人/状态/结算方式等字段，不含 累计采购/最近采购/应付汇总；
// 这些聚合值在列表接口未提供，按「不造假」原则显示「对接中」。
const onCount = computed(() => list.value.filter((s) => s.status === 1).length)
const payableLabel = computed(() => '对接中')

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

const SETTLE_MAP: Record<string, string> = { CASH: '现结', MONTHLY: '月结', QUARTERLY: '季结' }
function settleLabel(item: Supplier): string {
  const base = item.settlementType ? SETTLE_MAP[item.settlementType] || item.settlementType : '—'
  return item.settlementDay ? `${base}${item.settlementDay}天` : base
}

// —— 新增供应商 ——
const showCreate = ref(false)
const settleOptions = [
  { label: '现结', value: 'CASH' },
  { label: '月结', value: 'MONTHLY' },
  { label: '季结', value: 'QUARTERLY' },
] as const
const createForm = reactive({
  name: '',
  supplyType: '',
  contactPerson: '',
  contactMobile: '',
  address: '',
  settlementType: 'CASH' as 'CASH' | 'MONTHLY' | 'QUARTERLY',
})

function openCreate() {
  createForm.name = ''
  createForm.supplyType = ''
  createForm.contactPerson = ''
  createForm.contactMobile = ''
  createForm.address = ''
  createForm.settlementType = 'CASH'
  showCreate.value = true
}

async function submitCreate() {
  const name = createForm.name.trim()
  if (!name) {
    uni.showToast({ title: '请输入供应商名称', icon: 'none' })
    return
  }
  try {
    await supplierApi.create({
      name,
      shortName: undefined,
      supplyType: createForm.supplyType.trim() || undefined,
      contactPerson: createForm.contactPerson.trim() || undefined,
      contactMobile: createForm.contactMobile.trim() || undefined,
      address: createForm.address.trim() || undefined,
      settlementType: createForm.settlementType,
    })
    showCreate.value = false
    uni.showToast({ title: '新增成功', icon: 'success' })
    loadSuppliers()
  } catch (err: any) {
    uni.showToast({ title: err?.message || '新增失败', icon: 'none' })
  }
}

function setTab(k: 'all' | 'on' | 'off') { activeTab.value = k }
function onSearch() { /* 客户端过滤，实时生效 */ }
function clearSearch() { searchForm.keyword = '' }
function goDetail(id: number) { uni.navigateTo({ url: `/pages-sub/product/suppliers/detail?id=${id}` }) }

function viewOrders(item: Supplier) {
  uni.navigateTo({ url: `/pages-sub/finance/purchase/orders?supplierId=${item.id}` })
}

function viewStatements(item: Supplier) {
  uni.navigateTo({ url: `/pages-sub/finance/statements/statements?supplierId=${item.id}` })
}

async function loadSuppliers() {
  loading.value = true
  try {
    const res = await supplierApi.getList({ page: 1, pageSize: 100 })
    list.value = res.list || []
  } catch (err) {
    console.error('加载供应商失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadSuppliers() })
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
.sc-actions {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid $uni-gray-100;
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
.order-btn { background: $uni-color-primary; color: $uni-text-color-inverse; }
.statement-btn { background: $uni-bg-color-grey; color: $uni-gray-700; }
.action-btn::after { border: none; }

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

/* 新增入口（FAB） */
.fab-btn {
  position: fixed;
  right: 40rpx;
  bottom: calc(60rpx + env(safe-area-inset-bottom));
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  background: $uni-color-primary;
  box-shadow: $uni-shadow-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
}
.fab-icon { font-size: 56rpx; color: $ai-bg-page; line-height: 1; }

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
