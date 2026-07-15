<template>
  <view class="aftersale-apply-page">
    <scroll-view scroll-y class="apply-scroll">
      <view class="form-section">
        <view class="section-title">
          <text class="title-text">售后类型</text>
        </view>
        <view class="type-list">
          <view
            class="type-item"
            :class="{ active: formData.type === item.value }"
            v-for="item in typeOptions"
            :key="item.value"
            @tap="selectType(item.value)"
          >
            <view class="type-icon">{{ item.icon }}</view>
            <view class="type-info">
              <text class="type-name">{{ item.label }}</text>
              <text class="type-desc">{{ item.desc }}</text>
            </view>
            <view class="type-check" v-if="formData.type === item.value">✓</view>
          </view>
        </view>
      </view>

      <view class="form-section">
        <view class="section-title">
          <text class="title-text">商品信息</text>
        </view>
        <view class="goods-card" v-if="orderInfo">
          <view class="goods-item" v-for="item in orderInfo.items" :key="item.id">
            <image :src="item.productImage" mode="aspectFill" class="goods-image" />
            <view class="goods-info">
              <text class="goods-name ellipsis-2">{{ item.productName }}</text>
              <text class="goods-sku" v-if="item.skuName">{{ item.skuName }}</text>
              <view class="goods-bottom">
                <text class="goods-price">¥{{ item.price.toFixed(2) }}</text>
                <text class="goods-qty">x{{ item.quantity }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="form-section">
        <view class="section-title">
          <text class="title-text">售后原因</text>
        </view>
        <view class="reason-list">
          <view
            class="reason-item"
            :class="{ active: formData.reason === item }"
            v-for="item in reasonOptions"
            :key="item"
            @tap="selectReason(item)"
          >
            <text>{{ item }}</text>
            <view class="reason-check" v-if="formData.reason === item">✓</view>
          </view>
        </view>
      </view>

      <view class="form-section">
        <view class="section-title">
          <text class="title-text">问题描述</text>
          <text class="title-optional">选填</text>
        </view>
        <view class="textarea-wrap">
          <textarea
            class="textarea"
            v-model="formData.description"
            placeholder="请详细描述您遇到的问题，以便我们更好地为您处理"
            maxlength="500"
          />
          <text class="textarea-count">{{ formData.description?.length || 0 }}/500</text>
        </view>
      </view>

      <view class="form-section">
        <view class="section-title">
          <text class="title-text">上传凭证</text>
          <text class="title-optional">选填</text>
        </view>
        <view class="upload-list">
          <view class="upload-item" v-for="(img, index) in formData.images" :key="index">
            <image :src="img" mode="aspectFill" class="upload-image" />
            <view class="upload-delete" @tap="removeImage(index)">×</view>
          </view>
          <view class="upload-add" v-if="formData.images.length < 9" @tap="chooseImage">
            <text class="add-icon">+</text>
            <text class="add-text">上传图片</text>
          </view>
        </view>
        <text class="upload-tip">最多上传9张图片，支持jpg、png格式</text>
      </view>

      <view class="form-section refund-section" v-if="formData.type === 'REFUND' || formData.type === 'RETURN'">
        <view class="section-title">
          <text class="title-text">退款金额</text>
        </view>
        <view class="refund-amount">
          <text class="amount-label">预计退款</text>
          <text class="amount-value">¥{{ refundAmount.toFixed(2) }}</text>
        </view>
      </view>

      <view class="bottom-space"></view>
    </scroll-view>

    <view class="submit-bar">
      <view class="submit-btn" :class="{ disabled: !canSubmit }" @tap="handleSubmit">
        提交申请
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { aftersaleApi, type AftersaleType } from '@/api/aftersale'
import { orderApi, type OrderInfo } from '@/api/order'

const router = useRouter()

const typeOptions = [
  { value: 'REFUND' as AftersaleType, label: '退款', desc: '无需退货，直接退款', icon: '💰' },
  { value: 'RETURN' as AftersaleType, label: '退货退款', desc: '将商品寄回，退款处理', icon: '📦' },
  { value: 'EXCHANGE' as AftersaleType, label: '换货', desc: '更换商品，重新发货', icon: '🔄' }
]

const reasonOptions = [
  '商品质量问题',
  '商品与描述不符',
  '发错货/漏发货',
  '商品损坏',
  '不喜欢/不想要',
  '尺寸/规格不合适',
  '其他原因'
]

const formData = ref({
  type: 'REFUND' as AftersaleType,
  reason: '',
  description: '',
  images: [] as string[]
})

const orderInfo = ref<OrderInfo | null>(null)
const submitting = ref(false)

const refundAmount = computed(() => {
  if (!orderInfo.value) return 0
  return orderInfo.value.payAmount
})

const canSubmit = computed(() => {
  return formData.value.reason && !submitting.value
})

const selectType = (type: AftersaleType) => {
  formData.value.type = type
}

const selectReason = (reason: string) => {
  formData.value.reason = reason
}

const chooseImage = () => {
  Taro.chooseImage({
    count: 9 - formData.value.images.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      formData.value.images = [...formData.value.images, ...res.tempFilePaths]
    }
  })
}

const removeImage = (index: number) => {
  formData.value.images.splice(index, 1)
}

const loadOrderInfo = async () => {
  const orderId = Number(router.params.orderId)
  if (!orderId) return

  try {
    const result = await orderApi.getOrderDetail(orderId)
    orderInfo.value = result
  } catch (error) {
    console.error('加载订单信息失败:', error)
    orderInfo.value = {
      id: orderId,
      orderNo: 'SO' + Date.now(),
      status: 'COMPLETED',
      statusText: '已完成',
      totalAmount: 199,
      goodsAmount: 199,
      shippingFee: 0,
      discountAmount: 0,
      couponDiscount: 0,
      payAmount: 199,
      createTime: '2026-07-15 14:30:00',
      updateTime: '2026-07-15 14:30:00',
      items: [
        {
          id: 1,
          productId: 1,
          productName: '示例商品名称示例商品名称示例商品名称',
          productImage: 'https://via.placeholder.com/200',
          price: 99.5,
          quantity: 2,
          subtotal: 199
        }
      ]
    }
  }
}

const handleSubmit = async () => {
  if (!canSubmit.value) return

  const orderId = Number(router.params.orderId)
  if (!orderId) {
    Taro.showToast({ title: '订单信息错误', icon: 'none' })
    return
  }

  submitting.value = true

  try {
    await aftersaleApi.applyAftersale({
      orderId,
      type: formData.value.type,
      reason: formData.value.reason,
      description: formData.value.description,
      images: formData.value.images
    })

    Taro.showToast({ title: '提交成功', icon: 'success' })
    setTimeout(() => {
      Taro.redirectTo({ url: '/pages/aftersale/list' })
    }, 1500)
  } catch (error) {
    console.error('提交售后申请失败:', error)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadOrderInfo()
})
</script>

<style lang="scss" scoped>
.aftersale-apply-page {
  height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

.apply-scroll {
  flex: 1;
  height: 0;
}

.form-section {
  background-color: $bg-primary;
  margin-bottom: $spacing-md;
  padding: $spacing-md;
}

.section-title {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-md;
}

.title-text {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
}

.title-optional {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-left: $spacing-xs;
}

.type-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.type-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border: 2rpx solid $border-color;
  border-radius: $radius-md;
  transition: all 0.3s ease;

  &.active {
    border-color: $primary-color;
    background-color: $primary-bg;
  }
}

.type-icon {
  font-size: 48rpx;
  margin-right: $spacing-md;
}

.type-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.type-name {
  font-size: $font-size-base;
  font-weight: 500;
  color: $text-primary;
  margin-bottom: 4rpx;
}

.type-desc {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.type-check {
  width: 40rpx;
  height: 40rpx;
  background-color: $primary-color;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-sm;
}

.goods-card {
  background-color: $bg-secondary;
  border-radius: $radius-sm;
  padding: $spacing-md;
}

.goods-item {
  display: flex;
  margin-bottom: $spacing-md;

  &:last-child {
    margin-bottom: 0;
  }
}

.goods-image {
  width: 140rpx;
  height: 140rpx;
  border-radius: $radius-sm;
  flex-shrink: 0;
}

.goods-info {
  flex: 1;
  margin-left: $spacing-md;
  display: flex;
  flex-direction: column;
}

.goods-name {
  font-size: $font-size-sm;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.goods-sku {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-bottom: $spacing-sm;
}

.goods-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.goods-price {
  font-size: $font-size-base;
  color: $text-primary;
  font-weight: 500;
}

.goods-qty {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.reason-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.reason-item {
  padding: $spacing-sm $spacing-md;
  background-color: $bg-secondary;
  border-radius: $radius-lg;
  font-size: $font-size-sm;
  color: $text-secondary;
  position: relative;

  &.active {
    background-color: $primary-bg;
    color: $primary-color;
    border: 1rpx solid $primary-color;
  }
}

.reason-check {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  width: 28rpx;
  height: 28rpx;
  background-color: $primary-color;
  color: #fff;
  border-radius: 50%;
  font-size: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.textarea-wrap {
  background-color: $bg-secondary;
  border-radius: $radius-sm;
  padding: $spacing-md;
  position: relative;
}

.textarea {
  width: 100%;
  height: 200rpx;
  font-size: $font-size-sm;
  color: $text-primary;
  line-height: 1.5;
}

.textarea-count {
  position: absolute;
  right: $spacing-md;
  bottom: $spacing-sm;
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.upload-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.upload-item {
  position: relative;
  width: 160rpx;
  height: 160rpx;
}

.upload-image {
  width: 100%;
  height: 100%;
  border-radius: $radius-sm;
}

.upload-delete {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  width: 36rpx;
  height: 36rpx;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-base;
  line-height: 1;
}

.upload-add {
  width: 160rpx;
  height: 160rpx;
  background-color: $bg-secondary;
  border-radius: $radius-sm;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2rpx dashed $border-color;
}

.add-icon {
  font-size: 48rpx;
  color: $text-tertiary;
  line-height: 1;
}

.add-text {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-top: $spacing-xs;
}

.upload-tip {
  font-size: $font-size-xs;
  color: $text-tertiary;
  margin-top: $spacing-sm;
}

.refund-section {
  margin-bottom: 0;
}

.refund-amount {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  background-color: $bg-secondary;
  border-radius: $radius-sm;
}

.amount-label {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.amount-value {
  font-size: $font-size-xl;
  color: $error-color;
  font-weight: bold;
}

.bottom-space {
  height: 140rpx;
}

.submit-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: $bg-primary;
  padding: $spacing-md;
  padding-bottom: calc(#{$spacing-md} + env(safe-area-inset-bottom));
  border-top: 1rpx solid $border-color;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  background-color: $primary-color;
  color: #fff;
  border-radius: $radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-base;
  font-weight: 500;

  &.disabled {
    background-color: $border-color;
    color: $text-tertiary;
  }
}

.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
