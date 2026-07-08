<template>
  <view class="profile-edit-page">
    <!-- 头像区域 -->
    <view class="avatar-section">
      <view class="avatar-wrap" @tap="chooseAvatar">
        <image v-if="form.avatar" class="avatar-img" :src="form.avatar" mode="aspectFill" />
        <view v-else class="avatar-placeholder">
          <text class="avatar-icon">&#xe611;</text>
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
        <text class="action-arrow">&#xe612;</text>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

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
    success: (res) => {
      if (res.tempFilePaths && res.tempFilePaths.length > 0) {
        form.avatar = res.tempFilePaths[0]
      }
    }
  })
}

async function onSubmit() {
  const valid = await validate()
  if (!valid) return
  uni.showModal({
    title: '确认保存',
    content: '确认保存个人资料修改？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '保存成功', icon: 'success' })
      }
    }
  })
}

function goChangePassword() {
  uni.navigateTo({ url: '/pages/profile/change-password' })
}

async function loadProfile() {
  try {
    // TODO: 对接个人资料接口
  } catch (err) {
    console.error('加载个人资料失败:', err)
  }
}

onLoad(() => {
  loadProfile()
  uni.setNavigationBarTitle({ title: '编辑资料' })
})
</script>

<style scoped>
.profile-edit-page { min-height: 100vh; background: #f0f5ff; }
.avatar-section {
  display: flex; justify-content: center;
  padding: 48rpx 0 32rpx;
  background: #fff;
}
.avatar-wrap {
  width: 160rpx; height: 160rpx;
  border-radius: 80rpx;
  position: relative;
  overflow: hidden;
  background: #f5f5f5;
}
.avatar-img { width: 100%; height: 100%; }
.avatar-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: #f0f0f0;
}
.avatar-icon { font-size: 64rpx; color: #ccc; }
.avatar-edit-mask {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 40rpx;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
}
.edit-text { font-size: 20rpx; color: #fff; }
.edit-form { padding: 24rpx; }
.form-group {
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.form-item {
  display: flex;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.form-item--last { border-bottom: none; }
.form-label {
  width: 140rpx;
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  flex-shrink: 0;
}
.form-control { flex: 1; }
.form-input {
  width: 100%;
  font-size: 28rpx;
  color: #333;
  text-align: right;
}
.form-input--readonly { color: #999; }
.input-placeholder { color: #bbb; font-size: 28rpx; }
.error-text {
  display: block;
  font-size: 24rpx;
  color: #ff4d4f;
  margin-bottom: 16rpx;
  text-align: right;
  padding-right: 24rpx;
}
.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  margin-bottom: 32rpx;
  border: none;
}
.submit-btn::after { border: none; }
.action-list {
  margin: 0 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.action-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.action-item:last-child { border-bottom: none; }
.action-text { font-size: 28rpx; color: #333; }
.action-arrow { font-size: 24rpx; color: #999; }
.safe-bottom { height: 40rpx; }
</style>
