<template>
  <view class="employees-page">
    <view class="page-header">
      <text class="header-title">员工管理</text>
    </view>

    <form ref="formRef" :model="searchForm" class="search-form">
      <view class="search-bar">
        <view class="search-input-wrap">
          <text class="search-icon">&#xe614;</text>
          <input
            class="search-input"
            v-model="searchForm.keyword"
            type="text"
            placeholder="搜索员工姓名 / 手机号"
            placeholder-class="search-placeholder"
            @confirm="onSearch"
          />
          <text class="search-clear" v-if="searchForm.keyword" @tap="clearSearch">&#xe615;</text>
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
      <text class="empty-icon">&#xe631;</text>
      <text class="empty-text">暂无员工数据</text>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
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
        try {
          const newStatus = item.status === 'active' ? 'inactive' : 'active'
          await employeeApi.toggleStatus(item.id, newStatus)
          item.status = newStatus
          uni.showToast({ title: `${action}成功`, icon: 'success' })
        } catch (err) {
          uni.showToast({ title: `${action}失败`, icon: 'error' })
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

<style scoped>
.employees-page { min-height: 100vh; background: #f0f5ff; }
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
.filter-bar {
  display: flex;
  padding: 16rpx 24rpx;
  background: #fff;
  gap: 16rpx;
}
.filter-item {
  padding: 8rpx 24rpx;
  background: #f5f7fa;
  border-radius: 24rpx;
}
.filter-item--active { background: #1677FF; }
.filter-item--active .filter-text { color: #fff; }
.filter-text { font-size: 24rpx; color: #666; }
.add-section { padding: 16rpx 24rpx; }
.add-btn {
  width: 100%;
  height: 80rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
  border: none;
}
.add-btn::after { border: none; }
.employee-list { padding: 0 24rpx 24rpx; }
.employee-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}
.card-header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.employee-avatar {
  width: 80rpx; height: 80rpx;
  border-radius: 40rpx;
  background: linear-gradient(135deg, #1677FF, #4096ff);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-text { font-size: 32rpx; color: #fff; font-weight: 600; }
.employee-info {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 6rpx;
}
.employee-name { font-size: 28rpx; color: #333; font-weight: 600; }
.employee-phone { font-size: 24rpx; color: #999; }
.employee-status {
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
  flex-shrink: 0;
}
.status-active { background: #f6ffed; }
.status-active .status-text { color: #52c41a; }
.status-inactive { background: #f5f5f5; }
.status-inactive .status-text { color: #999; }
.status-text { font-size: 22rpx; }
.card-body {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.info-row {
  display: flex;
  justify-content: space-between;
}
.info-label { font-size: 24rpx; color: #999; }
.info-value { font-size: 26rpx; color: #333; }
.card-actions {
  display: flex;
  gap: 16rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f5f5f5;
}
.mini-btn {
  flex: 1;
  height: 64rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  color: #666;
  border: none;
}
.mini-btn.primary { background: #1677FF; color: #fff; }
.mini-btn.danger { background: #fff2f0; color: #ff4d4f; }
.mini-btn.success { background: #f6ffed; color: #52c41a; }
.mini-btn::after { border: none; }
.empty-state {
  display: flex; flex-direction: column;
  align-items: center; padding: 200rpx 0;
}
.empty-icon { font-size: 80rpx; color: #ddd; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #bbb; }
.safe-bottom { height: 40rpx; }
</style>
