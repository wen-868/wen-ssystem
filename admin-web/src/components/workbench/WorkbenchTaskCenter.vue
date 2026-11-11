<template>
  <aside
    class="wtc"
    :class="{ collapsed }"
    :data-state="overallState"
    :data-open="!collapsed"
    aria-label="任务中心"
    data-testid="task-center"
  >
    <!-- 收起态：只留一条竖排入口，保留可点性（对齐二级导航折叠口径：可折叠但仍在） -->
    <div v-if="collapsed" class="wtc-strip" data-testid="task-center-strip">
      <button
        type="button"
        class="wtc-strip-toggle"
        data-testid="task-center-expand"
        :aria-label="`展开任务中心（${summaryText}）`"
        :title="`任务中心 · ${summaryText}`"
        @click="emit('toggle')"
      >
        <span class="wtc-strip-t">任务</span>
        <span v-if="activeTotal !== null" class="wtc-strip-n" :data-active-total="activeTotal">{{ activeTotal }}</span>
        <span class="wtc-strip-arr">«</span>
      </button>
    </div>

    <template v-else>
      <header class="wtc-head">
        <span class="wtc-title">任务中心</span>
        <span class="wtc-sub">{{ summaryText }}</span>
        <button
          type="button"
          class="wtc-collapse"
          data-testid="task-center-collapse"
          :aria-label="`收起任务中心（${summaryText}）`"
          title="收起任务中心"
          @click="emit('toggle')"
        >
          »
        </button>
      </header>

      <!-- 双态切换：进度明细（计划步骤六态）/ 任务跟踪（待确认+员工任务+通知） -->
      <div class="wtc-seg" role="group" aria-label="任务中心视图切换" data-testid="task-center-tabs">
        <button
          type="button"
          class="wtc-seg-btn"
          :class="{ on: view === 'progress' }"
          data-task-center-tab="progress"
          :aria-pressed="view === 'progress' ? 'true' : 'false'"
          @click="view = 'progress'"
        >
          进度明细
        </button>
        <button
          type="button"
          class="wtc-seg-btn"
          :class="{ on: view === 'tracking' }"
          data-task-center-tab="tracking"
          :aria-pressed="view === 'tracking' ? 'true' : 'false'"
          @click="view = 'tracking'"
        >
          任务跟踪
        </button>
      </div>

      <div class="wtc-body">
        <!-- ── 进度明细：执行计划六态 → 门控步进链（与 wb-feed-taskflow 同源同口径）── -->
        <section v-show="view === 'progress'" class="wtc-pane" data-task-center-pane="progress" data-testid="task-center-progress">
          <template v-if="flowBlock.state === 'loading'">
            <p class="wtc-empty" data-testid="tc-progress-loading">{{ flowBlock.message }}</p>
          </template>
          <div
            v-else-if="canRetry(flowBlock.state)"
            class="wtc-unavailable"
            :class="{ 'is-error': flowBlock.state === 'error' }"
            data-testid="tc-progress-unavailable"
          >
            <b>{{ flowBlock.state === "unavailable" ? "不可用" : "读取失败" }}</b>
            <p data-testid="tc-progress-note">{{ flowBlock.message }} —— 无真实计划读数时不伪造步进链</p>
            <button type="button" class="wtc-retry" data-testid="tc-progress-retry" @click="refreshPlans">重试</button>
          </div>
          <p v-else-if="flowBlock.state === 'empty'" class="wtc-empty" data-testid="tc-progress-empty">{{ flowBlock.message }}</p>
          <template v-else>
            <div v-for="flow in flowBlock.data.slice(0, 5)" :key="flow.id" class="wtc-flow" :data-flow-id="flow.id">
              <div class="wtc-flow-hd">
                <b>{{ flow.title }}</b>
                <em class="wtc-tag" :class="flow.doneCount === flow.steps.length ? 'ok' : 'run'">{{ flow.statusText }}</em>
              </div>
              <div class="wtc-steps">
                <template v-for="(step, index) in flow.steps" :key="step.key">
                  <i v-if="index > 0" class="wtc-arrow">→</i>
                  <b class="wtc-st" :class="step.cls" :title="`状态：${step.rawStatus}`">{{ step.mark }} {{ step.label }}</b>
                </template>
              </div>
            </div>
            <p v-if="flowBlock.data.length === 0" class="wtc-empty">{{ flowBlock.message }}</p>
          </template>
        </section>

        <!-- ── 任务跟踪：待确认（AI 写操作）/ 员工任务 / 通知 ── -->
        <section v-show="view === 'tracking'" class="wtc-pane" data-task-center-pane="tracking" data-testid="task-center-tracking">
          <div class="wtc-group" data-testid="tc-confirmations">
            <div class="wtc-group-hd">
              待确认
              <em v-if="confirmationsBlock.state === 'ready' || confirmationsBlock.state === 'empty'">{{ confirmationsBlock.data.length }} 项</em>
            </div>
            <p v-if="confirmationsBlock.state === 'loading'" class="wtc-empty" data-testid="tc-conf-loading">{{ confirmationsBlock.message }}</p>
            <div
              v-else-if="canRetry(confirmationsBlock.state)"
              class="wtc-unavailable is-inline"
              :class="{ 'is-error': confirmationsBlock.state === 'error' }"
              data-testid="tc-conf-unavailable"
            >
              <span>{{ confirmationsBlock.state === "unavailable" ? "不可用" : "读取失败" }}</span>
              <button type="button" class="wtc-retry" data-testid="tc-conf-retry" @click="refreshConfirmations">重试</button>
            </div>
            <p v-else-if="confirmationsBlock.state === 'empty'" class="wtc-empty" data-testid="tc-conf-empty">{{ confirmationsBlock.message }}</p>
            <div v-else-if="confirmationsBlock.state === 'ready' && confirmationsBlock.data.length === 0" class="wtc-empty">
              当前没有待确认的 AI 写操作
            </div>
            <div v-for="row in confirmationsBlock.data.slice(0, 6)" :key="row.id" class="wtc-row" :data-conf-id="row.id">
              <span class="wtc-dot is-review" />
              <span class="wtc-row-tx">
                <b>{{ row.title }}</b>
                <em>{{ row.agent ? `${row.agent} · ` : "" }}AI 预审完成 · 待确认</em>
              </span>
            </div>
          </div>

          <div class="wtc-group" data-testid="tc-employees">
            <div class="wtc-group-hd">
              数字员工
              <em v-if="employeesBlock.state === 'ready'">{{ employeesBlock.data.length }} 人</em>
            </div>
            <p v-if="employeesBlock.state === 'loading'" class="wtc-empty" data-testid="tc-emp-loading">{{ employeesBlock.message }}</p>
            <div
              v-else-if="canRetry(employeesBlock.state)"
              class="wtc-unavailable is-inline"
              :class="{ 'is-error': employeesBlock.state === 'error' }"
              data-testid="tc-emp-unavailable"
            >
              <span>{{ employeesBlock.state === "unavailable" ? "不可用" : "读取失败" }}</span>
              <button type="button" class="wtc-retry" data-testid="tc-emp-retry" @click="refreshEmployees">重试</button>
            </div>
            <p v-else-if="employeesBlock.state === 'empty'" class="wtc-empty" data-testid="tc-emp-empty">{{ employeesBlock.message }}</p>
            <div v-for="emp in employeesBlock.data.slice(0, 6)" :key="emp.id" class="wtc-row" :data-emp-id="emp.id">
              <span class="wtc-av">{{ emp.name.slice(0, 1) }}</span>
              <span class="wtc-row-tx">
                <b>{{ emp.name }}</b>
                <em>{{ emp.post || "数字员工" }}</em>
              </span>
            </div>
          </div>

          <div class="wtc-group" data-testid="tc-notifications">
            <div class="wtc-group-hd">
              通知
              <em v-if="notificationsBlock.state === 'ready' || notificationsBlock.state === 'empty'">{{ notificationsBlock.data.length }} 条</em>
            </div>
            <p v-if="notificationsBlock.state === 'loading'" class="wtc-empty" data-testid="tc-noti-loading">{{ notificationsBlock.message }}</p>
            <div
              v-else-if="canRetry(notificationsBlock.state)"
              class="wtc-unavailable is-inline"
              :class="{ 'is-error': notificationsBlock.state === 'error' }"
              data-testid="tc-noti-unavailable"
            >
              <span>{{ notificationsBlock.state === "unavailable" ? "不可用" : "读取失败" }}</span>
              <button type="button" class="wtc-retry" data-testid="tc-noti-retry" @click="refreshNotifications">重试</button>
            </div>
            <p v-else-if="notificationsBlock.state === 'empty'" class="wtc-empty" data-testid="tc-noti-empty">{{ notificationsBlock.message }}</p>
            <div v-for="note in notificationsBlock.data.slice(0, 6)" :key="note.id" class="wtc-row" :data-noti-id="note.id">
              <span class="wtc-dot" :class="{ read: note.isRead }" />
              <span class="wtc-row-tx">
                <b>{{ note.title }}</b>
                <em>{{ shortTime(note.createdAt) }}</em>
              </span>
            </div>
          </div>
        </section>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
/**
 * 任务中心（WORKBENCH-PROTOTYPE-12-S3 · 四列壳层第 4 列 · 300px）
 *
 * 卡面 §三.4：双态「进度明细 / 任务跟踪」+ 可收起/展开且状态保持（localStorage）。
 * 数据：真实端点（与信息流五块同源，不伪造、不复制原型演示数字）：
 *   - 进度明细 = GET {AI_BASE}/api/ai/agent/plans 的步骤六态按门控折算（与 wb-feed-taskflow 同解析）；
 *   - 待确认   = GET {AI_BASE}/api/chat/confirmations（与顶部待审阅/审批中心同源）；
 *   - 数字员工 = GET {AI_BASE}/api/ai/employees（与顶部 AgentStatusBar 同源）；
 *   - 通知     = GET /admin/wb-notifications（与信息流业务动态同源；主后端人工源，AI 故障不影响）。
 * 各源独立 loading/ready/empty/unavailable/error（error/unavailable 给重试入口），
 * 失败绝不渲染假 0（口径与 wb-feed-types 五态一致）。
 *
 * ⚠️ S1 view-model（task-center.ts）已由 S1 卡交付但**未合入 main**（门2 未过），
 *    且本卡允许路径不含 shared/workbench ⇒ 本组件直接消费 S3 既有真实端点与解析器，
 *    数据语义与 S1 契约同源（confirmations/plans/notifications/employees 四类真实源）。
 *    S1 合入后由后续卡切换到统一 view-model。
 */
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { api } from "../../api/request";
import { AI_BASE_URL, fetchAiConfirmations } from "../../api/ai";
import { useAuthStore } from "../../stores/auth";
import {
  classifyFeedError,
  feedLoading,
  type FeedBlock,
  type FeedBlockState,
} from "../../shared/workbench/wb-feed-types";
import { parseWbTaskFlows, type WbTaskFlow } from "../../shared/workbench/wb-feed-taskflow";

const props = defineProps<{
  collapsed: boolean;
}>();

const emit = defineEmits<{
  (event: "toggle"): void;
}>();

// ── 双态 ──
type TaskCenterView = "progress" | "tracking";
const view = ref<TaskCenterView>("progress");
const VIEW_KEY = "wb.task-center.view";

// ── 收起状态：由壳层持有并持久化（localStorage）；本组件只发 toggle 事件 ──
// （状态保持的职责在壳层，与收起按钮同一处，避免两处各自读 key 产生漂移）

function restoreView(): TaskCenterView {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "progress" || saved === "tracking") return saved;
  } catch {
    /* localStorage 不可用（隐私模式等）⇒ 默认进度明细 */
  }
  return "progress";
}
view.value = restoreView();

// 视图选择也持久化：刷新后回到用户上次的双态选择（状态保持口径的一部分）
watch(view, (next) => {
  try {
    localStorage.setItem(VIEW_KEY, next);
  } catch {
    /* 忽略写入失败（存储不可用时降级为会话内状态） */
  }
});

// ── 数据源（各自独立 loading/ready/empty/unavailable/error；失败可重试）──
const EMPTY_FLOWS: WbTaskFlow[] = [];
const EMPTY_ROWS: Array<Record<string, unknown>> = [];

const flowBlock = ref<FeedBlock<WbTaskFlow[]>>(feedLoading<WbTaskFlow[]>([], "任务进度"));
const confirmationsBlock = ref<FeedBlock<Array<{ id: string; title: string; agent: string | null }>>>(
  feedLoading<Array<{ id: string; title: string; agent: string | null }>>([], "待确认"),
);
const employeesBlock = ref<FeedBlock<Array<{ id: number; name: string; post: string }>>>(
  feedLoading<Array<{ id: number; name: string; post: string }>>([], "数字员工"),
);
const notificationsBlock = ref<FeedBlock<Array<{ id: number; title: string; createdAt: string | null; isRead: boolean }>>>(
  feedLoading<Array<{ id: number; title: string; createdAt: string | null; isRead: boolean }>>([], "通知"),
);

function canRetry(state: FeedBlockState): boolean {
  return state === "error" || state === "unavailable";
}

/** 顶部汇总：进行中计划 + 待确认（null = 该源不可得，不显示假 0） */
const activeTotal = computed<number | null>(() => {
  const parts: number[] = [];
  if (flowBlock.value.state === "ready") parts.push(flowBlock.value.data.length);
  if (confirmationsBlock.value.state === "ready") parts.push(confirmationsBlock.value.data.length);
  return parts.length > 0 ? parts.reduce((s, n) => s + n, 0) : null;
});

const summaryText = computed(() => {
  const parts: string[] = [];
  if (activeTotal.value !== null) parts.push(`${activeTotal.value} 项待处理`);
  if (flowBlock.value.state === "loading" || confirmationsBlock.value.state === "loading") parts.push("读取中");
  else if (flowBlock.value.state === "error" || confirmationsBlock.value.state === "error") parts.push("部分读取失败");
  return parts.join(" · ") || "任务中心";
});

/** 整体状态：任一处 error/unavailable ⇒ error（组件级 data-state 供测试/诊断） */
const overallState = computed<FeedBlockState>(() => {
  const blocks = [flowBlock.value, confirmationsBlock.value, employeesBlock.value, notificationsBlock.value];
  if (blocks.some((b) => b.state === "loading")) return "loading";
  if (blocks.some((b) => b.state === "error")) return "error";
  if (blocks.some((b) => b.state === "unavailable")) return "unavailable";
  if (blocks.some((b) => b.state === "ready")) return "ready";
  return "empty";
});

// ── 取数（真实端点；AI 底座失败只影响 AI 源，主后端通知源照常）──

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  try {
    const token = useAuthStore().token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* 无登录态：按匿名发出，由服务端裁决 */
  }
  return headers;
}

async function fetchAgentPlans(): Promise<unknown> {
  const resp = await fetch(`${AI_BASE_URL}/api/ai/agent/plans`, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`任务计划端点响应异常（HTTP ${resp.status}）`);
  return (await resp.json()) as unknown;
}

async function refreshPlans(): Promise<void> {
  flowBlock.value = feedLoading<WbTaskFlow[]>([], "任务进度");
  try {
    const raw = await fetchAgentPlans();
    flowBlock.value = parseWbTaskFlows(raw);
  } catch (err) {
    flowBlock.value = classifyFeedError(err, "任务进度", EMPTY_FLOWS);
  }
}

async function refreshConfirmations(): Promise<void> {
  confirmationsBlock.value = feedLoading<Array<{ id: string; title: string; agent: string | null }>>([], "待确认");
  try {
    const rows = await fetchAiConfirmations();
    confirmationsBlock.value = {
      state: rows.length === 0 ? "empty" : "ready",
      data: rows
        .map((row) => ({
          id: String(row.confirmationId ?? row.id ?? "").trim(),
          title: String(row.operation ?? row.summary ?? "").trim() || "待确认操作",
          agent: null,
        }))
        .filter((row) => row.id.length > 0),
      message: rows.length === 0 ? "当前没有待确认的 AI 写操作（真实空列表）" : "",
    };
  } catch (err) {
    confirmationsBlock.value = classifyFeedError(err, "待确认", EMPTY_ROWS as Array<{ id: string; title: string; agent: string | null }>);
  }
}

async function refreshEmployees(): Promise<void> {
  employeesBlock.value = feedLoading<Array<{ id: number; name: string; post: string }>>([], "数字员工");
  try {
    const resp = await fetch(`${AI_BASE_URL}/api/ai/employees`, { headers: authHeaders() });
    if (!resp.ok) throw new Error(`数字员工端点响应异常（HTTP ${resp.status}）`);
    const payload = (await resp.json()) as unknown;
    const rows = Array.isArray(payload)
      ? payload
          .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
          .map((row) => ({
            id: Number(row.id ?? 0),
            name: String(row.name ?? "").trim(),
            post: String(row.post ?? "").trim(),
          }))
          .filter((row) => row.id > 0 || row.name.length > 0)
      : [];
    employeesBlock.value = {
      state: rows.length === 0 ? "empty" : "ready",
      data: rows,
      message: rows.length === 0 ? "当前没有启用的数字员工（真实空列表）" : "",
    };
  } catch (err) {
    employeesBlock.value = classifyFeedError(err, "数字员工", EMPTY_ROWS as Array<{ id: number; name: string; post: string }>);
  }
}

async function refreshNotifications(): Promise<void> {
  notificationsBlock.value = feedLoading<Array<{ id: number; title: string; createdAt: string | null; isRead: boolean }>>([], "通知");
  try {
    const { data: res } = await api.get("/admin/wb-notifications", { params: { page: 1, pageSize: 10 } });
    const data = res.data ?? res ?? {};
    const rows = (data.records ?? data.list ?? []) as Array<Record<string, unknown>>;
    const notes = rows
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      .map((row) => ({
        id: Number(row.id ?? 0),
        title: String(row.title ?? row.summary ?? "").trim(),
        createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
        isRead: row.isRead === true || row.isRead === 1,
      }))
      .filter((row) => row.title.length > 0);
    notificationsBlock.value = {
      state: notes.length === 0 ? "empty" : "ready",
      data: notes,
      message: notes.length === 0 ? "当前没有通知（真实空列表）" : "",
    };
  } catch (err) {
    notificationsBlock.value = classifyFeedError(err, "通知", EMPTY_ROWS as Array<{ id: number; title: string; createdAt: string | null; isRead: boolean }>);
  }
}

function shortTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

onMounted(() => {
  void refreshPlans();
  void refreshConfirmations();
  void refreshEmployees();
  void refreshNotifications();
});

onBeforeUnmount(() => {
  try {
    localStorage.setItem(VIEW_KEY, view.value);
  } catch {
    /* 忽略 */
  }
});
</script>

<style scoped>
/* ══ 任务中心列（第 4 列 · 300px）：整列 flex 纵向，不整体滚动（目录区各自可滚）══ */
.wtc {
  --wb-ink2: #626f82;
  box-sizing: border-box;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--wb-side-bg, #f9fafb);
  border-left: 1px solid var(--wb-line, #eceef1);
  overflow: hidden;
}
.wtc.collapsed {
  /* 收起态：整列裁成窄条，保留可点入口（不 display:none，可折叠但仍在） */
  background: var(--wb-side-bg, #f9fafb);
}

/* ── 收起条 ── */
.wtc-strip {
  box-sizing: border-box;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
}
.wtc-strip-toggle {
  box-sizing: border-box;
  width: 30px;
  min-height: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 10px;
  background: var(--wb-panel, #ffffff);
  color: var(--wb-ink2, #8a8f98);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
}
.wtc-strip-toggle:hover {
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  border-color: var(--wb-primary, #2563eb);
}
.wtc-strip-t {
  writing-mode: vertical-rl;
  letter-spacing: 2px;
  font-weight: 600;
}
.wtc-strip-n {
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--wb-danger, #dc2626);
  color: #fff;
  font-size: 10px;
  line-height: 18px;
  text-align: center;
}
.wtc-strip-arr {
  font-size: 13px;
  line-height: 1;
}

/* ── 头部 ── */
.wtc-head {
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  min-height: 42px;
  padding: 0 12px;
  border-bottom: 1px solid var(--wb-line, #eceef1);
  background: var(--wb-panel, #ffffff);
}
.wtc-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--wb-ink, #16181d);
  white-space: nowrap;
}
.wtc-sub {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 10.5px;
  color: var(--wb-ink2, #8a8f98);
}
.wtc-collapse {
  box-sizing: border-box;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 7px;
  background: transparent;
  color: var(--wb-ink2, #8a8f98);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.wtc-collapse:hover {
  background: var(--wb-hover, #f4f6f8);
  color: var(--wb-primary, #2563eb);
}

/* ── 双态分段 ── */
.wtc-seg {
  box-sizing: border-box;
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  margin: 8px 12px;
  padding: 2px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 8px;
  background: var(--wb-hover, #f4f6f8);
}
.wtc-seg-btn {
  box-sizing: border-box;
  flex: 1;
  padding: 5px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  color: var(--wb-ink2, #8a8f98);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 150ms ease, color 150ms ease;
}
.wtc-seg-btn:hover {
  color: var(--wb-ink, #16181d);
}
.wtc-seg-btn.on {
  background: var(--wb-panel, #ffffff);
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

/* ── 主体：唯一滚动容器 ── */
.wtc-body {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px 12px;
}
.wtc-pane {
  display: block;
}

/* ── 状态文案与占位 ── */
.wtc-empty {
  margin: 8px 2px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--wb-ink2, #8a8f98);
}
.wtc-unavailable {
  margin: 8px 0;
  padding: 10px 12px;
  border: 1px dashed var(--wb-line-strong, #dde2e9);
  border-radius: 10px;
  background: var(--wb-panel, #fff);
  font-size: 12px;
  color: var(--wb-ink2, #8a8f98);
}
.wtc-unavailable.is-error {
  border-color: #f0c2c2;
  background: #fdf2f2;
  color: #b42318;
}
.wtc-unavailable b {
  font-size: 12px;
}
.wtc-unavailable p {
  margin: 6px 0;
  font-size: 11px;
  line-height: 1.6;
}
.wtc-unavailable.is-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 6px 0;
  padding: 6px 10px;
  font-size: 11px;
}
.wtc-unavailable.is-inline p {
  display: none;
}
.wtc-retry {
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 6px;
  background: var(--wb-panel, #fff);
  padding: 2px 8px;
  font-family: inherit;
  font-size: 11px;
  color: var(--wb-primary, #2563eb);
  cursor: pointer;
  flex-shrink: 0;
}
.wtc-retry:hover {
  border-color: var(--wb-primary, #2563eb);
  background: var(--wb-primary-soft, #eff4ff);
}

/* ── 分组 ── */
.wtc-group {
  margin-top: 10px;
}
.wtc-group-hd {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--wb-ink2, #8a8f98);
  margin: 0 2px 4px;
}
.wtc-group-hd em {
  font-style: normal;
  font-weight: 400;
  color: var(--wb-muted, #b0b6c0);
}

/* ── 行 ── */
.wtc-row {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 42px;
  padding: 6px 8px;
  border-radius: 10px;
  cursor: default;
}
.wtc-row:hover {
  background: var(--wb-hover, #f4f6f8);
}
.wtc-row-tx {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.wtc-row-tx b {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wtc-row-tx em {
  font-style: normal;
  font-size: 10.5px;
  color: var(--wb-ink2, #8a8f98);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wtc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--wb-primary, #2563eb);
  flex-shrink: 0;
}
.wtc-dot.is-review {
  background: #b45309;
}
.wtc-dot.read {
  background: var(--wb-muted, #b0b6c0);
}
.wtc-av {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--wb-primary-soft, #eff4ff);
  color: var(--wb-primary, #2563eb);
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ── 进度步进链（与信息流 act24 同语义：√ / ● / 🔒）── */
.wtc-flow {
  margin: 8px 0;
  padding: 10px 12px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 12px;
  background: var(--wb-panel, #fff);
}
.wtc-flow-hd {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.wtc-flow-hd b {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wtc-tag {
  font-style: normal;
  font-size: 10px;
  line-height: 1.6;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--wb-hover, #f4f6f8);
  color: var(--wb-ink2, #8a8f98);
  white-space: nowrap;
  flex-shrink: 0;
}
.wtc-tag.ok {
  background: #e8f7ee;
  color: #15803d;
}
.wtc-tag.run {
  background: #eff4ff;
  color: #2563eb;
}
.wtc-steps {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 2px;
}
.wtc-arrow {
  font-style: normal;
  color: var(--wb-muted, #b0b6c0);
  font-size: 11px;
  margin: 0 2px;
}
.wtc-st {
  font-size: 10.5px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--wb-hover, #f4f6f8);
  color: var(--wb-ink2, #8a8f98);
  white-space: nowrap;
}
.wtc-st.done {
  background: #e8f7ee;
  color: #15803d;
}
.wtc-st.wait {
  background: #eff4ff;
  color: #2563eb;
}
.wtc-st.lock {
  background: var(--wb-hover, #f4f6f8);
  color: var(--wb-muted, #b0b6c0);
}
</style>
