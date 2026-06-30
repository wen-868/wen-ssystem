<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showDialog, showLoadingToast, showSuccessToast, closeToast } from 'vant'
import { fetchOrderAftersaleDetail, type OrderAftersaleDetail } from '../api'

const route = useRoute()
const router = useRouter()

const aftersaleNo = route.params.aftersaleNo as string

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

const detail = ref<OrderAftersaleDetail | null>(null)
const loading = ref(true)

const showLogistics = computed(() => {
  if (!detail.value) return false
  return detail.value.aftersaleType === 'RETURN_REFUND' || detail.value.aftersaleType === 'EXCHANGE'
})

const isPending = computed(() => {
  return detail.value?.aftersaleStatus === 'PENDING'
})

const activeStep = computed(() => {
  if (!detail.value?.progress) return 0
  const steps = detail.value.progress
  const idx = steps.findIndex((s) => s.status === 'CURRENT' || s.status === 'ACTIVE')
  return idx >= 0 ? idx : steps.length - 1
})

onMounted(async () => {
  try {
    const res = await fetchOrderAftersaleDetail(aftersaleNo)
    detail.value = res.data as OrderAftersaleDetail
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
})

async function handleCancel() {
  try {
    await showDialog({
      title: '确认操作',
      message: '确认取消该售后申请？'
    })
    showLoadingToast({ message: '处理中...', forbidClick: true })
    // 取消接口待后端提供
    closeToast()
    showSuccessToast('已取消')
    router.back()
  } catch {
    closeToast()
  }
}
</script>

<template>
  <div class="aftersale-detail-view">
    <van-nav-bar title="售后详情" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="loading-center" />

    <template v-if="detail">
      <!-- 基本信息 -->
      <van-cell-group inset title="基本信息">
        <van-cell title="售后单号" :value="detail.aftersaleNo" />
        <van-cell title="售后类型">
          <template #value>
            <span>{{ AFTERSALE_TYPE_MAP[detail.aftersaleType] || detail.aftersaleType }}</span>
          </template>
        </van-cell>
        <van-cell title="售后状态">
          <template #value>
            <van-tag
              :type="(AFTERSALE_STATUS_MAP[detail.aftersaleStatus]?.type as any) || 'default'"
              plain
            >
              {{ AFTERSALE_STATUS_MAP[detail.aftersaleStatus]?.text || detail.aftersaleStatus }}
            </van-tag>
          </template>
        </van-cell>
        <van-cell title="渠道" :value="detail.channel" />
        <van-cell title="创建时间" :value="detail.createdAt" />
      </van-cell-group>

      <!-- 售后原因 -->
      <van-cell-group inset title="售后原因">
        <van-cell title="原因" :value="detail.reason" />
        <van-cell v-if="detail.detail" title="详细说明" :label="detail.detail" />
        <van-cell v-if="detail.images && detail.images.length > 0" title="图片">
          <template #value>
            <div class="image-list">
              <van-image
                v-for="(img, i) in detail.images"
                :key="i"
                :src="img"
                width="80"
                height="80"
                fit="cover"
                radius="4"
                class="image-item"
              />
            </div>
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 退款信息 -->
      <van-cell-group v-if="detail.refundAmount != null" inset title="退款信息">
        <van-cell title="退款金额">
          <template #value>
            <span class="amount">¥{{ Number(detail.refundAmount).toFixed(2) }}</span>
          </template>
        </van-cell>
        <van-cell v-if="detail.refundMethod" title="退款方式" :value="detail.refundMethod" />
        <van-cell v-if="detail.refundTime" title="退款时间" :value="detail.refundTime" />
      </van-cell-group>

      <!-- 商品信息 -->
      <van-cell-group v-if="detail.items && detail.items.length > 0" inset title="商品信息">
        <van-cell
          v-for="(item, i) in detail.items"
          :key="i"
          :title="item.channelSkuName"
          :label="`¥${Number(item.price).toFixed(2)} x ${item.quantity}`"
        >
          <template #value>
            <span class="amount">¥{{ Number(item.subtotal).toFixed(2) }}</span>
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 物流信息（仅退货退款/换货显示） -->
      <van-cell-group v-if="showLogistics" inset title="物流信息">
        <van-cell v-if="detail.returnTrackingNo" title="退货运单号" :value="detail.returnTrackingNo" />
        <van-cell v-if="detail.returnLogistics" title="物流公司" :value="detail.returnLogistics" />
        <van-cell v-if="detail.returnLogisticsStatus" title="物流状态" :value="detail.returnLogisticsStatus" />
      </van-cell-group>

      <!-- 处理进度 -->
      <van-cell-group v-if="detail.progress && detail.progress.length > 0" inset title="处理进度">
        <div class="steps-wrapper">
          <van-steps :active="activeStep" direction="vertical">
            <van-step v-for="(step, i) in detail.progress" :key="i">
              <template #active-icon>
                <van-icon name="checked" />
              </template>
              <template #inactive-icon>
                <van-icon name="circle" />
              </template>
              <p class="step-label">{{ step.label }}</p>
              <p class="step-time">{{ step.time }}</p>
            </van-step>
          </van-steps>
        </div>
      </van-cell-group>
    </template>

    <!-- 底部操作按钮 -->
    <van-action-bar v-if="isPending">
      <van-action-bar-button type="danger" text="取消申请" @click="handleCancel" />
    </van-action-bar>

    <!-- 底部占位 -->
    <div v-if="isPending" class="bottom-placeholder" />
  </div>
</template>

<style scoped>
.aftersale-detail-view {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 16px;
}

.loading-center {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.amount {
  font-weight: 600;
  color: var(--color-primary);
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.image-item {
  border: 1px solid var(--border-color);
}

.steps-wrapper {
  padding: 12px 16px;
}

.step-label {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
}

.step-time {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.bottom-placeholder {
  height: 50px;
}
</style>