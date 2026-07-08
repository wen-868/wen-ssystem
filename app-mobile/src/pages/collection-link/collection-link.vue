<template>
  <view class="collection-link-page">
    <!-- 顶部栏 -->
    <view class="page-header">
      <text class="header-title">收款链接</text>
    </view>

    <!-- 表单三件套：ref + :model + :rules -->
    <form ref="formRef" :model="linkForm" :rules="linkRules" class="link-form" @submit="handleCreate">
      <view class="form-section">
        <view class="section-title">创建收款链接</view>

        <view class="form-item">
          <view class="form-label">关联订单</view>
          <input
            class="form-input"
            v-model="linkForm.billNo"
            type="text"
            placeholder="输入销售单号"
            placeholder-class="input-placeholder"
            @input="clearError('billNo')"
          />
          <view class="field-error" v-if="errors.billNo">
            <text class="error-text">{{ errors.billNo }}</text>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">收款金额 (元)</view>
          <input
            class="form-input"
            v-model="linkForm.amount"
            type="digit"
            placeholder="请输入收款金额"
            placeholder-class="input-placeholder"
            @input="clearError('amount')"
          />
          <view class="field-error" v-if="errors.amount">
            <text class="error-text">{{ errors.amount }}</text>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">备注</view>
          <textarea
            class="form-textarea"
            v-model="linkForm.remark"
            placeholder="备注信息（选填）"
            placeholder-class="input-placeholder"
          />
        </view>

        <button
          class="submit-btn"
          form-type="submit"
          :disabled="creating"
        >
          {{ creating ? '生成中...' : '生成收款链接' }}
        </button>
      </view>
    </form>

    <!-- 已生成的链接列表 -->
    <view class="link-list-section" v-if="linkList.length > 0">
      <view class="section-title">收款链接记录</view>
      <view class="link-card" v-for="link in linkList" :key="link.linkNo">
        <view class="link-header">
          <text class="link-no">链接：{{ link.linkNo }}</text>
          <view class="link-status" :class="link.status">
            <text class="status-text">{{ link.statusLabel }}</text>
          </view>
        </view>
        <view class="link-body">
          <text class="link-amount">金额：¥{{ link.amount }}</text>
          <text class="link-bill">关联订单：{{ link.billNo }}</text>
        </view>
        <view class="link-actions" v-if="link.status === 'active'">
          <button class="action-btn share-btn" @tap="shareLink(link)">分享</button>
          <button class="action-btn revoke-btn" @tap="revokeLink(link)">撤销</button>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

const formRef = ref<any>(null)
const linkForm = reactive({
  billNo: '',
  amount: '',
  remark: '',
})

const linkRules: Rules = {
  billNo: [
    { required: true, message: '请输入销售单号' },
  ],
  amount: [
    { required: true, message: '请输入收款金额' },
    { pattern: /^\d+(\.\d{1,2})?$/, message: '请输入有效金额' },
  ],
}

const { errors, validate, clearError } = useFormValidation(linkForm, linkRules)

const creating = ref(false)
const linkList = ref<any[]>([])

async function handleCreate() {
  if (!validate()) return
  creating.value = true
  try {
    // TODO: 调用后端 API 创建收款链接
    uni.showToast({ title: '收款链接已生成', icon: 'success' })
    linkForm.billNo = ''
    linkForm.amount = ''
    linkForm.remark = ''
  } catch (err: any) {
    uni.showToast({ title: err?.message || '生成失败', icon: 'none' })
  } finally {
    creating.value = false
  }
}

function shareLink(link: any) {
  // TODO: 分享收款链接
  uni.showToast({ title: '敬请期待，即将上线', icon: 'none' })
}

function revokeLink(link: any) {
  uni.showModal({
    title: '撤销确认',
    content: '确定要撤销此收款链接吗？',
    success: (res) => {
      if (res.confirm) {
        // TODO: 调用后端 API 撤销
        uni.showToast({ title: '已撤销', icon: 'success' })
      }
    }
  })
}

onMounted(() => {
  // TODO: 加载收款链接列表
})
</script>

<style scoped>
.collection-link-page {
  min-height: 100vh;
  background: #f0f5ff;
}

.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #333;
}

.link-form {
  padding: 16rpx 24rpx;
}

.form-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
}

.form-item {
  margin-bottom: 20rpx;
}

.form-label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 8rpx;
}

.form-input {
  width: 100%;
  height: 80rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.form-textarea {
  width: 100%;
  height: 160rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.input-placeholder {
  color: #bbb;
  font-size: 26rpx;
}

.field-error {
  margin-top: 8rpx;
  padding: 6rpx 0;
}

.error-text {
  font-size: 24rpx;
  color: #ff4d4f;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  margin-top: 20rpx;
}

.submit-btn::after {
  border: none;
}

.link-list-section {
  padding: 0 24rpx;
}

.link-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.link-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.link-no {
  font-size: 26rpx;
  color: #333;
  font-weight: 600;
}

.link-status {
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.link-status.active {
  background: #e6f7ff;
  color: #1677FF;
}

.link-status.paid {
  background: #f6ffed;
  color: #52c41a;
}

.link-status.revoked {
  background: #fff2f0;
  color: #ff4d4f;
}

.status-text {
  font-size: 22rpx;
}

.link-body {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 16rpx;
}

.link-amount {
  font-size: 28rpx;
  color: #1677FF;
  font-weight: 600;
}

.link-bill {
  font-size: 24rpx;
  color: #999;
}

.link-actions {
  display: flex;
  gap: 16rpx;
}

.action-btn {
  flex: 1;
  height: 64rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}

.share-btn {
  background: #1677FF;
  color: #fff;
}

.revoke-btn {
  background: #f5f5f5;
  color: #ff4d4f;
}

.action-btn::after {
  border: none;
}

.safe-bottom {
  height: 40rpx;
}
</style>