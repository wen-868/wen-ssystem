<template>
  <aside
    class="wtc"
    :class="{ collapsed }"
    :data-state="overallState"
    :data-open="!collapsed"
    :aria-hidden="collapsed ? 'true' : 'false'"
    aria-label="任务中心"
    data-testid="task-center"
  >
    <!--
      收起态 = 第 4 列 0px（UI-PARITY-BASE §四.1.4：不是 56px 窄条）：
      本组件不渲染任何收起条，重开唯一常驻入口 = 壳层顶栏 task-center-toggle（合同 top_bar.right）。
    -->
    <template v-if="!collapsed">
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
        <!-- ── 进度明细：执行计划六态（S1 plans 源）→ 门控步进链（deriveFlowSteps 同源同口径）── -->
        <section v-show="view === 'progress'" class="wtc-pane" data-task-center-pane="progress" data-testid="task-center-progress">
          <p v-if="sourceState(plansSource) === 'loading'" class="wtc-empty" data-testid="tc-progress-loading">{{ plansSource.message }}</p>
          <div
            v-else-if="canRetry(sourceState(plansSource))"
            class="wtc-unavailable"
            :class="{ 'is-error': plansSource.status === 'error' || plansSource.status === 'timeout' }"
            data-testid="tc-progress-unavailable"
          >
            <b>{{ plansSource.status === "unavailable" ? "不可用" : "读取失败" }}</b>
            <p data-testid="tc-progress-note">{{ plansSource.message }} —— 无真实计划读数时不伪造步进链</p>
            <button type="button" class="wtc-retry" data-testid="tc-progress-retry" @click="refreshPlans">重试</button>
          </div>
          <p v-else-if="sourceState(plansSource) === 'empty'" class="wtc-empty" data-testid="tc-progress-empty">{{ plansSource.message }}</p>
          <template v-else>
            <div v-for="flow in flows.slice(0, 5)" :key="flow.id" class="wtc-flow" :data-flow-id="flow.id">
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
            <p v-if="flows.length === 0" class="wtc-empty">暂无含环节的任务计划（步进链需至少 1 个环节，不画空链）</p>
          </template>
        </section>

        <!-- ── 任务跟踪：待确认（AI 写操作）/ 员工任务 / 通知（均 S1 源） ── -->
        <section v-show="view === 'tracking'" class="wtc-pane" data-task-center-pane="tracking" data-testid="task-center-tracking">
          <div class="wtc-group" data-testid="tc-confirmations">
            <div class="wtc-group-hd">
              待确认
              <em v-if="sourceState(confirmationsSource) === 'ready' || sourceState(confirmationsSource) === 'empty'">{{ confirmationsSource.data?.length ?? 0 }} 项</em>
            </div>
            <p v-if="sourceState(confirmationsSource) === 'loading'" class="wtc-empty" data-testid="tc-conf-loading">{{ confirmationsSource.message }}</p>
            <div
              v-else-if="canRetry(sourceState(confirmationsSource))"
              class="wtc-unavailable is-inline"
              :class="{ 'is-error': confirmationsSource.status === 'error' || confirmationsSource.status === 'timeout' }"
              data-testid="tc-conf-unavailable"
            >
              <span>{{ confirmationsSource.status === "unavailable" ? "不可用" : "读取失败" }}</span>
              <button type="button" class="wtc-retry" data-testid="tc-conf-retry" @click="refreshConfirmations">重试</button>
            </div>
            <p v-else-if="sourceState(confirmationsSource) === 'empty'" class="wtc-empty" data-testid="tc-conf-empty">{{ confirmationsSource.message }}</p>
            <div v-for="row in confirmationsSource.data?.slice(0, 6) ?? []" :key="row.id ?? row.confirmationId ?? ''" class="wtc-row" :data-conf-id="row.id ?? row.confirmationId ?? ''">
              <span class="wtc-dot is-review" />
              <span class="wtc-row-tx">
                <b>{{ row.operation || row.summary || "待确认操作" }}</b>
                <em>AI 预审完成 · 待确认</em>
              </span>
            </div>
          </div>

          <div class="wtc-group" data-testid="tc-employees">
            <div class="wtc-group-hd">
              员工任务
              <em v-if="sourceState(employeeTasksSource) === 'ready'">{{ employeeTasksSource.data?.length ?? 0 }} 项</em>
            </div>
            <p v-if="employeeTasksSource.status === 'idle'" class="wtc-empty" data-testid="tc-emp-idle">{{ employeeTasksSource.message || "未选择员工" }}</p>
            <p v-else-if="sourceState(employeeTasksSource) === 'loading'" class="wtc-empty" data-testid="tc-emp-loading">{{ employeeTasksSource.message }}</p>
            <div
              v-else-if="canRetry(sourceState(employeeTasksSource))"
              class="wtc-unavailable is-inline"
              :class="{ 'is-error': employeeTasksSource.status === 'error' || employeeTasksSource.status === 'timeout' }"
              data-testid="tc-emp-unavailable"
            >
              <span>{{ employeeTasksSource.status === "unavailable" ? "不可用" : "读取失败" }}</span>
              <button type="button" class="wtc-retry" data-testid="tc-emp-retry" @click="refreshEmployees">重试</button>
            </div>
            <p v-else-if="sourceState(employeeTasksSource) === 'empty'" class="wtc-empty" data-testid="tc-emp-empty">{{ employeeTasksSource.message }}</p>
            <div v-for="task in employeeTasksSource.data?.slice(0, 6) ?? []" :key="task.id" class="wtc-row" :data-emp-id="task.id">
              <span class="wtc-dot" :class="taskDotClass(task.status)" />
              <span class="wtc-row-tx">
                <b>{{ task.task }}</b>
                <em>{{ taskStatusText(task) }}</em>
              </span>
            </div>
          </div>

          <div class="wtc-group" data-testid="tc-notifications">
            <div class="wtc-group-hd">
              通知
              <em v-if="sourceState(notificationsSource) === 'ready' || sourceState(notificationsSource) === 'empty'">{{ notificationsSource.data?.length ?? 0 }} 条</em>
            </div>
            <p v-if="sourceState(notificationsSource) === 'loading'" class="wtc-empty" data-testid="tc-noti-loading">{{ notificationsSource.message }}</p>
            <div
              v-else-if="canRetry(sourceState(notificationsSource))"
              class="wtc-unavailable is-inline"
              :class="{ 'is-error': notificationsSource.status === 'error' || notificationsSource.status === 'timeout' }"
              data-testid="tc-noti-unavailable"
            >
              <span>{{ notificationsSource.status === "unavailable" ? "不可用" : "读取失败" }}</span>
              <button type="button" class="wtc-retry" data-testid="tc-noti-retry" @click="refreshNotifications">重试</button>
            </div>
            <p v-else-if="sourceState(notificationsSource) === 'empty'" class="wtc-empty" data-testid="tc-noti-empty">{{ notificationsSource.message }}</p>
            <div v-for="note in notificationsSource.data?.slice(0, 6) ?? []" :key="note.id" class="wtc-row" :data-noti-id="note.id">
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
 * 任务中心（WORKBENCH-PROTOTYPE-12 · 四列壳层第 4 列 · 300px；UI-PARITY-BASE 收起=0px）
 *
 * 卡面 §四.4：双态「进度明细 / 任务跟踪」；收起 = 整列 0px（无竖条），重开走顶栏开关；
 * 数据落地后向壳层上报 settle(有无真实待办)，供合同默认态判定（无待办默认收起、有待办默认展开）。
 * 数据：S1 view-model（task-center.ts）统一装载，真实端点（不伪造、不复制原型演示数字）：
 *   - 进度明细 = GET {AI_BASE}/api/ai/agent/plans（ParsedPlan[] → deriveFlowSteps 门控步进链）；
 *   - 待确认   = GET {AI_BASE}/api/chat/confirmations（ConfirmationListRow[]）；
 *   - 员工任务 = GET {AI_BASE}/api/ai/employees/:id/tasks（ParsedEmployeeTask[]；未选员工 ⇒ idle）；
 *   - 通知     = GET /admin/notifications（主后端人工源，AI 故障不影响）。
 * 各源独立 loading/ready/empty/unavailable/error/timeout（error/timeout/unavailable 给重试入口），
 * 失败绝不渲染假 0（口径与 S1 硬验收一致）。
 */
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import {
  loadTaskCenterSnapshot,
  loadConfirmationsSource,
  loadPlansSource,
  loadNotificationsSource,
  deriveTaskCenterCounts,
  taskCenterSnapshot,
  type TaskSourceState,
  type TaskSourceStatus,
  type ConfirmationListRow,
  type ParsedPlan,
  type ParsedEmployeeTask,
  type EmployeeTaskStatus,
  type ParsedNotification,
} from "../../shared/workbench/task-center";
import { deriveFlowSteps, type WbTaskFlow } from "../../shared/workbench/wb-feed-taskflow";
import type { FeedBlockState } from "../../shared/workbench/wb-feed-types";

defineProps<{
  collapsed: boolean;
}>();

const emit = defineEmits<{
  (event: "toggle"): void;
  /** 数据落地（ready/empty，非故障态）：hasWork = 有真实待办（待确认+进行中计划 > 0） */
  (event: "settle", hasWork: boolean): void;
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

// ── 数据源（S1 view-model：各源独立 loading/ready/empty/unavailable/error/timeout，失败可重试）──
// 初始即克隆：ref 持有独立对象，后续 refresh 全部以新引用覆盖（见 refresh* 的克隆注释）。

/** 进度明细：执行计划（S1 plans 源）→ 六态步进链（仅 ready/empty 有数据；unknown 不猜） */
const plansSource = ref<TaskSourceState<ParsedPlan[]>>({ ...taskCenterSnapshot.plans });
/** 任务跟踪：待确认（S1 confirmations 源） */
const confirmationsSource = ref<TaskSourceState<ConfirmationListRow[]>>({ ...taskCenterSnapshot.confirmations });
/** 任务跟踪：员工任务（S1 employeeTasks 源；未选员工 ⇒ idle，不渲染） */
const employeeTasksSource = ref<TaskSourceState<ParsedEmployeeTask[]>>({ ...taskCenterSnapshot.employeeTasks });
/** 任务跟踪：通知（S1 notifications 源 · 主后端人工源，AI 故障不影响） */
const notificationsSource = ref<TaskSourceState<ParsedNotification[]>>({ ...taskCenterSnapshot.notifications });

/** 双态可消费状态：S1 的 status 归一为组件级可消费态（timeout 并入 error 展示但保留原文案；
 *  idle 视作尚未上报 ⇒ 显示加载文案；员工任务的 idle 语义（未选择员工）由模板按原始 status 单独判定） */
function sourceState(source: TaskSourceState<unknown>): FeedBlockState {
  const status = source.status;
  if (status === "loading" || status === "idle") return "loading";
  if (status === "ready" || status === "empty") return status;
  return "error"; // error / timeout / unavailable 一律走可重试分支（原文案随 message）
}

function canRetry(state: FeedBlockState): boolean {
  return state === "error" || state === "unavailable";
}

/** 进度明细派生：ParsedPlan[] ⇒ 门控步进链（deriveFlowSteps 纯函数；与信息流任务步进同口径） */
const flows = computed<WbTaskFlow[]>(() => {
  const data = plansSource.value.data;
  if (!data) return [];
  const out: WbTaskFlow[] = [];
  for (const plan of data) {
    const steps = deriveFlowSteps(plan.steps as readonly unknown[]);
    if (steps.length === 0) continue; // 无环节的计划画不出步进链 ⇒ 跳过（不造空链）
    const doneCount = steps.filter((s) => s.rawStatus === "success").length;
    out.push({
      id: String(plan.id),
      title: plan.goal.trim() || `计划 #${plan.id}`,
      steps,
      doneCount,
      statusText:
        doneCount === steps.length
          ? "全链完成 · 证据齐备"
          : plan.state === "failed"
            ? `已中断 ${doneCount}/${steps.length}`
            : `进行中 ${doneCount}/${steps.length}`,
    });
  }
  return out;
});

/** 员工任务状态点 class（running=蓝 / completed=灰 / failed=红 / 未知=灰） */
function taskDotClass(status: EmployeeTaskStatus | null): string {
  if (status === "running") return "run";
  if (status === "failed") return "fail";
  return "read";
}

/** 员工任务副行：状态 + 派发人（状态未知如实标注，不猜） */
function taskStatusText(task: ParsedEmployeeTask): string {
  const statusLabel =
    task.status === "running" ? "运行中" : task.status === "completed" ? "已完成" : task.status === "failed" ? "失败" : "状态未知";
  const by = task.dispatchedBy && task.dispatchedBy !== "user" ? task.dispatchedBy : "我";
  return `${statusLabel} · ${by} 派发`;
}

/** S1 顶部计数（deriveTaskCenterCounts 只读各源 data，同源派生；null = 源不可得，不显示假 0） */
const counts = computed(() =>
  deriveTaskCenterCounts({
    confirmations: confirmationsSource.value,
    employeeTasks: employeeTasksSource.value,
    plans: plansSource.value,
    notifications: notificationsSource.value,
    historySessions: taskCenterSnapshot.historySessions,
  }),
);

/** 顶部汇总：待确认数 + 进行中计划数（null ⇒ 不显示） */
const activeTotal = computed<number | null>(() => {
  const parts: number[] = [];
  if (counts.value.confirmations !== null) parts.push(counts.value.confirmations);
  if (counts.value.plansRunning !== null) parts.push(counts.value.plansRunning);
  return parts.length > 0 ? parts.reduce((s, n) => s + n, 0) : null;
});

const summaryText = computed(() => {
  const parts: string[] = [];
  if (activeTotal.value !== null) parts.push(`${activeTotal.value} 项待处理`);
  const loading = [plansSource.value, confirmationsSource.value, employeeTasksSource.value, notificationsSource.value].some(
    (s) => s.status === "loading",
  );
  const failed = [plansSource.value, confirmationsSource.value, employeeTasksSource.value, notificationsSource.value].some((s) =>
    ["error", "timeout", "unavailable"].includes(s.status),
  );
  if (loading) parts.push("读取中");
  else if (failed) parts.push("部分读取失败");
  return parts.join(" · ") || "任务中心";
});

/** 整体状态（组件级 data-state 供测试/诊断） */
const overallState = computed<FeedBlockState>(() => {
  const sources = [plansSource.value, confirmationsSource.value, employeeTasksSource.value, notificationsSource.value];
  if (sources.some((s) => s.status === "loading")) return "loading";
  if (sources.some((s) => s.status === "error" || s.status === "timeout")) return "error";
  if (sources.some((s) => s.status === "unavailable")) return "unavailable";
  if (sources.some((s) => s.status === "ready")) return "ready";
  return "empty";
});

/**
 * 合同默认态上报（UI-PARITY-BASE / DELTA-CONTRACT task_center.default）：
 * 三个主源（plans/confirmations/notifications）全部离开 loading/idle 即视为「数据落地」，
 * 向壳层发 settle(有无真实待办)。hasWork 口径 = activeTotal（待确认 + 进行中计划）> 0；
 * 通知属被动信息不算「待办」。员工任务未选员工恒 idle，不参与落地判据。
 * 故障态（error/timeout/unavailable）不上报 —— 读不到 ≠ 没有待办，不因故障收起入口。
 * （注意不能 watch(overallState)：全空数据时 idle→empty 的计算值不变，watch 永不触发。）
 */
watch(
  () => [plansSource.value.status, confirmationsSource.value.status, notificationsSource.value.status] as const,
  (states) => {
    const loadingOrIdle = (s: TaskSourceStatus) => s === "loading" || s === "idle";
    if (states.some(loadingOrIdle)) return;
    if (states.some((s) => s === "error" || s === "timeout" || s === "unavailable")) return;
    emit("settle", (activeTotal.value ?? 0) > 0);
  },
);

// ── 取数（S1 view-model 装载器；各源独立失败隔离，AI 故障不影响通知源）──
// ⚠️ S1 的 TaskSourceState 是普通对象（模块级单例，原地 mutate，非 Vue reactive）。
// ref 必须赋「新对象引用」才能触发模板更新：一律展开克隆 {...source}，禁止直接赋 snapshot 内的同引用对象
// （首帧后模板将永不更新 —— 本卡实测踩过：进度明细停在 idle 首帧文案）。

async function refreshPlans(): Promise<void> {
  plansSource.value = { ...await loadPlansSource() };
}

async function refreshConfirmations(): Promise<void> {
  confirmationsSource.value = { ...await loadConfirmationsSource() };
}

async function refreshEmployees(): Promise<void> {
  // 未指定员工：S1 源保持 idle（组件如实显示「未选择员工」）
  const snapshot = await loadTaskCenterSnapshot();
  plansSource.value = { ...snapshot.plans };
  confirmationsSource.value = { ...snapshot.confirmations };
  notificationsSource.value = { ...snapshot.notifications };
  employeeTasksSource.value = { ...snapshot.employeeTasks };
}

async function refreshNotifications(): Promise<void> {
  notificationsSource.value = { ...await loadNotificationsSource() };
}

async function refreshAll(): Promise<void> {
  const snapshot = await loadTaskCenterSnapshot();
  plansSource.value = { ...snapshot.plans };
  confirmationsSource.value = { ...snapshot.confirmations };
  employeeTasksSource.value = { ...snapshot.employeeTasks };
  notificationsSource.value = { ...snapshot.notifications };
}

function shortTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

onMounted(() => {
  void refreshAll();
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
/* ══ 任务中心列（第 4 列 · 300px）：整列 flex 纵向，不整体滚动（目录区各自可滚）══
   颜色全部走壳层 .wb-shell 主题令牌（UI-PARITY-BASE §四.5），本组件不再本地覆写 --wb-ink2。 */
.wtc {
  box-sizing: border-box;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--wb-side-bg, #f9fafc);
  border-left: 1px solid var(--wb-line, #e5e5e5);
  overflow: hidden;
}
.wtc.collapsed {
  /* 收起态 = 第 4 列 0px（UI-PARITY-BASE §四.1.4）：列内不渲染任何收起条，
     组件随 0px 轨道裁掉（aria-hidden 同步置真），重开唯一入口 = 顶栏 task-center-toggle。 */
  border-left: 0;
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
.wtc-dot.run {
  background: var(--wb-primary, #2563eb);
}
.wtc-dot.fail {
  background: var(--wb-danger, #dc2626);
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
