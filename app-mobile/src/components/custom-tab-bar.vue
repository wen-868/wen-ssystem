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

      <!-- AI 圆形按钮（设计：紫色渐变 + 呼吸光环 + 水平垂直居中） -->
      <view
        class="tab-ai"
        :class="{ 'tab-ai--active': current === 'ai' }"
        @tap="switchTab('/pages/ai-chat/ai-chat')"
      >
        <view class="ai-btn-wrap">
          <view class="ai-ring"></view>
          <view class="ai-btn">
            <text class="ai-btn-text">AI</text>
          </view>
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
/* ─── 自定义 tabBar：悬浮胶囊 + 中间紫色 AI 圆 + 呼吸光环（R95-02 v2 设计） ─── */
.custom-tab-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(20rpx + env(safe-area-inset-bottom));
  z-index: 999;
  background: $zx-white-880;
  backdrop-filter: blur(48rpx) saturate(1.5);
  -webkit-backdrop-filter: blur(48rpx) saturate(1.5);
  border-radius: 48rpx;
  border: 2rpx solid $zx-black-50;
  box-shadow: 0 20rpx 60rpx $zx-black-140, 0 -2rpx 4rpx $zx-black-20;
  padding: 6rpx 0 calc(6rpx + env(safe-area-inset-bottom));
  /* 裁剪 AI 呼吸光环/圆钮溢出胶囊下缘的部分（溢出会在页面底部形成紫色条） */
  overflow: hidden;
}

.tab-bar-inner {
  position: relative;
  display: flex;
  align-items: center;
  height: 112rpx;
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

.tab-item:active .tab-icon-img {
  transform: scale(0.86);
}

.tab-text {
  font-size: 22rpx;
  color: $uni-gray-500;
  line-height: 1;
  transition: all 0.25s ease;
}

.tab-item--active .tab-text {
  color: $uni-color-primary;
  font-weight: 600;
}

/* ─── 图标（外置 SVG，与各 tab 一致） ─── */
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
  transition: transform 0.2s ease;
}

/* ─── AI 圆形按钮（紫色渐变 + 呼吸光环，居中） ─── */
.tab-ai {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-btn-wrap {
  position: relative;
  width: 104rpx;
  height: 104rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 呼吸光环：以圆钮圆心同心扩散 */
.ai-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  border: 4rpx solid $zx-violet3-550;
  transform: translate(-50%, -50%);
  animation: aiRing 2.6s ease-out infinite;
  pointer-events: none;
}

.ai-btn {
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $zx-violet-600 0%, $zx-purple-600 55%, $zx-purple-500 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx $zx-violet2-350;
  animation: aiBreathe 2.6s ease-in-out infinite;
  position: relative;
  z-index: 2;
}

.tab-ai--active .ai-btn {
  box-shadow: 0 8rpx 44rpx $zx-violet3-650, 0 0 0 4rpx $zx-violet3-180;
  transform: scale(1.05);
}

.ai-btn-text {
  font-size: 30rpx;
  font-weight: 800;
  color: $ai-bg-page;
  letter-spacing: 0.5rpx;
  line-height: 1;
}

.tab-text--active {
  color: $uni-color-primary;
  font-weight: 600;
}

/* ─── 呼吸动效 ─── */
@keyframes aiBreathe {
  0%,
  100% {
    box-shadow: 0 8rpx 32rpx $zx-violet2-320;
  }
  50% {
    box-shadow: 0 12rpx 56rpx $zx-violet3-600;
  }
}

@keyframes aiRing {
  0% {
    transform: translate(-50%, -50%) scale(0.88);
    opacity: 0.85;
  }
  70% {
    transform: translate(-50%, -50%) scale(1.38);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.38);
    opacity: 0;
  }
}
</style>
