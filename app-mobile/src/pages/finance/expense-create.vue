<template>
  <view class="expense-create-page">
    <view class="form-container">
      <!-- 费用类型 -->
      <view class="form-item">
        <text class="form-label">费用类型 <text class="required">*</text></text>
        <view class="type-picker">
          <view class="type-item" v-for="item in expenseTypes" :key="item.value" :class="{ active: formData.type === item.value }" @tap="formData.type = item.value">
            <text class="type-text">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <!-- 金额 -->
      <view class="form-item">
        <text class="form-label">金额 <text class="required">*</text></text>
        <view class="amount-input-wrap">
          <text class="amount-symbol">¥</text>
          <input class="amount-input" type="digit" placeholder="请输入金额" v-model="formData.amount" />
        </view>
      </view>

      <!-- 日期 -->
      <view class="form-item">
        <text class="form-label">日期 <text class="required">*</text></text>
        <picker mode="date" :value="formData.date" @change="onDateChange">
          <view class="picker-value">
            <text class="picker-text">{{ formData.date || '请选择日期' }}</text>
            <text class="picker-arrow">&#xe601;</text>
          </view>
        </picker>
      </view>

      <!-- 备注 -->
      <view class="form-item">
        <text class="form-label">备注</text>
        <textarea class="remark-input" placeholder="请输入备注信息" v-model="formData.remark" />
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="submit-btn" :class="{ disabled: !isValid }" @tap="onSubmit">
      <text class="submit-text">提交</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { expenseApi, type ExpenseType } from '@/api/modules/expenses'

const expenseTypes = ref<ExpenseType[]>([])

const formData = reactive({
  type: '',
  amount: '',
  date: '',
  remark: ''
})

const isValid = computed(() => {
  return formData.type && formData.amount && parseFloat(formData.amount) > 0 && formData.date
})

function onDateChange(e: any) {
  formData.date = e.detail.value
}

async function onSubmit() {
  if (!isValid.value) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }

  try {
    await expenseApi.create({
      type: formData.type,
      amount: parseFloat(formData.amount),
      date: formData.date,
      remark: formData.remark
    })
    uni.showToast({ title: '提交成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch (err) {
    uni.showToast({ title: '提交失败', icon: 'error' })
  }
}

async function loadTypes() {
  try {
    const types = await expenseApi.getTypes()
    expenseTypes.value = types
  } catch (err) {
    console.error('加载费用类型失败:', err)
  }
}

onMounted(() => {
  loadTypes()
  formData.date = new Date().toISOString().split('T')[0]
})
</script>

<style scoped>
.expense-create-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.form-container {
  padding: 24rpx;
}

.form-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.form-label {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 16rpx;
  display: block;
}

.required {
  color: #ff4d4f;
}

/* --- 类型选择 --- */
.type-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.type-item {
  padding: 12rpx 24rpx;
  background: #f5f5f5;
  border-radius: 24rpx;
}

.type-item.active {
  background: #e6f4ff;
}

.type-text {
  font-size: 26rpx;
}

.type-item .type-text { color: #666; }
.type-item.active .type-text { color: #1890ff; }

/* --- 金额输入 --- */
.amount-input-wrap {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 20rpx;
}

.amount-symbol {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-right: 12rpx;
}

.amount-input {
  flex: 1;
  height: 80rpx;
  font-size: 32rpx;
  font-weight: 600;
}

/* --- 日期选择 --- */
.picker-value {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 20rpx;
}

.picker-text {
  font-size: 28rpx;
  color: #333;
}

.picker-arrow {
  font-size: 24rpx;
  color: #999;
}

/* --- 备注输入 --- */
.remark-input {
  width: 100%;
  height: 160rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
}

/* --- 提交按钮 --- */
.submit-btn {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  height: 96rpx;
  background: #1890ff;
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-btn.disabled {
  background: #ccc;
}

.submit-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
}
</style>
