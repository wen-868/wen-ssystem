<template>
  <aside class="wb-subnav" :class="{ hidden: collapsed }" aria-label="二级导航" data-testid="second-nav">
    <div class="sn-brand">
      <span class="sn-logo">智</span>
      <span class="sn-text">
        <span class="sn-t">智享全链</span>
        <span class="sn-s">AI 经营底座 · 管理与收银一体</span>
      </span>
      <button
        type="button"
        class="sn-collapse"
        data-testid="second-nav-collapse"
        :aria-label="collapsed ? '展开导航' : '收起导航'"
        :title="collapsed ? '展开导航' : '收起导航'"
        @click="$emit('collapse')"
      >
        {{ collapsed ? "»" : "«" }}
      </button>
    </div>

    <!-- 折叠态：只留可点的一级模块缩略条（原型 .side 折叠后仍可见 56px） -->
    <div v-if="collapsed" class="sn-collapsed" data-testid="second-nav-collapsed-strip">
      <button
        v-for="row in stripModules"
        :key="row.code"
        type="button"
        class="sn-strip-item"
        :class="{ on: row.code === activeGroupCode }"
        :title="row.label"
        @click="$emit('pick-group', row.code)"
      >
        {{ row.short }}
      </button>
    </div>

    <template v-else>
      <!--
        ══ 常用功能区（原型 #subZone · L130）══
        原型 quick 态的列内次序是硬约束：
          说明块（.mf-dual）→ 常用功能卡（.qk-t + .sub-grid）→ 员工/对话栏（#alV21Sidehd）→ 目录（#sessList）
        因此这里只承载「说明块 + 标题 + 卡片网格」，不再兼作整列的滚动容器；
        滚动权交给 .sn-dir（目录），列高恒等于视口高（见 .wb-subnav / .sn-acct）。
      -->
      <div class="sn-subzone" data-testid="second-nav-sub-zone">
        <!--
          双入口说明：文案逐字复制原型融合版 L3923（.mf-dual 注入语句）。
          原型在标题含「收银」时不注入本块（L3920），此处同口径：pos 态不显示。
        -->
        <div v-if="mode !== 'pos'" class="sn-dual" data-testid="second-nav-dual-note">
          <b>双入口</b>左侧菜单 = 人工操作入口（13 模块 · 全功能覆盖现有管理工作台）· 底部对话框 = AI
          智能入口（说需求 · 确认后执行 · 全程留痕）
        </div>

        <div class="sn-title" data-testid="second-nav-sub-title">{{ sectionTitle }}</div>

        <div class="sn-grid">
          <button
            v-for="plan in subnavPlan"
            :key="plan.label"
            type="button"
            class="sn-card"
            :class="{ active: plan.status === 'wired' && isActive(plan.item), pending: plan.status === 'pending' }"
            :data-plan-label="plan.label"
            :data-plan-status="plan.status"
            :disabled="plan.status === 'pending'"
            :title="plan.status === 'pending' ? `待接入：${plan.label} 暂无可用接口` : plan.label"
            @click="emitPlan(plan)"
          >
            <el-icon class="sn-card-ic" :size="16"><component :is="cardIcon(plan.label)" /></el-icon>
            <span class="sn-card-tx">{{ plan.label }}</span>
            <span v-if="plan.status === 'pending'" class="sn-pending">待接入</span>
          </button>
        </div>

        <p v-if="subnavPlan.length === 0" class="sn-empty">
          {{ menuState === "loading" ? "正在加载菜单…" : menuState === "error" ? "菜单加载失败（不回退全量）" : "当前角色暂无可见入口" }}
        </p>
      </div>

      <!--
        ══ 已接线真实入口（manifest 派生的可用清单）══
        quick 态下它不属于原型列内结构（原型 quick 只有上面四段），会顶掉
        #subZone→#alV21Sidehd→#sessList 的实测坐标，所以这里只在 module / pos 渲染：
        模块态仍需「原型目录之外、本角色实际已接线的入口」可达，能力不因对齐原型结构而退化。
        区域与其 testid（second-nav-real-zone / second-nav-real-toggle）原样保留，未删除。
      -->
      <div v-if="mode !== 'quick' && realEntries.length > 0" class="sn-zone" data-testid="second-nav-real-zone">
        <div class="sn-title">已接入入口（{{ realEntries.length }}）</div>
        <div class="sn-list">
          <button
            v-for="entry in shownRealEntries"
            :key="entry.menuCode"
            type="button"
            class="sn-row"
            :class="{ active: isActive(entry) }"
            @click="$emit('open', entry)"
          >
            {{ entry.title }}
          </button>
        </div>
        <button v-if="realEntries.length > 8" type="button" class="sn-more" data-testid="second-nav-real-toggle" @click="expanded = !expanded">
          {{ expanded ? "收起" : `展开全部 ${realEntries.length} 项` }}
        </button>
      </div>

      <!--
        ══ 员工 / 对话 双入口横栏（原型 #alV21Sidehd · V36 重设计 L18304）══
        V36 把 .t「员工列表」改为 sr-only（节点在 DOM、读屏可达，视觉让位给分段控件），
        新对话按钮由全宽渐变条改成 32×32 描边图标钮并移到栏末位——本列同口径。
      -->
      <div class="sn-sidehd" data-testid="second-nav-tabs">
        <span class="sn-sidehd-t">员工列表</span>
        <div class="sn-seg" role="group" aria-label="员工/对话切换">
          <button
            v-for="tab in PROTOTYPE_SIDE_TABS"
            :key="tab"
            type="button"
            class="sn-seg-btn"
            :class="{ on: sideTab === tab }"
            :data-side-tab="tab"
            :aria-pressed="sideTab === tab ? 'true' : 'false'"
            :title="tab === '员工' ? '员工视图' : '对话视图'"
            @click="sideTab = tab"
          >
            <el-icon class="sn-seg-ic" :size="13"><component :is="segIcon(tab)" /></el-icon><span>{{ tab }}</span>
          </button>
        </div>
        <button
          type="button"
          class="sn-tool"
          :class="{ on: searchOpen }"
          data-testid="second-nav-search-toggle"
          :aria-expanded="searchOpen ? 'true' : 'false'"
          :aria-label="searchOpen ? '收起搜索' : '搜索'"
          :title="searchOpen ? '收起搜索' : '搜索'"
          @click="toggleSearch"
        >
          <el-icon :size="14"><Search /></el-icon>
        </button>
        <button
          type="button"
          class="sn-newchat"
          data-testid="second-nav-new-chat"
          aria-label="新对话"
          title="新对话"
          @click="$emit('new-chat')"
        >
          <el-icon :size="15"><EditPen /></el-icon><span class="sn-sr">新对话</span>
        </button>
      </div>

      <!-- 搜索框：原型 .al-v14-search 默认 display:none（V21 L10871），但节点与事件链保留，由上面的开关唤出 -->
      <input
        ref="searchInputEl"
        v-model="keyword"
        class="sn-search"
        :class="{ 'is-open': searchOpen }"
        type="search"
        :placeholder="sideTab === '员工' ? '搜索员工（姓名/岗位/部门）' : '搜索会话'"
        :aria-label="sideTab === '员工' ? '搜索员工' : '搜索会话'"
        data-testid="second-nav-search"
      />

      <!-- 目录区：本列唯一的滚动容器；无端点 ⇒ 明确 unavailable，不造数据 -->
      <div class="sn-dir" data-testid="second-nav-directory" :data-dir-state="directoryState">
        <!--
          接线度说明（F1 要求的诚实披露，不得删）原先挂在 #subZone 末尾，把员工/对话横栏
          与目录整体顶低 36.78px，违反卡 §三.A.7 的 y=422 / y=460（偏差原则上为 0）。
          原型 #subZone 只有「说明块 + 标题 + 六宫格」四段，所以这里把它移到**目录首部**：
          目录内部内容不构成 y 锚点，披露不丢，锚点也不再被顶偏。
        -->
        <p v-if="pendingCount > 0" class="sn-wiring" data-testid="second-nav-wiring-note">
          常用功能已接线 {{ wiredCount }}/{{ subnavPlan.length }} · 其余待接入（不伪造成功）
        </p>
        <p v-if="directoryState === 'loading'" class="sn-empty">正在加载{{ dirNoun }}…</p>
        <p v-else-if="directoryState === 'unavailable'" class="sn-empty sn-unavailable">
          {{ directoryMessage }}
          <button type="button" class="sn-retry" data-testid="second-nav-dir-retry" @click="reloadDirectory">重试</button>
        </p>
        <p v-else-if="directoryState === 'error'" class="sn-empty sn-unavailable">
          {{ directoryMessage }}
          <button type="button" class="sn-retry" @click="reloadDirectory">重试</button>
        </p>
        <div v-else-if="visibleDirectory.length === 0" class="sn-empty">
          {{ keyword.trim() ? `没有匹配「${keyword.trim()}」的${dirNoun}` : `暂无${dirNoun}` }}
        </div>
        <div v-else class="sn-groups">
          <div v-for="g in visibleDirectory" :key="g.name" class="sn-group">
            <button type="button" class="sn-group-hd" :aria-expanded="!folded.has(g.name)" @click="toggleGroup(g.name)">
              <span class="sn-group-arr">{{ folded.has(g.name) ? "›" : "⌄" }}</span>
              <span>{{ g.name }}</span>
              <em>{{ g.staffs.length }}</em>
            </button>
            <div v-if="!folded.has(g.name)" class="sn-group-bd">
              <div v-for="s in g.staffs" :key="s.id" class="sn-staff" :title="`${s.name} · ${s.post}`">
                <span class="sn-staff-av">{{ s.name.slice(0, 1) }}</span>
                <span class="sn-staff-mid">
                  <span class="sn-staff-nm">{{ s.name }}<i class="sn-staff-post">{{ s.post }}</i></span>
                  <span class="sn-staff-sub">{{ s.summary }}</span>
                </span>
                <span v-if="s.unread" class="sn-badge">{{ s.unread }}</span>
                <span v-if="s.online !== null" class="sn-dot" :class="{ off: !s.online }" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!--
        设置钮（原型终层 #v40SetBtn）：rail 的 .rl-set 被 display:none 隐藏后，
        设置入口改挂在 .acct-zone 末位。监听归 Shell（@open-settings），本列只发事件。
      -->
      <div class="sn-acct" data-testid="second-nav-account">
        <span class="sn-av">{{ (userName || "智").slice(0, 1) }}</span>
        <span class="sn-acct-text">
          <span class="sn-name">{{ userName || "未登录" }}</span>
          <span class="sn-role">{{ roleLabel }}</span>
        </span>
        <button
          type="button"
          class="sn-setbtn"
          data-testid="second-nav-settings"
          title="设置"
          aria-label="设置"
          @click="$emit('open-settings')"
        >
          <el-icon :size="15"><Setting /></el-icon>
        </button>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
/**
 * 第二列上下文导航（WORKBENCH-10 · 原型 .side 列）
 *
 * 与 WORKBENCH-06 旧实现的**关键差别**（原型 §A-2/3/5 与 §动态交互 1/2）：
 * 1. 二级目录文案一律取原型真相源 `PROTOTYPE_SUBCATALOG`，不再拿 manifest 前 N 项冒充；
 * 2. 原型有、manifest 未接线的项 **渲染但不可点击** 并标「待接入」——不静默丢弃（§六）；
 * 3. 「常用功能」是一个真实状态（= 未选中任何一级模块），由 rail 再次点击回归；
 * 4. 员工/对话双入口、部门分组展开收起、历史会话区按原型结构落地；
 *    **目录数据当前无端点**，按 §E-4 显示 unavailable + 重试，不伪造列表。
 * 5. 折叠态保留 56px 缩略条（原型实测），不再 display:none 整列消失。
 *
 * WORKBENCH-13-F2 视觉基线对齐（只做表现层，不加接口、不改可见性规则、不删能力）：
 * 列内坐标以原型融合版 1440×1000 实测为准 —— brand 54 → #subZone(y=66) →
 * #alV21Sidehd(y≈421.8) → #sessList(y≈459.8 · 唯一滚动区) → #acctZone(y=942 · 58px 贴底)，
 * 合计恰好 1000，列本身不滚动、页面不出现纵向滚动条。
 */
import { computed, nextTick, ref, type Component } from "vue";
import {
  Comment,
  Document,
  EditPen,
  Grid,
  Printer,
  Search,
  Setting,
  Sunny,
  Tickets,
  TrendCharts,
  User,
} from "@element-plus/icons-vue";
import type { ManifestItem } from "../shared/workbench/route-manifest";
import type { MenuLoadState } from "../shared/workbench/menu-access";
import {
  PROTOTYPE_COMMON_LABEL,
  PROTOTYPE_RAIL_ITEMS,
  PROTOTYPE_SIDE_TABS,
  planPrototypeSubnav,
  type SubnavPlanEntry,
} from "../shared/workbench/prototype-nav";
import { loadAgentDirectory, loadHistoryConversations, type AgentDirectory, type DirectoryGroup } from "../shared/workbench/agent-directory";

const props = defineProps<{
  mode: "quick" | "module" | "pos";
  groups: { groupCode: string; title: string; items: ManifestItem[] }[];
  activeGroupCode: string;
  activePath: string;
  cashierItems: ManifestItem[];
  menuState: MenuLoadState;
  sessionActive: boolean;
  userName: string;
  userRoles: string[];
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  (event: "open", entry: ManifestItem): void;
  (event: "openCashier", entry: ManifestItem): void;
  (event: "new-chat"): void;
  (event: "collapse"): void;
  (event: "pick-group", groupCode: string): void;
  (event: "open-settings"): void;
}>();

// ── 一级模块 ↔ 原型 key ──
const activePrototypeKey = computed(() => {
  if (props.mode !== "module") return "desk";
  return PROTOTYPE_RAIL_ITEMS.find((item) => item.groupCode === props.activeGroupCode)?.key ?? "desk";
});

const activeGroup = computed(() => props.groups.find((g) => g.groupCode === props.activeGroupCode) ?? null);

/** 二级目录渲染计划：原型文案 × manifest 接线现状 */
const subnavPlan = computed<SubnavPlanEntry[]>(() => {
  if (props.mode === "pos") return [];
  if (props.mode === "module") return planPrototypeSubnav(activePrototypeKey.value, activeGroup.value?.items ?? []);
  // quick：常用功能 —— 对齐当前角色可见的全部已接线入口
  return planPrototypeSubnav("desk", props.groups.flatMap((g) => g.items));
});

const wiredCount = computed(() => subnavPlan.value.filter((p) => p.status === "wired").length);
const pendingCount = computed(() => subnavPlan.value.length - wiredCount.value);

const sectionTitle = computed(() => {
  if (props.mode === "pos") return "收银功能";
  if (props.mode === "module") return activeGroup.value?.title ?? "模块功能";
  return PROTOTYPE_COMMON_LABEL;
});

/** 已接线真实入口（保留原功能，不因原型结构上线而退化） */
const realEntries = computed<ManifestItem[]>(() => {
  if (props.mode === "pos") return props.cashierItems;
  if (props.mode === "module") return activeGroup.value?.items ?? [];
  return props.groups.flatMap((g) => g.items);
});
const expanded = ref(false);
const shownRealEntries = computed(() => (expanded.value ? realEntries.value : realEntries.value.slice(0, 8)));

// ── 折叠态缩略条 ──
const stripModules = computed(() =>
  props.groups.map((g) => ({ code: g.groupCode, label: g.title, short: g.title.slice(0, 2) })),
);

/**
 * 常用功能卡图标：原型 QUICK 每项带 16px 图标（融合版 L2268 起 · renderSubZone L2313），
 * 而 manifest 条目没有图标字段（见 shared/workbench/route-manifest 的 ManifestItem），
 * 故按**原型文案**建静态映射，取到不到就用通用网格图标兜底——不引入任何新业务数据。
 */
const CARD_ICONS: Record<string, Component> = {
  建销售单: Document,
  库存查询: Search,
  销售汇总: TrendCharts,
  今日晨报: Sunny,
  批量对账: Tickets,
  打印模板: Printer,
};
function cardIcon(label: string): Component {
  return CARD_ICONS[label] ?? Grid;
}

/** 分段控件图标 = 原型 IC_CREW / IC_CHAT（融合版 L15632） */
const SIDE_TAB_ICONS: Record<string, Component> = {
  员工: User,
  对话: Comment,
};
function segIcon(tab: string): Component {
  return SIDE_TAB_ICONS[tab] ?? Grid;
}

// ── 员工/对话双入口 ──
type SideTab = (typeof PROTOTYPE_SIDE_TABS)[number];
const sideTab = ref<SideTab>("员工");
const keyword = ref("");
const folded = ref<Set<string>>(new Set());

/** 搜索框：默认隐藏（原型口径），由横栏的图标钮唤出并聚焦 */
const searchOpen = ref(false);
const searchInputEl = ref<HTMLInputElement | null>(null);
function toggleSearch(): void {
  searchOpen.value = !searchOpen.value;
  if (searchOpen.value) void nextTick(() => searchInputEl.value?.focus());
}

const directory = ref<AgentDirectory["groups"]>([]);
const directoryState = ref<AgentDirectory["state"]>("loading");
const directoryMessage = ref("");
const dirNoun = computed(() => (sideTab.value === "员工" ? "数字员工" : "历史会话"));

/**
 * 目录的本地过滤：只在上限内已加载的分组/条目里做字符串匹配，
 * 不发新请求、不补任何服务端没有的条目；关键词为空时原样返回。
 */
const visibleDirectory = computed<DirectoryGroup[]>(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return directory.value;
  return directory.value
    .map((g) => ({
      ...g,
      staffs: g.staffs.filter((s) => `${g.name} ${s.name} ${s.post} ${s.summary}`.toLowerCase().includes(q)),
    }))
    .filter((g) => g.staffs.length > 0);
});

async function reloadDirectory(): Promise<void> {
  directoryState.value = "loading";
  const result = sideTab.value === "员工" ? await loadAgentDirectory() : await loadHistoryConversations();
  directory.value = result.groups;
  directoryState.value = result.state;
  directoryMessage.value = result.message;
}
void reloadDirectory();

function toggleGroup(name: string): void {
  const next = new Set(folded.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  folded.value = next;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "超级管理员",
  STORE_MANAGER: "店长",
  STORE_OPERATOR: "门店操作员",
  STORE_CASHIER: "收银员",
  FINANCE_STAFF: "财务",
  WAREHOUSE_STAFF: "仓管员",
};
const roleLabel = computed(() => {
  const mapped = props.userRoles.map((role) => ROLE_LABELS[role]).filter(Boolean);
  return mapped.length > 0 ? mapped.join(" · ") : props.userRoles.join(" · ") || "未登录";
});

function isActive(entry: ManifestItem | null): boolean {
  if (!entry || !entry.path) return false;
  return props.activePath === entry.path || props.activePath.startsWith(`${entry.path}/`);
}

function emitPlan(plan: SubnavPlanEntry): void {
  if (plan.status !== "wired" || !plan.item) return;
  emit("open", plan.item);
}

defineExpose({ keyword });
</script>

<style scoped>
/* ══ 列骨架（原型 aside.side：x=60 w=230 h=1000 · #F9FAFB · 右边线 #ECEEF1）══ */
.wb-subnav {
  width: 100%;
  min-width: 0;
  /* 运行态取证实测：content-box + border-right 1px 会让侧栏实测 231/57，
     比原型 230/56 各偏 +1。改 border-box 后边框计入列宽，实测回到 230/56。 */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--wb-side-bg, #f9fafb);
  border-right: 1px solid var(--wb-line, #eceef1);
  overflow: hidden;
}
/* 折叠态不使用 display:none（会瞬隐并让入口彻底不可达），改为裁掉溢出后渲染缩略条 */
.wb-subnav.hidden {
  overflow: hidden;
}

/* ══ 品牌区（原型 .brand-side · V30 终值 L15207）══ */
.sn-brand {
  box-sizing: border-box;
  margin: 0;
  height: 54px;
  min-height: 54px;
  padding: 0 10px 0 14px;
  border: 0;
  border-bottom: 1px solid var(--wb-line-strong, #dde2e9);
  border-radius: 0;
  background: var(--wb-panel, #ffffff);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.sn-logo {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sn-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.sn-t {
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sn-s {
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sn-collapse {
  border: 0;
  background: transparent;
  color: var(--wb-ink2, #8a8f98);
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  flex-shrink: 0;
}
.sn-collapse:hover {
  background: var(--wb-hover, #f4f6f8);
}

/* ══ 折叠缩略条 ══ */
.sn-collapsed {
  flex: 1;
  overflow-y: auto;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sn-strip-item {
  border: 0;
  background: transparent;
  border-radius: 6px;
  padding: 8px 0;
  font-family: inherit;
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
  cursor: pointer;
}
.sn-strip-item:hover,
.sn-strip-item.on {
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
}

/* ══ 常用功能区（原型 #subZone · L130）：非滚动块，顶边 = brand 54 + margin 12 = y 66 ══ */
.sn-subzone {
  box-sizing: border-box;
  flex-shrink: 0;
  margin: 12px 14px 6px;
  padding: 0 4px 14px;
  border-bottom: 1px solid var(--wb-line-strong, #dde2e9);
}

/* 双入口说明块（原型 .mf-dual · L912，文案 L3923） */
.sn-dual {
  box-sizing: border-box;
  margin: 0 0 8px;
  padding: 8px 10px;
  border: 1px dashed var(--wb-line-strong, #dde2e9);
  border-radius: 10px;
  background: var(--wb-side-bg, #f9fafb);
  font-size: 11px;
  line-height: 1.7;
  color: var(--wb-ink2, #8a8f98);
}
.sn-dual b {
  color: var(--wb-primary, #2563eb);
  font-weight: 700;
}

/* 小标题（原型 .sub-zone .qk-t · L131，V37 起为 flex 行） */
.sn-title {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 15px;
  margin: 0 4px 9px;
  font-size: 11px;
  line-height: 15px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--wb-ink2, #8a8f98);
}

/* 卡网格（原型 .sub-grid · L132：1fr 1fr · gap 7） */
.sn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}
/* 功能卡（原型 .sub-card · L133：93×55.8 = 16 图标 + 5 gap + 13.75 文案 + 19 padding + 2 边框） */
.sn-card {
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 4px 9px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 10px;
  background: var(--wb-panel, #ffffff);
  color: var(--wb-ink, #16181d);
  font-family: inherit;
  font-size: 11px;
  line-height: 1.25;
  text-align: center;
  cursor: pointer;
  user-select: none;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}
.sn-card-ic {
  color: var(--wb-ink2, #8a8f98);
}
.sn-card-tx {
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.sn-card:hover:not(:disabled) {
  border-color: var(--wb-primary, #2563eb);
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
}
.sn-card:hover:not(:disabled) .sn-card-ic {
  color: var(--wb-primary, #2563eb);
}
.sn-card.active {
  border-color: var(--wb-primary, #2563eb);
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
}
.sn-card.pending {
  border-style: dashed;
  color: var(--wb-ink2, #8a8f98);
  cursor: not-allowed;
}
/* 待接入角标绝对定位：不占行高，避免把 55.8 的卡高撑歪 */
.sn-pending {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 9px;
  line-height: 1.2;
  color: var(--wb-muted, #b0b6c0);
}
.sn-wiring {
  margin: 6px 2px 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--wb-ink2, #8a8f98);
}

/* ══ 已接线入口区（模块/收银态）══ */
.sn-zone {
  box-sizing: border-box;
  flex-shrink: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0 14px 6px;
  padding: 6px 4px 0;
}
.sn-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sn-row {
  text-align: left;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  padding: 6px 8px;
  font-family: inherit;
  font-size: 12px;
  color: var(--wb-ink, #16181d);
  cursor: pointer;
}
.sn-row:hover {
  background: var(--wb-hover, #f4f6f8);
}
.sn-row.active {
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
}
.sn-more {
  margin-top: 6px;
  border: 0;
  background: transparent;
  font-family: inherit;
  color: var(--wb-primary, #2563eb);
  font-size: 11px;
  cursor: pointer;
}

/* ══ 员工/对话横栏（原型 #alV21Sidehd · V36 L18304）：y≈421.8 · h=32 ══ */
.sn-sidehd {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-height: 32px;
  margin: 10px 14px 6px;
}
/* 原型 V36 把 .t 改成 sr-only：节点留在 DOM（读屏/测试可达），视觉让位给分段控件 */
.sn-sidehd-t {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
/* 分段控件（原型 .v31-segbar L15552 + .v31-seg L15553：钮 53×26 · 栏 32） */
.sn-seg {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 2px;
  background: var(--wb-hover, #f4f6f8);
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 8px;
}
.sn-seg-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  padding: 5px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--wb-ink2, #8a8f98);
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.sn-seg-btn:hover {
  color: var(--wb-ink, #16181d);
}
.sn-seg-btn.on {
  background: var(--wb-panel, #ffffff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
.sn-seg-ic {
  color: inherit;
}
/* 栏内图标钮（搜索开关 · 尺寸沿用原型 .v31-taskbtn L15557 的 26×26 档） */
.sn-tool {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  margin: 0;
  flex-shrink: 0;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 8px;
  background: var(--wb-panel, #ffffff);
  color: var(--wb-ink2, #8a8f98);
  font-size: 0;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}
.sn-tool:hover {
  color: var(--wb-primary, #2563eb);
  border-color: var(--wb-primary, #2563eb);
  background: var(--wb-hover, #f4f6f8);
}
.sn-tool.on {
  color: var(--wb-primary, #2563eb);
  border-color: var(--wb-primary, #2563eb);
  background: var(--wb-primary-soft, #eff4ff);
}
/* 新对话（原型 V36 .al-v21-sidehd .newchat：32×32 描边图标钮 · 栏末位） */
.sn-newchat {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-width: 0;
  margin: 0;
  padding: 0;
  gap: 0;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--wb-line, #eceef1);
  /* 原型终层实测量值（1440×1000 真实渲染，2026-11-03 探针）：`#newChatBtn` = 32×32 / radius **10px** / 白底 #ECEEF1 描边。
     源码 L18307 的 `border-radius:8px` 是 V36 注入前的字面串，运行时被后续层改写为 10px——
     卡 §六 要求以原型真实渲染为真相源，故取 10px（并排读数一致才算对齐）。 */
  border-radius: 10px;
  background: var(--wb-panel, #ffffff);
  color: var(--wb-ink, #16181d);
  font-family: inherit;
  font-size: 0;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}
.sn-newchat:hover {
  background: var(--wb-hover, #f4f6f8);
  border-color: var(--wb-primary, #2563eb);
  color: var(--wb-primary, #2563eb);
}
.sn-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 搜索框（原型 .al-v14-search：V21 L10871 起 display:none，节点与事件链原样保留） */
.sn-search {
  box-sizing: border-box;
  display: none;
  flex-shrink: 0;
  width: auto;
  margin: 6px 14px 2px;
  padding: 8px 10px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 10px;
  background: var(--wb-panel, #ffffff);
  color: var(--wb-ink, #16181d);
  font-family: inherit;
  font-size: 12px;
  outline: none;
}
.sn-search.is-open {
  display: block;
}
.sn-search:focus {
  border-color: var(--wb-primary, #2563eb);
}

/* ══ 目录（原型 #sessList）：本列唯一滚动容器 · y≈459.8 · 贴到 acct 上沿 942 ══ */
.sn-dir {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 6px 10px;
}
.sn-empty {
  margin: 8px 2px;
  font-size: 12px;
  color: var(--wb-ink2, #8a8f98);
}
.sn-unavailable {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.sn-retry {
  border: 1px solid var(--wb-line, #eceef1);
  background: var(--wb-panel, #fff);
  border-radius: 5px;
  padding: 1px 6px;
  font-family: inherit;
  font-size: 11px;
  color: var(--wb-primary, #2563eb);
  cursor: pointer;
}
.sn-groups {
  display: flex;
  flex-direction: column;
}
/* 分组头（原型 .al-v14-hd L9012：padding 10px 12px 6px · 11px · --sub） */
.sn-group-hd {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: 0;
  border-top: 1px solid var(--wb-line, #eceef1);
  background: transparent;
  padding: 10px 12px 6px;
  margin-top: 2px;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.5px;
  color: var(--wb-ink2, #8a8f98);
  cursor: pointer;
  text-align: left;
  user-select: none;
}
.sn-groups > .sn-group:first-child .sn-group-hd {
  border-top: 0;
  margin-top: 0;
}
.sn-group-arr {
  width: 10px;
  flex-shrink: 0;
}
.sn-group-hd em {
  font-style: normal;
  color: var(--wb-muted, #b0b6c0);
}
/* 员工行（原型 .al-v14-ct L9018 + .al-v14-av L9021：209×45 · radius 10 · padding 7px 10px） */
.sn-staff {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 45px;
  padding: 7px 10px;
  border-radius: 10px;
  cursor: pointer;
}
.sn-staff:hover {
  background: var(--wb-hover, #f4f6f8);
}
.sn-staff-av {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-size: 15px;
  font-weight: 700;
  font-style: normal;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sn-staff-mid {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.sn-staff-nm {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  line-height: 15px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
  white-space: nowrap;
  overflow: hidden;
}
.sn-staff-post {
  font-style: normal;
  font-size: 10px;
  font-weight: 400;
  color: var(--wb-ink2, #8a8f98);
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sn-staff-sub {
  font-size: 10.5px;
  line-height: 13px;
  margin-top: 1px;
  color: var(--wb-ink2, #8a8f98);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sn-badge {
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: var(--wb-danger, #dc2626);
  color: #fff;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  flex-shrink: 0;
}
.sn-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wb-success, #16a34a);
  flex-shrink: 0;
}
.sn-dot.off {
  background: var(--wb-muted, #b0b6c0);
}

/* ══ 底部账号区（原型 #acctZone L59：58px 贴底 · #F4F6F8 · 上边线 #ECEEF1）══ */
.sn-acct {
  box-sizing: border-box;
  flex-shrink: 0;
  height: 58px;
  min-height: 58px;
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 10px 12px 12px;
  background: var(--wb-hover, #f4f6f8);
  border: 0;
  border-top: 1px solid var(--wb-line, #eceef1);
}
.sn-av {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  /* 原型 .av：渐变实底 + 白字，非浅蓝底蓝字；头像↔文字距 9px，
     本列没有原型 .acct 内层包装（不让改结构），用 margin 补足 9 − 栏 gap 4 的差值 */
  margin-right: 5px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sn-acct-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.sn-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sn-role {
  font-size: 10.5px;
  color: var(--wb-ink2, #8a8f98);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 设置钮（原型终层 .v40-setbtn：36×32 · radius 8 · 透明底 #68758A · hover 白底深字） */
.sn-setbtn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 32px;
  padding: 0;
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #68758a;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.sn-setbtn:hover {
  background: var(--wb-panel, #ffffff);
  color: var(--wb-ink, #16181d);
}
</style>
