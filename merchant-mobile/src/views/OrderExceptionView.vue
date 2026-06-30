<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchOrderExceptions, type OrderException } from '../api'

const router = useRouter()

const EXCEPTION_TYPE_MAP: Record<string, string> = {
  OUT_OF_STOCK: '缺货',
  CANCEL: '取消',
  REFUND: '退款',
  TIMEOUT: '超时',
  DELIVERY_FAIL: '配送失败',
  PAY_FAIL: '支付失败'
}

const EXCEPTION_LEVEL_MAP: Record<string, { text: string; color: string }> = {
  WARNING: { text: 'WARNING', color: '#FFD101' },
  ERROR: { text: 'ERROR', color: '#FF6B35' },
  CRITICAL: { text: 'CRITICAL', color: '#E2231A' }
}

const HANDLE_STATUS_MAP: Record<string, { text: string; type: string }> = {
  PENDING: { text: '待处理', type: 'warning' },
  PROCESSING: { text: '处理中', type: 'primary' },
  RESOLVED: { text: '已解决', type: 'success' },
  CLOSED: { text: '已关闭', type: 'default' }
}

const exceptionTypeOptions = [
  { text: '全部', value: '' },
  { text: '缺货', value: 'OUT_OF_STOCK' },
  { text: '取消', value: 'CANCEL' },
  { text: '退款', value: 'REFUND' },
  { text: '超时', value: 'TIMEOUT' },
  { text: '配送失败', value: 'DELIVERY_FAIL' },
  { text: '支付失败', value: 'PAY_FAIL' }
]

const exceptionLevelOptions = [
  { text: '全部', value: '' },
  { text: 'WARNING', value: 'WARNING' },
  { text: 'ERROR', value: 'ERROR' },
  { text: 'CRITICAL', value: 'CRITICAL' }
]

const handleStatusOptions = [
  { text: '全部', value: '' },
  { text: '待处理', value: 'PENDING' },
  { text: '处理中', value: 'PROCESSING' },
  { text: '已解决', value: 'RESOLVED' },
  { text: '已关闭', value: 'CLOSED' }
]

const filterExceptionType = ref('')
const filterExceptionLevel = ref('')
const filterHandleStatus = ref('')

const exceptions = ref<OrderException[]>([])
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)
const page = ref(1)
const pageSize = 20

async function loadExceptions(reset = false) {
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  try {
    const res = await fetchOrderExceptions({
      page: page.value,
      pageSize,
      exceptionType: filterExceptionType.value || undefined,
      exceptionLevel: filterExceptionLevel.value || undefined,
      handleStatus: filterHandleStatus.value || undefined
    })
    const data = res.data
    if (reset) {
      exceptions.value = data.records ?? []
    } else {
      exceptions.value.push(...(data.records ?? []))
    }
    if (exceptions.value.length >= (data.total ?? 0)) {
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
  loadExceptions(true)
}

function onFilterChange() {
  loadExceptions(true)
}

function goDetail(id: number) {
  router.push(`/order-exception/detail/${id}`)
}
</script>

<template>
  <section class="page">
    <h2 class="page-title">异常订单</h2>

    <!-- 筛选 -->
    <van-dropdown-menu>
      <van-dropdown-item
        v-model="filterExceptionType"
        :options="exceptionTypeOptions"
        title="异常类型"
        @change="onFilterChange"
      />
      <van-dropdown-item
        v-model="filterExceptionLevel"
        :options="exceptionLevelOptions"
        title="异常级别"
        @change="onFilterChange"
      />
      <van-dropdown-item
        v-model="filterHandleStatus"
        :options="handleStatusOptions"
        title="处理状态"
        @change="onFilterChange"
      />
    </van-dropdown-menu>

    <!-- 异常列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadExceptions"
      >
        <div v-if="exceptions.length === 0 && !loading" class="empty-wrapper">
          <van-empty description="暂无异常订单" />
        </div>
        <div
          v-for="ex in exceptions"
          :key="ex.id"
          class="exception-card"
          @click="goDetail(ex.id)"
        >
          <div class="card-header">
            <div class="level-badge" :style="{ background: EXCEPTION_LEVEL_MAP[ex.exceptionLevel]?.color || '#999' }">
              <span class="level-text">{{ EXCEPTION_LEVEL_MAP[ex.exceptionLevel]?.text || ex.exceptionLevel }}</span>
            </div>
            <div class="order-no-wrapper">
              <span class="order-no">{{ ex.channelOrderNo }}</span>
              <van-tag plain size="medium" type="default">{{ ex.channel }}</van-tag>
            </div>
          </div>
          <div class="card-body">
            <div class="body-row">
              <van-tag :type="EXCEPTION_TYPE_MAP[ex.exceptionType] ? 'warning' : 'default'" plain size="medium">
                {{ EXCEPTION_TYPE_MAP[ex.exceptionType] || ex.exceptionType }}
              </van-tag>
              <span class="exception-detail">{{ ex.exceptionDetail }}</span>
            </div>
            <div class="body-row">
              <van-tag
                :type="(HANDLE_STATUS_MAP[ex.handleStatus]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ HANDLE_STATUS_MAP[ex.handleStatus]?.text || ex.handleStatus }}
              </van-tag>
              <span class="create-time">{{ ex.createdAt }}</span>
            </div>
          </div>
        </div>
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

.exception-card {
  margin: 8px var(--space-page-padding);
  padding: var(--space-card-padding);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.level-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 4px;
}

.level-text {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
}

.order-no-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.order-no {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.body-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.exception-detail {
  font-size: 13px;
  color: var(--text-secondary);
  flex: 1;
  margin-left: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-time {
  font-size: 12px;
  color: var(--text-muted);
}
</style>