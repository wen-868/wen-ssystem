<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  showToast,
  showLoadingToast,
  showSuccessToast,
  closeToast
} from 'vant'
import {
  createSaleBill,
  offlinePayment,
  createCollectionLink,
  fetchAdminProducts,
  fetchAdminCustomers,
  fetchShiftSummary,
  type AdminCustomerRecord,
  type AdminProductRecord,
  type SaleBillDetail,
  type ShiftData
} from '../api'
import { isWeChat, wxScanQRCode } from '../utils/wx'

const router = useRouter()

// ========== 班次信息 ==========
const shiftData = ref<ShiftData | null>(null)

async function loadShift() {
  try {
    const res = await fetchShiftSummary()
    shiftData.value = res.data as ShiftData
  } catch {
    shiftData.value = null
  }
}

function formatPrice(price: number | null | undefined): string {
  return Number(price ?? 0).toFixed(2)
}

// ========== 场景 ==========
const SCENE_TABS = [
  { label: '门店现场', value: 'STORE' },
  { label: '外出拜访', value: 'VISIT' }
]
const scene = ref('STORE')

// ========== 销售类型（现销/赊销） ==========
const SALE_TYPE_TABS = [
  { label: '现销', value: 'CASH' },
  { label: '赊销', value: 'CREDIT' }
]
const saleType = ref('CASH')

// 赊销截止日期
const dueDate = ref('')
const showDueDatePicker = ref(false)
const minDate = new Date()
minDate.setDate(minDate.getDate() + 1)
const currentDueDate = ref(minDate)

function onDueDateConfirm(date: Date) {
  dueDate.value = date.toISOString().split('T')[0]
  showDueDatePicker.value = false
}

// ========== 客户选择 ==========
const customerKeyword = ref('')
const customerResults = ref<AdminCustomerRecord[]>([])
const selectedCustomer = ref<AdminCustomerRecord | null>(null)
const showCustomerSearch = ref(false)

async function searchCustomers() {
  if (!customerKeyword.value.trim()) return
  try {
    const res = await fetchAdminCustomers({ keyword: customerKeyword.value })
    customerResults.value = (res.data as any)?.records ?? []
  } catch {
    showToast('操作失败，请重试')
  }
}

function selectCustomer(c: AdminCustomerRecord) {
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
const productResults = ref<AdminProductRecord[]>([])
const showProductSearch = ref(false)

// 扫码状态
const showScanPopup = ref(false)
const scanBarcode = ref('')
const scanLoading = ref(false)
const scanStream = ref<MediaStream | null>(null)

async function searchProducts() {
  if (!productKeyword.value.trim()) return
  try {
    const res = await fetchAdminProducts({ keyword: productKeyword.value })
    productResults.value = (res.data as any)?.records ?? []
  } catch {
    showToast('操作失败，请重试')
  }
}

async function onScan() {
  scanBarcode.value = ''
  if (isWeChat()) {
    try {
      const result = await wxScanQRCode()
      if (result) {
        scanBarcode.value = result
        productKeyword.value = result
        showProductSearch.value = true
        await searchProducts()
      }
    } catch {
      showToast('扫码失败，请手动输入')
    }
    return
  }
  showScanPopup.value = true
  startCamera()
}

async function startCamera() {
  scanLoading.value = true
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })
    scanStream.value = stream
    const video = document.getElementById('scan-video') as HTMLVideoElement
    if (video) {
      video.srcObject = stream
      video.play()
      detectBarcode(video)
    }
  } catch {
    scanLoading.value = false
  }
}

function stopCamera() {
  if (scanStream.value) {
    scanStream.value.getTracks().forEach(t => t.stop())
    scanStream.value = null
  }
}

async function detectBarcode(video: HTMLVideoElement) {
  try {
    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code'] })
      const detect = async () => {
        if (!scanStream.value || scanLoading.value === false) return
        try {
          const barcodes = await detector.detect(video)
          if (barcodes.length > 0) {
            scanBarcode.value = barcodes[0].rawValue
            scanLoading.value = false
            stopCamera()
            await searchByBarcode()
            return
          }
        } catch { /* continue */ }
        if (scanStream.value) {
          requestAnimationFrame(detect)
        }
      }
      scanLoading.value = false
      detect()
    } else {
      scanLoading.value = false
    }
  } catch {
    scanLoading.value = false
  }
}

async function searchByBarcode() {
  if (!scanBarcode.value.trim()) return
  try {
    const res = await fetchAdminProducts({ keyword: scanBarcode.value })
    const items = (res.data as any)?.records ?? []
    if (items.length === 1) {
      addProduct(items[0])
      showScanPopup.value = false
    } else if (items.length > 1) {
      productResults.value = items
      showScanPopup.value = false
      showProductSearch.value = true
    } else {
      showToast('未找到该条码对应的商品')
    }
  } catch {
    showToast('扫码查询失败')
  }
}

function onManualBarcodeConfirm() {
  if (!scanBarcode.value.trim()) {
    showToast('请输入条码')
    return
  }
  stopCamera()
  searchByBarcode()
}

function onScanPopupClose() {
  stopCamera()
  scanLoading.value = false
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

function addProduct(p: AdminProductRecord) {
  const exists = selectedItems.value.find(i => i.skuId === p.skuId)
  if (exists) {
    exists.bottleQty += 1
    showToast('已增加数量')
  } else {
    const isWholesale = selectedCustomer.value?.customerType === 'WHOLESALE'
    const price = isWholesale
      ? ((p.wholesalePrice && p.wholesalePrice > 0) ? p.wholesalePrice : p.retailPrice)
      : p.retailPrice
    selectedItems.value.push({
      skuId: p.skuId,
      skuName: p.skuName,
      skuCode: p.skuCode,
      unitPrice: Number(price),
      priceType: isWholesale ? 'WHOLESALE' : 'RETAIL',
      boxQty: 0,
      bottleQty: 1,
      bottlesPerBox: p.boxRatio || 6
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
  if (discountAmount.value < 0) {
    showToast('折扣金额不能为负数')
    return
  }
  if (roundingAmount.value < 0) {
    showToast('抹零金额不能为负数')
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
      saleType: 'CASH',
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
    const bill: SaleBillDetail = billRes.data
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
  if (discountAmount.value < 0) {
    showToast('折扣金额不能为负数')
    return
  }
  if (roundingAmount.value < 0) {
    showToast('抹零金额不能为负数')
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
      saleType: 'CASH',
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
    const bill: SaleBillDetail = billRes.data
    closeToast()

    showLoadingToast({ message: '生成链接...', forbidClick: true })
    const linkRes = await createCollectionLink(bill.billNo, {
      amount: linkAmount.value,
      expireHours: linkExpireHours.value
    })
    closeToast()
    const linkData = linkRes.data
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

// ========== 赊销提交 ==========
async function submitCreditSale() {
  if (selectedItems.value.length === 0) {
    showToast('请先选择商品')
    return
  }
  if (!selectedCustomer.value) {
    showToast('请选择客户（赊销必须选择客户）')
    return
  }
  if (!dueDate.value) {
    showToast('请选择应收截止日期')
    return
  }
  try {
    showLoadingToast({ message: '创建赊销单...', forbidClick: true })
    await createSaleBill({
      saleType: 'CREDIT',
      customerId: selectedCustomer.value.memberId,
      customerName: selectedCustomer.value.name,
      customerMobile: selectedCustomer.value.mobile,
      discountAmount: discountAmount.value,
      roundingAmount: roundingAmount.value,
      dueDate: dueDate.value,
      items: selectedItems.value.map(i => ({
        skuId: i.skuId,
        boxQty: i.boxQty,
        bottleQty: i.bottleQty,
        totalBottleQty: itemTotalBottleQty(i),
        unitPrice: i.unitPrice,
        priceType: i.priceType
      }))
    })
    closeToast()
    showSuccessToast('赊销单已创建')
    resetForm()
  } catch (err: any) {
    closeToast()
    showToast(err.response?.data?.message || '操作失败')
  }
}

// ========== 表单重置 ==========
function resetForm() {
  scene.value = 'STORE'
  saleType.value = 'CASH'
  selectedCustomer.value = null
  selectedItems.value = []
  discountAmount.value = 0
  roundingAmount.value = 0
  paymentMethod.value = ''
  generatedLink.value = ''
  dueDate.value = ''
}

// ========== 跳转到销售单列表 ==========
function goToSaleBills() {
  router.push('/sale-bills')
}
onMounted(() => {
  loadShift()
})

</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">销售开单</h2>
      <van-button type="default" size="small" icon="orders-o" @click="goToSaleBills">
        单据
      </van-button>
    </div>

    <!-- 班次信息 -->
    <div v-if="shiftData" class="shift-bar">
      <div class="shift-info">
        <span class="shift-label">今日</span>
        <span class="shift-item">销售 ¥{{ formatPrice(shiftData.totalSales) }}</span>
        <span class="shift-item">收款 ¥{{ formatPrice(shiftData.totalReceived) }}</span>
        <span class="shift-item">{{ shiftData.orderCount }}单</span>
      </div>
      <van-button size="mini" type="primary" plain @click="$router.push('/shift/settlement')">
        班结
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

    <!-- 销售类型切换（仅门店现场） -->
    <div v-if="scene === 'STORE'" class="sale-type-bar">
      <span class="sale-type-label">销售类型：</span>
      <van-tabs v-model:active="saleType" type="card" class="sale-type-tabs">
        <van-tab
          v-for="tab in SALE_TYPE_TABS"
          :key="tab.value"
          :title="tab.label"
          :name="tab.value"
        />
      </van-tabs>
    </div>

    <!-- 赊销截止日期（仅赊销模式） -->
    <div v-if="scene === 'STORE' && saleType === 'CREDIT'" class="due-date-card">
      <van-cell-group inset>
        <van-cell title="应收截止日期" is-link :value="dueDate || '请选择'" @click="showDueDatePicker = true" />
      </van-cell-group>
      <div class="due-date-tip">赊销订单将在此日期前完成收款</div>
    </div>

    <!-- 客户选择 -->
    <div class="card">
      <div class="section-title">客户信息</div>
      <div v-if="selectedCustomer" class="customer-selected">
        <div class="customer-info-row">
          <span class="customer-name">{{ selectedCustomer.name }}</span>
          <van-tag
            :type="selectedCustomer.customerType === 'WHOLESALE' ? 'primary' : 'success'"
            plain
            size="medium"
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
      <!-- 门店现场 - 现销 -->
      <van-button
        v-if="scene === 'STORE' && saleType === 'CASH'"
        type="primary"
        block
        round
        size="large"
        @click="openPayment"
      >
        立即收款
      </van-button>
      <!-- 门店现场 - 赊销 -->
      <van-button
        v-else-if="scene === 'STORE' && saleType === 'CREDIT'"
        type="warning"
        block
        round
        size="large"
        @click="submitCreditSale"
      >
        创建赊销单
      </van-button>
      <!-- 外出拜访 -->
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
                  size="medium"
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
              <span class="product-stock">{{ p.categoryName || p.skuCode || '-' }}</span>
            </template>
            <template #value>
              <span class="product-price">
                ¥{{ (selectedCustomer?.customerType === 'WHOLESALE'
                  ? ((p.wholesalePrice && p.wholesalePrice > 0) ? p.wholesalePrice : p.retailPrice)
                  : p.retailPrice
                ).toFixed(2) }}</span>
            </template>
          </van-cell>
        </van-cell-group>
      </div>
    </van-popup>

    <!-- 扫码弹窗 -->
    <van-popup v-model:show="showScanPopup" position="center" round :style="{ width: '90%', maxWidth: '400px' }" @close="onScanPopupClose">
      <div class="scan-panel">
        <h3>扫码</h3>
        <div v-if="scanLoading" class="scan-loading">
          <van-loading /> 启动摄像头...
        </div>
        <div class="scan-video-wrapper">
          <video id="scan-video" autoplay playsinline muted class="scan-video" />
        </div>
        <div class="scan-manual">
          <van-field
            v-model="scanBarcode"
            label="条码"
            placeholder="手动输入条码"
            clearable
          />
          <van-button type="primary" block size="small" @click="onManualBarcodeConfirm">
            确认查询
          </van-button>
        </div>
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

    <!-- 截止日期选择器 -->
    <van-popup v-model:show="showDueDatePicker" position="bottom" round>
      <van-datetime-picker
        v-model="currentDueDate"
        type="date"
        title="选择应收截止日期"
        :min-date="minDate"
        @confirm="onDueDateConfirm"
        @cancel="showDueDatePicker = false"
      />
    </van-popup>

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

.sale-type-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 0 4px;
}

.sale-type-label {
  font-size: 14px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.sale-type-tabs {
  flex: 1;
}

:deep(.sale-type-tabs .van-tabs__nav--card) {
  border-color: var(--color-warning);
}

:deep(.sale-type-tabs .van-tab--active) {
  background: var(--color-warning);
  color: #fff;
}

:deep(.sale-type-tabs .van-tab) {
  color: var(--color-warning);
  border-color: var(--color-warning);
}

.due-date-card {
  margin-bottom: 12px;
}

.due-date-tip {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--text-muted);
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

/* ===== 扫码弹窗 ===== */
.scan-panel {
  padding: 20px 16px;
}

.scan-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.scan-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  font-size: 14px;
  color: var(--text-secondary);
}

.scan-video-wrapper {
  width: 100%;
  height: 200px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
}

.scan-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scan-manual {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ===== 班次信息 ===== */
.shift-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  margin-bottom: 8px;
  background: var(--color-primary-soft);
  border-radius: var(--radius-md);
}

.shift-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.shift-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--bg-card);
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

.shift-item {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
}

</style>
