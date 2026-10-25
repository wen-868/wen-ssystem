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
        aria-label="收起导航"
        @click="$emit('collapse')"
      >
        «
      </button>
    </div>

    <div class="sn-scroll">
      <button type="button" class="sn-newchat" data-testid="second-nav-new-chat" @click="$emit('new-chat')">
        <el-icon :size="15"><EditPen /></el-icon>新对话
      </button>

      <!-- 二级目录区：收银态=收银功能；模块态=所选一级模块的二级项；默认=常用功能（原型 renderSubZone L2306） -->
      <div class="sn-zone" data-testid="second-nav-sub-zone">
        <div class="sn-title">{{ sectionTitle }}</div>
        <div class="sn-grid">
          <button
            v-for="entry in listedItems"
            :key="entry.menuCode"
            type="button"
            class="sn-card"
            :class="{ active: isActive(entry) }"
            :data-menu-code="entry.menuCode"
            @click="emitEntry(entry)"
          >
            {{ entry.title }}
          </button>
        </div>
        <p v-if="listedItems.length === 0" class="sn-empty">
          {{ menuState === "loading" ? "正在加载菜单…" : menuState === "error" ? "菜单加载失败（不回退全量）" : "当前角色暂无可见入口" }}
        </p>
      </div>
    </div>

    <div class="sn-acct" data-testid="second-nav-account">
      <span class="sn-av">{{ (userName || "智").slice(0, 1) }}</span>
      <span class="sn-acct-text">
        <span class="sn-name">{{ userName || "未登录" }}</span>
        <span class="sn-role">{{ roleLabel }}</span>
      </span>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * 第二列上下文导航（WORKBENCH-06 · 原型 .side 列，HTML L923 / renderSubZone L2306）
 *
 * 原型语义在本实现的真实映射：
 *   - 常用功能（QUICK）= 当前可见人工入口的前 10 项（manifest 派生，不造数据）；
 *   - 二级目录 = 所选一级模块的 items（角色×动态菜单双重裁剪后集合）；
 *   - 收银态 = 收银 9 项（meta.roles 保底，不吃菜单交集）；
 *   - 新对话 = 触发壳层 startNewConversation（真实会话清空 + 切 chat 面）；
 *   - 会话列表：AI 底座当前无历史会话端点 ⇒ 不伪造列表（登记回传卡差异清单）。
 * 点二级项一律走 `emit('open')` ⇒ 壳层切人工并打开真实路由（原型 actSub 语义 L2314）。
 */
import { computed } from "vue";
import { EditPen } from "@element-plus/icons-vue";
import type { ManifestItem } from "../shared/workbench/route-manifest";
import type { MenuLoadState } from "../shared/workbench/menu-access";

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
}>();

const sectionTitle = computed(() => {
  if (props.mode === "pos") return "收银功能";
  if (props.mode === "module") {
    return props.groups.find((group) => group.groupCode === props.activeGroupCode)?.title ?? "模块功能";
  }
  return "常用功能";
});

const listedItems = computed<ManifestItem[]>(() => {
  if (props.mode === "pos") return props.cashierItems;
  if (props.mode === "module") {
    const group = props.groups.find((entry) => entry.groupCode === props.activeGroupCode);
    return group ? group.items : [];
  }
  return props.groups.flatMap((group) => group.items).slice(0, 10);
});

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

function isActive(entry: ManifestItem): boolean {
  if (!entry.path) return false;
  return props.activePath === entry.path || props.activePath.startsWith(`${entry.path}/`);
}

function emitEntry(entry: ManifestItem): void {
  if (props.mode === "pos") emit("openCashier", entry);
  else emit("open", entry);
}
</script>

<style scoped>
.wb-subnav {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--wb-panel, #fff);
  border-right: 1px solid var(--wb-line, #eceef1);
  overflow: hidden;
}
.wb-subnav.hidden {
  display: none;
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
  /* 对齐原型 L133-134 `.sub-card` + `i{transition:.15s}`（WORKBENCH-06F3 MISSING #4） */
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}
.sn-card:hover {
  border-color: var(--wb-primary, #2563eb);
  color: var(--wb-primary, #2563eb);
}
.sn-card.active {
  border-color: var(--wb-primary, #2563eb);
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
}
.sn-empty {
  margin: 8px 2px;
  font-size: 12px;
  color: var(--wb-ink2, #8a8f98);
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
.sn-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
}
.sn-role {
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
