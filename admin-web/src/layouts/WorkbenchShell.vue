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

      <!-- 动态菜单状态：失败/加载中不显示全量；明示重试与联系入口 -->
      <span v-if="menuState === 'loading'" class="wb-menu-state" data-testid="menu-loading">
        正在加载权限菜单…
      </span>
      <span v-else-if="menuState === 'error'" class="wb-menu-state is-error" role="alert" data-testid="menu-fault">
        菜单加载失败（不回退全量菜单）
        <button type="button" class="wb-text-btn" data-testid="menu-retry" @click="loadMenus">重试</button>
        <span class="wb-menu-contact">若持续失败请联系管理员</span>
      </span>
      <button
        v-if="showDelegateButton"
        type="button"
        class="wb-text-btn wb-delegate"
        data-testid="ai-delegate-current"
        @click="delegateCurrentPage"
      >
        AI 代办当前页
      </button>

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
        <div
          v-if="menuState === 'ready' && visibleEntryCount === 0"
          class="wb-menu-empty"
          data-testid="menu-empty"
          role="status"
        >
          <p class="wb-menu-empty-title">当前账号暂无可显示的菜单</p>
          <p class="wb-menu-empty-desc">{{ access.notice }}；请重试或联系管理员开通权限（不会回退全量菜单）。</p>
        </div>
        <router-view />
      </main>
    </div>

    <!-- AI 数字员工：一级 rail + 主交互面 + 会话面板（真实对话；故障可一键回人工） -->
    <div v-else class="wb-ai-body">
      <AiNavRail
        :groups="visibleGroups"
        :active-group-code="selectedGroupCode"
        @select="selectedGroupCode = $event"
      />
      <AiFeedContainer
        :title="activeGroupTitle"
        :items="activeGroupItems"
        :session-state="aiSessionState"
        :visible-route-names="visibleRouteNameList"
        :menu-notice="access.notice"
        @open="openManualItem"
        @command="sendQuickCommand"
        @new-conversation="startNewConversation"
      />
      <AiChatPanel
        ref="chatPanel"
        @status="handleAiStatus"
        @fallback="switchMode('human')"
      />
    </div>

    <!-- 收银台本机打印设置（沿用现有本地弹窗，不走路由） -->
    <PrintSettingsPanel v-model="printSettingsVisible" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import MainLayout from "./MainLayout.vue";
import ManualSidebar from "./ManualSidebar.vue";
import AiNavRail from "./AiNavRail.vue";
import AiFeedContainer from "../components/workbench/AiFeedContainer.vue";
import AiChatPanel from "../components/workbench/AiChatPanel.vue";
import PrintSettingsPanel from "../modules/print/PrintSettingsPanel.vue";
import { useAuthStore } from "../stores/auth";
import { getErrorMessage } from "../api/request";
import { fetchUserMenus } from "../api/workbench-menu";
import {
  ALL_MANIFEST_ITEMS,
  ALL_MANIFEST_ROUTE_NAMES,
  CASHIER_ITEMS,
  MANUAL_GROUPS,
  filterVisibleGroups,
  filterVisibleItems,
  type ManifestItem,
} from "../shared/workbench/route-manifest";
import {
  isRouteVisible,
  resolveMenuAccess,
  restrictManifestGroups,
  restrictManifestItems,
  type MenuLoadState,
  type ServerMenuRow,
} from "../shared/workbench/menu-access";
import { PARITY_ACTION_ROWS } from "../shared/workbench/parity-ledger";
import { buildPageDelegation, selectPageActionRows } from "../shared/workbench/ai-bridge";
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

/**
 * 动态菜单（WORKBENCH-04）：服务端 menuCode 集为运行时真理，静态 manifest 只做组件白名单。
 * fail-closed：加载中 / 失败 / 空集 / 未知码一律最小可见集，不回退全量菜单。
 */
const menuState = ref<MenuLoadState>("loading");
const menuRows = ref<ServerMenuRow[]>([]);
const access = computed(() =>
  resolveMenuAccess({
    state: menuState.value,
    rows: menuRows.value,
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
  }),
);

async function loadMenus(): Promise<void> {
  menuState.value = "loading";
  try {
    menuRows.value = await fetchUserMenus();
    menuState.value = "ready";
  } catch (error) {
    // 失败即空集：不保留旧的全量菜单，避免越权透传
    menuRows.value = [];
    menuState.value = "error";
    ElMessage.error(`权限菜单加载失败：${getErrorMessage(error, "接口不可用")}`);
  }
}

onMounted(loadMenus);

/** 人工与 AI 共用同一份可见 routeName 集合（同源，不允许两侧各算一套） */
const visibleRouteNameList = computed(() => [...access.value.visibleRouteNames]);

const visibleGroups = computed(() =>
  filterVisibleGroups(
    restrictManifestGroups(MANUAL_GROUPS, access.value.visibleRouteNames),
    auth.userRoles,
    resolveRoles,
  ),
);
const visibleCashierItems = computed(() =>
  filterVisibleItems(
    restrictManifestItems(CASHIER_ITEMS, access.value.visibleRouteNames),
    auth.userRoles,
    resolveRoles,
  ),
);

const visibleEntryCount = computed(
  () =>
    visibleGroups.value.reduce((total, group) => total + group.items.length, 0) +
    visibleCashierItems.value.length,
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

/** AI 会话面板上报的真实状态（仅客户端观测，不臆造“在线”） */
const aiSessionState = ref<"idle" | "streaming" | "error">("idle");
const chatPanel = ref<{
  sendQuickCommand?: (text: string) => void;
  newConversation?: () => void;
} | null>(null);

function handleAiStatus(payload: { state: "idle" | "streaming" | "error" }): void {
  aiSessionState.value = payload.state;
}

/** 快捷经营指令：复用右侧面板的真实发送逻辑（POST /api/chat） */
function sendQuickCommand(prompt: string): void {
  chatPanel.value?.sendQuickCommand?.(prompt);
}

function startNewConversation(): void {
  chatPanel.value?.newConversation?.();
}

/** 当前路由对应的白名单入口（静态 manifest 只读索引） */
const currentItem = computed<ManifestItem | null>(() => {
  const routeName = typeof route.name === "string" ? route.name : "";
  if (!routeName) return null;
  return ALL_MANIFEST_ITEMS.find((entry) => entry.routeName === routeName) ?? null;
});

/** 当前路由参数中的实体 ID（无则 null，上下文如实标注“未提供”） */
function resolveCurrentEntityId(): string | null {
  for (const value of Object.values(route.params)) {
    if (typeof value === "string" && value) return value;
  }
  for (const key of ["id", "entityId"]) {
    const value = route.query[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

/** AI 代办按钮：仅当前页在白名单内且服务端菜单可见时出现（不可见页不提供代办入口） */
const showDelegateButton = computed(
  () =>
    !isCashierRoute.value &&
    Boolean(currentItem.value) &&
    isRouteVisible(currentItem.value?.routeName, access.value.visibleRouteNames),
);

/** 代办上下文：动作行取自静态台账，不新增第二套动作目录 */
const pageDelegation = computed(() => {
  const entry = currentItem.value;
  if (!entry || !entry.routeName || !entry.path) return null;
  return buildPageDelegation({
    menuCode: entry.menuCode,
    title: entry.title,
    routeName: entry.routeName,
    path: entry.path,
    entityId: resolveCurrentEntityId(),
    actionRows: selectPageActionRows([entry.routeName]),
  });
});

/** 「AI 代办当前页」：切到 AI 模式，只把上下文交给既有会话；写操作仍走确认链 */
async function delegateCurrentPage(): Promise<void> {
  const delegation = pageDelegation.value;
  if (!delegation) return;
  setWorkbenchMode("ai");
  await nextTick();
  chatPanel.value?.sendQuickCommand?.(delegation.prompt);
  if (delegation.blockedCount > 0) {
    ElMessage.warning(
      `${delegation.blockedCount} 项动作不能代办，已在上下文中给出人工回退路径`,
    );
  }
}

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

.wb-menu-state {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #595959;
}

.wb-menu-state.is-error {
  padding: 4px 10px;
  border: 1px solid #f0c2c2;
  border-radius: 6px;
  background: #fdf2f2;
  color: #b42318;
}

.wb-menu-contact {
  font-size: 12px;
  color: inherit;
  opacity: 0.8;
}

.wb-delegate {
  border-color: var(--color-primary, #3f6fef);
  color: var(--color-primary, #3f6fef);
}

.wb-menu-empty {
  margin: 24px;
  padding: 20px 24px;
  border: 1px dashed var(--border-light, #e5e7eb);
  border-radius: 8px;
  background: var(--gray-0, #fff);
}

.wb-menu-empty-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.wb-menu-empty-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #595959;
}
</style>
