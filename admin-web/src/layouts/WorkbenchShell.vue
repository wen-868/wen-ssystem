<template>
  <!-- 灰度回滚路径：特征开关关闭时直接使用旧壳，行为与改动前一致 -->
  <MainLayout v-if="!shellEnabled" />

  <div v-else class="wb-shell" data-wb-scope="workbench" :class="{ 'is-ai': effectiveMode === 'ai', 'is-cashier': isCashierRoute, 'side-hidden': sideCollapsed, 'tc-collapsed': taskCenterCollapsed, 'is-narrow': isNarrow }" :data-uiux-inject="uiuxInjected ? 'on' : 'off'" data-testid="wb-shell">
    <!-- 注入态水印：截图即自证这不是生产权限态（仅 ?wb_uiux=12-groups 的开发态渲染） -->
    <div v-if="uiuxInjected" class="wb-uiux-flag" data-testid="uiux-inject-flag">{{ WB_UIUX_INJECT_WATERMARK }}</div>
    <!-- ══ 一级模块图标栏（最左 · 常驻）＝原型 .rail（renderRail L2293）══ -->
    <nav class="wb-rail" aria-label="一级模块导航" data-testid="rail">
      <div class="wb-rail-logo" title="智享全链">
        <img :src="brandLogo" alt="智享全链" />
      </div>
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
      <!-- 11 个一级业务模块：顺序与文案一律取原型真相源，可见性仍由 meta.roles 派生 -->
      <button
        v-for="group in railModules"
        :key="group.protoKey"
        type="button"
        class="wb-rail-item"
        :class="{ on: railKey === group.groupCode }"
        :data-rail-key="group.groupCode"
        :data-proto-key="group.protoKey"
        :title="group.protoTitle"
        @click="toggleModule(group.groupCode)"
      >
        <el-icon :size="17"><component :is="groupIcon(group.groupCode)" /></el-icon><span>{{ group.protoLabel }}</span>
      </button>
      <!--
        WORKBENCH-13（卡 §三.10 冷启动首击）：加载期占位骨架。
        真实模块位还没出现时也保留 13 项 rail 结构，点击记录意图并在 ready 后自动选中，
        避免「首击落空、必须点第二次」。
      -->
      <button
        v-for="group in railSkeletons"
        :key="`sk-${group.protoKey}`"
        type="button"
        class="wb-rail-item is-rail-skeleton"
        :class="{ 'is-pending': pendingRailGroup === group.groupCode }"
        :data-rail-key="group.groupCode"
        data-rail-skeleton="true"
        :aria-busy="pendingRailGroup === group.groupCode ? 'true' : 'false'"
        :aria-pressed="pendingRailGroup === group.groupCode ? 'true' : 'false'"
        :aria-label="`${group.protoTitle}（权限菜单加载中：点击或按回车/空格记录进入意图，非真实入口）`"
        :title="`${group.protoTitle}（权限菜单加载中）`"
        @click="clickRailSkeleton(group.groupCode)"
      >
        <el-icon :size="17"><component :is="groupIcon(group.groupCode)" /></el-icon><span>{{ group.protoLabel }}</span>
      </button>
      <span class="wb-rail-gap" />
      <button
        v-if="canOpenSystemSettings"
        type="button"
        class="wb-rail-item wb-rail-set"
        data-rail-key="set"
        title="设置"
        aria-label="打开设置"
        @click="openSettings"
      >
        <el-icon :size="17"><Setting /></el-icon>
      </button>
      <el-popover
        placement="right-end"
        trigger="click"
        :width="210"
        popper-class="wb-rail-account-pop"
        data-testid="rail-account-popover"
      >
        <template #reference>
          <button
            type="button"
            class="wb-rail-account"
            data-testid="rail-account"
            :aria-label="`账号：${auth.userName}，打开账号菜单`"
            :title="auth.userName"
          >
            {{ (auth.userName || "智").slice(0, 1) }}
          </button>
        </template>
        <div class="wb-rail-account-card" data-testid="rail-account-menu">
          <strong>{{ auth.userName || "未登录" }}</strong>
          <span>{{ auth.userRoles.join(" · ") || "未登录" }}</span>
          <button type="button" class="is-danger" data-testid="rail-account-logout" @click="handleLogout">退出登录</button>
        </div>
      </el-popover>
    </nav>

    <!-- ══ 第二列上下文导航（常用功能/二级菜单 · 新对话 · 会话 · 账户）＝原型 .side（L923）══ -->
    <!--
      WORKBENCH-13-F2：groups 传 railGroups（**只按 meta.roles 派生**的一级结构），
      供第二列折叠缩略条与模块标题使用；真实可打开的入口仍由壳层的 bridge 派生
      （visibleEntryItems / 空态判定 = visibleGroups），二者口径互不放宽（见脚本注释）。
      设置入口改由账户区（teammate 在第二列底部新增、emit open-settings）承载 → 打开设置中心。
    -->
    <WorkbenchSubnav
      :class="{ hidden: sideCollapsed }"
      :collapsed="sideCollapsed"
      :mode="currentNavMode"
      :groups="railGroups"
      :active-group-code="selectedGroupCode"
      :active-path="route.path"
      :cashier-items="visibleCashierItems"
      :menu-state="menuState"
      :session-active="face === 'chat'"
      :cashier-active="isCashierRoute"
      :production-snapshot="effectiveCapabilities"
      :menu-usage="menuUsage"
      @open="openManualItem"
      @open-cashier="openCashierItem"
      @go-desk="goDesk"
      @go-pos="goPos"
      @new-chat="startNewConversation"
      @collapse="sideCollapsed = !sideCollapsed"
    />

    <!-- 窄视口抽屉遮罩：点空白处收起二级导航（仅 ≤390px 渲染） -->
    <div
      v-if="isNarrow && !sideCollapsed"
      class="wb-side-mask"
      data-testid="side-mask"
      @click="sideCollapsed = true"
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
          <WorkbenchChromeToggleIcon :mirrored="sideCollapsed" />
        </button>
        <span class="wb-top-title">{{ topTitle }}</span>

        <!--
          顶栏要素收敛（UI-PARITY-BASE 卡 §四.2.5 + DELTA-CONTRACT top_bar）：
          仅保留 菜单开关 / 日常经营标题 / 待审阅徽标 / 工作台·收银台 / 任务中心开关。
          旧「研发健康指标（探针灯）/ 数字员工数 / 无上下文步骤计数 / 能力台账」已按合同移除，
          AgentStatusBar 收敛为待审阅徽标容器（其余数据在任务中心与对话面各自承载）。
        -->
        <AgentStatusBar :pending-review-count="pendingReviewCount" />

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

        <div class="wb-top-right">
          <!-- 任务中心开关（合同 top_bar.right 唯一右侧业务要素）：收起后第 4 列为 0px，这里是唯一常驻重开入口 -->
          <button
            v-if="taskCenterCollapsed"
            type="button"
            class="wb-icon-btn wb-tc-toggle"
            data-testid="task-center-toggle"
            :aria-pressed="taskCenterCollapsed ? 'false' : 'true'"
            :aria-label="taskCenterCollapsed ? '展开任务中心' : '收起任务中心'"
            :title="taskCenterCollapsed ? '展开任务中心' : '收起任务中心'"
            @click="toggleTaskCenter"
          >
            <WorkbenchChromeToggleIcon mirrored />
          </button>
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
            @open-form="openAiNativeForm"
          />
        </main>
        <!-- 人工业务页：router-view 常驻（不得被条件渲染包裹 —— ai-primary 断言），收银路由亦走此层 -->
        <main class="wb-view wb-view-manual" :class="{ shown: effectiveMode === 'human' }" data-view="manual">
          <!--
            ⚠️ WORKBENCH-13 修复（卡 §三.1「菜单空态污染业务页」）：
            原缺陷：空态块与 `<router-view />` 是**并列兄弟节点**（原 L171-180），只要
            `menuState==='ready'` 且可见菜单交集为 0，空态就渲染在业务页上方，把已打开的人工页
            挤下去/盖住（典型：SUPER_ADMIN 直链一个已授权业务页，但菜单桥交集为空 ⇒ 页面本体被压）。

            修法（保持 ai-primary.spec「router-view 不得被 AI 状态条件渲染」的既有断言）：
              · `<router-view />` 仍然**无条件常驻**（不加 v-if）；
              · 空态改为**绝对定位的覆盖层**，只在 `showMenuEmptyState` 为真时出现，
                且带上页面级豁免：当前路由只要**有真实页面可渲染**（业务路由命中）就不显示空态；
              · 因此「空态」与「页面」是**层级互斥**（同一时刻空态在最上层且页面被明确提示），
                而不是并列挤压 —— 不会再出现页面被空态推走/遮挡而不可用的情形。
          -->
          <div
            v-if="showMenuEmptyState"
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

    <!--
      AI 能力台账抽屉已按 UI-PARITY-BASE 合同移除（top_bar.forbidden: 能力台账）。
      能力目录事实源（capability-entries）保留在 shared 层供对话面/设置中心引用，此处不再挂抽屉。
    -->

    <!-- 收银台本机打印设置（沿用现有本地弹窗，不走路由） -->
    <PrintSettingsPanel ref="printPanelRef" v-model="printSettingsVisible" />

    <!-- ══ 任务中心（第 4 列 · 300px · 原型四列壳层 Prototype-12）══
         收起 = 整列 0px（卡 §四.1.4：不是 56px 窄条），重开走顶栏 task-center-toggle；
         无真实待办时默认收起、有待办默认展开（合同 task_center.default），
         用户显式偏好（localStorage wb.task-center.collapsed）优先于默认。
         窄视口（≤390px）整列随单列降级（见样式 media 块）。 -->
    <WorkbenchTaskCenter
      :collapsed="taskCenterCollapsed"
      @toggle="toggleTaskCenter"
      @settle="onTaskCenterSettle"
    />

    <!-- 设置中心（原型 .sw L2507-2603 · 7 分区 + 角色差异 + 明暗主题） -->
    <WbSettingsCenter
      v-model="settingsCenterVisible"
      :user-roles="auth.userRoles"
      :resolve-roles="resolveRoles"
      :account="settingsAccount"
      :system-entries="settingsSystemEntries"
      @logout="handleLogout"
      @open-print-settings="openPrintSettingsFromCenter"
      @open-system-config="openSystemConfigPage"
      @open-system-entry="openSystemManagementEntry"
    />
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
 *   - 能力台账（WT-03/03F1 → UI-PARITY-BASE）：能力目录事实源保留在 shared 层（capability-entries），
 *     顶栏/抽屉承载按 DELTA-CONTRACT top_bar.forbidden 移除（能力台账不再是顶栏要素）。
 * 数据纪律：feed/待审阅只用真实端点（GET /admin/notifications、AI /api/chat/confirmations）；
 *   端点失败 ⇒ 诚实错误态；无数据源的项（如「在线数」）不展示、不编造（登记回传卡）。
 */
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  MagicStick,
  Setting,
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
import brandLogo from "../assets/logo.png";
import MainLayout from "./MainLayout.vue";
import WorkbenchSubnav from "./WorkbenchSubnav.vue";
import AgentStatusBar from "../components/workbench/AgentStatusBar.vue";
import WorkbenchTaskCenter from "../components/workbench/WorkbenchTaskCenter.vue";
import AiFeedView from "../components/workbench/AiFeedView.vue";
import AiChatComposer from "../components/workbench/AiChatComposer.vue";
import AiChatPanel from "../components/workbench/AiChatPanel.vue";
import PrintSettingsPanel from "../modules/print/PrintSettingsPanel.vue";
import WbSettingsCenter from "../components/workbench/WbSettingsCenter.vue";
import WorkbenchChromeToggleIcon from "../components/workbench/WorkbenchChromeToggleIcon.vue";
import { WB_NARROW_MEDIA_QUERY } from "../shared/workbench/wb-viewport";
import { checkWebUpdate } from "../modules/update/checker";
import { useAuthStore } from "../stores/auth";
import { getErrorMessage } from "../api/request";
import { fetchUserMenus } from "../api/workbench-menu";
import { fetchAiConfirmations } from "../api/ai";
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
import { resolveEffectiveCapabilities } from "../shared/workbench/effective-capabilities";
import {
  WB_UIUX_INJECT_WATERMARK,
  readUiuxInjection,
  shouldSkipMenuBridgeTrimming,
} from "../shared/workbench/wb-uiux-injection";
import { buildPageDelegation, selectPageActionRows } from "../shared/workbench/ai-bridge";
import {
  isWorkbenchShellV2Enabled,
  setWorkbenchMode,
  workbenchMode,
  type WorkbenchMode,
} from "../shared/workbench/shell-mode";
import {
  decorateRailGroups,
  toggleRailSelection,
  RAIL_FIXED_KEY_BY_GROUP,
} from "../shared/workbench/prototype-nav";
import { readMenuUsage, recordMenuUsage } from "../shared/workbench/menu-usage";
import type { AiNativeFormAction } from "../shared/workbench/ai-form-bridge";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

/** 特征开关在壳层装配时读取；切换后刷新页面生效（灰度回滚：localStorage wb.shell.v2=0） */
const shellEnabled = isWorkbenchShellV2Enabled();

/** 收银台路由强制人工模式，避免 AI 骨架覆盖收银作业面 */
const isCashierRoute = computed(() => route.path.startsWith("/pos/"));

/**
 * ⚠️ WORKBENCH-13 修复（卡 §三.3「深链接隐藏」的根因）：
 *
 * 缺陷现象：直接打开/刷新 `/purchase-orders` 等受权业务路由时，**URL 已是业务页，但界面仍是 AI 面**。
 * 根因（file:line 证据）：
 *   ① `shell-mode.ts:59-61` `workbenchMode` 默认 `"ai"`，且只由用户主动操作时 `setWorkbenchMode` 改写；
 *   ② `WorkbenchShell.vue:335-337` `effectiveMode` **只对 `/pos/*` 特判**（`isCashierRoute`），
 *      其余业务路由完全跟随持久化的 `workbenchMode`；
 *   ③ 全仓 `setWorkbenchMode` 调用点（`:585/:592/:597/:641/:654/:659/:680/:692/:707`）**全部是用户交互触发**，
 *      没有任何「路由 → 模式」的同步；`router/index.ts` 的 `beforeEach` 也只处理鉴权，不碰模式。
 *   ⇒ 冷启动深链接时 `effectiveMode==="ai" && face==="feed"` ⇒ AI 面 `shown`，人工层不 `shown` ⇒ 业务页被隐藏。
 *
 * 修法：把「是否人工业务路由」提升为**路由派生**的判定，并让 `effectiveMode` 一并纳入；
 * 同时对路由做 watch：进入业务路由即切 human（回默认 AI 面时保持用户原选择，不强行改回）。
 */
const BUSINESS_ROUTE_PATHS: readonly string[] = [
  // 注意：`/dashboard` 是**默认工作台（AI 信息流宿主）**，刻意不在清单内，
  // 否则默认面会被强制切到人工模式（见 isManualBusinessRoute 的注释与 UI 测试 C3）。
  "/orders", "/order-board", "/order-aftersale", "/order-exception", "/order-center", "/order-routing", "/order-sync", "/order-product-map",
  "/sales/create", "/sale-bills", "/sale-returns", "/collection", "/sales/collection-links",
  "/sales/customer-prices", "/sales/commission/rules", "/sales/commission/records", "/sales/reports",
  "/products", "/products/categories", "/products/brands", "/prices", "/products/import", "/products/combo", "/products/reviews",
  "/inventory", "/inventory-check", "/inventory-transfer", "/inventory-alerts", "/inventory-batch-price",
  "/customers", "/member-system", "/store-value-cards", "/credit", "/points-rules", "/level-config",
  "/finance/payments", "/finance/receivables", "/finance/statements", "/finance/reconciliation", "/finance/profit", "/finance/report",
  // WORKBENCH-13B 实测补漏：这 10 条是 `src/router/index.ts` 里挂在父级 `/` 下的**真实业务路由**
  // （逐条 grep 到 path 与 component 指向 views 下同一批 .vue），但清单当年按「域前缀」猜着写，漏了它们。
  // 后果（1440 并排实测）：真实 SUPER_ADMIN 走菜单桥时 `visibleBusinessEntryCount === 0`，
  // 而 `isManualBusinessRoute` 判假 ⇒ 「当前账号暂无可显示的菜单」覆盖层压在已渲染的业务页之上，
  // 财务/系统/营销三个模块的页根量到的是空态块（1102×88），整页视觉无从对齐（卡 §三.A.4 页面本体）。
  "/payments", "/customer-statements", "/fund-report", "/history-bills", "/finance/receivables-payables",
  "/aftersale", "/organization", "/report-permissions", "/system/payment", "/monitor-manage",
  "/purchase-orders", "/purchase-in-stocks", "/purchase-returns", "/purchase-contracts",
  "/purchase/supplier-statements", "/purchase/plans", "/purchase-payments", "/suppliers",
  "/instant-retail/dashboard", "/instant-retail/config", "/instant-retail/shelf", "/instant-retail/orders",
  "/instant-retail/pickup", "/instant-retail/payment", "/instant-retail/delivery", "/instant-retail/report",
  "/instant-retail/platform", "/instant-retail/order-board", "/instant-retail/announcements", "/instant-retail/sync",
  "/marketing", "/marketing/coupon", "/marketing/full-reduction", "/marketing/flash-sale", "/marketing/limited-discount", "/marketing/aftersale",
  "/reports", "/reports/products", "/reports/employees", "/sales-analysis",
  "/system/organization", "/system/config", "/system/print", "/system/monitor", "/system/approval",
  "/system/report-permissions", "/system/miniapp", "/todo-list", "/messages",
];

/**
 * 当前路由是否人工业务页。
 * - `/pos/*` 由 `isCashierRoute` 单独处理（收银台有独立骨架）；
 * - `/dashboard` 是**默认工作台**，属 AI 面（信息流）宿主，不算人工业务页。
 */
const isManualBusinessRoute = computed(() => {
  const p = route.path;
  if (isCashierRoute.value) return false;
  if (p === "/dashboard" || p === "/" || p.startsWith("/login")) return false;
  return BUSINESS_ROUTE_PATHS.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
});

const effectiveMode = computed<WorkbenchMode>(() =>
  isCashierRoute.value || isManualBusinessRoute.value ? "human" : workbenchMode.value,
);

/** 本机真实使用频率：只参与「常用功能」排序，不扩权限、不持久化业务数据。 */
const menuUsage = ref(readMenuUsage());

/** 主面：chat=AI 日常经营对话/晨报（原型默认主面 · UI-PARITY-BASE §四.3.1）；
 *  feed=旧信息流层（结构保留、数据 hook 保留，不再作为任何入口的默认/落地面）。
 *  仅 AI 模式内有层切换。 */
type MainFace = "chat" | "feed";
const face = ref<MainFace>("chat");
const sideCollapsed = ref(false);

/**
 * 任务中心收起态（卡面 §四.1.4：收起 = 整列 0px，不是 56px 窄条；顶栏开关是唯一常驻重开入口）。
 * 持久化在 localStorage `wb.task-center.collapsed`（"1" = 收起）：
 *  - 显式偏好（用户点过开关）永远优先；
 *  - 无偏好时按合同默认：数据落地后无真实待办 ⇒ 收起（0px），有待办 ⇒ 展开；
 *  - 刷新/重开应用后保持上次显式选择；窄口进入时强制收起（不占主面）。
 */
const TASK_CENTER_KEY = "wb.task-center.collapsed";
const taskCenterCollapsed = ref(false);
/** 合同默认是否已应用过一次（只应用一次，之后交给显式偏好/用户操作） */
let taskCenterDefaultApplied = false;
function readTaskCenterPref(): string | null {
  try {
    return localStorage.getItem(TASK_CENTER_KEY);
  } catch {
    return null;
  }
}
function restoreTaskCenterState(): void {
  const pref = readTaskCenterPref();
  taskCenterCollapsed.value = pref === "1";
}
/**
 * 任务中心数据落地回调（WorkbenchTaskCenter @settle）：仅在用户没有显式偏好时
 * 按合同应用一次默认态（无真实待办 ⇒ 收起；有待办 ⇒ 保持展开）。失败态不参与
 * 默认判定（读不到 ≠ 没有待办，不因故障收起入口）。
 */
function onTaskCenterSettle(hasWork: boolean): void {
  if (taskCenterDefaultApplied) return;
  if (readTaskCenterPref() !== null) {
    taskCenterDefaultApplied = true;
    return;
  }
  taskCenterDefaultApplied = true;
  if (!hasWork) taskCenterCollapsed.value = true;
}
/**
 * 用户显式切换（顶栏开关 / 面板内收起钮）：切换后持久化。
 * 窄口强制收起（applyNarrow）不走此函数 ⇒ 不覆盖桌面偏好。
 */
function toggleTaskCenter(): void {
  taskCenterCollapsed.value = !taskCenterCollapsed.value;
  persistTaskCenterState();
}
function persistTaskCenterState(): void {
  try {
    localStorage.setItem(TASK_CENTER_KEY, taskCenterCollapsed.value ? "1" : "0");
  } catch {
    /* 存储不可用（隐私模式等）⇒ 状态只在会话内生效 */
  }
}
restoreTaskCenterState();
/** 窄视口（≤390px）：rail 转底部横条、二级导航转左滑抽屉、主面单列（F1 补齐项 F） */
const isNarrow = ref(false);
let narrowQuery: MediaQueryList | null = null;
function applyNarrow(narrow: boolean): void {
  isNarrow.value = narrow;
  sideCollapsed.value = narrow;
  // 窄口（≤390px）任务中心整列不占主面：进入窄口即收起（不覆盖用户桌面态偏好）
  if (narrow) taskCenterCollapsed.value = true;
}
function onNarrowChange(event: MediaQueryListEvent): void {
  applyNarrow(event.matches);
}
// （UI-PARITY-BASE）AI 能力台账抽屉已按合同移除，ledgerOpen 状态随之删除

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
// S2 唯一生产能力源（门1 返工：二级栏生产投影的唯一解析入口；
// 内部同样走 resolveMenuAccess 交集，不另立口径，fail-closed 与 access 同步）
const effectiveCapabilities = computed(() =>
  resolveEffectiveCapabilities({
    menuState: menuState.value,
    menuRows: menuRows.value,
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
  // WORKBENCH-13-F3 §三.C.9：新壳真实接入更新检查（检查器内部 catch ⇒ 失败静默降级，不阻塞工作台）。
  // 旧壳回滚（!shellEnabled）时 MainLayout 自身已调用，这里只挂生产新壳，避免双通知。
  if (shellEnabled) void checkWebUpdate();
  // （UI-PARITY-BASE §四.2.5）顶栏研发健康指标/员工数/步骤计数已按合同移除，
  // 探针与顶部指标装载不再由壳层调用（ai-readiness/agent-metrics 模块保留供其余消费方）。
  confirmTimer = window.setInterval(() => {
    void loadPendingReview();
  }, 60_000);
  // 390px 窄视口降级（F1 补齐项 F）：进入窄口即把二级导航收成抽屉，避免三列裁剪
  if (typeof window.matchMedia === "function") {
    narrowQuery = window.matchMedia(WB_NARROW_MEDIA_QUERY);
    applyNarrow(narrowQuery.matches);
    narrowQuery.addEventListener("change", onNarrowChange);
  }
});

/**
 * WORKBENCH-13：路由 → 模式同步（修 §三.3 深链接隐藏）。
 *
 * `effectiveMode` 已按路由派生（见上），本 watch 进一步把「持久化的 workbenchMode」
 * 对齐到当前路由，避免出现 rail 高亮仍是 AI 面、而业务层已 shown 的矛盾态：
 *   - 进入人工业务路由 ⇒ 落 `human`（刷新后仍以路由为准，冷启动深链接也正确）；
 *   - 回到 `/dashboard`(默认工作台) 或 `/` ⇒ **不强制改写**用户可能的 `chat` 选择，
 *     仅在原本是 human 时恢复 `ai`（对应原型「回到默认工作台」语义）。
 */
watch(
  () => route.path,
  (path) => {
    const routeName = typeof route.name === "string" ? route.name : "";
    if (routeName && path !== "/dashboard" && ALL_MANIFEST_ROUTE_NAMES.includes(routeName)) {
      menuUsage.value = recordMenuUsage(routeName);
    }
    if (isCashierRoute.value) return; // 收银台由 isCashierRoute 主导，不改持久化模式
    if (isManualBusinessRoute.value) {
      if (workbenchMode.value !== "human") setWorkbenchMode("human");
      return;
    }
    if ((path === "/dashboard" || path === "/") && workbenchMode.value === "human") {
      setWorkbenchMode("ai");
      face.value = "chat";
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (confirmTimer !== undefined) window.clearInterval(confirmTimer);
  narrowQuery?.removeEventListener("change", onNarrowChange);
  narrowQuery = null;
});

/**
 * UIUX 测试注入（补齐项 6）：`SERVER_MENU_BRIDGE` 只覆盖 4/12 组，真实交集会裁掉另外 8 组，
 * 走查无法逐组点击。仅开发态 + 显式参数时跳过交集这一步，角色裁剪与生产链路都原样保留，
 * 并在 DOM 留痕（data-uiux-inject + 角标），确保注入态不会被当成生产权限证据。
 */
const uiuxInjection = readUiuxInjection();
const uiuxInjected = computed(() => uiuxInjection.active);

const visibleGroups = computed(() =>
  filterVisibleGroups(
    shouldSkipMenuBridgeTrimming(uiuxInjection)
      ? MANUAL_GROUPS
      : restrictManifestGroups(MANUAL_GROUPS, access.value.visibleRouteNames),
    auth.userRoles,
    resolveRoles,
  ),
);
/** 收银保底：只按路由 meta.roles 判定，不吃 /menus/user 交集（菜单失败/空集时也不清空收银导航） */
const visibleCashierItems = computed(() =>
  filterVisibleItems(CASHIER_ITEMS, auth.userRoles, resolveRoles),
);

/**
 * 一级 rail 的**结构**来源：只按路由 meta.roles 判定，不吃 /menus/user 交集（与 visibleCashierItems 同一保底口径）。
 *
 * 为什么要与 visibleGroups 分道：`visibleGroups` 在 `filterVisibleGroups` 之前先叠加了服务端菜单桥
 * （`restrictManifestGroups(MANUAL_GROUPS, access.visibleRouteNames)`），而 `SERVER_MENU_BRIDGE` 只覆盖
 * 少数 routeName ⇒ 真实 SUPER_ADMIN 走生产入口（无测试注入）时交集为空，rail 会塌缩成「工作台 + 设置」，
 * 违反卡 §三.A.2。rail 只决定**哪些一级模块存在/高亮**，点开页面与第二栏真实入口仍走 bridge 派生的
 * visibleGroups（见 visibleEntryItems / visibleBusinessEntryCount / showMenuEmptyState，保持 fail-closed）；
 * 受限角色经同一个 `filterVisibleGroups(MANUAL_GROUPS, auth.userRoles, resolveRoles)` 依旧裁到更少的组，
 * 因此本处放宽的只是「结构呈现」，不放宽任何「能否进入页面」的权限判定。
 */
const SETTINGS_ONLY_GROUP_CODE = "wb.system";
const roleVisibleGroups = computed(() =>
  filterVisibleGroups(MANUAL_GROUPS, auth.userRoles, resolveRoles),
);
/** 系统管理不占一级栏；“设置”是其唯一导航入口。 */
const railGroups = computed(() =>
  roleVisibleGroups.value.filter((group) => group.groupCode !== SETTINGS_ONLY_GROUP_CODE),
);
const settingsSystemEntries = computed<ManifestItem[]>(
  () => roleVisibleGroups.value.find((group) => group.groupCode === SETTINGS_ONLY_GROUP_CODE)?.items ?? [],
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

/**
 * WORKBENCH-13（卡 §三.1）：空态是否显示 —— **页面级互斥**判据。
 *
 * 只要当前路由是**真实存在的人工业务页**（且有对应路由记录），就**绝不显示空态**：
 * 页面本体已能渲染，空态再出现只会污染/挤压页面（这正是原缺陷）。
 *
 * 空态只在以下情形显示（与「页面」互斥，而非并列）：
 *   · 菜单已就绪（ready）；
 *   · 可见业务入口为 0；
 *   · 当前不在收银台；
 *   · **且当前没有可渲染的人工业务页**（即首页/工作台等由 AI 面承载的路由，
 *     或该路由在 router 里根本没有匹配记录 ⇒ 无页面可显示）。
 */
const showMenuEmptyState = computed(() => {
  if (menuState.value !== "ready") return false;
  if (isCashierRoute.value) return false;
  if (visibleBusinessEntryCount.value > 0) return false;
  // 关键豁免：当前路由是一个真实人工业务页 ⇒ 页面优先，空态让位
  if (isManualBusinessRoute.value) return false;
  return true;
});

/** 信息流「快速入口」：当前角色可见的真实入口（manifest 派生，不造数据） */
const visibleEntryItems = computed(() => visibleGroups.value.flatMap((group) => group.items));

/**
 * 一级模块显式选中态。
 *
 * 原型语义（§动态交互 2）：选中某模块后再次点击 ⇒ **取消选中**，第二栏恢复「常用功能」。
 * 因此 `""` 是一个合法且重要的状态（= 未选中 = 常用功能），
 * 不能像 WORKBENCH-06 旧实现那样一上来就默认选中 groups[0]——那样第二栏永远回不到常用功能。
 */
const selectedGroupCode = ref("");
watch(
  railGroups,
  (groups) => {
    // 只在「已选中项不再可见」时回落为空（改由常用功能接管），不自动改选其它组
    if (selectedGroupCode.value && !groups.some((group) => group.groupCode === selectedGroupCode.value)) {
      selectedGroupCode.value = "";
    }
  },
  { immediate: true },
);

/**
 * 一级 rail 渲染序列：原型顺序（decorateRailGroups）× **按 meta.roles 派生**的一级分组。
 *
 * WORKBENCH-13-F2：源从 visibleGroups（bridge 交集）切到 railGroups（只按角色）——
 * 真实 SUPER_ADMIN 走生产入口时 bridge 交集为空，用 visibleGroups 会让 rail 塌缩（卡 §三.A.2）。
 * 加载期返回 `[]`：真实模块位先不渲染，改由 `railSkeletons` 出 12 行占位（互斥契约见其注释），
 * 计数不翻倍；`railSkeletons` 里的 `railModules.value.length === 0` 判据因此照常成立。
 */
const railModules = computed(() =>
  menuState.value === "loading" ? [] : decorateRailGroups(railGroups.value),
);

/**
 * WORKBENCH-13 修复（卡 §三.10「冷启动首击不稳定」）—— 证据与根因：
 *
 * 运行态实测（tools/browser-coldstart.mjs，真实 Chrome + 真实登录）：
 *   `首击 采购管理 rail: visible=false clicked=false`
 *   `二击 采购管理 rail: visible=true  clicked=true`
 * 即**首击时 rail 里的业务模块还没渲染**，用户点空；第二次才点得到。
 *
 * 根因（file:line）：
 *   ① `menuState` 初值 `"loading"`，冷启动时 `/menus/user` 尚未返回；
 *   ② `visibleGroups` 用 `access.visibleRouteNames` 做交集，加载期为空 ⇒ 0 组；
 *   ③ `railModules = decorateRailGroups(visibleGroups)` ⇒ rail 只剩 desk/set，
 *      11 个模块位**不存在** ⇒ 首击落空（不是"点了没反应"，而是"根本没有可点节点"）。
 *
 * 修法（结构骨架 + 点击意图缓冲，不放宽任何权限判定）：
 *   · 加载期渲染**占位骨架**（`data-rail-skeleton="true"`，真实 `<button>`：可聚焦、Enter/空格/鼠标首击都能记录意图，但不跳转），
 *     让 13 项 rail 结构从首帧就稳定，用户点得到、也看得到"正在加载权限菜单"；
 *   · 占位被点击时把目标组码记入 `pendingRailGroup`，`menuState` 转 ready 后**自动选中**它
 *     （= 首击意图不丢，等价"首击可进入"）；
 *   · 若 ready 后该组仍不可见（真实无权限 / 菜单为空）⇒ 明确给出**可重试**错误提示，
 *     而不是静默失败（对应"或给出可重试错误"）。
 */
const pendingRailGroup = ref<string | null>(null);

/**
 * 加载期骨架：仅用于结构占位；不参与任何可见性/权限判定，也不可跳转。
 *
 * ⚠️ 必须与真实模块**互斥**：若 `railModules` 已有内容（例如 UIUX 注入态在加载期
 * 就能算出 11 组），再叠加 11 个骨架会出现 24 个 rail 项（实测 13+11），
 * 既是重复渲染也会让结构核对失真。故仅在「真实模块一个都没渲染」时才出骨架。
 */
const railSkeletons = computed(() =>
  menuState.value === "loading" && railModules.value.length === 0
    ? decorateRailGroups(MANUAL_GROUPS).filter(
        (group) => group.groupCode !== SETTINGS_ONLY_GROUP_CODE,
      )
    : [],
);

/** 点击骨架位：记录意图 + 明确提示（不是死点击） */
function clickRailSkeleton(groupCode: string): void {
  pendingRailGroup.value = groupCode;
  ElMessage.info("权限菜单加载中，已记录你的选择，加载完成后自动进入");
}

watch(menuState, (state) => {
  if (state !== "ready") return;
  const pending = pendingRailGroup.value;
  if (!pending) return;
  pendingRailGroup.value = null;
  const hit = visibleGroups.value.some((group) => group.groupCode === pending);
  if (hit) {
    selectedGroupCode.value = pending;
    setWorkbenchMode("ai");
    face.value = "chat";
    if (isNarrow.value) sideCollapsed.value = false;
    return;
  }
  // 加载完成但该组不可见：明确告知并可重试（不静默、不伪造可见）
  ElMessage.warning("该模块当前账号无可见权限，请重试或联系管理员开通");
});

// （UI-PARITY-BASE）能力台账抽屉移除后，activeGroup/activeGroupTitle/activeGroupItems 已无消费方，随之删除。

/**
 * 一级 rail 选中态：desk=信息流（常用功能）/ groupCode=模块 / pos=收银 / set=系统设置。
 *
 * 优先级：收银态 > 系统页 > **显式选中** > 由当前路由反推归属 > desk。
 * 「显式选中」优先于路由反推，是为了让「点了模块但还没进任何页面」也有明确反馈（原型 §A-6）。
 */
const railKey = computed(() => {
  if (isCashierRoute.value) return "pos";
  if (route.name === "system") return "set";
  if (
    settingsSystemEntries.value.some(
      (entry) => entry.path && (route.path === entry.path || route.path.startsWith(`${entry.path}/`)),
    )
  ) {
    return "set";
  }
  if (selectedGroupCode.value) return selectedGroupCode.value;
  if (effectiveMode.value !== "ai") {
    // 路由反推归属也走 railGroups（与 rail 结构同源）：选中模块即便 bridge 无真实条目也不会漏判/崩，
    // group.items 恒为数组，owner 缺省时回落 "desk"（fail-closed 到中性值）。
    const owner = railGroups.value.find((group) =>
      group.items.some((item) => item.path && route.path.startsWith(item.path)),
    );
    if (!owner) return "desk";
    // 命中固定项所属分组（`wb.dashboard` 的唯一条目就是 `/dashboard`）时高亮**固定 rail 位**，
    // 否则 railKey 会是一个 rail 上不存在节点的值 ⇒ 12 项全不高亮（原型默认高亮「工作台」）。
    return RAIL_FIXED_KEY_BY_GROUP[owner.groupCode] ?? owner.groupCode;
  }
  return "desk";
});

const currentNavMode = computed<"quick" | "module" | "pos">(() => {
  if (isCashierRoute.value) return "pos";
  // （UI-PARITY-BASE）默认主面恒为 AI 日常经营对话 ⇒ quick 态只看 rail 是否处于「工作台」位，
  // 不再依赖旧 feed 面（face==="feed" 已不可达）。
  return effectiveMode.value === "ai" && railKey.value === "desk" ? "quick" : "module";
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
  // （UI-PARITY-BASE + DELTA-CONTRACT top_bar.left）AI 模式顶栏标题 = 日常经营（会话面即日常经营）
  return "日常经营";
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

/** 有新动态 ⇒ rail 工作台按钮红闪（feedAlert）：用待审阅>0 驱动（真实数据） */
const feedAlert = computed(() => (pendingReviewCount.value ?? 0) > 0);

const printSettingsVisible = ref(false);
/** 设置中心（原型 .sw 弹窗，WORKBENCH-10-F1 补齐项 E）：rail 设置项在壳层内打开，不跳路由 */
const settingsCenterVisible = ref(false);
const settingsAccount = computed(() =>
  auth.user ? { name: auth.userName, store: String(auth.user.storeName ?? "") } : null,
);

const aiSessionState = ref<"idle" | "streaming" | "error">("idle");
const chatPanel = ref<{
  sendQuickCommand?: (text: string) => void;
  newConversation?: () => void;
} | null>(null);

function handleAiStatus(payload: { state: "idle" | "streaming" | "error" }): void {
  aiSessionState.value = payload.state;
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

/** AI 结果只跳系统原生表单/页面；不开简化版单据弹层。 */
function openAiNativeForm(action: AiNativeFormAction): void {
  setWorkbenchMode("human");
  router.push(action.path);
  if (isNarrow.value) sideCollapsed.value = true;
}

function openManualItem(entry: ManifestItem): void {
  if (!entry.path) return;
  setWorkbenchMode("human");
  router.push(entry.path);
  // 390px：抽屉里选完条目后收起，把主面还给用户
  if (isNarrow.value) sideCollapsed.value = true;
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

/** rail：工作台（= AI 日常经营对话主面）/ 模块选择 / 设置 */
function goDeskHome(): void {
  setWorkbenchMode("ai");
  face.value = "chat";
  selectedGroupCode.value = "";
  if (route.path !== "/dashboard") router.push("/dashboard").catch(() => undefined);
}

/**
 * 点击一级模块：未选中 ⇒ 选中（第二栏切该模块二级目录）；
 * 已选中 ⇒ **取消选中**（第二栏恢复「常用功能」）。原型 §动态交互 1/2。
 */
function toggleModule(groupCode: string): void {
  selectedGroupCode.value = toggleRailSelection(selectedGroupCode.value || null, groupCode) ?? "";
  setWorkbenchMode("ai");
  // （UI-PARITY-BASE §四.3.1）选模块只切第二栏目录，中央主面保持 AI 日常经营对话（不再回落旧信息流）
  face.value = "chat";
  // 390px：二级导航是抽屉，选组即展开（运行态实测：不展开时移动端无法进入任何模块目录）
  if (isNarrow.value) sideCollapsed.value = false;
}
const canOpenSystemSettings = computed(() => {
  const roles = resolveRoles("system");
  return Boolean(roles && roles.length > 0 && auth.userRoles.some((r) => roles.includes(r)));
});
function openSettings(): void {
  settingsCenterVisible.value = true;
}
/**
 * WORKBENCH-13 修复（卡 §三.2「设置中心与打印设置只能存在一个可交互模态层」）：
 *
 * 原缺陷：`@open-print-settings="printSettingsVisible = true"`（原 L240）**只打开打印弹层**，
 * 设置中心 `settingsCenterVisible` 仍为 `true` ⇒ 两个 el-overlay/el-dialog 同时可交互，
 * 表现为「模态双开」：Esc 只关最上层、遮罩叠两层、焦点在两个 dialog 间漂移。
 *
 * 修法：打开打印设置前**先关闭设置中心**，保证同一时刻只有一个可交互模态层；
 * 关闭打印弹层后焦点回到设置入口（由 el-dialog 的 focus-trap 归还给触发按钮）。
 * 打印设置仍走本机弹窗（`web.pos.print-settings` 的本地动作语义不变，不新增路由）。
 */
function openPrintSettingsFromCenter(): void {
  settingsCenterVisible.value = false;
  nextTick(() => {
    printSettingsVisible.value = true;
  });
}
/** 设置中心「打开系统配置」：沿用原路由与人工态，权限与菜单语义不变 */
function openSystemConfigPage(): void {
  settingsCenterVisible.value = false;
  setWorkbenchMode("human");
  router.push("/system");
}

function openSystemManagementEntry(entry: { path: string | null }): void {
  if (!entry.path) return;
  settingsCenterVisible.value = false;
  setWorkbenchMode("human");
  router.push(entry.path);
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
/* ══ 工作台作用域主题令牌（UI-PARITY-BASE 卡 §四.5）══
   真相源=本块：工作台组件内全部 var(--wb-*, fallback) 由此统一定义，不再各写各的 fallback 值。
   浅色：主色 #4F46E5 / soft #EEF2FF / 正文 #0A0A0A / 次文 #737373 /
         边线 #E5E5E5(#D4D4D4) / 画布 #F2F5F9（卡面逐字值）。
   暗色：#14161C 体系（html[data-wb-theme="dark"] 由 WbSettingsCenter/wb-theme.ts 写入），
         结构/尺寸/交互与浅色完全同一套（不另建布局）。
   作用域限定 .wb-shell（data-wb-scope="workbench"），不扩散总后台/移动端/非工作台页面令牌。 */
.wb-shell {
  --wb-primary: #4f46e5;
  --wb-primary-soft: #eef2ff;
  --wb-ink: #0a0a0a;
  --wb-ink2: #737373;
  --wb-line: #e5e5e5;
  --wb-line-strong: #d4d4d4;
  --wb-canvas: #f2f5f9;
  --wb-panel: #ffffff;
  --wb-bg: #ffffff; /* 人工业务页画布保持原型 --bg:#FFFFFF（F3 已验收口径，勿并入画布色） */
  --wb-hover: #f2f4fa;
  --wb-chrome-bg: #f2f5f9;
  --wb-rail-bg: #f2f5f9;
  --wb-side-bg: #f2f5f9;
  height: 100vh;
  display: grid;
  /* 第二列收起用 grid 列宽过渡（对齐原型 .side{transition:margin .25s} 的平滑滑出手感）；
     不用 display:none 瞬隐 —— WORKBENCH-06F3 审计 MISSING #3 修复。 */
  /* 四宽度 = Prototype-12 四列壳层实测（Playwright 量取）：
     rail 60 / side 230 / main minmax(0,1fr)（1440 视口实得 850）/ task center 300。
     CSS 无法读取 TS，此处是「已 documented 的固定常数」例外，测试会逐字比对四个数字。
     卡面 §三.1：1440×1000 几何 = 60/230/850/300；1024×768 = 60/230/434/300。 */
  grid-template-columns: var(--wb-rail-w, 60px) var(--wb-side-w, 230px) minmax(0, 1fr) var(--wb-task-center-w, 300px);
  transition: grid-template-columns 250ms ease;
  background: var(--wb-canvas, #f2f5f9);
  overflow: hidden;
}
/* 暗色：#14161C 体系（html[data-wb-theme="dark"] 由 WbSettingsCenter/wb-theme.ts 写入），
   结构/尺寸/交互与浅色完全同一套（不另建布局，UI-PARITY-BASE §四.5.2）。 */
html[data-wb-theme="dark"] .wb-shell {
  --wb-primary: #818cf8;
  --wb-primary-soft: rgba(79, 70, 229, 0.3);
  --wb-ink: #f4f5f7;
  --wb-ink2: #a3a8b3;
  --wb-line: #2e3138;
  --wb-line-strong: #3c4048;
  --wb-canvas: #14161c;
  --wb-panel: #1b1e26;
  --wb-bg: #1b1e26;
  --wb-hover: #232733;
  --wb-chrome-bg: #14161c;
  --wb-rail-bg: #171920;
  --wb-side-bg: #191c24;
}
/* 折叠态保留 56px 可见条（原型 .side 折叠后实测 56，不是 0）—— collapsing 到 0 会让
   二级入口彻底不可达，与原型「可折叠但仍在」的语义不符。 */
.wb-shell.side-hidden {
  grid-template-columns: var(--wb-rail-w, 60px) var(--wb-side-collapsed-w, 56px) minmax(0, 1fr) var(--wb-task-center-w, 300px);
}
/* 任务中心收起：第 4 列收成 **0px**（UI-PARITY-BASE 卡 §四.1.4 明确「不是 56px 窄条」）。
   与二级栏折叠（56px）口径刻意不同：任务中心重开入口由顶栏 task-center-toggle 承担
   （合同 top_bar.right），列内不再保留竖条 ⇒ 收起后主区实得 +300px；
   状态保持由 localStorage wb.task-center.collapsed 承担（restoreTaskCenterState/toggleTaskCenter）。 */
.wb-shell.tc-collapsed {
  grid-template-columns: var(--wb-rail-w, 60px) var(--wb-side-w, 230px) minmax(0, 1fr) var(--wb-task-center-collapsed-w, 0px);
}
.wb-shell.side-hidden.tc-collapsed {
  grid-template-columns: var(--wb-rail-w, 60px) var(--wb-side-collapsed-w, 56px) minmax(0, 1fr) var(--wb-task-center-collapsed-w, 0px);
}
/* 收起态：内容溢出裁掉 + 不做 visibility 切换，保证过渡期间可见滑出 */
.wb-shell :deep(.wb-subnav.hidden) {
  overflow: hidden;
}
/* 收银台：不渲染 AI 会话层的宽度挤压，仍保持三段（原型 side=收银功能列表） */

/* ── 底部输入区（卡面 §三.3：底部输入区 100px）──
   AiChatComposer 自身在 WorkbenchShell 内渲染（.wb-main flex 列末位）。
   固定 100px：flex-shrink 0 + 定高；内部 form/输入框随容器裁切（超出滚动由内部 max-height 承担）。
   只改壳层作用域（:deep 覆盖），不触碰 AiChatComposer 文件本身（非本卡允许路径）。 */
.wb-main :deep(.cmp) {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  width: auto;
  height: auto;
  min-height: 0;
  max-height: none;
  box-sizing: border-box;
  overflow: visible;
  padding: 10px 40px 18px;
  border-top: 0;
  background: transparent;
  pointer-events: none;
}
.wb-main :deep(.cmp .cmp-form) {
  max-width: 740px;
  margin: 0 auto;
  max-height: none;
  border-radius: 22px;
  box-shadow: 0 8px 30px rgba(22, 24, 29, 0.08);
  pointer-events: auto;
}
.wb-main :deep(.cmp .cmp-hint),
.wb-main :deep(.cmp .cmp-att-notice),
.wb-main :deep(.cmp .cmp-voice-bar) {
  max-width: 740px;
  margin-left: auto;
  margin-right: auto;
  pointer-events: auto;
}

/* ── 一级 rail ── */
/* 原型 nav.rail 实测（1440×1000）：x=0 y=0 w=60 h=1000 · #F7F9FC · padding 12px 0 · gap 5px · 右边线 #ECEEF1 */
.wb-rail {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 9px;
  padding: 16px 0;
  background: var(--wb-rail-bg, #f7f9fc);
  border-right: 1px solid var(--wb-line, #eceef1);
  overflow-y: auto;
  scrollbar-width: none;
}
.wb-rail::-webkit-scrollbar {
  display: none;
}
/* 品牌位使用正式 Logo 资产，不再使用文字占位。 */
.wb-rail-logo {
  width: 34px;
  height: 34px;
  margin: 0 auto 12px;
  padding: 3px;
  box-sizing: border-box;
  border-radius: 10px;
  background: #fff;
  border: 1px solid var(--wb-line, #e5e5e5);
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wb-rail-logo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
/* 原型 .rl-it：46×43 · x=7（margin auto 居中）· 圆角 11 · padding 7px 0 6px · 图标 17 · 字号 9.5 · 项内 gap 4 · 步进 48（43+容器 gap5） */
.wb-rail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  margin: 0 auto;
  box-sizing: border-box;
  gap: 5px;
  padding: 8px 0 7px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  /* 非选中项色 = 原型 --rail-sub #68758A（1440×1000 实测） */
  color: #626f82;
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  /* 对齐原型 L122 `.rl-it{transition:.15s}`（WORKBENCH-06F3 MISSING #1） */
  transition: background-color 150ms ease, color 150ms ease;
}
/* 未选中项 hover：文字/图标转主色、底色主色 soft（原型 rail hover 态；色值走 §四.5.1 主题令牌） */
.wb-rail-item:hover {
  background: var(--wb-primary-soft, #eef2ff);
  color: var(--wb-primary, #4f46e5);
}
/* 选中态 = 主色底 + 白字（原 `.rl-it.on{background:主色;color:#fff}`；#4F46E5 上白字对比 6.3:1 ≥AA），且内部 el-icon 强制白 */
.wb-rail-item.on {
  background: var(--wb-primary, #4f46e5);
  color: #fff;
  font-weight: 600;
}
.wb-rail-item.on :deep(.el-icon) {
  color: #fff;
}
/* hover 命中选中项时保持主色白字（特异性 0-3-0 压过通用 .wb-rail-item:hover，不回退成 soft 底） */
.wb-rail-item.on:hover {
  background: var(--wb-primary, #4f46e5);
  color: #fff;
}
/**
 * WORKBENCH-13（卡 §三.10）：加载期 rail 占位骨架。
 * 结构与真模块一致（保证 13 项 rail 首帧稳定），但视觉上明确「未就绪」：
 * 半透明 + 呼吸 + 不显示 hover 高亮，避免被误认为已可用的生产入口。
 */
.wb-rail-item.is-rail-skeleton {
  opacity: 0.45;
  cursor: progress;
  animation: wb-rail-skeleton-pulse 1.2s ease-in-out infinite;
}
.wb-rail-item.is-rail-skeleton:hover {
  background: transparent;
  color: var(--wb-ink2, #8a8f98);
}
.wb-rail-item.is-rail-skeleton.is-pending {
  opacity: 0.8;
  animation-duration: 0.6s;
}
@keyframes wb-rail-skeleton-pulse {
  0%, 100% { opacity: 0.32; }
  50% { opacity: 0.55; }
}
/* 无障碍/低动效偏好下不打呼吸，仅保留半透明 */
@media (prefers-reduced-motion: reduce) {
  .wb-rail-item.is-rail-skeleton {
    animation: none;
    opacity: 0.45;
  }
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
/* 原型 .rl-gap（设置项上方的分隔线）：32×1 · #ECEEF1 · margin auto 0 7px。
   margin-top:auto 吸收剩余空间把它与（已隐藏的）设置项压向 rail 底部，rail 底部只剩这条线；
   容器 align-items:stretch ⇒ 用 align-self:center 让 32px 线水平居中（对齐原型 align-items:center 下的 auto 0）。 */
.wb-rail-gap {
  width: 1px;
  height: 1px;
  background: transparent;
  align-self: center;
  margin: auto 0 2px;
  flex-shrink: 0;
}

/* 账号只在第一列 rail 底部出现；点击后在右侧浮出账号菜单。 */
.wb-rail-account {
  width: 34px;
  height: 34px;
  margin: 0 auto 2px;
  flex-shrink: 0;
  border: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--wb-primary, #4f46e5), #4338ca);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.wb-rail-account:hover {
  box-shadow: 0 0 0 3px var(--wb-primary-soft, #eef2ff);
}
.wb-rail-account-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 3px;
}
.wb-rail-account-card strong {
  font-size: 13px;
  color: var(--wb-ink, #16181d);
}
.wb-rail-account-card span {
  margin-bottom: 5px;
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
}
.wb-rail-account-card button {
  border: 0;
  border-radius: 7px;
  background: transparent;
  padding: 8px 9px;
  text-align: left;
  font-family: inherit;
  font-size: 12px;
  color: var(--wb-ink, #16181d);
  cursor: pointer;
}
.wb-rail-account-card button:hover {
  background: var(--wb-hover, #f4f6f8);
}
.wb-rail-account-card button.is-danger {
  color: #dc2626;
}
/* 设置与账号同处一级栏底部；系统管理入口统一收进设置中心。 */
.wb-rail-set {
  width: 34px;
  height: 34px;
  padding: 0;
  margin: 0 auto 4px;
  border-radius: 9px;
}

/* ── main 区 ── */
.wb-main {
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}
.wb-main :deep(.ai-side-panel),
.wb-view-manual {
  border-top-left-radius: 16px;
  overflow: hidden;
}
/* 原型 header.top 实测（Prototype-12 卡面 §三.3：顶栏 42px）；
   WORKBENCH-13-F2 基线为 54px，本卡按原型四列壳层口径收敛为 42px（硬验收：42px 顶栏） */
.wb-top {
  box-sizing: border-box; /* 卡面 §三.3 顶栏 42px 含 1px 下边线（无 border-box 时浏览器实测 43） */
  height: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 22px;
  background: var(--wb-chrome-bg, #f2f5f9);
  border-bottom: 0;
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
/* 顶栏唯一标题 = 页面标题（13B 差异表 pageTitle 角色两侧同尺：原型 #topTitle ⇄ 本元素）。
   口径取自原型融合版 L99 `.top .name{font-size:15px;font-weight:800;letter-spacing:.3px}`；
   原实现写 600，差异表按 §三.A.6 判红（proto=800 impl=600）。字重/字距属字号层级，
   不改尺寸与颜色 ⇒ 不触碰 F3 已验收的壳层几何口径（F3 用例未对标题字重设断言）。 */
.wb-top-title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.3px;
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
.wb-view.shown[data-view="feed"],
.wb-view.shown[data-view="manual"] {
  box-sizing: border-box;
  padding-bottom: 190px;
}
/* 人工层画布 = 原型 L10 `--bg:#FFFFFF`（`.wb-view{background:var(--bg)}`，L193 逐字）。
   原兜底字面量 #f4f6f8 是原型 L10 的**另一个 token**（`--panel2`，用于 chip/悬停底），
   不是页面画布 ⇒ 这是 token 误映射，不是壳层已验收口径（F2/F3 的测试与证据都不含该色，逐条 grep 过）。
   WORKBENCH-13B §三.A.4 的门禁把 pageRoot 底色读成 244,246,248 vs 原型 255,255,255 ⇒ 本行按原型改回 #ffffff。 */
.wb-view-manual {
  background: var(--wb-bg, #ffffff);
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

/**
 * WORKBENCH-13（卡 §三.1）：空态改为**绝对定位覆盖层**，不再占据文档流。
 * 原样式 `margin: 24px` 会让空态作为兄弟节点把 `<router-view />` 挤下去；
 * 现在它是浮在 manual 层顶部的提示卡，与页面**层级互斥**（页面仍在底层渲染）。
 */
.wb-menu-empty {
  position: absolute;
  top: 16px;
  left: 24px;
  right: 24px;
  z-index: 5;
  margin: 0;
  padding: 20px 24px;
  border: 1px dashed var(--wb-line, #e5e7eb);
  border-radius: 8px;
  background: var(--wb-panel, #fff);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
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

/* ── 能力台账抽屉：已按 UI-PARITY-BASE 合同移除（top_bar.forbidden），样式随之删除 ── */

/* ══════════════════════════════════════════════════════════════
   ≤390px 窄视口降级（WORKBENCH-10-F1 补齐项 F）
   原型只有 1440 桌面稿 ⇒ 这里的目标不是「移动端设计」，是**不裁剪、可触达**：
   · 三列 grid（60+230=290px 固定列）在 390px 下只剩 100px 主面 ⇒ 改单列
   · rail 转底部横向条（卡片口径「底部或抽屉导航」）
   · 二级导航转左滑抽屉 + 遮罩，默认收起，用顶部 side-toggle 开合
   断点唯一真相源 = shared/workbench/wb-viewport.ts 的 390；两者由测试逐字比对。
   ══════════════════════════════════════════════════════════════ */
@media (max-width: 390px) {
  .wb-shell,
  .wb-shell.side-hidden,
  .wb-shell.tc-collapsed,
  .wb-shell.side-hidden.tc-collapsed,
  .wb-shell.is-ai {
    grid-template-columns: minmax(0, 1fr);
  }
  .wb-shell :deep(.wb-subnav),
  .wb-shell :deep(.wb-subnav.hidden) {
    position: fixed;
    top: 0;
    bottom: 56px;
    left: 0;
    width: min(320px, 86vw);
    z-index: 45;
    overflow: hidden auto;
    background: var(--wb-panel, #fff);
    border-right: 1px solid var(--wb-line, #eceef1);
    box-shadow: 12px 0 32px rgba(15, 23, 42, 0.18);
    transform: translateX(-100%);
    transition: transform 220ms ease;
  }
  .wb-shell:not(.side-hidden) :deep(.wb-subnav) {
    transform: translateX(0);
  }
  .wb-rail {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 46;
    flex-direction: row;
    align-items: center;
    gap: 0;
    height: 56px;
    padding: 0 6px;
    border-right: 0;
    border-top: 1px solid var(--wb-line, #eceef1);
    /* 窄口实测修复：底部横条里 13 个一级条目横向排布（scrollWidth 比 clientWidth 宽 ~210px），
       原先写成 `hidden auto`（= 横不可滚、纵可滚）⇒ 右侧条目被裁死、390 下点不到。
       横条的正确方向是横向可滚；纵向由 56px 定高裁掉。滚动条已在基础规则里隐藏，不占命中区。 */
    overflow: auto hidden;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  .wb-rail-logo {
    width: 28px;
    height: 28px;
    margin: 0 8px 0 0;
    font-size: 13px;
    flex-shrink: 0;
  }
  .wb-rail-item {
    flex-direction: row;
    gap: 5px;
    padding: 6px 9px;
    font-size: 12px;
  }
  .wb-rail-gap {
    display: none;
  }
  .wb-rail-set {
    /* 窄口（≤390px）rail 转底部横条时，设置项仍与原型一致地隐藏（入口在第二列账户区）；
       显式重申 display:none，避免该 media 规则被误当作"重新显示"（基线 .wb-rail-set 已置 none）。 */
    display: none;
    margin-top: 0;
    border-top: 0;
  }
  .wb-main {
    padding-bottom: 56px;
  }
  /* 任务中心（第 4 列）在 ≤390px 不占主面：整列隐藏（收起条也隐藏），
     桌面四列能力仍由展开态保留（窄口无空间呈现 300px 列） */
  .wb-shell :deep(.wtc) {
    display: none;
  }
  .wb-top {
    height: auto;
    min-height: 44px;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 10px;
  }
  .wb-top-title {
    font-size: 14px;
  }
  .wb-menu-state {
    font-size: 12px;
  }
  .wb-user {
    max-width: 96px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.wb-side-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 44;
}

/* 注入态角标压在抽屉（45）/底部栏（46）之上，任何截图都能看见「这是注入态」 */
.wb-uiux-flag {
  position: fixed;
  top: 6px;
  right: 6px;
  z-index: 47;
  padding: 4px 10px;
  border-radius: 999px;
  background: #7c3aed;
  color: #fff;
  font-size: 12px;
  line-height: 1.4;
  pointer-events: none;
}
</style>
