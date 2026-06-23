# 销售开单功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为商家移动端 H5 新增销售开单功能，包含开单页面和销售单列表页。

**Architecture:** 遵循现有 Vue 3 + Vant UI 架构，使用 `<script setup lang="ts">` 模式。新增 2 个页面组件、5 个 API 函数，修改路由和 Tabbar。所有样式严格遵循 UI v2.0 Token 规范。

**Tech Stack:** Vue 3, Vant 4, TypeScript, Axios

---

## 文件结构

| 文件 | 操作 | 说明 |
|---|---|---|
| `merchant-mobile/src/api.ts` | 修改 | 新增 5 个销售单 API 函数和类型定义 |
| `merchant-mobile/src/router.ts` | 修改 | 新增 `/create-sale` 和 `/sale-bills` 路由 |
| `merchant-mobile/src/App.vue` | 修改 | Tabbar 新增"开单"Tab，注册新视图 |
| `merchant-mobile/src/views/CreateSaleView.vue` | 创建 | 开单主页面（场景切换、客户选择、商品选择、已选列表、收款/链接弹窗） |
| `merchant-mobile/src/views/SaleBillsView.vue` | 创建 | 销售单列表页（筛选、列表、详情弹窗） |

---

## Task 1: 新增 API 函数和类型定义

**Files:**
- Modify: `merchant-mobile/src/api.ts`

- [ ] **Step 1: 在 api.ts 末尾追加销售单相关类型和函数**

在文件末尾（`/* ========== 报表 ========== */` 之后）追加以下内容：

```typescript
/* ========== 销售单 ========== */

export interface SaleBillItem {
  skuId: number
  skuName: string
  boxQty: number
  bottleQty: number
  totalBottleQty: number
  unitPrice: number
  priceType: string
  subtotalAmount: number
}

export interface SaleBillRecord {
  billNo: string
  storeId: number
  customerId: number | null
  customerName: string
  customerType: string
  businessStatus: string
  collectionStatus: string
  receivableAmount: number
  receivedAmount: number
  unreceivedAmount: number
  createdAt: string
}

export interface SaleBillDetail extends SaleBillRecord {
  items: SaleBillItem[]
}

export interface CreateSaleBillParams {
  customerId?: number | null
  customerName?: string
  customerMobile?: string
  discountAmount?: number
  roundingAmount?: number
  remark?: string
  items: {
    skuId: number
    boxQty?: number
    bottleQty?: number
    totalBottleQty: number
    unitPrice?: number
    priceType?: string
  }[]
}

export function createSaleBill(data: CreateSaleBillParams) {
  return api.post('/store/sale-bills', data)
}

export function fetchSaleBills(params: {
  page?: number
  pageSize?: number
  keyword?: string
  collectionStatus?: string
}) {
  return api.get('/store/sale-bills', { params })
}

export function fetchSaleBillDetail(billNo: string) {
  return api.get(`/store/sale-bills/${billNo}`)
}

export function offlinePayment(billNo: string, data: {
  amount: number
  paymentMethod: string
  remark?: string
}) {
  return api.post(`/store/sale-bills/${billNo}/offline-payment`, data)
}

export function createCollectionLink(billNo: string, data: {
  amount: number
  shareChannel?: string
  expireHours?: number
  remark?: string
}) {
  return api.post(`/store/sale-bills/${billNo}/collection-link`, data)
}

/* ========== 商品搜索（用于开单时选商品） ========== */

export interface ProductRecord {
  skuId: number
  skuCode: string
  productName: string
  skuName: string
  barcode: string
  retailPrice: number
  wholesalePrice: number
  storePrice: number
  availableQty: number
}

export function fetchProducts(params: { keyword?: string; barcode?: string }) {
  return api.get('/store/products', { params })
}
```

- [ ] **Step 2: 验证 api.ts 无语法错误**

Run: `cd /workspace/liquor-inventory-system/merchant-mobile && npx tsc --noEmit src/api.ts 2>&1 | head -20`
Expected: 无错误输出（或仅与 api.ts 无关的错误）

---

## Task 2: 新增路由

**Files:**
- Modify: `merchant-mobile/src/router.ts`

- [ ] **Step 1: 在 routes 数组中追加两个新路由**

在 `/reports` 路由之后、`/profile` 路由之前插入：

```typescript
  {
    path: '/create-sale',
    name: 'create-sale',
    component: () => import('./views/CreateSaleView.vue')
  },
  {
    path: '/sale-bills',
    name: 'sale-bills',
    component: () => import('./views/SaleBillsView.vue')
  },
```

---

## Task 3: 修改 App.vue（Tabbar 和视图注册）

**Files:**
- Modify: `merchant-mobile/src/App.vue`

- [ ] **Step 1: 导入新视图组件**

在 `<script setup>` 的 import 区域，在 `ProfileView` 之后添加：

```typescript
import CreateSaleView from './views/CreateSaleView.vue'
import SaleBillsView from './views/SaleBillsView.vue'
```

- [ ] **Step 2: 在 baseTabs 中插入"开单"Tab**

将 `baseTabs` 数组修改为：

```typescript
const baseTabs = [
  { name: 'home', icon: 'wap-home', label: '首页' },
  { name: 'orders', icon: 'orders-o', label: '订单' },
  { name: 'create-sale', icon: 'gold-coin', label: '开单' },
  { name: 'inventory', icon: 'cluster-o', label: '库存' },
  { name: 'customers', icon: 'friends-o', label: '客户' },
  { name: 'profile', icon: 'manager-o', label: '我的' }
]
```

- [ ] **Step 3: 在 views 对象中注册新视图**

将 `views` 对象修改为：

```typescript
const views: Record<string, unknown> = {
  home: HomeView,
  orders: OrdersView,
  'create-sale': CreateSaleView,
  inventory: InventoryView,
  customers: CustomersView,
  receivables: ReceivablesView,
  reports: ReportsView,
  profile: ProfileView,
  'sale-bills': SaleBillsView
}
```

---

## Task 4: 创建 CreateSaleView.vue（开单主页面）

**Files:**
- Create: `merchant-mobile/src/views/CreateSaleView.vue`

- [ ] **Step 1: 创建完整文件**

写入以下完整代码：

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  showToast,
  showLoadingToast,
  showSuccessToast,
  closeToast,
  showDialog
} from 'vant'
import {
  createSaleBill,
  offlinePayment,
  createCollectionLink,
  fetchProducts,
  fetchCustomers,
  type CustomerRecord,
  type ProductRecord,
  type SaleBillDetail
} from '../api'

// ========== 场景 ==========
const SCENE_TABS = [
  { label: '门店现场', value: 'STORE' },
  { label: '外出拜访', value: 'VISIT' }
]
const scene = ref('STORE')

// ========== 客户选择 ==========
const customerKeyword = ref('')
const customerResults = ref<CustomerRecord[]>([])
const selectedCustomer = ref<CustomerRecord | null>(null)
const showCustomerSearch = ref(false)

async function searchCustomers() {
  if (!customerKeyword.value.trim()) return
  try {
    const res = await fetchCustomers({ keyword: customerKeyword.value })
    customerResults.value = res.data.data.records ?? []
  } catch {
    customerResults.value = []
  }
}

function selectCustomer(c: CustomerRecord) {
  selectedCustomer.value = c
  showCustomerSearch.value = false
  customerKeyword.value = ''
  customerResults.value = []
}

function selectWalkIn() {
  selectedCustomer.value = null
  showCustomerSearch.value = false
}

// ========== 商品选择 ==========
const productKeyword = ref('')
const productResults = ref<ProductRecord[]>([])
const showProductSearch = ref(false)

async function searchProducts() {
  if (!productKeyword.value.trim()) return
  try {
    const res = await fetchProducts({ keyword: productKeyword.value })
    productResults.value = res.data.data.records ?? []
  } catch {
    productResults.value = []
  }
}

function onScan() {
  showToast('扫码功能开发中')
}

// ========== 已选商品 ==========
interface SelectedItem {
  skuId: number
  skuName: string
  skuCode: string
  unitPrice: number
  priceType: string
  boxQty: number
  bottleQty: number
  bottlesPerBox: number
}

const selectedItems = ref<SelectedItem[]>([])

function addProduct(p: ProductRecord) {
  const exists = selectedItems.value.find(i => i.skuId === p.skuId)
  if (exists) {
    exists.bottleQty += 1
    showToast('已增加数量')
  } else {
    const isWholesale = selectedCustomer.value?.customerType === 'WHOLESALE'
    const price = isWholesale
      ? (p.wholesalePrice ?? p.retailPrice)
      : (p.storePrice ?? p.retailPrice)
    selectedItems.value.push({
      skuId: p.skuId,
      skuName: p.skuName,
      skuCode: p.skuCode,
      unitPrice: Number(price),
      priceType: isWholesale ? 'WHOLESALE' : 'STORE',
      boxQty: 0,
      bottleQty: 1,
      bottlesPerBox: 6
    })
  }
  showProductSearch.value = false
  productKeyword.value = ''
  productResults.value = []
}

function removeItem(index: number) {
  selectedItems.value.splice(index, 1)
}

function itemTotalBottleQty(item: SelectedItem) {
  return item.boxQty * item.bottlesPerBox + item.bottleQty
}

function itemSubtotal(item: SelectedItem) {
  return item.unitPrice * itemTotalBottleQty(item)
}

const goodsAmount = computed(() =>
  selectedItems.value.reduce((sum, i) => sum + itemSubtotal(i), 0)
)

const discountAmount = ref(0)
const roundingAmount = ref(0)
const receivableAmount = computed(() =>
  Math.max(0, goodsAmount.value - discountAmount.value - roundingAmount.value)
)

// ========== 收款弹窗（门店现场） ==========
const showPaymentSheet = ref(false)
const paymentMethod = ref('')
const paymentAmount = ref(0)

const PAYMENT_OPTIONS = [
  { name: 'CASH', label: '现金' },
  { name: 'OTHER_WECHAT', label: '微信' },
  { name: 'ALIPAY', label: '支付宝' },
  { name: 'TRANSFER', label: '转账' }
]

function openPayment() {
  if (selectedItems.value.length === 0) {
    showToast('请先选择商品')
    return
  }
  paymentAmount.value = receivableAmount.value
  paymentMethod.value = ''
  showPaymentSheet.value = true
}

async function confirmPayment() {
  if (!paymentMethod.value) {
    showToast('请选择收款方式')
    return
  }
  try {
    showLoadingToast({ message: '创建单据...', forbidClick: true })
    const billRes = await createSaleBill({
      customerId: selectedCustomer.value?.memberId ?? null,
      customerName: selectedCustomer.value?.name ?? undefined,
      customerMobile: selectedCustomer.value?.mobile ?? undefined,
      discountAmount: discountAmount.value,
      roundingAmount: roundingAmount.value,
      items: selectedItems.value.map(i => ({
        skuId: i.skuId,
        boxQty: i.boxQty,
        bottleQty: i.bottleQty,
        totalBottleQty: itemTotalBottleQty(i),
        unitPrice: i.unitPrice,
        priceType: i.priceType
      }))
    })
    const bill: SaleBillDetail = billRes.data.data
    closeToast()

    showLoadingToast({ message: '收款中...', forbidClick: true })
    await offlinePayment(bill.billNo, {
      amount: paymentAmount.value,
      paymentMethod: paymentMethod.value
    })
    closeToast()
    showSuccessToast('收款成功')
    resetForm()
    showPaymentSheet.value = false
  } catch (err: any) {
    closeToast()
    showToast(err.response?.data?.message || '操作失败')
  }
}

// ========== 收款链接弹窗（外出拜访） ==========
const showLinkPopup = ref(false)
const linkAmount = ref(0)
const linkExpireHours = ref(72)
const generatedLink = ref('')

function openLinkPopup() {
  if (selectedItems.value.length === 0) {
    showToast('请先选择商品')
    return
  }
  linkAmount.value = receivableAmount.value
  linkExpireHours.value = 72
  generatedLink.value = ''
  showLinkPopup.value = true
}

async function confirmLink() {
  try {
    showLoadingToast({ message: '创建单据...', forbidClick: true })
    const billRes = await createSaleBill({
      customerId: selectedCustomer.value?.memberId ?? null,
      customerName: selectedCustomer.value?.name ?? undefined,
      customerMobile: selectedCustomer.value?.mobile ?? undefined,
      discountAmount: discountAmount.value,
      roundingAmount: roundingAmount.value,
      items: selectedItems.value.map(i => ({
        skuId: i.skuId,
        boxQty: i.boxQty,
        bottleQty: i.bottleQty,
        totalBottleQty: itemTotalBottleQty(i),
        unitPrice: i.unitPrice,
        priceType: i.priceType
      }))
    })
    const bill: SaleBillDetail = billRes.data.data
    closeToast()

    showLoadingToast({ message: '生成链接...', forbidClick: true })
    const linkRes = await createCollectionLink(bill.billNo, {
      amount: linkAmount.value,
      expireHours: linkExpireHours.value
    })
    closeToast()
    const linkData = linkRes.data.data
    const baseUrl = window.location.origin
    generatedLink.value = `${baseUrl}${linkData.shareUrl}`
    showSuccessToast('链接已生成')
  } catch (err: any) {
    closeToast()
    showToast(err.response?.data?.message || '操作失败')
  }
}

function copyLink() {
  if (!generatedLink.value) return
  navigator.clipboard.writeText(generatedLink.value).then(() => {
    showSuccessToast('链接已复制')
  }).catch(() => {
    showToast('复制失败，请手动复制')
  })
}

// ========== 表单重置 ==========
function resetForm() {
  scene.value = 'STORE'
  selectedCustomer.value = null
  selectedItems.value = []
  discountAmount.value = 0
  roundingAmount.value = 0
  paymentMethod.value = ''
  generatedLink.value = ''
}

// ========== 跳转到销售单列表 ==========
function goToSaleBills() {
  window.location.hash = '#/sale-bills'
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">销售开单</h2>
      <van-button type="default" size="small" icon="orders-o" @click="goToSaleBills">
        单据
      </van-button>
    </div>

    <!-- 场景切换 -->
    <van-tabs v-model:active="scene" type="card" class="scene-tabs">
      <van-tab
        v-for="tab in SCENE_TABS"
        :key="tab.value"
        :title="tab.label"
        :name="tab.value"
      />
    </van-tabs>

    <!-- 客户选择 -->
    <div class="card">
      <div class="section-title">客户信息</div>
      <div v-if="selectedCustomer" class="customer-selected">
        <div class="customer-info-row">
          <span class="customer-name">{{ selectedCustomer.name }}</span>
          <van-tag
            :type="selectedCustomer.customerType === 'WHOLESALE' ? 'primary' : 'success'"
            plain
            size="small"
          >
            {{ selectedCustomer.customerType === 'WHOLESALE' ? '批发' : '零售' }}
          </van-tag>
        </div>
        <div class="customer-mobile">{{ selectedCustomer.mobile }}</div>
        <van-button type="default" size="small" plain @click="selectedCustomer = null">
          重新选择
        </van-button>
      </div>
      <div v-else class="customer-actions">
        <van-button type="primary" size="small" icon="search" @click="showCustomerSearch = true">
          搜索客户
        </van-button>
        <van-button type="default" size="small" plain @click="selectWalkIn">
          散客
        </van-button>
      </div>
    </div>

    <!-- 商品选择 -->
    <div class="card">
      <div class="section-title">添加商品</div>
      <div class="product-actions">
        <van-button type="primary" size="small" icon="search" @click="showProductSearch = true">
          搜索商品
        </van-button>
        <van-button type="default" size="small" icon="scan" @click="onScan">
          扫码
        </van-button>
      </div>
    </div>

    <!-- 已选商品列表 -->
    <div v-if="selectedItems.length > 0" class="card">
      <div class="section-title">已选商品</div>
      <div
        v-for="(item, index) in selectedItems"
        :key="item.skuId"
        class="selected-item"
      >
        <div class="item-header">
          <span class="item-name">{{ item.skuName }}</span>
          <span class="item-price">¥{{ item.unitPrice.toFixed(2) }}</span>
        </div>
        <div class="item-qty-row">
          <div class="qty-group">
            <span class="qty-label">箱</span>
            <van-stepper v-model="item.boxQty" :min="0" :max="999" integer />
          </div>
          <div class="qty-group">
            <span class="qty-label">瓶</span>
            <van-stepper v-model="item.bottleQty" :min="0" :max="999" integer />
          </div>
        </div>
        <div class="item-subtotal">
          小计：¥{{ itemSubtotal(item).toFixed(2) }}
          <van-button type="danger" size="mini" plain @click="removeItem(index)">删除</van-button>
        </div>
      </div>
    </div>

    <!-- 汇总栏 -->
    <div class="summary-card">
      <div class="summary-row">
        <span>商品总额</span>
        <span>¥{{ goodsAmount.toFixed(2) }}</span>
      </div>
      <div class="summary-row">
        <span>折扣</span>
        <van-field
          v-model.number="discountAmount"
          type="number"
          class="amount-input"
          placeholder="0"
        />
      </div>
      <div class="summary-row">
        <span>抹零</span>
        <van-field
          v-model.number="roundingAmount"
          type="number"
          class="amount-input"
          placeholder="0"
        />
      </div>
      <div class="summary-row total">
        <span>应收金额</span>
        <span class="total-amount">¥{{ receivableAmount.toFixed(2) }}</span>
      </div>
    </div>

    <!-- 底部操作按钮 -->
    <div class="action-footer">
      <van-button
        v-if="scene === 'STORE'"
        type="primary"
        block
        round
        size="large"
        @click="openPayment"
      >
        立即收款
      </van-button>
      <van-button
        v-else
        type="primary"
        block
        round
        size="large"
        @click="openLinkPopup"
      >
        生成收款链接
      </van-button>
    </div>

    <!-- 客户搜索弹窗 -->
    <van-popup v-model:show="showCustomerSearch" position="bottom" round :style="{ maxHeight: '80%' }">
      <div class="popup-panel">
        <h3>选择客户</h3>
        <van-search
          v-model="customerKeyword"
          placeholder="输入手机号搜索"
          show-action
          @search="searchCustomers"
          @cancel="showCustomerSearch = false"
        />
        <div v-if="customerResults.length === 0" class="empty-wrapper">
          <van-empty description="无搜索结果" />
        </div>
        <van-cell-group v-else inset>
          <van-cell
            v-for="c in customerResults"
            :key="c.memberId"
            is-link
            @click="selectCustomer(c)"
          >
            <template #title>
              <div class="customer-header">
                <span class="customer-name">{{ c.name }}</span>
                <van-tag
                  :type="c.customerType === 'WHOLESALE' ? 'primary' : 'success'"
                  plain
                  size="small"
                >
                  {{ c.customerType === 'WHOLESALE' ? '批发' : '零售' }}
                </van-tag>
              </div>
            </template>
            <template #label>{{ c.mobile }}</template>
          </van-cell>
        </van-cell-group>
      </div>
    </van-popup>

    <!-- 商品搜索弹窗 -->
    <van-popup v-model:show="showProductSearch" position="bottom" round :style="{ maxHeight: '80%' }">
      <div class="popup-panel">
        <h3>选择商品</h3>
        <van-search
          v-model="productKeyword"
          placeholder="输入商品名称/SKU"
          show-action
          @search="searchProducts"
          @cancel="showProductSearch = false"
        />
        <div v-if="productResults.length === 0" class="empty-wrapper">
          <van-empty description="无搜索结果" />
        </div>
        <van-cell-group v-else inset>
          <van-cell
            v-for="p in productResults"
            :key="p.skuId"
            is-link
            @click="addProduct(p)"
          >
            <template #title>
              <span class="product-name">{{ p.skuName }}</span>
            </template>
            <template #label>
              <span class="product-stock">库存: {{ p.availableQty ?? '-' }}</span>
            </template>
            <template #value>
              <span class="product-price">
                ¥{{ (selectedCustomer?.customerType === 'WHOLESALE'
                  ? (p.wholesalePrice ?? p.retailPrice)
                  : (p.storePrice ?? p.retailPrice)
                ).toFixed(2) }}
              </span>
            </template>
          </van-cell>
        </van-cell-group>
      </div>
    </van-popup>

    <!-- 收款 ActionSheet -->
    <van-action-sheet
      v-model:show="showPaymentSheet"
      title="选择收款方式"
      :actions="PAYMENT_OPTIONS.map(o => ({ name: o.label, value: o.name }))"
      @select="(action: any) => { paymentMethod = action.value; confirmPayment() }"
      cancel-text="取消"
    />

    <!-- 收款链接弹窗 -->
    <van-popup v-model:show="showLinkPopup" position="center" round :style="{ width: '90%', maxWidth: '360px' }">
      <div class="link-panel">
        <h3>生成收款链接</h3>
        <van-cell-group inset>
          <van-cell title="收款金额">
            <template #value>
              <span class="link-amount">¥{{ linkAmount.toFixed(2) }}</span>
            </template>
          </van-cell>
          <van-field
            v-model.number="linkExpireHours"
            label="有效期(小时)"
            type="number"
            placeholder="72"
          />
        </van-cell-group>
        <div v-if="generatedLink" class="link-result">
          <van-field
            v-model="generatedLink"
            label="链接"
            readonly
            clickable
            @click="copyLink"
          />
          <van-button type="primary" block size="small" @click="copyLink">复制链接</van-button>
        </div>
        <div v-else class="link-actions">
          <van-button type="primary" block @click="confirmLink">生成链接</van-button>
        </div>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.scene-tabs {
  margin-bottom: 12px;
}

:deep(.scene-tabs .van-tabs__nav--card) {
  border-color: var(--color-primary);
}

:deep(.scene-tabs .van-tab--active) {
  background: var(--color-primary);
  color: var(--text-inverse);
}

:deep(.scene-tabs .van-tab) {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
  margin-bottom: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.customer-actions,
.product-actions {
  display: flex;
  gap: 10px;
}

.customer-selected {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.customer-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.customer-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.customer-mobile {
  font-size: 13px;
  color: var(--text-secondary);
}

.selected-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-normal);
}

.selected-item:last-child {
  border-bottom: none;
}

.item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.item-price {
  font-size: 14px;
  color: var(--color-primary);
  font-weight: 600;
}

.item-qty-row {
  display: flex;
  gap: 20px;
  margin-bottom: 8px;
}

.qty-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qty-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.item-subtotal {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.summary-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-card);
  margin-bottom: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-normal);
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-row.total {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  padding-top: 12px;
}

.total-amount {
  color: var(--color-danger);
  font-size: 18px;
}

.amount-input {
  width: 100px;
  padding: 0;
}

:deep(.amount-input .van-field__control) {
  text-align: right;
}

.action-footer {
  padding: 16px;
  background: var(--bg-card);
  position: sticky;
  bottom: 0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.popup-panel {
  padding: 20px 16px;
  max-height: 80vh;
  overflow-y: auto;
}

.popup-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.empty-wrapper {
  padding: 40px 0;
}

.product-name {
  font-size: 14px;
  color: var(--text-primary);
}

.product-stock {
  font-size: 12px;
  color: var(--text-muted);
}

.product-price {
  font-size: 14px;
  color: var(--color-primary);
  font-weight: 600;
}

.link-panel {
  padding: 20px 16px;
}

.link-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.link-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-danger);
}

.link-result {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.link-actions {
  margin-top: 16px;
}
</style>
```

---

## Task 5: 创建 SaleBillsView.vue（销售单列表页）

**Files:**
- Create: `merchant-mobile/src/views/SaleBillsView.vue`

- [ ] **Step 1: 创建完整文件**

写入以下完整代码：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  showToast,
  showLoadingToast,
  showSuccessToast,
  closeToast,
  showDialog
} from 'vant'
import {
  fetchSaleBills,
  fetchSaleBillDetail,
  offlinePayment,
  createCollectionLink,
  type SaleBillRecord,
  type SaleBillDetail
} from '../api'

const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '未收款', value: 'UNPAID' },
  { label: '部分收款', value: 'PARTIAL' },
  { label: '已收款', value: 'PAID' },
  { label: '已分享', value: 'SHARED' }
]

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  UNPAID: { text: '未收款', type: 'danger' },
  PARTIAL: { text: '部分收款', type: 'warning' },
  PAID: { text: '已收款', type: 'success' },
  SHARED: { text: '已分享', type: 'primary' }
}

const activeTab = ref('')
const bills = ref<SaleBillRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

// 详情弹窗
const showDetail = ref(false)
const detail = ref<SaleBillDetail | null>(null)
const detailLoading = ref(false)

// 收款弹窗
const showPayment = ref(false)
const paymentAmount = ref(0)
const paymentMethod = ref('')
const currentBillNo = ref('')

const PAYMENT_OPTIONS = [
  { name: 'CASH', label: '现金' },
  { name: 'OTHER_WECHAT', label: '微信' },
  { name: 'ALIPAY', label: '支付宝' },
  { name: 'TRANSFER', label: '转账' }
]

// 链接弹窗
const showLink = ref(false)
const linkAmount = ref(0)
const linkExpireHours = ref(72)
const generatedLink = ref('')

async function loadBills(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchSaleBills({
      page: page.value,
      pageSize,
      collectionStatus: activeTab.value || undefined
    })
    const data = res.data.data
    if (reset) {
      bills.value = data.records ?? []
    } else {
      bills.value.push(...(data.records ?? []))
    }
    if (bills.value.length >= (data.total ?? 0)) {
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

function onRefresh() {
  refreshing.value = true
  loadBills(true)
}

function onTabChange() {
  loadBills(true)
}

async function viewDetail(billNo: string) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await fetchSaleBillDetail(billNo)
    detail.value = res.data.data
  } catch {
    // ignore
  } finally {
    detailLoading.value = false
  }
}

function canCollect(status: string) {
  return status === 'UNPAID' || status === 'PARTIAL' || status === 'SHARED'
}

function canShare(status: string) {
  return status === 'UNPAID'
}

function openPaymentFromDetail() {
  if (!detail.value) return
  currentBillNo.value = detail.value.billNo
  paymentAmount.value = detail.value.unreceivedAmount
  paymentMethod.value = ''
  showPayment.value = true
}

async function confirmPayment() {
  if (!paymentMethod.value) {
    showToast('请选择收款方式')
    return
  }
  try {
    showLoadingToast({ message: '收款中...', forbidClick: true })
    await offlinePayment(currentBillNo.value, {
      amount: paymentAmount.value,
      paymentMethod: paymentMethod.value
    })
    closeToast()
    showSuccessToast('收款成功')
    showPayment.value = false
    await loadBills(true)
    if (showDetail.value && detail.value?.billNo === currentBillNo.value) {
      await viewDetail(currentBillNo.value)
    }
  } catch (err: any) {
    closeToast()
    showToast(err.response?.data?.message || '收款失败')
  }
}

function openLinkFromDetail() {
  if (!detail.value) return
  currentBillNo.value = detail.value.billNo
  linkAmount.value = detail.value.unreceivedAmount
  linkExpireHours.value = 72
  generatedLink.value = ''
  showLink.value = true
}

async function confirmLink() {
  try {
    showLoadingToast({ message: '生成链接...', forbidClick: true })
    const res = await createCollectionLink(currentBillNo.value, {
      amount: linkAmount.value,
      expireHours: linkExpireHours.value
    })
    closeToast()
    const linkData = res.data.data
    const baseUrl = window.location.origin
    generatedLink.value = `${baseUrl}${linkData.shareUrl}`
    showSuccessToast('链接已生成')
    await loadBills(true)
    if (showDetail.value && detail.value?.billNo === currentBillNo.value) {
      await viewDetail(currentBillNo.value)
    }
  } catch (err: any) {
    closeToast()
    showToast(err.response?.data?.message || '生成失败')
  }
}

function copyLink() {
  if (!generatedLink.value) return
  navigator.clipboard.writeText(generatedLink.value).then(() => {
    showSuccessToast('链接已复制')
  }).catch(() => {
    showToast('复制失败')
  })
}

function goBack() {
  window.history.back()
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">销售单据</h2>
      <van-button type="default" size="small" icon="arrow-left" @click="goBack">
        返回
      </van-button>
    </div>

    <!-- 状态筛选 -->
    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab
        v-for="tab in STATUS_TABS"
        :key="tab.value"
        :title="tab.label"
        :name="tab.value"
      />
    </van-tabs>

    <!-- 列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadBills"
      >
        <div v-if="bills.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无单据" />
        </div>
        <van-cell
          v-for="bill in bills"
          :key="bill.billNo"
          is-link
          class="bill-cell"
          @click="viewDetail(bill.billNo)"
        >
          <template #title>
            <div class="bill-header">
              <span class="bill-no">{{ bill.billNo }}</span>
              <van-tag
                :type="(STATUS_MAP[bill.collectionStatus]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ STATUS_MAP[bill.collectionStatus]?.text || bill.collectionStatus }}
              </van-tag>
            </div>
          </template>
          <template #label>
            <div class="bill-info">
              <span>{{ bill.customerName || '散客' }}</span>
              <span class="bill-amount">¥{{ Number(bill.receivableAmount).toFixed(2) }}</span>
            </div>
            <div class="bill-time">{{ bill.createdAt }}</div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 详情弹窗 -->
    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      :style="{ maxHeight: '80%' }"
    >
      <div class="detail-panel">
        <h3>单据详情</h3>
        <div v-if="detailLoading" class="detail-loading">
          <van-loading type="spinner" />
        </div>
        <template v-else-if="detail">
          <van-cell-group inset>
            <van-cell title="单号" :value="detail.billNo" />
            <van-cell title="客户" :value="detail.customerName || '散客'" />
            <van-cell title="类型">
              <template #value>
                <van-tag
                  :type="detail.customerType === 'WHOLESALE' ? 'primary' : 'success'"
                  plain
                >
                  {{ detail.customerType === 'WHOLESALE' ? '批发' : '零售' }}
                </van-tag>
              </template>
            </van-cell>
            <van-cell title="应收">
              <template #value>
                <span class="detail-amount">¥{{ Number(detail.receivableAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
            <van-cell title="已收" :value="`¥${Number(detail.receivedAmount).toFixed(2)}`" />
            <van-cell title="未收">
              <template #value>
                <span class="detail-unreceived">¥{{ Number(detail.unreceivedAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
            <van-cell title="状态">
              <template #value>
                <van-tag
                  :type="(STATUS_MAP[detail.collectionStatus]?.type as any) || 'default'"
                  plain
                >
                  {{ STATUS_MAP[detail.collectionStatus]?.text || detail.collectionStatus }}
                </van-tag>
              </template>
            </van-cell>
          </van-cell-group>

          <!-- 商品明细 -->
          <div class="detail-items">
            <h4>商品明细</h4>
            <van-cell-group inset>
              <van-cell
                v-for="item in detail.items"
                :key="item.skuId"
                :title="item.skuName"
                :label="`${item.boxQty}箱${item.bottleQty}瓶 / 共${item.totalBottleQty}瓶`"
              >
                <template #value>
                  ¥{{ Number(item.subtotalAmount).toFixed(2) }}
                </template>
              </van-cell>
            </van-cell-group>
          </div>

          <!-- 操作按钮 -->
          <div class="detail-actions">
            <van-button
              v-if="canCollect(detail.collectionStatus)"
              type="primary"
              block
              @click="openPaymentFromDetail"
            >
              {{ detail.collectionStatus === 'PARTIAL' || detail.collectionStatus === 'SHARED' ? '继续收款' : '立即收款' }}
            </van-button>
            <van-button
              v-if="canShare(detail.collectionStatus)"
              type="success"
              block
              @click="openLinkFromDetail"
            >
              生成收款链接
            </van-button>
          </div>
        </template>
      </div>
    </van-popup>

    <!-- 收款 ActionSheet -->
    <van-action-sheet
      v-model:show="showPayment"
      title="选择收款方式"
      :actions="PAYMENT_OPTIONS.map(o => ({ name: o.label, value: o.name }))"
      @select="(action: any) => { paymentMethod = action.value; confirmPayment() }"
      cancel-text="取消"
    />

    <!-- 链接弹窗 -->
    <van-popup v-model:show="showLink" position="center" round :style="{ width: '90%', maxWidth: '360px' }">
      <div class="link-panel">
        <h3>生成收款链接</h3>
        <van-cell-group inset>
          <van-cell title="收款金额">
            <template #value>
              <span class="link-amount">¥{{ linkAmount.toFixed(2) }}</span>
            </template>
          </van-cell>
          <van-field
            v-model.number="linkExpireHours"
            label="有效期(小时)"
            type="number"
            placeholder="72"
          />
        </van-cell-group>
        <div v-if="generatedLink" class="link-result">
          <van-field
            v-model="generatedLink"
            label="链接"
            readonly
            clickable
            @click="copyLink"
          />
          <van-button type="primary" block size="small" @click="copyLink">复制链接</van-button>
        </div>
        <div v-else class="link-actions">
          <van-button type="primary" block @click="confirmLink">生成链接</van-button>
        </div>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-wrapper {
  padding: 40px 0;
}

.bill-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.bill-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.bill-no {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.bill-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
}

.bill-amount {
  font-weight: 600;
  color: var(--color-primary);
}

.bill-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.detail-panel {
  padding: 20px 16px;
  max-height: 80vh;
  overflow-y: auto;
}

.detail-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.detail-loading {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.detail-amount {
  font-weight: 600;
  color: var(--color-primary);
  font-size: 16px;
}

.detail-unreceived {
  font-weight: 600;
  color: var(--color-danger);
  font-size: 16px;
}

.detail-items {
  margin-top: 12px;
}

.detail-items h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.detail-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.link-panel {
  padding: 20px 16px;
}

.link-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.link-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-danger);
}

.link-result {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.link-actions {
  margin-top: 16px;
}
</style>
```

---

## Task 6: 构建和验证

- [ ] **Step 1: 运行构建**

Run: `cd /workspace/liquor-inventory-system/merchant-mobile && npm run build 2>&1`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 2: 检查构建产物**

Run: `ls -la /workspace/liquor-inventory-system/merchant-mobile/dist/`
Expected: 存在 `index.html` 和 `assets/` 目录

---

## Task 7: 部署到服务器

- [ ] **Step 1: 复制构建产物到服务器 Nginx 目录**

Run:
```bash
scp -r /workspace/liquor-inventory-system/merchant-mobile/dist/* root@159.75.153.59:/var/www/merchant-mobile/
```
或如果已在服务器上构建：
```bash
cd /workspace/liquor-inventory-system/merchant-mobile && npm run build
```

- [ ] **Step 2: 确保 Nginx 配置正确并重载**

Run: `ssh root@159.75.153.59 "nginx -t && nginx -s reload"`
Expected: `syntax is ok`, `test is successful`

- [ ] **Step 3: 浏览器验证**

访问 http://159.75.153.59，确认：
1. Tabbar 出现"开单"Tab
2. 点击"开单"进入 CreateSaleView
3. 能搜索客户、搜索商品、添加商品
4. 能切换场景、显示汇总金额
5. 点击"单据"按钮能进入 SaleBillsView
6. 列表页有状态筛选、下拉刷新、上拉加载

---

## Spec 覆盖检查

| 设计文档章节 | 对应任务 | 状态 |
|---|---|---|
| 3.1-A 场景切换栏 | Task 4 | ✅ |
| 3.1-B 客户选择区 | Task 4 | ✅ |
| 3.1-C 商品选择区 | Task 4 | ✅ |
| 3.1-D 已选商品列表 | Task 4 | ✅ |
| 3.1-E 收款弹窗 | Task 4 | ✅ |
| 3.1-F 收款链接弹窗 | Task 4 | ✅ |
| 3.2 SaleBillsView | Task 5 | ✅ |
| 4 API 对接 | Task 1 | ✅ |
| 5 路由变更 | Task 2 | ✅ |
| 6 Tabbar 变更 | Task 3 | ✅ |
| 7 价格计算 | Task 4 (addProduct) | ✅ |
| 7 库存扣减时机 | Task 4 (confirmPayment 调用 offlinePayment) | ✅ |
| 7 数量输入 | Task 4 (boxQty + bottleQty) | ✅ |
| 8 错误处理 | Task 4/5 (try/catch + showToast) | ✅ |

## Placeholder 扫描

- 无 "TBD"/"TODO" 残留
- 无 "implement later"
- 无 "Add appropriate error handling" 等模糊描述
- 所有步骤包含完整代码
- 所有类型引用一致

## 类型一致性检查

- `SaleBillRecord` / `SaleBillDetail` / `SaleBillItem` 在 api.ts 和视图组件中一致
- `CreateSaleBillParams` 的 items 结构与后端 `storeSaleBillItemSchema` 兼容
- `ProductRecord` 字段与后端 `/store/products` 返回一致
- `CustomerRecord` 复用现有类型，字段一致
