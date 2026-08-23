<template>
  <view class="check-detail-page">
    <page-header title="盘点详情" @back="goBack" />

    <view v-if="check" class="info-card">
      <view class="card-row">
        <text class="card-label">盘点单号</text>
        <text class="card-value">{{ check.checkNo }}</text>
      </view>
      <view class="card-row">
        <text class="card-label">标题</text>
        <text class="card-value">{{ check.title }}</text>
      </view>
      <view class="card-row">
        <text class="card-label">状态</text>
        <view class="status-tag" :class="getStatusClass(check.status)">
          <text class="status-tag-text">{{ getStatusText(check.status) }}</text>
        </view>
      </view>
      <view class="card-row">
        <text class="card-label">商品数</text>
        <text class="card-value">{{ check.totalCount ?? items.length }}</text>
      </view>
      <view class="card-row" v-if="check.diffCount != null">
        <text class="card-label">差异数</text>
        <text class="card-value" :class="{ 'text-danger': check.diffCount > 0 }">{{ check.diffCount }}</text>
      </view>
      <view class="card-row">
        <text class="card-label">盘点人</text>
        <text class="card-value">{{ check.operatorName || '--' }}</text>
      </view>
      <view class="card-row">
        <text class="card-label">创建时间</text>
        <text class="card-value">{{ check.createdAt || '--' }}</text>
      </view>
    </view>

    <view class="action-bar" v-if="check && (check.status === 'DRAFT' || check.status === 'IN_PROGRESS')">
      <button class="btn btn--primary" v-if="check.status === 'DRAFT'" @tap="onStart">开始盘点</button>
      <button class="btn btn--success" v-if="check.status === 'IN_PROGRESS'" @tap="onComplete">完成盘点</button>
      <button class="btn btn--danger" @tap="onCancel">取消盘点</button>
    </view>

    <view class="items-section">
      <view class="section-title">
        <text>盘点明细</text>
        <text class="section-count">共{{ items.length }}项</text>
      </view>

      <view class="item-card" v-for="item in items" :key="item.id">
        <view class="item-header">
          <text class="item-name">{{ item.productName }}</text>
          <text class="item-sku" v-if="item.skuId">{{ item.skuId }}</text>
        </view>
        <view class="item-body">
          <view class="item-info">
            <text class="info-label">系统数量</text>
            <text class="info-value">{{ item.systemQty }}{{ item.unit || '' }}</text>
          </view>
          <view class="item-info" v-if="check?.status === 'IN_PROGRESS' || check?.status === 'COMPLETED'">
            <text class="info-label">实际数量</text>
            <input
              v-if="check?.status === 'IN_PROGRESS'"
              class="qty-input"
              type="digit"
              v-model="actualQtyMap[item.id]"
              placeholder="输入"
              @blur="calcDiff(item)"
            />
            <text class="info-value" v-else>{{ item.actualQty ?? '--' }}{{ item.unit || '' }}</text>
          </view>
          <view class="item-info" v-if="check?.status === 'IN_PROGRESS' || check?.status === 'COMPLETED'">
            <text class="info-label">差异</text>
            <text
              class="info-value"
              :class="{ 'text-danger': getDiff(item) < 0, 'text-success': getDiff(item) > 0 }"
            >{{ getDiff(item) }}</text>
          </view>
        </view>

        <view class="diff-action" v-if="check?.status === 'COMPLETED' && getDiff(item) !== 0">
          <view class="diff-label">差异处理：</view>
          <radio-group @change="onDiffActionChange(item, $event)">
            <label class="radio-item">
              <radio value="adjust" :checked="diffActionMap[item.id] === 'adjust'" />
              <text>调整库存</text>
            </label>
            <label class="radio-item">
              <radio value="ignore" :checked="diffActionMap[item.id] === 'ignore'" />
              <text>忽略</text>
            </label>
          </radio-group>
        </view>
      </view>

      <view class="empty-state" v-if="items.length === 0 && !loading">
        <text class="empty-text">暂无盘点明细</text>
      </view>
    </view>

    <view class="bottom-bar" v-if="check?.status === 'COMPLETED' && hasDiff">
      <button class="btn btn--primary btn--block" @tap="onHandleDiff">提交差异处理</button>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { stockCheckApi, type StockCheck, type StockCheckItem } from '@/api/modules/stock-check'

const check = ref<StockCheck | null>(null)
const items = ref<StockCheckItem[]>([])
const loading = ref(false)
const actualQtyMap = reactive<Record<number, string>>({})
const diffActionMap = reactive<Record<number, string>>({})

const hasDiff = computed(() => {
  return items.value.some(it => getDiff(it) !== 0)
})

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '草稿', IN_PROGRESS: '进行中', COMPLETED: '已完成', CANCELLED: '已取消',
  }
  return map[status] ?? status
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'status-tag--draft', IN_PROGRESS: 'status-tag--progress',
    COMPLETED: 'status-tag--success', CANCELLED: 'status-tag--cancel',
  }
  return map[status] ?? ''
}

function getDiff(item: StockCheckItem): number {
  if (actualQtyMap[item.id] != null && actualQtyMap[item.id] !== '') {
    return Number(actualQtyMap[item.id]) - item.systemQty
  }
  return item.diffQty ?? 0
}

function calcDiff(item: StockCheckItem) {
  if (actualQtyMap[item.id] != null && actualQtyMap[item.id] !== '') {
    item.diffQty = Number(actualQtyMap[item.id]) - item.systemQty
    item.actualQty = Number(actualQtyMap[item.id])
  }
}

function onDiffActionChange(item: StockCheckItem, e: any) {
  diffActionMap[item.id] = e.detail.value
}

async function loadDetail(id: number) {
  loading.value = true
  try {
    const result = await stockCheckApi.detail(id)
    check.value = result.check
    items.value = result.items
    items.value.forEach(it => {
      if (it.actualQty != null) {
        actualQtyMap[it.id] = String(it.actualQty)
      }
    })
  } catch (err) {
    console.error('加载盘点详情失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function onStart() {
  if (!check.value) return
  try {
    await stockCheckApi.start(check.value.id)
    uni.showToast({ title: '盘点已开始', icon: 'success' })
    loadDetail(check.value.id)
  } catch (err) {
    console.error('开始盘点失败:', err)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

async function onComplete() {
  if (!check.value) return
  const incomplete = items.value.some(it => actualQtyMap[it.id] == null || actualQtyMap[it.id] === '')
  if (incomplete) {
    uni.showToast({ title: '请填写所有商品实际数量', icon: 'none' })
    return
  }
  try {
    const updateData = items.value.map(it => ({
      id: it.id,
      actualQty: Number(actualQtyMap[it.id]),
      diffQty: Number(actualQtyMap[it.id]) - it.systemQty,
    }))
    await stockCheckApi.update(check.value.id, { items: updateData })
    await stockCheckApi.complete(check.value.id)
    uni.showToast({ title: '盘点已完成', icon: 'success' })
    loadDetail(check.value.id)
  } catch (err) {
    console.error('完成盘点失败:', err)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

async function onCancel() {
  if (!check.value) return
  uni.showModal({
    title: '确认取消',
    content: '确定要取消此盘点单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await stockCheckApi.cancel(check.value!.id)
          uni.showToast({ title: '已取消', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 1000)
        } catch (err) {
          console.error('取消盘点失败:', err)
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    },
  })
}

async function onHandleDiff() {
  if (!check.value) return
  const unhandled = items.value.filter(it => getDiff(it) !== 0 && !diffActionMap[it.id])
  if (unhandled.length > 0) {
    uni.showToast({ title: '请处理所有差异项', icon: 'none' })
    return
  }
  const handleItems = items.value
    .filter(it => getDiff(it) !== 0)
    .map(it => ({ id: it.id, action: diffActionMap[it.id] }))
  try {
    await stockCheckApi.handleDiff(check.value.id, { items: handleItems })
    uni.showToast({ title: '差异处理完成', icon: 'success' })
    loadDetail(check.value.id)
  } catch (err) {
    console.error('差异处理失败:', err)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

onLoad((options: any) => {
  if (options.id) {
    loadDetail(Number(options.id))
  }
})
</script>

<style lang="scss" scoped>
.check-detail-page { min-height: 100vh; background: $uni-color-primary-soft; padding-bottom: 120rpx; }
.page-header { padding: 24rpx 32rpx; padding-top: calc(24rpx + env(safe-area-inset-top)); background: $uni-bg-color; }
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.info-card { background: $uni-bg-color; margin: 16rpx 24rpx; border-radius: 16rpx; padding: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.card-row { display: flex; justify-content: space-between; align-items: center; padding: 12rpx 0; }
.card-label { font-size: 26rpx; color: $uni-gray-400; }
.card-value { font-size: 28rpx; color: $uni-gray-700; font-weight: 500; }
.text-danger { color: $uni-color-error; }
.text-success { color: $uni-color-success; }
.status-tag { padding: 4rpx 16rpx; border-radius: 8rpx; }
.status-tag--draft { background: rgba(0,0,0,0.05); }
.status-tag--progress { background: rgba(250,173,20,0.1); }
.status-tag--success { background: rgba(82,196,26,0.1); }
.status-tag--cancel { background: rgba(255,77,79,0.1); }
.status-tag-text { font-size: 22rpx; }
.status-tag--draft .status-tag-text { color: $uni-gray-400; }
.status-tag--progress .status-tag-text { color: $uni-color-warning; }
.status-tag--success .status-tag-text { color: $uni-color-success; }
.status-tag--cancel .status-tag-text { color: $uni-color-error; }
.action-bar { display: flex; gap: 16rpx; padding: 16rpx 24rpx; }
.btn { flex: 1; height: 80rpx; line-height: 80rpx; border-radius: 12rpx; font-size: 28rpx; text-align: center; border: none; }
.btn--primary { background: $uni-color-primary; color: $uni-text-color-inverse; }
.btn--success { background: $uni-color-success; color: $uni-text-color-inverse; }
.btn--danger { background: $uni-text-color-inverse; color: $uni-color-error; border: 1rpx solid $uni-color-error; }
.btn--block { width: 100%; }
.items-section { padding: 0 24rpx; }
.section-title { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 0 16rpx; font-size: 30rpx; font-weight: 600; color: $uni-gray-700; }
.section-count { font-size: 24rpx; color: $uni-gray-400; font-weight: 400; }
.item-card { background: $uni-bg-color; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; padding-bottom: 12rpx; border-bottom: 1rpx solid $uni-gray-100; }
.item-name { font-size: 28rpx; font-weight: 600; color: $uni-gray-700; }
.item-sku { font-size: 22rpx; color: $uni-gray-400; }
.item-body { display: flex; gap: 24rpx; }
.item-info { flex: 1; display: flex; flex-direction: column; align-items: center; }
.info-label { font-size: 22rpx; color: $uni-gray-400; margin-bottom: 8rpx; }
.info-value { font-size: 28rpx; color: $uni-gray-700; font-weight: 500; }
.qty-input { width: 120rpx; height: 60rpx; border: 1rpx solid $uni-gray-300; border-radius: 8rpx; text-align: center; font-size: 28rpx; }
.diff-action { margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid $uni-gray-100; }
.diff-label { font-size: 24rpx; color: $uni-gray-500; margin-bottom: 8rpx; }
.radio-item { display: inline-flex; align-items: center; margin-right: 32rpx; font-size: 26rpx; }
.empty-state { display: flex; justify-content: center; padding: 100rpx 0; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 16rpx 24rpx; padding-bottom: calc(16rpx + env(safe-area-inset-bottom)); background: $uni-bg-color; box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06); }
.safe-bottom { height: 40rpx; }
</style>
