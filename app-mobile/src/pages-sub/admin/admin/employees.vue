<template>
  <view class="employees-page">
    <page-header title="员工管理" @back="goBack" />

    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <image class="search-icon ic" src="/static/icons/ic/search.svg" mode="aspectFit"/>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索员工姓名 / 手机号"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <image class="search-clear ic" v-if="searchForm.keyword" @tap="clearSearch" src="/static/icons/ic/clear.svg" mode="aspectFit"/>
        </view>
      </view>
    </form>

    <view class="filter-bar">
      <view
        v-for="item in filterOptions"
        :key="item.value"
        class="filter-item"
        :class="{ 'filter-item--active': activeFilter === item.value }"
        @tap="activeFilter = item.value"
      >
        <text class="filter-text">{{ item.label }}</text>
      </view>
    </view>

    <view class="add-section">
      <button class="add-btn" @tap="goAddEmployee">
        <text>+ 添加员工</text>
      </button>
    </view>

    <scroll-view class="employee-list" scroll-y v-if="list.length > 0">
      <view class="employee-card" v-for="item in list" :key="item.id">
        <view class="card-header">
          <view class="employee-avatar">
            <text class="avatar-text">{{ item.name?.charAt(0) || '员' }}</text>
          </view>
          <view class="employee-info">
            <text class="employee-name">{{ item.name }}</text>
            <text class="employee-phone">{{ item.phone }}</text>
          </view>
          <view class="employee-status" :class="'status-' + item.status">
            <text class="status-text">{{ item.status === 'active' ? '在职' : '离职' }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">岗位</text>
            <text class="info-value">{{ item.roleName || '-' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">门店</text>
            <text class="info-value">{{ item.storeName || '-' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">入职时间</text>
            <text class="info-value">{{ item.hireDate || '-' }}</text>
          </view>
        </view>
        <view class="card-actions">
          <button class="mini-btn" @tap="viewDetail(item)">详情</button>
          <button class="mini-btn primary" @tap="editEmployee(item)">编辑</button>
          <button
            class="mini-btn danger"
            @tap="toggleStatus(item)"
            v-if="item.status === 'active'"
          >
            离职
          </button>
          <button
            class="mini-btn success"
            @tap="toggleStatus(item)"
            v-else
          >
            复职
          </button>
        </view>
      </view>
    </scroll-view>

    <view class="empty-state" v-else>
      <image class="empty-icon ic" src="/static/icons/ic/empty.svg" mode="aspectFit"/>
      <text class="empty-text">暂无员工数据</text>
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

const filterOptions = [
  { label: '全部', value: '' },
  { label: '在职', value: 'active' },
  { label: '离职', value: 'inactive' },
]
const activeFilter = ref('')
const list = ref<Employee[]>([])
const loading = ref(false)

function onSearch() { loadEmployees() }
function clearSearch() { searchForm.keyword = ''; loadEmployees() }

function goAddEmployee() {
  uni.showModal({
    title: '添加员工',
    editable: true,
    placeholderText: '请输入员工姓名',
    success: async (res) => {
      if (res.confirm && res.content) {
        try {
          await employeeApi.addEmployee({ name: res.content, phone: '' })
          uni.showToast({ title: '添加成功', icon: 'success' })
          loadEmployees()
        } catch (err) {
          uni.showToast({ title: '添加失败', icon: 'error' })
        }
      }
    }
  })
}

function viewDetail(item: Employee) {
  uni.showModal({
    title: item.name + '的详情',
    content: `岗位：${item.roleName || '未设置'}\n门店：${item.storeName || '未分配'}\n入职时间：${item.hireDate || '未知'}\n状态：${item.status === 'active' ? '在职' : '离职'}`,
    showCancel: false,
  })
}

function editEmployee(item: Employee) {
  uni.showModal({
    title: '编辑员工',
    editable: true,
    placeholderText: '请输入新的岗位名称',
    success: async (res) => {
      if (res.confirm && res.content) {
        try {
          await employeeApi.updateEmployee(item.id, { roleName: res.content })
          uni.showToast({ title: '编辑成功', icon: 'success' })
          loadEmployees()
        } catch (err) {
          uni.showToast({ title: '编辑失败', icon: 'error' })
        }
      }
    }
  })
}

function toggleStatus(item: Employee) {
  const action = item.status === 'active' ? '离职' : '复职'
  uni.showModal({
    title: `${action}确认`,
    content: `确定要将${item.name}${action}吗？`,
    success: async (res) => {
      if (res.confirm) {
        if (item.status === 'active') {
          try {
            await employeeApi.toggleStatus(item.id, 'inactive')
            item.status = 'inactive'
            uni.showToast({ title: '离职成功', icon: 'success' })
          } catch (err) {
            uni.showToast({ title: '离职失败', icon: 'error' })
          }
        } else {
          try {
            await employeeApi.toggleStatus(item.id, 'active')
            item.status = 'active'
            uni.showToast({ title: '复职成功', icon: 'success' })
          } catch (err) {
            uni.showToast({ title: '复职失败', icon: 'error' })
          }
        }
      }
    }
  })
}

async function loadEmployees() {
  loading.value = true
  try {
    const params: any = {}
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (activeFilter.value) params.status = activeFilter.value
    
    const result = await employeeApi.getEmployees(params)
    list.value = result.records
  } catch (err) {
    console.error('加载员工列表失败:', err)
    uni.showToast({ title: '加载失败', icon: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadEmployees() })
</script>

<style lang="scss" scoped>
.employees-page { min-height: 100vh; background: $uni-color-primary-soft; }
.page-header {
  padding: 24rpx 32rpx;
  padding-top: calc(24rpx + var(--safe-top));
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
.filter-bar {
  display: flex;
  padding: 16rpx 24rpx;
  background: $uni-bg-color;
  gap: 16rpx;
}
.filter-item {
  padding: $uni-spacing-xs $uni-spacing-base;
  background: $uni-bg-color-page;
  border-radius: $uni-border-radius-sm;
}
.filter-item--active { background: $uni-color-primary; }
.filter-item--active .filter-text { color: $uni-text-color-inverse; }
.filter-text { font-size: 24rpx; color: $uni-gray-500; }
.add-section { padding: $uni-spacing-sm $uni-spacing-lg; }
.add-btn {
  width: 100%;
  height: 80rpx;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-text-color-inverse;
  border: none;
}
.add-btn::after { border: none; }
.employee-list { padding: 0 $uni-spacing-lg $uni-spacing-base; }
.employee-card {
  background: $uni-bg-color;
  border-radius: $uni-border-radius-xs;
  padding: $uni-spacing-base;
  margin-bottom: $uni-spacing-md;
  box-shadow: $uni-shadow-card-sm;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}
.employee-avatar {
  width: 80rpx; height: 80rpx;
  border-radius: $uni-border-radius-lg;
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-text { font-size: 32rpx; color: $uni-text-color-inverse; font-weight: 600; }
.employee-info {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 6rpx;
}
.employee-name { font-size: 28rpx; color: $uni-gray-700; font-weight: 600; }
.employee-phone { font-size: 24rpx; color: $uni-gray-400; }
.employee-status {
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
  flex-shrink: 0;
}
.status-active { background: $uni-color-success-soft; }
.status-active .status-text { color: $uni-color-success; }
.status-inactive { background: $uni-bg-color-grey; }
.status-inactive .status-text { color: $uni-gray-400; }
.status-text { font-size: 22rpx; }
.card-body {
  display: flex;
  flex-direction: column;
  gap: $uni-spacing-sm;
  margin-bottom: $uni-spacing-md;
}
.info-row {
  display: flex;
  justify-content: space-between;
}
.info-label { font-size: 24rpx; color: $uni-gray-400; }
.info-value { font-size: 26rpx; color: $uni-gray-700; }
.card-actions {
  display: flex;
  gap: $uni-spacing-sm;
  padding-top: $uni-spacing-md;
  border-top: 1rpx solid $uni-bg-color-grey;
}
.mini-btn {
  flex: 1;
  height: 64rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $uni-bg-color-grey;
  color: $uni-gray-500;
  border: none;
}
.mini-btn.primary { background: $uni-color-primary; color: $uni-text-color-inverse; }
.mini-btn.danger { background: $uni-color-error-soft; color: $uni-color-error; }
.mini-btn.success { background: $uni-color-success-soft; color: $uni-color-success; }
.mini-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: $uni-gray-300; margin-bottom: $uni-spacing-md; }
.empty-text { font-size: 28rpx; color: $uni-gray-300; }
.safe-bottom { height: 40rpx; }
</style>
