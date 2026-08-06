<template>
  <view class="customer-detail-page">
    <view class="loading-overlay" v-if="loading">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else>
      <view class="customer-header">
        <view class="customer-avatar">
          <text class="avatar-text">{{ customer.name?.charAt(0) || '客' }}</text>
        </view>
        <view class="customer-info">
          <text class="customer-name">{{ customer.name }}</text>
          <view class="customer-tag-row">
            <view class="customer-tag" :class="'tag-' + customer.type">
              <text class="tag-text">{{ customer.typeLabel }}</text>
            </view>
            <text class="customer-phone">{{ customer.phone }}</text>
          </view>
        </view>
      </view>

      <view class="stats-row">
        <view class="stat-item">
          <text class="stat-value">{{ customer.totalOrders }}</text>
          <text class="stat-label">订单数</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">¥{{ parseFloat(String(customer.totalAmount || '0')).toFixed(2) }}</text>
          <text class="stat-label">累计消费</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">¥{{ parseFloat(customer.unpaidAmount || '0').toFixed(2) }}</text>
          <text class="stat-label">待收款</text>
        </view>
      </view>

      <view class="info-section">
        <view class="section-header">
          <text class="section-title">基本信息</text>
        </view>
        <view class="info-card">
          <view class="info-row">
            <text class="info-label">联系人</text>
            <text class="info-value">{{ customer.contact }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">联系电话</text>
            <text class="info-value info-value--link" @tap="callPhone">{{ customer.phone }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">客户类型</text>
            <text class="info-value">{{ customer.typeLabel }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">客户等级</text>
            <text class="info-value">{{ customer.level }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">所属区域</text>
            <text class="info-value">{{ customer.area }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">详细地址</text>
            <text class="info-value info-value--multi">{{ customer.address }}</text>
          </view>
        </view>
      </view>

      <view class="info-section">
        <view class="section-header">
          <text class="section-title">{{ isEdit ? '编辑客户' : '修改信息' }}</text>
          <text class="edit-toggle" @tap="toggleEdit">{{ isEdit ? '取消' : '编辑' }}</text>
        </view>
        <form :model="editForm" class="edit-form">
          <view class="form-item">
            <text class="form-label">客户名称</text>
            <view class="form-control">
              <input
                class="form-input"
                v-model="editForm.name"
                type="text"
                :disabled="!isEdit"
                placeholder="请输入客户名称"
                placeholder-class="input-placeholder"
              />
            </view>
          </view>
          <view class="form-item">
            <text class="form-label">联系电话</text>
            <view class="form-control">
              <input
                class="form-input"
                v-model="editForm.phone"
                type="tel"
                :disabled="!isEdit"
                placeholder="请输入联系电话"
                placeholder-class="input-placeholder"
              />
            </view>
          </view>
          <view class="form-item">
            <text class="form-label">客户类型</text>
            <view class="form-control">
              <picker v-if="isEdit" :range="typeOptions" :range-key="'label'" @change="onTypeChange">
                <view class="picker-value">
                  <text>{{ typeLabel }}</text>
                  <text class="picker-arrow">&#xe612;</text>
                </view>
              </picker>
              <text v-else>{{ typeLabel }}</text>
            </view>
          </view>
          <view class="form-item">
            <text class="form-label">地址</text>
            <view class="form-control">
              <input
                class="form-input"
                v-model="editForm.address"
                type="text"
                :disabled="!isEdit"
                placeholder="请输入地址"
                placeholder-class="input-placeholder"
              />
            </view>
          </view>
          <view class="form-item form-item--last">
            <text class="form-label">备注</text>
            <view class="form-control">
              <textarea
                class="form-textarea"
                v-model="editForm.remark"
                :disabled="!isEdit"
                placeholder="请输入备注"
                placeholder-class="input-placeholder"
              />
            </view>
          </view>
          <text class="error-text" v-if="errorMsg">{{ errorMsg }}</text>
          <button v-if="isEdit" class="submit-btn" @tap="onSubmit">保存修改</button>
        </form>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { customersApi, type CustomerInfo } from '@/api/modules/customers'

const isEdit = ref(false)
const loading = ref(false)
const errorMsg = ref('')

const typeOptions = [
  { label: '零售客户', value: 'RETAIL' },
  { label: '批发客户', value: 'WHOLESALE' },
]

const typeLabel = ref('零售客户')
const editForm = reactive({
  name: '',
  phone: '',
  type: 'RETAIL',
  address: '',
  remark: '',
})

const customer = ref<Partial<CustomerInfo>>({
  id: 0,
  name: '',
  contact: '',
  phone: '',
  type: 'RETAIL',
  typeLabel: '零售客户',
  level: '普通客户',
  area: '',
  address: '',
  totalOrders: 0,
  totalAmount: '0.00',
  unpaidAmount: '0.00',
})

function toggleEdit() {
  isEdit.value = !isEdit.value
}

function onTypeChange(e: any) {
  const idx = e.detail.value
  editForm.type = typeOptions[idx].value
  typeLabel.value = typeOptions[idx].label
}

function callPhone() {
  if (customer.value.phone) {
    uni.makePhoneCall({ phoneNumber: customer.value.phone })
  }
}

async function onSubmit() {
  errorMsg.value = ''
  
  if (!editForm.name.trim()) {
    errorMsg.value = '请输入客户名称'
    return
  }
  if (!editForm.phone) {
    errorMsg.value = '请输入联系电话'
    return
  }
  if (!/^1[3-9]\d{9}$/.test(editForm.phone)) {
    errorMsg.value = '请输入正确的手机号'
    return
  }

  uni.showLoading({ title: '保存中...' })
  try {
    if (customer.value.id && customer.value.id > 0) {
      await customersApi.detail(customer.value.id)
    } else {
      await customersApi.create(editForm)
    }
    uni.showToast({ title: '保存成功', icon: 'success' })
    isEdit.value = false
    if (customer.value.id && customer.value.id > 0) {
      await loadCustomer(customer.value.id)
    }
  } catch (err) {
    console.error('保存失败:', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

async function loadCustomer(id: number) {
  loading.value = true
  try {
    const result = await customersApi.detail(id)
    customer.value = result
    editForm.name = result.name || ''
    editForm.phone = result.phone || ''
    editForm.type = result.type || 'RETAIL'
    editForm.address = result.address || ''
    editForm.remark = result.remark || ''
    
    const option = typeOptions.find(o => o.value === editForm.type)
    typeLabel.value = option?.label || '零售客户'
  } catch (err) {
    console.error('加载客户详情失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onLoad((options: any) => {
  const id = options?.id ? Number(options.id) : 0
  uni.setNavigationBarTitle({ title: id > 0 ? '客户详情' : '新增客户' })
  
  if (id > 0) {
    loadCustomer(id)
  } else {
    isEdit.value = true
  }
})
</script>

<style lang="scss" scoped>
.customer-detail-page { min-height: 100vh; background: $uni-color-primary-soft; }

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: $uni-color-primary-soft;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid $uni-gray-200;
  border-top-color: $uni-color-primary;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 26rpx;
  color: $uni-gray-400;
  margin-top: 20rpx;
}

.customer-header {
  display: flex; align-items: center;
  gap: 24rpx;
  padding: 32rpx;
  padding-top: calc(32rpx + env(safe-area-inset-top));
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
}

.customer-avatar {
  width: 96rpx; height: 96rpx;
  border-radius: 48rpx;
  background: rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
}

.avatar-text { font-size: 40rpx; color: $uni-text-color-inverse; font-weight: 600; }

.customer-info { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }

.customer-name { font-size: 34rpx; color: $uni-text-color-inverse; font-weight: 600; }

.customer-tag-row { display: flex; align-items: center; gap: 16rpx; }

.customer-tag { padding: 4rpx 16rpx; border-radius: 16rpx; background: rgba(255,255,255,0.2); }

.tag-RETAIL { background: rgba(255,255,255,0.25); }

.tag-WHOLESALE { background: rgba(82,196,26,0.3); }

.tag-text { font-size: 20rpx; color: $uni-text-color-inverse; }

.customer-phone { font-size: 24rpx; color: rgba(255,255,255,0.85); }

.stats-row {
  display: flex; align-items: center;
  background: $uni-bg-color;
  margin: -24rpx 24rpx 0;
  border-radius: 16rpx;
  padding: 24rpx 0;
  position: relative;
  z-index: 1;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}

.stat-item {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; gap: 8rpx;
}

.stat-value { font-size: 32rpx; color: $uni-gray-700; font-weight: 700; }

.stat-label { font-size: 22rpx; color: $uni-gray-400; }

.stat-divider {
  width: 1rpx; height: 48rpx;
  background: $uni-gray-100;
}

.info-section { padding: 24rpx; }

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.edit-toggle {
  font-size: 26rpx;
  color: $uni-color-primary;
}

.info-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.info-row:last-child { border-bottom: none; }

.info-label { font-size: 26rpx; color: $uni-gray-400; flex-shrink: 0; width: 140rpx; }

.info-value { font-size: 26rpx; color: $uni-gray-700; text-align: right; flex: 1; }

.info-value--link { color: $uni-color-primary; }

.info-value--multi { line-height: 1.4; }

.edit-form {
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}

.form-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.form-item--last { border-bottom: none; }

.form-label {
  width: 160rpx;
  font-size: 26rpx;
  color: $uni-gray-500;
  flex-shrink: 0;
}

.form-control { flex: 1; }

.form-input {
  width: 100%;
  font-size: 26rpx;
  color: $uni-gray-700;
  text-align: right;
}

.form-textarea {
  width: 100%;
  font-size: 26rpx;
  color: $uni-gray-700;
  text-align: right;
  min-height: 120rpx;
}

.input-placeholder { color: $uni-gray-300; font-size: 26rpx; }

.picker-value {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
}

.picker-value text { font-size: 26rpx; color: $uni-gray-700; }

.picker-arrow { font-size: 24rpx; color: $uni-gray-400; }

.error-text {
  display: block;
  font-size: 22rpx;
  color: $uni-color-error;
  margin-top: 12rpx;
  text-align: right;
}

.submit-btn {
  width: 100%;
  height: 80rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  margin: 24rpx 0;
  border: none;
}

.submit-btn::after { border: none; }

.safe-bottom { height: calc(40rpx + env(safe-area-inset-bottom)); }
</style>
