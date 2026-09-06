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

    <!-- 搜索结果（uni-app H5 scroll-view 不内部滚动，整页文档滚动，见踩坑日志[38]） -->
    <view class="search-results" v-if="searching && !selected">
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
    </view>

    <!-- 已选商品 + 核价表单 -->
    <view class="form-section" v-if="selected">
      <view class="selected-card">
        <view class="selected-info">
          <text class="selected-name">{{ selected.name }}</text>
          <text class="selected-spec">{{ selected.specs || '标准规格' }}</text>
        </view>
        <text class="selected-close" @tap="selected = null">换一个</text>
      </view>

      <!-- 五档系统价格（成本/零售/批发/门店/小程序）均可分别核价；成本价无权限时如实显示 ¥— 不可核 -->
      <view class="price-rows">
        <view class="price-row" v-for="p in priceTypes" :key="p.key">
          <view class="price-row-head">
            <text class="price-row-name">{{ p.label }}</text>
            <text class="price-row-current">当前价 <text class="current-num">{{ currentText(p) }}</text></text>
          </view>
          <view class="price-input-wrap" :class="{ 'price-input-wrap--disabled': !editable(p) }">
            <text class="price-prefix">¥</text>
            <input
              class="price-input"
              v-model="suggestions[p.key]"
              type="digit"
              placeholder="建议价 0.00"
              placeholder-class="input-placeholder"
              :disabled="!editable(p)"
            />
          </view>
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

import { ref, reactive, onMounted } from 'vue'
import { productsApi, type ProductInfo } from '@/api/modules/products'
import { priceApi } from '@/api/modules/price'

const keyword = ref('')
const searching = ref(false)
const searchLoading = ref(false)
const searchResults = ref<ProductInfo[]>([])
const selected = ref<ProductInfo | null>(null)
const reason = ref('')
const submitting = ref(false)

/**
 * 五档系统价格（与 t_product_price 列一一对应）：核价页每档一行，
 * 当前价 + 建议价输入，均可独立核价（用户要求：系统内定义的价格都要能核价）
 */
const priceTypes = [
  { key: 'COST', label: '成本价', field: 'costPrice' as const },
  { key: 'RETAIL', label: '零售价', field: 'retailPrice' as const },
  { key: 'WHOLESALE', label: '批发价', field: 'wholesalePrice' as const },
  { key: 'STORE', label: '门店价', field: 'storePrice' as const },
  { key: 'MINIAPP', label: '小程序价', field: 'miniappPrice' as const },
]

/** 每档的建议价输入（键为 priceType，值为输入字符串） */
const suggestions = reactive<Record<string, string>>({})

/** 当前价文本：无该档价格时如实显示 ¥—（不造假） */
function currentText(p: (typeof priceTypes)[number]): string {
  const v = selected.value?.[p.field]
  return v != null ? `¥${Number(v).toFixed(2)}` : '¥—'
}

/** 成本价受权限控制，无权限（null/undefined）时该档不可核价 */
function editable(p: (typeof priceTypes)[number]): boolean {
  return selected.value?.[p.field] != null
}

function resetSuggestions() {
  for (const p of priceTypes) {
    suggestions[p.key] = ''
  }
}

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
  resetSuggestions()
  reason.value = ''
  searching.value = false
}

async function onSubmit() {
  if (!selected.value) return
  // 只提交填写了建议价（>0）的档位，空值档位不参与核价
  const items = priceTypes
    .filter((p) => editable(p) && suggestions[p.key] && Number(suggestions[p.key]) > 0)
    .map((p) => ({ priceType: p.key, suggestedPrice: Number(suggestions[p.key]) }))
  if (items.length === 0) {
    uni.showToast({ title: '请至少填写一个价格档位的建议价', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    for (const it of items) {
      await priceApi.submitReview({
        skuId: Number(selected.value.skuId),
        suggestedPrice: it.suggestedPrice,
        priceType: it.priceType as any,
        reason: reason.value || undefined,
      })
    }
    uni.showToast({ title: `核价提交成功（${items.length} 档）`, icon: 'success' })
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
  padding-top: calc(24rpx + var(--safe-top));
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
/* 结果列表随整页文档滚动（不设 max-height，避免列表被截断看不到后面的商品） */
.search-results {
  padding: 8rpx 24rpx;
}
.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-md $uni-spacing-base;
  margin-bottom: $uni-spacing-sm;
}
.result-info { display: flex; flex-direction: column; gap: 6rpx; flex: 1; margin-right: $uni-spacing-sm; }
.result-name { font-size: 26rpx; color: $uni-gray-700; }
.result-spec { font-size: 22rpx; color: $uni-gray-400; }
.result-price { font-size: 28rpx; font-weight: 600; color: $uni-color-primary; }
.search-empty { padding: 60rpx 0; text-align: center; }
.search-empty-text { font-size: 26rpx; color: $uni-gray-400; }
.form-section {
  margin: $uni-spacing-sm $uni-spacing-base 0;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  box-shadow: $uni-shadow-card-sm;
}
.selected-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $uni-spacing-md;
  background: $uni-color-primary-soft;
  border-radius: $uni-border-radius-xs;
  margin-bottom: $uni-spacing-md;
}
.selected-info { display: flex; flex-direction: column; gap: 6rpx; flex: 1; margin-right: $uni-spacing-sm; }
.selected-name { font-size: 28rpx; font-weight: 600; color: $uni-gray-700; }
.selected-spec { font-size: 22rpx; color: $uni-gray-400; }
.selected-close { font-size: 24rpx; color: $uni-color-primary; }
.form-item { padding: $uni-spacing-sm 0; border-bottom: 1rpx solid $uni-bg-color-grey; }
.form-item:last-of-type { border-bottom: none; }
.form-label {
  display: block;
  font-size: 24rpx;
  color: $uni-gray-500;
  margin-bottom: $uni-spacing-sm;
}
.required { color: $uni-color-error; margin-right: 4rpx; }
/* 五档价格行：每档 当前价 + 建议价输入 */
.price-rows { padding: $uni-spacing-xs 0; }
.price-row {
  padding: $uni-spacing-sm 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.price-row:last-of-type { border-bottom: none; }
.price-row-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $uni-spacing-sm;
}
.price-row-name { font-size: 24rpx; color: $uni-gray-500; }
.price-row-current { font-size: 24rpx; color: $uni-gray-400; }
.current-num { font-size: 32rpx; font-weight: 700; color: $uni-gray-700; }
.price-input-wrap {
  display: flex;
  align-items: center;
  height: 72rpx;
  padding: 0 $uni-spacing-md;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
}
.price-input-wrap--disabled { opacity: 0.45; }
.price-prefix { font-size: 28rpx; color: $uni-gray-400; margin-right: $uni-spacing-xs; }
.price-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.input-placeholder { color: $uni-gray-300; }
.reason-textarea {
  width: 100%;
  min-height: 160rpx;
  padding: $uni-spacing-md;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
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
.empty-icon { font-size: 80rpx; color: $uni-gray-200; margin-bottom: $uni-spacing-sm; }
.empty-text { font-size: 26rpx; color: $uni-gray-400; }
</style>
