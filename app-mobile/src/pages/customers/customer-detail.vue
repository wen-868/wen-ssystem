<template>
  <view class="customer-detail-page">
    <!-- 客户头部信息 -->
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

    <!-- 数据概览 -->
    <view class="stats-row">
      <view class="stat-item">
        <text class="stat-value">{{ customer.totalOrders }}</text>
        <text class="stat-label">订单数</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">¥{{ customer.totalAmount }}</text>
        <text class="stat-label">累计消费</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">¥{{ customer.unpaidAmount }}</text>
        <text class="stat-label">待收款</text>
      </view>
    </view>

    <!-- 基本信息 -->
    <view class="info-section">
      <view class="section-title">基本信息</view>
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

    <!-- 编辑表单：ref + :model + :rules -->
    <view class="info-section">
      <view class="section-title">编辑客户</view>
      <form ref="formRef" :model="editForm" class="edit-form">
        <view class="form-item">
          <text class="form-label">客户名称</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="editForm.name"
              type="text"
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
              placeholder="请输入联系电话"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">客户类型</text>
          <view class="form-control">
            <picker :range="typeOptions" :range-key="'label'" @change="onTypeChange">
              <view class="picker-value">
                <text>{{ typeLabel }}</text>
                <text class="picker-arrow">&#xe612;</text>
              </view>
            </picker>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">地址</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="editForm.address"
              type="text"
              placeholder="请输入地址"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
        <view class="form-item form-item--last">
          <text class="form-label">备注</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="editForm.remark"
              type="text"
              placeholder="请输入备注"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
        <text class="error-text" v-if="errors.name">{{ errors.name }}</text>
        <text class="error-text" v-else-if="errors.phone">{{ errors.phone }}</text>
        <button class="submit-btn" @tap="onSubmit">保存修改</button>
      </form>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

const formRef = ref<any>(null)
const editForm = reactive({
  name: '',
  phone: '',
  type: 'RETAIL',
  address: '',
  remark: '',
})
const editRules: Rules = {
  name: [
    { required: true, message: '请输入客户名称' },
    { minLength: 2, message: '名称至少2个字' },
  ],
  phone: [
    { required: true, message: '请输入联系电话' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
  ],
}
const { errors, validate, clearError } = useFormValidation(editForm, editRules)

const typeOptions = [
  { label: '零售客户', value: 'RETAIL' },
  { label: '批发客户', value: 'WHOLESALE' },
]
const typeLabel = ref('零售客户')

const customer = ref<any>({
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
  const valid = await validate()
  if (!valid) return
  uni.showModal({
    title: '确认保存',
    content: '确认保存客户信息修改？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '保存成功', icon: 'success' })
      }
    }
  })
}

async function loadCustomer(id: number) {
  try {
    // TODO: 对接客户详情接口
  } catch (err) {
    console.error('加载客户详情失败:', err)
  }
}

onLoad((options: any) => {
  const id = options?.id ? Number(options.id) : 0
  if (id > 0) {
    loadCustomer(id)
  }
  uni.setNavigationBarTitle({ title: '客户详情' })
})
</script>

<style scoped>
.customer-detail-page { min-height: 100vh; background: #f0f5ff; }
.customer-header {
  display: flex; align-items: center;
  gap: 24rpx;
  padding: 32rpx;
  padding-top: calc(32rpx + env(safe-area-inset-top));
  background: linear-gradient(135deg, #1677FF, #4096ff);
}
.customer-avatar {
  width: 96rpx; height: 96rpx;
  border-radius: 48rpx;
  background: rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
}
.avatar-text { font-size: 40rpx; color: #fff; font-weight: 600; }
.customer-info { flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.customer-name { font-size: 32rpx; color: #fff; font-weight: 600; }
.customer-tag-row { display: flex; align-items: center; gap: 16rpx; }
.customer-tag { padding: 4rpx 16rpx; border-radius: 16rpx; background: rgba(255,255,255,0.2); }
.tag-RETAIL { background: rgba(255,255,255,0.25); }
.tag-WHOLESALE { background: rgba(82,196,26,0.3); }
.tag-text { font-size: 20rpx; color: #fff; }
.customer-phone { font-size: 24rpx; color: rgba(255,255,255,0.85); }
.stats-row {
  display: flex; align-items: center;
  background: #fff;
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
.stat-value { font-size: 32rpx; color: #333; font-weight: 700; }
.stat-label { font-size: 22rpx; color: #999; }
.stat-divider {
  width: 1rpx; height: 48rpx;
  background: #f0f0f0;
}
.info-section { padding: 24rpx; }
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
}
.info-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.info-row:last-child { border-bottom: none; }
.info-label { font-size: 26rpx; color: #999; flex-shrink: 0; }
.info-value { font-size: 26rpx; color: #333; text-align: right; flex: 1; }
.info-value--link { color: #1677FF; }
.info-value--multi { line-height: 1.4; }
.edit-form {
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.form-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.form-item--last { border-bottom: none; }
.form-label {
  width: 160rpx;
  font-size: 26rpx;
  color: #666;
  flex-shrink: 0;
}
.form-control { flex: 1; }
.form-input {
  width: 100%;
  font-size: 26rpx;
  color: #333;
  text-align: right;
}
.input-placeholder { color: #bbb; font-size: 26rpx; }
.picker-value {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
}
.picker-value text { font-size: 26rpx; color: #333; }
.picker-arrow { font-size: 24rpx; color: #999; }
.error-text {
  display: block;
  font-size: 22rpx;
  color: #ff4d4f;
  margin-top: 12rpx;
  text-align: right;
}
.submit-btn {
  width: 100%;
  height: 80rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
  margin: 24rpx 0;
  border: none;
}
.submit-btn::after { border: none; }
.safe-bottom { height: 40rpx; }
</style>
