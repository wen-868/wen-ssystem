<template>
  <view class="inventory-page">
    <!-- 搜索表单：ref + :model + :rules -->
    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <text class="search-icon">&#xe614;</text>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索商品名称 / 编码"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
        </view>
      </view>
    </form>

    <scroll-view class="inventory-list" scroll-y v-if="list.length > 0">
      <view class="inventory-card" v-for="item in list" :key="item.id">
        <view class="card-left">
          <view class="product-image-wrap">
            <image v-if="item.productImage" class="product-image" :src="item.productImage" mode="aspectFill" />
            <view v-else class="product-image-placeholder">
              <text class="placeholder-icon">&#xe630;</text>
            </view>
          </view>
        </view>
        <view class="card-right">
          <view class="product-header">
            <text class="product-name">{{ item.productName }}</text>
            <view class="stock-status" :class="'status-' + item.status">
              <text class="status-text">{{ item.statusText }}</text>
            </view>
          </view>
          <view class="stock-info">
            <view class="stock-row">
              <text class="stock-label">当前库存</text>
              <text class="stock-value" :class="getStockClass(item)">{{ item.stock }}</text>
              <text class="stock-unit" v-if="item.unit">{{ item.unit }}</text>
            </view>
            <view class="stock-row">
              <text class="stock-label">安全库存</text>
              <text class="stock-value stock-value--safe">{{ item.safetyStock }}</text>
              <text class="stock-unit" v-if="item.unit">{{ item.unit }}</text>
            </view>
          </view>
          <!-- 库存进度条 -->
          <view class="stock-bar">
            <view class="stock-bar-bg">
              <view
                class="stock-bar-fill"
                :class="getBarClass(item)"
                :style="{ width: getBarWidth(item) }"
              ></view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 空状态 -->
    <view class="empty-state" v-else>
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无库存数据</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { inventoryApi, type InventoryItem } from '@/api/modules/inventory'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

// 搜索表单三件套：ref + :model + :rules
const formRef = ref<any>(null)
const searchForm = reactive({
  keyword: '',
})

const searchRules: Rules = {
  keyword: [
    { minLength: 1, message: '输入至少1个字符', required: false },
  ],
}

const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const list = ref<InventoryItem[]>([])
const loading = ref(false)

function onSearch() {
  loadInventory()
}

function clearSearch() {
  searchForm.keyword = ''
  loadInventory()
}

function getStockClass(item: InventoryItem): string {
  if (item.status === 'danger') return 'stock-value--danger'
  if (item.status === 'warning') return 'stock-value--warning'
  return 'stock-value--normal'
}

function getBarClass(item: InventoryItem): string {
  if (item.status === 'danger') return 'bar-fill--danger'
  if (item.status === 'warning') return 'bar-fill--warning'
  return 'bar-fill--normal'
}

function getBarWidth(item: InventoryItem): string {
  const maxStock = item.safetyStock * 2
  const ratio = Math.min(item.stock / maxStock, 1)
  return (ratio * 100).toFixed(0) + '%'
}

async function loadInventory() {
  loading.value = true
  try {
    const result = await inventoryApi.list({
      keyword: searchForm.keyword || undefined,
      page: 1,
      pageSize: 100
    })
    list.value = result.list
  } catch (err) {
    console.error('加载库存失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadInventory()
})
</script>

<style lang="scss" scoped>
.inventory-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

/* 搜索栏 */
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

/* 库存列表 */
.inventory-list {
  padding: 16rpx 24rpx;
}

.inventory-card {
  display: flex;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.card-left {
  margin-right: 20rpx;
  flex-shrink: 0;
}

.product-image-wrap {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background: $uni-bg-color-page;
}

.product-image {
  width: 100%;
  height: 100%;
}

.product-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, $uni-color-primary-soft, $uni-color-primary-soft);
}

.placeholder-icon {
  font-size: 48rpx;
  color: $uni-gray-300;
}

.card-right {
  flex: 1;
}

.product-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.product-name {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
  flex: 1;
  margin-right: 12rpx;
}

.stock-status {
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  flex-shrink: 0;
}

.status-normal { background: $uni-color-success-soft; }
.status-normal .status-text { color: $uni-color-success; }

.status-warning { background: $uni-color-warning-soft; }
.status-warning .status-text { color: $uni-color-warning; }

.status-danger { background: $uni-color-error-soft; }
.status-danger .status-text { color: $uni-color-error; }

.stock-info {
  margin-bottom: 16rpx;
}

.stock-row {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.stock-label {
  font-size: 24rpx;
  color: $uni-gray-400;
  width: 120rpx;
}

.stock-value {
  font-size: 30rpx;
  font-weight: 700;
  margin-right: 6rpx;
}

.stock-value--normal { color: $uni-color-success; }
.stock-value--warning { color: $uni-color-warning; }
.stock-value--danger { color: $uni-color-error; }
.stock-value--safe { color: $uni-color-primary; }

.stock-unit {
  font-size: 22rpx;
  color: $uni-gray-400;
}

/* 库存进度条 */
.stock-bar {
  margin-top: 4rpx;
}

.stock-bar-bg {
  height: 10rpx;
  background: $uni-gray-100;
  border-radius: 5rpx;
  overflow: hidden;
}

.stock-bar-fill {
  height: 100%;
  border-radius: 5rpx;
  transition: width 0.3s;
}

.bar-fill--normal { background: linear-gradient(90deg, $uni-color-success, $uni-color-success); }
.bar-fill--warning { background: linear-gradient(90deg, $uni-color-warning, $uni-color-warning); }
.bar-fill--danger { background: linear-gradient(90deg, $uni-color-error, $uni-color-error); }

/* 空状态 */
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