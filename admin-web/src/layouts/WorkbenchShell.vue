<template>
  <!-- 灰度回滚路径：特征开关关闭时直接使用旧壳，行为与改动前一致 -->
  <MainLayout v-if="!shellEnabled" />

  <div v-else class="wb-shell" :class="{ 'is-ai': effectiveMode === 'ai', 'is-cashier': isCashierRoute, 'side-hidden': sideCollapsed }" data-testid="wb-shell">
    <!-- ══ 一级模块图标栏（最左 · 常驻）＝原型 .rail（renderRail L2293）══ -->
    <nav class="wb-rail" aria-label="一级模块导航" data-testid="rail">
      <div class="wb-rail-logo" title="智享全链">智</div>
      <button
        type="button"
        class="wb-rail-item"
        :class="{ on: railKey === 'desk', alert: feedAlert }"
        data-rail-key="desk"
        :title="feedAlert ? '工作台 · 有新动态，点开查看' : '工作台 · 信息流'"
        @click="goDeskHome"
      >
        <el-icon :size="17"><MagicStick /></el-icon><span>工作台</span>
      </button>
      <button
        v-for="group in visibleGroups"
        :key="group.groupCode"
        type="button"
        class="wb-rail-item"
        :class="{ on: railKey === group.groupCode }"
        :data-rail-key="group.groupCode"
        :title="group.title"
        @click="openModule(group.groupCode)"
      >
        <el-icon :size="17"><component :is="groupIcon(group.groupCode)" /></el-icon><span>{{ group.title }}</span>
      </button>
      <span class="wb-rail-gap" />
      <button
        v-if="canOpenSystemSettings"
        type="button"
        class="wb-rail-item wb-rail-set"
        data-rail-key="set"
        title="系统设置"
        @click="openSettings"
      >
        <el-icon :size="17"><Setting /></el-icon><span>设置</span>
      </button>
    </nav>

    <!-- ══ 第二列上下文导航（常用功能/二级菜单 · 新对话 · 会话 · 账户）＝原型 .side（L923）══ -->
    <WorkbenchSubnav
      :class="{ hidden: sideCollapsed }"
      :mode="currentNavMode"
      :groups="visibleGroups"
      :active-group-code="selectedGroupCode"
      :active-path="route.path"
      :cashier-items="visibleCashierItems"
      :menu-state="menuState"
      :session-active="face === 'chat'"
      :user-name="auth.userName"
      :user-roles="auth.userRoles"
      @open="openManualItem"
      @open-cashier="openCashierItem"
      @new-chat="startNewConversation"
      @collapse="sideCollapsed = !sideCollapsed"
    />

    <div class="wb-main">
      <!-- ══ 顶部：Agent 状态 · 菜单状态 · 待审阅 · 任务进度 · 工作台/收银台胶囊 ══ -->
      <header class="wb-top">
        <button
          type="button"
          class="wb-icon-btn"
          data-testid="side-toggle"
          :aria-label="sideCollapsed ? '展开导航' : '收起导航'"
          @click="sideCollapsed = !sideCollapsed"
        >
          <el-icon :size="18"><Expand v-if="sideCollapsed" /><Fold v-else /></el-icon>
        </button>
        <span class="wb-top-title">{{ topTitle }}</span>

        <AgentStatusBar
          :readiness-state="aiReadiness.state"
          :pending-review-count="pendingReviewCount"
          :menu-state="menuState"
          @open-ledger="ledgerOpen = true"
          @retry-readiness="retryAiReadiness"
        />

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

        <!-- 工作台 ⇄ 收银台 胶囊（原型 renderModeSeg L1998：双向一键切换） -->
        <div class="wb-mode-seg" role="group" aria-label="工作台/收银台切换" data-testid="mode-seg">
          <button
            type="button"
            class="wb-mode-seg-item"
            :class="{ on: !isCashierRoute }"
            data-mode-seg="desk"
            @click="goDesk"
          >
            工作台
          </button>
          <button
            type="button"
            class="wb-mode-seg-item"
            :class="{ on: isCashierRoute }"
            data-mode-seg="pos"
            title="收银界面（管理面与收银一体，收银仅工作台人工态承载）"
            @click="goPos"
          >
            收银台
          </button>
        </div>

        <div class="wb-top-right">
          <span class="wb-user">{{ auth.userName }}</span>
          <button type="button" class="wb-text-btn" @click="handleLogout">退出</button>
        </div>
      </header>

      <!-- ══ 主面：feed（默认）⇄ chat ⇄ 人工业务页（router-view 常驻，按可见性切换层）══
           三层必须**互斥**：feed/chat 仅在 AI 模式显示，manual 仅在人工模式显示。
           若 feed 层漏掉 `effectiveMode === 'ai'`，会与 manual 层同时 shown
           ⇒ 主面被业务页盖住、信息流不可见（WORKBENCH-06 运行态截图实测发现并修正）。 -->
      <div class="wb-content">
        <main class="wb-view" :class="{ shown: effectiveMode === 'ai' && face === 'feed' && !isCashierRoute }" data-view="feed" data-testid="view-feed">
          <AiFeedView
            :user-name="auth.userName"
            :items="visibleEntryItems"
            :session-state="aiSessionState"
            :pending-review-count="pendingReviewCount"
            @ask="enterChatAndSend"
            @open="openManualItem"
            @open-chat="enterChat"
          />
        </main>
        <main class="wb-view" :class="{ shown: effectiveMode === 'ai' && face === 'chat' && !isCashierRoute }" data-view="chat" data-testid="view-chat">
          <AiChatPanel
            ref="chatPanel"
            class="wb-chat-main"
            style="width: 100%; flex: 1"
            @status="handleAiStatus"
            @fallback="switchMode('human')"
          />
        </main>
        <!-- 人工业务页：router-view 常驻（不得被条件渲染包裹 —— ai-primary 断言），收银路由亦走此层 -->
        <main class="wb-view wb-view-manual" :class="{ shown: effectiveMode === 'human' }" data-view="manual">
          <div
            v-if="menuState === 'ready' && visibleBusinessEntryCount === 0 && !isCashierRoute"
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

      <!-- ══ 底部固定 AI 输入区（原型 .input-zone L976：信息流/人工页常驻；人工页收为一条入口）
           ⚠️ chat 面**不渲染**以下输入条：会话主面内已有 AiSidePanel 的完整输入区（文本+图片+语音），
              再叠一条会出现**两个输入框**（WORKBENCH-06F1 运行态截图实测发现并修正）。
              原型同语义：对话态输入区在会话列内，信息流态才用底部 input-zone。 -->
      <AiChatComposer
        v-if="!showChatComposer"
        :compact="effectiveMode === 'human'"
        :streaming="aiSessionState === 'streaming'"
        @send="enterChatAndSend"
      />
    </div>

    <!-- AI 能力台账抽屉（WT-03 成果保留：从 feed「能力台账」入口打开，不占主面） -->
    <div v-if="ledgerOpen" class="wb-ledger-mask" data-testid="ledger-mask" @click="ledgerOpen = false" />
    <aside v-if="ledgerOpen" class="wb-ledger" data-testid="ledger-drawer" aria-label="AI 能力台账">
      <header class="wb-ledger-head">
        <span>AI 能力台账</span>
        <button type="button" class="wb-text-btn" @click="ledgerOpen = false">收起</button>
      </header>
      <div class="wb-ledger-body">
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
      </div>
    </aside>

    <!-- 收银台本机打印设置（沿用现有本地弹窗，不走路由） -->
    <PrintSettingsPanel v-model="printSettingsVisible" />
  </div>
</template>

<script setup lang="ts">
/**
 * 工作台壳层（WORKBENCH-06 · 原型结构对齐版）
 *
 * 结构 = 权威原型《智享全链_工作台电脑端_UI原型_融合版.html》三段式：
 *   rail(一级模块图标栏) | side(第二列上下文/会话/二级菜单) | main(默认信息流 feed ⇄ AI 会话 chat ⇄ 人工业务页)
 *   + 顶部 Agent 状态/菜单状态/工作台·收银台胶囊 + 底部固定 AI 输入区（人工页收为入口条）。
 * 权威原型 SHA256=6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51
 * 依据：docs/tasks/cards/R101-WORKBENCH-05-凌舟复核纠正-20261024.md §二（六维偏差表）
 *       + docs/tasks/inbox/WORKBENCH-06-prototype-structural-parity.md §一
 *
 * 能力保留（不得为视觉回退）：
 *   - 动态菜单 fail-closed（WORKBENCH-04）：fetchUserMenus → resolveMenuAccess → restrictManifestGroups；
 *   - 角色裁剪（04F1）：userRoles: auth.userRoles + meta.roles 同源；收银 9 项不吃 /menus/user 交集；
 *   - AI 故障回退（WORKBENCH-03）：AiChatPanel fallback → switchMode('human')，router-view 无条件渲染；
 *   - 灰度回滚（WORKBENCH-02/05）：wb.shell.v2 / VITE_WORKBENCH_SHELL_V2 双开关 + 旧壳分支；
 *   - 能力台账（WT-03/03F1）：AiFeedContainer 全量保留，改为抽屉承载（主面让位给原型信息流/会话）。
 * 数据纪律：feed/待审阅只用真实端点（GET /admin/notifications、AI /api/chat/confirmations）；
 *   端点失败 ⇒ 诚实错误态；无数据源的项（如「在线数」）不展示、不编造（登记回传卡）。
 */
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  MagicStick,
  Setting,
  Expand,
  Fold,
  DataAnalysis,
  Tickets,
  ShoppingCart,
  Goods,
  User,
  Box,
  Money,
  TrendCharts,
  Shop,
  Present,
  PieChart,
  Key,
  Grid,
} from "@element-plus/icons-vue";
import type { Component } from "vue";
import MainLayout from "./MainLayout.vue";
import WorkbenchSubnav from "./WorkbenchSubnav.vue";
import AgentStatusBar from "../components/workbench/AgentStatusBar.vue";
import AiFeedView from "../components/workbench/AiFeedView.vue";
import AiChatComposer from "../components/workbench/AiChatComposer.vue";
import AiFeedContainer from "../components/workbench/AiFeedContainer.vue";
import AiChatPanel from "../components/workbench/AiChatPanel.vue";
import PrintSettingsPanel from "../modules/print/PrintSettingsPanel.vue";
import { useAuthStore } from "../stores/auth";
import { getErrorMessage } from "../api/request";
import { fetchUserMenus } from "../api/workbench-menu";
import { fetchAiConfirmations } from "../api/ai";
import { aiReadiness, probeAiReadiness } from "../shared/workbench/ai-readiness";
import { loadAgentTopMetrics } from "../shared/workbench/agent-metrics";
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
  type MenuLoadState,
  type ServerMenuRow,
} from "../shared/workbench/menu-access";
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

/** 主面：feed=信息流（原型默认面）/ chat=AI 会话；仅 AI 模式内有层切换 */
type MainFace = "feed" | "chat";
const face = ref<MainFace>("feed");
const sideCollapsed = ref(false);
const ledgerOpen = ref(false);

function resolveRoles(routeName: string): string[] | null {
  const record = router.getRoutes().find((entry) => entry.name === routeName);
  if (!record) return null; // 未知路由 fail-closed
  const roles = record.meta?.roles;
  if (!Array.isArray(roles)) return [];
  return roles.filter((role): role is string => typeof role === "string");
}

const menuState = ref<MenuLoadState>("loading");
const menuRows = ref<ServerMenuRow[]>([]);
const access = computed(() =>
  resolveMenuAccess({
    state: menuState.value,
    rows: menuRows.value,
    manifestRouteNames: ALL_MANIFEST_ROUTE_NAMES,
    // 角色最终裁剪：auth.userRoles + 路由 meta.roles（与路由守卫同一语义）
    userRoles: auth.userRoles,
    resolveRoles,
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

/** AI 待审阅数（真实端点 /api/chat/confirmations；失败/未启动 ⇒ null 不展示，不编造） */
const pendingReviewCount = ref<number | null>(null);
let confirmTimer: number | undefined;

async function loadPendingReview(): Promise<void> {
  try {
    const rows = await fetchAiConfirmations();
    pendingReviewCount.value = Array.isArray(rows) ? rows.length : 0;
  } catch {
    pendingReviewCount.value = null; // 底座不可达/未登录：如实不可见，不显示 0 假装无待办
  }
}

onMounted(() => {
  loadMenus();
  loadPendingReview();
  // WORKBENCH-06F1：AI 可用性探针 + 顶部 Agent 真实数据（员工数 / 计划进度）。
  // 三者各自独立，互不阻塞（AI 不可达时菜单与人工页照常）。
  void probeAiReadiness();
  void loadAgentTopMetrics();
  confirmTimer = window.setInterval(() => {
    void loadPendingReview();
  }, 60_000);
});
onBeforeUnmount(() => {
  if (confirmTimer !== undefined) window.clearInterval(confirmTimer);
});

/** 手动重试就绪探测：绕过 60s 冷却但**不允许并发**（防请求风暴） */
function retryAiReadiness(): void {
  void probeAiReadiness({ force: true });
  void loadAgentTopMetrics();
}

const visibleRouteNameList = computed(() => [...access.value.visibleRouteNames]);

const visibleGroups = computed(() =>
  filterVisibleGroups(
    restrictManifestGroups(MANUAL_GROUPS, access.value.visibleRouteNames),
    auth.userRoles,
    resolveRoles,
  ),
);
/** 收银保底：只按路由 meta.roles 判定，不吃 /menus/user 交集（菜单失败/空集时也不清空收银导航） */
const visibleCashierItems = computed(() =>
  filterVisibleItems(CASHIER_ITEMS, auth.userRoles, resolveRoles),
);

/**
 * 业务入口数（**只算业务菜单项，不含收银保底**）。
 *
 * 与 04F1 裁定一致：收银 9 项按 meta.roles 保底、**不吃 /menus/user 交集** ⇒ 菜单为空/失败时
 * 收银导航仍应可用。因此「暂无可显示的菜单」空态只能由**业务入口为 0** 触发；
 * 若把收银项计入（旧写法 `+ visibleCashierItems.length`），空菜单时总数恒 ≥9，
 * 空态永不出现 —— 使 fail-closed 的"明示无可见菜单"承诺落空（WORKBENCH-06 运行态实测发现并修正）。
 */
const visibleBusinessEntryCount = computed(() =>
  visibleGroups.value.reduce((total, group) => total + group.items.length, 0),
);

/** 信息流「快速入口」：当前角色可见的真实入口（manifest 派生，不造数据） */
const visibleEntryItems = computed(() => visibleGroups.value.flatMap((group) => group.items));

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

/** 一级 rail 选中态：desk=信息流 / groupCode=模块 / pos=收银 / set=系统设置 */
const railKey = computed(() => {
  if (isCashierRoute.value) return "pos";
  if (route.name === "system") return "set";
  if (effectiveMode.value !== "ai" || face.value === "feed") {
    const owner = visibleGroups.value.find((group) =>
      group.items.some((item) => item.path && route.path.startsWith(item.path)),
    );
    return owner?.groupCode ?? "desk";
  }
  return selectedGroupCode.value;
});

const currentNavMode = computed<"quick" | "module" | "pos">(() => {
  if (isCashierRoute.value) return "pos";
  return effectiveMode.value === "ai" && face.value === "feed" && railKey.value === "desk"
    ? "quick"
    : "module";
});

const GROUP_ICONS: Record<string, Component> = {
  "wb.dashboard": DataAnalysis,
  "wb.order": Tickets,
  "wb.sales": Money,
  "wb.product": Goods,
  "wb.inventory": Box,
  "wb.customer": User,
  "wb.finance": TrendCharts,
  "wb.purchase": ShoppingCart,
  "wb.instant-retail": Shop,
  "wb.marketing": Present,
  "wb.report": PieChart,
  "wb.system": Key,
};
function groupIcon(groupCode: string): Component {
  return GROUP_ICONS[groupCode] ?? Grid;
}

const topTitle = computed(() => {
  if (isCashierRoute.value) return "收银台";
  if (effectiveMode.value === "human") return pageTitle.value;
  return face.value === "feed" ? "工作台" : "智享AI";
});

const pageTitle = computed(() => {
  const metaTitle = route.meta?.title;
  return typeof metaTitle === "string" && metaTitle ? metaTitle : "工作台";
});

/**
 * chat 面是否隐藏底部输入条。
 * 会话主面（AiSidePanel）自带完整输入区 ⇒ 外层输入条隐藏，避免"两个输入框"重复控件。
 * feed 面与人工面仍显示（feed 要"直接发消息"、人工面保留协同入口，均为派单卡明确要求）。
 */
const showChatComposer = computed(() => effectiveMode.value === "ai" && face.value === "chat" && !isCashierRoute.value);

/** 有新动态 ⇒ rail 工作台按钮红闪（feedAlert）：未读数增长由 feed 视图上报，这里用待审阅>0 驱动（真实数据） */
const feedAlert = computed(() => (pendingReviewCount.value ?? 0) > 0 && face.value !== "feed");

const printSettingsVisible = ref(false);

const aiSessionState = ref<"idle" | "streaming" | "error">("idle");
const chatPanel = ref<{
  sendQuickCommand?: (text: string) => void;
  newConversation?: () => void;
} | null>(null);

function handleAiStatus(payload: { state: "idle" | "streaming" | "error" }): void {
  aiSessionState.value = payload.state;
}

function sendQuickCommand(prompt: string): void {
  chatPanel.value?.sendQuickCommand?.(prompt);
}

function startNewConversation(): void {
  setWorkbenchMode("ai");
  face.value = "chat";
  chatPanel.value?.newConversation?.();
}

/** 底部输入区 / feed 提问：切 AI 会话面并发送（原型：信息流态直接发消息） */
function enterChatAndSend(prompt: string): void {
  setWorkbenchMode("ai");
  face.value = "chat";
  nextTick(() => chatPanel.value?.sendQuickCommand?.(prompt));
}
function enterChat(): void {
  setWorkbenchMode("ai");
  face.value = "chat";
}

const currentItem = computed<ManifestItem | null>(() => {
  const routeName = typeof route.name === "string" ? route.name : "";
  if (!routeName) return null;
  return ALL_MANIFEST_ITEMS.find((entry) => entry.routeName === routeName) ?? null;
});

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

const showDelegateButton = computed(
  () =>
    !isCashierRoute.value &&
    Boolean(currentItem.value) &&
    isRouteVisible(currentItem.value?.routeName, access.value.visibleRouteNames),
);

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

async function delegateCurrentPage(): Promise<void> {
  const delegation = pageDelegation.value;
  if (!delegation) return;
  setWorkbenchMode("ai");
  face.value = "chat";
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

/** rail：工作台（信息流默认面）/ 模块选择 / 设置 */
function goDeskHome(): void {
  setWorkbenchMode("ai");
  face.value = "feed";
  if (route.path !== "/dashboard") router.push("/dashboard").catch(() => undefined);
}
function openModule(groupCode: string): void {
  selectedGroupCode.value = groupCode;
  setWorkbenchMode("ai");
  face.value = "feed";
}
const canOpenSystemSettings = computed(() => {
  const roles = resolveRoles("system");
  return Boolean(roles && roles.length > 0 && auth.userRoles.some((r) => roles.includes(r)));
});
function openSettings(): void {
  setWorkbenchMode("human");
  router.push("/system");
}

/** 顶部胶囊：工作台 ⇄ 收银台 */
function goDesk(): void {
  if (isCashierRoute.value) goDeskHome();
}
function goPos(): void {
  if (!isCashierRoute.value) router.push("/pos/dashboard");
}

function backToWorkbench(): void {
  goDeskHome();
}

function handleLogout(): void {
  auth.clearAuth();
  ElMessage.success("已退出登录");
  router.push("/login");
}

defineExpose({ backToWorkbench, isCashierActive, goDeskHome, face, topTitle });
</script>

<style scoped>
.wb-shell {
  height: 100vh;
  display: grid;
  /* 第二列收起用 grid 列宽过渡（对齐原型 .side{transition:margin .25s} 的平滑滑出手感）；
     不用 display:none 瞬隐 —— WORKBENCH-06F3 审计 MISSING #3 修复。 */
  grid-template-columns: var(--wb-rail-w, 64px) var(--wb-side-w, 230px) minmax(0, 1fr);
  transition: grid-template-columns 250ms ease;
  background: var(--wb-bg, #f4f6f8);
  overflow: hidden;
}
.wb-shell.side-hidden {
  grid-template-columns: var(--wb-rail-w, 64px) 0 minmax(0, 1fr);
}
/* 收起态：内容溢出裁掉 + 不做 visibility 切换，保证过渡期间可见滑出 */
.wb-shell :deep(.wb-subnav.hidden) {
  overflow: hidden;
}
/* 收银台：不渲染 AI 会话层的宽度挤压，仍保持三段（原型 side=收银功能列表） */

/* ── 一级 rail ── */
.wb-rail {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  padding: 8px 4px;
  background: var(--wb-panel, #ffffff);
  border-right: 1px solid var(--wb-line, #eceef1);
  overflow-y: auto;
  scrollbar-width: none;
}
.wb-rail::-webkit-scrollbar {
  display: none;
}
.wb-rail-logo {
  width: 36px;
  height: 36px;
  margin: 0 auto 8px;
  border-radius: 9px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wb-rail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 2px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--wb-ink2, #8a8f98);
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
  /* 对齐原型 L122 `.rl-it{transition:.15s}`（WORKBENCH-06F3 MISSING #1） */
  transition: background-color 150ms ease, color 150ms ease;
}
.wb-rail-item:hover {
  background: var(--wb-hover, #f4f6f8);
  color: var(--wb-ink, #16181d);
}
.wb-rail-item.on {
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
}
/**
 * 有新动态时整块红闪（对齐原型 L187 `.rl-it.alert{background:#DC2626;animation:rlFlash 1.1s}`）。
 * ⚠️ WORKBENCH-06F3 审计 MISSING #2 根因：旧版只设了 `color`，而 keyframes 只改 `background`
 *    ⇒ 底色始终是父级透明，闪烁视觉不成立。此处补 `background`（动画期间由 keyframes 接管）。
 */
.wb-rail-item.alert {
  background: #dc2626;
  color: #fff;
  animation: wb-rail-blink 1.1s ease-in-out infinite;
}
.wb-rail-item.alert :deep(.el-icon) {
  color: #fff;
}
@keyframes wb-rail-blink {
  0%, 100% {
    background: #dc2626;
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.45);
  }
  50% {
    background: #f87171;
    box-shadow: 0 0 0 6px rgba(220, 38, 38, 0);
  }
}
.wb-rail-gap {
  flex: 1;
}
.wb-rail-set {
  margin-top: 6px;
  border-top: 1px solid var(--wb-line, #eceef1);
  border-radius: 0;
  padding-top: 10px;
}

/* ── main 区 ── */
.wb-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.wb-top {
  height: 50px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  background: var(--wb-panel, #ffffff);
  border-bottom: 1px solid var(--wb-line, #eceef1);
}
.wb-icon-btn {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--wb-ink2, #8a8f98);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.wb-icon-btn:hover {
  background: var(--wb-hover, #f4f6f8);
}
.wb-top-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
  white-space: nowrap;
}
.wb-top-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.wb-user {
  font-size: 13px;
  color: var(--wb-ink, #16181d);
}
.wb-text-btn {
  padding: 4px 10px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 6px;
  background: var(--wb-panel, #fff);
  font-size: 12px;
  color: #595959;
  cursor: pointer;
}
.wb-text-btn:hover {
  border-color: var(--wb-primary, #2563eb);
  color: var(--wb-primary, #2563eb);
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
  border-color: var(--wb-primary, #2563eb);
  color: var(--wb-primary, #2563eb);
}

/* 工作台/收银台胶囊（原型 .mode-seg） */
.wb-mode-seg {
  display: flex;
  padding: 2px;
  border-radius: 999px;
  background: var(--wb-hover, #f4f6f8);
  border: 1px solid var(--wb-line, #eceef1);
  margin-left: 8px;
}
.wb-mode-seg-item {
  padding: 4px 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font-size: 12px;
  color: var(--wb-ink2, #8a8f98);
  cursor: pointer;
  /* 对齐原型 L87 `.ms{transition:…}`（WORKBENCH-06F3 MISSING #8） */
  transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
}
/**
 * 对齐原型 L88 `.ms:hover{color:var(--ink)}`。
 * ⚠️ WORKBENCH-06F3 二轮审计发现：此前只有 transition 与 `.on` 态、**缺 hover 规则**
 *    ⇒ 未选中项悬停无任何视觉反馈（原型有）。此为审计新增发现的真缺陷。
 */
.wb-mode-seg-item:hover {
  color: var(--wb-ink, #16181d);
}
/* 选中项悬停保持主色（原型 `.ms.on` 特异性更高，这里显式声明意图，避免被 hover 覆盖成黑） */
.wb-mode-seg-item.on:hover {
  color: var(--wb-primary, #2563eb);
}
.wb-mode-seg-item.on {
  background: var(--wb-panel, #fff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

/* ── 主面层（feed/chat/manual 同层堆叠，feed/chat 可滚动） ── */
.wb-content {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
}
.wb-view {
  position: absolute;
  inset: 0;
  display: none;
  min-width: 0;
}
.wb-view.shown {
  display: flex;
  flex-direction: column;
}
.wb-view-manual {
  background: var(--wb-bg, #f4f6f8);
}
.wb-view-manual.shown {
  overflow: auto;
}
.wb-view-manual > :deep(*) {
  flex: 1;
  min-width: 0;
}
.wb-chat-main {
  flex: 1;
  min-height: 0;
  width: 100%;
}
/* 会话主面：既有 AiChatPanel 是 360px 侧栏形态，嵌入主面时铺满（不改其内部实现） */
.wb-view[data-view="chat"] :deep(.acp) {
  width: 100%;
  flex: 1;
}

.wb-menu-empty {
  margin: 24px;
  padding: 20px 24px;
  border: 1px dashed var(--wb-line, #e5e7eb);
  border-radius: 8px;
  background: var(--wb-panel, #fff);
}
.wb-menu-empty-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
}
.wb-menu-empty-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #595959;
}

/* ── 能力台账抽屉 ── */
.wb-ledger-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 40;
}
.wb-ledger {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(720px, 92vw);
  background: var(--wb-panel, #fff);
  z-index: 41;
  display: flex;
  flex-direction: column;
  box-shadow: -12px 0 32px rgba(15, 23, 42, 0.18);
}
.wb-ledger-head {
  height: 50px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--wb-line, #eceef1);
  font-size: 14px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
}
.wb-ledger-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>
