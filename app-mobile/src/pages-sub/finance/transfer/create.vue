<template>
  <view class="create-page">
    <page-header title="新建调拨单" @back="goBack" />
    <view class="form-container">

      <!-- 调出仓库 -->
      <view class="form-item">
        <text class="form-label">调出仓库 <text class="required">*</text></text>
        <picker :range="storeNames" :value="fromIndex" @change="(e: any) => onStoreChange('from', e)">
          <view class="picker-value">
            <text class="picker-text">{{ fromIndex >= 0 ? storeNames[fromIndex] : '请选择调出仓库' }}</text>
            <text class="picker-arrow">›</text>
          </view>
        </picker>
      </view>

      <!-- 调入仓库 -->
      <view class="form-item">
        <text class="form-label">调入仓库 <text class="required">*</text></text>
        <picker :range="storeNames" :value="toIndex" @change="(e: any) => onStoreChange('to', e)">
          <view class="picker-value">
            <text class="picker-text">{{ toIndex >= 0 ? storeNames[toIndex] : '请选择调入仓库' }}</text>
            <text class="picker-arrow">›</text>
          </view>
        </picker>
      </view>

      <!-- 期望到货日期 -->
      <view class="form-item">
        <text class="form-label">期望到货日期</text>
        <picker mode="date" :value="expectedDate" @change="onDateChange">
          <view class="picker-value">
            <text class="picker-text">{{ expectedDate || '请选择日期' }}</text>
            <text class="picker-arrow">›</text>
          </view>
        </picker>
      </view>

      <!-- 商品明细 -->
      <view class="form-item">
        <view class="item-head">
          <text class="form-label">商品明细 <text class="required">*</text></text>
          <text class="add-link" @tap="addItem">+ 添加商品</text>
        </view>
        <view class="goods-line" v-for="(row, idx) in items" :key="idx">
          <picker :range="productNames" :value="row.productIndex" @change="(e: any) => onProductChange(idx, e)">
            <view class="picker-value picker-value--sm">
              <text class="picker-text">{{ row.productIndex >= 0 ? productNames[row.productIndex] : '选择商品' }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
          <view class="qty-wrap">
            <input class="qty-input" type="digit" placeholder="数量" v-model="row.quantity" />
            <text class="qty-unit">{{ row.unit || '' }}</text>
          </view>
          <text class="line-del" @tap="removeItem(idx)" v-if="items.length > 1">删除</text>
        </view>
      </view>

      <!-- 备注 -->
      <view class="form-item">
        <text class="form-label">备注</text>
        <textarea class="remark-input" placeholder="请输入备注信息" v-model="remark" />
      </view>
    </view>

    <view class="submit-btn" :class="{ disabled: !isValid || submitting }" @tap="onSubmit">
      <text class="submit-text">{{ submitting ? '提交中…' : '提交调拨单' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
function goBack() { uni.navigateBack() }

import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { storesApi, type StoreInfo } from '@/api/modules/stores'
import { productsApi, type ProductInfo } from '@/api/modules/products'
import { transferApi } from '@/api/modules/transfer'

const stores = ref<StoreInfo[]>([])
const storeNames = computed(() => stores.value.map((s) => s.name))
const fromIndex = ref(-1)
const toIndex = ref(-1)

const products = ref<ProductInfo[]>([])
const productNames = computed(() => products.value.map((p) => p.name))

interface ItemRow {
  productIndex: number
  skuId: number
  skuName: string
  unitPrice: number
  unit: string
  quantity: string
}
const items = ref<ItemRow[]>([{ productIndex: -1, skuId: 0, skuName: '', unitPrice: 0, unit: '', quantity: '' }])

const expectedDate = ref('')
const remark = ref('')
const submitting = ref(false)

const isValid = computed(() => {
  if (fromIndex.value < 0 || toIndex.value < 0) return false
  if (fromIndex.value === toIndex.value) return false
  return items.value.every((it) => it.productIndex >= 0 && Number(it.quantity) > 0)
})

function onStoreChange(which: 'from' | 'to', e: any) {
  const i = Number(e.detail.value)
  if (which === 'from') fromIndex.value = i
  else toIndex.value = i
}

function onProductChange(idx: number, e: any) {
  const i = Number(e.detail.value)
  const p = products.value[i]
  if (!p) return
  items.value[idx] = {
    productIndex: i,
    skuId: Number(p.skuId ?? p.id),
    skuName: p.name,
    unitPrice: Number(p.price ?? 0),
    unit: p.unit ?? '',
    quantity: items.value[idx].quantity,
  }
}

function addItem() {
  items.value.push({ productIndex: -1, skuId: 0, skuName: '', unitPrice: 0, unit: '', quantity: '' })
}
function removeItem(idx: number) {
  if (items.value.length > 1) items.value.splice(idx, 1)
}

function onDateChange(e: any) {
  expectedDate.value = e.detail.value
}

async function onSubmit() {
  if (submitting.value) return
  if (!isValid.value) {
    if (fromIndex.value === toIndex.value && fromIndex.value >= 0) {
      uni.showToast({ title: '调出与调入仓库不能相同', icon: 'none' })
    } else {
      uni.showToast({ title: '请完整填写调拨信息', icon: 'none' })
    }
    return
  }
  const payload = {
    fromStoreId: stores.value[fromIndex.value].id,
    toStoreId: stores.value[toIndex.value].id,
    items: items.value.map((it) => ({
      skuId: it.skuId,
      skuName: it.skuName,
      quantity: Number(it.quantity),
      unitPrice: it.unitPrice,
    })),
    expectedDate: expectedDate.value || undefined,
    remark: remark.value || undefined,
  }
  submitting.value = true
  try {
    // 后端流转：创建为 DRAFT，需再调 submit 进入待审核（与按钮"提交调拨单"语义一致）
    const created = await transferApi.create(payload)
    try {
      await transferApi.submit(created.transferOrderId)
      uni.showToast({ title: '已提交，待审核', icon: 'success' })
    } catch {
      uni.showToast({ title: '已存草稿，可在列表中重新提交', icon: 'none', duration: 2500 })
    }
    setTimeout(() => uni.navigateBack(), 1200)
  } catch (err) {
    // request 层已 toast 具体原因
  } finally {
    submitting.value = false
  }
}

async function loadStores() {
  try {
    const res = await storesApi.list({ pageSize: 200 })
    stores.value = res.list
  } catch (err) {
    console.error('加载门店失败:', err)
  }
}
async function loadProducts() {
  try {
    const res = await productsApi.list({ pageSize: 200 })
    products.value = res.list
  } catch (err) {
    console.error('加载商品失败:', err)
  }
}

onLoad(() => {
  loadStores()
  loadProducts()
  // 本地时区当天（toISOString 是 UTC，晚间会变成明天）
  const now = new Date()
  expectedDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
})
</script>

<style lang="scss" scoped>
.create-page {
  min-height: 100vh;
  background: $uni-bg-color-grey;
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}
.form-container { padding: $uni-spacing-base; }
.form-item {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-md;
}
.form-label { font-size: 28rpx; color: $uni-gray-700; margin-bottom: $uni-spacing-sm; display: block; }
.required { color: $uni-color-error; }
.item-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: $uni-spacing-sm; }
.add-link { font-size: 26rpx; color: $uni-color-primary; }
.picker-value {
  display: flex; justify-content: space-between; align-items: center;
  height: 80rpx; background: $uni-bg-color-grey; border-radius: $uni-border-radius-xs; padding: 0 $uni-spacing-md;
}
.picker-value--sm { height: 72rpx; }
.picker-text { font-size: 28rpx; color: $uni-gray-700; }
.picker-arrow { font-size: 24rpx; color: $uni-gray-400; }
.goods-line { display: flex; align-items: center; gap: $uni-spacing-sm; margin-top: $uni-spacing-sm; }
.goods-line .picker-value { flex: 1; }
.qty-wrap {
  display: flex; align-items: center;
  background: $uni-bg-color-grey; border-radius: $uni-border-radius-xs; padding: 0 $uni-spacing-sm;
}
.qty-input { width: 120rpx; height: 72rpx; font-size: 28rpx; text-align: right; }
.qty-unit { font-size: 24rpx; color: $uni-gray-400; margin-left: 8rpx; }
.line-del { font-size: 26rpx; color: $uni-color-error; padding: $uni-spacing-xs; }
.remark-input {
  width: 100%; height: 160rpx; background: $uni-bg-color-grey; border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-md; font-size: 28rpx;
}
.submit-btn {
  position: fixed; left: 24rpx; right: 24rpx; bottom: calc(40rpx + env(safe-area-inset-bottom));
  height: 96rpx; background: $uni-color-primary; border-radius: 48rpx;
  display: flex; align-items: center; justify-content: center;
}
.submit-btn.disabled { background: $uni-gray-300; }
.submit-text { font-size: 32rpx; font-weight: 600; color: $uni-text-color-inverse; }
</style>
