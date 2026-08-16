<template>
  <view class="create-sale-page">
    <!-- 顶部栏 -->
    <view class="page-header">
      <view class="header-back" @tap="goBack">
        <text class="header-back-icon">‹</text>
      </view>
      <text class="header-title">快速开单</text>
    </view>

    <!-- 表单三件套：ref + :model + :rules -->
    <form ref="formRef" :model="saleForm" :rules="saleRules" class="sale-form-scroll">
      <scroll-view class="sale-form" scroll-y>
      <!-- 客户选择 -->
      <view class="form-section">
        <view class="section-title">选择客户</view>
        <view class="customer-select" @tap="openCustomerPicker">
          <view class="customer-info" v-if="selectedCustomer">
            <text class="customer-name">{{ selectedCustomer.name }}</text>
            <text class="customer-phone" v-if="selectedCustomer.phone">{{ selectedCustomer.phone }}</text>
          </view>
          <text class="customer-placeholder" v-else>请选择客户</text>
          <text class="customer-arrow">&#xe616;</text>
        </view>
        <view class="field-error" v-if="errors.selectedCustomer">
          <text class="error-text">{{ errors.selectedCustomer }}</text>
        </view>
      </view>

      <!-- 商品列表 -->
      <view class="form-section">
        <view class="section-title">
          <text>商品明细</text>
          <text class="item-count">共{{ saleItems.length }}件</text>
        </view>
        <view class="item-row" v-for="(item, index) in saleItems" :key="index">
          <view class="item-info">
            <text class="item-name">{{ item.productName }}</text>
            <text class="item-spec" v-if="item.specs">{{ item.specs }}</text>
            <text class="item-price">¥{{ (item.price ?? 0).toFixed(2) }} / {{ item.unit || '件' }}</text>
          </view>
          <view class="item-quantity">
            <view class="qty-btn" @tap="decreaseQty(index)">-</view>
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
            <view class="item-delete" @tap="removeItem(index)">删除</view>
          </view>
        </view>

        <view class="add-item-row">
          <view class="add-item-btn" @tap="openProductPicker">
            <text class="add-icon">+</text>
            <text class="add-text">添加商品</text>
          </view>
          <view class="add-item-btn add-item-btn--scan" @tap="handleScanAdd">
            <text class="add-icon">📷</text>
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
          <text class="amount-label">商品数量</text>
          <text class="amount-value">{{ totalQty }}件</text>
        </view>
        <view class="amount-row amount-row--total">
          <text class="amount-label">合计金额</text>
          <text class="amount-value amount-value--total">¥{{ totalAmount.toFixed(2) }}</text>
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
        <text class="total-value">¥{{ totalAmount.toFixed(2) }}</text>
      </view>
      <button class="draft-btn" :disabled="submitting" @tap="handleDraft">
        暂存
      </button>
      <button
        class="submit-btn"
        :disabled="!canSubmit || submitting"
        :class="{ 'submit-btn--disabled': !canSubmit }"
        @tap="handleSubmit"
      >
        {{ submitting ? '提交中...' : '结算收款' }}
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
            <text class="search-icon">&#xe614;</text>
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
            <text class="search-icon">&#xe614;</text>
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
              <view class="qty-btn qty-btn--add" @tap="addProduct(product)">+</view>
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
import { ref, computed, reactive } from 'vue'
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
  selectedCustomer: [{ required: true, message: '请选择客户' }],
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

// ========== 计算属性 ==========
const totalAmount = computed(() => {
  return saleItems.reduce((sum, item) => sum + (item.total ?? 0), 0)
})

const totalQty = computed(() => {
  return saleItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
})

const canSubmit = computed(() => {
  return saleForm.selectedCustomer !== null && saleItems.length > 0 && !submitting.value
})

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

function addProduct(product: ProductInfo) {
  // 检查是否已添加
  const existingIndex = saleItems.findIndex(item => item.productId === product.id)
  if (existingIndex >= 0) {
    // 已存在，数量+1
    const item = saleItems[existingIndex]!
    item.quantity = (item.quantity ?? 0) + 1
    item.total = (item.price ?? 0) * (item.quantity ?? 0)
    uni.showToast({ title: '已添加', icon: 'none' })
    return
  }
  // 新增
  const newItem: SaleItem = {
    productId: product.id,
    productName: product.name,
    price: product.price,
    quantity: 1,
    total: product.price,
    boxQty: 0,
    bottleQty: 1,
    unitPrice: product.price,
    subtotalAmount: product.price,
    unit: product.unit,
    specs: product.specs,
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
      addProduct(matched)
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

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: '/pages/home/home' })
  }
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
  } catch (err: any) {
    uni.showToast({ title: err?.message || '暂存失败，请重试', icon: 'none' })
  }
}

// ========== 提交 ==========
async function handleSubmit() {
  // 表单校验
  if (!validate()) return
  if (!canSubmit.value) return
  submitting.value = true
  try {
    await salesApi.createSale({
      customerId: selectedCustomer.value!.id,
      customerName: selectedCustomer.value!.name,
      customerMobile: selectedCustomer.value!.phone,
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

/* 客户选择 */
.customer-select {
  display: flex;
  align-items: center;
  height: 80rpx;
  background: $uni-bg-color-page;
  border-radius: 12rpx;
  padding: 0 24rpx;
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

.item-spec {
  font-size: 22rpx;
  color: $uni-gray-400;
  margin-bottom: 4rpx;
}

.item-price {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.item-quantity {
  display: flex;
  align-items: center;
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
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #6366f1;
}

.add-icon {
  font-size: 36rpx;
  color: $uni-color-primary;
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
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
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
  padding: 0 24rpx;
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
  padding: 20rpx 0;
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
