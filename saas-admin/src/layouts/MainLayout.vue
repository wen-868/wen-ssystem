<template>
  <div class="layout">
    <aside class="side">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="logo-icon">智</div>
          <h1>智享云平台</h1>
          <span class="logo-tag">SaaS</span>
        </div>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>数据大盘</template>
        </el-menu-item>

        <el-menu-item index="/tenants">
          <el-icon><OfficeBuilding /></el-icon>
          <template #title>租户管理</template>
        </el-menu-item>

        <el-menu-item index="/packages">
          <el-icon><Goods /></el-icon>
          <template #title>套餐管理</template>
        </el-menu-item>

        <el-menu-item index="/subscriptions">
          <el-icon><Document /></el-icon>
          <template #title>订阅管理</template>
        </el-menu-item>

        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <template #title>平台配置</template>
        </el-menu-item>

        <el-menu-item index="/audit-logs">
          <el-icon><List /></el-icon>
          <template #title>操作日志</template>
        </el-menu-item>

        <el-menu-item index="/monitor">
          <el-icon><Monitor /></el-icon>
          <template #title>监控告警</template>
        </el-menu-item>

        <el-menu-item index="/error-logs">
          <el-icon><WarningFilled /></el-icon>
          <template #title>错误日志</template>
        </el-menu-item>
      </el-menu>

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

    <div class="main">
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
import { OfficeBuilding, Goods, Document, Setting, List, Monitor, WarningFilled, DataAnalysis, Bell, Search } from "@element-plus/icons-vue";

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

.side {
  width: 240px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-normal);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 0 16px;
  border-bottom: 1px solid var(--border-normal);
  height: 64px;
  display: flex;
  align-items: center;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.logo-icon {
  width: 36px;
  height: 36px;
  background: var(--color-danger);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}

.sidebar-header h1 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
}

.logo-tag {
  margin-left: auto;
  font-size: 10px;
  color: var(--text-muted);
  padding: 2px 6px;
  background: var(--gray-200);
  border-radius: 4px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.sidebar-menu {
  flex: 1;
  border-right: none !important;
  background: transparent !important;
  padding: 12px 10px;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--border-normal);
}

.super-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-normal);
}

.super-detail {
  flex: 1;
  min-width: 0;
}

.super-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.super-role {
  font-size: 11px;
  color: var(--color-danger);
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  height: 64px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-normal);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
}

.page-title {
  font-size: 18px;
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
  height: 36px;
  background: var(--gray-50);
  border: 1px solid var(--border-normal);
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.topbar-search:hover {
  border-color: var(--color-primary);
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
