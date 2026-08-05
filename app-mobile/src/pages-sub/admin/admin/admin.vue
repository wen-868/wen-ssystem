<template>
  <view class="admin-page">
    <view class="page-header">
      <text class="header-title">管理后台</text>
    </view>

    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <text class="search-icon">&#xe614;</text>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索员工 / 角色 / 权限"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
        </view>
      </view>
    </form>

    <view class="quick-actions">
      <view class="action-item" @tap="goTo('employees')">
        <view class="action-icon action-icon--user">&#xe616;</view>
        <text class="action-text">员工管理</text>
      </view>
      <view class="action-item" @tap="goTo('roles')">
        <view class="action-icon action-icon--role">&#xe619;</view>
        <text class="action-text">角色权限</text>
      </view>
      <view class="action-item" @tap="goTo('stores')">
        <view class="action-icon action-icon--store">&#xe61a;</view>
        <text class="action-text">门店管理</text>
      </view>
      <view class="action-item" @tap="goTo('settings')">
        <view class="action-icon action-icon--setting">&#xe61b;</view>
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
          <view class="setting-icon setting-icon--basic">&#xe61c;</view>
          <text class="setting-text">基本设置</text>
        </view>
        <text class="setting-arrow">&#xe612;</text>
      </view>
      <view class="setting-item" @tap="goTo('notification')">
        <view class="setting-left">
          <view class="setting-icon setting-icon--notify">&#xe61d;</view>
          <text class="setting-text">通知设置</text>
        </view>
        <text class="setting-arrow">&#xe612;</text>
      </view>
      <view class="setting-item" @tap="goTo('logs')">
        <view class="setting-left">
          <view class="setting-icon setting-icon--log">&#xe61e;</view>
          <text class="setting-text">操作日志</text>
        </view>
        <text class="setting-arrow">&#xe612;</text>
      </view>
      <view class="setting-item" @tap="goTo('about')">
        <view class="setting-left">
          <view class="setting-icon setting-icon--about">&#xe61f;</view>
          <text class="setting-text">关于系统</text>
        </view>
        <text class="setting-arrow">&#xe612;</text>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'

const formRef = ref<any>(null)
const searchForm = reactive({ keyword: '' })
const searchRules: Rules = {
  keyword: [{ minLength: 1, message: '输入至少1个字符', required: false }],
}
const { errors, validate, clearError } = useFormValidation(searchForm, searchRules)

const employeeList = ref<any[]>([])

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
  } else {
    // 系统设置/基本设置/通知设置/关于系统暂无独立页面，按项目标准提示开发中
    uni.showToast({ title: '该功能开发中', icon: 'none' })
  }
}
function goAddEmployee() {
  uni.navigateTo({ url: '/pages-sub/admin/admin/employees' })
}

async function loadEmployees() {
  try {
    employeeList.value = []
  } catch (err) {
    console.error('加载员工列表失败:', err)
  }
}

onMounted(() => { loadEmployees() })
</script>

<style scoped>
.admin-page { min-height: 100vh; background: #f0f5ff; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top));
  background: #fff;
}
.header-title { font-size: 34rpx; font-weight: 700; color: #333; }
.search-bar { padding: 16rpx 24rpx; background: #fff; }
.search-input-wrap {
  display: flex; align-items: center;
  height: 72rpx; background: #f5f7fa;
  border-radius: 36rpx; padding: 0 24rpx;
}
.search-icon { font-size: 32rpx; color: #999; margin-right: 12rpx; }
.search-input { flex: 1; font-size: 28rpx; color: #333; }
.search-placeholder { color: #bbb; font-size: 26rpx; }
.search-clear { font-size: 32rpx; color: #bbb; padding: 4rpx; }
.quick-actions {
  display: flex;
  justify-content: space-around;
  padding: 24rpx;
  background: #fff;
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
  color: #fff;
}
.action-icon--user { background: linear-gradient(135deg, #1677FF, #4096ff); }
.action-icon--role { background: linear-gradient(135deg, #722ed1, #9254de); }
.action-icon--store { background: linear-gradient(135deg, #fa8c16, #ffa940); }
.action-icon--setting { background: linear-gradient(135deg, #52c41a, #73d13d); }
.action-text { font-size: 22rpx; color: #333; }
.employee-section { padding: 0 24rpx 24rpx; }
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title-add { font-size: 24rpx; color: #1677FF; font-weight: 400; }
.employee-list {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.employee-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.employee-card:last-child { border-bottom: none; }
.employee-avatar {
  width: 72rpx; height: 72rpx;
  border-radius: 36rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-text { font-size: 30rpx; color: #fff; font-weight: 600; }
.employee-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}
.employee-name { font-size: 28rpx; color: #333; font-weight: 500; }
.employee-role { font-size: 22rpx; color: #999; }
.employee-status {
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
  flex-shrink: 0;
}
.status-active { background: #f6ffed; }
.status-active .status-text { color: #52c41a; }
.status-inactive { background: #f5f5f5; }
.status-inactive .status-text { color: #999; }
.status-text { font-size: 20rpx; }
.setting-list {
  margin: 0 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
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
  color: #fff;
}
.setting-icon--basic { background: linear-gradient(135deg, #1677FF, #4096ff); }
.setting-icon--notify { background: linear-gradient(135deg, #fa8c16, #ffa940); }
.setting-icon--log { background: linear-gradient(135deg, #722ed1, #9254de); }
.setting-icon--about { background: linear-gradient(135deg, #52c41a, #73d13d); }
.setting-text { font-size: 28rpx; color: #333; }
.setting-arrow { font-size: 24rpx; color: #ccc; }
.safe-bottom { height: 40rpx; }
</style>
