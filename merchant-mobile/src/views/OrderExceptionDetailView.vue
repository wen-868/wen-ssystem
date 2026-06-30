<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  showDialog,
  showLoadingToast,
  showSuccessToast,
  closeToast,
  showToast
} from 'vant'
import {
  fetchOrderExceptionDetail,
  appealOrderException,
  type OrderExceptionDetail
} from '../api'

const route = useRoute()
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

const ORDER_STATUS_MAP: Record<string, { text: string; type: string }> = {
  WAIT_DELIVERY: { text: '待配送', type: 'warning' },
  DELIVERING: { text: '配送中', type: 'primary' },
  COMPLETED: { text: '已完成', type: 'success' },
  REJECTED: { text: '已拒收', type: 'danger' },
  CANCELLED: { text: '已取消', type: 'default' },
  PENDING_PAYMENT: { text: '待支付', type: 'warning' }
}

const detail = ref<OrderExceptionDetail | null>(null)
const loading = ref(true)

const id = computed(() => Number(route.params.id))

const showAppeal = ref(false)
const appealReason = ref('')
const appealDetail = ref('')
const appealImages = ref<{ url: string }[]>([])
const appealSubmitting = ref(false)

const canAppeal = computed(() => {
  if (!detail.value) return false
  return detail.value.handleStatus === 'PENDING' || detail.value.handleStatus === 'PROCESSING'
})

onMounted(() => {
  loadDetail()
})

async function loadDetail() {
  loading.value = true
  try {
    const res = await fetchOrderExceptionDetail(id.value)
    detail.value = res.data
  } catch {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.back()
}

function openAppeal() {
  appealReason.value = ''
  appealDetail.value = ''
  appealImages.value = []
  showAppeal.value = true
}

function onUploadImage(file: File) {
  // 上传图片到服务器，这里返回 URL
  const url = URL.createObjectURL(file)
  appealImages.value.push({ url })
  return true
}

function onRemoveImage(index: number) {
  appealImages.value.splice(index, 1)
}

async function submitAppeal() {
  if (!appealReason.value.trim()) {
    showToast('请输入申诉原因')
    return
  }
  if (!appealDetail.value.trim()) {
    showToast('请输入申诉说明')
    return
  }
  try {
    await showDialog({
      title: '确认提交',
      message: '确认提交申诉？'
    })
  } catch {
    return
  }
  appealSubmitting.value = true
  try {
    showLoadingToast({ message: '提交中...', forbidClick: true })
    await appealOrderException(id.value, {
      reason: appealReason.value,
      detail: appealDetail.value,
      images: appealImages.value.map((img) => img.url)
    })
    closeToast()
    showSuccessToast('申诉已提交')
    showAppeal.value = false
    await loadDetail()
  } catch {
    closeToast()
  } finally {
    appealSubmitting.value = false
  }
}
</script>

<template>
  <section class="page">
    <!-- 顶部导航栏 -->
    <van-nav-bar title="异常详情" left-text="返回" left-arrow @click-left="goBack" />

    <div v-if="loading" class="loading-wrapper">
      <van-loading type="spinner" />
    </div>

    <template v-else-if="detail">
      <!-- 异常基本信息 -->
      <van-cell-group inset title="异常信息">
        <van-cell title="异常类型">
          <template #value>
            <van-tag type="warning" plain size="medium">
              {{ EXCEPTION_TYPE_MAP[detail.exceptionType] || detail.exceptionType }}
            </van-tag>
          </template>
        </van-cell>
        <van-cell title="异常级别">
          <template #value>
            <span
              class="level-dot"
              :style="{ background: EXCEPTION_LEVEL_MAP[detail.exceptionLevel]?.color || '#999' }"
            />
            {{ EXCEPTION_LEVEL_MAP[detail.exceptionLevel]?.text || detail.exceptionLevel }}
          </template>
        </van-cell>
        <van-cell title="渠道" :value="detail.channel" />
        <van-cell title="订单号" :value="detail.channelOrderNo" />
        <van-cell title="创建时间" :value="detail.createdAt" />
        <van-cell title="处理状态">
          <template #value>
            <van-tag
              :type="(HANDLE_STATUS_MAP[detail.handleStatus]?.type as any) || 'default'"
              plain
              size="medium"
            >
              {{ HANDLE_STATUS_MAP[detail.handleStatus]?.text || detail.handleStatus }}
            </van-tag>
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 异常详情 -->
      <van-cell-group inset title="异常详情">
        <van-cell :value="detail.exceptionDetail" />
      </van-cell-group>

      <!-- 关联订单信息 -->
      <template v-if="detail.orderInfo">
        <van-cell-group inset title="订单信息">
          <van-cell title="订单号" :value="detail.orderInfo.channelOrderNo" />
          <van-cell title="渠道" :value="detail.orderInfo.channel" />
          <van-cell title="客户" :value="detail.orderInfo.customerName" />
          <van-cell title="金额">
            <template #value>
              <span class="amount-text">¥{{ Number(detail.orderInfo.totalAmount).toFixed(2) }}</span>
            </template>
          </van-cell>
          <van-cell title="订单状态">
            <template #value>
              <van-tag
                :type="(ORDER_STATUS_MAP[detail.orderInfo.orderStatus]?.type as any) || 'default'"
                plain
                size="medium"
              >
                {{ ORDER_STATUS_MAP[detail.orderInfo.orderStatus]?.text || detail.orderInfo.orderStatus }}
              </van-tag>
            </template>
          </van-cell>
          <van-cell title="收货人" :value="detail.orderInfo.receiverName" />
          <van-cell title="收货电话" :value="detail.orderInfo.receiverPhone" />
          <van-cell title="收货地址" :value="detail.orderInfo.receiverAddress || '-'" />
        </van-cell-group>

        <!-- 商品明细 -->
        <div class="section-title">商品明细</div>
        <van-cell-group inset>
          <van-cell
            v-for="(item, idx) in detail.orderInfo.items"
            :key="idx"
            :title="item.channelSkuName"
            :label="`x${item.quantity}`"
          >
            <template #value>
              ¥{{ Number(item.subtotal).toFixed(2) }}
            </template>
          </van-cell>
        </van-cell-group>

        <!-- 金额明细 -->
        <van-cell-group inset title="金额明细">
          <van-cell title="商品金额">
            <template #value>
              ¥{{ Number(detail.orderInfo.totalAmount).toFixed(2) }}
            </template>
          </van-cell>
          <van-cell title="优惠金额">
            <template #value>
              -¥{{ Number(detail.orderInfo.discountAmount).toFixed(2) }}
            </template>
          </van-cell>
          <van-cell title="配送费">
            <template #value>
              ¥{{ Number(detail.orderInfo.deliveryFee).toFixed(2) }}
            </template>
          </van-cell>
          <van-cell title="实付金额">
            <template #value>
              <span class="amount-text">¥{{ Number(detail.orderInfo.payAmount).toFixed(2) }}</span>
            </template>
          </van-cell>
        </van-cell-group>
      </template>

      <!-- 处理记录 -->
      <template v-if="detail.handleRecords && detail.handleRecords.length > 0">
        <div class="section-title">处理记录</div>
        <div class="steps-wrapper">
          <van-steps direction="vertical" :active="detail.handleRecords.length">
            <van-step v-for="(record, idx) in detail.handleRecords" :key="idx">
              <template #active-icon>
                <van-icon name="checked" />
              </template>
              <template #inactive-icon>
                <van-icon name="checked" />
              </template>
              <div class="step-content">
                <div class="step-action">{{ record.action }}</div>
                <div class="step-operator">{{ record.operator }}</div>
                <div v-if="record.remark" class="step-remark">{{ record.remark }}</div>
                <div class="step-time">{{ record.createdAt }}</div>
              </div>
            </van-step>
          </van-steps>
        </div>
      </template>
    </template>

    <!-- 底部申诉按钮 -->
    <van-action-bar v-if="detail && canAppeal">
      <van-action-bar-button type="danger" text="提交申诉" @click="openAppeal" />
    </van-action-bar>

    <!-- 申诉表单弹窗 -->
    <van-popup
      v-model:show="showAppeal"
      position="bottom"
      round
      :style="{ maxHeight: '80%' }"
    >
      <div class="appeal-panel">
        <h3 class="appeal-title">提交申诉</h3>
        <van-cell-group inset>
          <van-field
            v-model="appealReason"
            label="申诉原因"
            placeholder="请输入申诉原因"
            :rules="[{ required: true, message: '请输入申诉原因' }]"
          />
          <van-field
            v-model="appealDetail"
            label="申诉说明"
            type="textarea"
            rows="3"
            placeholder="请详细描述申诉内容"
            :rules="[{ required: true, message: '请输入申诉说明' }]"
          />
          <div class="uploader-wrapper">
            <span class="uploader-label">图片上传</span>
            <span class="uploader-hint">（最多5张）</span>
          </div>
          <van-uploader
            v-model="appealImages"
            :max-count="5"
            :after-read="onUploadImage as any"
            :before-delete="() => true"
            @delete="onRemoveImage"
          />
        </van-cell-group>
        <div class="appeal-actions">
          <van-button
            type="danger"
            block
            :loading="appealSubmitting"
            loading-text="提交中..."
            @click="submitAppeal"
          >
            提交申诉
          </van-button>
          <van-button block plain @click="showAppeal = false">
            取消
          </van-button>
        </div>
      </div>
    </van-popup>
  </section>
</template>

<style scoped>
.loading-wrapper {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.section-title {
  margin: 16px var(--space-page-padding) 8px;
  font-size: var(--text-section-title);
  font-weight: 600;
  color: var(--text-secondary);
}

.level-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.amount-text {
  font-weight: 600;
  color: var(--color-primary);
}

.steps-wrapper {
  padding: 12px var(--space-page-padding);
}

.step-content {
  padding-bottom: 8px;
}

.step-action {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.step-operator {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.step-remark {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.step-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* 申诉弹窗 */
.appeal-panel {
  padding: 20px var(--space-card-padding);
  max-height: 80vh;
  overflow-y: auto;
}

.appeal-title {
  margin: 0 0 16px;
  font-size: 16px;
  text-align: center;
  color: var(--text-primary);
}

.uploader-wrapper {
  padding: 10px 16px 6px;
  display: flex;
  align-items: center;
}

.uploader-label {
  font-size: 14px;
  color: var(--text-primary);
}

.uploader-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: 4px;
}

.appeal-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>