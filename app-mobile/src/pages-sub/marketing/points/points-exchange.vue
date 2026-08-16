<template>
  <view class="exchange-page">
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="searchForm.keyword"
          type="text"
          placeholder="搜索兑换商品"
          placeholder-class="search-placeholder"
          @confirm="onSearch"
        />
        <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
      </view>
    </view>

    <scroll-view class="exchange-list" scroll-y v-if="list.length > 0">
      <view class="exchange-item" v-for="item in list" :key="item.id">
        <view class="item-image-wrap">
          <image v-if="item.image" class="item-image" :src="item.image" mode="aspectFill" />
          <view v-else class="item-image-placeholder">
            <image class="placeholder-icon ic" src="/static/icons/ic/image.svg" mode="aspectFit"/>
          </view>
        </view>
        <view class="item-info">
          <text class="item-name">{{ item.name }}</text>
          <text class="item-category">{{ item.category }}</text>
          <view class="item-bottom">
            <view class="item-points">
              <text class="points-label">所需积分</text>
              <text class="points-value">{{ item.points }}</text>
            </view>
            <view class="item-stock">
              <text>库存: {{ item.stock }}</text>
            </view>
          </view>
        </view>
        <view class="exchange-btn" :class="{ disabled: item.stock <= 0 }" @tap="doExchange(item)">
          <text>{{ item.stock > 0 ? '兑换' : '已抢光' }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无兑换商品</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { pointsApi, type ExchangeItem } from '@/api/modules/points'

const searchForm = reactive({
  keyword: '',
})

const list = ref<ExchangeItem[]>([])

function onSearch() {
  loadList()
}

function clearSearch() {
  searchForm.keyword = ''
  loadList()
}

async function doExchange(item: ExchangeItem) {
  if (item.stock <= 0) return
  
  uni.showModal({
    title: '积分兑换',
    content: `确定使用 ${item.points} 积分兑换 "${item.name}" 吗？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await pointsApi.exchange(item.id)
          uni.showToast({ title: '兑换成功', icon: 'success' })
          loadList()
        } catch (err) {
          uni.showToast({ title: '兑换失败', icon: 'none' })
        }
      }
    }
  })
}

async function loadList() {
  try {
    const result = await pointsApi.exchangeList({
      keyword: searchForm.keyword || undefined,
      page: 1,
      pageSize: 100
    })
    list.value = result.list
  } catch (err) {
    console.error('加载兑换商品失败:', err)
  }
}

onMounted(() => {
  loadList()
})
</script>

<style lang="scss" scoped>
.exchange-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
  padding-top: calc(16rpx + env(safe-area-inset-top));
}

.search-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  background: $uni-bg-color-page;
  border-radius: 36rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 32rpx;
  color: $uni-gray-400;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: $uni-gray-700;
}

.search-placeholder {
  color: $uni-gray-300;
  font-size: 26rpx;
}

.search-clear {
  font-size: 32rpx;
  color: $uni-gray-300;
  padding: 4rpx;
}

.exchange-list {
  padding: 16rpx 24rpx;
}

.exchange-item {
  display: flex;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.item-image-wrap {
  width: 140rpx;
  height: 140rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background: $uni-bg-color-page;
  flex-shrink: 0;
  margin-right: 20rpx;
}

.item-image {
  width: 100%;
  height: 100%;
}

.item-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, $uni-color-primary-soft, $uni-color-primary-soft);
}

.placeholder-icon {
  font-size: 56rpx;
  color: $uni-gray-300;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.item-name {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.item-category {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.item-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-points {
  display: flex;
  align-items: baseline;
}

.points-label {
  font-size: 24rpx;
  color: $uni-gray-400;
  margin-right: 8rpx;
}

.points-value {
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

.item-stock {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.exchange-btn {
  width: 120rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 32rpx;
  font-size: 26rpx;
  color: $uni-text-color-inverse;
  flex-shrink: 0;
}

.exchange-btn.disabled {
  background: $uni-gray-200;
  color: $uni-gray-400;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: $uni-gray-300;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.safe-bottom {
  height: env(safe-area-inset-bottom);
}
</style>