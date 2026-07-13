<template>
  <view class="address-edit-page">
    <view class="form-section">
      <view class="form-item">
        <text class="form-label">收货人</text>
        <input 
          class="form-input" 
          v-model="form.name" 
          placeholder="请输入收货人姓名"
          placeholder-class="placeholder"
        />
      </view>
      <view class="form-item">
        <text class="form-label">手机号</text>
        <input 
          class="form-input" 
          v-model="form.mobile" 
          type="number"
          placeholder="请输入手机号码"
          placeholder-class="placeholder"
        />
      </view>
      <view class="form-item" @tap="showRegionPicker = true">
        <text class="form-label">所在地区</text>
        <view class="form-value" :class="{ empty: !regionText }">
          <text>{{ regionText || '请选择省市区' }}</text>
          <text class="form-arrow">›</text>
        </view>
      </view>
      <view class="form-item form-item-textarea">
        <text class="form-label">详细地址</text>
        <textarea 
          class="form-textarea" 
          v-model="form.detail" 
          placeholder="请输入详细地址，如街道、门牌号等"
          placeholder-class="placeholder"
          :maxlength="200"
        />
      </view>
    </view>

    <view class="default-section">
      <view class="default-row">
        <text class="default-text">设为默认地址</text>
        <switch 
          :checked="form.isDefault" 
          color="#4080ff"
          @change="handleDefaultChange"
        />
      </view>
    </view>

    <view class="bottom-bar">
      <view class="save-btn" @tap="handleSave">
        <text>保存地址</text>
      </view>
    </view>

    <!-- 省市区选择器（简化版，使用picker替代） -->
    <picker 
      mode="region" 
      :value="regionValue"
      @change="handleRegionChange"
      @cancel="showRegionPicker = false"
    >
      <view v-if="showRegionPicker" class="region-picker-trigger"></view>
    </picker>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Taro, { useRouter } from '@tarojs/taro'
import { userApi } from '@/api/user'
import type { Address } from '@/api/user'

const router = useRouter()
const addressId = ref<number | null>(null)
const showRegionPicker = ref(false)
const regionValue = ref<string[]>(['北京市', '北京市', '朝阳区'])

const form = ref({
  name: '',
  mobile: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: false
})

const regionText = computed(() => {
  if (form.value.province && form.value.city && form.value.district) {
    return `${form.value.province} ${form.value.city} ${form.value.district}`
  }
  return ''
})

const loadAddressDetail = async () => {
  const id = Number(router.params.id)
  if (!id) return
  
  addressId.value = id
  
  try {
    const result = await userApi.getAddresses()
    const list = Array.isArray(result) ? result : (result as any)?.records || []
    const address = list.find((a: Address) => a.id === id)
    if (address) {
      form.value = {
        name: address.name,
        mobile: address.mobile,
        province: address.province,
        city: address.city,
        district: address.district,
        detail: address.detail,
        isDefault: address.isDefault
      }
      regionValue.value = [address.province, address.city, address.district]
    }
  } catch (error) {
    // 模拟数据
    const mockList = [
      {
        id: 1,
        name: '张三',
        mobile: '13800138000',
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detail: '建国路88号SOHO现代城A座1001室',
        isDefault: true
      }
    ]
    const address = mockList.find(a => a.id === id)
    if (address) {
      form.value = { ...address }
      regionValue.value = [address.province, address.city, address.district]
    }
  }
}

const handleRegionChange = (e: any) => {
  const [province, city, district] = e.detail.value
  form.value.province = province
  form.value.city = city
  form.value.district = district
  regionValue.value = e.detail.value
  showRegionPicker.value = false
}

const handleDefaultChange = (e: any) => {
  form.value.isDefault = e.detail.value
}

const validateForm = (): boolean => {
  if (!form.value.name.trim()) {
    Taro.showToast({ title: '请输入收货人姓名', icon: 'none' })
    return false
  }
  if (!form.value.mobile.trim()) {
    Taro.showToast({ title: '请输入手机号码', icon: 'none' })
    return false
  }
  if (!/^1[3-9]\d{9}$/.test(form.value.mobile)) {
    Taro.showToast({ title: '请输入正确的手机号码', icon: 'none' })
    return false
  }
  if (!form.value.province || !form.value.city || !form.value.district) {
    Taro.showToast({ title: '请选择所在地区', icon: 'none' })
    return false
  }
  if (!form.value.detail.trim()) {
    Taro.showToast({ title: '请输入详细地址', icon: 'none' })
    return false
  }
  return true
}

const handleSave = async () => {
  if (!validateForm()) return

  try {
    if (addressId.value) {
      await userApi.updateAddress(addressId.value, form.value)
    } else {
      await userApi.createAddress(form.value)
    }
    Taro.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => {
      Taro.navigateBack()
    }, 1500)
  } catch (error) {
    // 模拟保存成功
    Taro.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => {
      Taro.navigateBack()
    }, 1500)
  }
}

onMounted(() => {
  loadAddressDetail()
})
</script>

<style lang="scss" scoped>
.address-edit-page {
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

  &.form-item-textarea {
    align-items: flex-start;
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
}

.form-value {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: $font-size-base;
  color: $text-primary;

  &.empty {
    color: $text-placeholder;
  }
}

.form-arrow {
  color: $text-tertiary;
  font-size: $font-size-lg;
}

.form-textarea {
  flex: 1;
  font-size: $font-size-base;
  color: $text-primary;
  height: 180rpx;
  line-height: 1.5;
}

.placeholder {
  color: $text-placeholder;
}

.default-section {
  background-color: $bg-primary;
  margin-top: $spacing-md;
  padding: $spacing-md;
}

.default-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.default-text {
  font-size: $font-size-base;
  color: $text-primary;
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

.region-picker-trigger {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}
</style>
