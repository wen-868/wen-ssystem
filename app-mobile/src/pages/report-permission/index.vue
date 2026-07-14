<template>
  <view class="permission-page">
    <view class="page-header">
      <text class="header-title">权限管理</text>
      <text class="header-subtitle">报表权限与数据权限配置</text>
    </view>

    <view class="permission-menu">
      <view class="menu-card" @tap="goReportMatrix">
        <view class="menu-icon menu-icon--matrix">&#xe622;</view>
        <view class="menu-content">
          <text class="menu-title">报表权限矩阵</text>
          <text class="menu-desc">配置角色对各报表的查看、导出权限</text>
        </view>
        <view class="menu-arrow">&#xe600;</view>
      </view>

      <view class="menu-card" @tap="goStoreDataPermission">
        <view class="menu-icon menu-icon--store">&#xe623;</view>
        <view class="menu-content">
          <text class="menu-title">门店数据权限</text>
          <text class="menu-desc">设置角色可查看的门店数据范围</text>
        </view>
        <view class="menu-arrow">&#xe600;</view>
      </view>

      <view class="menu-card" @tap="goPermissionAssign">
        <view class="menu-icon menu-icon--user">&#xe606;</view>
        <view class="menu-content">
          <text class="menu-title">权限分配</text>
          <text class="menu-desc">为用户分配角色和额外权限</text>
        </view>
        <view class="menu-arrow">&#xe600;</view>
      </view>

      <view class="menu-card" @tap="goAuditLogs">
        <view class="menu-icon menu-icon--log">&#xe619;</view>
        <view class="menu-content">
          <text class="menu-title">权限审计日志</text>
          <text class="menu-desc">查看权限变更操作记录</text>
        </view>
        <view class="menu-arrow">&#xe600;</view>
      </view>

      <view class="menu-card" @tap="goMyPermission">
        <view class="menu-icon menu-icon--my">&#xe624;</view>
        <view class="menu-content">
          <text class="menu-title">我的权限</text>
          <text class="menu-desc">查看当前用户拥有的权限</text>
        </view>
        <view class="menu-arrow">&#xe600;</view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goReportMatrix() {
  uni.navigateTo({ url: '/pages/report-permission/report-matrix' })
}

function goStoreDataPermission() {
  uni.navigateTo({ url: '/pages/report-permission/store-data-permission' })
}

function goPermissionAssign() {
  uni.navigateTo({ url: '/pages/report-permission/permission-assign' })
}

function goAuditLogs() {
  uni.navigateTo({ url: '/pages/report-permission/audit-logs' })
}

function goMyPermission() {
  uni.navigateTo({ url: '/pages/report-permission/my-permission' })
}
</script>

<style scoped>
.permission-page {
  min-height: 100vh;
  background: #f0f5ff;
}

.page-header {
  padding: 32rpx;
  padding-top: calc(32rpx + env(safe-area-inset-top));
  background: linear-gradient(135deg, #1677FF, #4096ff);
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  display: block;
}

.header-subtitle {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 8rpx;
  display: block;
}

.permission-menu {
  padding: 24rpx;
}

.menu-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.menu-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: #fff;
  flex-shrink: 0;
}

.menu-icon--matrix {
  background: linear-gradient(135deg, #1677FF, #4096ff);
}

.menu-icon--store {
  background: linear-gradient(135deg, #52c41a, #73d13d);
}

.menu-icon--user {
  background: linear-gradient(135deg, #722ed1, #9254de);
}

.menu-icon--log {
  background: linear-gradient(135deg, #fa8c16, #ffa940);
}

.menu-icon--my {
  background: linear-gradient(135deg, #eb2f96, #f759ab);
}

.menu-content {
  flex: 1;
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.menu-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.menu-desc {
  font-size: 24rpx;
  color: #999;
}

.menu-arrow {
  font-size: 28rpx;
  color: #ccc;
  flex-shrink: 0;
}

.safe-bottom {
  height: 40rpx;
}
</style>
