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
  position: relative;
  width: 100%;
  padding-top: env(safe-area-inset-top);
  background: #ffffff;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);
}

.zx-page-header__bar {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 88rpx;
  padding: 0 24rpx;
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
  color: #323233;
}

.zx-page-header__title-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.zx-page-header__title {
  max-width: 100%;
  font-size: 34rpx;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.25;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zx-page-header__subtitle {
  margin-top: 2rpx;
  font-size: 22rpx;
  color: #969799;
  line-height: 1.2;
  text-align: center;
}

.zx-page-header__right {
  flex-shrink: 0;
  min-width: 64rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
</style>
