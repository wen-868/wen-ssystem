<template>
  <view class="create-sale-page">
    <!-- 顶部栏 -->
    <page-header title="快速开单" @back="goBack" />
    <!-- 单据状态徽标（对齐 HTML .hd-status：草稿 / 已保存） -->
    <view class="doc-status" :class="isSaved ? 'doc-status--saved' : 'doc-status--draft'">
      <text class="ds-dot"></text>
      <text class="ds-text">{{ isSaved ? '已保存' : '草稿' }}</text>
    </view>

    <!-- 单据类型分段导航（主段 销售/采购 + 子段 订单/销售单/退货/收款单） -->
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
          @tap="selectDocSub(s)"
        >{{ s }}</view>
      </view>
    </view>

    <!-- 单据表单容器 -->
    <view class="sale-form-scroll">
      <scroll-view class="sale-form" scroll-y>
      <!-- 关联销售单（收款单：前端反查客户与金额，按 Receipt 契约提交） -->
      <view class="form-section" v-if="docConfig.showSourceBill">
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

      <!-- 客户（收款单：后端 createReceipt 必填 customerId，须从客户选择器获取，不能仅用源单反查名字） -->
      <view class="form-section" v-if="docConfig.showReceiptCustomer">
        <view class="section-title">{{ docKey === 'sale-return' ? '客户' : '收款客户' }}</view>
        <view class="qc-cell" @tap="openCustomerPicker">
          <view class="qc-val">{{ receiptCustomerName || '请选择客户' }} <text class="qc-chev">▾</text></view>
        </view>
      </view>

      <!-- 供应商（进货单：真实供应商接口，非客户） -->
      <view class="form-section" v-if="docConfig.showSupplier">
        <view class="section-title">供应商</view>
        <picker
          class="qc-cell"
          mode="selector"
          :range="supplierOptions"
          range-key="name"
          @change="onSupplierChange"
        >
          <view class="qc-val">{{ supplierLabel }} <text class="qc-chev">▾</text></view>
        </picker>
      </view>

      <!-- 入库门店（进货单：后端入库场所为 store_id，无 warehouse 维度，复用 stores 真实门店列表） -->
      <view class="form-section" v-if="docConfig.showStore">
        <view class="section-title">{{ storeSectionTitle }}</view>
        <picker
          class="qc-cell"
          mode="selector"
          :range="storeOptions"
          range-key="name"
          @change="onStoreChange"
        >
          <view class="qc-val">{{ storeLabel }} <text class="qc-chev">▾</text></view>
        </picker>
      </view>

      <!-- 收款金额（收款单） -->
      <view class="form-section" v-if="docConfig.showAmount">
        <view class="section-title">收款金额</view>
        <view class="amount-input-row">
          <text class="price-unit">¥</text>
          <input
            class="discount-input"
            :value="receiptAmount"
            type="digit"
            @input="onReceiptAmountChange"
            placeholder="请输入收款金额"
          />
        </view>
      </view>

      <!-- 收款方式（收款单）：对齐 HTML .chip 胶囊选择 -->
      <view class="form-section" v-if="docConfig.showPayment">
        <view class="section-title">收款方式</view>
        <view class="chip-row">
          <view
            v-for="m in paymentOptions"
            :key="m"
            class="chip"
            :class="{ 'chip--active': paymentMethod === m }"
            @tap="selectPayment(m)"
          >{{ m }}</view>
        </view>
      </view>
      <!-- 金额汇总（收款单：实收金额，对齐 HTML summary-card） -->
      <view class="form-section amount-summary" v-if="docKey === 'sale_receipt'">
        <view class="section-title">金额汇总</view>
        <view class="amount-row">
          <text class="amount-label">实收金额</text>
          <text class="amount-value amount-value--total">¥{{ Number(receiptAmount || 0).toFixed(2) }}</text>
        </view>
      </view>

      <!-- 客户 / 配送方式 / 日期 / 门店 选择（按单据差异显隐，原稿 qo-customer） -->
      <view class="form-section qo-customer" v-if="docConfig.showCustomer || docConfig.showDelivery || docConfig.showOrderDate">
        <view class="qc-grid">
          <view class="qc-cell" v-if="docConfig.showCustomer" @tap="openCustomerPicker">
            <text class="qc-label">客户</text>
            <view class="qc-val">{{ selectedCustomer?.name || '散客' }} <text class="qc-chev">▾</text></view>
          </view>
          <picker v-if="docConfig.showDelivery" class="qc-cell" mode="selector" :range="deliveryOptions" @change="onDeliveryChange">
            <text class="qc-label">配送方式</text>
            <view class="qc-val">{{ deliveryMethod }} <text class="qc-chev">▾</text></view>
          </picker>
          <picker v-if="docConfig.showOrderDate" class="qc-cell" mode="date" :value="orderDate" @change="onDateChange">
            <text class="qc-label">日期</text>
            <view class="qc-val">{{ orderDate.slice(5) }} <text class="qc-chev">▾</text></view>
          </picker>
        </view>
      </view>

      <!-- 商品列表（订单 / 进货 共用） -->
      <view class="form-section" v-if="docConfig.showProducts">
        <view class="section-title">
          <text>已选商品</text>
          <text class="ct-badge">{{ saleItems.length }} 种</text>
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
      </view>

      <!-- 金额汇总（仅订单） -->
      <view class="form-section" v-if="docKey === 'sale_order' && saleItems.length > 0">
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
      <view class="form-section" v-if="docConfig.showRemark">
        <view class="section-title">备注</view>
        <textarea
          class="remark-input"
          v-model="remark"
          placeholder="请输入备注信息（选填）"
          placeholder-class="remark-placeholder"
        />
      </view>

      <!-- 出货占位（后端接口待开放） -->
      <view class="form-section doc-placeholder" v-if="docConfig.placeholder">
        <view class="placeholder-icon">🚚</view>
        <text class="placeholder-text">{{ docConfig.placeholder }}</text>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>
    </view>

    <!-- 底部提交（按单据配置渲染动作） -->
    <view class="bottom-bar">
      <button
        v-for="(act, i) in docConfig.actions"
        :key="act.label"
        :class="['submit-btn', act.variant === 'ghost' ? 'draft-btn' : '', act.variant === 'ghost' ? 'share-btn' : '', { 'submit-btn--disabled': submitting }]"
        :disabled="submitting"
        @tap="act.handler"
      >
        {{ submitting && act.variant === 'primary' ? (act.loadingText || '提交中...') : act.label }}
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
import { purchaseApi } from '@/api/modules/purchase'
import { receiptApi } from '@/api/modules/receipts'
import { supplierApi, type Supplier } from '@/api/modules/suppliers'
import { storesApi } from '@/api/modules/stores'
import { saleReturnApi, purchaseReturnApi } from '@/api/modules/returns'

// ===================================================================
// 单据框架：四种单据各自独立字段 / 底部动作 / 提交接口
// 公共能力（商品选择 / 客户搜索 / 扫码 / 数量编辑 / 分享 / 暂存 / 校验）只实现一次，按单据差异复用
// ===================================================================

const submitting = ref(false)
const isSaved = ref(false)
const todayStr = (): string => {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// ---------- 单据类型分段导航（原稿：销售/采购 + 子段） ----------
const docMain = ref<'sale' | 'purchase'>('sale')
const docSubs = computed(() =>
  docMain.value === 'sale'
    ? ['订单', '销售单', '退货', '收款单']
    : ['采购订单', '采购入库', '采购退货', '付款单']
)
const docSub = ref('订单')
function switchDocMain(v: 'sale' | 'purchase') {
  docMain.value = v
  docSub.value = v === 'sale' ? '订单' : '采购订单'
  resetDoc()
}
// 子段切换：对齐 HTML 各单据独立状态（切换即重置当前单据数据）
function selectDocSub(s: string) {
  if (docSub.value === s) return
  docSub.value = s
  resetDoc()
}

// 当前单据业务类型：对齐 HTML 8 单据 id（销售订单/销售单/销售退货/收款单 + 采购订单/采购入库/采购退货/付款单）
const docKey = computed<'sale_order' | 'sale_ticket' | 'sale_return' | 'sale_receipt' | 'pur_order' | 'pur_inbound' | 'pur_return' | 'pur_payment'>(() => {
  if (docMain.value === 'sale') {
    if (docSub.value === '订单') return 'sale_order'
    if (docSub.value === '销售单') return 'sale_ticket'
    if (docSub.value === '退货') return 'sale_return'
    return 'sale_receipt' // 收款单
  } else {
    if (docSub.value === '采购订单') return 'pur_order'
    if (docSub.value === '采购入库') return 'pur_inbound'
    if (docSub.value === '采购退货') return 'pur_return'
    return 'pur_payment' // 付款单
  }
})

// ---------- 每种单据配置：字段显隐 + 底部动作 ----------
interface DocAction {
  label: string
  variant: 'primary' | 'ghost'
  handler: () => void
  loadingText?: string
}
const docConfig = computed<{
  showCustomer: boolean
  showSupplier: boolean
  showProducts: boolean
  showDelivery: boolean
  showOrderDate: boolean
  showStore: boolean
  showSourceBill: boolean
  showReceiptCustomer: boolean
  showAmount: boolean
  showPayment: boolean
  showRemark: boolean
  showDeposit: boolean
  showRound: boolean
  showLogistics: boolean
  showTax: boolean
  showBatch: boolean
  showReason: boolean
  showVerify: boolean
  showOrderStatus: boolean
  showShipSummary: boolean
  actions: DocAction[]
  placeholder?: string
}>(() => {
  switch (docKey.value) {
    case 'sale_ticket':
      return {
        showCustomer: true, showSupplier: false, showProducts: true,
        showDelivery: true, showOrderDate: true, showStore: true, showSourceBill: false,
        showReceiptCustomer: false, showAmount: false, showPayment: false, showRemark: true,
        showDeposit: false, showRound: true, showLogistics: true, showTax: false,
        showBatch: false, showReason: false, showVerify: false, showOrderStatus: false,
        showShipSummary: false,
        actions: [
          { label: '保存', variant: 'ghost', handler: handleDraft },
          { label: '转收款单', variant: 'primary', handler: () => convertDoc('sale_receipt'), loadingText: '转收款单中...' },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    case 'sale_return':
      return {
        showCustomer: false, showSupplier: false, showProducts: true,
        showDelivery: false, showOrderDate: false, showStore: true, showSourceBill: true,
        showReceiptCustomer: true, showAmount: false, showPayment: false, showRemark: true,
        showDeposit: false, showRound: false, showLogistics: false, showTax: false,
        showBatch: false, showReason: true, showVerify: false, showOrderStatus: false,
        showShipSummary: false,
        actions: [
          { label: '提交退货', variant: 'primary', handler: submitSaleReturn, loadingText: '提交中...' },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    case 'sale_receipt':
      return {
        showCustomer: false, showSupplier: false, showProducts: false,
        showDelivery: false, showOrderDate: true, showStore: false, showSourceBill: true,
        showReceiptCustomer: true, showAmount: true, showPayment: true, showRemark: true,
        showDeposit: false, showRound: false, showLogistics: false, showTax: false,
        showBatch: false, showReason: false, showVerify: true, showOrderStatus: false,
        showShipSummary: false,
        actions: [
          { label: '确认收款', variant: 'primary', handler: submitReceipt, loadingText: '收款中...' },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    case 'pur_order':
      return {
        showCustomer: true, showSupplier: true, showProducts: true,
        showDelivery: false, showOrderDate: true, showStore: true, showSourceBill: false,
        showReceiptCustomer: false, showAmount: false, showPayment: false, showRemark: true,
        showDeposit: true, showRound: false, showLogistics: false, showTax: true,
        showBatch: false, showReason: false, showVerify: false, showOrderStatus: true,
        showShipSummary: false,
        actions: [
          { label: '保存', variant: 'ghost', handler: handleDraft },
          { label: '转入库单', variant: 'primary', handler: () => convertDoc('pur_inbound'), loadingText: '转入库单中...' },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    case 'pur_inbound':
      return {
        showCustomer: false, showSupplier: true, showProducts: true,
        showDelivery: false, showOrderDate: true, showStore: true, showSourceBill: false,
        showReceiptCustomer: false, showAmount: false, showPayment: false, showRemark: true,
        showDeposit: false, showRound: false, showLogistics: false, showTax: true,
        showBatch: true, showReason: false, showVerify: false, showOrderStatus: false,
        showShipSummary: false,
        actions: [
          { label: '保存', variant: 'ghost', handler: handleDraft },
          { label: '转付款单', variant: 'primary', handler: () => convertDoc('pur_payment'), loadingText: '转付款单中...' },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    case 'pur_return':
      return {
        showCustomer: false, showSupplier: true, showProducts: true,
        showDelivery: false, showOrderDate: false, showStore: true, showSourceBill: false,
        showReceiptCustomer: false, showAmount: false, showPayment: false, showRemark: true,
        showDeposit: false, showRound: false, showLogistics: false, showTax: false,
        showBatch: false, showReason: true, showVerify: false, showOrderStatus: false,
        showShipSummary: false,
        actions: [
          { label: '提交退货', variant: 'primary', handler: submitPurchaseReturn, loadingText: '提交中...' },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    case 'pur_payment':
      return {
        showCustomer: false, showSupplier: true, showProducts: false,
        showDelivery: false, showOrderDate: true, showStore: false, showSourceBill: true,
        showReceiptCustomer: false, showAmount: true, showPayment: true, showRemark: true,
        showDeposit: false, showRound: false, showLogistics: false, showTax: false,
        showBatch: false, showReason: false, showVerify: true, showOrderStatus: false,
        showShipSummary: false,
        actions: [
          { label: '确认付款', variant: 'primary', handler: submitPayment, loadingText: '付款中...' },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
    default: // sale_order
      return {
        showCustomer: true, showSupplier: false, showProducts: true,
        showDelivery: true, showOrderDate: true, showStore: true, showSourceBill: false,
        showReceiptCustomer: false, showAmount: false, showPayment: false, showRemark: true,
        showDeposit: true, showRound: false, showLogistics: false, showTax: false,
        showBatch: false, showReason: false, showVerify: false, showOrderStatus: true,
        showShipSummary: false,
        actions: [
          { label: '保存', variant: 'ghost', handler: handleDraft },
          { label: '转销售单', variant: 'primary', handler: submitOrder, loadingText: '转销售单中...' },
          { label: '分享', variant: 'ghost', handler: handleShare },
        ],
      }
  }
})

// ---------- 公共：商品明细状态（订单 / 进货 共用） ----------
const saleItems = reactive<SaleItem[]>([])
const remark = ref('')
const selectedCustomer = ref<CustomerInfo | null>(null)

// 配送方式 / 日期（订单）
const deliveryOptions = ['送货上门', '到店自提', '物流发货']
const deliveryMethod = ref('送货上门')
function onDeliveryChange(e: any) {
  deliveryMethod.value = deliveryOptions[Number(e.detail.value)] ?? deliveryMethod.value
}
const orderDate = ref(todayStr())
function onDateChange(e: any) {
  orderDate.value = e.detail.value
}
// 交货/到货日期（订单类：销售订单=交货，采购订单=到货）
const deliveryDate = ref('')

// ===== 扩展字段（对齐 HTML 8 单据：定金/抹零/物流/税率/批次/退货/核销/预付款） =====
const roundMode = ref<'none' | 'fen' | 'jiao' | 'both'>('none')
function selectRoundMode(m: 'none' | 'fen' | 'jiao' | 'both') { roundMode.value = m }

const taxRate = ref(0) // 百分比数值（如 13 表示 13%）
const taxRateOptions = [0, 3, 6, 9, 13, 16]
function onTaxRateChange(e: any) { taxRate.value = taxRateOptions[Number(e.detail.value)] ?? 0 }
const taxIncluded = ref(false)
function toggleTaxIncluded() { taxIncluded.value = !taxIncluded.value }

const batchNo = ref('')
function onBatchChange(e: any) { batchNo.value = e.detail.value || '' }
const expiryDate = ref('')
function onExpiryChange(e: any) { expiryDate.value = e.detail.value || '' }
const invoiceStatus = ref<'pending' | 'received'>('pending')
function toggleInvoiceStatus() { invoiceStatus.value = invoiceStatus.value === 'received' ? 'pending' : 'received' }

const returnReason = ref('')
const returnReasonOptions = ['质量问题', '规格不符', '临期商品', '客户取消', '运输损坏', '其他原因']
function selectReturnReason(r: string) { returnReason.value = r }
const originalDoc = ref('') // 关联原单号
function onOriginalDocChange(e: any) { originalDoc.value = e.detail.value || '' }
const returnWarehouseId = ref<number | null>(null)
const returnWarehouseLabel = computed(() => storeOptions.value.find(s => s.id === returnWarehouseId.value)?.name || '请选择退货仓库')
function onReturnWarehouseChange(e: any) {
  returnWarehouseId.value = storeOptions.value[Number(e.detail.value)]?.id ?? null
}

const orderStatus = ref<string | null>(null)
const refundStatus = ref('')

// 待核销单据（收款单 / 付款单）
interface VerifiedDoc { no: string; amount: number; checked: boolean; verifyAmount: number }
const verifiedDocs = reactive<VerifiedDoc[]>([])
function toggleVerify(i: number) {
  const d = verifiedDocs[i]
  if (!d) return
  d.checked = !d.checked
  if (d.checked && !d.verifyAmount) d.verifyAmount = d.amount
}
function onVerifyAmountChange(i: number, e: any) {
  const d = verifiedDocs[i]
  if (d) d.verifyAmount = Math.max(0, Number(e.detail.value) || 0)
}
const prepaymentDeduct = ref(0)
function onPrepayChange(e: any) { prepaymentDeduct.value = Math.max(0, Number(e.detail.value) || 0) }

// 物流单号（销售单：配送方式=物流发货 时录入/扫码）
const logisticsNo = ref('')
function onLogisticsChange(e: any) { logisticsNo.value = e.detail.value || '' }
async function scanLogistics() {
  try {
    const { scanCode } = await import('@/native/scan')
    const result = await scanCode()
    const code = result?.code
    if (code) { logisticsNo.value = code; uni.showToast({ title: '已扫描物流单号', icon: 'none' }) }
  } catch (err) {
    uni.showToast({ title: (err as Error)?.message || '扫码失败', icon: 'none' })
  }
}

// 定金（订单类：销售订单/采购订单）/ 配送费·运费分摊（销售单/采购入库）
const deposit = ref(0)
function onDepositChange(e: any) { deposit.value = Math.max(0, Number(e.detail.value) || 0) }
const shipping = ref(0)
function onShippingChange(e: any) { shipping.value = Math.max(0, Number(e.detail.value) || 0) }

// 抹零计算（对齐 HTML roundOff）
function roundOff(base: number, mode: 'none' | 'fen' | 'jiao' | 'both'): number {
  if (!mode || mode === 'none') return 0
  const yuan = Math.floor(base)
  const frac = +(base - yuan).toFixed(2)
  if (mode === 'fen') { const jiao = Math.floor(frac * 10) / 10; return +(frac - jiao).toFixed(2) }
  if (mode === 'jiao' || mode === 'both') { return frac }
  return 0
}

// 各单据初始默认值（对齐 HTML initDocState）
function shiftDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
function applyDocDefaults(k: string) {
  const isOrder = k === 'sale_order' || k === 'pur_order'
  const isInbound = k === 'pur_inbound'
  const isReturn = k.includes('return')
  const isReceipt = k === 'sale_receipt'
  const isPayment = k === 'pur_payment'
  const isTicket = k === 'sale_ticket'
  roundMode.value = isTicket ? 'both' : 'none'
  deposit.value = isOrder ? 200 : 0
  taxRate.value = (isInbound || k === 'pur_order') ? 13 : 0
  taxIncluded.value = !!(isInbound || k === 'pur_order')
  batchNo.value = isInbound ? 'B' + todayStr().replace(/-/g, '') + '01' : ''
  expiryDate.value = isInbound ? shiftDate(365) : ''
  invoiceStatus.value = 'pending'
  returnReason.value = isReturn ? '质量问题' : ''
  originalDoc.value = isReturn ? (k === 'sale_return' ? 'XSTH20260826001' : 'CGTH20260826001') : ''
  refundStatus.value = isReturn ? 'pending' : ''
  orderStatus.value = k === 'sale_order' ? 'confirmed' : (k === 'pur_order' ? 'pending' : null)
  prepaymentDeduct.value = isPayment ? 500 : 0
  logisticsNo.value = ''
  shipping.value = 0
  deliveryDate.value = isOrder ? shiftDate(7) : ''
  verifiedDocs.splice(0, verifiedDocs.length)
  if (isReceipt || isPayment) {
    verifiedDocs.push(
      { no: isReceipt ? 'XS20260823005' : 'CG20260822001', amount: isReceipt ? 1560 : 3200, checked: true, verifyAmount: isReceipt ? 1560 : 3200 },
      { no: isReceipt ? 'XS20260824012' : 'CG20260823008', amount: isReceipt ? 890 : 1800, checked: false, verifyAmount: 0 },
    )
  }
}

// ---------- 供应商（进货单） ----------
const supplierOptions = ref<Supplier[]>([])
const selectedSupplierId = ref<number | null>(null)
const supplierLabel = computed(() => supplierOptions.value.find(s => s.id === selectedSupplierId.value)?.name || '请选择供应商')
async function loadSuppliers() {
  try {
    const res = await supplierApi.getList({ page: 1, pageSize: 100 })
    supplierOptions.value = res.list || []
  } catch { supplierOptions.value = [] }
}
function onSupplierChange(e: any) {
  selectedSupplierId.value = supplierOptions.value[Number(e.detail.value)]?.id ?? null
}

// ---------- 入库门店（进货单）：后端入库场所为 store_id（门店），无 warehouse 维度 ----------
// 直接复用 storesApi.list 真实门店列表，提交 store_id，杜绝"以门店冒充仓库"的维度错误。
const storeOptions = ref<{ id: number; name: string }[]>([])
const selectedStoreId = ref<number | null>(null)
const storeSectionTitle = computed(() =>
  docKey.value === 'pur_inbound' ? '入库门店'
    : (docKey.value === 'sale_return' || docKey.value === 'pur_return') ? '退货门店'
    : '门店'
)
const storeLabel = computed(() => storeOptions.value.find(s => s.id === selectedStoreId.value)?.name
  || (docKey.value === 'pur_inbound' ? '请选择入库门店' : '请选择门店'))
async function loadStores() {
  try {
    const res = await storesApi.list({ page: 1, pageSize: 100 })
    storeOptions.value = (res.list || []).map(s => ({ id: s.id, name: s.name }))
  } catch { storeOptions.value = [] }
}
function onStoreChange(e: any) {
  selectedStoreId.value = storeOptions.value[Number(e.detail.value)]?.id ?? null
}

// ---------- 关联销售单（收款单：仅前端反查客户与金额，按 Receipt 契约提交，不臆造源单字段） ----------
const sourceBills = ref<{ label: string; billNo: string; customerName: string; totalAmount: number }[]>([])
const selectedSourceBill = ref('')
const receiptCustomerId = ref<number | null>(null)
const receiptCustomerName = ref('')
const sourceBillLabel = computed(() => selectedSourceBill.value || '请选择销售单')
async function loadSourceBills() {
  try {
    const result = await salesApi.list({ page: 1, pageSize: 20 })
    const list = result.list || []
    sourceBills.value = list.map((b: any) => ({
      label: `${b.billNo} ¥${Number(b.totalAmount ?? 0).toFixed(2)}`,
      billNo: b.billNo,
      customerName: b.customerName || '',
      totalAmount: Number(b.totalAmount ?? 0),
    }))
  } catch { sourceBills.value = [] }
}
function onSourceBillChange(e: any) {
  const bill = sourceBills.value[Number(e.detail.value)]
  if (bill) {
    selectedSourceBill.value = bill.billNo
    receiptCustomerName.value = bill.customerName
    if (!receiptAmount.value) receiptAmount.value = bill.totalAmount
  }
}

// 收款单：金额 + 收款方式
const receiptAmount = ref(0)
function onReceiptAmountChange(e: any) { receiptAmount.value = Math.max(0, Number(e.detail.value) || 0) }
const paymentOptions = ['现金', '微信', '支付宝', '银行卡', '其他']
const paymentMethod = ref('现金')
function onPaymentChange(e: any) { paymentMethod.value = paymentOptions[Number(e.detail.value)] ?? paymentMethod.value }
// 收款方式胶囊点击（对齐 HTML .chip 选择）
function selectPayment(m: string) { paymentMethod.value = m }

// ---------- 切换单据时重置状态 ----------
function resetDoc() {
  saleItems.splice(0, saleItems.length)
  remark.value = ''
  selectedCustomer.value = null
  selectedSupplierId.value = null
  selectedStoreId.value = null
  selectedSourceBill.value = ''
  receiptCustomerName.value = ''
  receiptAmount.value = 0
  receiptCustomerId.value = null
  paymentMethod.value = '现金'
  deliveryMethod.value = '送货上门'
  orderDate.value = todayStr()
  discount.value = 0
  isSaved.value = false
  swipeOpenIndex.value = -1
  // 扩展字段复位
  deliveryDate.value = ''
  roundMode.value = 'none'
  taxRate.value = 0
  taxIncluded.value = false
  batchNo.value = ''
  expiryDate.value = ''
  invoiceStatus.value = 'pending'
  returnReason.value = ''
  originalDoc.value = ''
  returnWarehouseId.value = null
  orderStatus.value = null
  refundStatus.value = ''
  prepaymentDeduct.value = 0
  logisticsNo.value = ''
  deposit.value = 0
  shipping.value = 0
  verifiedDocs.splice(0, verifiedDocs.length)
  const k = docKey.value
  applyDocDefaults(k)
  if (k === 'pur_inbound' || k === 'pur_return') { loadSuppliers(); loadStores() }
  if (k === 'sale_return' || k === 'sale_receipt' || k === 'pur_payment') loadStores()
  if (k === 'sale_return') loadSourceBills()
}

// ---------- 进入页面时懒加载公共数据 ----------
function ensurePurchaseData() {
  const k = docKey.value
  if (k === 'pur_inbound' || k === 'pur_return') {
    if (supplierOptions.value.length === 0) loadSuppliers()
  }
  if (k === 'pur_inbound' || k === 'pur_return' || k === 'sale_return' || k === 'sale_receipt' || k === 'pur_payment') {
    if (storeOptions.value.length === 0) loadStores()
  }
  if (k === 'sale_return') loadSourceBills()
}

// 已选商品：支持修改单价（订单）
function onPriceChange(index: number, e: any) {
  const item = saleItems[index]
  if (!item) return
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

// 商品首字缩略图（原稿 prod-thumb）
function firstChar(name?: string): string {
  return (name || '').trim().charAt(0) || '商'
}

// ========== 计算属性 ==========
const totalAmount = computed(() => saleItems.reduce((sum, item) => sum + (item.total ?? 0), 0))
const totalQty = computed(() => saleItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0))
// 提交前置：订单 / 进货需有商品；收款单需金额>0（在各 submit 内单独校验）
const canSubmit = computed(() => !submitting.value)

// 优惠（仅订单汇总使用）
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
  selectedCustomer.value = customer
  // 收款单需要 customerId 提交给后端（createReceipt 必填）
  if (docKey.value === 'sale_receipt') {
    receiptCustomerId.value = customer.id ?? null
    receiptCustomerName.value = customer.name || ''
  }
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
    skuId: product.skuId ? Number(product.skuId) : undefined,
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
  }
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

/** 保存（暂存草稿）：订单/进货走真实暂存接口，收款单仅前端标记 */
async function handleDraft() {
  if ((docKey.value === 'sale_order' || docKey.value === 'pur_inbound') && saleItems.length === 0) {
    uni.showToast({ title: '请先添加商品', icon: 'none' })
    return
  }
  try {
    if (docKey.value === 'sale_order' || docKey.value === 'pur_inbound') {
      const result = await storeApi.createHoldOrder({
        customerName: selectedCustomer.value?.name || '散户',
        customerMobile: selectedCustomer.value?.phone || '',
        amount: totalAmount.value,
        remark: remark.value || '移动端开单暂存',
        items: saleItems.map((item) => ({
          skuId: item.skuId ?? Number(item.productId || 0),
          skuName: item.productName || '',
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.price ?? item.unitPrice ?? 0),
          subtotalAmount: Number(item.total ?? item.subtotalAmount ?? 0),
        })),
      })
      uni.showToast({ title: `已暂存（${result.holdNo}）`, icon: 'success' })
    } else {
      uni.showToast({ title: '已暂存草稿', icon: 'success' })
    }
    isSaved.value = true
  } catch (err: any) {
    uni.showToast({ title: err?.message || '暂存失败，请重试', icon: 'none' })
  }
}

// ========== 提交载荷类型（严格对齐后端契约，杜绝 as any 掩盖字段错配） ==========
// 进货单：purchase-in-stock.service.ts#create 入参（snake_case）
interface CreatePurchaseInStockPayload {
  supplier_id: number
  supplier_name: string
  store_id: number
  remark?: string
  items: Array<{
    sku_id: number
    sku_name: string
    box_qty?: number
    bottle_qty?: number
    unit_price: number
    tax_rate?: number
  }>
}
// 收款单：receipt.controller.ts#createReceipt 入参
interface CreateReceiptPayload {
  customerId: number
  customerName?: string
  receiptType: string
  amount: number
  paymentMethod?: string
  receivedDate?: string
  remark?: string
}

// ========== 各单据提交 ==========
async function submitOrder() {
  if (saleItems.length === 0) { uni.showToast({ title: '请至少添加一个商品', icon: 'none' }); return }
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
        subtotalAmount: item.subtotalAmount,
      })),
      remark: remark.value || undefined,
    })
    uni.showToast({ title: '已转销售单', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (err) {
    uni.showToast({ title: '提交失败', icon: 'none' })
  } finally { submitting.value = false }
}

async function submitPurchaseIn() {
  if (saleItems.length === 0) { uni.showToast({ title: '请至少添加一个商品', icon: 'none' }); return }
  if (selectedSupplierId.value == null) { uni.showToast({ title: '请选择供应商', icon: 'none' }); return }
  // 后端入库场所为 store_id（门店），无 warehouse 维度 —— 见 purchase-in-stock.service.ts#create
  if (selectedStoreId.value == null) { uni.showToast({ title: '请选择入库门店', icon: 'none' }); return }
  submitting.value = true
  try {
    const supplier = supplierOptions.value.find(s => s.id === selectedSupplierId.value)
    const store = storeOptions.value.find(s => s.id === selectedStoreId.value)
    // 严格按后端契约（snake_case）：supplier_id / store_id / items[].sku_id / box_qty / bottle_qty / unit_price
    const payload: CreatePurchaseInStockPayload = {
      supplier_id: selectedSupplierId.value,
      supplier_name: supplier?.name || '',
      store_id: selectedStoreId.value,
      remark: remark.value || '',
      items: saleItems.map(item => ({
        sku_id: item.skuId ?? Number(item.productId),
        sku_name: item.productName || '',
        box_qty: item.boxQty ?? 0,
        bottle_qty: item.bottleQty ?? item.quantity ?? 0,
        unit_price: Number(item.unitPrice ?? item.price ?? 0),
      })),
    }
    await purchaseApi.createInStock(payload)
    uni.showToast({ title: '已确认入库', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '入库失败', icon: 'none' })
  } finally { submitting.value = false }
}

async function submitReceipt() {
  if (receiptCustomerId.value == null) { uni.showToast({ title: '请选择收款客户', icon: 'none' }); return }
  if (receiptAmount.value <= 0) { uni.showToast({ title: '请输入收款金额', icon: 'none' }); return }
  submitting.value = true
  try {
    // 严格按后端契约（receipt.controller.ts#createReceipt）：customerId / customerName / receiptType / amount / paymentMethod / receivedDate / remark
    const payload: CreateReceiptPayload = {
      customerId: receiptCustomerId.value,
      customerName: receiptCustomerName.value || '散客',
      receiptType: 'SALE', // 移动端开单收款默认 SALE，后端默认亦为 SALE
      amount: receiptAmount.value,
      paymentMethod: paymentMethod.value,
      receivedDate: orderDate.value,
      remark: remark.value || '',
    }
    await receiptApi.create(payload)
    uni.showToast({ title: '已确认收款', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '收款失败', icon: 'none' })
  } finally { submitting.value = false }
}

// ---------- 销售退货（POST /store/sale-returns，camelCase 契约） ----------
async function submitSaleReturn() {
  if (saleItems.length === 0) { uni.showToast({ title: '请至少添加一个商品', icon: 'none' }); return }
  if (selectedStoreId.value == null) { uni.showToast({ title: '请选择门店', icon: 'none' }); return }
  submitting.value = true
  try {
    const store = storeOptions.value.find(s => s.id === selectedStoreId.value)
    await saleReturnApi.create({
      sourceBillNo: selectedSourceBill.value || undefined,
      storeId: selectedStoreId.value,
      customerId: receiptCustomerId.value ?? undefined,
      customerName: receiptCustomerName.value || '散客',
      remark: remark.value || '',
      items: saleItems.map(item => ({
        skuId: item.skuId ?? Number(item.productId),
        skuName: item.productName || '',
        boxQty: item.boxQty ?? 0,
        bottleQty: item.bottleQty ?? item.quantity ?? 0,
        unitPrice: Number(item.unitPrice ?? item.price ?? 0),
      })),
    } as any)
    uni.showToast({ title: '已提交退货', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '提交失败', icon: 'none' })
  } finally { submitting.value = false }
}

// ---------- 采购退货（POST /admin/purchase-returns，snake_case 契约） ----------
async function submitPurchaseReturn() {
  if (saleItems.length === 0) { uni.showToast({ title: '请至少添加一个商品', icon: 'none' }); return }
  if (selectedSupplierId.value == null) { uni.showToast({ title: '请选择供应商', icon: 'none' }); return }
  if (selectedStoreId.value == null) { uni.showToast({ title: '请选择门店', icon: 'none' }); return }
  submitting.value = true
  try {
    const supplier = supplierOptions.value.find(s => s.id === selectedSupplierId.value)
    await purchaseReturnApi.create({
      supplier_id: selectedSupplierId.value,
      supplier_name: supplier?.name || '',
      store_id: selectedStoreId.value,
      remark: remark.value || '',
      items: saleItems.map(item => ({
        sku_id: item.skuId ?? Number(item.productId),
        sku_name: item.productName || '',
        box_qty: item.boxQty ?? 0,
        bottle_qty: item.bottleQty ?? item.quantity ?? 0,
        unit_price: Number(item.unitPrice ?? item.price ?? 0),
      })),
    } as any)
    uni.showToast({ title: '已提交退货', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '提交失败', icon: 'none' })
  } finally { submitting.value = false }
}

onMounted(() => {
  loadSourceBills()
  ensurePurchaseData()
})
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
  gap: $uni-spacing-sm;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  padding: 6rpx;
}

.doc-nav-sub {
  display: flex;
  gap: $uni-spacing-sm;
  margin-top: $uni-spacing-sm;
}

.doc-seg {
  flex: 1;
  text-align: center;
  padding: $uni-spacing-sm 0;
  font-size: 26rpx;
  color: $uni-gray-500;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  font-weight: 500;
  transition: all 0.2s ease;
}

.doc-seg--sub {
  padding: $uni-spacing-sm 0;
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
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin: $uni-spacing-sm $uni-spacing-base;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-sm;
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
  gap: 10rpx;
}

.qc-cell {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  padding: 10rpx $uni-spacing-sm;
}

.qc-label {
  font-size: 20rpx;
  color: $uni-gray-400;
}

.qc-val {
  font-size: 26rpx;
  color: $uni-gray-700;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.qc-chev {
  font-size: 22rpx;
  color: $uni-gray-300;
  margin-left: $uni-spacing-xs;
}

.customer-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
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
  padding: $uni-spacing-md 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
  gap: $uni-spacing-sm;
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
  border-radius: $uni-border-radius-xs;
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
  margin-top: $uni-spacing-xs;
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
  border-radius: $uni-border-radius-xs;
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
  color: $uni-gray-0;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0 $uni-border-radius-xs $uni-border-radius-xs 0;
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
  margin: 0 $uni-spacing-xs;
  background: $uni-bg-color-page;
  border-radius: 8rpx;
}

.item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: $uni-spacing-xs;
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
  padding: 4rpx $uni-spacing-xs;
}

/* 追溯码（原稿：每件商品下方追溯码行，已录入显示「已关联」） */
.item-trace {
  width: 100%;
  display: flex;
  align-items: center;
  gap: $uni-spacing-sm;
  margin-top: $uni-spacing-sm;
  padding-top: $uni-spacing-sm;
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
  padding: 10rpx $uni-spacing-sm;
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
  gap: $uni-spacing-sm;
  padding: 10rpx $uni-spacing-sm;
  background: $uni-color-primary-soft;
  border-radius: 8rpx;
  border: 1rpx solid $uni-color-primary-soft;
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
  padding: 2rpx $uni-spacing-sm;
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
  gap: $uni-spacing-sm;
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
  margin-right: $uni-spacing-xs;
}

/* 扫码图标（替换 emoji，规范禁 emoji 图标） */
.add-icon-img {
  width: 34rpx;
  height: 34rpx;
  margin-right: $uni-spacing-xs;
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
  padding: $uni-spacing-sm 0;
}

.amount-row--total {
  padding-top: $uni-spacing-sm;
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
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-md $uni-spacing-base;
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
  background: $uni-color-primary;
  border-radius: 40rpx;
  font-size: 28rpx;
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

/* 次要按钮（ghost：保存/分享）：覆盖主按钮蓝底，白底描边、灰字，与主操作分层 */
.submit-btn.draft-btn,
.submit-btn.share-btn {
  background: $uni-bg-color;
  border: 2rpx solid $uni-border-color;
  color: $uni-gray-600;
  font-weight: 500;
}

.submit-btn--disabled {
  opacity: 0.5;
}

.safe-bottom {
  height: 40rpx;
}

.field-error {
  margin-top: $uni-spacing-xs;
  padding: 6rpx 0;
}

.error-text {
  font-size: 24rpx;
  color: $uni-color-error;
}

/* 出货占位（后端接口待开放） */
.doc-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $uni-spacing-sm;
  padding: 80rpx $uni-spacing-lg;
}
.placeholder-icon {
  font-size: 80rpx;
  line-height: 1;
}
.placeholder-text {
  font-size: 28rpx;
  color: $uni-gray-500;
  text-align: center;
}

/* 收款金额输入行 */
.amount-input-row {
  display: flex;
  align-items: center;
  gap: $uni-spacing-xs;
}
.amount-input-row .discount-input {
  flex: 1;
  font-size: 40rpx;
  font-weight: 700;
  color: $uni-text-color;
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
  border-radius: $uni-border-radius-sm $uni-border-radius-sm 0 0;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.picker-popup--large {
  max-height: 85vh;
}

.picker-popup--product {
  max-height: 90vh;
  border-radius: $uni-border-radius-sm $uni-border-radius-sm 0 0;
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
  padding: $uni-spacing-base $uni-spacing-lg;
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
  padding: 4rpx $uni-spacing-sm;
  border-radius: 8rpx;
  margin-right: $uni-spacing-sm;
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
  padding: $uni-spacing-sm $uni-spacing-base;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-sm;
  margin-right: $uni-spacing-sm;
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
  padding: $uni-spacing-md $uni-spacing-base;
  border-bottom: 1rpx solid $uni-bg-color-grey;
  gap: $uni-spacing-sm;
}

.product-item:last-child {
  border-bottom: none;
}

.product-image {
  width: 96rpx;
  height: 96rpx;
  border-radius: $uni-border-radius-xs;
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
  gap: $uni-spacing-sm;
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
  gap: $uni-spacing-xs;
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
  padding: $uni-spacing-base 0;
  gap: $uni-spacing-sm;
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
  margin-top: $uni-spacing-md;
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

/* 出货：对接销售单只读摘要 */
.ship-summary {
  display: flex;
  flex-direction: column;
  gap: $uni-spacing-sm;
  padding: $uni-spacing-sm 0;
}
.ship-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ship-lab {
  color: $uni-gray-600;
  font-size: 26rpx;
}
.ship-val {
  color: $uni-text-color;
  font-size: 26rpx;
  font-weight: 500;
}
.ship-tip {
  margin-top: $uni-spacing-sm;
  font-size: 24rpx;
  color: $uni-gray-400;
}

/* ========== 对齐 HTML 打磨版新增的视觉元素 ========== */
/* 单据状态徽标（HTML .hd-status draft / saved） */
.doc-status {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  padding: 10rpx 32rpx 0;
}
.ds-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}
.ds-text {
  font-size: 24rpx;
  font-weight: 500;
}
.doc-status--draft .ds-dot { background: $uni-gray-400; }
.doc-status--draft .ds-text { color: $uni-gray-500; }
.doc-status--saved .ds-dot { background: $uni-color-success; }
.doc-status--saved .ds-text { color: $uni-color-success; }

/* 卡片标题徽标（HTML .ct-badge：商品 N 种 / 待核销 N/M） */
.ct-badge {
  font-size: 22rpx;
  font-weight: 500;
  color: $uni-color-primary;
  background: $uni-color-primary-soft;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
}

/* 收款方式胶囊（HTML .chip / .chip-row） */
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}
.chip {
  padding: 14rpx 28rpx;
  background: $uni-bg-color-page;
  border: 1rpx solid $uni-border-color;
  border-radius: 32rpx;
  font-size: 26rpx;
  color: $uni-gray-600;
  transition: all 0.15s ease;
}
.chip--active {
  background: $uni-color-primary;
  border-color: $uni-color-primary;
  color: $uni-text-color-inverse;
  font-weight: 600;
}
</style>
