<template>
  <view class="create-coupon-page">
    <view class="page-header">
      <text class="header-title">新建优惠券</text>
    </view>

    <form ref="formRef" :model="form" class="coupon-form">
      <view class="form-section">
        <view class="section-title">基本信息</view>

        <view class="form-item">
          <text class="form-label">优惠券名称</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.name"
              type="text"
              placeholder="请输入优惠券名称"
              placeholder-class="input-placeholder"
              @input="clearError('name')"
            />
          </view>
          <view class="field-error" v-if="errors.name">
            <text class="error-text">{{ errors.name }}</text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">优惠券类型</text>
          <view class="type-options">
            <view
              v-for="item in couponTypes"
              :key="item.value"
              class="type-option"
              :class="{ 'type-option--active': form.type === item.value }"
              @tap="form.type = item.value"
            >
              <text class="option-icon">{{ item.icon }}</text>
              <text class="option-label">{{ item.label }}</text>
            </view>
          </view>
        </view>

        <view class="form-row">
          <view class="form-item form-item--half">
            <text class="form-label">面额 (元)</text>
            <view class="form-control">
              <input
                class="form-input"
                v-model="form.amount"
                type="digit"
                placeholder="0.00"
                placeholder-class="input-placeholder"
                @input="clearError('amount')"
              />
            </view>
            <view class="field-error" v-if="errors.amount">
              <text class="error-text">{{ errors.amount }}</text>
            </view>
          </view>
          <view class="form-item form-item--half">
            <text class="form-label">满减门槛 (元)</text>
            <view class="form-control">
              <input
                class="form-input"
                v-model="form.minAmount"
                type="digit"
                placeholder="0.00"
                placeholder-class="input-placeholder"
                @input="clearError('minAmount')"
              />
            </view>
            <view class="field-error" v-if="errors.minAmount">
              <text class="error-text">{{ errors.minAmount }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="form-section">
        <view class="section-title">发放设置</view>

        <view class="form-row">
          <view class="form-item form-item--half">
            <text class="form-label">发放总量</text>
            <view class="form-control">
              <input
                class="form-input"
                v-model="form.totalCount"
                type="number"
                placeholder="不限"
                placeholder-class="input-placeholder"
              />
            </view>
          </view>
          <view class="form-item form-item--half">
            <text class="form-label">每人限领</text>
            <view class="form-control">
              <input
                class="form-input"
                v-model="form.perPersonLimit"
                type="number"
                placeholder="1"
                placeholder-class="input-placeholder"
              />
            </view>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">有效时间</text>
          <view class="time-row">
            <view class="time-item" @tap="chooseStartDate">
              <text class="time-value">{{ form.startDate || '选择开始时间' }}</text>
            </view>
            <text class="time-separator">~</text>
            <view class="time-item" @tap="chooseEndDate">
              <text class="time-value">{{ form.endDate || '选择结束时间' }}</text>
            </view>
          </view>
          <view class="field-error" v-if="errors.startDate || errors.endDate">
            <text class="error-text">{{ errors.startDate || errors.endDate }}</text>
          </view>
        </view>
      </view>

      <view class="form-section">
        <view class="section-title">使用范围</view>

        <view class="form-item">
          <text class="form-label">适用商品</text>
          <view class="scope-row">
            <view
              class="scope-option"
              :class="{ 'scope-option--active': form.scopeType === 'all' }"
              @tap="form.scopeType = 'all'"
            >
              <text>全部商品</text>
            </view>
            <view
              class="scope-option"
              :class="{ 'scope-option--active': form.scopeType === 'category' }"
              @tap="form.scopeType = 'category'"
            >
              <text>指定分类</text>
            </view>
            <view
              class="scope-option"
              :class="{ 'scope-option--active': form.scopeType === 'product' }"
              @tap="form.scopeType = 'product'"
            >
              <text>指定商品</text>
            </view>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">使用门槛</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.useCondition"
              type="text"
              placeholder="下单即可使用"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
      </view>

      <button class="submit-btn" @tap="onSubmit">发布优惠券</button>
    </form>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { couponsApi } from '@/api/modules/coupons'

const formRef = ref<any>(null)
const submitting = ref(false)
const form = reactive({
  name: '',
  type: 'full' as 'full' | 'discount' | 'shipping',
  amount: '',
  minAmount: '',
  totalCount: '',
  perPersonLimit: '1',
  startDate: '',
  endDate: '',
  scopeType: 'all' as 'all' | 'category' | 'product',
  useCondition: '',
})

const couponTypes: { value: 'full' | 'discount' | 'shipping'; label: string; icon: string }[] = [
  { value: 'full', label: '满减券', icon: '¥' },
  { value: 'discount', label: '折扣券', icon: '%' },
  { value: 'shipping', label: '包邮券', icon: '邮' },
]

const rules: Rules = {
  name: [
    { required: true, message: '请输入优惠券名称' },
    { minLength: 2, message: '名称至少2个字' },
    { maxLength: 20, message: '名称最多20个字' },
  ],
  amount: [
    { required: true, message: '请输入面额' },
    {
      validator: (value: string) => parseFloat(value) > 0,
      message: '面额必须大于0',
    },
  ],
  minAmount: [
    {
      validator: (value: string) => {
        if (!value) return true
        const min = parseFloat(value)
        const amount = parseFloat(form.amount)
        return min >= amount
      },
      message: '满减门槛需大于等于面额',
    },
  ],
  startDate: [{ required: true, message: '请选择开始时间' }],
  endDate: [
    { required: true, message: '请选择结束时间' },
    {
      validator: (value: string) => value > form.startDate,
      message: '结束时间需晚于开始时间',
    },
  ],
}

const { errors, validate, clearError } = useFormValidation(form, rules)

function chooseStartDate() {
  const now = new Date()
  uni.showActionSheet({
    itemList: ['今天', '明天', '后天', '一周后'],
    success: (res) => {
      const days = [0, 1, 2, 7]
      const date = new Date(now.getTime() + days[res.tapIndex] * 24 * 60 * 60 * 1000)
      form.startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      clearError('startDate')
    }
  })
}

function chooseEndDate() {
  const now = new Date()
  uni.showActionSheet({
    itemList: ['一周后', '两周后', '一个月后', '三个月后'],
    success: (res) => {
      const days = [7, 14, 30, 90]
      const date = new Date(now.getTime() + days[res.tapIndex] * 24 * 60 * 60 * 1000)
      form.endDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      clearError('endDate')
    }
  })
}

async function onSubmit() {
  const valid = await validate()
  if (!valid) return
  if (submitting.value) return

  uni.showModal({
    title: '确认发布',
    content: '确认发布该优惠券？',
    success: async (res) => {
      if (res.confirm) {
        submitting.value = true
        uni.showLoading({ title: '发布中...' })
        try {
          await couponsApi.create({
            name: form.name,
            type: form.type,
            amount: parseFloat(form.amount),
            minAmount: form.minAmount ? parseFloat(form.minAmount) : 0,
            totalCount: form.totalCount ? parseInt(form.totalCount) : undefined,
            perPersonLimit: form.perPersonLimit ? parseInt(form.perPersonLimit) : 1,
            startTime: `${form.startDate} 00:00:00`,
            endTime: `${form.endDate} 23:59:59`,
            scopeType: form.scopeType,
            useCondition: form.useCondition || undefined,
          })
          uni.hideLoading()
          uni.showToast({ title: '发布成功', icon: 'success' })
          setTimeout(() => {
            uni.navigateBack()
          }, 1500)
        } catch (err) {
          uni.hideLoading()
          console.error('发布优惠券失败:', err)
        } finally {
          submitting.value = false
        }
      }
    }
  })
}
</script>

<style scoped>
.create-coupon-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.coupon-form { padding: 16rpx 24rpx; }
.form-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
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
.form-item--half { flex: 1; }
.form-row {
  display: flex;
  gap: 24rpx;
}
.form-label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 8rpx;
  display: block;
}
.form-control { position: relative; }
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
.input-placeholder { color: #bbb; font-size: 26rpx; }
.field-error { margin-top: 8rpx; }
.error-text { font-size: 24rpx; color: #ff4d4f; }
.type-options {
  display: flex;
  gap: 16rpx;
}
.type-option {
  flex: 1;
  height: 80rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border: 2rpx solid transparent;
}
.type-option--active {
  background: #fff1f0;
  border-color: #ff4d4f;
}
.option-icon {
  font-size: 28rpx;
  font-weight: 600;
  color: #ff4d4f;
}
.option-label {
  font-size: 26rpx;
  color: #333;
}
.time-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.time-item {
  flex: 1;
  height: 80rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.time-value {
  font-size: 26rpx;
  color: #333;
}
.time-separator {
  font-size: 28rpx;
  color: #999;
}
.scope-row {
  display: flex;
  gap: 12rpx;
}
.scope-option {
  flex: 1;
  height: 64rpx;
  background: #f5f7fa;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #666;
}
.scope-option--active {
  background: #1677FF;
  color: #fff;
}
.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #ff6b6b, #ff8e53);
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  border: none;
  margin-top: 16rpx;
}
.submit-btn::after { border: none; }
.safe-bottom { height: 40rpx; }
</style>
