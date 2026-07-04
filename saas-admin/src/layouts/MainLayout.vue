<template>
  <div class="layout">
    <aside class="side">
      <div class="sidebar-header">
        <h1>智享平台总后台</h1>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><HomeFilled /></el-icon>
          <template #title>工作台</template>
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
      </el-menu>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="topbar-left">
          <span class="page-title">{{ pageTitle }}</span>
        </div>
        <div class="topbar-right">
          <span class="user-name">{{ userName }}</span>
          <el-button type="danger" text @click="handleLogout">退出登录</el-button>
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

const router = useRouter();
const route = useRoute();

const activeMenu = computed(() => {
  const path = route.path;
  if (path.startsWith("/tenants")) return "/tenants";
  if (path.startsWith("/packages")) return "/packages";
  if (path.startsWith("/subscriptions")) return "/subscriptions";
  if (path.startsWith("/settings")) return "/settings";
  return "/dashboard";
});

const pageTitle = computed(() => {
  const map: Record<string, string> = {
    "/dashboard": "工作台",
    "/tenants": "租户管理",
    "/packages": "套餐管理",
    "/subscriptions": "订阅管理",
    "/settings": "平台配置"
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
      return user.realName || user.username || "管理员";
    }
  } catch {}
  return "管理员";
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
}

.side {
  width: 220px;
  background: #1a1a2e;
  color: #fff;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-header h1 {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  background: transparent;
}

.sidebar-menu :deep(.el-menu-item) {
  color: rgba(255, 255, 255, 0.7);
}

.sidebar-menu :deep(.el-menu-item:hover),
.sidebar-menu :deep(.el-menu-item.is-active) {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-name {
  font-size: 14px;
  color: var(--text-secondary);
}

.content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}
</style>