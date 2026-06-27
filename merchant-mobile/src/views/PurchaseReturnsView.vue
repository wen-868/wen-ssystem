<script setup lang="ts">
import { ref } from 'vue'
import {
  showToast,
  showLoadingToast,
  showSuccessToast,
  closeToast
} from 'vant'
import {
  fetchPurchaseReturns,
  fetchPurchaseReturnDetail,
  createPurchaseReturn,
  type PurchaseReturnRecord,
  type PurchaseReturnDetail,
  type CreatePurchaseReturnParams
} from '../api'

const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'PENDING' },
  { label: '已退货', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' }
]

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  PENDING: { text: '待审核', type: 'warning' },
  COMPLETED: { text: '已退货', type: 'success' },
  CANCELLED: { text: '已取消', type: 'danger' }
}

const activeTab = ref('')
const returns = ref<PurchaseReturnRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

// 详情弹窗
const showDetail = ref(false)
const detail = ref<PurchaseReturnDetail | null>(null)
const detailLoading = ref(false)

// 创建退货弹窗
const showCreate = ref(false)
const createForm = ref<CreatePurchaseReturnParams>({
  supplierId: undefined,
  supplierName: '',
  reason: '',
  remark: '',
  items: []
})

async function loadReturns(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchPurchaseReturns({
      page: page.value,
      pageSize,
      returnStatus: activeTab.value || undefined
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

function onTabChange() {
  loadReturns(true)
}

async function viewDetail(id: number) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await fetchPurchaseReturnDetail(id)
    detail.value = res.data
  } catch {
    showToast('操作失败，请重试')
  } finally {
    detailLoading.value = false
  }
}

function openCreate() {
  createForm.value = {
    supplierId: undefined,
    supplierName: '',
    reason: '',
    remark: '',
    items: []
  }
  showCreate.value = true
}

async function handleCreate() {
  if (!createForm.value.supplierId) {
    showToast('请选择供应商')
    return
  }
  if (createForm.value.items.length === 0) {
    showToast('请添加退货商品')
    return
  }

  try {
    showLoadingToast({ message: '提交中...', forbidClick: true })
    await createPurchaseReturn(createForm.value)
    showSuccessToast('退货单创建成功')
    closeToast()
    showCreate.value = false
    await loadReturns(true)
  } catch (err: any) {
    closeToast()
    showToast(err.response?.data?.message || '创建失败')
  }
}

function goBack() {
  window.dispatchEvent(new CustomEvent('nav', { detail: 'home' }))
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">采购退货</h2>
      <div class="header-actions">
        <van-button type="primary" size="small" @click="openCreate">
          新建退货
        </van-button>
        <van-button type="default" size="small" icon="arrow-left" @click="goBack">
          返回
        </van-button>
      </div>
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
        @load="loadReturns"
      >
        <div v-if="returns.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无退货单" />
        </div>
        <van-cell
          v-for="returnOrder in returns"
          :key="returnOrder.id"
          is-link
          class="return-cell"
          @click="viewDetail(returnOrder.id)"
        >
          <template #title>
            <div class="return-header">
              <span class="return-no">{{ returnOrder.returnNo }}</span>
              <van-tag
                :type="(STATUS_MAP[returnOrder.returnStatus]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ STATUS_MAP[returnOrder.returnStatus]?.text || returnOrder.returnStatus }}
              </van-tag>
            </div>
          </template>
          <template #label>
            <div class="return-info">
              <span>{{ returnOrder.supplierName }}</span>
              <span class="return-amount">¥{{ Number(returnOrder.refundAmount).toFixed(2) }}</span>
            </div>
            <div class="return-meta">
              <span class="return-time">{{ returnOrder.createdAt }}</span>
              <span v-if="returnOrder.orderNo" class="return-order">
                采购单: {{ returnOrder.orderNo }}
              </span>
            </div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>

    <!-- 详情弹窗 -->
    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      :style="{ maxHeight: '85%' }"
    >
      <div class="detail-panel">
        <h3>退货单详情</h3>
        <div v-if="detailLoading" class="detail-loading">
          <van-loading type="spinner" />
        </div>
        <template v-else-if="detail">
          <van-cell-group inset>
            <van-cell title="单号" :value="detail.returnNo" />
            <van-cell v-if="detail.orderNo" title="采购单号" :value="detail.orderNo" />
            <van-cell title="供应商" :value="detail.supplierName" />
            <van-cell title="状态">
              <template #value>
                <van-tag
                  :type="(STATUS_MAP[detail.returnStatus]?.type as any) || 'default'"
                  plain
                >
                  {{ STATUS_MAP[detail.returnStatus]?.text || detail.returnStatus }}
                </van-tag>
              </template>
            </van-cell>
            <van-cell title="商品金额">
              <template #value>
                <span>¥{{ Number(detail.goodsAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
            <van-cell title="退款金额">
              <template #value>
                <span class="detail-amount">¥{{ Number(detail.refundAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
            <van-cell title="已退金额" :value="`¥${Number(detail.refundedAmount).toFixed(2)}`" />
            <van-cell v-if="detail.refundMethod" title="退款方式" :value="detail.refundMethod" />
            <van-cell v-if="detail.reason" title="退货原因" :value="detail.reason" />
            <van-cell v-if="detail.remark" title="备注" :value="detail.remark" />
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
                  <div class="item-detail">
                    <div>¥{{ Number(item.unitPrice).toFixed(2) }} × {{ item.totalBottleQty }}</div>
                    <div class="item-subtotal">¥{{ Number(item.subtotalAmount).toFixed(2) }}</div>
                  </div>
                </template>
              </van-cell>
            </van-cell-group>
          </div>
        </template>
      </div>
    </van-popup>

    <!-- 创建退货弹窗 -->
    <van-popup
      v-model:show="showCreate"
      position="bottom"
      round
      :style="{ maxHeight: '90%' }"
    >
      <div class="create-panel">
        <h3>新建采购退货单</h3>
        <van-cell-group inset>
          <van-field
            v-model="createForm.supplierName"
            label="供应商"
            placeholder="请输入供应商名称"
            readonly
            is-link
            @click="showToast('供应商选择功能待实现')"
          />
          <van-field
            v-model="createForm.reason"
            label="退货原因"
            placeholder="请输入退货原因"
          />
          <van-field
            v-model="createForm.remark"
            label="备注"
            type="textarea"
            rows="2"
            placeholder="请输入备注信息"
          />
        </van-cell-group>

        <div class="create-items">
          <h4>退货商品</h4>
          <van-button type="primary" plain size="small" @click="showToast('商品选择功能待实现')">
            添加商品
          </van-button>
          <div v-if="createForm.items.length === 0" class="empty-items">
            暂无商品，请点击添加
          </div>
        </div>

        <div class="create-actions">
          <van-button type="primary" block @click="handleCreate">
            提交退货单
          </van-button>
          <van-button type="default" block plain @click="showCreate = false">
            取消
          </van-button>
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

.header-actions {
  display: flex;
  gap: 8px;
}

.empty-wrapper {
  padding: 40px 0;
}

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

.return-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.return-order {
  color: var(--color-warning);
}

.detail-panel {
  padding: 20px 16px;
  max-height: 85vh;
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

.detail-items {
  margin-top: 12px;
}

.detail-items h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.item-detail {
  text-align: right;
  font-size: 12px;
}

.item-subtotal {
  font-weight: 600;
  color: var(--color-danger);
  margin-top: 2px;
}

.create-panel {
  padding: 20px 16px;
  max-height: 90vh;
  overflow-y: auto;
}

.create-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.create-items {
  margin-top: 16px;
}

.create-items h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.empty-items {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.create-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
