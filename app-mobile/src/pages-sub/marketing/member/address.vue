<template>
  <view class="address-page">
    <page-header title="收货地址" @back="goBack" />

    <view class="address-list" v-if="addressList.length > 0">
      <view
        class="address-card"
        v-for="item in addressList"
        :key="item.id"
      >
        <view class="address-main" @tap="editAddress(item)">
          <view class="address-top">
            <text class="address-name">{{ item.name }}</text>
            <text class="address-mobile">{{ item.mobile }}</text>
            <view class="default-tag" v-if="item.isDefault">
              <text class="default-text">默认</text>
            </view>
          </view>
          <view class="address-detail">
            <text class="detail-text">{{ item.province }}{{ item.city }}{{ item.district }}{{ item.detail }}</text>
          </view>
        </view>
        <view class="address-actions">
          <view class="action-left">
            <view class="action-item" @tap="toggleDefault(item)">
              <view class="radio" :class="{ 'radio--checked': item.isDefault }">
                <view class="radio-inner" v-if="item.isDefault"></view>
              </view>
              <text class="action-text">设为默认</text>
            </view>
          </view>
          <view class="action-right">
            <view class="action-item" @tap="editAddress(item)">
              <image class="action-icon ic" src="/static/icons/ic/pen.svg" mode="aspectFit"/>
              <text class="action-text">编辑</text>
            </view>
            <view class="action-item action-item--danger" @tap="deleteAddress(item)">
              <image class="action-icon ic" src="/static/icons/ic/trash.svg" mode="aspectFit"/>
              <text class="action-text">删除</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="empty-state" v-else-if="!loading">
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无收货地址</text>
      <text class="empty-desc">点击下方按钮添加收货地址</text>
    </view>

    <view class="loading-state" v-if="loading">
      <view class="loading-spinner"></view>
      <text class="loading-text">加载中...</text>
    </view>

    <view class="bottom-bar">
      <button class="add-btn" @tap="addAddress">
        <text class="add-icon">+</text>
        <text class="add-text">新增收货地址</text>
      </button>
    </view>

    <view class="safe-bottom"></view>

    <!-- 编辑/新增地址弹窗 -->
    <view class="edit-mask" v-if="showEdit" @tap="closeEdit">
      <view class="edit-popup" @tap.stop>
        <view class="edit-header">
          <text class="edit-title">{{ editingId ? '编辑地址' : '新增地址' }}</text>
          <text class="edit-close" @tap="closeEdit">×</text>
        </view>
        <scroll-view class="edit-content" scroll-y>
          <form ref="formRef" :model="editForm" class="edit-form">
            <view class="form-item">
              <text class="form-label">收货人</text>
              <view class="form-control">
                <input
                  class="form-input"
                  v-model="editForm.name"
                  type="text"
                  placeholder="请输入收货人姓名"
                  placeholder-class="input-placeholder"
                  @input="clearError('name')"
                />
              </view>
              <view class="field-error" v-if="errors.name">
                <text class="error-text">{{ errors.name }}</text>
              </view>
            </view>

            <view class="form-item">
              <text class="form-label">手机号</text>
              <view class="form-control">
                <input
                  class="form-input"
                  v-model="editForm.mobile"
                  type="number"
                  placeholder="请输入手机号码"
                  placeholder-class="input-placeholder"
                  @input="clearError('mobile')"
                />
              </view>
              <view class="field-error" v-if="errors.mobile">
                <text class="error-text">{{ errors.mobile }}</text>
              </view>
            </view>

            <view class="form-item">
              <text class="form-label">所在地区</text>
              <view class="form-row">
                <view class="form-control form-control--third">
                  <input
                    class="form-input"
                    v-model="editForm.province"
                    type="text"
                    placeholder="省"
                    placeholder-class="input-placeholder"
                    @input="clearError('province')"
                  />
                </view>
                <view class="form-control form-control--third">
                  <input
                    class="form-input"
                    v-model="editForm.city"
                    type="text"
                    placeholder="市"
                    placeholder-class="input-placeholder"
                    @input="clearError('city')"
                  />
                </view>
                <view class="form-control form-control--third">
                  <input
                    class="form-input"
                    v-model="editForm.district"
                    type="text"
                    placeholder="区/县"
                    placeholder-class="input-placeholder"
                    @input="clearError('district')"
                  />
                </view>
              </view>
              <view class="field-error" v-if="errors.province || errors.city || errors.district">
                <text class="error-text">{{ errors.province || errors.city || errors.district }}</text>
              </view>
            </view>

            <view class="form-item">
              <text class="form-label">详细地址</text>
              <view class="form-control">
                <textarea
                  class="form-textarea"
                  v-model="editForm.detail"
                  placeholder="请输入详细地址，如街道、门牌号等"
                  placeholder-class="input-placeholder"
                  @input="clearError('detail')"
                />
              </view>
              <view class="field-error" v-if="errors.detail">
                <text class="error-text">{{ errors.detail }}</text>
              </view>
            </view>

            <view class="form-item form-item--switch">
              <text class="form-label">设为默认地址</text>
              <view
                class="switch-btn"
                :class="{ 'switch-btn--on': editForm.isDefault }"
                @tap="editForm.isDefault = editForm.isDefault ? 0 : 1"
              >
                <view class="switch-dot"></view>
              </view>
            </view>
          </form>
        </scroll-view>
        <view class="edit-footer">
          <button class="save-btn" :disabled="submitting" @tap="saveAddress">
            {{ submitting ? '保存中...' : '保存地址' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { addressApi, type AddressInfo } from '@/api/modules/address'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

const addressList = ref<AddressInfo[]>([])
const loading = ref(false)
const showEdit = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)

// 编辑表单
const formRef = ref<any>(null)
const editForm = reactive({
  name: '',
  mobile: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: 0 as number,
})

const editRules: Rules = {
  name: [{ required: true, message: '请输入收货人姓名' }],
  mobile: [
    { required: true, message: '请输入手机号码' },
    {
      validator: (value: string) => /^1[3-9]\d{9}$/.test(value),
      message: '请输入正确的手机号码',
    },
  ],
  province: [{ required: true, message: '请输入省份' }],
  city: [{ required: true, message: '请输入城市' }],
  district: [{ required: true, message: '请输入区/县' }],
  detail: [{ required: true, message: '请输入详细地址' }],
}

const { errors, validate, clearError } = useFormValidation(editForm, editRules)

// 加载地址列表
async function loadAddresses() {
  loading.value = true
  try {
    const result = await addressApi.list({
      page: 1,
      pageSize: 50,
    })
    addressList.value = result.list || []
  } catch (err) {
    console.error('加载地址列表失败:', err)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 新增地址
function addAddress() {
  editingId.value = null
  editForm.name = ''
  editForm.mobile = ''
  editForm.province = ''
  editForm.city = ''
  editForm.district = ''
  editForm.detail = ''
  editForm.isDefault = addressList.value.length === 0 ? 1 : 0
  showEdit.value = true
}

// 编辑地址
function editAddress(item: AddressInfo) {
  editingId.value = item.id
  editForm.name = item.name
  editForm.mobile = item.mobile
  editForm.province = item.province
  editForm.city = item.city
  editForm.district = item.district
  editForm.detail = item.detail
  editForm.isDefault = item.isDefault
  showEdit.value = true
}

// 关闭编辑弹窗
function closeEdit() {
  showEdit.value = false
}

// 保存地址
async function saveAddress() {
  const valid = await validate()
  if (!valid) return
  if (submitting.value) return

  submitting.value = true
  try {
    if (editingId.value) {
      await addressApi.update(editingId.value, {
        name: editForm.name,
        mobile: editForm.mobile,
        province: editForm.province,
        city: editForm.city,
        district: editForm.district,
        detail: editForm.detail,
        isDefault: editForm.isDefault,
      })
      uni.showToast({ title: '修改成功', icon: 'success' })
    } else {
      await addressApi.create({
        name: editForm.name,
        mobile: editForm.mobile,
        province: editForm.province,
        city: editForm.city,
        district: editForm.district,
        detail: editForm.detail,
        isDefault: editForm.isDefault,
      })
      uni.showToast({ title: '添加成功', icon: 'success' })
    }
    showEdit.value = false
    loadAddresses()
  } catch (err) {
    console.error('保存地址失败:', err)
  } finally {
    submitting.value = false
  }
}

// 删除地址
function deleteAddress(item: AddressInfo) {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除该收货地址吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await addressApi.delete(item.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          loadAddresses()
        } catch (err) {
          console.error('删除地址失败:', err)
        }
      }
    }
  })
}

// 设为默认
async function toggleDefault(item: AddressInfo) {
  if (item.isDefault) return
  try {
    await addressApi.setDefault(item.id)
    uni.showToast({ title: '已设为默认', icon: 'success' })
    loadAddresses()
  } catch (err) {
    console.error('设置默认地址失败:', err)
  }
}

onMounted(() => {
  loadAddresses()
})
</script>

<style lang="scss" scoped>
.address-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
  padding-bottom: 160rpx;
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

.address-list {
  padding: 16rpx 32rpx;
}

.address-card {
  background: $uni-bg-color;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.address-main {
  padding: 24rpx;
}

.address-top {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.address-name {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.address-mobile {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.default-tag {
  background: $uni-color-primary-soft;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.default-text {
  font-size: 20rpx;
  color: $uni-color-primary;
}

.address-detail {
  padding-right: 16rpx;
}

.detail-text {
  font-size: 26rpx;
  color: $uni-gray-500;
  line-height: 1.5;
}

.address-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid $uni-bg-color-grey;
}

.action-left,
.action-right {
  display: flex;
  align-items: center;
  gap: 32rpx;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.action-item--danger .action-text {
  color: $uni-color-error;
}

.action-icon {
  font-size: 28rpx;
  color: $uni-gray-400;
}

.action-item--danger .action-icon {
  color: $uni-color-error;
}

.action-text {
  font-size: 24rpx;
  color: $uni-gray-500;
}

.radio {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid $uni-gray-300;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.radio--checked {
  border-color: $uni-color-primary;
}

.radio-inner {
  width: 16rpx;
  height: 16rpx;
  background: $uni-color-primary;
  border-radius: 50%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  color: $uni-gray-300;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
  margin-bottom: 8rpx;
}

.empty-desc {
  font-size: 24rpx;
  color: $uni-gray-300;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
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

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: $uni-bg-color;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.add-btn {
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
  gap: 8rpx;
  border: none;
}

.add-btn::after {
  border: none;
}

.add-icon {
  font-size: 36rpx;
  font-weight: 400;
}

.add-text {
  font-size: 30rpx;
}

.safe-bottom {
  height: 40rpx;
}

/* 编辑弹窗 */
.edit-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.edit-popup {
  width: 100%;
  background: $uni-bg-color;
  border-radius: 24rpx 24rpx 0 0;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
  flex-shrink: 0;
}

.edit-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.edit-close {
  font-size: 48rpx;
  color: $uni-gray-400;
  line-height: 1;
}

.edit-content {
  flex: 1;
  max-height: 60vh;
}

.edit-form {
  padding: 24rpx;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-item--switch {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-label {
  font-size: 26rpx;
  color: $uni-gray-500;
  margin-bottom: 12rpx;
  display: block;
}

.form-item--switch .form-label {
  margin-bottom: 0;
  font-size: 28rpx;
  color: $uni-gray-700;
}

.form-control {
  position: relative;
}

.form-row {
  display: flex;
  gap: 16rpx;
}

.form-control--third {
  flex: 1;
}

.form-input {
  width: 100%;
  height: 80rpx;
  background: $uni-bg-color-page;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}

.form-textarea {
  width: 100%;
  height: 160rpx;
  background: $uni-bg-color-page;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: $uni-gray-700;
  box-sizing: border-box;
}

.input-placeholder {
  color: $uni-gray-300;
  font-size: 26rpx;
}

.switch-btn {
  width: 88rpx;
  height: 48rpx;
  background: $uni-gray-200;
  border-radius: 24rpx;
  position: relative;
  transition: background 0.2s;
}

.switch-btn--on {
  background: $uni-color-primary;
}

.switch-dot {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 40rpx;
  height: 40rpx;
  background: $uni-bg-color;
  border-radius: 50%;
  transition: left 0.2s;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.15);
}

.switch-btn--on .switch-dot {
  left: 44rpx;
}

.field-error {
  margin-top: 8rpx;
}

.error-text {
  font-size: 24rpx;
  color: $uni-color-error;
}

.edit-footer {
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid $uni-bg-color-grey;
  flex-shrink: 0;
}

.save-btn {
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
}

.save-btn::after {
  border: none;
}
</style>
