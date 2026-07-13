<template>
  <view class="address-list-page">
    <view class="address-list" v-if="addressList.length > 0">
      <view 
        class="address-item" 
        v-for="item in addressList" 
        :key="item.id"
        @tap="handleSelect(item)"
      >
        <view class="address-info">
          <view class="address-top">
            <text class="name">{{ item.name }}</text>
            <text class="phone">{{ item.mobile }}</text>
            <text class="default-tag" v-if="item.isDefault">默认</text>
          </view>
          <text class="address-detail">
            {{ item.province }}{{ item.city }}{{ item.district }}{{ item.detail }}
          </text>
        </view>
        <view class="address-actions">
          <view class="action-item" @tap.stop="handleSetDefault(item)" v-if="!item.isDefault">
            <text class="action-icon">⭐</text>
            <text class="action-text">设为默认</text>
          </view>
          <view class="action-item" @tap.stop="handleEdit(item)">
            <text class="action-icon">✏️</text>
            <text class="action-text">编辑</text>
          </view>
          <view class="action-item" @tap.stop="handleDelete(item)">
            <text class="action-icon">🗑️</text>
            <text class="action-text">删除</text>
          </view>
        </view>
      </view>
    </view>

    <view class="empty-state" v-else>
      <text class="empty-icon">📦</text>
      <text class="empty-text">暂无收货地址</text>
      <text class="empty-sub">添加一个收货地址吧</text>
    </view>

    <view class="bottom-bar">
      <view class="add-btn" @tap="handleAdd">
        <text class="add-icon">+</text>
        <text>新增收货地址</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Taro, { useDidShow } from '@tarojs/taro'
import { userApi } from '@/api/user'
import type { Address } from '@/api/user'

const addressList = ref<Address[]>([])

const loadAddresses = async () => {
  try {
    const result = await userApi.getAddresses()
    if (Array.isArray(result)) {
      addressList.value = result
    } else if (result && (result as any).records) {
      addressList.value = (result as any).records
    }
  } catch (error) {
    // 接口未实现时使用模拟数据
    addressList.value = [
      {
        id: 1,
        name: '张三',
        mobile: '13800138000',
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detail: '建国路88号SOHO现代城A座1001室',
        isDefault: true
      },
      {
        id: 2,
        name: '李四',
        mobile: '13900139000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detail: '陆家嘴环路1000号恒生银行大厦20层',
        isDefault: false
      }
    ]
  }
}

const handleAdd = () => {
  Taro.navigateTo({ url: '/pages/address/edit/index' })
}

const handleEdit = (item: Address) => {
  Taro.navigateTo({ url: `/pages/address/edit/index?id=${item.id}` })
}

const handleDelete = (item: Address) => {
  Taro.showModal({
    title: '提示',
    content: '确定要删除这个收货地址吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await userApi.deleteAddress(item.id)
          Taro.showToast({ title: '删除成功', icon: 'success' })
          loadAddresses()
        } catch (error) {
          // 模拟删除
          addressList.value = addressList.value.filter(a => a.id !== item.id)
          Taro.showToast({ title: '删除成功', icon: 'success' })
        }
      }
    }
  })
}

const handleSetDefault = async (item: Address) => {
  try {
    await userApi.setDefaultAddress(item.id)
    Taro.showToast({ title: '设置成功', icon: 'success' })
    loadAddresses()
  } catch (error) {
    // 模拟设置默认
    addressList.value.forEach(a => {
      a.isDefault = a.id === item.id
    })
    Taro.showToast({ title: '设置成功', icon: 'success' })
  }
}

const handleSelect = (item: Address) => {
  // 如果是从结算页跳转过来的，选择地址后返回
  const pages = Taro.getCurrentPages()
  if (pages.length > 1) {
    const prevPage = pages[pages.length - 2] as any
    if (prevPage && prevPage.onSelectAddress) {
      prevPage.onSelectAddress(item)
      Taro.navigateBack()
      return
    }
  }
}

onMounted(() => {
  loadAddresses()
})

useDidShow(() => {
  loadAddresses()
})
</script>

<style lang="scss" scoped>
.address-list-page {
  min-height: 100vh;
  background-color: $bg-secondary;
  padding-bottom: 140rpx;
}

.address-list {
  padding: $spacing-md;
}

.address-item {
  background-color: $bg-primary;
  border-radius: $radius-md;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
}

.address-info {
  margin-bottom: $spacing-md;
}

.address-top {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.name {
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
  margin-right: $spacing-md;
}

.phone {
  font-size: $font-size-base;
  color: $text-secondary;
  margin-right: $spacing-sm;
}

.default-tag {
  font-size: $font-size-xs;
  color: $primary-color;
  background-color: rgba(64, 128, 255, 0.1);
  padding: 4rpx 12rpx;
  border-radius: $radius-sm;
}

.address-detail {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.5;
}

.address-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: $spacing-md;
  border-top: 1rpx solid $border-color;
}

.action-item {
  display: flex;
  align-items: center;
  margin-left: $spacing-lg;
}

.action-icon {
  font-size: $font-size-base;
  margin-right: $spacing-xs;
}

.action-text {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: $spacing-md;
}

.empty-text {
  font-size: $font-size-lg;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.empty-sub {
  font-size: $font-size-sm;
  color: $text-tertiary;
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

.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  background-color: $primary-color;
  color: #fff;
  font-size: $font-size-base;
  border-radius: $radius-lg;
}

.add-icon {
  font-size: $font-size-xl;
  margin-right: $spacing-xs;
}
</style>
