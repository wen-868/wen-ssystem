# 阿澈 · Phase 2 商品管理模块

**日期**：2026-06-28
**状态**：待开始
**验收标准**：对照 `tasks/field-audit-product-center.md` 逐字段验证，不能遗漏任何字段

---

## 任务概览

| # | 任务 | 优先级 | 依赖 | 预计文件 | 状态 |
|---|------|--------|------|----------|------|
| 1 | 分类 API 化（替换硬编码） | P0 | 阿坚#2 | 2个文件改动 | 待开始 |
| 2 | 商品详情页 ProductDetailView.vue | P0 | 阿坚#3 | 1个新文件 | 待开始 |
| 3 | AdminProductsView 增强 | P1 | 阿坚#6 | 1个文件改动 | 待开始 |
| 4 | 商品搜索优化 | P1 | 无 | 1个文件改动 | 待开始 |
| 5 | 路由+导航注册 | P0 | 无 | 2个文件改动 | 待开始 |

---

## 1. 分类 API 化（P0）

### 修改文件

**文件**：`merchant-mobile/src/views/ProductsView.vue`（274行）
**配合文件**：`merchant-mobile/src/api.ts`

### 当前问题

分类为前端硬编码：
```typescript
const categories = [
  { value: 'all', label: '全部' },
  { value: 'baijiu', label: '白酒' },
  { value: 'hongjiu', label: '红酒' },
  { value: 'pijiu', label: '啤酒' },
  { value: 'other', label: '其他' }
]
```

### 改动步骤

#### 1.1 新增 API 函数

**文件**：`merchant-mobile/src/api.ts`

```typescript
// Phase 2 新增
export interface CategoryRecord {
  id: number
  parentId: number | null
  name: string
  icon: string | null
  code: string | null
  sortNo: number
  status: number
}

export async function fetchCategories(): Promise<{ data: CategoryRecord[] }> {
  return api.get('/admin/products/categories')
}
```

#### 1.2 修改 ProductsView.vue

```typescript
// 替换硬编码的 categories
import { ref, onMounted } from 'vue'
import { fetchCategories, type CategoryRecord } from '../api'

const categoryList = ref<CategoryRecord[]>([])
const activeCategoryId = ref<number | null>(null) // null = 全部

// 初始化加载分类
onMounted(async () => {
  try {
    const res = await fetchCategories()
    categoryList.value = res.data ?? []
  } catch { /* 保持空状态 */ }
})

// 渲染时动态生成分类标签
const displayCategories = computed(() => [
  { id: null, name: '全部' },
  ...categoryList.value
])

// 切换分类时传 categoryId
function switchCategory(catId: number | null) {
  activeCategoryId.value = catId
  loadProducts()
}

// loadProducts 中传 categoryId
async function loadProducts() {
  const res = await fetchProducts({
    keyword: keyword.value || undefined,
    categoryId: activeCategoryId.value ?? undefined
  })
}
```

模板中：
```html
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
```

### 验收清单

- [ ] 分类列表从后端动态加载
- [ ] 分类切换传 `categoryId` 而非硬编码字符串
- [ ] "全部"作为默认选项（categoryId=null）
- [ ] 分类为空时显示"全部"一项
- [ ] 字段与审计报告 3.3 节一致

---

## 2. 商品详情页 ProductDetailView.vue（P0）

### 新建文件

**文件**：`merchant-mobile/src/views/ProductDetailView.vue`

### 功能要求

从 ProductsView 商品卡片点击跳转，展示完整商品信息。

#### 页面结构

```
┌─────────────────────────────┐
│  ← 返回    商品详情          │  导航栏
├─────────────────────────────┤
│  [主图] [轮播图1] [轮播图2]   │  图片轮播（van-swipe）
├─────────────────────────────┤
│  商品名称                     │
│  品牌：茅台  单位：瓶         │
│  规格：500ml  酒精度：53%vol  │
│  产地：贵州茅台镇             │
│  [新品] [推荐]               │  标签
├─────────────────────────────┤
│  商品简介：经典酱香...        │
├─────────────────────────────┤
│  SKU 规格                    │
│  ┌─────────────────────────┐ │
│  │ 500ml │ 瓶装 │ 1×6箱规  │ │  SKU 卡片列表
│  │ 条码：6901234567890     │ │
│  │ 常温 | 溯源码 | 预警10瓶  │ │
│  └─────────────────────────┘ │
│  ┌─────────────────────────┐ │
│  │ 1L    │ 桶装 │ 1×1      │ │
│  │ ...                     │ │
│  └─────────────────────────┘ │
├─────────────────────────────┤
│  价格信息                     │
│  零售价：¥1499.00            │
│  批发价：¥1200.00            │
│  库存：120 瓶                │
└─────────────────────────────┘
```

#### 字段清单

| 区域 | 字段 | 来源 |
|------|------|------|
| 基本信息 | name, brand, unit, specs, alcoholContent, origin, isNew, isRecommend, description | SPU |
| 图片 | mainImage, imageUrls | SPU |
| SKU 列表 | skuName, barcode, volume, packaging, baseUnit, boxUnit, boxRatio, temperature, traceEnabled, warningThreshold | SKU |
| 价格 | retailPrice, wholesalePrice | product_price |
| 库存 | availableQty | inventory |

#### API 调用

```typescript
// 在 merchant-mobile/src/api.ts 中新增
export async function fetchProductDetail(spuId: number) {
  return api.get(`/admin/products/${spuId}`)
}
// 或通过 store 接口
export async function fetchStoreProductDetail(spuId: number) {
  return api.get(`/store/products/${spuId}`)
}
```

#### 路由参数

```typescript
// 从 URL 获取 spuId
import { useRoute } from 'vue-router'
const route = useRoute()
const spuId = Number(route.params.spuId)
```

### 验收清单

- [ ] 从 ProductsView 商品卡片点击跳转正常
- [ ] 页面展示全部字段（SPU 10 + SKU 13 + 价格 2 + 库存 1）
- [ ] 图片轮播正常
- [ ] SKU 列表展示完整
- [ ] 价格信息展示完整
- [ ] Vant 组件风格与现有页面一致
- [ ] 字段与审计报告 3.1 节一致

---

## 3. AdminProductsView 增强（P1）

### 修改文件

**文件**：`merchant-mobile/src/views/AdminProductsView.vue`

### 改动内容

#### 3.1 分类筛选

从 API 获取分类列表，添加分类筛选栏（参考 ProductsView 的分类栏样式）。

#### 3.2 商品搜索

添加搜索栏（van-search），支持按名称/条码/SKU 编码搜索。

#### 3.3 列表项增强

当前每项显示内容不足，需要增加：
- 分类名称（categoryName）
- 品牌（brand）
- SKU 数量（显示为 "3个SKU"）

列表项结构：
```
┌─────────────────────────────┐
│ 茅台飞天              ON_SALE│
│ 白酒 | 茅台 | 3个SKU        │
│ 零售价 ¥1499.00            │
│ [上架] [下架] [改价] [详情]  │
└─────────────────────────────┘
```

#### 3.4 新建商品入口

在页面顶部添加"新建商品"按钮，点击跳转到新建商品页面或弹窗。

### 验收清单

- [ ] 分类筛选从 API 动态加载
- [ ] 搜索功能正常（名称/条码/SKU）
- [ ] 列表项展示 categoryName、brand、SKU 数量
- [ ] 新建商品入口可点击
- [ ] 商品详情跳转入口正常

---

## 4. 商品搜索优化（P1）

### 修改文件

**文件**：`merchant-mobile/src/views/ProductsView.vue`

### 改动内容

#### 4.1 搜索历史

```typescript
// localStorage 存储最近 10 条搜索记录
const SEARCH_HISTORY_KEY = 'product_search_history'
const MAX_HISTORY = 10

function getSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]')
  } catch { return [] }
}

function saveSearchHistory(keyword: string) {
  const history = getSearchHistory().filter(h => h !== keyword)
  history.unshift(keyword)
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY)
}
```

UI：搜索框获得焦点时显示搜索历史列表（van-tag），每项可点击搜索，底部有"清除历史"按钮。

#### 4.2 热门搜索标签

```typescript
// 热门搜索（可配置，初期前端硬编码，后续从后端获取）
const hotKeywords = ['茅台', '五粮液', '啤酒', '红酒', '洋酒', '扫码']
```

UI：搜索框下方显示热门搜索标签（van-tag），点击直接搜索。

#### 4.3 扫码功能保持

保持现有微信扫码 + 浏览器摄像头两种方式。

### 验收清单

- [ ] 搜索历史功能正常（记录/展示/清除）
- [ ] 热门搜索标签展示（≥6个）
- [ ] 扫码功能保持正常
- [ ] 搜索体验流畅

---

## 5. 路由+导航注册（P0）

### 5.1 路由注册

**文件**：`merchant-mobile/src/router.ts`

```typescript
// 在 routes 数组中新增
{
  path: '/products/:spuId',
  name: 'ProductDetail',
  component: () => import('@/views/ProductDetailView.vue'),
  meta: { title: '商品详情' }
}
```

### 5.2 商品卡片点击跳转

**文件**：`merchant-mobile/src/views/ProductsView.vue`

在商品卡片上添加点击事件：
```html
<div
  v-for="item in products"
  :key="item.skuId"
  class="product-card"
  @click="$router.push(`/products/${item.spuId}`)"
>
```

### 5.3 AdminProductsView 详情跳转

**文件**：`merchant-mobile/src/views/AdminProductsView.vue`

在商品列表项添加"详情"按钮或整行点击跳转：
```html
@click="$router.push(`/products/${item.spuId}`)"
```

### 验收清单

- [ ] 路由 `/products/:spuId` 注册正确
- [ ] ProductsView 商品卡片点击跳转正常
- [ ] AdminProductsView 商品详情跳转正常
- [ ] 返回按钮正常

---

## 验收总清单

| 检查项 | 状态 |
|--------|:---:|
| 分类从后端动态加载（替换硬编码） | ☐ |
| 分类切换传 categoryId | ☐ |
| ProductDetailView.vue 页面完整 | ☐ |
| 详情页展示全部字段（SPU 10 + SKU 13 + 价格 2 + 库存 1） | ☐ |
| AdminProductsView 含分类筛选+搜索 | ☐ |
| AdminProductsView 列表项含 categoryName/brand/SKU数量 | ☐ |
| 搜索历史功能正常 | ☐ |
| 热门搜索标签正常 | ☐ |
| 扫码功能保持正常 | ☐ |
| 路由 `/products/:spuId` 注册正确 | ☐ |
| 商品卡片点击跳转详情 | ☐ |
| 所有页面字段与 `tasks/field-audit-product-center.md` 一致 | ☐ |