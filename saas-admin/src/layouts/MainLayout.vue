<template>
  <div class="layout">
    <!-- 侧边栏：深色磨砂 + 胶囊导航 -->
    <aside class="side">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="logo-icon">智</div>
          <h1>智享云平台</h1>
          <span class="logo-tag">SaaS</span>
        </div>
      </div>

      <!-- 自定义胶囊导航 -->
      <nav class="sidebar-nav">
        <div class="nav-group">
          <div
            class="nav-item"
            :class="{ active: activeMenu === '/dashboard' }"
            @click="navTo('/dashboard')"
          >
            <el-icon class="nav-icon"><DataAnalysis /></el-icon>
            <span class="nav-label">数据大盘</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: activeMenu === '/tenants' }"
            @click="navTo('/tenants')"
          >
            <el-icon class="nav-icon"><OfficeBuilding /></el-icon>
            <span class="nav-label">租户管理</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: activeMenu === '/packages' }"
            @click="navTo('/packages')"
          >
            <el-icon class="nav-icon"><Goods /></el-icon>
            <span class="nav-label">套餐管理</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: activeMenu === '/subscriptions' }"
            @click="navTo('/subscriptions')"
          >
            <el-icon class="nav-icon"><Document /></el-icon>
            <span class="nav-label">订阅管理</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: activeMenu === '/settings' }"
            @click="navTo('/settings')"
          >
            <el-icon class="nav-icon"><Setting /></el-icon>
            <span class="nav-label">平台配置</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: activeMenu === '/audit-logs' }"
            @click="navTo('/audit-logs')"
          >
            <el-icon class="nav-icon"><List /></el-icon>
            <span class="nav-label">操作日志</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: activeMenu === '/monitor' }"
            @click="navTo('/monitor')"
          >
            <el-icon class="nav-icon"><Monitor /></el-icon>
            <span class="nav-label">监控告警</span>
          </div>
          <div
            class="nav-item"
            :class="{ active: activeMenu === '/error-logs' }"
            @click="navTo('/error-logs')"
          >
            <el-icon class="nav-icon"><WarningFilled /></el-icon>
            <span class="nav-label">错误日志</span>
          </div>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="super-info">
          <el-avatar :size="36" style="background: var(--color-danger)">超</el-avatar>
          <div class="super-detail">
            <div class="super-name">{{ userName }}</div>
            <div class="super-role">SUPER ADMIN</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="main">
      <!-- 顶栏：磨砂半透明 -->
      <header class="topbar">
        <div class="topbar-left">
          <span class="page-title">{{ pageTitle }}</span>
        </div>
        <div class="topbar-right">
          <div class="topbar-search">
            <el-icon><Search /></el-icon>
            <span>搜索租户、订单、商品...</span>
          </div>
          <el-badge :value="5" :max="99" class="topbar-badge">
            <el-button circle size="small">
              <el-icon><Bell /></el-icon>
            </el-button>
          </el-badge>
          <el-dropdown trigger="click">
            <span class="user-info">
              <el-avatar :size="28" style="background: var(--color-danger)">{{ userAvatar }}</el-avatar>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <div class="content">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  OfficeBuilding, Goods, Document, Setting, List, Monitor,
  WarningFilled, DataAnalysis, Bell, Search
} from "@element-plus/icons-vue";

const router = useRouter();
const route = useRoute();

const activeMenu = computed(() => {
  const path = route.path;
  if (path.startsWith("/tenants")) return "/tenants";
  if (path.startsWith("/packages")) return "/packages";
  if (path.startsWith("/subscriptions")) return "/subscriptions";
  if (path.startsWith("/monitor")) return "/monitor";
  if (path.startsWith("/error-logs")) return "/error-logs";
  if (path.startsWith("/settings")) return "/settings";
  if (path.startsWith("/audit-logs")) return "/audit-logs";
  return "/dashboard";
});

const pageTitle = computed(() => {
  const map: Record<string, string> = {
    "/dashboard": "数据大盘",
    "/tenants": "租户管理",
    "/packages": "套餐管理",
    "/subscriptions": "订阅管理",
    "/settings": "平台配置",
    "/audit-logs": "操作日志",
    "/monitor": "监控告警",
    "/error-logs": "错误日志"
  };
  for (const [prefix, title] of Object.entries(map)) {
    if (route.path.startsWith(prefix)) return title;
  }
  return "";
});

const userName = computed(() => {
  try {
    const raw = localStorage.getItem("saas_user");
    if (raw) {
      const user = JSON.parse(raw);
      return user.realName || user.username || "超级管理员";
    }
  } catch {}
  return "超级管理员";
});

const userAvatar = computed(() => {
  return userName.value.charAt(0);
});

function navTo(path: string) {
  router.push(path);
}

function handleLogout() {
  localStorage.removeItem("saas_token");
  localStorage.removeItem("saas_user");
  router.push("/login");
}
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-page);
}

/* ========== 侧边栏：深色磨砂 ========== */
.side {
  width: var(--sidebar-width);
  background: var(--frost-sidebar);
  backdrop-filter: var(--frost-sidebar-blur);
  -webkit-backdrop-filter: var(--frost-sidebar-blur);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 100;
}

.sidebar-header {
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.logo-icon {
  width: 30px;
  height: 30px;
  background: var(--color-primary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.sidebar-header h1 {
  font-size: 15px;
  font-weight: 700;
  color: var(--sidebar-text-primary);
  margin: 0;
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.logo-tag {
  margin-left: auto;
  font-size: 10px;
  color: var(--sidebar-text-muted);
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

/* ========== 胶囊导航 ========== */
.sidebar-nav {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar-nav::-webkit-scrollbar {
  width: 4px;
}
.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.nav-group {
  margin-bottom: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 12px;
  border-radius: var(--nav-item-radius);
  cursor: pointer;
  color: var(--sidebar-text-secondary);
  font-size: 13px;
  transition: all 250ms ease-out;
  margin-bottom: 2px;
  position: relative;
}

.nav-item:hover {
  color: var(--sidebar-text-primary);
  background: rgba(255, 255, 255, 0.06);
}

.nav-item.active {
  background: rgba(91, 106, 191, 0.20);
  color: #FFFFFF;
  font-weight: 500;
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  flex-shrink: 0;
  text-align: center;
}

.nav-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.super-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
}

.super-detail {
  flex: 1;
  min-width: 0;
}

.super-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--sidebar-text-primary);
}

.super-role {
  font-size: 11px;
  color: var(--color-danger);
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

/* ========== 主内容区 ========== */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ========== 顶栏：磨砂半透明 ========== */
.topbar {
  height: var(--topbar-height);
  background: var(--frost-topbar);
  backdrop-filter: var(--frost-topbar-blur);
  -webkit-backdrop-filter: var(--frost-topbar-blur);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 50;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
}

.page-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topbar-search {
  width: 280px;
  height: 32px;
  background: var(--gray-100);
  border: 1px solid transparent;
  border-radius: 8px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.topbar-search:hover {
  background: var(--gray-200);
}

.topbar-search .el-icon {
  font-size: 14px;
}

.topbar-badge {
  margin-left: 4px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}
</style>
