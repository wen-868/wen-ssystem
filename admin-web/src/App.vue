<template>
  <el-config-provider :locale="zhCn">
    <router-view v-slot="{ Component }">
      <transition name="page-fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </el-config-provider>
</template>

<script setup lang="ts">
// App.vue — 路由入口，所有页面由 vue-router 管理；Element Plus 全局中文化
import zhCn from "element-plus/es/locale/lang/zh-cn";
</script>

<style>
/* ─── 页面切换过渡（克制 180ms） ─── */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
</style>
