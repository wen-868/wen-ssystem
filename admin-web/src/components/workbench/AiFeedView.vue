<template>
  <section class="fdv" aria-label="工作台信息流" data-testid="feed-view">
    <header class="fdv-head">
      <div class="fdv-hi">
        <div class="fdv-name">{{ greeting }}，{{ userName || "同事" }}</div>
        <div class="fdv-sub">{{ todayLabel }} · {{ feedSummary }}</div>
      </div>
      <span v-if="socketOnline" class="fdv-live" data-testid="feed-live">
        <span class="fdv-dot" />实时推送中
      </span>
      <span v-else class="fdv-live is-off" data-testid="feed-live-off">推送离线（不影响人工操作）</span>
    </header>

    <button type="button" class="fdv-ask" data-testid="feed-ask" @click="$emit('ask', '今日晨报')">
      <el-icon :size="15"><MagicStick /></el-icon>
      问智享AI · 或点下方事件直接处理
    </button>

    <!-- AI 待审阅（真实端点 /api/chat/confirmations；未取到 ⇒ 整块隐藏，不显示假 0） -->
    <div v-if="confirmations.length > 0" class="fdv-block" data-testid="feed-review-block">
      <div class="fdv-block-title">
        AI 待审阅<span>写操作经确认后生效 · 全程留痕</span>
      </div>
      <div v-for="(item, index) in confirmations" :key="item.id ?? index" class="fdv-item is-review">
        <span class="fdv-ic"><el-icon :size="16"><Stamp /></el-icon></span>
        <span class="fdv-bd">
          <span class="fdv-t">{{ item.operation || "AI 写操作" }}<em class="fdv-src">AI 预审完成</em></span>
          <span class="fdv-d">{{ item.summary || "等待你确认后执行" }}</span>
        </span>
        <span class="fdv-side">
          <button type="button" class="fdv-btn" @click="$emit('open-chat')">去会话处理</button>
        </span>
      </div>
    </div>

    <!-- 业务动态（真实端点 /admin/wb-notifications，与消息中心同源；空/失败均为诚实态） -->
    <div class="fdv-block" data-testid="feed-msg-block">
      <div class="fdv-block-title">
        业务动态<span>系统 / 订单 / 支付 / 预警 / 信用 / 召回消息（未读优先）</span>
      </div>
      <p v-if="msgState === 'loading'" class="fdv-empty">正在加载业务动态…</p>
      <p v-else-if="msgState === 'error'" class="fdv-empty is-error">业务动态加载失败（不影响人工操作，可进入消息中心重试）</p>
      <p v-else-if="messages.length === 0" class="fdv-empty">暂无业务动态</p>
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="fdv-item"
        :class="{ unread: !msg.isRead }"
      >
        <span class="fdv-ic"><el-icon :size="16"><Bell /></el-icon></span>
        <span class="fdv-bd">
          <span class="fdv-t">{{ msg.title }}<em class="fdv-src">{{ typeLabel(msg.type) }}</em></span>
          <span class="fdv-d">{{ msg.summary || msg.content || "" }}</span>
        </span>
        <span class="fdv-side">
          <span class="fdv-time">{{ shortTime(msg.createdAt) }}</span>
          <button type="button" class="fdv-btn" @click="openMessages">查看</button>
        </span>
      </div>
    </div>

    <!-- 快速入口（当前角色可见的真实业务入口，点击 = 切人工打开对应页；不造数据） -->
    <div v-if="items.length > 0" class="fdv-block" data-testid="feed-quick-block">
      <div class="fdv-block-title">
        去工作台人工办理<span>AI 能办的在对话里执行；需要完整界面的打开操作界面（原型交互口径）</span>
      </div>
      <div class="fdv-chips">
        <button
          v-for="entry in items.slice(0, 12)"
          :key="entry.menuCode"
          type="button"
          class="fdv-chip"
          :data-menu-code="entry.menuCode"
          @click="$emit('open', entry)"
        >
          {{ entry.title }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 工作台信息流主面（WORKBENCH-06 · 原型 renderFeed L2069 的结构对齐版）
 *
 * 数据全部真实、可复跑，零 mock：
 *   - 业务动态 = GET /admin/wb-notifications（与 MessageCenter 同一端点同一形态）；
 *   - AI 待审阅 = GET /api/chat/confirmations（失败 ⇒ 隐藏，不显示 0 假装无待办）；
 *   - 实时推送 = connectAiPushSocket（AI 底座 WS；离线如实标注「推送离线」，不影响人工）；
 *   - 原型 FEED 里的事件流/订单跟踪进度条依赖底座 feed 端点（能力台账 ai-03 = PLANNED）⇒
 *     不伪造，登记差异清单。问候语/日期为本地计算，非数据源。
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Bell, MagicStick, Stamp } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
import { api } from "../../api/request";
import { connectAiPushSocket, fetchAiConfirmations, type AiConfirmationItem } from "../../api/ai";
import type { ManifestItem } from "../../shared/workbench/route-manifest";

interface FeedMessage {
  id: number;
  title?: string;
  summary?: string;
  content?: string;
  type?: string;
  isRead?: boolean | number;
  createdAt?: string;
}

const props = defineProps<{
  userName: string;
  items: ManifestItem[];
  sessionState: "idle" | "streaming" | "error";
  pendingReviewCount: number | null;
}>();

defineEmits<{
  (event: "ask", prompt: string): void;
  (event: "open", entry: ManifestItem): void;
  (event: "open-chat"): void;
}>();

const router = useRouter();

const TYPE_LABELS: Record<string, string> = {
  SYSTEM: "系统",
  ORDER: "订单",
  PAYMENT: "支付",
  ALERT: "预警",
  CREDIT: "信用",
  RECALL: "召回",
};
function typeLabel(type?: string): string {
  return TYPE_LABELS[String(type ?? "").toUpperCase()] ?? "消息";
}
function shortTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const hour = new Date().getHours();
const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
const week = "日一二三四五六"[new Date().getDay()];
const todayLabel = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${week}`;
});

const msgState = ref<"loading" | "ready" | "error">("loading");
const messages = ref<FeedMessage[]>([]);
const confirmations = ref<AiConfirmationItem[]>([]);
const socketOnline = ref(false);

const feedSummary = computed(() => {
  const unread = messages.value.filter((m) => !m.isRead).length;
  const review = props.pendingReviewCount;
  const parts = [`${messages.value.length} 条动态`];
  if (unread > 0) parts.push(`${unread} 条未读`);
  if (review !== null && review > 0) parts.push(`${review} 项待审阅`);
  return parts.join(" · ");
});

async function loadMessages(): Promise<void> {
  msgState.value = "loading";
  try {
    const { data: res } = await api.get("/admin/wb-notifications", {
      params: { page: 1, pageSize: 10 },
    });
    const data = res.data ?? res ?? {};
    messages.value = (data.records ?? data.list ?? []) as FeedMessage[];
    msgState.value = "ready";
  } catch {
    msgState.value = "error";
    messages.value = [];
  }
}

async function loadConfirmations(): Promise<void> {
  try {
    const rows = await fetchAiConfirmations();
    confirmations.value = Array.isArray(rows) ? rows.slice(0, 5) : [];
  } catch {
    confirmations.value = [];
  }
}

let disconnectPush: (() => void) | null = null;
onMounted(() => {
  loadMessages();
  loadConfirmations();
  disconnectPush = connectAiPushSocket({
    onMessage: () => {
      // 收到推送即刷新动态与待审阅（真实触发，不本地伪造）
      loadMessages();
      loadConfirmations();
    },
    onStatusChange: (connected) => {
      socketOnline.value = connected;
    },
  });
});
onBeforeUnmount(() => {
  disconnectPush?.();
  disconnectPush = null;
});

function openMessages(): void {
  router.push("/messages");
}
</script>

<style scoped>
.fdv {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 24px 24px;
}
.fdv-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.fdv-name {
  font-size: 19px;
  font-weight: 700;
  color: var(--wb-ink, #16181d);
}
.fdv-sub {
  margin-top: 3px;
  font-size: 12px;
  color: var(--wb-ink2, #8a8f98);
}
.fdv-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #16a34a;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  white-space: nowrap;
}
.fdv-live.is-off {
  color: #8a8f98;
  background: #f4f6f8;
  border-color: #eceef1;
}
.fdv-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #16a34a;
  animation: fdv-blink 1.4s ease-in-out infinite;
}
@keyframes fdv-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.fdv-ask {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 12px;
  background: var(--wb-panel, #fff);
  color: var(--wb-primary, #2563eb);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}
.fdv-ask:hover {
  border-color: var(--wb-primary, #2563eb);
  background: var(--wb-primary-soft, #eff4ff);
}
.fdv-block {
  margin-bottom: 18px;
}
.fdv-block-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
  margin: 0 2px 8px;
}
.fdv-block-title span {
  font-size: 11px;
  font-weight: 400;
  color: var(--wb-ink2, #8a8f98);
}
.fdv-empty {
  margin: 4px 2px;
  font-size: 12px;
  color: var(--wb-ink2, #8a8f98);
}
.fdv-empty.is-error {
  color: #b42318;
}
.fdv-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 14px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 10px;
  background: var(--wb-panel, #fff);
  margin-bottom: 8px;
}
.fdv-item.unread {
  border-color: #bcd0f7;
  background: #fbfcff;
}
.fdv-item.is-review {
  border-color: #f5d9a8;
  background: #fffdf7;
}
.fdv-ic {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.fdv-bd {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fdv-t {
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
  display: flex;
  align-items: center;
  gap: 8px;
}
.fdv-src {
  font-style: normal;
  font-size: 11px;
  font-weight: 400;
  color: var(--wb-ink2, #8a8f98);
  padding: 0 6px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 4px;
  white-space: nowrap;
}
.fdv-d {
  font-size: 12px;
  color: var(--wb-ink2, #8a8f98);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fdv-side {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.fdv-time {
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
  white-space: nowrap;
}
.fdv-btn {
  padding: 4px 10px;
  border: 1px solid var(--wb-primary, #2563eb);
  border-radius: 6px;
  background: transparent;
  color: var(--wb-primary, #2563eb);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.fdv-btn:hover {
  background: var(--wb-primary, #2563eb);
  color: #fff;
}
.fdv-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.fdv-chip {
  padding: 7px 12px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 8px;
  background: var(--wb-panel, #fff);
  color: var(--wb-ink, #16181d);
  font-size: 12px;
  cursor: pointer;
}
.fdv-chip:hover {
  border-color: var(--wb-primary, #2563eb);
  color: var(--wb-primary, #2563eb);
}
</style>
