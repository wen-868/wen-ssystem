<script setup lang="ts">
import { ref } from 'vue'
import {
  showToast,
  showLoadingToast,
  showSuccessToast,
  closeToast
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
    const data = res.data
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
    showToast('操作失败，请重试')
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
    detail.value = res.data
  } catch {
    showToast('操作失败，请重试')
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
    const linkData = res.data
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
  window.dispatchEvent(new CustomEvent('nav', { detail: 'create-sale' }))
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
