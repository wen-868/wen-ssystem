<script setup lang="ts">
import { ref } from 'vue'
import {
  showToast,
  showLoadingToast,
  showSuccessToast,
  closeToast
} from 'vant'
import {
  fetchSaleReturns,
  fetchSaleReturnDetail,
  type SaleReturnRecord,
  type SaleReturnDetail
} from '../api'

const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'CREATED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' }
]

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  CREATED: { text: '待处理', type: 'warning' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已取消', type: 'default' }
}

const activeTab = ref('')
const returns = ref<SaleReturnRecord[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

// 详情弹窗
const showDetail = ref(false)
const detail = ref<SaleReturnDetail | null>(null)
const detailLoading = ref(false)

async function loadReturns(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchSaleReturns({
      page: page.value,
      pageSize,
      status: activeTab.value || undefined
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

function goCreate() {
  window.dispatchEvent(new CustomEvent('nav', { detail: 'create-sale-return' }))
}

function goBack() {
  window.dispatchEvent(new CustomEvent('nav', { detail: 'home' }))
}
</script>

<template>
  <section class="page">
    <div class="page-header">
      <h2 class="page-title">销售退货</h2>
      <div class="header-actions">
        <van-button type="primary" size="small" icon="plus" @click="goCreate">
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
          v-for="record in returns"
          :key="record.returnNo"
          is-link
          class="return-cell"
          @click="viewDetail(record.returnNo)"
        >
          <template #title>
            <div class="return-header">
              <span class="return-no">{{ record.returnNo }}</span>
              <van-tag
                :type="(STATUS_MAP[record.status]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ STATUS_MAP[record.status]?.text || record.status }}
              </van-tag>
            </div>
          </template>
          <template #label>
            <div class="return-info">
              <span>{{ record.customerName || '散客' }}</span>
              <span class="return-amount">¥{{ Number(record.returnAmount).toFixed(2) }}</span>
            </div>
            <div class="return-meta">
              <van-tag v-if="record.returnType === 'BY_BILL'" type="primary" plain size="mini">按单退货</van-tag>
              <van-tag v-else type="success" plain size="mini">直接退货</van-tag>
              <span v-if="record.sourceBillNo" class="source-bill">原单: {{ record.sourceBillNo }}</span>
              <span class="return-time">{{ record.createdAt }}</span>
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
      :style="{ maxHeight: '80%' }"
    >
      <div class="detail-panel">
        <h3>退货单详情</h3>
        <div v-if="detailLoading" class="detail-loading">
          <van-loading type="spinner" />
        </div>
        <template v-else-if="detail">
          <van-cell-group inset>
            <van-cell title="单号" :value="detail.returnNo" />
            <van-cell title="客户" :value="detail.customerName || '散客'" />
            <van-cell title="退货类型">
              <template #value>
                <van-tag :type="detail.returnType === 'BY_BILL' ? 'primary' : 'success'" plain>
                  {{ detail.returnType === 'BY_BILL' ? '按单退货' : '直接退货' }}
                </van-tag>
              </template>
            </van-cell>
            <van-cell v-if="detail.sourceBillNo" title="原销售单" :value="detail.sourceBillNo" />
            <van-cell title="退货金额">
              <template #value>
                <span class="detail-amount">¥{{ Number(detail.returnAmount).toFixed(2) }}</span>
              </template>
            </van-cell>
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
            <van-cell v-if="detail.reason" title="退货原因" :value="detail.reason" />
            <van-cell v-if="detail.remark" title="备注" :value="detail.remark" />
          </van-cell-group>

          <!-- 商品明细 -->
          <div class="detail-items">
            <h4>退货商品</h4>
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
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.source-bill {
  color: var(--color-primary);
}

.return-time {
  font-size: 12px;
  color: var(--text-muted);
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
</style>
