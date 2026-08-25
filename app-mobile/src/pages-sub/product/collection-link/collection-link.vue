<template>
  <view class="collection-link-page">
    <!-- 顶部栏 -->
    <page-header title="收款链接" @back="goBack" />

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
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { storeApi } from '@/api/modules/store'

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
    const res = await storeApi.createCollectionLink(linkForm.billNo, {
      amount: Number(linkForm.amount),
      remark: linkForm.remark,
    })
    uni.showToast({ title: '收款链接已生成', icon: 'success' })
    linkForm.billNo = ''
    linkForm.amount = ''
    linkForm.remark = ''
    loadLinkList()
  } catch (err: any) {
    uni.showToast({ title: err?.message || '生成失败', icon: 'none' })
  } finally {
    creating.value = false
  }
}

function shareLink(link: any) {
  if (link.shareUrl) {
    uni.setClipboardData({
      data: link.shareUrl,
      success: () => {
        uni.showToast({ title: '链接已复制', icon: 'success' })
      }
    })
  } else {
    uni.showToast({ title: '链接不可用', icon: 'none' })
  }
}

async function revokeLink(link: any) {
  uni.showModal({
    title: '撤销确认',
    content: '确定要撤销此收款链接吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await storeApi.revokeCollectionLink(link.linkNo)
          uni.showToast({ title: '已撤销', icon: 'success' })
          loadLinkList()
        } catch (err: any) {
          uni.showToast({ title: err?.message || '撤销失败', icon: 'none' })
        }
      }
    }
  })
}

async function loadLinkList() {
  try {
    const res = await storeApi.fetchCollectionLinks({ page: 1, pageSize: 20 })
    linkList.value = res?.list || res?.records || []
  } catch (err) {
    console.error('加载收款链接列表失败:', err)
    linkList.value = []
  }
}

onMounted(() => {
  loadLinkList()
})
</script>

<style lang="scss" scoped>
.collection-link-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}

.header-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-gray-700;
}

.link-form {
  padding: $uni-spacing-sm $uni-spacing-base;
}

.form-section {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-sm;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: $uni-spacing-md;
}

.form-item {
  margin-bottom: $uni-spacing-md;
}

.form-label {
  font-size: 26rpx;
  color: $uni-gray-500;
  margin-bottom: $uni-spacing-xs;
}

.form-input {
  width: 100%;
  height: 80rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-base;
  font-size: 28rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}

.form-textarea {
  width: 100%;
  height: 160rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-md $uni-spacing-base;
  font-size: 28rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}

.input-placeholder {
  color: $uni-gray-300;
  font-size: 26rpx;
}

.field-error {
  margin-top: $uni-spacing-xs;
  padding: 6rpx 0;
}

.error-text {
  font-size: 24rpx;
  color: $uni-color-error;
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
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
  padding: 0 $uni-spacing-lg;
}

.link-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-md;
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
  color: $uni-gray-700;
  font-weight: 600;
}

.link-status {
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.link-status.active {
  background: $uni-color-primary-soft;
  color: $uni-color-primary;
}

.link-status.paid {
  background: $uni-color-success-soft;
  color: $uni-color-success;
}

.link-status.revoked {
  background: $uni-color-error-soft;
  color: $uni-color-error;
}

.status-text {
  font-size: 22rpx;
}

.link-body {
  display: flex;
  flex-direction: column;
  gap: $uni-spacing-xs;
  margin-bottom: $uni-spacing-sm;
}

.link-amount {
  font-size: 28rpx;
  color: $uni-color-primary;
  font-weight: 600;
}

.link-bill {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.link-actions {
  display: flex;
  gap: $uni-spacing-sm;
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
  background: $uni-color-primary;
  color: $uni-text-color-inverse;
}

.revoke-btn {
  background: $uni-bg-color-grey;
  color: $uni-color-error;
}

.action-btn::after {
  border: none;
}

.safe-bottom {
  height: 40rpx;
}
</style>
