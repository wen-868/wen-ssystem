<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { fetchProducts, fetchCategories, fetchTagGroups, fetchTags, type ProductRecord, type CategoryRecord, type TagGroupRecord, type TagRecord } from '../api'
import { isWeChat, wxScanQRCode } from '../utils/wx'

const router = useRouter()

defineEmits<{ navigate: [page: string] }>()

const keyword = ref('')
const activeCategoryId = ref<number | null>(null)
const products = ref<ProductRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const showSearchArea = ref(false)

/* ========== 分类 - 从 API 动态加载 ========== */
const categoryList = ref<CategoryRecord[]>([])

const displayCategories = computed(() => [
  { id: null, name: '全部' },
  ...categoryList.value
])

onMounted(async () => {
  try {
    const [catRes, tgRes] = await Promise.all([
      fetchCategories(),
      fetchTagGroups().catch(() => ({ data: [] }))
    ])
    categoryList.value = catRes.data ?? []
    tagGroups.value = (tgRes.data as unknown as TagGroupRecord[]) ?? []
  } catch { /* 保持空状态 */ }
})

/* ========== 搜索历史 ========== */
const SEARCH_HISTORY_KEY = 'product_search_history'
const MAX_HISTORY = 10

function getSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]')
  } catch { return [] }
}

function saveSearchHistory(kw: string) {
  if (!kw.trim()) return
  const history = getSearchHistory().filter(h => h !== kw)
  history.unshift(kw)
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY)
}

const searchHistory = ref<string[]>(getSearchHistory())

/* ========== 热门搜索 ========== */
const hotKeywords = ['茅台', '五粮液', '啤酒', '红酒', '洋酒', '扫码']

function onHotSearch(kw: string) {
  keyword.value = kw
  saveSearchHistory(kw)
  showSearchArea.value = false
  loadProducts()
}

function onHistorySearch(kw: string) {
  keyword.value = kw
  showSearchArea.value = false
  loadProducts()
}

/* ========== 标签筛选 ========== */
const showFilterPopup = ref(false)
const tagGroups = ref<TagGroupRecord[]>([])
const selectedTags = ref<number[]>([])
const selectedTagNames = ref<string[]>([])
const groupTags = ref<Record<number, TagRecord[]>>({})
const groupSelections = ref<Record<number, number | number[]>>({})

// 已选标签名称列表（用于展示）
const selectedTagLabelList = computed(() => {
  return selectedTagNames.value.map((name, i) => ({
    id: selectedTags.value[i],
    name
  }))
})

async function openFilter() {
  // 加载各标签组的标签
  if (tagGroups.value.length === 0) return
  showFilterPopup.value = true

  // 初始化选中状态
  groupSelections.value = {}
  for (const tagId of selectedTags.value) {
    const tag = allLoadedTags.value.find(t => t.id === tagId)
    if (tag) {
      markTagSelected(tag.groupId, tag.id)
    }
  }

  // 按需加载标签组
  for (const g of tagGroups.value) {
    if (!groupTags.value[g.id]) {
      try {
        const res = await fetchTags(g.id)
        groupTags.value[g.id] = (res.data as unknown as TagRecord[]) ?? []
      } catch {
        groupTags.value[g.id] = []
      }
    }
  }
}

const allLoadedTags = computed(() => {
  const all: TagRecord[] = []
  for (const g of tagGroups.value) {
    if (groupTags.value[g.id]) {
      all.push(...groupTags.value[g.id])
    }
  }
  return all
})

function markTagSelected(groupId: number, tagId: number) {
  const group = tagGroups.value.find(g => g.id === groupId)
  if (!group) return
  if (group.isMultiple) {
    const arr = (groupSelections.value[groupId] as number[]) || []
    if (!arr.includes(tagId)) {
      groupSelections.value[groupId] = [...arr, tagId]
    }
  } else {
    groupSelections.value[groupId] = tagId
  }
}

function isTagSelected(groupId: number, tagId: number): boolean {
  const sel = groupSelections.value[groupId]
  if (!sel) return false
  if (Array.isArray(sel)) return sel.includes(tagId)
  return sel === tagId
}

function toggleTag(groupId: number, tagId: number) {
  const group = tagGroups.value.find(g => g.id === groupId)
  if (!group) return
  if (group.isMultiple) {
    const arr = (groupSelections.value[groupId] as number[]) || []
    if (arr.includes(tagId)) {
      groupSelections.value[groupId] = arr.filter(id => id !== tagId) as any
    } else {
      groupSelections.value[groupId] = [...arr, tagId] as any
    }
  } else {
    if (isTagSelected(groupId, tagId)) {
      delete groupSelections.value[groupId]
    } else {
      groupSelections.value[groupId] = tagId as any
    }
  }
}

function applyFilter() {
  const tagIds: number[] = []
  const tagNames: string[] = []
  for (const [, sel] of Object.entries(groupSelections.value)) {
    if (!sel) continue
    const ids = Array.isArray(sel) ? sel : [sel]
    for (const tid of ids) {
      const tag = allLoadedTags.value.find(t => t.id === tid)
      if (tag) {
        tagIds.push(tid)
        tagNames.push(tag.name)
      }
    }
  }
  selectedTags.value = tagIds
  selectedTagNames.value = tagNames
  showFilterPopup.value = false
  loadProducts()
}

function resetFilter() {
  groupSelections.value = {}
  selectedTags.value = []
  selectedTagNames.value = []
  showFilterPopup.value = false
  loadProducts()
}

function removeSelectedTag(tagId: number) {
  const idx = selectedTags.value.indexOf(tagId)
  if (idx >= 0) {
    selectedTags.value.splice(idx, 1)
    selectedTagNames.value.splice(idx, 1)
    loadProducts()
  }
}

/* ========== 商品列表 ========== */
async function loadProducts() {
  loading.value = true
  try {
    const res = await fetchProducts({
      keyword: keyword.value || undefined,
      categoryId: activeCategoryId.value ?? undefined,
      tagIds: selectedTags.value.length > 0 ? selectedTags.value : undefined
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
  saveSearchHistory(keyword.value)
  searchHistory.value = getSearchHistory()
  showSearchArea.value = false
  loadProducts()
}

function onCancelSearch() {
  keyword.value = ''
  showSearchArea.value = false
  loadProducts()
}

function switchCategory(catId: number | null) {
  activeCategoryId.value = catId
  loadProducts()
}

function onRefresh() {
  refreshing.value = true
  loadProducts()
}

async function onScan() {
  if (isWeChat()) {
    try {
      const result = await wxScanQRCode()
      if (result) {
        keyword.value = result
        loadProducts()
      }
    } catch {
      showToast('扫码失败，请重试')
    }
  } else {
    showToast('扫码功能需要微信环境')
  }
}

function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

function goDetail(spuId: number) {
  router.push(`/products/${spuId}`)
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
        @focus="showSearchArea = true"
      >
        <template #action>
          <van-icon name="scan" size="20" @click="onScan" />
          <van-icon name="filter-o" size="20" class="filter-icon" @click="openFilter" />
        </template>
      </van-search>
    </div>

    <!-- 搜索建议区 -->
    <div v-if="showSearchArea" class="search-area">
      <div v-if="searchHistory.length > 0" class="search-section">
        <div class="search-section-header">
          <span class="search-section-title">搜索历史</span>
          <van-icon name="delete-o" size="14" @click="clearSearchHistory(); searchHistory = []" />
        </div>
        <div class="tag-list">
          <span v-for="(h, i) in searchHistory" :key="i" class="tag-item" @click="onHistorySearch(h)">{{ h }}</span>
        </div>
      </div>
      <div class="search-section">
        <div class="search-section-header">
          <span class="search-section-title">热门搜索</span>
        </div>
        <div class="tag-list">
          <span v-for="kw in hotKeywords" :key="kw" class="tag-item tag-item--hot" @click="onHotSearch(kw)">{{ kw }}</span>
        </div>
      </div>
    </div>

    <!-- 已选标签 -->
    <div v-if="selectedTagLabelList.length > 0" class="selected-tags-bar">
      <span v-for="t in selectedTagLabelList" :key="t.id" class="selected-tag">
        {{ t.name }}
        <van-icon name="cross" size="10" @click="removeSelectedTag(t.id)" />
      </span>
      <span class="clear-tags" @click="resetFilter">清除</span>
    </div>

    <!-- 分类筛选 -->
    <div class="category-bar">
      <div
        v-for="cat in displayCategories"
        :key="cat.id ?? 'all'"
        class="category-item"
        :class="{ active: activeCategoryId === cat.id }"
        @click="switchCategory(cat.id)"
      >
        {{ cat.name }}
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
            @click="goDetail(item.spuId)"
          >
            <div class="product-image">
              <van-icon name="goods-collect-o" size="32" color="var(--text-muted)" />
            </div>
            <div class="product-info">
              <div class="product-name">{{ item.productName || item.skuName }}</div>
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

    <!-- 标签筛选面板 -->
    <van-popup v-model:show="showFilterPopup" position="bottom" round :style="{ maxHeight: '70%' }">
      <div class="filter-panel">
        <div class="filter-header">
          <span class="filter-title">筛选</span>
          <span class="filter-reset" @click="resetFilter">重置</span>
        </div>
        <div class="filter-body">
          <div v-for="group in tagGroups" :key="group.id" class="filter-group">
            <div class="filter-group-name">{{ group.name }}</div>
            <div class="filter-group-tags">
              <span
                v-for="tag in (groupTags[group.id] || [])"
                :key="tag.id"
                class="filter-tag"
                :class="{
                  active: isTagSelected(group.id, tag.id),
                  single: !group.isMultiple
                }"
                @click="toggleTag(group.id, tag.id)"
              >
                {{ tag.name }}
              </span>
            </div>
          </div>
        </div>
        <div class="filter-footer">
          <van-button block type="primary" round @click="applyFilter">确定</van-button>
        </div>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.search-header {
  margin: -4px -16px 0;
}

.filter-icon {
  margin-left: 12px;
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

/* ===== 搜索建议区 ===== */
.search-area {
  padding: 0 16px 12px;
}

.search-section {
  margin-bottom: 12px;
}

.search-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.search-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1px solid var(--border-normal);
  cursor: pointer;
  user-select: none;
}

.tag-item--hot {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

/* ===== 已选标签 ===== */
.selected-tags-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 0 16px 8px;
}

.selected-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 12px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  cursor: default;
}

.clear-tags {
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  margin-left: 4px;
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
  cursor: pointer;
}

.product-card:active {
  background: var(--bg-soft);
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

/* ===== 筛选面板 ===== */
.filter-panel {
  padding: 20px 16px;
  max-height: 65vh;
  display: flex;
  flex-direction: column;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.filter-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.filter-reset {
  font-size: 13px;
  color: var(--color-primary);
  cursor: pointer;
}

.filter-body {
  flex: 1;
  overflow-y: auto;
}

.filter-group {
  margin-bottom: 16px;
}

.filter-group-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.filter-group-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-tag {
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-soft);
  border: 1px solid var(--border-normal);
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}

.filter-tag.active {
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.filter-tag.single.active {
  color: #fff;
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.filter-footer {
  padding-top: 16px;
  border-top: 1px solid var(--border-normal);
}
</style>