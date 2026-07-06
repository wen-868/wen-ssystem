<template>
  <view class="create-sale-page">
    <!-- 顶部栏 -->
    <view class="page-header">
      <text class="header-title">开单</text>
    </view>

    <!-- 表单三件套：ref + :model + :rules -->
    <form ref="formRef" :model="saleForm" :rules="saleRules" class="sale-form-scroll">
      <scroll-view class="sale-form" scroll-y>
      <!-- 客户选择 -->
      <view class="form-section">
        <view class="section-title">选择客户</view>
        <view class="customer-select" @tap="showCustomerPicker">
          <text class="customer-name" v-if="selectedCustomer">{{ selectedCustomer.name }}</text>
          <text class="customer-placeholder" v-else>请选择客户</text>
          <text class="customer-arrow">&#xe616;</text>
        </view>
        <view class="field-error" v-if="errors.selectedCustomer">
          <text class="error-text">{{ errors.selectedCustomer }}</text>
        </view>
      </view>

      <!-- 商品列表 -->
      <view class="form-section">
        <view class="section-title">商品明细</view>
        <view class="item-row" v-for="(item, index) in saleItems" :key="index">
          <view class="item-info">
            <text class="item-name">{{ item.productName }}</text>
            <text class="item-price">¥{{ (item.price ?? 0).toFixed(2) }}</text>
          </view>
          <view class="item-quantity">
            <view class="qty-btn" @tap="decreaseQty(index)">-</view>
            <input
              class="qty-input"
              v-model="item.quantity"
              type="number"
              @input="onQtyChange(index)"
            />
            <view class="qty-btn" @tap="increaseQty(index)">+</view>
          </view>
          <text class="item-total">¥{{ (item.total ?? 0).toFixed(2) }}</text>
          <view class="item-delete" @tap="removeItem(index)">&#xe615;</view>
        </view>

        <view class="add-item-btn" @tap="showProductPicker">
          <text class="add-icon">+</text>
          <text class="add-text">添加商品</text>
        </view>
        <view class="field-error" v-if="errors.saleItems">
          <text class="error-text">{{ errors.saleItems }}</text>
        </view>
      </view>

      <!-- 金额汇总 -->
      <view class="form-section" v-if="saleItems.length > 0">
        <view class="amount-row">
          <text class="amount-label">合计金额</text>
          <text class="amount-value">¥{{ totalAmount.toFixed(2) }}</text>
        </view>
      </view>

      <!-- 备注 -->
      <view class="form-section">
        <view class="section-title">备注</view>
        <textarea
          class="remark-input"
          v-model="remark"
          placeholder="请输入备注信息（选填）"
          placeholder-class="remark-placeholder"
        />
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>
    </form>

    <!-- 底部提交 -->
    <view class="bottom-bar">
      <view class="bottom-total" v-if="saleItems.length > 0">
        <text class="total-label">合计：</text>
        <text class="total-value">¥{{ totalAmount.toFixed(2) }}</text>
      </view>
      <button
        class="submit-btn"
        :disabled="!canSubmit || submitting"
        :class="{ 'submit-btn--disabled': !canSubmit }"
        @tap="handleSubmit"
      >
        {{ submitting ? '提交中...' : '提交订单' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { salesApi, type SaleItem } from '@/api/modules/sales'
import { customersApi, type CustomerInfo } from '@/api/modules/customers'
import { productsApi, type ProductInfo } from '@/api/modules/products'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

// 表单三件套：ref + :model + :rules
const formRef = ref<any>(null)
const saleForm = reactive({
  selectedCustomer: null as CustomerInfo | null,
  saleItems: [] as SaleItem[],
  remark: '',
})

const saleRules: Rules = {
  selectedCustomer: [{ required: true, message: '请选择客户' }],
  saleItems: [{ required: true, message: '请至少添加一个商品' }],
}

const { errors, validate, clearError } = useFormValidation(saleForm, saleRules)

// 兼容原有变量名
const selectedCustomer = computed(() => saleForm.selectedCustomer)
const saleItems = saleForm.saleItems
const remark = computed({
  get: () => saleForm.remark,
  set: (v) => saleForm.remark = v,
})

const submitting = ref(false)

const totalAmount = computed(() => {
  return saleItems.reduce((sum, item) => sum + (item.total ?? 0), 0)
})

const canSubmit = computed(() => {
  return saleForm.selectedCustomer !== null && saleItems.length > 0 && !submitting.value
})

function showCustomerPicker() {
  // 模拟选择客户 - 实际项目中应跳转到客户选择页或弹窗
  clearError('selectedCustomer')
  uni.showToast({ title: '请从客户列表选择', icon: 'none' })
}

function showProductPicker() {
  // 模拟选择商品 - 实际项目中应跳转到商品选择页或弹窗
  uni.showToast({ title: '请从商品列表选择', icon: 'none' })
}

function decreaseQty(index: number) {
  const item = saleItems[index]!
  if ((item.quantity ?? 0) > 1) {
    item.quantity = (item.quantity ?? 0) - 1
    item.total = (item.price ?? 0) * (item.quantity ?? 0)
  }
}

function increaseQty(index: number) {
  const item = saleItems[index]!
  item.quantity = (item.quantity ?? 0) + 1
  item.total = (item.price ?? 0) * (item.quantity ?? 0)
}

function onQtyChange(index: number) {
  const item = saleItems[index]!
  const qty = Math.max(1, Number(item.quantity) || 1)
  item.quantity = qty
  item.total = (item.price ?? 0) * qty
}

function removeItem(index: number) {
  saleItems.splice(index, 1)
}

async function handleSubmit() {
  // 表单校验
  if (!validate()) return
  if (!canSubmit.value) return
  submitting.value = true
  try {
    await salesApi.createSale({
      customerId: selectedCustomer.value!.id,
      customerName: selectedCustomer.value!.name,
      customerMobile: selectedCustomer.value!.phone,
      items: saleItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        boxQty: item.boxQty,
        bottleQty: item.bottleQty,
        unitPrice: item.unitPrice,
        subtotalAmount: item.subtotalAmount
      })),
      remark: remark.value || undefined
    })
    uni.showToast({ title: '开单成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch (err) {
    uni.showToast({ title: '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.create-sale-page {
  min-height: 100vh;
  background: #f0f5ff;
  display: flex;
  flex-direction: column;
}

.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #333;
}

.sale-form {
  flex: 1;
  padding-bottom: 160rpx;
}

.form-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 16rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
}

.customer-select {
  display: flex;
  align-items: center;
  height: 80rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 0 24rpx;
}

.customer-name {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.customer-placeholder {
  flex: 1;
  font-size: 28rpx;
  color: #bbb;
}

.customer-arrow {
  font-size: 28rpx;
  color: #bbb;
}

/* 商品明细 */
.item-row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.item-row:last-child {
  border-bottom: none;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.item-name {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 4rpx;
}

.item-price {
  font-size: 24rpx;
  color: #999;
}

.item-quantity {
  display: flex;
  align-items: center;
  margin: 0 16rpx;
}

.qty-btn {
  width: 48rpx;
  height: 48rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #1677FF;
  font-weight: 600;
}

.qty-input {
  width: 80rpx;
  height: 48rpx;
  text-align: center;
  font-size: 28rpx;
  color: #333;
  margin: 0 8rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
}

.item-total {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  min-width: 120rpx;
  text-align: right;
  margin-right: 12rpx;
}

.item-delete {
  font-size: 32rpx;
  color: #ff4d4f;
  padding: 4rpx;
}

.add-item-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
  border: 2rpx dashed #d9d9d9;
  border-radius: 12rpx;
  margin-top: 16rpx;
}

.add-icon {
  font-size: 36rpx;
  color: #1677FF;
  margin-right: 8rpx;
}

.add-text {
  font-size: 28rpx;
  color: #1677FF;
}

/* 金额汇总 */
.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.amount-label {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}

.amount-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #1677FF;
}

/* 备注 */
.remark-input {
  width: 100%;
  height: 160rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.remark-placeholder {
  color: #bbb;
  font-size: 26rpx;
}

/* 底部提交栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.06);
  gap: 20rpx;
}

.bottom-total {
  flex: 1;
  display: flex;
  align-items: baseline;
}

.total-label {
  font-size: 26rpx;
  color: #666;
}

.total-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #1677FF;
}

.submit-btn {
  width: 220rpx;
  height: 80rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.submit-btn::after {
  border: none;
}

.submit-btn--disabled {
  opacity: 0.5;
}

.safe-bottom {
  height: 40rpx;
}

.field-error {
  margin-top: 8rpx;
  padding: 6rpx 0;
}

.error-text {
  font-size: 24rpx;
  color: #ff4d4f;
}
</style>