<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { fetchAdminProducts, fetchCategories, updateProductStatus, type AdminProductRecord, type CategoryRecord } from '../api'

const router = useRouter()

const keyword = ref('')
const categoryId = ref('')
const products = ref<AdminProductRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const categoryList = ref<CategoryRecord[]>([])

onMounted(async () => {
  try {
    const res = await fetchCategories()
    categoryList.value = res.data ?? []
  } catch { /* 保持空状态 */ }
  loadProducts()
})

async function loadProducts() {
  loading.value = true
  try {
    const res = await fetchAdminProducts({
      keyword: keyword.value || undefined,
      category: categoryId.value || undefined,
      page: page.value,
      pageSize: 20
    })
    const data = res.data
    const items = (data?.records ?? data ?? []) as AdminProductRecord[]
    if (page.value === 1) {
      products.value = items
    } else {
      products.value.push(...items)
    }
    if (items.length < 20) {
      finished.value = true
    }
    page.value++
  } catch {
    showToast('加载失败')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onSearch() {
  page.value = 1
  finished.value = false
  loadProducts()
}

function onCategoryChange() {
  page.value = 1
  finished.value = false
  loadProducts()
}

function onRefresh() {
  refreshing.value = true
  page.value = 1
  finished.value = false
  loadProducts()
}

function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

function getStatusType(status: string): string {
  return status === '上架' ? 'success' : 'default'
}

async function handleToggleStatus(item: AdminProductRecord) {
  try {
    const newStatus = item.status === '上架' ? '下架' : '上架'
    await showConfirmDialog({
      title: '确认操作',
      message: `确定要${newStatus === '上架' ? '上架' : '下架'}"${item.name}"吗？`
    })
    await updateProductStatus(item.spuId, newStatus)
    item.status = newStatus
    showToast(`${newStatus}成功`)
  } catch {
    // cancelled
  }
}

function goCreate() {
  showToast('新增商品功能开发中')
}

function goDetail(spuId: number) {
  router.push(`/products/${spuId}`)
}
</script>

<template>
  <div class="admin-products">
    <van-nav-bar title="商品管理" left-arrow @click-left="router.back()">
      <template #right>
        <van-button size="small" type="primary" @click="goCreate">新增商品</van-button>
      </template>
    </van-nav-bar>

    <!-- 搜索 + 分类筛选 -->
    <div class="filter-bar">
      <van-search
        v-model="keyword"
        placeholder="搜索商品名称 / 条码"
        shape="round"
        clearable
        @search="onSearch"
        @clear="onSearch"
      />
      <div class="category-filter">
        <van-icon name="label-o" size="16" />
        <select v-model="categoryId" class="category-select" @change="onCategoryChange">
          <option value="">全部分类</option>
          <option v-for="cat in categoryList" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>
      </div>
    </div>

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

        <div
          v-for="item in products"
          :key="item.spuId"
          class="product-card"
          @click="goDetail(item.spuId)"
        >
          <div class="card-header">
            <div class="product-name">{{ item.name }}</div>
            <van-tag :type="getStatusType(item.status) as any" size="medium">
              {{ item.status }}
            </van-tag>
          </div>

          <div class="card-body">
            <div class="info-row">
              <span class="label">分类</span>
              <span class="value">{{ item.categoryName || '-' }}</span>
              <span class="label">品牌</span>
              <span class="value">{{ item.brand || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="label">SKU数</span>
              <span class="value">{{ item.skuCount ?? '-' }}</span>
              <span class="label">零售价</span>
              <span class="value price">¥{{ formatPrice(item.retailPrice) }}</span>
            </div>
            <div class="info-row">
              <span class="label">库存</span>
              <span class="value">{{ item.totalStock ?? '-' }}</span>
              <span class="label">条码</span>
              <span class="value code">{{ item.barcode || '-' }}</span>
            </div>
          </div>

          <div class="card-footer">
            <van-button
              size="small"
              plain
              :type="item.status === '上架' ? 'warning' : 'success'"
              @click.stop="handleToggleStatus(item)"
            >
              {{ item.status === '上架' ? '下架' : '上架' }}
            </van-button>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<style scoped>
.admin-products {
  min-height: 100vh;
  background: var(--bg-page);
}

.filter-bar {
  padding: 0 16px;
  margin-bottom: 8px;
}

.filter-bar :deep(.van-search) {
  padding: 8px 0;
}

.category-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-normal);
}

.category-select {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  padding: 4px 0;
}

.empty-wrapper {
  padding: 60px 0;
}

.product-card {
  margin: 8px 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 14px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.product-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-row {
  display: flex;
  align-items: center;
  font-size: 13px;
}

.label {
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-right: 4px;
}

.value {
  color: var(--text-primary);
  margin-right: 16px;
}

.price {
  font-weight: 600;
  color: var(--color-primary);
}

.code {
  font-family: monospace;
  font-size: 12px;
}

.card-footer {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-normal);
}
</style>