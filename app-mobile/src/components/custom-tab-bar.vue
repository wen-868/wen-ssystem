<template>
  <view class="custom-tab-bar">
    <view class="tab-bar-inner">
      <!-- 首页 -->
      <view
        class="tab-item"
        :class="{ 'tab-item--active': current === 'home' }"
        @tap="switchTab('/pages/home/home')"
      >
        <view class="tab-icon icon-home">
          <image
            class="tab-icon-img"
            :src="current === 'home' ? '/static/tabbar/home-active.svg' : '/static/tabbar/home.svg'"
            mode="aspectFit"
          />
        </view>
        <text class="tab-text">首页</text>
      </view>

      <!-- 商品 -->
      <view
        class="tab-item"
        :class="{ 'tab-item--active': current === 'products' }"
        @tap="switchTab('/pages/products/products')"
      >
        <view class="tab-icon icon-box">
          <image
            class="tab-icon-img"
            :src="current === 'products' ? '/static/tabbar/product-active.svg' : '/static/tabbar/product.svg'"
            mode="aspectFit"
          />
        </view>
        <text class="tab-text">商品</text>
      </view>

      <!-- AI 圆形按钮 -->
      <view
        class="tab-ai"
        :class="{ 'tab-ai--active': current === 'ai' }"
        @tap="switchTab('/pages/ai-chat/ai-chat')"
      >
        <view class="ai-btn">
          <image class="ai-btn-img" src="/static/tabbar/ai.svg" mode="aspectFit" />
        </view>
      </view>

      <!-- 功能 -->
      <view
        class="tab-item"
        :class="{ 'tab-item--active': current === 'functions' }"
        @tap="switchTab('/pages/functions/functions')"
      >
        <view class="tab-icon icon-grid">
          <image
            class="tab-icon-img"
            :src="current === 'functions' ? '/static/tabbar/functions-active.svg' : '/static/tabbar/functions.svg'"
            mode="aspectFit"
          />
        </view>
        <text class="tab-text">功能</text>
      </view>

      <!-- 我的 -->
      <view
        class="tab-item"
        :class="{ 'tab-item--active': current === 'profile' }"
        @tap="switchTab('/pages/profile/profile')"
      >
        <view class="tab-icon icon-user">
          <image
            class="tab-icon-img"
            :src="current === 'profile' ? '/static/tabbar/user-active.svg' : '/static/tabbar/user.svg'"
            mode="aspectFit"
          />
        </view>
        <text class="tab-text">我的</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  /** 当前 tab：home / products / functions / profile / ai */
  current: 'home' | 'products' | 'functions' | 'profile' | 'ai'
}>()

function switchTab(url: string) {
  uni.switchTab({ url })
}
</script>

<style lang="scss" scoped>
/* ─── 自定义 tabBar：中间 AI 圆形按钮 + 毛玻璃底栏（R95-01 v1.0 设计） ─── */
.custom-tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1rpx solid rgba(0, 0, 0, 0.04);
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -16rpx 64rpx rgba(0, 0, 0, 0.06), 0 -4rpx 16rpx rgba(0, 0, 0, 0.02);
}

.tab-bar-inner {
  position: relative;
  display: flex;
  align-items: center;
  height: 136rpx;
  padding: 0 12rpx;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  padding-top: 8rpx;
  position: relative;
}

.tab-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 4rpx;
  background: $uni-color-primary;
  border-radius: 0 0 4rpx 4rpx;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.tab-item--active::before {
  opacity: 1;
}

.tab-text {
  font-size: 22rpx;
  color: $uni-gray-400;
  line-height: 1;
  transition: all 0.25s ease;
}

.tab-item--active .tab-text {
  color: $uni-color-primary;
  font-weight: 600;
}

/* ─── 图标（纯 CSS，双端一致） ─── */
.tab-icon {
  position: relative;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-icon-img {
  width: 44rpx;
  height: 44rpx;
}

/* ─── AI 凸起按钮 ─── */
.tab-ai {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.ai-btn {
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateY(-30rpx);
  box-shadow: 0 8rpx 32rpx rgba(37, 99, 235, 0.25);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease;
}

.ai-btn-img {
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
}

.tab-ai:active .ai-btn {
  transform: translateY(-30rpx) scale(0.92);
  box-shadow: 0 4rpx 24rpx rgba(37, 99, 235, 0.2);
}

.tab-ai--active .ai-btn {
  box-shadow: 0 8rpx 40rpx rgba(37, 99, 235, 0.35), 0 0 0 4rpx rgba(37, 99, 235, 0.15);
  transform: translateY(-30rpx) scale(1.05);
}

.tab-ai--active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 4rpx;
  background: $uni-color-primary;
  border-radius: 0 0 4rpx 4rpx;
}

.ai-btn-text {
  font-size: 34rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 1rpx;
}
</style>
