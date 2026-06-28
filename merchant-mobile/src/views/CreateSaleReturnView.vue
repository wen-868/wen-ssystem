<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  showToast,
  showLoadingToast,
  showSuccessToast,
  closeToast
} from 'vant'
import {
  createSaleReturn,
  fetchSaleBillDetail,
  fetchProducts,
  type SaleBillDetail,
  type ProductRecord
} from '../api'

// ========== 退货模式 ==========
const RETURN_TYPE_OPTIONS = [
  { label: '按销售单退货', value: 'BY_BILL' },
  { label: '直接退货', value: 'DIRECT' }
]
const returnType = ref<'BY_BILL' | 'DIRECT'>('BY_BILL')

// ========== 按单退货 - 销售单号 ==========
const sourceBillNo = ref('')
const sourceBill = ref<SaleBillDetail | null>(null)
const sourceBillLoading = ref(false)

async function loadSourceBill() {
  if (!sourceBillNo.value.trim()) {
    showToast('请输入销售单号')
    return
  }
  sourceBillLoading.value = true
  try {
    const res = await fetchSaleBillDetail(sourceBillNo.value.trim())
    sourceBill.value = res.data
    // 将销售单商品复制到退货商品列表
    returnItems.value = sourceBill.value?.items?.map(item => ({
      skuId: item.skuId,
      skuName: item.skuName,
      boxQty: item.boxQty,
      bottleQty: item.bottleQty,
      bottlesPerBox: 6,
      unitPrice: item.unitPrice,
      priceType: item.priceType
    })) || []
    showSuccessToast('已加载销售单')
  } catch {
    showToast('销售单不存在或加载失败')
  } finally {
    sourceBillLoading.value = false
  }
}

// ========== 直接退货 - 商品选择 ==========
const productKeyword = ref('')
const productResults = ref<ProductRecord[]>([])
const showProductSearch = ref(false)

async function searchProducts() {
  if (!productKeyword.value.trim()) return
  try {
    const res = await fetchProducts({ keyword: productKeyword.value })
    productResults.value = res.data.records ?? []
  } catch {
    showToast('操作失败，请重试')
  }
}

function addProduct(p: ProductRecord) {
  const exists = returnItems.value.find(i => i.skuId === p.skuId)
  if (exists) {
    exists.bottleQty += 1
    showToast('已增加数量')
  } else {
    returnItems.value.push({
      skuId: p.skuId,
      skuName: p.skuName,
      boxQty: 0,
      bottleQty: 1,
      bottlesPerBox: 6,
      unitPrice: p.retailPrice,
      priceType: 'RETAIL'
    })
  }
  showProductSearch.value = false
  productKeyword.value = ''
  productResults.value = []
}

// ========== 退货商品列表 ==========
interface ReturnItem {
  skuId: number
  skuName: string
  boxQty: number
  bottleQty: number
  bottlesPerBox: number
  unitPrice: number
  priceType: string
}

const returnItems = ref<ReturnItem[]>([])

function removeItem(index: number) {
  returnItems.value.splice(index, 1)
}

function itemTotalBottleQty(item: ReturnItem) {
  return item.boxQty * item.bottlesPerBox + item.bottleQty
}

function itemSubtotal(item: ReturnItem) {
  return item.unitPrice * itemTotalBottleQty(item)
}

const returnAmount = computed(() =>
  returnItems.value.reduce((sum, i) => sum + itemSubtotal(i), 0)
)

// ========== 退货原因和备注 ==========
const reason = ref('')
const remark = ref('')

const REASON_OPTIONS = [
  '商品质量问题',
  '商品损坏',
  '客户退货',
  '订单错误',
  '其他原因'
]

// ========== 提交 ==========
async function submitReturn() {
  if (returnItems.value.length === 0) {
    showToast('请先添加退货商品')
    return
  }
  if (returnType.value === 'BY_BILL' && !sourceBill.value) {
    showToast('请先加载销售单')
    return
  }
  if (!reason.value) {
    showToast('请选择退货原因')
    return
  }

  try {
    showLoadingToast({ message: '创建退货单...', forbidClick: true })
    await createSaleReturn({
      sourceBillNo: returnType.value === 'BY_BILL' ? (sourceBill.value?.billNo ?? undefined) : undefined,
      customerId: sourceBill.value?.customerId ?? null,
      customerName: sourceBill.value?.customerName ?? undefined,
      customerMobile: sourceBill.value?.customerMobile ?? undefined,
      returnType: returnType.value,
      reason: reason.value,
      remark: remark.value || undefined,
      items: returnItems.value.map(i => ({
        skuId: i.skuId,
        boxQty: i.boxQty,
        bottleQty: i.bottleQty,
        totalBottleQty: itemTotalBottleQty(i),
        unitPrice: i.unitPrice,
        priceType: i.priceType
      }))
    })
    closeToast()
    showSuccessToast('退货单创建成功')
    resetForm()
    goBack()
  } catch (err: any) {
    closeToast()
    showToast(err.response?.data?.message || '操作失败')
  }
}

// ========== 表单重置 ==========
function resetForm() {
  returnType.value = 'BY_BILL'
  sourceBillNo.value = ''
  sourceBill.value = null
  returnItems.value = []
  reason.value = ''
  remark.value = ''
}

// ========== 导航 ==========
function goBack() {
  window.dispatchEvent(new CustomEvent('nav', { detail: 'sale-returns' }))
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">创建退货单</h2>
      <van-button type="default" size="small" icon="arrow-left" @click="goBack">
        返回
      </van-button>
    </div>

    <!-- 退货模式选择 -->
    <div class="card">
      <div class="section-title">退货模式</div>
      <van-radio-group v-model="returnType" direction="horizontal">
        <van-radio
          v-for="option in RETURN_TYPE_OPTIONS"
          :key="option.value"
          :name="option.value"
        >
          {{ option.label }}
        </van-radio>
      </van-radio-group>
    </div>

    <!-- 按单退货 - 销售单号输入 -->
    <div v-if="returnType === 'BY_BILL'" class="card">
      <div class="section-title">销售单号</div>
      <van-field
        v-model="sourceBillNo"
        placeholder="输入销售单号"
        clearable
      >
        <template #button>
          <van-button
            type="primary"
            size="small"
            :loading="sourceBillLoading"
            @click="loadSourceBill"
          >
            加载
          </van-button>
        </template>
      </van-field>
      <div v-if="sourceBill" class="source-bill-info">
        <div class="info-row">
          <span class="label">客户：</span>
          <span>{{ sourceBill.customerName || '散客' }}</span>
        </div>
        <div class="info-row">
          <span class="label">金额：</span>
          <span class="amount">¥{{ Number(sourceBill.receivableAmount).toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- 直接退货 - 商品选择 -->
    <div v-if="returnType === 'DIRECT'" class="card">
      <div class="section-title">添加商品</div>
      <div class="product-actions">
        <van-button type="primary" size="small" icon="search" @click="showProductSearch = true">
          搜索商品
        </van-button>
      </div>
    </div>

    <!-- 退货商品列表 -->
    <div v-if="returnItems.length > 0" class="card">
      <div class="section-title">退货商品</div>
      <div
        v-for="(item, index) in returnItems"
        :key="item.skuId"
        class="return-item"
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

    <!-- 退货原因 -->
    <div class="card">
      <div class="section-title">退货原因</div>
      <van-radio-group v-model="reason" direction="vertical">
        <van-radio
          v-for="option in REASON_OPTIONS"
          :key="option"
          :name="option"
        >
          {{ option }}
        </van-radio>
      </van-radio-group>
    </div>

    <!-- 备注 -->
    <div class="card">
      <div class="section-title">备注</div>
      <van-field
        v-model="remark"
        type="textarea"
        rows="2"
        placeholder="选填，输入备注信息"
        maxlength="200"
        show-word-limit
      />
    </div>

    <!-- 汇总栏 -->
    <div class="summary-card">
      <div class="summary-row total">
        <span>退货金额</span>
        <span class="total-amount">¥{{ returnAmount.toFixed(2) }}</span>
      </div>
    </div>

    <!-- 底部操作按钮 -->
    <div class="action-footer">
      <van-button
        type="danger"
        block
        round
        size="large"
        @click="submitReturn"
      >
        提交退货单
      </van-button>
    </div>

    <!-- 商品搜索弹窗 -->
    <van-popup v-model:show="showProductSearch" position="bottom" round :style="{ maxHeight: '80%' }">
      <div class="popup-panel">
        <h3>选择商品</h3>
        <van-search
          v-model="productKeyword"
          placeholder="输入商品名称/条码"
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
              <div class="product-header">
                <span class="product-name">{{ p.skuName }}</span>
                <span class="product-price">¥{{ Number(p.retailPrice).toFixed(2) }}</span>
              </div>
            </template>
            <template #label>
              <div class="product-meta">
                <span>库存: {{ p.availableQty }}</span>
                <span>条码: {{ p.barcode || '-' }}</span>
              </div>
            </template>
          </van-cell>
        </van-cell-group>
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

.card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.source-bill-info {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-soft);
  border-radius: var(--radius-sm);
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-row .label {
  color: var(--text-muted);
}

.amount {
  font-weight: 600;
  color: var(--color-primary);
}

.product-actions {
  display: flex;
  gap: 8px;
}

.return-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-normal);
}

.return-item:last-child {
  border-bottom: none;
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.item-price {
  font-size: 13px;
  color: var(--text-secondary);
}

.item-qty-row {
  display: flex;
  gap: 16px;
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
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
}

.summary-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.summary-row.total {
  border-top: 1px solid var(--border-normal);
  padding-top: 12px;
  margin-top: 4px;
}

.total-amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-danger);
}

.action-footer {
  margin-top: 20px;
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

.product-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.product-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.product-price {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

.product-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
