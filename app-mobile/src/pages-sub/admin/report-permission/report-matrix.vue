<template>
  <view class="matrix-page">
    <!-- 顶部操作栏 -->
    <view class="top-bar">
      <view class="bar-left" @tap="goBack">
        <image class="back-icon ic" src="/static/icons/ic/user.svg" mode="aspectFit"/>
        <text class="bar-title">报表权限矩阵</text>
      </view>
      <view class="bar-right">
        <view class="batch-btn" @tap="showBatchPanel = true">
          <text class="batch-text">批量设置</text>
        </view>
        <view class="save-btn" @tap="onSave">
          <text class="save-text">保存</text>
        </view>
      </view>
    </view>

    <!-- 角色 Tab -->
    <scroll-view class="role-tabs" scroll-x>
      <view class="tab-list">
        <view
          class="tab-item"
          :class="{ active: activeRoleId === role.id }"
          v-for="role in roles"
          :key="role.id"
          @tap="activeRoleId = role.id"
        >
          <text class="tab-text">{{ role.name }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 报表分类 -->
    <scroll-view class="category-tabs" scroll-x>
      <view class="category-list">
        <view
          class="category-item"
          :class="{ active: activeCategory === '' }"
          @tap="activeCategory = ''"
        >
          <text class="category-text">全部</text>
        </view>
        <view
          class="category-item"
          :class="{ active: activeCategory === cat.key }"
          v-for="cat in categories"
          :key="cat.key"
          @tap="activeCategory = cat.key"
        >
          <text class="category-text">{{ cat.name }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 权限矩阵表格 -->
    <scroll-view class="matrix-scroll" scroll-y>
      <view class="matrix-table">
        <!-- 表头 -->
        <view class="table-header">
          <view class="col-report">
            <text class="header-text">报表名称</text>
          </view>
          <view class="col-permission">
            <text class="header-text">查看</text>
          </view>
          <view class="col-permission">
            <text class="header-text">导出</text>
          </view>
        </view>

        <!-- 表体 -->
        <view class="table-body">
          <view class="table-row" v-for="report in filteredReports" :key="report.id">
            <view class="col-report">
              <text class="report-name">{{ report.name }}</text>
              <text class="report-category">{{ report.categoryName }}</text>
            </view>
            <view class="col-permission">
              <switch
                :checked="getPermission(report.id).canView"
                :color="COLOR_PRIMARY"
                @change="(e: any) => onToggleView(report.id, e.detail.value)"
              />
            </view>
            <view class="col-permission">
              <switch
                :checked="getPermission(report.id).canExport"
                :disabled="!getPermission(report.id).canView"
                :color="COLOR_SUCCESS"
                @change="(e: any) => onToggleExport(report.id, e.detail.value)"
              />
            </view>
          </view>
        </view>
      </view>

      <view class="empty-tip" v-if="filteredReports.length === 0">
        <text class="empty-text">暂无报表</text>
      </view>
    </scroll-view>

    <!-- 批量设置弹窗 -->
    <view class="batch-panel" v-if="showBatchPanel" @tap="showBatchPanel = false">
      <view class="batch-content" @tap.stop>
        <view class="batch-header">
          <text class="batch-title">批量设置权限</text>
          <image class="batch-close ic" @tap="showBatchPanel = false" src="/static/icons/ic/lock.svg" mode="aspectFit"/>
        </view>

        <view class="batch-section">
          <text class="section-label">选择角色</text>
          <view class="checkbox-list">
            <view
              class="checkbox-item" v-for="role in roles" :key="role.id" @tap="toggleBatchRole(role.id)">
              <view class="checkbox" :class="{ checked: batchRoleIds.includes(role.id) }">
                <image class="check-icon ic" v-if="batchRoleIds.includes(role.id)" src="/static/icons/ic/eye.svg" mode="aspectFit"/>
              </view>
              <text class="checkbox-label">{{ role.name }}</text>
            </view>
          </view>
        </view>

        <view class="batch-section">
          <text class="section-label">选择报表</text>
          <view class="checkbox-list">
            <view
              class="checkbox-item"
              v-for="report in reports"
              :key="report.id"
              @tap="toggleBatchReport(report.id)"
            >
              <view class="checkbox" :class="{ checked: batchReportIds.includes(report.id) }">
                <image class="check-icon ic" v-if="batchReportIds.includes(report.id)" src="/static/icons/ic/eye.svg" mode="aspectFit"/>
              </view>
              <text class="checkbox-label">{{ report.name }}</text>
            </view>
          </view>
        </view>

        <view class="batch-section">
          <text class="section-label">权限设置</text>
          <view class="permission-options">
            <view class="perm-option" @tap="batchCanView = !batchCanView">
              <view class="checkbox" :class="{ checked: batchCanView }">
                <image class="check-icon ic" v-if="batchCanView" src="/static/icons/ic/eye.svg" mode="aspectFit"/>
              </view>
              <text class="perm-label">查看权限</text>
            </view>
            <view class="perm-option" @tap="batchCanExport = !batchCanExport">
              <view class="checkbox" :class="{ checked: batchCanExport }">
                <image class="check-icon ic" v-if="batchCanExport" src="/static/icons/ic/eye.svg" mode="aspectFit"/>
              </view>
              <text class="perm-label">导出权限</text>
            </view>
          </view>
        </view>

        <view class="batch-actions">
          <view class="btn-cancel" @tap="showBatchPanel = false">
            <text class="btn-text">取消</text>
          </view>
          <view class="btn-confirm" @tap="onBatchApply">
            <text class="btn-text btn-text">应用</text>
          </view>
        </view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
import { COLOR_PRIMARY, COLOR_SUCCESS } from '@/constants/colors'
import { ref, computed, onMounted } from 'vue'
import {
  reportPermissionApi,
  type RoleItem,
  type ReportItem,
  type ReportPermission,
} from '@/api/modules/report-permission'

const roles = ref<RoleItem[]>([])
const reports = ref<ReportItem[]>([])
const permissions = ref<ReportPermission[]>([])
const activeRoleId = ref<number>(0)
const activeCategory = ref('')
const showBatchPanel = ref(false)
const batchRoleIds = ref<number[]>([])
const batchReportIds = ref<string[]>([])
const batchCanView = ref(false)
const batchCanExport = ref(false)

const categories = computed(() => {
  const catMap = new Map<string, string>()
  reports.value.forEach(r => {
    if (!catMap.has(r.category)) {
      catMap.set(r.category, r.categoryName)
    }
  })
  return Array.from(catMap.entries()).map(([key, name]) => ({ key, name }))
})

const filteredReports = computed(() => {
  if (!activeCategory.value) return reports.value
  return reports.value.filter(r => r.category === activeCategory.value)
})

function getPermission(reportId: string): ReportPermission {
  const found = permissions.value.find(
    p => p.roleId === activeRoleId.value && p.reportId === reportId
  )
  return found || { roleId: activeRoleId.value, reportId, canView: false, canExport: false }
}

function onToggleView(reportId: string, value: boolean) {
  const idx = permissions.value.findIndex(
    p => p.roleId === activeRoleId.value && p.reportId === reportId
  )
  if (idx >= 0) {
    permissions.value[idx].canView = value
    if (!value) {
      permissions.value[idx].canExport = false
    }
  } else {
    permissions.value.push({
      roleId: activeRoleId.value,
      reportId,
      canView: value,
      canExport: false,
    })
  }
}

function onToggleExport(reportId: string, value: boolean) {
  const idx = permissions.value.findIndex(
    p => p.roleId === activeRoleId.value && p.reportId === reportId
  )
  if (idx >= 0) {
    permissions.value[idx].canExport = value
  }
}

function toggleBatchRole(roleId: number) {
  const idx = batchRoleIds.value.indexOf(roleId)
  if (idx >= 0) {
    batchRoleIds.value.splice(idx, 1)
  } else {
    batchRoleIds.value.push(roleId)
  }
}

function toggleBatchReport(reportId: string) {
  const idx = batchReportIds.value.indexOf(reportId)
  if (idx >= 0) {
    batchReportIds.value.splice(idx, 1)
  } else {
    batchReportIds.value.push(reportId)
  }
}

function onBatchApply() {
  if (batchRoleIds.value.length === 0) {
    uni.showToast({ title: '请选择角色', icon: 'none' })
    return
  }
  if (batchReportIds.value.length === 0) {
    uni.showToast({ title: '请选择报表', icon: 'none' })
    return
  }

  batchRoleIds.value.forEach(roleId => {
    batchReportIds.value.forEach(reportId => {
      const idx = permissions.value.findIndex(
        p => p.roleId === roleId && p.reportId === reportId
      )
      if (idx >= 0) {
        permissions.value[idx].canView = batchCanView.value
        permissions.value[idx].canExport = batchCanView.value ? batchCanExport.value : false
      } else {
        permissions.value.push({
          roleId,
          reportId,
          canView: batchCanView.value,
          canExport: batchCanView.value ? batchCanExport.value : false,
        })
      }
    })
  })

  showBatchPanel.value = false
  uni.showToast({ title: '批量设置成功', icon: 'success' })
}

async function onSave() {
  try {
    await reportPermissionApi.savePermissionMatrix(permissions.value)
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
    const [rolesData, reportsData, permissionsData] = await Promise.all([
      reportPermissionApi.getRoles(),
      reportPermissionApi.getReports(),
      reportPermissionApi.getPermissionMatrix(),
    ])
    roles.value = rolesData
    reports.value = reportsData
    permissions.value = permissionsData
    if (rolesData.length > 0) {
      activeRoleId.value = rolesData[0].id
    }
  } catch (err) {
    console.error('加载数据失败:', err)
  }
}

onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.matrix-page {
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

.bar-right {
  display: flex;
  gap: 16rpx;
}

.batch-btn {
  padding: 12rpx 24rpx;
  background: $uni-bg-color-grey;
  border-radius: 32rpx;
}

.batch-text {
  font-size: 26rpx;
  color: $uni-gray-500;
}

.save-btn {
  padding: 12rpx 24rpx;
  background: $uni-color-primary;
  border-radius: 32rpx;
}

.save-text {
  font-size: 26rpx;
  color: $uni-text-color-inverse;
}

.role-tabs {
  background: $uni-bg-color;
  border-bottom: 1rpx solid $uni-gray-100;
  white-space: nowrap;
}

.tab-list {
  display: inline-flex;
  padding: 0 16rpx;
}

.tab-item {
  padding: 20rpx 24rpx;
  position: relative;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 4rpx;
  background: $uni-color-primary;
  border-radius: 2rpx;
}

.tab-text {
  font-size: 28rpx;
  color: $uni-gray-500;
}

.tab-item.active .tab-text {
  color: $uni-color-primary;
  font-weight: 600;
}

.category-tabs {
  background: $uni-bg-color;
  border-bottom: 1rpx solid $uni-gray-100;
  white-space: nowrap;
}

.category-list {
  display: inline-flex;
  padding: 12rpx 16rpx;
  gap: 12rpx;
}

.category-item {
  padding: 10rpx 24rpx;
  background: $uni-bg-color-grey;
  border-radius: 24rpx;
}

.category-item.active {
  background: $uni-color-primary-soft;
}

.category-text {
  font-size: 24rpx;
  color: $uni-gray-500;
}

.category-item.active .category-text {
  color: $uni-color-primary;
}

.matrix-scroll {
  flex: 1;
  padding: 24rpx;
}

.matrix-table {
  background: $uni-bg-color;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.table-header {
  display: flex;
  background: $uni-gray-50;
  border-bottom: 1rpx solid $uni-gray-100;
}

.header-text {
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-gray-500;
}

.table-body {
  display: flex;
  flex-direction: column;
}

.table-row {
  display: flex;
  align-items: center;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.table-row:last-child {
  border-bottom: none;
}

.col-report {
  flex: 1;
  padding: 24rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.report-name {
  font-size: 28rpx;
  color: $uni-gray-700;
  font-weight: 500;
}

.report-category {
  font-size: 22rpx;
  color: $uni-gray-400;
}

.col-permission {
  width: 140rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
}

.table-header .col-permission {
  justify-content: center;
  padding: 20rpx 0;
}

.empty-tip {
  padding: 100rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-gray-300;
}

/* 批量设置弹窗 */
.batch-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}

.batch-content {
  width: 100%;
  max-height: 80vh;
  background: $uni-bg-color;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
}

.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx;
  border-bottom: 1rpx solid $uni-gray-100;
}

.batch-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $uni-gray-700;
}

.batch-close {
  font-size: 32rpx;
  color: $uni-gray-400;
}

.batch-section {
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid $uni-bg-color-grey;
}

.section-label {
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-gray-700;
  margin-bottom: 16rpx;
  display: block;
}

.checkbox-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  width: calc(50% - 8rpx);
  padding: 12rpx 0;
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
}

.checkbox.checked {
  background: $uni-color-primary;
  border-color: $uni-color-primary;
}

.check-icon {
  font-size: 24rpx;
  color: $uni-text-color-inverse;
}

.checkbox-label {
  font-size: 26rpx;
  color: $uni-gray-700;
}

.permission-options {
  display: flex;
  gap: 48rpx;
}

.perm-option {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.perm-label {
  font-size: 26rpx;
  color: $uni-gray-700;
}

.batch-actions {
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-cancel {
  background: $uni-bg-color-grey;
}

.btn-confirm {
  background: $uni-color-primary;
}

.btn-text {
  font-size: 28rpx;
  color: $uni-gray-500;
}

.btn-text.btn-text-white {
  color: $uni-text-color-inverse;
  font-weight: 600;
}

.safe-bottom {
  height: 40rpx;
}
</style>
