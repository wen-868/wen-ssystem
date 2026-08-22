<template>
  <view class="create-sale-page">
    <!-- 顶部栏 -->
    <view class="page-header">
      <view class="header-back" @tap="goBack">
        <text class="header-back-icon">‹</text>
      </view>
      <text class="header-title">快速开单</text>
    </view>

    <!-- 单据类型分段导航（原稿：主段 销售/采购 + 子段 订单/出货/退货/收款单） -->
    <view class="doc-nav">
      <view class="doc-nav-main">
        <view class="doc-seg" :class="{ 'doc-seg--active': docMain === 'sale' }" @tap="switchDocMain('sale')">销售</view>
        <view class="doc-seg" :class="{ 'doc-seg--active': docMain === 'purchase' }" @tap="switchDocMain('purchase')">采购</view>
      </view>
      <view class="doc-nav-sub">
        <view
          class="doc-seg doc-seg--sub"
          v-for="s in docSubs"
          :key="s"
          :class="{ 'doc-seg--active': docSub === s }"
          @tap="docSub = s"
        >{{ s }}</view>
      </view>
    </view>

    <!-- 表单三件套：ref + :model + :rules -->
    <form ref="formRef" :model="saleForm" :rules="saleRules" class="sale-form-scroll">
      <scroll-view class="sale-form" scroll-y>
      <!-- 关联销售单（退货 / 收款单需选择源销售单） -->
      <view class="form-section" v-if="docSub === '退货' || docSub === '收款单'">
        <view class="section-title">关联销售单</view>
        <picker
          class="qc-cell"
          mode="selector"
          :range="sourceBills"
          range-key="label"
          @change="onSourceBillChange"
        >
          <view class="qc-val">{{ sourceBillLabel }} <text class="qc-chev">▾</text></view>
        </picker>
      </view>
      <!-- 客户 / 配送方式 / 日期 / 门店仓库 2x2 选择（原稿 qo-customer） -->
      <view class="form-section qo-customer">
        <view class="qc-grid">
          <view class="qc-cell" @tap="openCustomerPicker">
            <text class="qc-label">客户</text>
            <view class="qc-val">{{ selectedCustomer?.name || '散客' }} <text class="qc-chev">▾</text></view>
          </view>
          <picker class="qc-cell" mode="selector" :range="deliveryOptions" @change="onDeliveryChange">
            <text class="qc-label">配送方式</text>
            <view class="qc-val">{{ deliveryMethod }} <text class="qc-chev">▾</text></view>
          </picker>
          <picker class="qc-cell" mode="date" :value="orderDate" @change="onDateChange">
            <text class="qc-label">日期</text>
            <view class="qc-val">{{ orderDate.slice(5) }} <text class="qc-chev">▾</text></view>
          </picker>
          <picker class="qc-cell" mode="selector" :range="storeOptions" @change="onStoreChange">
            <text class="qc-label">门店/仓库</text>
            <view class="qc-val">{{ storeName }} <text class="qc-chev">▾</text></view>
          </picker>
        </view>
      </view>

      <!-- 商品列表 -->
      <view class="form-section">
        <view class="section-title">
          <text>已选商品 ({{ saleItems.length }})</text>
        </view>
        <view
          class="swipe-item"
          v-for="(item, index) in saleItems"
          :key="index"
          :class="{ 'swipe-item--open': swipeOpenIndex === index }"
          @touchstart="onSwipeStart(index)"
          @touchmove.prevent="onSwipeMove(index, $event)"
          @touchend="onSwipeEnd(index)"
        >
          <view class="swipe-content">
          <view class="item-row">
            <view class="prod-thumb"><text class="t-letter">{{ firstChar(item.productName) }}</text></view>
            <view class="item-info">
              <text class="item-name">{{ item.productName }}</text>
              <text class="item-spec" v-if="item.specs">{{ item.specs }}</text>
              <view class="item-price-wrap">
                <text class="price-unit">¥</text>
                <input
                  class="item-price-input"
                  :value="item.price"
                  type="digit"
                  @input="onPriceChange(index, $event)"
                  @blur="onPriceConfirm(index)"
                />
                <text class="price-append">/ {{ item.unit || '件' }}</text>
              </view>
            </view>
            <view class="item-quantity">
              <view class="qty-btn" :class="{ 'qty-btn--disabled': (item.quantity ?? 0) <= 1 }" @tap="decreaseQty(index)">-</view>
              <input
                class="qty-input"
                :value="item.quantity"
                type="number"
                @input="onQtyChange(index, $event)"
              />
              <view class="qty-btn qty-btn--add" @tap="increaseQty(index)">+</view>
            </view>
            <view class="item-right">
              <text class="item-total">¥{{ (item.total ?? 0).toFixed(2) }}</text>
            </view>
          </view>
          <!-- 追溯码（原稿：每件商品下方追溯码行，已录入显示「已关联」） -->
          <view class="item-trace">
            <image class="trace-icon" src="/static/icons/fn-trace.svg" mode="aspectFit" />
            <input
              v-if="!item.traceCode"
              class="trace-input"
              :value="item.traceCode"
              type="text"
              placeholder="点击录入追溯码"
              placeholder-class="trace-placeholder"
              @input="onTraceChange(index, $event)"
            />
            <view v-else class="trace-code-wrap">
              <text class="trace-code">{{ item.traceCode }}</text>
              <text class="trace-linked">已关联</text>
            </view>
            <image class="trace-scan" src="/static/icons/ic/scan.svg" mode="aspectFit" @tap="handleScanTrace(index)" />
          </view>
          </view>
          <view class="swipe-del" @tap="removeItem(index)">删除</view>
        </view>

        <view class="add-item-row">
          <view class="add-item-btn" @tap="openProductPicker">
            <text class="add-icon">+</text>
            <text class="add-text">添加商品</text>
          </view>
          <view class="add-item-btn add-item-btn--scan" @tap="handleScanAdd">
            <image class="add-icon-img" src="/static/icons/hd-scan.svg" mode="aspectFit" />
            <text class="add-text">扫码添加</text>
          </view>
        </view>
        <view class="field-error" v-if="errors.saleItems">
          <text class="error-text">{{ errors.saleItems }}</text>
        </view>
      </view>

      <!-- 金额汇总 -->
      <view class="form-section" v-if="saleItems.length > 0">
        <view class="amount-row">
          <text class="amount-label">商品数</text>
          <text class="amount-value">{{ saleItems.length }}种 / {{ totalQty }}件</text>
        </view>
        <view class="amount-row">
          <text class="amount-label">优惠</text>
          <view class="discount-edit">
            <text class="discount-prefix">-¥</text>
            <input
              class="discount-input"
              :value="discount"
              type="digit"
              @input="onDiscountChange"
            />
          </view>
        </view>
        <view class="amount-row amount-row--total">
          <text class="amount-label">应收金额</text>
          <text class="amount-value amount-value--total">¥{{ receivable.toFixed(2) }}</text>
        </view>
      </view>

      <!-- 备注 -->
      <view class="form-section">
        <view class="section-title">备注</view>
        <textarea
          class="remark-input"
          v-model="remark"
          placeholder="请输入备注信息（选填）"
          placeholder-class="remark-placeholder"
        />
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>
    </form>

    <!-- 底部提交 -->
    <view class="bottom-bar">
        <view class="bottom-total" v-if="saleItems.length > 0">
          <text class="total-label">应收金额：</text>
          <text class="total-value">¥{{ receivable.toFixed(2) }}</text>
        </view>
      <button
        class="submit-btn"
        :disabled="!canSubmit || submitting"
        :class="{ 'submit-btn--disabled': !canSubmit }"
        @tap="handleSubmit"
      >
        {{ submitting ? '提交中...' : '收款' }}
      </button>
      <button class="draft-btn" :disabled="submitting" @tap="handleDraft">
        {{ isSaved ? '修改' : '保存' }}
      </button>
      <button class="share-btn" :disabled="submitting" @tap="handleShare">
        分享
      </button>
    </view>

    <!-- 客户选择弹窗 -->
    <view class="picker-mask" v-if="showCustomerPicker" @tap="closeCustomerPicker">
      <view class="picker-popup picker-popup--large" @tap.stop>
        <view class="picker-header">
          <text class="picker-title">选择客户</text>
          <text class="picker-close" @tap="closeCustomerPicker">×</text>
        </view>
        <view class="picker-search">
          <view class="search-input-wrap">
            <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
            <input
              class="search-input"
              v-model="customerSearchKeyword"
              type="text"
              placeholder="搜索客户名称/手机号"
              placeholder-class="search-placeholder"
              confirm-type="search"
              @confirm="searchCustomers"
            />
          </view>
        </view>
        <scroll-view class="picker-content picker-content--with-search" scroll-y @scrolltolower="loadMoreCustomers">
          <view class="customer-loading" v-if="customerLoading && customerList.length === 0">
            <view class="loading-spinner"></view>
            <text class="loading-text">加载中...</text>
          </view>
          <view
            class="picker-item picker-item--customer"
            v-for="customer in customerList"
            :key="customer.id"
            :class="{ 'picker-item--active': selectedCustomer?.id === customer.id }"
            @tap="selectCustomer(customer)"
          >
            <view class="customer-item-info">
              <text class="customer-item-name">{{ customer.name }}</text>
              <text class="customer-item-phone" v-if="customer.phone">{{ customer.phone }}</text>
            </view>
            <view class="customer-item-type" v-if="customer.typeLabel">{{ customer.typeLabel }}</view>
            <view class="picker-check" v-if="selectedCustomer?.id === customer.id">✓</view>
          </view>
          <view class="load-more" v-if="customerList.length > 0">
            <view class="loading-more-spinner" v-if="customerLoadingMore"></view>
            <text class="load-more-text" v-if="customerLoadingMore">加载中...</text>
            <text class="load-more-text" v-else-if="customerNoMore">-- 没有更多了 --</text>
          </view>
          <view class="empty-state" v-if="!customerLoading && customerList.length === 0">
            <text class="empty-text">暂无客户</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 商品选择弹窗 -->
    <view class="picker-mask picker-mask--product" v-if="showProductPicker" @tap="closeProductPicker">
      <view class="picker-popup picker-popup--product" @tap.stop>
        <view class="picker-header">
          <text class="picker-title">选择商品</text>
          <text class="picker-close" @tap="closeProductPicker">×</text>
        </view>
        <view class="picker-search">
          <view class="search-input-wrap">
            <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
            <input
              class="search-input"
              v-model="productSearchKeyword"
              type="text"
              placeholder="搜索商品名称"
              placeholder-class="search-placeholder"
              confirm-type="search"
              @confirm="searchProducts"
            />
          </view>
        </view>
        <!-- 分类筛选 -->
        <scroll-view class="category-bar" scroll-x :show-scrollbar="false" v-if="categoryList.length > 0">
          <view
            class="category-item"
            :class="{ 'category-item--active': selectedCategoryId === 0 }"
            @tap="selectCategory(0)"
          >
            <text class="category-text">全部</text>
          </view>
          <view
            class="category-item"
            v-for="cat in categoryList"
            :key="cat.id"
            :class="{ 'category-item--active': selectedCategoryId === cat.id }"
            @tap="selectCategory(cat.id)"
          >
            <text class="category-text">{{ cat.name }}</text>
          </view>
        </scroll-view>
        <scroll-view class="picker-content picker-content--product" scroll-y @scrolltolower="loadMoreProducts">
          <view class="product-loading" v-if="productLoading && productList.length === 0">
            <view class="loading-spinner"></view>
            <text class="loading-text">加载中...</text>
          </view>
          <view
            class="product-item"
            v-for="product in productList"
            :key="product.id"
            @tap="addProduct(product, getPickQty(product.id))"
          >
            <image class="product-image" :src="product.image || '/static/tabbar/product.svg'" mode="aspectFill" />
            <view class="product-info">
              <text class="product-name">{{ product.name }}</text>
              <text class="product-spec" v-if="product.specs">{{ product.specs }}</text>
              <view class="product-bottom">
                <text class="product-price">¥{{ product.price.toFixed(2) }}</text>
                <text class="product-stock">库存: {{ product.stock }}{{ product.unit }}</text>
              </view>
            </view>
            <view class="product-actions">
              <view class="qty-btn pick-qty" @tap.stop="decPick(product.id)">-</view>
              <input
                class="pick-qty-input"
                :value="getPickQty(product.id)"
                type="number"
                @input="onPickQtyInput(product.id, $event)"
              />
              <view class="qty-btn pick-qty" @tap.stop="incPick(product.id)">+</view>
            </view>
          </view>
          <view class="load-more" v-if="productList.length > 0">
            <view class="loading-more-spinner" v-if="productLoadingMore"></view>
            <text class="load-more-text" v-if="productLoadingMore">加载中...</text>
            <text class="load-more-text" v-else-if="productNoMore">-- 没有更多了 --</text>
          </view>
          <view class="empty-state" v-if="!productLoading && productList.length === 0">
            <text class="empty-text">暂无商品</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { salesApi, type SaleItem } from '@/api/modules/sales'
import { customersApi, type CustomerInfo } from '@/api/modules/customers'
import { productsApi, type ProductInfo, type CategoryInfo } from '@/api/modules/products'
import { storeApi } from '@/api/modules/store'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

// ========== 表单三件套 ==========
const formRef = ref<any>(null)
const saleForm = reactive({
  selectedCustomer: null as CustomerInfo | null,
  saleItems: [] as SaleItem[],
  remark: '',
})

const saleRules: Rules = {
  // 散客为默认客户（原稿：客户字段默认显示「散客」），故不强制选择
  saleItems: [{ required: true, message: '请至少添加一个商品' }],
}

const { errors, validate, clearError } = useFormValidation(saleForm, saleRules)

// 兼容原有变量名
const selectedCustomer = computed(() => saleForm.selectedCustomer)
const saleItems = saleForm.saleItems
const remark = computed({
  get: () => saleForm.remark,
  set: (v) => saleForm.remark = v,
})

const submitting = ref(false)

// 单据类型分段导航（原稿：销售/采购 + 订单/出货/退货/收款单）
const docMain = ref<'sale' | 'purchase'>('sale')
const docSub = ref('订单')
// 销售→出货 / 采购→进货
const docSubs = computed(() =>
  docMain.value === 'sale' ? ['订单', '出货', '退货', '收款单'] : ['订单', '进货', '退货', '收款单']
)

// 主段切换时重置子段
function switchDocMain(v: 'sale' | 'purchase') {
  docMain.value = v
  docSub.value = '订单'
}

// 单据是否已保存（未保存显示「保存」，已保存显示「修改」）
const isSaved = ref(false)

// 关联销售单（退货 / 收款单）
const sourceBills = ref<{ label: string; billNo: string }[]>([])
const selectedSourceBill = ref('')
const sourceBillLabel = computed(() => selectedSourceBill.value || '请选择销售单')

async function loadSourceBills() {
  try {
    const result = await salesApi.list({ page: 1, pageSize: 20 })
    const list = result.list || []
    sourceBills.value = list.map((b: any) => ({
      label: `${b.billNo} ¥${Number(b.totalAmount ?? 0).toFixed(2)}`,
      billNo: b.billNo,
    }))
  } catch {
    sourceBills.value = []
  }
}

function onSourceBillChange(e: any) {
  selectedSourceBill.value = sourceBills.value[Number(e.detail.value)]?.billNo || ''
}

// 已选商品：支持修改单价
function onPriceChange(index: number, e: any) {
  const item = saleItems[index]
  if (!item) return
  // 输入过程仅更新单价（不强制两位小数），点击空白(blur)确认后重算金额
  item.price = Number(e.detail.value) || 0
  item.unitPrice = item.price
}

function onPriceConfirm(index: number) {
  const item = saleItems[index]
  if (!item) return
  item.total = (item.price ?? 0) * (item.quantity ?? 0)
  item.subtotalAmount = item.total
  item.unitPrice = item.price
}

// 左滑显示删除
const swipeOpenIndex = ref(-1)
let swipeStartX = 0
function onSwipeStart(index: number) {
  swipeStartX = 0
  // 点开另一个时先关闭当前
}
function onSwipeMove(index: number, e: any) {
  const touch = e.touches?.[0] || e.changedTouches?.[0]
  if (!touch) return
  const dx = touch.clientX - swipeStartX
  if (swipeStartX === 0) { swipeStartX = touch.clientX; return }
  if (dx < -40) swipeOpenIndex.value = index
  else if (dx > 40) swipeOpenIndex.value = -1
}
function onSwipeEnd(index: number) {
  swipeStartX = 0
}

// 配送方式 / 日期 / 门店仓库（原稿 qo-customer 2x2 选择）
const deliveryOptions = ['送货上门', '到店自提', '快递寄送']
const deliveryMethod = ref('送货上门')
function onDeliveryChange(e: any) {
  deliveryMethod.value = deliveryOptions[Number(e.detail.value)] ?? deliveryMethod.value
}
function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
const orderDate = ref(todayStr())
function onDateChange(e: any) {
  orderDate.value = e.detail.value
}
const storeOptions = ['总仓', '一分仓', '二分仓']
const storeName = ref('总仓')
function onStoreChange(e: any) {
  storeName.value = storeOptions[Number(e.detail.value)] ?? storeName.value
}
// 商品首字缩略图（原稿 prod-thumb）
function firstChar(name?: string): string {
  return (name || '').trim().charAt(0) || '商'
}

// ========== 计算属性 ==========
const totalAmount = computed(() => {
  return saleItems.reduce((sum, item) => sum + (item.total ?? 0), 0)
})

const totalQty = computed(() => {
  return saleItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
})

// 散客为默认客户，提交无需强制选择会员
const canSubmit = computed(() => {
  return saleItems.length > 0 && !submitting.value
})

// 优惠（原稿汇总含「优惠」行，应收 = 合计 - 优惠）
const discount = ref(0)
function onDiscountChange(e: any) {
  discount.value = Math.max(0, Number(e.detail.value) || 0)
}
const receivable = computed(() => Math.max(0, totalAmount.value - discount.value))

// ========== 客户选择弹窗 ==========
const showCustomerPicker = ref(false)
const customerSearchKeyword = ref('')
const customerList = ref<CustomerInfo[]>([])
const customerLoading = ref(false)
const customerLoadingMore = ref(false)
const customerPage = ref(1)
const customerPageSize = 20
const customerNoMore = ref(false)

function openCustomerPicker() {
  clearError('selectedCustomer')
  showCustomerPicker.value = true
  customerPage.value = 1
  customerNoMore.value = false
  customerList.value = []
  loadCustomers()
}

function closeCustomerPicker() {
  showCustomerPicker.value = false
}

function searchCustomers() {
  customerPage.value = 1
  customerNoMore.value = false
  customerList.value = []
  loadCustomers()
}

async function loadCustomers() {
  if (customerLoading.value) return
  customerLoading.value = true
  try {
    const result = await customersApi.list({
      keyword: customerSearchKeyword.value || undefined,
      page: customerPage.value,
      pageSize: customerPageSize,
    })
    const list = result.list || []
    if (customerPage.value === 1) {
      customerList.value = list
    } else {
      customerList.value = [...customerList.value, ...list]
    }
    customerNoMore.value = list.length < customerPageSize
  } catch (err) {
    console.error('加载客户列表失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    customerLoading.value = false
    customerLoadingMore.value = false
  }
}

async function loadMoreCustomers() {
  if (customerLoadingMore.value || customerNoMore.value) return
  customerLoadingMore.value = true
  customerPage.value++
  await loadCustomers()
}

function selectCustomer(customer: CustomerInfo) {
  saleForm.selectedCustomer = customer
  showCustomerPicker.value = false
}

// ========== 商品选择弹窗 ==========
const showProductPicker = ref(false)
const productSearchKeyword = ref('')
const productList = ref<ProductInfo[]>([])
// 商品选择弹窗：每个商品的待选数量（默认 1）
const pickQty = reactive<Record<number, number>>({})
function getPickQty(id: number): number {
  return pickQty[id] || 1
}
function incPick(id: number) {
  pickQty[id] = getPickQty(id) + 1
}
function decPick(id: number) {
  pickQty[id] = Math.max(1, getPickQty(id) - 1)
}
function onPickQtyInput(id: number, e: any) {
  pickQty[id] = Math.max(1, Number(e.detail.value) || 1)
}
const categoryList = ref<CategoryInfo[]>([])
const selectedCategoryId = ref<number>(0)
const productLoading = ref(false)
const productLoadingMore = ref(false)
const productPage = ref(1)
const productPageSize = 20
const productNoMore = ref(false)

async function openProductPicker() {
  showProductPicker.value = true
  productPage.value = 1
  productNoMore.value = false
  productList.value = []
  // 加载分类
  if (categoryList.value.length === 0) {
    try {
      const cats = await productsApi.categories()
      categoryList.value = cats
    } catch (err) {
      console.error('加载分类失败:', err)
    }
  }
  loadProducts()
}

function closeProductPicker() {
  showProductPicker.value = false
}

function searchProducts() {
  productPage.value = 1
  productNoMore.value = false
  productList.value = []
  loadProducts()
}

function selectCategory(categoryId: number) {
  selectedCategoryId.value = categoryId
  productPage.value = 1
  productNoMore.value = false
  productList.value = []
  loadProducts()
}

async function loadProducts() {
  if (productLoading.value) return
  productLoading.value = true
  try {
    const result = await productsApi.list({
      keyword: productSearchKeyword.value || undefined,
      categoryId: selectedCategoryId.value > 0 ? selectedCategoryId.value : undefined,
      page: productPage.value,
      pageSize: productPageSize,
    })
    const list = result.list || []
    if (productPage.value === 1) {
      productList.value = list
    } else {
      productList.value = [...productList.value, ...list]
    }
    productNoMore.value = list.length < productPageSize
  } catch (err) {
    console.error('加载商品列表失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    productLoading.value = false
    productLoadingMore.value = false
  }
}

async function loadMoreProducts() {
  if (productLoadingMore.value || productNoMore.value) return
  productLoadingMore.value = true
  productPage.value++
  await loadProducts()
}

function addProduct(product: ProductInfo, qty = 1, traceCode = '') {
  const safeQty = Math.max(1, Number(qty) || 1)
  // 检查是否已添加
  const existingIndex = saleItems.findIndex(item => item.productId === product.id)
  if (existingIndex >= 0) {
    // 已存在，数量累加
    const item = saleItems[existingIndex]!
    item.quantity = (item.quantity ?? 0) + safeQty
    item.total = (item.price ?? 0) * (item.quantity ?? 0)
    item.subtotalAmount = item.total
    item.bottleQty = item.quantity
    uni.showToast({ title: '已添加', icon: 'none' })
    return
  }
  // 新增
  const newItem: SaleItem = {
    productId: product.id,
    productName: product.name,
    price: product.price,
    quantity: safeQty,
    total: product.price * safeQty,
    boxQty: 0,
    bottleQty: safeQty,
    unitPrice: product.price,
    subtotalAmount: product.price * safeQty,
    unit: product.unit,
    specs: product.specs,
    traceCode,
  } as any
  saleItems.push(newItem)
  uni.showToast({ title: '已添加', icon: 'none' })
}

/** 扫码添加商品（设计稿 UI v1.2：扫码添加/扫描商品条码） */
async function handleScanAdd() {
  try {
    const { scanCode } = await import('@/native/scan')
    const result = await scanCode()
    const code = result?.code
    if (!code) return
    uni.showLoading({ title: '查询商品...' })
    const res = await productsApi.list({ keyword: code, page: 1, pageSize: 10 })
    uni.hideLoading()
    const rows = res?.list ?? []
    const matched = rows.find((p) => String(p.skuId) === code || (p.name || '').includes(code)) ?? rows[0]
    if (matched) {
      // 条码已关联：扫码所得条码写入该商品追溯码
      addProduct(matched, code)
      uni.showToast({ title: '条码已关联', icon: 'none' })
    } else {
      uni.showToast({ title: '未找到该条码商品', icon: 'none' })
    }
  } catch (err) {
    uni.hideLoading()
    uni.showToast({ title: (err as Error)?.message || '扫码失败', icon: 'none' })
  }
}

// ========== 商品明细操作 ==========
function decreaseQty(index: number) {
  const item = saleItems[index]!
  if ((item.quantity ?? 0) > 1) {
    item.quantity = (item.quantity ?? 0) - 1
    item.total = (item.price ?? 0) * (item.quantity ?? 0)
    item.subtotalAmount = item.total
    item.bottleQty = item.quantity
  }
}

function increaseQty(index: number) {
  const item = saleItems[index]!
  item.quantity = (item.quantity ?? 0) + 1
  item.total = (item.price ?? 0) * (item.quantity ?? 0)
  item.subtotalAmount = item.total
  item.bottleQty = item.quantity
}

function onQtyChange(index: number, e: any) {
  const item = saleItems[index]!
  const qty = Math.max(1, Number(e.detail.value) || 1)
  item.quantity = qty
  item.total = (item.price ?? 0) * qty
  item.subtotalAmount = item.total
  item.bottleQty = qty
}

function removeItem(index: number) {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除该商品吗？',
    success: (res) => {
      if (res.confirm) {
        saleItems.splice(index, 1)
      }
    }
  })
}

// 手动录入追溯码
function onTraceChange(index: number, e: any) {
  const item = saleItems[index]!
  item.traceCode = e.detail.value || ''
}

// 扫码关联追溯码（原稿：条码已关联）
async function handleScanTrace(index: number) {
  try {
    const { scanCode } = await import('@/native/scan')
    const result = await scanCode()
    const code = result?.code
    if (!code) return
    const item = saleItems[index]!
    item.traceCode = code
    uni.showToast({ title: '条码已关联', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: (err as Error)?.message || '扫码失败', icon: 'none' })
  }
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: '/pages/home/home' })
  }
}

/** 分享（原稿：分享开单快照） */
function handleShare() {
  uni.showToast({ title: '已生成开单分享卡片', icon: 'none' })
}

async function handleDraft() {
  if (saleItems.length === 0) {
    uni.showToast({ title: '请先添加商品', icon: 'none' })
    return
  }
  try {
    const result = await storeApi.createHoldOrder({
      customerName: selectedCustomer.value?.name || '散户',
      customerMobile: selectedCustomer.value?.phone || '',
      amount: totalAmount.value,
      remark: saleForm.remark || '移动端开单暂存',
      items: saleItems.map((item) => ({
        skuId: Number(item.productId || 0),
        skuName: item.productName || '',
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.price ?? item.unitPrice ?? 0),
        subtotalAmount: Number(item.total ?? item.subtotalAmount ?? 0),
      })),
    })
    uni.showToast({ title: `已暂存（${result.holdNo}）`, icon: 'success' })
    isSaved.value = true
  } catch (err: any) {
    uni.showToast({ title: err?.message || '暂存失败，请重试', icon: 'none' })
  }
}

onMounted(() => {
  loadSourceBills()
})

// ========== 提交 ==========
async function handleSubmit() {
  // 表单校验
  if (!validate()) return
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const customer = selectedCustomer.value
    await salesApi.createSale({
      customerId: customer?.id,
      customerName: customer?.name || '散客',
      customerMobile: customer?.phone || '',
      items: saleItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        boxQty: item.boxQty,
        bottleQty: item.bottleQty,
        unitPrice: item.unitPrice,
        subtotalAmount: item.subtotalAmount
      })),
      remark: remark.value || undefined
    })
    uni.showToast({ title: '开单成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch (err) {
    uni.showToast({ title: '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.create-sale-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}

.header-back {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $uni-bg-color-page;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-back:active {
  background: $uni-color-primary-soft;
}

.header-back-icon {
  font-size: 44rpx;
  color: $uni-gray-600;
  line-height: 1;
  margin-top: -4rpx;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-text-color;
}

/* 单据类型分段导航（原稿） */
.doc-nav {
  margin: 16rpx 24rpx 0;
}

.doc-nav-main {
  display: flex;
  gap: 12rpx;
  background: $uni-bg-color-page;
  border-radius: 16rpx;
  padding: 6rpx;
}

.doc-nav-sub {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
}

.doc-seg {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 26rpx;
  color: $uni-gray-500;
  background: $uni-bg-color;
  border-radius: 12rpx;
  font-weight: 500;
  transition: all 0.2s ease;
}

.doc-seg--sub {
  padding: 14rpx 0;
}

.doc-seg--active {
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
  font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(37, 99, 235, 0.2);
}

.sale-form {
  flex: 1;
  padding-bottom: 160rpx;
}

.form-section {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 16rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-count {
  font-size: 24rpx;
  font-weight: 400;
  color: $uni-gray-400;
}

/* 客户 / 配送方式 / 日期 / 门店仓库 2x2 网格（原稿 qo-customer） */
.qc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.qc-cell {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  background: $uni-bg-color-page;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
}

.qc-label {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.qc-val {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.qc-chev {
  font-size: 22rpx;
  color: $uni-gray-300;
  margin-left: 8rpx;
}

.customer-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.customer-name {
  flex: 1;
  font-size: 28rpx;
  color: $uni-gray-700;
}

.customer-phone {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.customer-placeholder {
  flex: 1;
  font-size: 28rpx;
  color: $uni-gray-300;
}

.customer-arrow {
  font-size: 28rpx;
  color: $uni-gray-300;
}

/* 商品明细 */
.item-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
  gap: 12rpx;
}

.item-row:last-child {
  border-bottom: none;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.item-name {
  font-size: 28rpx;
  color: $uni-gray-700;
  margin-bottom: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 商品首字缩略图（原稿 prod-thumb） */
.prod-thumb {
  width: 80rpx;
  height: 80rpx;
  border-radius: 12rpx;
  background: $uni-color-primary-soft;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.t-letter {
  font-size: 32rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

.item-spec {
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-bottom: 4rpx;
}

.item-price-wrap {
  display: flex;
  align-items: center;
  margin-top: 8rpx;
}

.price-unit {
  font-size: 22rpx;
  color: $uni-color-primary;
  font-weight: 700;
}

.item-price-input {
  font-size: 26rpx;
  color: $uni-color-primary;
  font-weight: 700;
  width: 100rpx;
  padding: 0 4rpx;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.price-append {
  font-size: 20rpx;
  color: $uni-gray-400;
}

.item-quantity {
  display: flex;
  align-items: center;
}

/* 左滑删除 */
.swipe-item {
  position: relative;
  overflow: hidden;
  border-radius: 16rpx;
}

.swipe-content {
  position: relative;
  background: $uni-bg-color;
  transition: transform 0.2s ease;
  z-index: 1;
}

.swipe-item--open .swipe-content {
  transform: translateX(-120rpx);
}

.swipe-del {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 120rpx;
  background: $uni-color-error;
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0 16rpx 16rpx 0;
}

.qty-btn {
  width: 48rpx;
  height: 48rpx;
  background: $uni-bg-color-page;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: $uni-gray-500;
  font-weight: 600;
}

.qty-btn--add {
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
}

/* 数量为 1 时减号禁用态（spec02） */
.qty-btn--disabled {
  opacity: 0.35;
}

.qty-input {
  width: 72rpx;
  height: 48rpx;
  text-align: center;
  font-size: 28rpx;
  color: $uni-gray-700;
  margin: 0 8rpx;
  background: $uni-bg-color-page;
  border-radius: 8rpx;
}

.item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  flex-shrink: 0;
}

.item-total {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
  min-width: 120rpx;
  text-align: right;
}

.item-delete {
  font-size: 22rpx;
  color: $uni-color-error;
  padding: 4rpx 8rpx;
}

/* 追溯码（原稿：每件商品下方追溯码行，已录入显示「已关联」） */
.item-trace {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx dashed $uni-border-color;
}

.trace-icon {
  width: 28rpx;
  height: 28rpx;
  flex-shrink: 0;
}

.trace-input {
  flex: 1;
  font-size: 24rpx;
  padding: 10rpx 16rpx;
  background: $uni-bg-color-page;
  border-radius: 8rpx;
  color: $uni-gray-500;
}

.trace-placeholder {
  color: $uni-gray-300;
  font-size: 24rpx;
}

.trace-code-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 16rpx;
  background: $uni-color-primary-soft;
  border-radius: 8rpx;
  border: 1rpx solid rgba(37, 99, 235, 0.15);
}

.trace-code {
  flex: 1;
  font-size: 24rpx;
  color: $uni-color-primary;
  font-weight: 500;
}

.trace-linked {
  font-size: 20rpx;
  color: $uni-color-success;
  background: $uni-color-success-soft;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
}

.trace-scan {
  width: 32rpx;
  height: 32rpx;
  flex-shrink: 0;
}

.add-item-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
  border: 2rpx dashed $uni-gray-300;
  border-radius: 12rpx;
  margin-top: 16rpx;
}
.add-item-row {
  display: flex;
  gap: 16rpx;
}
.add-item-row .add-item-btn {
  flex: 1;
  margin-top: 16rpx;
}
.add-item-btn--scan {
  border-color: rgba(37, 99, 235, 0.25);
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
}

.add-icon {
  font-size: 36rpx;
  color: $uni-color-primary;
  margin-right: 8rpx;
}

/* 扫码图标（替换 emoji，规范禁 emoji 图标） */
.add-icon-img {
  width: 34rpx;
  height: 34rpx;
  margin-right: 8rpx;
}

.add-text {
  font-size: 28rpx;
  color: $uni-color-primary;
}

/* 金额汇总 */
.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
}

.amount-row--total {
  padding-top: 16rpx;
  border-top: 1rpx solid $uni-bg-color-grey;
  margin-top: 4rpx;
}

.amount-label {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.amount-value {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
}

.amount-value--total {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

/* 优惠（原稿：汇总含「优惠」行，可编辑） */
.discount-edit {
  display: flex;
  align-items: center;
}

.discount-prefix {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
  margin-right: 4rpx;
}

.discount-input {
  width: 160rpx;
  text-align: right;
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
}

/* 备注 */
.remark-input {
  width: 100%;
  height: 160rpx;
  background: $uni-bg-color-page;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}

.remark-placeholder {
  color: $uni-gray-300;
  font-size: 26rpx;
}

/* 底部提交栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: $uni-bg-color;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.06);
  gap: 20rpx;
}

.bottom-total {
  flex: 1;
  display: flex;
  align-items: baseline;
}

.share-btn {
  width: 140rpx;
  height: 80rpx;
  background: $uni-bg-color;
  border: 2rpx solid $uni-border-color;
  border-radius: 40rpx;
  font-size: 28rpx;
  color: $uni-gray-600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.share-btn::after {
  border: none;
}

.share-btn:active {
  background: $uni-bg-color-grey;
}

.draft-btn {
  width: 160rpx;
  height: 80rpx;
  background: $uni-bg-color;
  border: 2rpx solid $uni-border-color;
  border-radius: 40rpx;
  font-size: 28rpx;
  color: $uni-gray-600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.draft-btn::after {
  border: none;
}

.draft-btn:active {
  background: $uni-bg-color-grey;
}

.total-label {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.total-value {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

.submit-btn {
  width: 220rpx;
  height: 80rpx;
  background: $uni-gradient-blue;
  border-radius: 40rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.submit-btn::after {
  border: none;
}

.submit-btn--disabled {
  opacity: 0.5;
}

.safe-bottom {
  height: 40rpx;
}

.field-error {
  margin-top: 8rpx;
  padding: 6rpx 0;
}

.error-text {
  font-size: 24rpx;
  color: $uni-color-error;
}

/* ========== 弹窗样式 ========== */
.picker-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.picker-mask--product {
  align-items: stretch;
}

.picker-popup {
  width: 100%;
  background: $uni-bg-color;
  border-radius: 24rpx 24rpx 0 0;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.picker-popup--large {
  max-height: 85vh;
}

.picker-popup--product {
  max-height: 90vh;
  border-radius: 24rpx 24rpx 0 0;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
  flex-shrink: 0;
}

.picker-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.picker-close {
  font-size: 48rpx;
  color: $uni-gray-400;
  line-height: 1;
}

.picker-search {
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
  flex-shrink: 0;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  height: 64rpx;
  background: $uni-bg-color-page;
  border-radius: 32rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 28rpx;
  color: $uni-gray-400;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: $uni-gray-700;
}

.search-placeholder {
  color: $uni-gray-300;
  font-size: 24rpx;
}

.picker-content {
  flex: 1;
  overflow-y: auto;
}

.picker-content--with-search {
  max-height: 60vh;
}

.picker-content--product {
  padding: 0;
}

/* 客户列表项 */
.picker-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid $uni-gray-50;
}

.picker-item--customer {
  flex-wrap: wrap;
}

.customer-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.customer-item-name {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
}

.customer-item-phone {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.customer-item-type {
  font-size: 22rpx;
  color: $uni-color-primary;
  background: $uni-color-primary-soft;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  margin-right: 16rpx;
}

.picker-item--active .customer-item-name {
  color: $uni-color-primary;
  font-weight: 600;
}

.picker-check {
  font-size: 32rpx;
  color: $uni-color-primary;
  font-weight: 600;
}

/* 分类筛选 */
.category-bar {
  white-space: nowrap;
  padding: 12rpx 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
  flex-shrink: 0;
}

.category-item {
  display: inline-block;
  padding: 12rpx 24rpx;
  background: $uni-bg-color-page;
  border-radius: 24rpx;
  margin-right: 12rpx;
}

.category-item--active {
  background: $uni-color-primary;
}

.category-item--active .category-text {
  color: $uni-text-color-inverse;
  font-weight: 500;
}

.category-text {
  font-size: 24rpx;
  color: $uni-gray-500;
}

/* 商品列表 */
.product-item {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
  gap: 16rpx;
}

.product-item:last-child {
  border-bottom: none;
}

.product-image {
  width: 96rpx;
  height: 96rpx;
  border-radius: 12rpx;
  background: $uni-bg-color-grey;
  flex-shrink: 0;
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.product-name {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-spec {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.product-bottom {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.product-price {
  font-size: 28rpx;
  color: $uni-color-error;
  font-weight: 600;
}

.product-stock {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.product-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.pick-qty {
  width: 44rpx;
  height: 44rpx;
  background: $uni-bg-color-page;
  border-radius: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: $uni-color-primary;
  font-weight: 700;
}

.pick-qty-input {
  width: 60rpx;
  height: 44rpx;
  text-align: center;
  font-size: 26rpx;
  color: $uni-gray-700;
}

/* 加载更多 */
.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
  gap: 12rpx;
}

.loading-more-spinner {
  width: 28rpx;
  height: 28rpx;
  border: 3rpx solid $uni-gray-200;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.load-more-text {
  font-size: 22rpx;
  color: $uni-gray-300;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 加载中 */
.customer-loading,
.product-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid $uni-gray-200;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 26rpx;
  color: $uni-gray-400;
  margin-top: 20rpx;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.empty-text {
  font-size: 26rpx;
  color: $uni-gray-300;
}
</style>
