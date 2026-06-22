<script setup lang="ts">
import { ref } from 'vue'
import { showToast } from 'vant'
import { fetchProducts, type ProductRecord } from '../api'

const emit = defineEmits<{ navigate: [page: string] }>()

const keyword = ref('')
const activeCategory = ref('all')
const products = ref<ProductRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)

const categories = [
  { value: 'all', label: '全部' },
  { value: 'baijiu', label: '白酒' },
  { value: 'hongjiu', label: '红酒' },
  { value: 'pijiu', label: '啤酒' },
  { value: 'other', label: '其他' }
]

async function loadProducts() {
  loading.value = true
  try {
    const res = await fetchProducts({
      keyword: keyword.value || undefined
    })
    const data = res.data
    products.value = data?.records ?? data ?? []
    finished.value = true
  } catch {
    // 接口失败保持空状态
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onSearch() {
  loadProducts()
}

function onCancelSearch() {
  keyword.value = ''
  loadProducts()
}

function switchCategory(cat: string) {
  activeCategory.value = cat
  loadProducts()
}

function onRefresh() {
  refreshing.value = true
  loadProducts()
}

function onScan() {
  showToast('扫码功能开发中')
}

function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}
</script>

<template>
  <section class="page">
    <!-- 搜索栏 -->
    <div class="search-header">
      <van-search
        v-model="keyword"
        placeholder="搜索商品名称 / 条码 / SKU"
        shape="round"
        clearable
        show-action
        @search="onSearch"
        @cancel="onCancelSearch"
      >
        <template #action>
          <van-icon name="scan" size="20" @click="onScan" />
        </template>
      </van-search>
    </div>

    <!-- 分类筛选 -->
    <div class="category-bar">
      <div
        v-for="cat in categories"
        :key="cat.value"
        class="category-item"
        :class="{ active: activeCategory === cat.value }"
        @click="switchCategory(cat.value)"
      >
        {{ cat.label }}
      </div>
    </div>

    <!-- 商品列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadProducts"
      >
        <div v-if="products.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无商品数据" />
        </div>
        <div class="product-list">
          <div
            v-for="item in products"
            :key="item.skuId"
            class="product-card"
          >
            <div class="product-image">
              <van-icon name="goods-collect-o" size="32" color="var(--text-muted)" />
            </div>
            <div class="product-info">
              <div class="product-name">{{ item.skuName }}</div>
              <div class="product-code">{{ item.skuCode || item.barcode || '-' }}</div>
              <div class="product-bottom">
                <span class="product-price">¥{{ formatPrice(item.retailPrice) }}</span>
                <span class="product-stock">库存 {{ item.availableQty ?? '-' }}</span>
              </div>
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.search-header {
  margin: -4px -16px 0;
}

:deep(.van-search) {
  padding: 8px 12px;
  background: var(--bg-page);
}

:deep(.van-search__content) {
  background: var(--bg-card);
  border: 1px solid var(--border-normal);
}

:deep(.van-search__action) {
  color: var(--color-primary);
}

/* ===== 分类筛选 ===== */
.category-bar {
  display: flex;
  gap: 8px;
  padding: 8px 0 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.category-bar::-webkit-scrollbar {
  display: none;
}

.category-item {
  flex-shrink: 0;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1px solid var(--border-normal);
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.category-item.active {
  background: var(--color-primary);
  color: var(--text-inverse);
  border-color: var(--color-primary);
}

/* ===== 商品列表 ===== */
.product-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.product-card {
  display: flex;
  gap: 12px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 14px;
  box-shadow: var(--shadow-card);
}

.product-image {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  background: var(--bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.product-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-code {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.product-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.product-price {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-danger);
}

.product-stock {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-soft);
  padding: 2px 8px;
  border-radius: 4px;
}

.empty-wrapper {
  padding: 60px 0;
}
</style>
