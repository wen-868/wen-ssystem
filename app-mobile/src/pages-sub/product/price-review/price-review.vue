<template>
  <view class="review-page">
    <page-header title="建议核价" @back="goBack" />

    <!-- 商品搜索 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
        <input
          class="search-input"
          v-model="keyword"
          type="text"
          placeholder="搜索商品名称 / 条码"
          placeholder-class="search-placeholder"
          confirm-type="search"
          @confirm="onSearch"
        />
        <image class="search-clear ic" v-if="keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
      </view>
    </view>

    <!-- 搜索结果 -->
    <scroll-view class="search-results" scroll-y v-if="searching && !selected">
      <view
        class="result-item"
        v-for="item in searchResults"
        :key="item.skuId"
        @tap="selectProduct(item)"
      >
        <view class="result-info">
          <text class="result-name">{{ item.name }}</text>
          <text class="result-spec">{{ item.specs || '标准规格' }}</text>
        </view>
        <text class="result-price">¥{{ item.price.toFixed(2) }}</text>
      </view>
      <view class="search-empty" v-if="!searchLoading && searchResults.length === 0">
        <text class="search-empty-text">未找到相关商品</text>
      </view>
    </scroll-view>

    <!-- 已选商品 + 核价表单 -->
    <view class="form-section" v-if="selected">
      <view class="selected-card">
        <view class="selected-info">
          <text class="selected-name">{{ selected.name }}</text>
          <text class="selected-spec">{{ selected.specs || '标准规格' }}</text>
        </view>
        <text class="selected-close" @tap="selected = null">换一个</text>
      </view>

      <view class="form-item">
        <text class="form-label">当前零售价</text>
        <view class="current-price">¥{{ currentPrice.toFixed(2) }}</view>
      </view>

      <view class="form-item">
        <text class="form-label"><text class="required">*</text>建议售价</text>
        <view class="price-input-wrap">
          <text class="price-prefix">¥</text>
          <input
            class="price-input"
            v-model="suggestedPrice"
            type="digit"
            placeholder="0.00"
            placeholder-class="input-placeholder"
          />
        </view>
      </view>

      <view class="form-item">
        <text class="form-label">核价原因</text>
        <textarea
          class="reason-textarea"
          v-model="reason"
          placeholder="如：市场价格上涨，建议上调至成本价以上"
          placeholder-class="input-placeholder"
          :maxlength="500"
          :auto-height="true"
        />
      </view>

      <button class="submit-btn" :loading="submitting" :disabled="submitting" @tap="onSubmit">
        提交核价
      </button>
    </view>

    <view class="empty-state" v-else-if="!searching">
      <image class="empty-icon ic" src="/static/icons/ic/image.svg" mode="aspectFit"/>
      <text class="empty-text">搜索并选择需要核价的商品</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, computed, onMounted } from 'vue'
import { productsApi, type ProductInfo } from '@/api/modules/products'
import { priceApi } from '@/api/modules/price'

const keyword = ref('')
const searching = ref(false)
const searchLoading = ref(false)
const searchResults = ref<ProductInfo[]>([])
const selected = ref<ProductInfo | null>(null)
const suggestedPrice = ref('')
const reason = ref('')
const submitting = ref(false)

const currentPrice = computed(() => selected.value?.price ?? 0)

async function onSearch() {
  searching.value = true
  searchLoading.value = true
  try {
    const result = await productsApi.list({ keyword: keyword.value || undefined, page: 1, pageSize: 30 })
    searchResults.value = result.list || []
  } catch (err) {
    console.error('搜索商品失败:', err)
    searchResults.value = []
    uni.showToast({ title: '搜索失败', icon: 'none' })
  } finally {
    searchLoading.value = false
  }
}

function clearSearch() {
  keyword.value = ''
  searching.value = false
  searchResults.value = []
}

function selectProduct(item: ProductInfo) {
  selected.value = item
  suggestedPrice.value = ''
  reason.value = ''
  searching.value = false
}

async function onSubmit() {
  if (!selected.value) return
  const price = Number(suggestedPrice.value)
  if (!Number.isFinite(price) || price <= 0) {
    uni.showToast({ title: '请输入大于 0 的建议售价', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await priceApi.submitReview({
      skuId: Number(selected.value.skuId),
      suggestedPrice: price,
      reason: reason.value || undefined,
    })
    uni.showToast({ title: '核价提交成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
  } catch (err) {
    console.error('提交核价失败:', err)
    uni.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  onSearch()
})
</script>

<style lang="scss" scoped>
.review-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-gray-700;
}
.search-bar {
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
}
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
.search-results {
  max-height: 40vh;
  padding: 8rpx 24rpx;
}
.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $uni-bg-color;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 12rpx;
}
.result-info { display: flex; flex-direction: column; gap: 6rpx; flex: 1; margin-right: 16rpx; }
.result-name { font-size: 26rpx; color: $uni-gray-700; }
.result-spec { font-size: 22rpx; color: $uni-gray-400; }
.result-price { font-size: 28rpx; font-weight: 600; color: $uni-color-primary; }
.search-empty { padding: 60rpx 0; text-align: center; }
.search-empty-text { font-size: 26rpx; color: $uni-gray-400; }
.form-section {
  margin: 16rpx 24rpx 0;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.selected-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx;
  background: $uni-color-primary-soft;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}
.selected-info { display: flex; flex-direction: column; gap: 6rpx; flex: 1; margin-right: 16rpx; }
.selected-name { font-size: 28rpx; font-weight: 600; color: $uni-gray-700; }
.selected-spec { font-size: 22rpx; color: $uni-gray-400; }
.selected-close { font-size: 24rpx; color: $uni-color-primary; }
.form-item { padding: 16rpx 0; border-bottom: 1rpx solid $uni-bg-color-grey; }
.form-item:last-of-type { border-bottom: none; }
.form-label {
  display: block;
  font-size: 24rpx;
  color: $uni-gray-500;
  margin-bottom: 12rpx;
}
.required { color: $uni-color-error; margin-right: 4rpx; }
.current-price { font-size: 32rpx; font-weight: 700; color: $uni-gray-700; }
.price-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  padding: 0 20rpx;
  background: $uni-bg-color-page;
  border-radius: 12rpx;
}
.price-prefix { font-size: 28rpx; color: $uni-gray-400; margin-right: 8rpx; }
.price-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.input-placeholder { color: $uni-gray-300; }
.reason-textarea {
  width: 100%;
  min-height: 160rpx;
  padding: 20rpx;
  background: $uni-bg-color-page;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}
.submit-btn {
  margin-top: 24rpx;
  height: 80rpx;
  line-height: 80rpx;
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
  border-radius: 40rpx;
  font-size: 28rpx;
  border: none;
}
.submit-btn::after { border: none; }
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-200; margin-bottom: 16rpx; }
.empty-text { font-size: 26rpx; color: $uni-gray-400; }
</style>
