<template>
  <view class="in-stock-page">
    <page-header title="采购入库" @back="goBack" />

    <!-- 表单三件套：ref + :model + :rules -->
    <form ref="formRef" :model="stockForm" :rules="stockRules" class="stock-form" @submit="handleSubmit">
      <view class="form-section">
        <view class="section-title">入库信息</view>

        <view class="form-item">
          <view class="form-label">关联采购订单</view>
          <input
            class="form-input"
            v-model="stockForm.orderNo"
            type="text"
            placeholder="输入采购单号"
            placeholder-class="input-placeholder"
            @input="clearError('orderNo')"
          />
          <view class="field-error" v-if="errors.orderNo">
            <text class="error-text">{{ errors.orderNo }}</text>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">供应商</view>
          <picker
            :value="stockForm.supplierIndex"
            :range="supplierList"
            range-key="name"
            @change="onSupplierChange"
          >
            <view class="form-picker">
              <text>{{ supplierList[stockForm.supplierIndex]?.name || '请选择供应商' }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
          <view class="field-error" v-if="errors.supplierIndex">
            <text class="error-text">{{ errors.supplierIndex }}</text>
          </view>
        </view>

        <view class="form-item">
          <view class="form-label">入库门店</view>
          <picker
            :value="stockForm.storeIndex"
            :range="storeList"
            range-key="name"
            @change="onStoreChange"
          >
            <view class="form-picker">
              <text>{{ storeList[stockForm.storeIndex]?.name || '请选择门店' }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <view class="form-label">入库日期</view>
          <picker mode="date" :value="stockForm.stockDate" @change="onDateChange">
            <view class="form-picker">
              <text>{{ stockForm.stockDate || '请选择入库日期' }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>

        <view class="form-item">
          <view class="form-label">备注</view>
          <textarea
            class="form-textarea"
            v-model="stockForm.remark"
            placeholder="入库备注（选填）"
            placeholder-class="input-placeholder"
          />
        </view>

        <button
          class="submit-btn"
          form-type="submit"
          :disabled="submitting"
        >
          {{ submitting ? '提交中...' : '确认入库' }}
        </button>
      </view>
    </form>

    <!-- 入库记录 -->
    <view class="history-section" v-if="historyList.length > 0">
      <view class="section-title">入库记录</view>
      <view class="history-card" v-for="item in historyList" :key="item.stockNo">
        <view class="history-header">
          <text class="history-no">入库单号：{{ item.stockNo }}</text>
          <view class="history-status" :class="'status-' + item.status">
            <text class="status-text">{{ item.statusLabel }}</text>
          </view>
        </view>
        <view class="history-body">
          <text class="history-info">供应商：{{ item.supplierName }}</text>
          <text class="history-info">商品数：{{ item.itemCount }}</text>
          <text class="history-info">入库日期：{{ item.stockDate }}</text>
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
import { purchaseApi } from '@/api/modules/purchase'
import { supplierApi } from '@/api/modules/suppliers'

const formRef = ref<any>(null)
const stockForm = reactive({
  orderNo: '',
  supplierIndex: -1,
  storeIndex: 0,
  stockDate: '',
  remark: '',
})

const stockRules: Rules = {
  orderNo: [{ minLength: 1, message: '请输入采购单号', required: false }],
  supplierIndex: [{ required: true, message: '请选择供应商' }],
}

const { errors, validate, clearError } = useFormValidation(stockForm, stockRules)

const supplierList = ref<any[]>([])
const storeList = ref<Array<{ id?: number; name: string }>>([{ name: '默认门店' }])
const submitting = ref(false)
const historyList = ref<any[]>([])

function onSupplierChange(e: any) { stockForm.supplierIndex = e.detail.value }
function onStoreChange(e: any) { stockForm.storeIndex = e.detail.value }
function onDateChange(e: any) { stockForm.stockDate = e.detail.value }

async function handleSubmit() {
  if (!validate()) return
  submitting.value = true
  try {
    await purchaseApi.createInStock({
      orderNo: stockForm.orderNo,
      supplierId: supplierList.value[stockForm.supplierIndex]?.id,
      storeId: storeList.value[stockForm.storeIndex]?.id,
      stockDate: stockForm.stockDate,
      remark: stockForm.remark
    })
    uni.showToast({ title: '入库成功', icon: 'success' })
    loadHistory()
  } catch (err: any) {
    uni.showToast({ title: err?.message || '入库失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

async function loadSuppliers() {
  try {
    const res = await supplierApi.getList({ page: 1, pageSize: 100 })
    supplierList.value = res.list || []
  } catch (err) {
    console.error('加载供应商列表失败:', err)
  }
}

async function loadHistory() {
  try {
    const res = await purchaseApi.getInStockList({ page: 1, pageSize: 20 })
    historyList.value = res.list || []
  } catch (err) {
    console.error('加载入库记录失败:', err)
  }
}

onMounted(() => {
  loadSuppliers()
  loadHistory()
})
</script>

<style lang="scss" scoped>
.in-stock-page {
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
.stock-form {
  padding: $uni-spacing-sm $uni-spacing-base;
}
.form-section {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-sm;
  box-shadow: $uni-shadow-card-sm;
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
.form-picker {
  width: 100%;
  height: 80rpx;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-base;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 28rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}
.picker-arrow { font-size: 32rpx; color: $uni-gray-300; }
.input-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.field-error { margin-top: $uni-spacing-xs; padding: 6rpx 0; }
.error-text { font-size: 24rpx; color: $uni-color-error; }
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
.submit-btn::after { border: none; }
.history-section { padding: 0 $uni-spacing-lg; }
.history-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-md;
  box-shadow: $uni-shadow-card-sm;
}
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.history-no { font-size: 26rpx; color: $uni-gray-700; font-weight: 600; }
.history-status { padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-pending { background: $uni-color-warning-soft; }
.status-pending .status-text { color: $uni-color-warning; }
.status-confirmed { background: $uni-color-success-soft; }
.status-confirmed .status-text { color: $uni-color-success; }
.status-text { font-size: 22rpx; }
.history-body { display: flex; flex-direction: column; gap: $uni-spacing-xs; }
.history-info { font-size: 24rpx; color: $uni-gray-500; }
.safe-bottom { height: 40rpx; }
</style>
