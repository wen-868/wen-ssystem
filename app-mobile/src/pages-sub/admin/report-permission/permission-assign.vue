<template>
  <view class="permission-assign-page">
    <!-- 顶部操作栏 -->
    <view class="top-bar">
      <view class="bar-left" @tap="goBack">
        <image class="back-icon ic" src="/static/icons/ic/user.svg" mode="aspectFit"/>
        <text class="bar-title">权限分配</text>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <image class="search-icon ic" src="/static/icons/ic/chevron-left.svg" mode="aspectFit"/>
        <input
          class="search-input"
          type="text"
          v-model="keyword"
          placeholder="搜索用户姓名/账号"
          @confirm="onSearch"
        />
      </view>
      <view class="search-btn" @tap="onSearch">搜索</view>
    </view>

    <!-- 用户列表 -->
    <scroll-view class="user-scroll" scroll-y v-if="!selectedUser">
      <view class="user-list">
        <view class="user-card" v-for="user in userList" :key="user.id" @tap="selectUser(user)">
          <view class="user-avatar">
            <text class="avatar-text">{{ user.name.charAt(0) }}</text>
          </view>
          <view class="user-info">
            <text class="user-name">{{ user.name }}</text>
            <text class="user-account">{{ user.username }}</text>
            <view class="user-meta">
              <text class="meta-tag" v-if="user.roleNames">{{ user.roleNames }}</text>
              <text class="meta-store" v-if="user.storeName">{{ user.storeName }}</text>
            </view>
          </view>
          <view class="user-arrow"><image class="ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/></view>
        </view>
      </view>

      <view class="empty-state" v-if="userList.length === 0 && !loading">
        <text class="empty-text">暂无用户</text>
      </view>

      <view class="load-more" v-if="userList.length > 0">
        <text class="load-more-text" v-if="loading">加载中...</text>
        <text class="load-more-text" v-else-if="noMore">-- 没有更多了 --</text>
      </view>
    </scroll-view>

    <!-- 权限分配详情 -->
    <scroll-view class="assign-detail" scroll-y v-if="selectedUser">
      <!-- 用户信息 -->
      <view class="user-card-detail">
        <view class="user-avatar-lg">
          <text class="avatar-text-lg">{{ selectedUser.name.charAt(0) }}</text>
        </view>
        <view class="user-info-detail">
          <text class="user-name-detail">{{ selectedUser.name }}</text>
          <text class="user-account-detail">{{ selectedUser.username }}</text>
          <text class="user-phone" v-if="selectedUser.phone">{{ selectedUser.phone }}</text>
        </view>
        <view class="change-user" @tap="selectedUser = null">
          <text class="change-text">更换用户</text>
        </view>
      </view>

      <!-- 分配角色 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">分配角色</text>
          <text class="section-tip">可多选</text>
        </view>
        <view class="role-checkbox-list">
          <view
            class="role-checkbox-item"
            v-for="role in roles"
            :key="role.id"
            @tap="toggleRole(role.id)"
          >
            <view class="checkbox" :class="{ checked: selectedRoleIds.includes(role.id) }">
              <image class="check-icon ic" v-if="selectedRoleIds.includes(role.id)" src="/static/icons/ic/eye.svg" mode="aspectFit"/>
            </view>
            <view class="role-info">
              <text class="role-name">{{ role.name }}</text>
              <text class="role-remark" v-if="role.remark">{{ role.remark }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 额外权限 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">额外权限</text>
          <text class="section-tip">在角色权限基础上追加</text>
        </view>
        <view class="extra-perm-list">
          <view
            class="extra-perm-item"
            v-for="perm in extraPermissions"
            :key="perm.value"
            @tap="toggleExtraPerm(perm.value)"
          >
            <view class="checkbox" :class="{ checked: selectedExtraPerms.includes(perm.value) }">
              <image class="check-icon ic" v-if="selectedExtraPerms.includes(perm.value)" src="/static/icons/ic/eye.svg" mode="aspectFit"/>
            </view>
            <view class="perm-info">
              <text class="perm-name">{{ perm.label }}</text>
              <text class="perm-desc">{{ perm.desc }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 数据范围 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">数据范围</text>
        </view>
        <view class="scope-options">
          <view
            class="scope-option"
            :class="{ active: userDataScope === 'SELF' }"
            @tap="userDataScope = 'SELF'"
          >
            <view class="radio">
              <view class="radio-inner" v-if="userDataScope === 'SELF'"></view>
            </view>
            <text class="scope-text">仅本店</text>
          </view>
          <view
            class="scope-option"
            :class="{ active: userDataScope === 'ALL' }"
            @tap="userDataScope = 'ALL'"
          >
            <view class="radio">
              <view class="radio-inner" v-if="userDataScope === 'ALL'"></view>
            </view>
            <text class="scope-text">全部门店</text>
          </view>
          <view
            class="scope-option"
            :class="{ active: userDataScope === 'SELECTED' }"
            @tap="userDataScope = 'SELECTED'"
          >
            <view class="radio">
              <view class="radio-inner" v-if="userDataScope === 'SELECTED'"></view>
            </view>
            <text class="scope-text">指定门店</text>
          </view>
        </view>

        <!-- 门店选择 -->
        <view class="store-select-wrap" v-if="userDataScope === 'SELECTED'">
          <view class="store-select-header">
            <text class="store-select-title">选择门店</text>
            <text class="store-count">已选 {{ userStoreIds.length }} 个</text>
          </view>
          <view class="store-tags">
            <view
              class="store-tag"
              v-for="store in stores"
              :key="store.id"
              :class="{ active: userStoreIds.includes(store.id) }"
              @tap="toggleUserStore(store.id)"
            >
              <text class="tag-text">{{ store.name }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="safe-bottom"></view>
    </scroll-view>

    <!-- 底部保存按钮 -->
    <view class="bottom-bar" v-if="selectedUser">
      <view class="save-btn" @tap="onSave">
        <text class="save-text">保存分配</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  reportPermissionApi,
  type UserInfo,
  type RoleItem,
  type StoreInfo,
} from '@/api/modules/report-permission'

const keyword = ref('')
const userList = ref<UserInfo[]>([])
const roles = ref<RoleItem[]>([])
const stores = ref<StoreInfo[]>([])
const selectedUser = ref<UserInfo | null>(null)
const selectedRoleIds = ref<number[]>([])
const selectedExtraPerms = ref<string[]>([])
const userDataScope = ref<'SELF' | 'ALL' | 'SELECTED'>('SELF')
const userStoreIds = ref<number[]>([])
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const noMore = ref(false)

const extraPermissions = [
  { value: 'report:export:all', label: '所有报表导出', desc: '可导出所有报表数据' },
  { value: 'report:export:sales', label: '销售报表导出', desc: '仅可导出销售类报表' },
  { value: 'report:export:finance', label: '财务报表导出', desc: '仅可导出财务类报表' },
  { value: 'report:export:inventory', label: '库存报表导出', desc: '仅可导出库存类报表' },
]

function onSearch() {
  page.value = 1
  userList.value = []
  noMore.value = false
  loadUsers()
}

async function loadUsers() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await reportPermissionApi.getUsers({
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize,
    })
    if (page.value === 1) {
      userList.value = result.list
    } else {
      userList.value = [...userList.value, ...result.list]
    }
    noMore.value = result.list.length < pageSize
  } catch (err) {
    console.error('加载用户列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function selectUser(user: UserInfo) {
  selectedUser.value = user
  try {
    const data = await reportPermissionApi.getUserPermission(user.id)
    selectedRoleIds.value = data.roles.map(r => r.id)
    selectedExtraPerms.value = data.extraPermissions || []
    userDataScope.value = data.dataScope
    userStoreIds.value = data.storeIds || []
  } catch (err) {
    console.error('加载用户权限失败:', err)
  }
}

function toggleRole(roleId: number) {
  const idx = selectedRoleIds.value.indexOf(roleId)
  if (idx >= 0) {
    selectedRoleIds.value.splice(idx, 1)
  } else {
    selectedRoleIds.value.push(roleId)
  }
}

function toggleExtraPerm(perm: string) {
  const idx = selectedExtraPerms.value.indexOf(perm)
  if (idx >= 0) {
    selectedExtraPerms.value.splice(idx, 1)
  } else {
    selectedExtraPerms.value.push(perm)
  }
}

function toggleUserStore(storeId: number) {
  const idx = userStoreIds.value.indexOf(storeId)
  if (idx >= 0) {
    userStoreIds.value.splice(idx, 1)
  } else {
    userStoreIds.value.push(storeId)
  }
}

async function onSave() {
  if (!selectedUser.value) return

  try {
    await reportPermissionApi.saveUserPermission({
      userId: selectedUser.value.id,
      roleIds: selectedRoleIds.value,
      extraPermissions: selectedExtraPerms.value,
      dataScope: userDataScope.value,
      storeIds: userDataScope.value === 'SELECTED' ? userStoreIds.value : [],
    })
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => {
      selectedUser.value = null
      loadUsers()
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
  } catch (err) {
    console.error('加载数据失败:', err)
  }
}

onMounted(() => {
  loadData()
  loadUsers()
})
</script>

<style lang="scss" scoped>
.permission-assign-page {
  min-height: 100vh;
  background: $uni-bg-color-grey;
  display: flex;
  flex-direction: column;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 24rpx;
  padding-top: calc(16rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
  border-bottom: 1rpx solid $uni-gray-100;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.back-icon {
  font-size: 32rpx;
  color: $uni-gray-700;
}

.bar-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.search-bar {
  display: flex;
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
  border-bottom: 1rpx solid $uni-gray-100;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: $uni-bg-color-grey;
  border-radius: 32rpx;
  padding: 0 24rpx;
}

.search-icon {
  font-size: 28rpx;
  color: $uni-gray-400;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  height: 64rpx;
  font-size: 28rpx;
}

.search-btn {
  margin-left: 16rpx;
  padding: 0 32rpx;
  height: 64rpx;
  background: $uni-color-primary;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn text {
  font-size: 28rpx;
  color: $uni-text-color-inverse;
}

.user-scroll {
  flex: 1;
  padding: 16rpx 24rpx;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.user-card {
  display: flex;
  align-items: center;
  background: $uni-bg-color;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.user-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 32rpx;
  color: $uni-text-color-inverse;
  font-weight: 600;
}

.user-info {
  flex: 1;
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.user-name {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.user-account {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.user-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 4rpx;
}

.meta-tag {
  font-size: 20rpx;
  color: $uni-color-primary;
  background: rgba(22, 119, 255, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.meta-store {
  font-size: 20rpx;
  color: $uni-gray-500;
  background: $uni-bg-color-grey;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.user-arrow {
  font-size: 28rpx;
  color: $uni-gray-300;
  flex-shrink: 0;
}

.assign-detail {
  flex: 1;
  padding-bottom: 120rpx;
}

.user-card-detail {
  display: flex;
  align-items: center;
  background: $uni-bg-color;
  padding: 32rpx 24rpx;
  margin-bottom: 16rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}

.user-avatar-lg {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text-lg {
  font-size: 40rpx;
  color: $uni-text-color-inverse;
  font-weight: 600;
}

.user-info-detail {
  flex: 1;
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.user-name-detail {
  font-size: 34rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.user-account-detail {
  font-size: 26rpx;
  color: $uni-gray-400;
}

.user-phone {
  font-size: 24rpx;
  color: $uni-gray-500;
}

.change-user {
  padding: 12rpx 24rpx;
  border: 1rpx solid $uni-color-primary;
  border-radius: 24rpx;
  flex-shrink: 0;
}

.change-text {
  font-size: 24rpx;
  color: $uni-color-primary;
}

.section {
  margin: 0 24rpx 16rpx;
  background: $uni-bg-color;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.section-tip {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.role-checkbox-list,
.extra-perm-list {
  padding: 8rpx 0;
}

.role-checkbox-item,
.extra-perm-item {
  display: flex;
  align-items: flex-start;
  padding: 20rpx 24rpx;
  gap: 16rpx;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid $uni-gray-300;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4rpx;
}

.checkbox.checked {
  background: $uni-color-primary;
  border-color: $uni-color-primary;
}

.check-icon {
  font-size: 24rpx;
  color: $uni-text-color-inverse;
}

.role-info,
.perm-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.role-name,
.perm-name {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
}

.role-remark,
.perm-desc {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.scope-options {
  display: flex;
  padding: 16rpx 24rpx;
  gap: 24rpx;
}

.scope-option {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.radio {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid $uni-gray-300;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.scope-option.active .radio {
  border-color: $uni-color-primary;
}

.radio-inner {
  width: 18rpx;
  height: 18rpx;
  background: $uni-color-primary;
  border-radius: 50%;
}

.scope-text {
  font-size: 26rpx;
  color: $uni-gray-700;
}

.store-select-wrap {
  padding: 0 24rpx 24rpx;
  border-top: 1rpx solid $uni-bg-color-grey;
}

.store-select-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
}

.store-select-title {
  font-size: 26rpx;
  color: $uni-gray-500;
  font-weight: 500;
}

.store-count {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.store-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.store-tag {
  padding: 12rpx 24rpx;
  background: $uni-bg-color-grey;
  border-radius: 24rpx;
  border: 1rpx solid transparent;
}

.store-tag.active {
  background: rgba(22, 119, 255, 0.1);
  border-color: $uni-color-primary;
}

.tag-text {
  font-size: 24rpx;
  color: $uni-gray-500;
}

.store-tag.active .tag-text {
  color: $uni-color-primary;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

.load-more {
  text-align: center;
  padding: 24rpx 0;
}

.load-more-text {
  font-size: 24rpx;
  color: $uni-gray-300;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: $uni-bg-color;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.04);
  z-index: 100;
}

.save-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.save-text {
  font-size: 30rpx;
  color: $uni-text-color-inverse;
  font-weight: 600;
}

.safe-bottom {
  height: 40rpx;
}
</style>
