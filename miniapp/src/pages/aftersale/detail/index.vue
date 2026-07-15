<template>
  <view class="aftersale-detail-page">
    <scroll-view scroll-y class="detail-scroll">
      <view class="status-header" :style="{ background: getStatusGradient(aftersaleInfo.status) }">
        <text class="status-text">{{ getStatusText(aftersaleInfo.status) }}</text>
        <text class="status-desc" v-if="aftersaleInfo.status === 'PENDING'">商家正在处理，请耐心等待</text>
        <text class="status-desc" v-else-if="aftersaleInfo.status === 'PROCESSING'">售后处理中</text>
        <text class="status-desc" v-else-if="aftersaleInfo.status === 'COMPLETED'">售后已完成</text>
        <text class="status-desc" v-else-if="aftersaleInfo.status === 'REJECTED'">
          {{ aftersaleInfo.rejectReason || '售后申请被拒绝' }}
        </text>
      </view>

      <view class="progress-section">
        <view class="section-title">
          <text class="title-text">售后进度</text>
        </view>
        <view class="progress-timeline">
          <view
            class="progress-item"
            :class="{ active: index === 0, done: index > 0 }"
            v-for="(item, index) in progressList"
            :key="index"
          >
            <view class="progress-dot"></view>
            <view class="progress-line" v-if="index < progressList.length - 1"></view>
            <view class="progress-content">
              <text class="progress-title">{{ item.description }}</text>
              <text class="progress-time">{{ formatTime(item.time) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="goods-section">
        <view class="section-title">
          <text class="title-text">商品信息</text>
        </view>
        <view class="goods-list">
          <view class="goods-item" v-for="item in aftersaleInfo.items" :key="item.id">
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

      <view class="info-section">
        <view class="section-title">
          <text class="title-text">售后信息</text>
        </view>
        <view class="info-list">
          <view class="info-item">
            <text class="info-label">售后单号</text>
            <text class="info-value">{{ aftersaleInfo.aftersaleNo }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">售后类型</text>
            <text class="info-value">{{ getTypeText(aftersaleInfo.type) }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">售后原因</text>
            <text class="info-value">{{ aftersaleInfo.reason }}</text>
          </view>
          <view class="info-item" v-if="aftersaleInfo.description">
            <text class="info-label">问题描述</text>
            <text class="info-value desc">{{ aftersaleInfo.description }}</text>
          </view>
          <view class="info-item" v-if="aftersaleInfo.refundAmount">
            <text class="info-label">退款金额</text>
            <text class="info-value amount">¥{{ aftersaleInfo.refundAmount.toFixed(2) }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">申请时间</text>
            <text class="info-value">{{ formatTime(aftersaleInfo.applyTime) }}</text>
          </view>
        </view>
      </view>

      <view class="images-section" v-if="aftersaleInfo.images && aftersaleInfo.images.length > 0">
        <view class="section-title">
          <text class="title-text">凭证图片</text>
        </view>
        <view class="images-list">
          <image
            class="image-item"
            v-for="(img, index) in aftersaleInfo.images"
            :key="index"
            :src="img"
            mode="aspectFill"
            @tap="previewImage(index)"
          />
        </view>
      </view>

      <view class="bottom-space"></view>
    </scroll-view>

    <view class="action-bar" v-if="showActionBar">
      <view class="action-btn outline" @tap="contactService">
        联系客服
      </view>
      <view class="action-btn primary" v-if="aftersaleInfo.status === 'PENDING'" @tap="cancelAftersale">
        取消申请
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import {
  aftersaleApi,
  AFTERSALE_STATUS_TEXT,
  AFTERSALE_TYPE_TEXT,
  type AftersaleInfo,
  type AftersaleStatus,
  type AftersaleProgressItem
} from '@/api/aftersale'

const router = useRouter()

const aftersaleInfo = ref<AftersaleInfo>({
  id: 0,
  aftersaleNo: '',
  orderId: 0,
  orderNo: '',
  type: 'REFUND',
  status: 'PENDING',
  reason: '',
  images: [],
  applyTime: '',
  items: [],
  progress: []
})

const progressList = ref<AftersaleProgressItem[]>([])

const showActionBar = computed(() => {
  return ['PENDING', 'PROCESSING'].includes(aftersaleInfo.value.status)
})

const getStatusText = (status: AftersaleStatus): string => {
  return AFTERSALE_STATUS_TEXT[status] || status
}

const getTypeText = (type: string): string => {
  return AFTERSALE_TYPE_TEXT[type as keyof typeof AFTERSALE_TYPE_TEXT] || type
}

const getStatusGradient = (status: AftersaleStatus): string => {
  const gradients: Record<AftersaleStatus, string> = {
    PENDING: 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
    PROCESSING: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
    COMPLETED: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
    REJECTED: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
    CANCELLED: 'linear-gradient(135deg, #999999 0%, #bbbbbb 100%)'
  }
  return gradients[status] || gradients.PENDING
}

const formatTime = (time: string): string => {
  if (!time) return ''
  return time.replace('T', ' ').substring(0, 16)
}

const previewImage = (index: number) => {
  Taro.previewImage({
    current: aftersaleInfo.value.images[index],
    urls: aftersaleInfo.value.images
  })
}

const loadDetail = async () => {
  const id = Number(router.params.id)
  if (!id) return

  try {
    const result = await aftersaleApi.getAftersaleDetail(id)
    aftersaleInfo.value = result
    progressList.value = result.progress
  } catch (error) {
    console.error('加载售后详情失败:', error)
    aftersaleInfo.value = {
      id,
      aftersaleNo: 'AS20260715001',
      orderId: 1,
      orderNo: 'SO20260710001',
      type: 'REFUND',
      status: 'PROCESSING',
      reason: '商品质量问题',
      description: '收到的商品有瑕疵，要求退款处理',
      images: [],
      refundAmount: 199,
      applyTime: '2026-07-15 14:30:00',
      processTime: '2026-07-15 16:00:00',
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
      ],
      progress: [
        { id: 1, status: 'APPLIED', description: '提交售后申请', time: '2026-07-15 14:30:00' },
        { id: 2, status: 'PROCESSING', description: '商家正在处理', time: '2026-07-15 16:00:00' }
      ]
    }
    progressList.value = aftersaleInfo.value.progress
  }
}

const cancelAftersale = () => {
  Taro.showModal({
    title: '提示',
    content: '确定要取消这个售后申请吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await aftersaleApi.cancelAftersale(aftersaleInfo.value.id)
          Taro.showToast({ title: '取消成功', icon: 'success' })
          setTimeout(() => {
            Taro.navigateBack()
          }, 1500)
        } catch (error) {
          console.error('取消售后申请失败:', error)
        }
      }
    }
  })
}

const contactService = () => {
  Taro.showToast({ title: '客服功能开发中', icon: 'none' })
}

onMounted(() => {
  loadDetail()
})
</script>

<style lang="scss" scoped>
.aftersale-detail-page {
  height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

.detail-scroll {
  flex: 1;
  height: 0;
}

.status-header {
  padding: $spacing-xl $spacing-md;
  color: #fff;
}

.status-text {
  display: block;
  font-size: $font-size-xl;
  font-weight: bold;
  margin-bottom: $spacing-sm;
}

.status-desc {
  font-size: $font-size-sm;
  opacity: 0.9;
}

.progress-section,
.goods-section,
.info-section,
.images-section {
  background-color: $bg-primary;
  margin: $spacing-md;
  border-radius: $radius-lg;
  padding: $spacing-lg;
}

.section-title {
  margin-bottom: $spacing-md;
}

.title-text {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
}

.progress-timeline {
  position: relative;
  padding-left: $spacing-md;
}

.progress-item {
  position: relative;
  padding-bottom: $spacing-lg;
  padding-left: $spacing-lg;

  &:last-child {
    padding-bottom: 0;
  }

  &.active .progress-dot {
    background-color: $primary-color;
    box-shadow: 0 0 0 6rpx rgba(91, 106, 191, 0.2);
  }

  &.done .progress-dot {
    background-color: $success-color;
  }

  &.done .progress-line {
    background-color: $success-color;
  }
}

.progress-dot {
  position: absolute;
  left: 0;
  top: 4rpx;
  width: 20rpx;
  height: 20rpx;
  background-color: $border-color;
  border-radius: 50%;
  z-index: 1;
}

.progress-line {
  position: absolute;
  left: 9rpx;
  top: 24rpx;
  width: 2rpx;
  height: calc(100% - 16rpx);
  background-color: $border-color;
}

.progress-content {
  display: flex;
  flex-direction: column;
}

.progress-title {
  font-size: $font-size-sm;
  color: $text-primary;
  margin-bottom: 4rpx;
}

.progress-time {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.goods-list {
  display: flex;
  flex-direction: column;
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

.info-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.info-label {
  font-size: $font-size-sm;
  color: $text-tertiary;
  flex-shrink: 0;
  margin-right: $spacing-md;
}

.info-value {
  font-size: $font-size-sm;
  color: $text-primary;
  text-align: right;
  flex: 1;

  &.desc {
    text-align: left;
    line-height: 1.5;
  }

  &.amount {
    color: $error-color;
    font-weight: bold;
    font-size: $font-size-base;
  }
}

.images-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.image-item {
  width: 160rpx;
  height: 160rpx;
  border-radius: $radius-sm;
}

.bottom-space {
  height: 140rpx;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: $bg-primary;
  padding: $spacing-md;
  padding-bottom: calc(#{$spacing-md} + env(safe-area-inset-bottom));
  border-top: 1rpx solid $border-color;
  display: flex;
  gap: $spacing-md;
}

.action-btn {
  flex: 1;
  height: 80rpx;
  border-radius: $radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-base;

  &.outline {
    background-color: $bg-primary;
    border: 1rpx solid $border-color;
    color: $text-secondary;
  }

  &.primary {
    background-color: $primary-color;
    color: #fff;
  }
}

.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
