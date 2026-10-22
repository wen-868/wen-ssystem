<template>
  <!-- 灰度回滚路径：特征开关关闭时直接使用旧壳，行为与改动前一致 -->
  <MainLayout v-if="!shellEnabled" />

  <div v-else class="wb-shell" :class="{ 'is-ai': effectiveMode === 'ai' }">
    <header class="wb-topbar">
      <div class="wb-brand">
        <span class="wb-brand-name">智享全链</span>
        <span class="wb-crumb">{{ pageTitle }}</span>
      </div>

      <div v-if="!isCashierRoute" class="wb-mode-switch" role="tablist" aria-label="工作台模式">
        <button
          type="button"
          role="tab"
          class="wb-mode-item"
          :class="{ active: effectiveMode === 'human' }"
          :aria-selected="effectiveMode === 'human'"
          @click="switchMode('human')"
        >
          人工操作台
        </button>
        <button
          type="button"
          role="tab"
          class="wb-mode-item"
          :class="{ active: effectiveMode === 'ai' }"
          :aria-selected="effectiveMode === 'ai'"
          @click="switchMode('ai')"
        >
          AI 数字员工
        </button>
      </div>
      <div v-else class="wb-mode-badge">快速收银台</div>

      <div class="wb-topbar-right">
        <button v-if="isCashierRoute" type="button" class="wb-text-btn" @click="backToWorkbench">
          返回工作台
        </button>
        <span class="wb-user">{{ auth.userName }}</span>
        <button type="button" class="wb-text-btn" @click="handleLogout">退出登录</button>
      </div>
    </header>

    <!-- 人工操作台：二级导航（角色派生）+ 现有页面路由出口 -->
    <div v-if="effectiveMode === 'human'" class="wb-body">
      <nav v-if="isCashierRoute" class="wb-cashier-nav" aria-label="收银台导航">
        <button
          v-for="entry in visibleCashierItems"
          :key="entry.menuCode"
          type="button"
          class="wb-cashier-item"
          :class="{ active: isCashierActive(entry) }"
          :data-menu-code="entry.menuCode"
          @click="openCashierItem(entry)"
        >
          {{ entry.title }}
        </button>
      </nav>
      <ManualSidebar v-else :groups="visibleGroups" :active-path="route.path" @open="openManualItem" />
      <main class="wb-main">
        <router-view />
      </main>
    </div>

    <!-- AI 数字员工：一级 rail + 信息流容器 + 会话面板（骨架，不接写动作） -->
    <div v-else class="wb-ai-body">
      <AiNavRail
        :groups="visibleGroups"
        :active-group-code="selectedGroupCode"
        @select="selectedGroupCode = $event"
      />
      <AiFeedContainer
        :title="activeGroupTitle"
        :items="activeGroupItems"
        @open="openManualItem"
      />
      <AiChatPanel />
    </div>

    <!-- 收银台本机打印设置（沿用现有本地弹窗，不走路由） -->
    <PrintSettingsPanel v-model="printSettingsVisible" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import MainLayout from "./MainLayout.vue";
import ManualSidebar from "./ManualSidebar.vue";
import AiNavRail from "./AiNavRail.vue";
import AiFeedContainer from "../components/workbench/AiFeedContainer.vue";
import AiChatPanel from "../components/workbench/AiChatPanel.vue";
import PrintSettingsPanel from "../modules/print/PrintSettingsPanel.vue";
import { useAuthStore } from "../stores/auth";
import {
  CASHIER_ITEMS,
  MANUAL_GROUPS,
  filterVisibleGroups,
  filterVisibleItems,
  type ManifestItem,
} from "../shared/workbench/route-manifest";
import {
  isWorkbenchShellV2Enabled,
  setWorkbenchMode,
  workbenchMode,
  type WorkbenchMode,
} from "../shared/workbench/shell-mode";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

/** 特征开关在壳层装配时读取；切换后刷新页面生效（灰度回滚：localStorage wb.shell.v2=0） */
const shellEnabled = isWorkbenchShellV2Enabled();

/** 收银台路由强制人工模式，避免 AI 骨架覆盖收银作业面 */
const isCashierRoute = computed(() => route.path.startsWith("/pos/"));
const effectiveMode = computed<WorkbenchMode>(() =>
  isCashierRoute.value ? "human" : workbenchMode.value,
);

/** 路由记录只读索引：可见性统一从 route.meta.roles 派生（与守卫同一份声明） */
function resolveRoles(routeName: string): string[] | null {
  const record = router.getRoutes().find((entry) => entry.name === routeName);
  if (!record) return null; // 未知路由 fail-closed
  const roles = record.meta?.roles;
  if (!Array.isArray(roles)) return [];
  return roles.filter((role): role is string => typeof role === "string");
}

const visibleGroups = computed(() =>
  filterVisibleGroups(MANUAL_GROUPS, auth.userRoles, resolveRoles),
);
const visibleCashierItems = computed(() =>
  filterVisibleItems(CASHIER_ITEMS, auth.userRoles, resolveRoles),
);

const selectedGroupCode = ref("");
watch(
  visibleGroups,
  (groups) => {
    if (!groups.some((group) => group.groupCode === selectedGroupCode.value)) {
      selectedGroupCode.value = groups[0]?.groupCode ?? "";
    }
  },
  { immediate: true },
);

const activeGroup = computed(
  () => visibleGroups.value.find((group) => group.groupCode === selectedGroupCode.value) ?? null,
);
const activeGroupTitle = computed(() => activeGroup.value?.title ?? "AI 信息流");
const activeGroupItems = computed(() => activeGroup.value?.items ?? []);

const pageTitle = computed(() => {
  const metaTitle = route.meta?.title;
  return typeof metaTitle === "string" && metaTitle ? metaTitle : "工作台";
});

const printSettingsVisible = ref(false);

function switchMode(mode: WorkbenchMode): void {
  if (isCashierRoute.value) return;
  setWorkbenchMode(mode);
}

function openManualItem(entry: ManifestItem): void {
  if (!entry.path) return;
  setWorkbenchMode("human");
  router.push(entry.path);
}

function isCashierActive(entry: ManifestItem): boolean {
  if (!entry.path) return false;
  return route.path === entry.path || route.path.startsWith(`${entry.path}/`);
}

function openCashierItem(entry: ManifestItem): void {
  if (entry.action === "print-settings") {
    printSettingsVisible.value = true;
    return;
  }
  if (entry.path) router.push(entry.path);
}

function backToWorkbench(): void {
  router.push("/dashboard");
}

function handleLogout(): void {
  auth.clearAuth();
  ElMessage.success("已退出登录");
  router.push("/login");
}
</script>

<style scoped>
.wb-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-soft, #f7f8fa);
  overflow: hidden;
}

.wb-topbar {
  height: var(--topbar-height, 56px);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  background: var(--gray-0, #fff);
  border-bottom: 1px solid var(--border-light, #e5e7eb);
}

.wb-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}

.wb-brand-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.wb-crumb {
  font-size: 12px;
  color: #595959;
}

.wb-mode-switch {
  display: flex;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-soft, #f2f3f5);
}

.wb-mode-item {
  padding: 6px 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  color: #595959;
  cursor: pointer;
}

.wb-mode-item.active {
  background: var(--gray-0, #fff);
  color: var(--color-primary, #3f6fef);
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.wb-mode-badge {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-primary, #3f6fef);
}

.wb-topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.wb-user {
  font-size: 13px;
  color: var(--text-primary, #1f2937);
}

.wb-text-btn {
  padding: 4px 10px;
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 6px;
  background: var(--gray-0, #fff);
  font-size: 12px;
  color: #595959;
  cursor: pointer;
}

.wb-text-btn:hover {
  border-color: var(--color-primary, #3f6fef);
  color: var(--color-primary, #3f6fef);
}

.wb-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.wb-cashier-nav {
  width: 148px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--frost-sidebar, #1f2937);
  overflow-y: auto;
}

.wb-cashier-item {
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  color: var(--sidebar-text-secondary, #d1d5db);
  text-align: left;
  cursor: pointer;
}

.wb-cashier-item:hover,
.wb-cashier-item.active {
  background: rgba(255, 255, 255, 0.08);
  color: var(--sidebar-text-primary, #f9fafb);
}

.wb-main {
  flex: 1;
  min-width: 0;
  overflow: auto;
}

.wb-ai-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
</style>
