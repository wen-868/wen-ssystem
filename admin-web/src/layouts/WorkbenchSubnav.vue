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
      <div class="sn-scroll">
        <button type="button" class="sn-newchat" data-testid="second-nav-new-chat" @click="$emit('new-chat')">
          <el-icon :size="15"><EditPen /></el-icon>新对话
        </button>

        <!-- ══ 二级目录区：原型二级目录为唯一文案真相源，未接线的项标「待接入」而非丢弃 ＝═ -->
        <div class="sn-zone" data-testid="second-nav-sub-zone">
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
              {{ plan.label }}
              <span v-if="plan.status === 'pending'" class="sn-pending">待接入</span>
            </button>
          </div>
          <p v-if="subnavPlan.length === 0" class="sn-empty">
            {{ menuState === "loading" ? "正在加载菜单…" : menuState === "error" ? "菜单加载失败（不回退全量）" : "当前角色暂无可见入口" }}
          </p>
          <p v-else-if="pendingCount > 0" class="sn-wiring" data-testid="second-nav-wiring-note">
            已接线 {{ wiredCount }}/{{ subnavPlan.length }} · 其余待接入（不伪造成功）
          </p>
        </div>

        <!-- ══ 已接线真实入口：保留今日可用能力，不因为原型结构上线而退化 ＝═ -->
        <div v-if="mode === 'quick' && realEntries.length > 0" class="sn-zone" data-testid="second-nav-real-zone">
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

        <!-- ══ 员工 / 对话 双入口（原型 v31-seg）＝═ -->
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
              @click="sideTab = tab"
            >
              {{ tab }}
            </button>
          </div>
        </div>

        <input
          v-model="keyword"
          class="sn-search"
          type="search"
          :placeholder="sideTab === '员工' ? '搜索员工' : '搜索会话'"
          data-testid="second-nav-search"
        />

        <!-- 目录区：无端点 ⇒ 明确 unavailable，不造数据 -->
        <div class="sn-dir" data-testid="second-nav-directory" :data-dir-state="directoryState">
          <p v-if="directoryState === 'loading'" class="sn-empty">正在加载{{ dirNoun }}…</p>
          <p v-else-if="directoryState === 'unavailable'" class="sn-empty sn-unavailable">
            {{ directoryMessage }}
            <button type="button" class="sn-retry" data-testid="second-nav-dir-retry" @click="reloadDirectory">重试</button>
          </p>
          <p v-else-if="directoryState === 'error'" class="sn-empty sn-unavailable">
            {{ directoryMessage }}
            <button type="button" class="sn-retry" @click="reloadDirectory">重试</button>
          </p>
          <div v-else-if="directory.length === 0" class="sn-empty">暂无{{ dirNoun }}</div>
          <div v-else class="sn-groups">
            <div v-for="g in directory" :key="g.name" class="sn-group">
              <button type="button" class="sn-group-hd" :aria-expanded="!folded.has(g.name)" @click="toggleGroup(g.name)">
                <span class="sn-group-arr">{{ folded.has(g.name) ? "›" : "⌄" }}</span>
                <span>{{ g.name }}</span>
                <em>{{ g.staffs.length }}</em>
              </button>
              <div v-if="!folded.has(g.name)" class="sn-group-bd">
                <div v-for="s in g.staffs" :key="s.id" class="sn-staff">
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
      </div>

      <div class="sn-acct" data-testid="second-nav-account">
        <span class="sn-av">{{ (userName || "智").slice(0, 1) }}</span>
        <span class="sn-acct-text">
          <span class="sn-name">{{ userName || "未登录" }}</span>
          <span class="sn-role">{{ roleLabel }}</span>
        </span>
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
 */
import { computed, ref } from "vue";
import { EditPen } from "@element-plus/icons-vue";
import type { ManifestItem } from "../shared/workbench/route-manifest";
import type { MenuLoadState } from "../shared/workbench/menu-access";
import {
  PROTOTYPE_COMMON_LABEL,
  PROTOTYPE_RAIL_ITEMS,
  PROTOTYPE_SIDE_TABS,
  planPrototypeSubnav,
  type SubnavPlanEntry,
} from "../shared/workbench/prototype-nav";
import { loadAgentDirectory, loadHistoryConversations, type AgentDirectory } from "../shared/workbench/agent-directory";

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

// ── 员工/对话双入口 ──
type SideTab = (typeof PROTOTYPE_SIDE_TABS)[number];
const sideTab = ref<SideTab>("员工");
const keyword = ref("");
const folded = ref<Set<string>>(new Set());

const directory = ref<AgentDirectory["groups"]>([]);
const directoryState = ref<AgentDirectory["state"]>("loading");
const directoryMessage = ref("");
const dirNoun = computed(() => (sideTab.value === "员工" ? "数字员工" : "历史会话"));

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

/** 过滤：搜索关键词只作用于目录区 */
defineExpose({ keyword });
</script>

<style scoped>
.wb-subnav {
  width: 100%;
  min-width: 0;
  /* 运行态取证实测：content-box + border-right 1px 会让侧栏实测 231/57，
     比原型 230/56 各偏 +1。改 border-box 后边框计入列宽，实测回到 230/56。 */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--wb-panel, #fff);
  border-right: 1px solid var(--wb-line, #eceef1);
  overflow: hidden;
}
/* 折叠态不使用 display:none（会瞬隐并让入口彻底不可达），改为裁掉溢出后渲染缩略条 */
.wb-subnav.hidden {
  overflow: hidden;
}
.sn-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--wb-line, #eceef1);
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
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
.sn-collapse:hover {
  background: var(--wb-hover, #f4f6f8);
}
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
.sn-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
}
.sn-newchat {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 0;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 12px;
}
.sn-newchat:hover {
  filter: brightness(1.05);
}
.sn-zone {
  margin-bottom: 10px;
}
.sn-title {
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
  margin: 0 2px 8px;
}
.sn-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.sn-card {
  padding: 8px 6px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 8px;
  background: var(--wb-panel, #fff);
  color: var(--wb-ink, #16181d);
  font-size: 12px;
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}
.sn-card:hover:not(:disabled) {
  border-color: var(--wb-primary, #2563eb);
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
.sn-pending {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--wb-muted, #b0b6c0);
}
.sn-wiring {
  margin: 6px 2px 0;
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
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
  color: var(--wb-primary, #2563eb);
  font-size: 11px;
  cursor: pointer;
}
.sn-sidehd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 2px 6px;
}
.sn-sidehd-t {
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
}
.sn-seg {
  display: inline-flex;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 6px;
  overflow: hidden;
}
.sn-seg-btn {
  border: 0;
  background: transparent;
  padding: 3px 8px;
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
  cursor: pointer;
}
.sn-seg-btn.on {
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
}
.sn-search {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 6px;
  font-size: 12px;
  outline: none;
  margin-bottom: 8px;
}
.sn-search:focus {
  border-color: var(--wb-primary, #2563eb);
}
.sn-dir {
  margin-top: 4px;
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
  font-size: 11px;
  color: var(--wb-primary, #2563eb);
  cursor: pointer;
}
.sn-groups {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sn-group-hd {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 5px 4px;
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
  cursor: pointer;
  text-align: left;
}
.sn-group-arr {
  width: 10px;
}
.sn-group-hd em {
  font-style: normal;
  color: var(--wb-muted, #b0b6c0);
}
.sn-staff {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 4px 6px 16px;
  border-radius: 6px;
  cursor: pointer;
}
.sn-staff:hover {
  background: var(--wb-hover, #f4f6f8);
}
.sn-staff-av {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-size: 11px;
  font-weight: 700;
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
  font-size: 12px;
  color: var(--wb-ink, #16181d);
}
.sn-staff-post {
  font-style: normal;
  margin-left: 4px;
  font-size: 10px;
  color: var(--wb-muted, #b0b6c0);
}
.sn-staff-sub {
  font-size: 10px;
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
.sn-acct {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--wb-line, #eceef1);
}
.sn-av {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
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
}
</style>
