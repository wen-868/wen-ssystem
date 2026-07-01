<template>
  <view class="page-container">
    <view class="placeholder-card">
      <text class="placeholder-icon">📋</text>
      <text class="placeholder-title">商品详情</text>
      <text class="placeholder-desc">功能开发中，敬请期待</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
onLoad(() => { uni.setNavigationBarTitle({ title: '商品详情' }) })
</script>

<style scoped>
.page-container { display:flex; align-items:center; justify-content:center; min-height:100vh; background:#F5F5F5; }
.placeholder-card { text-align:center; padding:40px; }
.placeholder-icon { font-size:64px; display:block; margin-bottom:16px; }
.placeholder-title { font-size:18px; font-weight:600; color:#333; display:block; margin-bottom:8px; }
.placeholder-desc { font-size:14px; color:#999; }
</style>