<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchOrderAftersales, type OrderAftersale } from '../api'

const router = useRouter()

const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已拒绝', value: 'REJECTED' },
  { label: '已完成', value: 'COMPLETED' }
]

const AFTERSALE_TYPE_MAP: Record<string, string> = {
  REFUND_ONLY: '仅退款',
  RETURN_REFUND: '退货退款',
  EXCHANGE: '换货',
  REPAIR: '维修'
}

const AFTERSALE_STATUS_MAP: Record<string, { text: string; type: string }> = {
  PENDING: { text: '待审核', type: 'warning' },
  APPROVED: { text: '已通过', type: 'success' },
  REJECTED: { text: '已拒绝', type: 'danger' },
  COMPLETED: { text: '已完成', type: 'primary' }
}

const activeTab = ref('')
const list = ref<OrderAftersale[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

async function loadList(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchOrderAftersales({
      page: page.value,
      pageSize,
      status: activeTab.value || undefined
    })
    const data = res.data as any
    if (reset) {
      list.value = data.records ?? []
    } else {
      list.value.push(...(data.records ?? []))
    }
    if (list.value.length >= (data.total ?? 0)) {
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
  loadList(true)
}

function onTabChange() {
  loadList(true)
}

function goDetail(aftersaleNo: string) {
  router.push(`/order-aftersale/detail/${aftersaleNo}`)
}
</script>

<template>
  <section class="page">
    <h2 class="page-title">售后管理</h2>

    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab
        v-for="tab in STATUS_TABS"
        :key="tab.value"
        :title="tab.label"
        :name="tab.value"
      />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadList"
      >
        <div v-if="list.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无售后记录" />
        </div>
        <van-cell
          v-for="item in list"
          :key="item.aftersaleNo"
          is-link
          class="aftersale-cell"
          @click="goDetail(item.aftersaleNo)"
        >
          <template #title>
            <div class="cell-header">
              <span class="cell-no">{{ item.aftersaleNo }}</span>
              <van-tag type="primary" plain size="medium">{{ item.channel }}</van-tag>
            </div>
          </template>
          <template #label>
            <div class="cell-meta">
              <span class="cell-order-no">关联订单：{{ item.channelOrderId }}</span>
            </div>
            <div class="cell-info">
              <van-tag
                :type="(AFTERSALE_STATUS_MAP[item.aftersaleStatus]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ AFTERSALE_STATUS_MAP[item.aftersaleStatus]?.text || item.aftersaleStatus }}
              </van-tag>
              <span class="cell-type">{{ AFTERSALE_TYPE_MAP[item.aftersaleType] || item.aftersaleType }}</span>
              <span class="cell-reason">{{ item.reason }}</span>
            </div>
            <div class="cell-bottom">
              <span class="cell-amount">¥{{ Number(item.refundAmount).toFixed(2) }}</span>
              <span class="cell-time">{{ item.createdAt }}</span>
            </div>
          </template>
        </van-cell>
      </van-list>
    </van-pull-refresh>
  </section>
</template>

<style scoped>
.page-title {
  margin: 0 0 12px;
  font-size: var(--text-page-title);
  font-weight: 600;
  color: var(--text-primary);
}

.empty-wrapper {
  padding: 40px 0;
}

.aftersale-cell {
  margin-bottom: 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.cell-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.cell-no {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.cell-meta {
  margin-bottom: 4px;
}

.cell-order-no {
  font-size: 12px;
  color: var(--text-muted);
}

.cell-info {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.cell-type {
  font-size: 13px;
  color: var(--text-secondary);
}

.cell-reason {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.cell-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cell-amount {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-primary);
}

.cell-time {
  font-size: 12px;
  color: var(--text-muted);
}
</style>