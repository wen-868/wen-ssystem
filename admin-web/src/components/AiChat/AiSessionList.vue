<template>
  <!-- 会话列表（原型 L1229「hover「⋯」→ 归档 / 删除，归档区可展开恢复」的结构实现）
       数据全部来自 wb-chat-sessions 适配器：缺端点 ⇒ 暂不可用 + 重试，绝不本地伪成功 -->
  <section class="sess-list" data-testid="chat-session-list" aria-label="会话列表">
    <header class="sess-head">
      <span class="sess-head-title">会话</span>
      <div class="sess-head-actions">
        <button
          type="button"
          class="sess-new"
          data-testid="chat-session-new"
          title="新对话（重置当前会话上下文，真实动作）"
          @click="emit('new-conversation')"
        >
          新对话
        </button>
        <button
          type="button"
          class="sess-reload"
          data-testid="chat-session-reload"
          :disabled="listLoading"
          title="重新拉取会话列表"
          @click="reloadLists"
        >
          {{ listLoading ? "加载中" : "刷新" }}
        </button>
      </div>
    </header>

    <!-- 历史会话区：适配器 unavailable ⇒ 暂不可用 + 重试入口 -->
    <div v-if="listState !== 'ready'" class="sess-pending" role="status" data-testid="chat-session-pending">
      <p class="sess-pending-text">
        <span class="pending-tag">暂不可用</span>
        {{ listMessage }}
      </p>
      <button
        type="button"
        class="sess-pending-retry"
        data-testid="chat-session-pending-retry"
        :disabled="listLoading"
        @click="reloadLists"
      >
        重试
      </button>
    </div>
    <ul v-else class="sess-rows">
      <li v-for="s in historySessions" :key="s.id" class="sess-row">{{ s.title }}</li>
    </ul>

    <!-- 当前存活会话（真实：conversationId 来自 POST /api/chat done 事件回传） -->
    <div class="sess-rows">
      <div class="sess-row on" data-testid="chat-session-current">
        <span class="sn">当前对话</span>
        <span class="sess-cid">
          {{ conversationId ? `会话 ${conversationId}` : "尚未获得服务端会话 ID" }}
        </span>
        <button
          type="button"
          class="more-btn"
          data-testid="chat-session-more"
          title="更多操作"
          aria-label="更多操作"
          @click.stop="menuOpen = !menuOpen"
        >
          ⋯
        </button>
        <div v-if="menuOpen" class="sess-menu" data-testid="chat-session-menu">
          <button
            type="button"
            class="mi"
            data-a="arch"
            data-testid="chat-session-archive"
            @click="runAction('arch')"
          >
            归档
          </button>
          <button
            type="button"
            class="mi out"
            data-a="del"
            data-testid="chat-session-delete"
            @click="runAction('del')"
          >
            删除会话
          </button>
        </div>
      </div>
    </div>

    <!-- 动作结果回执：ok:false ⇒ 明说「未生效」+ 重试；任何情况下不出现成功口径 -->
    <div
      v-if="feedback.text"
      class="sess-feedback"
      :class="feedback.pending ? 'is-pending' : 'is-error'"
      role="status"
      data-testid="chat-session-feedback"
    >
      <span>{{ feedback.text }}</span>
      <button
        v-if="feedback.action"
        type="button"
        class="sess-feedback-retry"
        data-testid="chat-session-action-retry"
        @click="runAction(feedback.action)"
      >
        重试
      </button>
    </div>

    <!-- 归档区（原型 L2213 arch-bar：可展开恢复）。计数只认真实数据，数据未就绪显示「暂不可用」 -->
    <div
      class="arch-bar"
      data-testid="chat-arch-bar"
      role="button"
      tabindex="0"
      @click="archOpen = !archOpen"
      @keydown.enter="archOpen = !archOpen"
    >
      <span class="arr" :class="{ open: archOpen }">›</span>
      归档 · {{ archState === "ready" ? String(archivedSessions.length) : "暂不可用" }}
    </div>
    <div v-if="archOpen" class="arch-body" data-testid="chat-arch-body">
      <div v-if="archState !== 'ready'" class="sess-pending" role="status" data-testid="chat-arch-pending">
        <p class="sess-pending-text">
          <span class="pending-tag">暂不可用</span>
          {{ archMessage }}
        </p>
        <button
          type="button"
          class="sess-pending-retry"
          data-testid="chat-arch-pending-retry"
          :disabled="listLoading"
          @click="reloadLists"
        >
          重试
        </button>
      </div>
      <ul v-else class="sess-rows">
        <li v-for="s in archivedSessions" :key="s.id" class="sess-row archd">
          <span class="sn">{{ s.title }}</span>
          <button type="button" class="mi" data-a="restore" @click="runAction('restore', s.id)">恢复</button>
          <button type="button" class="mi out" data-a="del" @click="runAction('del', s.id)">删除</button>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 会话列表面板（WORKBENCH-10 · 区域 C 第 6 项）
 *
 * 诚实约束：归档 / 删除 / 恢复 / 重命名在 `api/ai.ts` 无对应端点（见 wb-chat-sessions.ts 头注），
 * 所以所有动作的真实结果恒为「未生效 · 暂不可用」。本组件：
 *   - 不弹成功 toast、不删行、不打「已归档」标记（原型里是本地数组假动作，这里不复制该行为）；
 *   - 结果回执原样展示适配器 message，并给「重试」入口（端点就绪后重试即生效）；
 *   - 「新对话」是真实动作（clearChat 重置上下文），由父级接线，不走本适配器的伪链。
 */
import { onMounted, ref } from "vue";
import {
  archiveChatSession,
  deleteChatSession,
  loadArchivedChatSessions,
  loadChatSessions,
  restoreChatSession,
  type ChatSessionEntry,
  type ChatSessionState,
} from "../../shared/workbench/wb-chat-sessions";

const props = defineProps<{
  /** 当前真实会话 ID（POST /api/chat done 回传；未回传为 null，UI 如实显示） */
  conversationId?: string | null;
}>();

const emit = defineEmits<{
  (event: "new-conversation"): void;
}>();

type ActionKind = "arch" | "del" | "restore";

const listState = ref<ChatSessionState>("loading");
const listMessage = ref("");
const historySessions = ref<ChatSessionEntry[]>([]);
const archState = ref<ChatSessionState>("loading");
const archMessage = ref("");
const archivedSessions = ref<ChatSessionEntry[]>([]);
const listLoading = ref(false);
const archOpen = ref(false);
const menuOpen = ref(false);
const feedback = ref<{ text: string; pending: boolean; action: ActionKind | null }>({
  text: "",
  pending: false,
  action: null,
});

async function reloadLists(): Promise<void> {
  listLoading.value = true;
  listState.value = "loading";
  archState.value = "loading";
  const [list, archived] = await Promise.all([loadChatSessions(), loadArchivedChatSessions()]);
  listState.value = list.state;
  listMessage.value = list.message;
  historySessions.value = list.sessions;
  archState.value = archived.state;
  archMessage.value = archived.message;
  archivedSessions.value = archived.sessions;
  listLoading.value = false;
}

/** 动作统一入口：结果只信适配器 ok 字段；ok:false 时明说「未生效」，绝不改动本地行状态 */
async function runAction(kind: ActionKind, sessionId?: string): Promise<void> {
  const targetId = sessionId || props.conversationId || "current";
  const call =
    kind === "arch"
      ? archiveChatSession(targetId)
      : kind === "del"
        ? deleteChatSession(targetId)
        : restoreChatSession(targetId);
  menuOpen.value = false;
  feedback.value = {
    text: kind === "arch" ? "归档处理中…" : kind === "del" ? "删除处理中…" : "恢复处理中…",
    pending: true,
    action: kind,
  };
  const res = await call;
  if (res.ok) {
    // 当前无端点支撑，此分支不可达；保留：端点接入后由刷新列表驱动状态，而不是本地猜测
    feedback.value = { text: res.message || "操作已生效", pending: false, action: null };
    await reloadLists();
    return;
  }
  const verb = kind === "arch" ? "归档" : kind === "del" ? "删除" : "恢复";
  feedback.value = {
    text: `${verb}未生效：${res.message}`,
    pending: true,
    action: kind,
  };
}

onMounted(() => {
  void reloadLists();
});
</script>

<style scoped>
.sess-list {
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 10px;
  background: var(--gray-0, #fff);
  padding: 8px 10px;
  font-size: 12px;
  color: var(--text-secondary, #4b5563);
}

.sess-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.sess-head-title {
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.sess-head-actions {
  display: flex;
  gap: 6px;
}

.sess-new,
.sess-reload {
  border: 1px solid var(--border-normal, #d1d5db);
  background: #fff;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}

.sess-new:hover {
  border-color: var(--color-primary, #2563eb);
  color: var(--color-primary, #2563eb);
}

.sess-pending {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px dashed var(--border-normal, #d1d5db);
  border-radius: 8px;
  padding: 6px 8px;
  margin: 4px 0;
  background: var(--bg-soft, #f9fafb);
}

.sess-pending-text {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.pending-tag {
  color: #92400e;
  background: #fef3c7;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 11px;
  flex-shrink: 0;
}

.sess-pending-retry,
.sess-feedback-retry {
  border: 1px solid var(--color-primary, #2563eb);
  color: var(--color-primary, #2563eb);
  background: #fff;
  border-radius: 6px;
  padding: 1px 8px;
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
}

.sess-rows {
  list-style: none;
  margin: 4px 0;
  padding: 0;
}

.sess-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 6px;
}

.sess-row.on {
  background: var(--color-primary-bg, #eff6ff);
  color: var(--color-primary, #2563eb);
}

.sess-row .sn {
  flex-shrink: 0;
}

.sess-cid {
  flex: 1;
  font-size: 11px;
  color: var(--text-muted, #6b7280);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-btn {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: inherit;
  padding: 2px 6px;
  border-radius: 4px;
}

.more-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

.sess-menu {
  position: absolute;
  right: 6px;
  top: calc(100% + 2px);
  z-index: 12;
  background: #fff;
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  min-width: 108px;
  padding: 4px;
}

.mi {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
}

.mi:hover {
  background: var(--bg-soft, #f3f4f6);
}

.mi.out {
  color: #b42318;
}

.sess-row.archd {
  color: var(--text-muted, #6b7280);
}

.sess-row.archd .mi {
  width: auto;
  padding: 1px 8px;
  border: 1px solid var(--border-normal, #d1d5db);
  border-radius: 6px;
  font-size: 11px;
}

.sess-feedback {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-radius: 8px;
  padding: 5px 8px;
  margin: 4px 0;
}

.sess-feedback.is-pending {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}

.sess-feedback.is-error {
  background: #fdf2f2;
  color: #b42318;
  border: 1px solid #fca5a5;
}

.arch-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 4px 6px;
  border-top: 1px dashed var(--border-normal, #d1d5db);
  color: var(--text-muted, #6b7280);
  cursor: pointer;
  user-select: none;
}

.arch-bar .arr {
  display: inline-block;
  transition: transform 0.15s ease;
}

.arch-bar .arr.open {
  transform: rotate(90deg);
}

.arch-body {
  padding: 2px 0 4px 10px;
}
</style>
