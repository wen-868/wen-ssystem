<template>
  <view class="profile-edit-page">
    <page-header title="编辑资料" @back="goBack" />
    <!-- 头像区域 -->
    <view class="avatar-section">
      <view class="avatar-wrap" @tap="chooseAvatar">
        <image v-if="form.avatar" class="avatar-img" :src="form.avatar" mode="aspectFill" />
        <view v-else class="avatar-placeholder">
          <image class="avatar-icon ic" src="/static/icons/ic/camera.svg" mode="aspectFit"/>
        </view>
        <view class="avatar-edit-mask">
          <text class="edit-text">更换</text>
        </view>
      </view>
    </view>

    <!-- 编辑表单：ref + :model + :rules -->
    <form ref="formRef" :model="form" class="edit-form">
      <view class="form-group">
        <view class="form-item">
          <text class="form-label">姓名</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.name"
              type="text"
              placeholder="请输入姓名"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">手机号</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.phone"
              type="tel"
              placeholder="请输入手机号"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">岗位</text>
          <view class="form-control">
            <input
              class="form-input form-input--readonly"
              :value="form.role"
              disabled
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">门店</text>
          <view class="form-control">
            <input
              class="form-input form-input--readonly"
              :value="form.storeName"
              disabled
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
      </view>

      <view class="form-group">
        <view class="form-item">
          <text class="form-label">邮箱</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.email"
              type="email"
              placeholder="请输入邮箱"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
        <view class="form-item form-item--last">
          <text class="form-label">微信号</text>
          <view class="form-control">
            <input
              class="form-input"
              v-model="form.wechat"
              type="text"
              placeholder="请输入微信号"
              placeholder-class="input-placeholder"
            />
          </view>
        </view>
      </view>

      <text class="error-text" v-if="errors.name">{{ errors.name }}</text>
      <text class="error-text" v-else-if="errors.phone">{{ errors.phone }}</text>

      <button class="submit-btn" @tap="onSubmit">保存修改</button>
    </form>

    <!-- 修改密码入口 -->
    <view class="action-list">
      <view class="action-item" @tap="goChangePassword">
        <text class="action-text">修改密码</text>
        <image class="action-arrow ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import pageHeader from '@/components/page-header/page-header.vue'

function goBack() {
  uni.navigateBack()
}
import { ref, reactive, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { profileApi } from '@/api/modules/profile'

const formRef = ref<any>(null)
const form = reactive({
  avatar: '',
  name: '',
  phone: '',
  role: '',
  storeName: '',
  email: '',
  wechat: '',
})
const rules: Rules = {
  name: [
    { required: true, message: '请输入姓名' },
    { minLength: 2, message: '姓名至少2个字' },
  ],
  phone: [
    { required: true, message: '请输入手机号' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
  ],
  email: [
    { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '请输入正确的邮箱格式' },
  ],
}
const { errors, validate, clearError } = useFormValidation(form, rules)

function chooseAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      if (res.tempFilePaths && res.tempFilePaths.length > 0) {
        uni.showLoading({ title: '上传头像...' })
        try {
          const up = await profileApi.uploadAvatar(res.tempFilePaths[0])
          form.avatar = up.avatar
          uni.hideLoading()
          uni.showToast({ title: '头像已上传', icon: 'success' })
        } catch (err: any) {
          uni.hideLoading()
          uni.showToast({ title: err?.message || '头像上传失败', icon: 'none' })
        }
      }
    },
  })
}

async function onSubmit() {
  const valid = await validate()
  if (!valid) return
  uni.showModal({
    title: '确认保存',
    content: '确认保存个人资料修改？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await profileApi.updateProfile({
            realName: form.name,
            phone: form.phone,
            email: form.email,
            avatar: form.avatar,
          })
          uni.showToast({ title: '保存成功', icon: 'success' })
        } catch (err) {
          console.error('保存失败:', err)
          uni.showToast({ title: '保存失败', icon: 'none' })
        }
      }
    }
  })
}

function goChangePassword() {
  uni.navigateTo({ url: '/pages/profile/change-password' })
}

async function loadProfile() {
  try {
    const res = await profileApi.getProfile()
    form.avatar = res.avatar || ''
    form.name = res.realName || ''
    form.phone = res.phone || res.username || ''
    form.role = res.roles?.join(', ') || ''
    form.email = res.email || ''
  } catch (err) {
    console.error('加载个人资料失败:', err)
  }
}

onLoad(() => {
  loadProfile()
  uni.setNavigationBarTitle({ title: '编辑资料' })
})
</script>

<style lang="scss" scoped>
.profile-edit-page { min-height: 100vh; background: $uni-color-primary-soft; }
.avatar-section {
  display: flex; justify-content: center;
  padding: $uni-spacing-xl 0 $uni-spacing-lg;
  background: $uni-bg-color;
}
.avatar-wrap {
  width: 160rpx; height: 160rpx;
  border-radius: 80rpx;
  position: relative;
  overflow: hidden;
  background: $uni-bg-color-grey;
}
.avatar-img { width: 100%; height: 100%; }
.avatar-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: $uni-gray-100;
}
.avatar-icon { font-size: 64rpx; color: $uni-gray-300; }
.avatar-edit-mask {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 40rpx;
  background: $zx-black-500;
  display: flex; align-items: center; justify-content: center;
}
.edit-text { font-size: 20rpx; color: $uni-text-color-inverse; }
.edit-form { padding: $uni-spacing-base; }
.form-group {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: 0 $uni-spacing-base;
  margin-bottom: $uni-spacing-base;
  box-shadow: $uni-shadow-card-sm;
}
.form-item {
  display: flex;
  align-items: center;
  padding: $uni-spacing-base 0;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.form-item--last { border-bottom: none; }
.form-label {
  width: 140rpx;
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
  flex-shrink: 0;
}
.form-control { flex: 1; }
.form-input {
  width: 100%;
  font-size: 28rpx;
  color: $uni-gray-700;
  text-align: right;
}
.form-input--readonly { color: $uni-gray-400; }
.input-placeholder { color: $uni-gray-300; font-size: 28rpx; }
.error-text {
  display: block;
  font-size: 24rpx;
  color: $uni-color-error;
  margin-bottom: $uni-spacing-sm;
  text-align: right;
  padding-right: $uni-spacing-base;
}
.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  margin-bottom: 32rpx;
  border: none;
}
.submit-btn::after { border: none; }
.action-list {
  margin: 0 $uni-spacing-base;
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  overflow: hidden;
  box-shadow: $uni-shadow-card-sm;
}
.action-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $uni-spacing-base $uni-spacing-base;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.action-item:last-child { border-bottom: none; }
.action-text { font-size: 28rpx; color: $uni-gray-700; }
.action-arrow { font-size: 24rpx; color: $uni-gray-400; }
.safe-bottom { height: 40rpx; }
</style>
