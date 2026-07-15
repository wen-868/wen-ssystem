<template>
  <view class="aftersale-list-page">
    <scroll-view scroll-x class="status-tabs" :show-scrollbar="false">
      <view
        class="tab-item"
        v-for="tab in statusTabs"
        :key="tab.value"
        :class="{ active: currentStatus === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
        <view class="tab-line" v-if="currentStatus === tab.value"></view>
      </view>
    </scroll-view>

    <scroll-view
      scroll-y
      class="aftersale-list"
      @scrolltolower="loadMore"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="empty-state" v-if="aftersaleList.length === 0 && !loading">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无售后订单</text>
      </view>

      <view class="aftersale-cards" v-else>
        <view
          class="aftersale-card"
          v-for="item in aftersaleList"
          :key="item.id"
          @tap="goDetail(item.id)"
        >
          <view class="card-header">
            <text class="aftersale-no">售后单号：{{ item.aftersaleNo }}</text>
            <text class="aftersale-status" :style="{ color: getStatusColor(item.status) }">
              {{ getStatusText(item.status) }}
            </text>
          </view>

          <view class="goods-list">
            <view class="goods-item" v-for="goods in item.items.slice(0, 2)" :key="goods.id">
              <image :src="goods.productImage" mode="aspectFill" class="goods-image" />
              <view class="goods-info">
                <text class="goods-name ellipsis-2">{{ goods.productName }}</text>
                <text class="goods-sku" v-if="goods.skuName">{{ goods.skuName }}</text>
                <view class="goods-bottom">
                  <text class="goods-price">¥{{ goods.price.toFixed(2) }}</text>
                  <text class="goods-qty">x{{ goods.quantity }}</text>
                </view>
              </view>
            </view>
          </view>

          <view class="card-footer">
            <text class="type-text">
              售后类型：{{ getTypeText(item.type) }}
            </text>
            <text class="refund-amount" v-if="item.refundAmount">
              退款金额：¥{{ item.refundAmount.toFixed(2) }}
            </text>
          </view>

          <view class="card-actions">
            <view
              class="action-btn outline"
              v-if="item.status === 'PENDING'"
              @tap.stop="cancelAftersale(item.id)"
            >
              取消申请
            </view>
            <view
              class="action-btn primary"
              v-if="item.status === 'PENDING' || item.status === 'PROCESSING'"
              @tap.stop="contactService"
            >
              联系客服
            </view>
          </view>
        </view>
      </view>

      <view class="load-more" v-if="loading && aftersaleList.length > 0">
        <text class="loading-text">加载中...</text>
      </view>

      <view class="no-more" v-if="!hasMore && aftersaleList.length > 0">
        <text class="no-more-text">没有更多了</text>
      </view>

      <view class="list-bottom" v-if="aftersaleList.length > 0"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import {
  aftersaleApi,
  AFTERSALE_STATUS_TEXT,
  AFTERSALE_STATUS_COLOR,
  AFTERSALE_TYPE_TEXT,
  type AftersaleInfo,
  type AftersaleStatus
} from '@/api/aftersale'

const router = useRouter()

const statusTabs = [
  { label: '全部', value: 'ALL' },
  { label: '处理中', value: 'PROCESSING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已拒绝', value: 'REJECTED' }
]

const currentStatus = ref<string>('ALL')
const aftersaleList = ref<AftersaleInfo[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const isRefreshing = ref(false)

const hasMore = computed(() => {
  return aftersaleList.value.length < total.value
})

const getStatusText = (status: AftersaleStatus): string => {
  return AFTERSALE_STATUS_TEXT[status] || status
}

const getStatusColor = (status: AftersaleStatus): string => {
  return AFTERSALE_STATUS_COLOR[status] || '#333'
}

const getTypeText = (type: string): string => {
  return AFTERSALE_TYPE_TEXT[type as keyof typeof AFTERSALE_TYPE_TEXT] || type
}

const loadAftersaleList = async (isRefresh = false) => {
  if (loading.value) return

  if (isRefresh) {
    page.value = 1
    aftersaleList.value = []
  }

  loading.value = true

  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value
    }

    if (currentStatus.value !== 'ALL') {
      params.status = currentStatus.value
    }

    const result = await aftersaleApi.getAftersaleList(params as any)

    if (isRefresh) {
      aftersaleList.value = result.list
    } else {
      aftersaleList.value = [...aftersaleList.value, ...result.list]
    }
    total.value = result.total
  } catch (error) {
    console.error('加载售后列表失败:', error)
    const mockList: AftersaleInfo[] = [
      {
        id: 1,
        aftersaleNo: 'AS20260715001',
        orderId: 1,
        orderNo: 'SO20260710001',
        type: 'REFUND',
        status: 'PENDING',
        reason: '商品质量问题',
        description: '收到的商品有瑕疵',
        images: [],
        refundAmount: 199,
        applyTime: '2026-07-15 14:30:00',
        items: [
          {
            id: 1,
            productId: 1,
            productName: '示例商品名称示例商品名称',
            productImage: 'https://via.placeholder.com/200',
            price: 99.5,
            quantity: 2,
            subtotal: 199
          }
        ],
        progress: []
      },
      {
        id: 2,
        aftersaleNo: 'AS20260714002',
        orderId: 2,
        orderNo: 'SO20260708002',
        type: 'RETURN',
        status: 'PROCESSING',
        reason: '商品与描述不符',
        description: '',
        images: [],
        refundAmount: 299,
        applyTime: '2026-07-14 10:20:00',
        items: [
          {
            id: 2,
            productId: 2,
            productName: '退货商品示例名称',
            productImage: 'https://via.placeholder.com/200',
            price: 299,
            quantity: 1,
            subtotal: 299
          }
        ],
        progress: []
      },
      {
        id: 3,
        aftersaleNo: 'AS20260710003',
        orderId: 3,
        orderNo: 'SO20260705003',
        type: 'EXCHANGE',
        status: 'COMPLETED',
        reason: '尺寸不合适',
        description: '',
        images: [],
        applyTime: '2026-07-10 16:00:00',
        completeTime: '2026-07-12 09:00:00',
        items: [
          {
            id: 3,
            productId: 3,
            productName: '换货商品示例',
            productImage: 'https://via.placeholder.com/200',
            price: 159,
            quantity: 1,
            subtotal: 159
          }
        ],
        progress: []
      },
      {
        id: 4,
        aftersaleNo: 'AS20260708004',
        orderId: 4,
        orderNo: 'SO20260701004',
        type: 'REFUND',
        status: 'REJECTED',
        reason: '不喜欢/不想要',
        description: '',
        images: [],
        applyTime: '2026-07-08 11:30:00',
        rejectReason: '商品已使用，影响二次销售',
        items: [
          {
            id: 4,
            productId: 4,
            productName: '被拒绝的售后商品',
            productImage: 'https://via.placeholder.com/200',
            price: 89,
            quantity: 1,
            subtotal: 89
          }
        ],
        progress: []
      }
    ]

    const filtered = mockList.filter(item => {
      if (currentStatus.value === 'ALL') return true
      return item.status === currentStatus.value
    })

    if (isRefresh) {
      aftersaleList.value = filtered
    } else {
      aftersaleList.value = [...aftersaleList.value, ...filtered]
    }
    total.value = filtered.length
  } finally {
    loading.value = false
    isRefreshing.value = false
  }
}

const switchTab = (status: string) => {
  if (currentStatus.value === status) return
  currentStatus.value = status
  page.value = 1
  aftersaleList.value = []
  loadAftersaleList(true)
}

const onRefresh = () => {
  isRefreshing.value = true
  loadAftersaleList(true)
}

const loadMore = () => {
  if (!hasMore.value || loading.value) return
  page.value++
  loadAftersaleList()
}

const goDetail = (id: number) => {
  Taro.navigateTo({ url: `/pages/aftersale/detail?id=${id}` })
}

const cancelAftersale = (id: number) => {
  Taro.showModal({
    title: '提示',
    content: '确定要取消这个售后申请吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await aftersaleApi.cancelAftersale(id)
          Taro.showToast({ title: '取消成功', icon: 'success' })
          loadAftersaleList(true)
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
  const status = router.params.status
  if (status && status !== 'ALL') {
    currentStatus.value = status
  }
  loadAftersaleList(true)
})
</script>

<style lang="scss" scoped>
.aftersale-list-page {
  min-height: 100vh;
  background-color: $bg-secondary;
  display: flex;
  flex-direction: column;
}

.status-tabs {
  white-space: nowrap;
  background-color: $bg-primary;
  border-bottom: 1rpx solid $border-color;
  padding: 0 $spacing-sm;
}

.tab-item {
  display: inline-block;
  position: relative;
  padding: $spacing-md $spacing-lg;
}

.tab-text {
  font-size: $font-size-base;
  color: $text-secondary;
}

.tab-item.active .tab-text {
  color: $primary-color;
  font-weight: bold;
}

.tab-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 6rpx;
  background-color: $primary-color;
  border-radius: 3rpx;
}

.aftersale-list {
  flex: 1;
  padding: $spacing-md;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: $spacing-lg;
}

.empty-text {
  font-size: $font-size-base;
  color: $text-tertiary;
}

.aftersale-cards {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.aftersale-card {
  background-color: $bg-primary;
  border-radius: $radius-md;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;
}

.aftersale-no {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.aftersale-status {
  font-size: $font-size-sm;
  font-weight: bold;
}

.goods-list {
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
}

.goods-qty {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 $spacing-md $spacing-md;
}

.type-text {
  font-size: $font-size-xs;
  color: $text-tertiary;
}

.refund-amount {
  font-size: $font-size-sm;
  color: $error-color;
  font-weight: 500;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md $spacing-md;
  border-top: 1rpx solid $border-color;
}

.action-btn {
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-lg;
  font-size: $font-size-sm;
  min-width: 140rpx;
  text-align: center;

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

.load-more,
.no-more {
  text-align: center;
  padding: $spacing-lg;
}

.loading-text,
.no-more-text {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.list-bottom {
  height: $spacing-lg;
}

.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
