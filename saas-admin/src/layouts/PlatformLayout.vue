<template>
  <el-container class="platform-layout">
    <el-aside width="220px">
      <div class="logo">至象 · 平台总后台</div>
      <el-menu :default-active="activeMenu" router>
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>平台看板</span>
        </el-menu-item>
        <el-menu-item index="/tenants">
          <el-icon><OfficeBuilding /></el-icon>
          <span>租户管理</span>
        </el-menu-item>
        <el-menu-item index="/packages">
          <el-icon><Box /></el-icon>
          <span>套餐管理</span>
        </el-menu-item>
        <el-menu-item index="/subscriptions">
          <el-icon><CreditCard /></el-icon>
          <span>订阅管理</span>
        </el-menu-item>
        <el-menu-item index="/monitor">
          <el-icon><Monitor /></el-icon>
          <span>系统监控</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>平台配置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header>
        <div class="header-right">
          <span class="username">{{ authStore.adminInfo?.realName || authStore.adminInfo?.username }}</span>
          <el-button text @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { OfficeBuilding, Monitor, DataAnalysis, Box, CreditCard, Setting } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const activeMenu = computed(() => '/' + (route.path.split('/')[1] || 'tenants'))

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.platform-layout { height: 100vh; }
.el-aside { background: #304156; color: #fff; }
.logo { padding: 20px; font-size: 16px; font-weight: 700; text-align: center; border-bottom: 1px solid #3a4a5e; }
.el-header { background: #fff; border-bottom: 1px solid #e6e6e6; display: flex; align-items: center; justify-content: flex-end; }
.header-right { display: flex; align-items: center; gap: 12px; }
.username { color: #606266; }
</style>
