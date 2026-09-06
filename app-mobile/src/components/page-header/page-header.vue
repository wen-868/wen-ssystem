<template>
  <view class="zx-page-header">
    <view class="zx-page-header__bar">
      <view class="zx-page-header__back" v-if="showBack" @tap="onBack">
        <text class="zx-page-header__back-icon">‹</text>
      </view>
      <view class="zx-page-header__title-wrap">
        <text class="zx-page-header__title">{{ title }}</text>
        <text v-if="subtitle" class="zx-page-header__subtitle">{{ subtitle }}</text>
      </view>
      <view class="zx-page-header__right">
        <slot name="right"></slot>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  showBack: { type: Boolean, default: true },
})

const emit = defineEmits(['back'])

function onBack() {
  emit('back')
}
</script>

<style lang="scss" scoped>
.zx-page-header {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  padding-top: var(--safe-top);
  background: $ai-bg-page;
  border-bottom: 1rpx solid $zx-black-60;
}

.zx-page-header__bar {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  /* 标题已绝对定位居中，bar 内左侧=返回键、右侧=按钮区，两端对齐 */
  justify-content: space-between;
  height: 88rpx;
  padding: 0 32rpx;
}

.zx-page-header__back {
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zx-page-header__back-icon {
  font-size: 44rpx;
  line-height: 1;
  color: $zx-gray-323;
}

/* 标题：宽度恒占整栏一半并居中于整栏（不受左侧返回键/右侧按钮挤压偏移），
   四个主 tab 页与所有子页面标题位置完全统一 */
.zx-page-header__title-wrap {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.zx-page-header__title {
  max-width: 100%;
  font-size: 30rpx;
  font-weight: 600;
  color: $zx-gray-1a;
  line-height: 1.25;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zx-page-header__subtitle {
  margin-top: 2rpx;
  font-size: 22rpx;
  color: $zx-gray-969;
  line-height: 1.2;
  text-align: center;
}

.zx-page-header__right {
  flex-shrink: 0;
  min-width: 64rpx;
  /* bar 仅剩右侧元素时（无返回键页面）也保证靠右 */
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
</style>
