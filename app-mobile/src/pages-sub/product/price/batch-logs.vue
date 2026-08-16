<template>
  <view class="batch-logs-page">
    <view class="page-header">
      <text class="header-title">调价记录</text>
    </view>

    <!-- 记录列表（R94-01：接入真实 listBatchLogs 接口） -->
    <view class="log-list" v-if="logList.length > 0">
      <view class="log-card" v-for="item in logList" :key="item.batchNo">
        <view class="log-header">
          <text class="log-no">批次：{{ item.batchNo }}</text>
          <text class="log-time">{{ formatTime(item.createdAt) }}</text>
        </view>
        <view class="log-body">
          <view class="log-info-row">
            <text class="info-label">价格类型</text>
            <text class="info-value">{{ item.priceType || '-' }}</text>
          </view>
          <view class="log-info-row">
            <text class="info-label">调价商品</text>
            <text class="info-value">{{ item.skuCount }} 个</text>
          </view>
          <view class="log-info-row" v-if="item.totalIncrease > 0">
            <text class="info-label">上调金额</text>
            <text class="info-value info-value--up">+{{ Number(item.totalIncrease).toFixed(2) }}</text>
          </view>
          <view class="log-info-row" v-if="item.totalDecrease > 0">
            <text class="info-label">下调金额</text>
            <text class="info-value info-value--down">-{{ Number(item.totalDecrease).toFixed(2) }}</text>
          </view>
          <view class="log-info-row" v-if="item.reason">
            <text class="info-label">备注</text>
            <text class="info-value info-value--reason">{{ item.reason }}</text>
          </view>
        </view>
      </view>

      <view class="load-more" @tap="loadMore">
        <text class="load-more-text">{{ loading ? '加载中...' : (hasMore ? '加载更多' : '没有更多了') }}</text>
      </view>
    </view>

    <view class="empty-state" v-else-if="!loading">
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无调价记录</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { priceApi } from '@/api/modules/price'

interface BatchLogItem {
  batchNo: string
  priceType: string
  skuCount: number
  totalIncrease: number
  totalDecrease: number
  createdAt: string
  reason: string | null
}

const loading = ref(false)
const logList = ref<BatchLogItem[]>([])
const page = ref(1)
const pageSize = 10
const total = ref(0)
const hasMore = ref(true)

function formatTime(value: string | Date | undefined): string {
  if (!value) return ''
  const d = new Date(String(value))
  if (isNaN(d.getTime())) return String(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function loadLogs(reset = false) {
  if (loading.value) return
  if (reset) {
    page.value = 1
    hasMore.value = true
  }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res: any = await priceApi.listBatchLogs({ page: page.value, pageSize })
    const list: BatchLogItem[] = res?.list ?? res?.records ?? []
    const newTotal = Number(res?.total ?? 0)
    if (reset) {
      logList.value = list
    } else {
      logList.value = logList.value.concat(list)
    }
    total.value = newTotal
    hasMore.value = logList.value.length < newTotal
    if (list.length > 0) page.value += 1
  } catch (err) {
    console.error('加载调价记录失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function loadMore() {
  loadLogs()
}

onMounted(() => {
  loadLogs(true)
})
</script>

<style lang="scss" scoped>
.batch-logs-page { min-height: 100vh; background: $uni-bg-color-grey; padding-bottom: 40rpx; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.log-list { padding: 16rpx 24rpx 0; }
.log-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.log-no { font-size: 26rpx; color: $uni-gray-700; font-weight: 600; }
.log-time { font-size: 24rpx; color: $uni-gray-400; }
.log-info-row {
  display: flex;
  align-items: center;
  margin-top: 8rpx;
  font-size: 26rpx;
}
.info-label { color: $uni-gray-400; width: 140rpx; flex-shrink: 0; }
.info-value { color: $uni-gray-700; flex: 1; }
.info-value--up { color: $uni-color-error; }
.info-value--down { color: $uni-color-success; }
.info-value--reason { color: $uni-gray-500; }
.load-more { padding: 20rpx 0 10rpx; text-align: center; }
.load-more-text { font-size: 24rpx; color: $uni-gray-400; }
.empty-state {
  padding: 120rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.empty-icon { font-size: 72rpx; color: $uni-gray-300; }
.empty-text { font-size: 26rpx; color: $uni-gray-400; }
.safe-bottom { height: calc(40rpx + env(safe-area-inset-bottom)); }
</style>
