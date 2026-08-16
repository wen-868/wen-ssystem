<template>
  <view class="permission-page">
    <view class="page-header">
      <text class="header-title">权限管理</text>
      <text class="header-subtitle">报表权限与数据权限配置</text>
    </view>

    <view class="permission-menu">
      <view class="menu-card" @tap="goReportMatrix">
        <view class="menu-icon menu-icon--matrix"><image class="ic" src="/static/icons/ic/pen.svg" mode="aspectFit"/></view>
        <view class="menu-content">
          <text class="menu-title">报表权限矩阵</text>
          <text class="menu-desc">配置角色对各报表的查看、导出权限</text>
        </view>
        <view class="menu-arrow"><image class="ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/></view>
      </view>

      <view class="menu-card" @tap="goStoreDataPermission">
        <view class="menu-icon menu-icon--store"><image class="ic" src="/static/icons/ic/trash.svg" mode="aspectFit"/></view>
        <view class="menu-content">
          <text class="menu-title">门店数据权限</text>
          <text class="menu-desc">设置角色可查看的门店数据范围</text>
        </view>
        <view class="menu-arrow"><image class="ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/></view>
      </view>

      <view class="menu-card" @tap="goPermissionAssign">
        <view class="menu-icon menu-icon--user"><image class="ic" src="/static/icons/ic/chart.svg" mode="aspectFit"/></view>
        <view class="menu-content">
          <text class="menu-title">权限分配</text>
          <text class="menu-desc">为用户分配角色和额外权限</text>
        </view>
        <view class="menu-arrow"><image class="ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/></view>
      </view>

      <view class="menu-card" @tap="goAuditLogs">
        <view class="menu-icon menu-icon--log"><image class="ic" src="/static/icons/ic/users.svg" mode="aspectFit"/></view>
        <view class="menu-content">
          <text class="menu-title">权限审计日志</text>
          <text class="menu-desc">查看权限变更操作记录</text>
        </view>
        <view class="menu-arrow"><image class="ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/></view>
      </view>

      <view class="menu-card" @tap="goMyPermission">
        <view class="menu-icon menu-icon--my"><image class="ic" src="/static/icons/ic/zap.svg" mode="aspectFit"/></view>
        <view class="menu-content">
          <text class="menu-title">我的权限</text>
          <text class="menu-desc">查看当前用户拥有的权限</text>
        </view>
        <view class="menu-arrow"><image class="ic" src="/static/icons/ic/chevron-right.svg" mode="aspectFit"/></view>
      </view>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup lang="ts">
function goReportMatrix() {
  uni.navigateTo({ url: '/pages-sub/admin/report-permission/report-matrix' })
}

function goStoreDataPermission() {
  uni.navigateTo({ url: '/pages-sub/admin/report-permission/store-data-permission' })
}

function goPermissionAssign() {
  uni.navigateTo({ url: '/pages-sub/admin/report-permission/permission-assign' })
}

function goAuditLogs() {
  uni.navigateTo({ url: '/pages-sub/admin/report-permission/audit-logs' })
}

function goMyPermission() {
  uni.navigateTo({ url: '/pages-sub/admin/report-permission/my-permission' })
}
</script>

<style lang="scss" scoped>
.permission-page {
  min-height: 100vh;
  background: $uni-color-primary-soft;
}

.page-header {
  padding: 32rpx;
  padding-top: calc(32rpx + env(safe-area-inset-top));
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $uni-text-color-inverse;
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
  background: $uni-bg-color;
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
  color: $uni-text-color-inverse;
  flex-shrink: 0;
}

.menu-icon--matrix {
  background: linear-gradient(135deg, $uni-color-primary, $uni-color-primary);
}

.menu-icon--store {
  background: linear-gradient(135deg, $uni-color-success, $uni-color-success);
}

.menu-icon--user {
  background: linear-gradient(135deg, $uni-color-purple, $uni-color-purple-light);
}

.menu-icon--log {
  background: linear-gradient(135deg, $uni-color-warning, $uni-color-warning);
}

.menu-icon--my {
  background: linear-gradient(135deg, $uni-color-pink, $uni-color-pink-light);
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
  color: $uni-gray-700;
}

.menu-desc {
  font-size: 24rpx;
  color: $uni-gray-400;
}

.menu-arrow {
  font-size: 28rpx;
  color: $uni-gray-300;
  flex-shrink: 0;
}

.safe-bottom {
  height: 40rpx;
}
</style>
