<template>
  <view class="create-gain-page">
    <!-- 报溢原因 -->
    <view class="form-section">
      <view class="section-title">报溢原因 <text class="required">*</text></view>
      <view class="reason-grid">
        <view
          class="reason-item"
          v-for="item in gainReasons"
          :key="item.value"
          :class="{ active: formData.reason === item.value }"
          @tap="formData.reason = item.value"
        >
          <text class="reason-text">{{ item.label }}</text>
        </view>
      </view>
    </view>

    <!-- 商品明细 -->
    <view class="form-section">
      <view class="section-header">
        <text class="section-title">商品明细 <text class="required">*</text></text>
        <text class="add-btn" @tap="showProductPicker = true">+ 添加商品</text>
      </view>

      <view class="goods-list" v-if="selectedProducts.length > 0">
        <view class="goods-item" v-for="(item, index) in selectedProducts" :key="item.skuId">
          <view class="goods-info">
            <text class="goods-name">{{ item.skuName }}</text>
            <text class="goods-remove" @tap="removeProduct(index)">删除</text>
          </view>
          <view class="goods-qty-row">
            <text class="qty-label">报溢数量</text>
            <view class="qty-stepper">
              <view class="qty-btn" @tap="decreaseQty(index)">
                <text>-</text>
              </view>
              <input class="qty-input" type="number" v-model="item.quantity" />
              <view class="qty-btn qty-btn--plus" @tap="increaseQty(index)">
                <text>+</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="empty-goods" v-else @tap="showProductPicker = true">
        <text class="empty-icon">+</text>
        <text class="empty-text">点击添加商品</text>
      </view>
    </view>

    <!-- 备注说明 -->
    <view class="form-section">
      <view class="section-title">备注说明</view>
      <textarea
        class="remark-input"
        v-model="formData.remark"
        placeholder="请输入备注说明"
        maxlength="500"
      />
      <text class="remark-count">{{ formData.remark.length }}/500</text>
    </view>

    <!-- 提交按钮 -->
    <view class="bottom-bar">
      <view class="submit-btn" :class="{ disabled: !canSubmit }" @tap="onSubmit">
        <text class="submit-text">提交报溢单</text>
      </view>
    </view>

    <!-- 商品选择弹窗 -->
    <view class="picker-mask" v-if="showProductPicker" @tap="showProductPicker = false">
      <view class="picker-panel" @tap.stop>
        <view class="picker-header">
          <text class="picker-title">选择商品</text>
          <text class="picker-close" @tap="showProductPicker = false">×</text>
        </view>
        <view class="picker-search">
          <input class="picker-search-input" v-model="searchKeyword" placeholder="搜索商品名称" />
        </view>
        <scroll-view class="picker-list" scroll-y>
          <view
            class="picker-item"
            v-for="item in filteredProducts"
            :key="item.id"
            @tap="toggleProduct(item)"
          >
            <view class="picker-check" :class="{ checked: isSelected(item.id) }">
              <text v-if="isSelected(item.id)">✓</text>
            </view>
            <view class="picker-info">
              <text class="picker-name">{{ item.name }}</text>
              <text class="picker-spec">{{ item.spec }}</text>
            </view>
          </view>
        </scroll-view>
        <view class="picker-footer">
          <text class="picker-count">已选 {{ tempSelected.length }} 件</text>
          <view class="picker-confirm" @tap="confirmProductSelection">确定</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { inventoryLossGainApi, GAIN_REASONS } from '@/api/modules/inventory-loss-gain'
import { productsApi } from '@/api/modules/products'

const gainReasons = GAIN_REASONS

interface SelectedProduct {
  skuId: number
  skuName: string
  quantity: string
}

const formData = reactive({
  reason: '',
  remark: '',
})

const selectedProducts = ref<SelectedProduct[]>([])
const showProductPicker = ref(false)
const searchKeyword = ref('')
const tempSelected = ref<number[]>([])

// 商品列表从API加载
const productList = ref<Array<{ id: number; name: string; spec: string }>>([])

async function loadProducts() {
  try {
    const res = await productsApi.list({ page: 1, pageSize: 100 })
    productList.value = (res.list || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      spec: p.specs || p.unit || '',
    }))
  } catch (err) {
    console.error('加载商品列表失败:', err)
    productList.value = []
  }
}

onMounted(() => {
  loadProducts()
})

const filteredProducts = computed(() => {
  if (!searchKeyword.value) return productList.value
  const kw = searchKeyword.value.toLowerCase()
  return productList.value.filter(p => p.name.toLowerCase().includes(kw))
})

const canSubmit = computed(() => {
  return formData.reason &&
    selectedProducts.value.length > 0 &&
    selectedProducts.value.every(p => Number(p.quantity) > 0)
})

function isSelected(id: number): boolean {
  return tempSelected.value.includes(id)
}

function toggleProduct(product: { id: number; name: string }) {
  const idx = tempSelected.value.indexOf(product.id)
  if (idx > -1) {
    tempSelected.value.splice(idx, 1)
  } else {
    tempSelected.value.push(product.id)
  }
}

function confirmProductSelection() {
  // 添加新选中的商品
  for (const id of tempSelected.value) {
    const exists = selectedProducts.value.find(p => p.skuId === id)
    if (!exists) {
      const product = productList.value.find(p => p.id === id)
      if (product) {
        selectedProducts.value.push({
          skuId: product.id,
          skuName: product.name,
          quantity: '1',
        })
      }
    }
  }
  // 移除取消选中的商品
  selectedProducts.value = selectedProducts.value.filter(p => tempSelected.value.includes(p.skuId))
  showProductPicker.value = false
}

function removeProduct(index: number) {
  selectedProducts.value.splice(index, 1)
}

function increaseQty(index: number) {
  const qty = Number(selectedProducts.value[index].quantity) || 0
  selectedProducts.value[index].quantity = String(qty + 1)
}

function decreaseQty(index: number) {
  const qty = Number(selectedProducts.value[index].quantity) || 0
  if (qty > 1) {
    selectedProducts.value[index].quantity = String(qty - 1)
  }
}

async function onSubmit() {
  if (!canSubmit.value) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }

  try {
    await inventoryLossGainApi.createGain({
      reason: formData.reason,
      remark: formData.remark,
      items: selectedProducts.value.map(p => ({
        skuId: p.skuId,
        quantity: Number(p.quantity),
      })),
    })
    uni.showToast({ title: '提交成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch (err) {
    console.error('提交失败:', err)
    uni.showToast({ title: '提交失败，请重试', icon: 'none' })
  }
}
</script>

<style scoped>
.create-gain-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

.form-section {
  background: #fff;
  margin: 20rpx 24rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
}

.section-header .section-title {
  margin-bottom: 0;
}

.required {
  color: #ff4d4f;
}

.add-btn {
  font-size: 26rpx;
  color: #52c41a;
}

/* 原因选择 */
.reason-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.reason-item {
  padding: 16rpx 32rpx;
  background: #f5f7fa;
  border-radius: 32rpx;
  border: 2rpx solid transparent;
}

.reason-item.active {
  background: #f6ffed;
  border-color: #52c41a;
}

.reason-text {
  font-size: 26rpx;
  color: #666;
}

.reason-item.active .reason-text {
  color: #52c41a;
  font-weight: 500;
}

/* 商品列表 */
.goods-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.goods-item {
  background: #f9f9f9;
  border-radius: 12rpx;
  padding: 20rpx;
}

.goods-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.goods-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  flex: 1;
}

.goods-remove {
  font-size: 24rpx;
  color: #ff4d4f;
  padding: 0 8rpx;
}

.goods-qty-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.qty-label {
  font-size: 26rpx;
  color: #666;
}

.qty-stepper {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 8rpx;
  border: 1rpx solid #e8e8e8;
}

.qty-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #666;
}

.qty-btn--plus {
  color: #52c41a;
}

.qty-input {
  width: 100rpx;
  height: 60rpx;
  text-align: center;
  font-size: 28rpx;
  border-left: 1rpx solid #e8e8e8;
  border-right: 1rpx solid #e8e8e8;
}

.empty-goods {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
  background: #f9f9f9;
  border-radius: 12rpx;
  border: 2rpx dashed #d9d9d9;
}

.empty-icon {
  font-size: 48rpx;
  color: #ccc;
  margin-bottom: 12rpx;
}

.empty-text {
  font-size: 26rpx;
  color: #999;
}

/* 备注 */
.remark-input {
  width: 100%;
  height: 200rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.remark-count {
  display: block;
  text-align: right;
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

/* 底部按钮 */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06);
}

.submit-btn {
  height: 88rpx;
  background: #52c41a;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-btn.disabled {
  background: #ccc;
}

.submit-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
}

/* 商品选择弹窗 */
.picker-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.picker-panel {
  width: 100%;
  max-height: 80vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.picker-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.picker-close {
  font-size: 40rpx;
  color: #999;
  padding: 0 16rpx;
}

.picker-search {
  padding: 16rpx 24rpx;
}

.picker-search-input {
  height: 72rpx;
  background: #f5f7fa;
  border-radius: 36rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}

.picker-list {
  flex: 1;
  max-height: 50vh;
  padding: 0 24rpx;
}

.picker-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.picker-check {
  width: 44rpx;
  height: 44rpx;
  border: 2rpx solid #d9d9d9;
  border-radius: 50%;
  margin-right: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #fff;
  flex-shrink: 0;
}

.picker-check.checked {
  background: #52c41a;
  border-color: #52c41a;
}

.picker-info {
  flex: 1;
}

.picker-name {
  font-size: 28rpx;
  color: #333;
  display: block;
  margin-bottom: 4rpx;
}

.picker-spec {
  font-size: 24rpx;
  color: #999;
}

.picker-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #f0f0f0;
}

.picker-count {
  font-size: 26rpx;
  color: #666;
}

.picker-confirm {
  padding: 16rpx 48rpx;
  background: #52c41a;
  border-radius: 32rpx;
  color: #fff;
  font-size: 28rpx;
  font-weight: 500;
}
</style>
