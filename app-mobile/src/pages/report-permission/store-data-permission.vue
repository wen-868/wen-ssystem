<template>
  <view class="store-permission-page">
    <!-- 顶部操作栏 -->
    <view class="top-bar">
      <view class="bar-left" @tap="goBack">
        <text class="back-icon">&#xe601;</text>
        <text class="bar-title">门店数据权限</text>
      </view>
      <view class="save-btn" @tap="onSave">
        <text class="save-text">保存</text>
      </view>
    </view>

    <!-- 角色选择 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">选择角色</text>
      </view>
      <view class="role-list">
        <view
          class="role-item"
          :class="{ active: activeRoleId === role.id }"
          v-for="role in roles"
          :key="role.id"
          @tap="selectRole(role.id)"
        >
          <view class="role-radio">
            <view class="radio-inner" v-if="activeRoleId === role.id"></view>
          </view>
          <view class="role-info">
            <text class="role-name">{{ role.name }}</text>
            <text class="role-code">{{ role.code }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 数据范围设置 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">数据范围</text>
      </view>
      <view class="scope-list">
        <view
          class="scope-item"
          :class="{ active: dataScope === 'SELF' }"
          @tap="dataScope = 'SELF'"
        >
          <view class="scope-radio">
            <view class="radio-inner" v-if="dataScope === 'SELF'"></view>
          </view>
          <view class="scope-info">
            <text class="scope-name">仅本店</text>
            <text class="scope-desc">只能查看所属门店的数据</text>
          </view>
        </view>

        <view
          class="scope-item"
          :class="{ active: dataScope === 'ALL' }"
          @tap="dataScope = 'ALL'"
        >
          <view class="scope-radio">
            <view class="radio-inner" v-if="dataScope === 'ALL'"></view>
          </view>
          <view class="scope-info">
            <text class="scope-name">全部门店</text>
            <text class="scope-desc">可以查看所有门店的数据</text>
          </view>
        </view>

        <view
          class="scope-item"
          :class="{ active: dataScope === 'SELECTED' }"
          @tap="dataScope = 'SELECTED'"
        >
          <view class="scope-radio">
            <view class="radio-inner" v-if="dataScope === 'SELECTED'"></view>
          </view>
          <view class="scope-info">
            <text class="scope-name">指定门店</text>
            <text class="scope-desc">自定义选择可查看的门店</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 指定门店选择 -->
    <view class="section" v-if="dataScope === 'SELECTED'">
      <view class="section-header">
        <text class="section-title">选择门店</text>
        <view class="select-all" @tap="toggleSelectAll">
          <text class="select-all-text">{{ isAllSelected ? '取消全选' : '全选' }}</text>
        </view>
      </view>
      <view class="store-list">
        <view
          class="store-item"
          v-for="store in stores"
          :key="store.id"
          @tap="toggleStore(store.id)"
        >
          <view class="store-checkbox" :class="{ checked: selectedStoreIds.includes(store.id) }">
            <text class="check-icon" v-if="selectedStoreIds.includes(store.id)">&#xe603;</text>
          </view>
          <view class="store-info">
            <text class="store-name">{{ store.name }}</text>
            <text class="store-code">{{ store.code }}</text>
            <text class="store-address" v-if="store.address">{{ store.address }}</text>
          </view>
        </view>
      </view>
      <view class="selected-count">
        <text class="count-text">已选择 {{ selectedStoreIds.length }} 个门店</text>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  reportPermissionApi,
  type RoleItem,
  type StoreInfo,
} from '@/api/modules/report-permission'

const roles = ref<RoleItem[]>([])
const stores = ref<StoreInfo[]>([])
const activeRoleId = ref<number>(0)
const dataScope = ref<'SELF' | 'ALL' | 'SELECTED'>('SELF')
const selectedStoreIds = ref<number[]>([])

const isAllSelected = computed(() => {
  return stores.value.length > 0 && selectedStoreIds.value.length === stores.value.length
})

function selectRole(roleId: number) {
  activeRoleId.value = roleId
  loadStorePermission(roleId)
}

function toggleStore(storeId: number) {
  const idx = selectedStoreIds.value.indexOf(storeId)
  if (idx >= 0) {
    selectedStoreIds.value.splice(idx, 1)
  } else {
    selectedStoreIds.value.push(storeId)
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedStoreIds.value = []
  } else {
    selectedStoreIds.value = stores.value.map(s => s.id)
  }
}

async function loadStorePermission(roleId: number) {
  try {
    const data = await reportPermissionApi.getStoreDataPermission(roleId)
    dataScope.value = data.scope
    selectedStoreIds.value = data.storeIds || []
  } catch (err) {
    console.error('加载门店数据权限失败:', err)
  }
}

async function onSave() {
  try {
    await reportPermissionApi.saveStoreDataPermission({
      roleId: activeRoleId.value,
      scope: dataScope.value,
      storeIds: dataScope.value === 'SELECTED' ? selectedStoreIds.value : [],
    })
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch (err) {
    console.error('保存失败:', err)
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

function goBack() {
  uni.navigateBack()
}

async function loadData() {
  try {
    const [rolesData, storesData] = await Promise.all([
      reportPermissionApi.getRoles(),
      reportPermissionApi.getStores(),
    ])
    roles.value = rolesData
    stores.value = storesData
    if (rolesData.length > 0) {
      activeRoleId.value = rolesData[0].id
      loadStorePermission(rolesData[0].id)
    }
  } catch (err) {
    console.error('加载数据失败:', err)
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.store-permission-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 24rpx;
  padding-top: calc(16rpx + env(safe-area-inset-top));
  background: #fff;
  border-bottom: 1rpx solid #f0f0f0;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.back-icon {
  font-size: 32rpx;
  color: #333;
}

.bar-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.save-btn {
  padding: 12rpx 24rpx;
  background: #1677FF;
  border-radius: 32rpx;
}

.save-text {
  font-size: 26rpx;
  color: #fff;
}

.section {
  margin: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.select-all {
  padding: 8rpx 16rpx;
}

.select-all-text {
  font-size: 26rpx;
  color: #1677FF;
}

.role-list,
.scope-list {
  padding: 8rpx 0;
}

.role-item,
.scope-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  gap: 16rpx;
}

.role-radio,
.scope-radio {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #d9d9d9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.role-item.active .role-radio,
.scope-item.active .scope-radio {
  border-color: #1677FF;
}

.radio-inner {
  width: 20rpx;
  height: 20rpx;
  background: #1677FF;
  border-radius: 50%;
}

.role-info,
.scope-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.role-name,
.scope-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.role-code {
  font-size: 22rpx;
  color: #999;
}

.scope-desc {
  font-size: 24rpx;
  color: #999;
}

.store-list {
  max-height: 500rpx;
  overflow-y: auto;
}

.store-item {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  gap: 16rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.store-item:last-child {
  border-bottom: none;
}

.store-checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #d9d9d9;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.store-checkbox.checked {
  background: #1677FF;
  border-color: #1677FF;
}

.check-icon {
  font-size: 24rpx;
  color: #fff;
}

.store-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}

.store-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.store-code {
  font-size: 22rpx;
  color: #999;
}

.store-address {
  font-size: 22rpx;
  color: #bbb;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-count {
  padding: 16rpx 24rpx;
  border-top: 1rpx solid #f5f5f5;
  text-align: center;
}

.count-text {
  font-size: 24rpx;
  color: #999;
}

.safe-bottom {
  height: 40rpx;
}
</style>
