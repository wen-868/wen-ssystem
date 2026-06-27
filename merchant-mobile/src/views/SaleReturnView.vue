<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  showToast,
  showLoadingToast,
  showSuccessToast,
  closeToast
} from 'vant'
import {
  api,
  fetchSaleReturns,
  fetchSaleReturnDetail,
  createSaleReturn,
  fetchSaleBills,
  fetchSaleBillDetail,
  type SaleReturnRecord,
  type SaleReturnDetail,
  type SaleBillDetail
} from '../api'

const route = useRoute()
const router = useRouter()

// ========== 状态管理 ==========
const activeTab = ref('list')
const storeId = ref(0)

// ========== 退货列表 ==========
const returns = ref<SaleReturnRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  PENDING: { text: '待审核', type: 'warning' },
  COMPLETED: { text: '已通过', type: 'success' },
  REJECTED: { text: '已拒绝', type: 'danger' }
}

async function loadReturns(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchSaleReturns({
      page: page.value,
      pageSize
    })
    const data = res.data
    if (reset) {
      returns.value = data.records ?? []
    } else {
      returns.value.push(...(data.records ?? []))
    }
    if (returns.value.length >= (data.total ?? 0)) {
      finished.value = true
    }
    page.value++
  } catch {
    showToast('操作失败，请重试')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onRefresh() {
  refreshing.value = true
  loadReturns(true)
}

// ========== 详情弹窗 ==========
const showDetail = ref(false)
const detail = ref<SaleReturnDetail | null>(null)
const detailLoading = ref(false)

async function viewDetail(returnNo: string) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await fetchSaleReturnDetail(returnNo)
    detail.value = res.data
  } catch {
    showToast('操作失败，请重试')
  } finally {
    detailLoading.value = false
  }
}

// ========== 创建退货 ==========
const RETURN_REASONS = [
  { label: '质量问题', value: '质量问题' },
  { label: '发错货', value: '发错货' },
  { label: '客户退货', value: '客户退货' },
  { label: '其他', value: '其他' }
]

// 选择销售单
const showBillSearch = ref(false)
const billKeyword = ref('')
const billResults = ref<any[]>([])
const selectedBill = ref<any>(null)

async function searchBills() {
  try {
    const res = await fetchSaleBills({ keyword: billKeyword.value || undefined, pageSize: 20 })
    billResults.value = res.data.records ?? []
  } catch {
    showToast('操作失败，请重试')
  }
}

function selectBill(bill: any) {
  selectedBill.value = bill
  showBillSearch.value = false
  billKeyword.value = ''
  billResults.value = []
  // 加载销售单商品
  loadBillItems(bill.billNo)
}

async function loadBillItems(billNo: string) {
  try {
    const res = await fetchSaleBillDetail(billNo)
    const bill: SaleBillDetail = res.data
    // 将销售单商品映射为退货商品
    returnItems.value = bill.items.map(item => ({
      skuId: item.skuId,
      skuName: item.skuName,
      boxQty: 0,
      bottleQty: 0,
      unitPrice: item.unitPrice,
      maxBoxQty: item.boxQty,
      maxBottleQty: item.bottleQty,
      totalBottleQty: 0,
      checked: false
    }))
  } catch {
    showToast('加载商品失败')
  }
}

// 退货商品
interface ReturnItem {
  skuId: number
  skuName: string
  boxQty: number
  bottleQty: number
  unitPrice: number
  maxBoxQty: number
  maxBottleQty: number
  totalBottleQty: number
  checked: boolean
}

const returnItems = ref<ReturnItem[]>([])
const returnReason = ref('')
const returnRemark = ref('')

// 计算退货金额
const returnAmount = computed(() => {
  return returnItems.value
    .filter(item => item.checked)
    .reduce((sum, item) => {
      const totalQty = item.boxQty * 12 + item.bottleQty
      return sum + totalQty * item.unitPrice
    }, 0)
})

// 已选中的退货商品数量
const checkedCount = computed(() => {
  return returnItems.value.filter(item => item.checked).length
})

// 全选/取消全选
const allChecked = computed({
  get: () => returnItems.value.length > 0 && returnItems.value.every(item => item.checked),
  set: (val: boolean) => {
    returnItems.value.forEach(item => {
      item.checked = val
      if (!val) {
        item.boxQty = 0
        item.bottleQty = 0
      }
    })
  }
})

async function submitReturn() {
  if (!selectedBill.value) {
    showToast('请选择原销售单')
    return
  }
  if (!returnReason.value) {
    showToast('请选择退货原因')
    return
  }
  const checkedItems = returnItems.value.filter(item => item.checked)
  if (checkedItems.length === 0) {
    showToast('请选择退货商品')
    return
  }
  const hasInvalidQty = checkedItems.some(item => {
    const totalQty = item.boxQty * 12 + item.bottleQty
    return totalQty <= 0
  })
  if (hasInvalidQty) {
    showToast('请设置退货数量')
    return
  }

  try {
    showLoadingToast({ message: '提交中...', forbidClick: true })
    await createSaleReturn({
      sourceBillNo: selectedBill.value.billNo,
      storeId: storeId.value,
      customerName: selectedBill.value.customerName || undefined,
      customerMobile: undefined,
      discountAmount: 0,
      remark: returnRemark.value || undefined,
      items: checkedItems.map(item => ({
        skuId: item.skuId,
        skuName: item.skuName,
        boxQty: item.boxQty,
        bottleQty: item.bottleQty,
        unitPrice: item.unitPrice,
        reason: returnReason.value
      }))
    })
    closeToast()
    showSuccessToast('退货申请已提交')
    resetCreateForm()
    activeTab.value = 'list'
    loadReturns(true)
  } catch (err: any) {
    closeToast()
    showToast(err.response?.data?.message || '提交失败')
  }
}

function resetCreateForm() {
  selectedBill.value = null
  returnItems.value = []
  returnReason.value = ''
  returnRemark.value = ''
}

function onTabChange(name: string) {
  if (name === 'list') {
    loadReturns(true)
  }
}

// 返回
function goBack() {
  router.back()
}

// 获取 storeId
async function fetchStoreId() {
  try {
    const savedUser = localStorage.getItem('merchant_user')
    if (savedUser) {
      const parsed = JSON.parse(savedUser)
      if (parsed.storeId) {
        storeId.value = parsed.storeId
        return
      }
    }
    const res = await api.get('/store/me')
    storeId.value = res.data?.storeId || 0
  } catch {
    storeId.value = 0
  }
}

onMounted(async () => {
  await fetchStoreId()
  loadReturns(true)

  // 如果有路由参数传入 billNo，自动切换到创建并加载该销售单
  const billNo = route.query.billNo as string
  if (billNo) {
    activeTab.value = 'create'
    selectedBill.value = { billNo }
    loadBillItems(billNo)
  }
})
</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">销售退货</h2>
      <van-button type="default" size="small" icon="arrow-left" @click="goBack">
        返回
      </van-button>
    </div>

    <van-tabs v-model:active="activeTab" @change="onTabChange">
      <van-tab title="退货列表" name="list" />
      <van-tab title="退货申请" name="create" />
    </van-tabs>

    <!-- ========== 退货列表 ========== -->
    <template v-if="activeTab === 'list'">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          finished-text="没有更多了"
          @load="loadReturns"
        >
          <div v-if="returns.length === 0 && !loading" class="empty-wrapper">
            <van-empty description="暂无退货记录" />
          </div>
          <van-cell
            v-for="item in returns"
            :key="item.returnNo"
            is-link
            class="return-cell"
            @click="viewDetail(item.returnNo)"
          >
            <template #title>
              <div class="return-header">
                <span class="return-no">{{ item.returnNo }}</span>
                <van-tag
                  :type="(STATUS_MAP[item.status]?.type as any) || 'default'"
                  plain
                  size="medium"
                >
                  {{ STATUS_MAP[item.status]?.text || item.status }}
                </van-tag>
              </div>
            </template>
            <template #label>
              <div class="return-info">
                <span>{{ item.customerName || '散客' }}</span>
                <span class="return-amount">
                  ¥{{ Number(item.refundAmount || 0).toFixed(2) }}
                </span>
              </div>
              <div class="return-source" v-if="item.sourceBillNo">
                原单：{{ item.sourceBillNo }}
              </div>
              <div class="return-time">{{ item.createdAt }}</div>
            </template>
          </van-cell>
        </van-list>
      </van-pull-refresh>
    </template>

    <!-- ========== 退货申请 ========== -->
    <template v-if="activeTab === 'create'">
      <div class="create-form">
        <!-- 选择原销售单 -->
        <div class="card">
          <div class="section-title">原销售单</div>
          <div v-if="selectedBill" class="bill-selected">
            <div class="bill-info-row">
              <span class="bill-no">{{ selectedBill.billNo }}</span>
              <van-tag
                v-if="selectedBill.customerName"
                type="primary"
                plain
                size="medium"
              >
                {{ selectedBill.customerName }}
              </van-tag>
            </div>
            <van-button type="default" size="small" plain @click="selectedBill = null">
              重新选择
            </van-button>
          </div>
          <div v-else class="bill-actions">
            <van-button type="primary" size="small" icon="search" @click="showBillSearch = true">
              搜索销售单
            </van-button>
          </div>
        </div>

        <!-- 退货原因 -->
        <div class="card">
          <div class="section-title">退货原因</div>
          <van-radio-group v-model="returnReason" direction="horizontal">
            <van-radio
              v-for="opt in RETURN_REASONS"
              :key="opt.value"
              :name="opt.value"
            >
              {{ opt.label }}
            </van-radio>
          </van-radio-group>
        </div>

        <!-- 退货商品 -->
        <div v-if="returnItems.length > 0" class="card">
          <div class="section-title">
            退货商品
            <van-checkbox
              v-model="allChecked"
              class="all-check"
              shape="square"
            >
              全选
            </van-checkbox>
          </div>
          <div
            v-for="item in returnItems"
            :key="item.skuId"
            class="return-item"
          >
            <div class="item-header">
              <van-checkbox v-model="item.checked" shape="square" />
              <span class="item-name">{{ item.skuName }}</span>
              <span class="item-price">¥{{ Number(item.unitPrice).toFixed(2) }}</span>
            </div>
            <div v-if="item.checked" class="item-qty-row">
              <div class="qty-group">
                <span class="qty-label">箱</span>
                <van-stepper
                  v-model="item.boxQty"
                  :min="0"
                  :max="item.maxBoxQty"
                  integer
                />
                <span class="qty-max">/ {{ item.maxBoxQty }}</span>
              </div>
              <div class="qty-group">
                <span class="qty-label">瓶</span>
                <van-stepper
                  v-model="item.bottleQty"
                  :min="0"
                  :max="item.maxBottleQty"
                  integer
                />
                <span class="qty-max">/ {{ item.maxBottleQty }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 退货金额 -->
        <div class="card" v-if="returnItems.length > 0">
          <div class="section-title">退货金额</div>
          <div class="amount-row">
            <span>退货总额</span>
            <span class="amount-value">¥{{ returnAmount.toFixed(2) }}</span>
          </div>
          <div class="amount-row">
            <span>已选商品</span>
            <span>{{ checkedCount }} 件</span>
          </div>
        </div>

        <!-- 备注 -->
        <div class="card">
          <div class="section-title">备注</div>
          <van-field
            v-model="returnRemark"
            type="textarea"
            rows="3"
            placeholder="请输入备注信息（选填）"
            maxlength="200"
            show-word-limit
          />
        </div>

        <!-- 提交按钮 -->
        <div class="action-footer">
          <van-button
            type="primary"
            block
            round
            size="large"
            @click="submitReturn"
          >
            提交退货申请
          </van-button>
        </div>
      </div>

      <!-- 销售单搜索弹窗 -->
      <van-popup v-model:show="showBillSearch" position="bottom" round :style="{ maxHeight: '80%' }">
        <div class="popup-panel">
          <h3>选择销售单</h3>
          <van-search
            v-model="billKeyword"
            placeholder="输入单号或客户名搜索"
            show-action
            @search="searchBills"
            @cancel="showBillSearch = false"
          />
          <div v-if="billResults.length === 0" class="empty-wrapper">
            <van-empty description="无搜索结果" />
          </div>
          <van-cell-group v-else inset>
            <van-cell
              v-for="bill in billResults"
              :key="bill.billNo"
              is-link
              @click="selectBill(bill)"
            >
              <template #title>
                <div class="bill-search-header">
                  <span class="bill-search-no">{{ bill.billNo }}</span>
                </div>
              </template>
              <template #label>
                <span>{{ bill.customerName || '散客' }}</span>
                <span class="bill-search-time"> · {{ bill.createdAt }}</span>
              </template>
              <template #value>
                ¥{{ Number(bill.receivableAmount).toFixed(2) }}
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </van-popup>
    </template>

    <!-- ========== 详情弹窗 ========== -->
    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      :style="{ maxHeight: '80%' }"
    >
      <div class="detail-panel">
        <h3>退货详情</h3>
        <div v-if="detailLoading" class="detail-loading">
          <van-loading type="spinner" />
        </div>
        <template v-else-if="detail">
          <van-cell-group inset>
            <van-cell title="退货单号" :value="detail.returnNo" />
            <van-cell title="原销售单" :value="detail.sourceBillNo || '-'" />
            <van-cell title="客户" :value="detail.customerName || '散客'" />
            <van-cell title="退货原因">
              <template #value>
                <van-tag type="warning" plain>
                  {{ detail.items?.[0]?.reason || '-' }}
                </van-tag>
              </template>
            </van-cell>
            <van-cell title="退货金额">
              <template #value>
                <span class="detail-amount">¥{{ Number(detail.refundAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
            <van-cell title="退款金额">
              <template #value>
                <span class="detail-refunded">¥{{ Number(detail.refundedAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
            <van-cell title="退款方式" :value="detail.refundMethod || '-'" />
            <van-cell title="状态">
              <template #value>
                <van-tag
                  :type="(STATUS_MAP[detail.status]?.type as any) || 'default'"
                  plain
                >
                  {{ STATUS_MAP[detail.status]?.text || detail.status }}
                </van-tag>
              </template>
            </van-cell>
            <van-cell title="备注" :value="detail.remark || '-'" />
            <van-cell title="创建时间" :value="detail.createdAt" />
          </van-cell-group>

          <!-- 退货商品明细 -->
          <div class="detail-items">
            <h4>退货商品明细</h4>
            <van-cell-group inset>
              <van-cell
                v-for="item in detail.items"
                :key="item.skuId"
                :title="item.skuName"
                :label="`${item.boxQty}箱${item.bottleQty}瓶 / 共${item.totalBottleQty}瓶`"
              >
                <template #value>
                  ¥{{ Number(item.subtotal).toFixed(2) }}
                </template>
              </van-cell>
            </van-cell-group>
          </div>
        </template>
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

/* ========== 列表 ========== */
.return-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.return-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.return-no {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.return-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
}

.return-amount {
  font-weight: 600;
  color: var(--color-danger);
}

.return-source {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.return-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* ========== 创建表单 ========== */
.create-form {
  padding-bottom: 80px;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.all-check {
  font-size: 13px;
  font-weight: 400;
}

.bill-actions {
  display: flex;
  gap: 10px;
}

.bill-selected {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bill-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bill-no {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
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
  gap: 10px;
}

.item-name {
  flex: 1;
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
  margin-top: 10px;
  margin-left: 30px;
}

.qty-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.qty-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.qty-max {
  font-size: 12px;
  color: var(--text-muted);
}

.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.amount-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-danger);
}

.action-footer {
  padding: 16px;
  background: var(--bg-card);
  position: sticky;
  bottom: 0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

/* ========== 弹窗 ========== */
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

.bill-search-header {
  display: flex;
  align-items: center;
}

.bill-search-no {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.bill-search-time {
  font-size: 12px;
  color: var(--text-muted);
}

/* ========== 详情 ========== */
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
  color: var(--color-danger);
  font-size: 16px;
}

.detail-refunded {
  font-weight: 600;
  color: var(--color-success);
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
</style>