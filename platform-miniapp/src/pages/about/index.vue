<template>
  <view class="about-page">
    <view class="logo-block">
      <view class="logo">智</view>
      <view class="name">智享全链</view>
      <view class="slogan">酒水行业一站式数字化管理系统</view>
    </view>

    <view class="section">
      <view class="section-title">关于我们</view>
      <view class="section-text">
        智享全链专注酒水零售批发行业，提供进销存、收银、会员、即时零售、AI 助手、多门店连锁等一体化 SaaS 服务，帮助酒水商家把生意管得更简单。
      </view>
    </view>

    <view class="section">
      <view class="section-title">联系我们</view>
      <view class="contact-line">客服微信：智享全链</view>
      <view class="contact-line">服务时间：9:00 - 21:00</view>
    </view>
  </view>
</template>

<script setup lang="ts">
</script>

<style lang="scss">
.about-page {
  min-height: 100vh;
  background: $bg-page;
  padding: $spacing-xxl $spacing-lg;
  box-sizing: border-box;
}
.logo-block {
  text-align: center;
  padding: $spacing-xl 0 $spacing-xxl;
}
.logo {
  width: 112rpx;
  height: 112rpx;
  line-height: 112rpx;
  margin: 0 auto;
  background: $brand-gradient;
  color: #fff;
  font-size: 56rpx;
  font-weight: $font-bold;
  border-radius: $radius-lg;
}
.name {
  margin-top: $spacing-md;
  font-size: $font-size-xxl;
  font-weight: $font-bold;
  color: $text-primary;
}
.slogan {
  margin-top: $spacing-xs;
  font-size: $font-size-sm;
  color: $text-tertiary;
}
.section {
  background: $bg-primary;
  border-radius: $radius-lg;
  padding: $spacing-lg;
  margin-bottom: $spacing-lg;
  box-shadow: $shadow-card;
}
.section-title {
  font-size: $font-size-lg;
  font-weight: $font-semibold;
  color: $text-primary;
  margin-bottom: $spacing-md;
}
.section-text {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.8;
}
.contact-line {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 2;
}
</style>
