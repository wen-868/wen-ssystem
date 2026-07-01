<template>
  <el-dialog
    :model-value="modelValue"
    title="支付配置提醒"
    width="480px"
    :close-on-click-modal="false"
    @update:model-value="handleUpdate"
  >
    <div class="payment-check-content">
      <el-icon class="warning-icon" :size="48" color="#e6a23c">
        <WarningFilled />
      </el-icon>
      <h3 class="payment-check-title">{{ providerName }} 尚未配置</h3>
      <p class="payment-check-desc">
        支付功能需要先完成支付渠道配置，请前往系统设置页面完成配置。
      </p>
    </div>

    <template #footer>
      <div class="payment-check-footer">
        <el-button @click="handleUpdate(false)">取消</el-button>
        <el-button type="primary" @click="handleGoConfig">去配置</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { WarningFilled } from '@element-plus/icons-vue'

const router = useRouter()

const providerNameMap: Record<string, string> = {
  wechat_pay: '微信支付',
  alipay: '支付宝',
}

const props = withDefaults(
  defineProps<{
    provider?: string
    modelValue: boolean
  }>(),
  {
    provider: 'wechat_pay',
    modelValue: false,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const providerName = computed(() => {
  return providerNameMap[props.provider] || props.provider
})

function handleUpdate(value: boolean) {
  emit('update:modelValue', value)
}

function handleGoConfig() {
  handleUpdate(false)
  router.push({ path: '/system/payment', query: { tab: props.provider } })
}
</script>

<style scoped>
.payment-check-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
}

.warning-icon {
  margin-bottom: 16px;
}

.payment-check-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.payment-check-desc {
  margin: 0;
  font-size: 14px;
  color: #909399;
  line-height: 1.6;
  text-align: center;
}

.payment-check-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>