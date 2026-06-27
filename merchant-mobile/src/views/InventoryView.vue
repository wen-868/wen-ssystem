<script setup lang="ts">
import { ref } from 'vue'
import { fetchAdminProducts, type AdminProductRecord } from '../api'

const keyword = ref('')
const activeCategory = ref('')
const records = ref<AdminProductRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)

const categories = [
  { value: '', label: '全部' },
  { value: '白酒', label: '白酒' },
  { value: '红酒', label: '红酒' },
  { value: '啤酒', label: '啤酒' },
  { value: '其他', label: '其他' }
]

function formatSpec(item: AdminProductRecord): string {
  const parts: string[] = []
  if (item.boxRatio > 1) parts.push(`1${item.boxUnit}=${item.boxRatio}${item.baseUnit}`)
  if (item.alcoholContent) parts.push(`${item.alcoholContent}%vol`)
  return parts.join(' / ') || '-'
}

async function loadProducts(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchAdminProducts({
      keyword: keyword.value || undefined,
      category: activeCategory.value || undefined,
      page: page.value,
      pageSize: 20
    })
    const data = res.data as any
    const items = (data?.records ?? data ?? []) as AdminProductRecord[]
    if (reset) {
      records.value = items
    } else {
      records.value.push(...items)
    }
    if (records.value.length >= (data?.total ?? items.length)) {
      finished.value = true
    }
    page.value++
  } catch {
    // ignore
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onSearch() {
  loadProducts(true)
}

function onCancelSearch() {
  keyword.value = ''
  loadProducts(true)
}

function onRefresh() {
  refreshing.value = true
  loadProducts(true)
}

function onCategoryChange(cat: string) {
  activeCategory.value = cat
  loadProducts(true)
}

function formatPrice(val: number | undefined | null): string {
  if (val == null) return '-'
  return `¥${Number(val).toFixed(2)}`
}
</script>

<template>
  <section class="page">
    <h2 class="page-title">商品查询</h2>

    <van-search
      v-model="keyword"
      placeholder="搜索商品名/SKU/条码"
      shape="round"
      clearable
      @search="onSearch"
      @cancel="onCancelSearch"
    />

    <van-tabs
      v-model:active="activeCategory"
      class="category-tabs"
      line-width="24px"
      @change="onCategoryChange"
    >
      <van-tab
        v-for="cat in categories"
        :key="cat.value"
        :title="cat.label"
        :name="cat.value"
      />
    </van-tabs>

    <div class="action-bar">
      <span class="record-count">共 {{ records.length }} 条</span>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadProducts"
      >
        <div v-if="records.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无商品数据" />
        </div>
        <van-cell
          v-for="item in records"
          :key="item.skuId"
          class="product-cell"
        >
          <template #title>
            <div class="product-name">{{ item.skuName || item.name }}</div>
            <div class="product-sku">
              <span>SKU: {{ item.skuCode }}</span>
              <span v-if="item.barcode" class="product-barcode">{{ item.barcode }}</span>
            </div>
            <div class="product-tags">
              <span v-if="item.alcoholContent" class="tag alcohol">{{ item.alcoholContent }}%vol</span>
              <span v-if="item.origin" class="tag origin">{{ item.origin }}</span>
              <span v-if="item.categoryName" class="tag category">{{ item.categoryName }}</span>
            </div>
          </template>
          <template #label>
            <div class="product-price-row">
              <span class="price-item">
                <span class="price-label">零售价</span>
                <span class="price-value">{{ formatPrice(item.retailPrice) }}</span>
              </span>
              <span class="price-item">
                <span class="price-label">批发价</span>
                <span class="price-value">{{ formatPrice(item.wholesalePrice) }}</span>
              </span>
              <span v-if="item.storePrice" class="price-item">
                <span class="price-label">门店价</span>
                <span class="price-value">{{ formatPrice(item.storePrice) }}</span>
              </span>
            </div>
            <div v-if="formatSpec(item) !== '-'" class="product-spec-row">
              <span class="spec-label">规格</span>
              <span class="spec-value">{{ formatSpec(item) }}</span>
            </div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 12px;
  font-size: var(--text-page-title);
  font-weight: 600;
  color: var(--text-primary);
}

.action-bar {
  display: flex;
  align-items: center;
  padding: 8px var(--space-page-padding);
}

.record-count {
  font-size: 13px;
  color: var(--text-muted);
}

.empty-wrapper {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.product-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.product-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.product-sku {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.product-barcode {
  color: var(--text-muted);
}

.product-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.tag.alcohol {
  background: #fff0e6;
  color: #e65c00;
}

.tag.origin {
  background: #e6f7ff;
  color: #1890ff;
}

.tag.category {
  background: #f9f0ff;
  color: #722ed1;
}

.product-price-row {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.price-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.price-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.price-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.product-spec-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.spec-label {
  font-size: 12px;
  color: var(--text-muted);
}

.spec-value {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.category-tabs {
  padding: 0 var(--space-page-padding);
  margin-bottom: 4px;
}
</style>
