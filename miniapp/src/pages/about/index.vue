<template>
  <view class="about-page">
    <view class="logo-section">
      <view class="logo-icon">🍷</view>
      <text class="app-name">{{ brandName }}</text>
      <text class="app-slogan">{{ brandSlogan }}</text>
      <text class="app-version">版本 v1.0.0</text>
    </view>

    <view class="about-section">
      <view class="about-title">
        <text>应用介绍</text>
      </view>
      <view class="about-content">
        <text>智享全链是一款专业的酒水行业进销存管理系统，集采购、销售、库存、财务、会员等功能于一体，帮助商家实现全链路数字化管理。</text>
      </view>
    </view>

    <view class="menu-section">
      <view class="menu-item">
        <text class="menu-icon">📱</text>
        <text class="menu-label">官方公众号</text>
        <view class="menu-right">
          <text class="menu-value">{{ brandName }}</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>
      <view class="menu-item">
        <text class="menu-icon">📞</text>
        <text class="menu-label">客服热线</text>
        <view class="menu-right">
          <text class="menu-value">400-888-8888</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>
      <view class="menu-item">
        <text class="menu-icon">📧</text>
        <text class="menu-label">商务邮箱</text>
        <view class="menu-right">
          <text class="menu-value">biz@zhixiang.com</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="menu-section">
      <view class="menu-item" @tap="goUserAgreement">
        <text class="menu-icon">📄</text>
        <text class="menu-label">用户协议</text>
        <view class="menu-right">
          <text class="menu-arrow">›</text>
        </view>
      </view>
      <view class="menu-item" @tap="goPrivacyPolicy">
        <text class="menu-icon">🔐</text>
        <text class="menu-label">隐私政策</text>
        <view class="menu-right">
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="copyright">
      <text>© 2026 {{ brandName }} 版权所有</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import Taro from '@tarojs/taro'

// 当前主题品牌文案（R96-01）：由 config/index.js defineConstants 在编译期注入
const activeTheme = __THEME__
const brandName = activeTheme.brandName
const brandSlogan = activeTheme.brandSlogan

const openDoc = (path: string) => {
  const url = encodeURIComponent(`https://www.onepan.cn/legal/${path}`)
  Taro.navigateTo({ url: `/pages/webview/index?url=${url}` })
}

const goUserAgreement = () => openDoc('用户协议.html')

const goPrivacyPolicy = () => openDoc('隐私政策.html')
</script>

<style lang="scss" scoped>
.about-page {
  min-height: 100vh;
  background-color: $bg-secondary;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0 60rpx;
  background-color: $bg-primary;
  margin-bottom: $spacing-md;
}

.logo-icon {
  font-size: 120rpx;
  margin-bottom: $spacing-md;
}

.app-name {
  font-size: $font-size-xl;
  font-weight: bold;
  color: $text-primary;
  margin-bottom: $spacing-xs;
}

.app-version {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.app-slogan {
  font-size: $font-size-sm;
  color: $brand-accent;
  margin-bottom: $spacing-xs;
}

.about-section {
  background-color: $bg-primary;
  margin-bottom: $spacing-md;
  padding: $spacing-lg $spacing-md;
}

.about-title {
  margin-bottom: $spacing-md;
  font-size: $font-size-base;
  font-weight: bold;
  color: $text-primary;
}

.about-content {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.8;
}

.menu-section {
  background-color: $bg-primary;
  margin-bottom: $spacing-md;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.menu-icon {
  font-size: $font-size-lg;
  margin-right: $spacing-md;
}

.menu-label {
  flex: 1;
  font-size: $font-size-base;
  color: $text-primary;
}

.menu-right {
  display: flex;
  align-items: center;
}

.menu-value {
  font-size: $font-size-sm;
  color: $text-tertiary;
  margin-right: $spacing-xs;
}

.menu-arrow {
  font-size: $font-size-xl;
  color: $text-tertiary;
}

.copyright {
  text-align: center;
  padding: $spacing-xl 0;
  font-size: $font-size-xs;
  color: $text-tertiary;
}
</style>
