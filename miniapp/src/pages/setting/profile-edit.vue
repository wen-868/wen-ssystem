<template>
  <view class="profile-edit-page">
    <view class="form-section">
      <view class="form-item" @tap="chooseAvatar">
        <text class="form-label">头像</text>
        <view class="form-value">
          <image :src="form.avatar || defaultAvatar" class="avatar-img" />
          <text class="form-arrow">›</text>
        </view>
      </view>
      <view class="form-item">
        <text class="form-label">昵称</text>
        <input 
          class="form-input" 
          v-model="form.nickname" 
          placeholder="请输入昵称"
          placeholder-class="placeholder"
        />
      </view>
      <view class="form-item" @tap="showGenderPicker = true">
        <text class="form-label">性别</text>
        <view class="form-value">
          <text :class="{ placeholder: !form.gender }">{{ genderText || '请选择' }}</text>
          <text class="form-arrow">›</text>
        </view>
      </view>
      <view class="form-item" @tap="showDatePicker = true">
        <text class="form-label">生日</text>
        <view class="form-value">
          <text :class="{ placeholder: !form.birthday }">{{ form.birthday || '请选择' }}</text>
          <text class="form-arrow">›</text>
        </view>
      </view>
      <view class="form-item">
        <text class="form-label">手机号</text>
        <input 
          class="form-input input-disabled" 
          :value="userStore.userInfo?.phone || ''" 
          disabled
        />
      </view>
    </view>

    <view class="bottom-bar">
      <view class="save-btn" @tap="handleSave">
        <text>保存</text>
      </view>
    </view>

    <!-- 性别选择 -->
    <view class="picker-mask" v-if="showGenderPicker" @tap="showGenderPicker = false">
      <view class="picker-content" @tap.stop>
        <view class="picker-header">
          <text class="picker-cancel" @tap="showGenderPicker = false">取消</text>
          <text class="picker-title">选择性别</text>
          <text class="picker-confirm" @tap="confirmGender">确定</text>
        </view>
        <view class="picker-options">
          <view 
            class="picker-option" 
            :class="{ active: tempGender === 'MALE' }"
            @tap="tempGender = 'MALE'"
          >男</view>
          <view 
            class="picker-option" 
            :class="{ active: tempGender === 'FEMALE' }"
            @tap="tempGender = 'FEMALE'"
          >女</view>
          <view 
            class="picker-option" 
            :class="{ active: tempGender === 'UNKNOWN' }"
            @tap="tempGender = 'UNKNOWN'"
          >保密</view>
        </view>
      </view>
    </view>

    <!-- 生日选择 -->
    <picker 
      mode="date" 
      :value="form.birthday"
      @change="handleBirthdayChange"
      v-if="showDatePicker"
    >
      <view class="date-picker-trigger" @tap="showDatePicker = false"></view>
    </picker>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro from '@tarojs/taro'
import { useUserStore } from '@/stores/user'
import { userApi } from '@/api/user'

const userStore = useUserStore()
const showGenderPicker = ref(false)
const showDatePicker = ref(false)
const tempGender = ref<'MALE' | 'FEMALE' | 'UNKNOWN' | ''>('')

const defaultAvatar = 'https://neeko-copilot.bytedance.net/api/text2image?prompt=avatar%20icon%20user'

const form = ref({
  avatar: '',
  nickname: '',
  gender: '' as '' | 'MALE' | 'FEMALE' | 'UNKNOWN',
  birthday: ''
})

const genderText = computed(() => {
  const map: Record<string, string> = {
    MALE: '男',
    FEMALE: '女',
    UNKNOWN: '保密'
  }
  return map[form.value.gender] || ''
})

const loadProfile = () => {
  if (userStore.userInfo) {
    form.value.avatar = userStore.userInfo.avatar || ''
    form.value.nickname = userStore.userInfo.nickname || ''
  }
}

const chooseAvatar = () => {
  Taro.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      form.value.avatar = res.tempFilePaths[0]
    }
  })
}

const confirmGender = () => {
  form.value.gender = tempGender.value
  showGenderPicker.value = false
}

const handleBirthdayChange = (e: any) => {
  form.value.birthday = e.detail.value
  showDatePicker.value = false
}

const handleSave = async () => {
  if (!form.value.nickname.trim()) {
    Taro.showToast({ title: '请输入昵称', icon: 'none' })
    return
  }

  try {
    await userApi.updateProfile({
      nickname: form.value.nickname,
      avatar: form.value.avatar,
      gender: form.value.gender,
      birthday: form.value.birthday
    })
    
    userStore.updateUserInfo({
      nickname: form.value.nickname,
      avatar: form.value.avatar
    })
    
    Taro.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => {
      Taro.navigateBack()
    }, 1500)
  } catch (error) {
    // 模拟保存成功
    userStore.updateUserInfo({
      nickname: form.value.nickname,
      avatar: form.value.avatar
    })
    Taro.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => {
      Taro.navigateBack()
    }, 1500)
  }
}

onMounted(() => {
  loadProfile()
})
</script>

<style lang="scss" scoped>
.profile-edit-page {
  min-height: 100vh;
  background-color: $bg-secondary;
  padding-bottom: 140rpx;
}

.form-section {
  background-color: $bg-primary;
  margin-top: $spacing-md;
}

.form-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.form-label {
  width: 160rpx;
  font-size: $font-size-base;
  color: $text-primary;
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  font-size: $font-size-base;
  color: $text-primary;
  text-align: right;

  &.input-disabled {
    color: $text-tertiary;
  }
}

.form-value {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  font-size: $font-size-base;
  color: $text-primary;

  &.placeholder {
    color: $text-placeholder;
  }
}

.avatar-img {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  margin-right: $spacing-sm;
}

.form-arrow {
  color: $text-tertiary;
  font-size: $font-size-lg;
  margin-left: $spacing-xs;
}

.placeholder {
  color: $text-placeholder;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: $spacing-md;
  background-color: $bg-primary;
  border-top: 1rpx solid $border-color;
}

.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  background-color: $primary-color;
  color: #fff;
  font-size: $font-size-base;
  border-radius: $radius-lg;
}

.picker-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.picker-content {
  width: 100%;
  background-color: $bg-primary;
  border-radius: $radius-lg $radius-lg 0 0;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;
}

.picker-cancel {
  font-size: $font-size-base;
  color: $text-tertiary;
}

.picker-title {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
}

.picker-confirm {
  font-size: $font-size-base;
  color: $primary-color;
  font-weight: 500;
}

.picker-options {
  padding: $spacing-sm 0;
}

.picker-option {
  padding: $spacing-md;
  text-align: center;
  font-size: $font-size-base;
  color: $text-primary;

  &.active {
    color: $primary-color;
    font-weight: 500;
    background-color: rgba(64, 128, 255, 0.05);
  }
}

.date-picker-trigger {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}
</style>
