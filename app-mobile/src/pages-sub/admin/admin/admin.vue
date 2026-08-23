<template>
  <view class="admin-page">
    <page-header title="工作台" @back="goBack" />

    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索员工 / 角色 / 权限"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
        </view>
      </view>
    </form>

    <view class="quick-actions">
      <view class="action-item" @tap="goTo('employees')">
        <view class="action-icon action-icon--user"><image class="ic" src="/static/icons/ic/user.svg" mode="aspectFit"/></view>
        <text class="action-text">员工管理</text>
      </view>
      <view class="action-item" @tap="goTo('roles')">
        <view class="action-icon action-icon--role"><image class="ic" src="/static/icons/ic/users.svg" mode="aspectFit"/></view>
        <text class="action-text">角色权限</text>
      </view>
      <view class="action-item" @tap="goTo('stores')">
        <view class="action-icon action-icon--store"><image class="ic" src="/static/icons/ic/store.svg" mode="aspectFit"/></view>
        <text class="action-text">门店管理</text>
      </view>
      <view class="action-item" @tap="goTo('settings')">
        <view class="action-icon action-icon--setting"><image class="ic" src="/static/icons/ic/gear.svg" mode="aspectFit"/></view>
        <text class="action-text">系统设置</text>
      </view>
    </view>

    <view class="employee-section">
      <view class="section-title">
        <text>员工列表</text>
        <text class="title-add" @tap="goAddEmployee">+ 添加</text>
      </view>
      <view class="employee-list">
        <view class="employee-card" v-for="item in employeeList" :key="item.id">
          <view class="employee-avatar">
            <text class="avatar-text">{{ item.name?.charAt(0) || '员' }}</text>
          </view>
          <view class="employee-info">
            <text class="employee-name">{{ item.name }}</text>
            <text class="employee-role">{{ item.roleName }} · {{ item.storeName }}</text>
          </view>
          <view class="employee-status" :class="'status-' + item.status">
            <text class="status-text">{{ item.statusLabel }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="setting-list">
      <view class="setting-item" @tap="goTo('basic')">
        <view class="setting-left">
          <view class="setting-icon setting-icon--basic"><image class="ic" src="/static/icons/ic/sliders.svg" mode="aspectFit"/></view>
          <text class="setting-text">基本设置</text>
        </view>
        <image class="setting-arrow ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/>
      </view>
      <view class="setting-item" @tap="goTo('notification')">
        <view class="setting-left">
          <view class="setting-icon setting-icon--notify"><image class="ic" src="/static/icons/ic/bell.svg" mode="aspectFit"/></view>
          <text class="setting-text">通知设置</text>
        </view>
        <image class="setting-arrow ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/>
      </view>
      <view class="setting-item" @tap="goTo('logs')">
        <view class="setting-left">
          <view class="setting-icon setting-icon--log"><image class="ic" src="/static/icons/ic/file.svg" mode="aspectFit"/></view>
          <text class="setting-text">操作日志</text>
        </view>
        <image class="setting-arrow ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/>
      </view>
      <view class="setting-item" @tap="goTo('about')">
        <view class="setting-left">
          <view class="setting-icon setting-icon--about"><image class="ic" src="/static/icons/ic/info.svg" mode="aspectFit"/></view>
          <text class="setting-text">关于系统</text>
        </view>
        <image class="setting-arrow ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goBack(){ uni.navigateBack() }

import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { employeeApi, type Employee } from '@/api/modules/employees'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const employeeList = ref<Employee[]>([])
const loading = ref(false)

function onSearch() { loadEmployees() }
function clearSearch() { searchForm.keyword = ''; loadEmployees() }

function goTo(page: string) {
  if (page === 'employees') {
    uni.navigateTo({ url: '/pages-sub/admin/admin/employees' })
  } else if (page === 'roles') {
    uni.navigateTo({ url: '/pages-sub/admin/roles/roles' })
  } else if (page === 'stores') {
    uni.navigateTo({ url: '/pages-sub/admin/stores/stores' })
  } else if (page === 'logs') {
    uni.navigateTo({ url: '/pages-sub/admin/system/operation-logs' })
  } else if (page === 'settings') {
    uni.navigateTo({ url: '/pages-sub/settings/settings?tab=company' })
  } else if (page === 'basic') {
    uni.navigateTo({ url: '/pages-sub/settings/settings?tab=basic' })
  } else if (page === 'notification') {
    uni.navigateTo({ url: '/pages-sub/settings/settings?tab=notification' })
  } else if (page === 'about') {
    uni.navigateTo({ url: '/pages-sub/settings/settings?tab=about' })
  } else {
    uni.showToast({ title: '暂不支持', icon: 'none' })
  }
}
function goAddEmployee() {
  uni.navigateTo({ url: '/pages-sub/admin/admin/employees' })
}

async function loadEmployees() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await employeeApi.getEmployees({
      keyword: searchForm.keyword || undefined,
      page: 1,
      pageSize: 20,
    })
    employeeList.value = (result.records || []).map((item) => ({
      ...item,
      statusLabel: item.status === 'active' ? '在职' : '停用',
    }))
  } catch (err) {
    console.error('加载员工列表失败:', err)
    uni.showToast({ title: '员工加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadEmployees() })
</script>

<style lang="scss" scoped>
.admin-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: $uni-bg-color;
}
.header-title { font-size: 34rpx; font-weight: 700; color: $uni-gray-700; }
.search-bar { padding: 16rpx 24rpx; background: $uni-bg-color; }
.search-input-wrap {
  display: flex; align-items: center;
  height: 72rpx; background: $uni-bg-color-page;
  border-radius: 36rpx; padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: $uni-gray-400; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: $uni-gray-700; }
.search-placeholder { color: $uni-gray-300; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: $uni-gray-300; padding: 4rpx; }
.quick-actions {
  display: flex;
  justify-content: space-around;
  padding: 24rpx;
  background: $uni-bg-color;
  margin-bottom: 16rpx;
}
.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}
.action-icon {
  width: 80rpx; height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: $uni-text-color-inverse;
}
.action-icon--user { background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary); }
.action-icon--role { background: linear-gradient(135deg, $uni-color-purple, $uni-color-purple-light); }
.action-icon--store { background: linear-gradient(135deg, $uni-color-warning, $uni-color-warning); }
.action-icon--setting { background: linear-gradient(135deg, $uni-color-success, $uni-color-success); }
.action-text { font-size: 22rpx; color: $uni-gray-700; }
.employee-section { padding: 0 32rpx 24rpx; }
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title-add { font-size: 24rpx; color: $uni-color-primary; font-weight: 400; }
.employee-list {
  background: $uni-bg-color;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.employee-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.employee-card:last-child { border-bottom: none; }
.employee-avatar {
  width: 72rpx; height: 72rpx;
  border-radius: 36rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-text { font-size: 30rpx; color: $uni-text-color-inverse; font-weight: 600; }
.employee-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}
.employee-name { font-size: 28rpx; color: $uni-gray-700; font-weight: 500; }
.employee-role { font-size: 22rpx; color: $uni-gray-400; }
.employee-status {
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
  flex-shrink: 0;
}
.status-active { background: $uni-color-success-soft; }
.status-active .status-text { color: $uni-color-success; }
.status-inactive { background: $uni-bg-color-grey; }
.status-inactive .status-text { color: $uni-gray-400; }
.status-text { font-size: 20rpx; }
.setting-list {
  margin: 0 24rpx;
  background: $uni-bg-color;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.setting-item:last-child { border-bottom: none; }
.setting-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.setting-icon {
  width: 56rpx; height: 56rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: $uni-text-color-inverse;
}
.setting-icon--basic { background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary); }
.setting-icon--notify { background: linear-gradient(135deg, $uni-color-warning, $uni-color-warning); }
.setting-icon--log { background: linear-gradient(135deg, $uni-color-purple, $uni-color-purple-light); }
.setting-icon--about { background: linear-gradient(135deg, $uni-color-success, $uni-color-success); }
.setting-text { font-size: 28rpx; color: $uni-gray-700; }
.setting-arrow { font-size: 24rpx; color: $uni-gray-300; }
.safe-bottom { height: 40rpx; }
</style>
