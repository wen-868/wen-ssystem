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

    <!-- ══ 区域 B · 默认工作台五块（WORKBENCH-10-F1）════════════════════════
         每块五态可区分：loading / empty / unavailable / error / retry（error+unavailable 给重试入口），
         状态机在 data-state 上如实标注；数据来源见各块 `<span>` 副标与脚本头注释。 -->

    <!-- ① KPI 区（原型 .wb-kpis > .wb-kpi{.l/.v/.d} L1763；真实源 /admin/dashboard/overview） -->
    <section class="wfb" data-testid="wb-feed-kpi" :data-state="kpiBlock.state" :data-retry-available="canRetry(kpiBlock.state)" aria-label="今日经营指标">
      <div class="fdv-block-title">
        今日经营指标<span>销售额 / 单据 / 库存预警 / 应收余额 · 与管理端概览同源折算</span>
      </div>
      <p v-if="kpiBlock.state === 'loading'" class="fdv-empty" data-testid="wb-kpi-loading">{{ kpiBlock.message }}</p>
      <template v-else-if="canRetry(kpiBlock.state)">
        <p class="fdv-empty" :class="{ 'is-error': kpiBlock.state === 'error' }" data-testid="wb-kpi-note">
          {{ kpiBlock.state === "unavailable" ? "待接入 · " : "读取失败 · " }}{{ kpiBlock.message }}
        </p>
        <button type="button" class="wfb-retry" data-testid="wb-kpi-retry" @click="refreshKpi">重试</button>
      </template>
      <p v-else-if="kpiBlock.state === 'empty'" class="fdv-empty" data-testid="wb-kpi-empty">{{ kpiBlock.message }}</p>
      <div v-else class="wb-kpis">
        <div v-for="kpi in kpiBlock.data" :key="kpi.key" class="wb-kpi" :data-kpi-key="kpi.key">
          <div class="l">{{ kpi.label }}</div>
          <div class="v">{{ kpi.value }}</div>
          <div class="d" :class="kpi.deltaClass || undefined">{{ kpi.delta || "—" }}</div>
        </div>
      </div>
    </section>

    <!-- ② 待办审批（原型 .wb-sec「待办审批」+ #wbApps .wb-ap 卡 L1764-1768；真实源 /api/chat/confirmations） -->
    <section class="wfb" data-testid="wb-feed-approvals" :data-state="approvalsBlock.state" :data-retry-available="canRetry(approvalsBlock.state)" aria-label="待办审批">
      <div class="fdv-block-title">
        待办审批<span>AI 已预审 · 确认后执行 · 全程留痕</span>
      </div>
      <p v-if="approvalsBlock.state === 'loading'" class="fdv-empty" data-testid="wb-ap-loading">{{ approvalsBlock.message }}</p>
      <template v-else-if="canRetry(approvalsBlock.state)">
        <p class="fdv-empty" :class="{ 'is-error': approvalsBlock.state === 'error' }" data-testid="wb-ap-note">
          {{ approvalsBlock.state === "unavailable" ? "待接入 · " : "读取失败 · " }}{{ approvalsBlock.message }}
        </p>
        <button type="button" class="wfb-retry" data-testid="wb-ap-retry" @click="refreshApprovals">重试</button>
      </template>
      <p v-else-if="approvalsBlock.state === 'empty'" class="fdv-empty" data-testid="wb-ap-empty">{{ approvalsBlock.message }}</p>
      <div v-else id="wbApps" class="wb-apps">
        <!-- 已执行变体（原型 .wb-ap.done + .done-tag「AI 已执行 · 已回流」L1765）：
             仅登记**本会话真实确认成功**的条目（持有底座返回的 operationId 回执） -->
        <div v-for="card in executedApprovals" :key="`done-${card.id}`" class="wb-ap done" data-testid="wb-ap-done">
          <div class="hd">
            <span class="wb-ap-ic"><el-icon :size="15"><Stamp /></el-icon></span>
            <div class="tt">{{ card.title }}<small>{{ card.refLabel }}</small></div>
            <span v-if="card.amount" class="amt">{{ card.amount }}</span>
            <span class="done-tag">AI 已执行 · 已回流{{ card.operationId ? `（操作号 ${card.operationId}）` : "" }}</span>
          </div>
        </div>
        <!-- 待确认卡（原型 pending 变体：.hd + .ai(AI 预审意见) + .a-acts(通过 / 驳回)） -->
        <div v-for="card in pendingApprovals" :key="card.id" class="wb-ap" :data-confirmation-id="card.id">
          <div class="hd">
            <span class="wb-ap-ic"><el-icon :size="15"><Stamp /></el-icon></span>
            <div class="tt">{{ card.title }}<small>{{ card.refLabel }} · AI 预审完成</small></div>
            <span v-if="card.amount" class="amt">{{ card.amount }}</span>
          </div>
          <div class="ai">
            <b><el-icon :size="13"><MagicStick /></el-icon>AI 预审意见</b>
            {{ card.opinion || "底座未返回预审意见 —— 请先在 AI 会话内核对操作明细，再决定是否确认。" }}
            <div class="a-acts">
              <button
                type="button"
                class="wfb-btn"
                data-testid="wb-ap-approve"
                :disabled="approvalBusy !== null"
                @click="approveCard(card)"
              >
                通过并执行
              </button>
              <button
                type="button"
                class="wfb-btn is-ghost"
                data-testid="wb-ap-reject"
                :disabled="approvalBusy !== null"
                @click="rejectCard(card)"
              >
                驳回 · 转人工
              </button>
            </div>
          </div>
        </div>
        <p v-if="approvalActionError" class="fdv-empty is-error" data-testid="wb-ap-action-error">{{ approvalActionError }}</p>
        <p v-else-if="approvalNotice" class="fdv-empty" data-testid="wb-ap-action-note">{{ approvalNotice }}</p>
      </div>
    </section>

    <!-- ③ 经营异动播报（原型 L5620/L5709；底座无播报端点 ⇒ 常态「待接入」，不本地伪造） -->
    <section class="wfb" data-testid="wb-feed-broadcast" :data-state="broadcastBlock.state" :data-retry-available="canRetry(broadcastBlock.state)" aria-label="经营异动播报">
      <div class="fdv-block-title">
        经营异动播报<span>GMV 环比 / 退款率 / 毛利异动 · AI 建议 · 人工核实后处置</span>
      </div>
      <p v-if="broadcastBlock.state === 'loading'" class="fdv-empty" data-testid="wb-bc-loading">{{ broadcastBlock.message }}</p>
      <template v-else-if="canRetry(broadcastBlock.state)">
        <p class="fdv-empty" :class="{ 'is-error': broadcastBlock.state === 'error' }" data-testid="wb-bc-note">
          {{ broadcastBlock.state === "unavailable" ? "待接入 · " : "读取失败 · " }}{{ broadcastBlock.message }}
        </p>
        <button type="button" class="wfb-retry" data-testid="wb-bc-retry" @click="refreshBroadcast">重试</button>
      </template>
      <p v-else-if="broadcastBlock.state === 'empty'" class="fdv-empty" data-testid="wb-bc-empty">{{ broadcastBlock.message }}</p>
      <div v-else class="wfb-bcs">
        <div v-for="(bc, index) in broadcastBlock.data" :key="`${bc.metric}-${index}`" class="wfb-bc">
          <span class="wfb-bc-metric">{{ bc.metric }}</span>
          <span class="wfb-bc-value">{{ bc.value }}</span>
          <p class="wfb-bc-advice">
            AI 建议：{{ bc.advice || "（底座未返回建议原文 · 需人工核实）" }}
            <em v-if="bc.needHumanCheck">· 人工核实后处置</em>
          </p>
        </div>
      </div>
    </section>

    <!-- ④ 主管动作队列（原型任务看板/主管视图 L6834/L6894；真实源 /api/ai/agent/plans + 确认链并入待审阅） -->
    <section class="wfb" data-testid="wb-feed-taskboard" :data-state="boardBlock.state" :data-retry-available="canRetry(boardBlock.state)" aria-label="主管动作队列">
      <div class="fdv-block-title">
        主管动作队列<span>任务看板 + 助理绩效 + 审批中心 + 播报 · 按状态分组（进行中 / 待审阅 / 已完成）</span>
      </div>
      <p v-if="boardBlock.state === 'loading'" class="fdv-empty" data-testid="wb-tb-loading">{{ boardBlock.message }}</p>
      <template v-else-if="canRetry(boardBlock.state)">
        <p class="fdv-empty" :class="{ 'is-error': boardBlock.state === 'error' }" data-testid="wb-tb-note">
          {{ boardBlock.state === "unavailable" ? "待接入 · " : "读取失败 · " }}{{ boardBlock.message }}
        </p>
        <button type="button" class="wfb-retry" data-testid="wb-tb-retry" @click="refreshQueue">重试</button>
      </template>
      <p v-else-if="boardBlock.state === 'empty'" class="fdv-empty" data-testid="wb-tb-empty">{{ boardBlock.message }}</p>
      <template v-else>
        <!-- 主管视图聚合行（原型 al-v10-nav4 四合一）：计数只来自真实源，缺端点的位置如实「待接入」 -->
        <div class="wfb-nav4" data-testid="wb-tb-nav4">
          <span class="wfb-nav-item">任务看板<em>{{ boardBlock.data.totalEntries }} 项</em></span>
          <span class="wfb-nav-item">助理绩效<em>待接入（绩效面板端点缺失）</em></span>
          <span class="wfb-nav-item">审批中心<em>{{ pendingApprovals.length }} 项待审阅</em></span>
          <span class="wfb-nav-item">播报中心<em>{{ broadcastLabel }}</em></span>
        </div>
        <template v-for="group in boardBlock.data.groups" :key="group.key">
          <p class="wfb-group-title">
            {{ group.label }}<template v-if="group.key === 'review'">（含审批待确认 {{ pendingApprovals.length }} 项）</template> · {{ group.entries.length }}
          </p>
          <div v-for="entry in group.entries" :key="entry.id" class="wfb-task" :data-bucket="group.key">
            <span class="wfb-st" :class="`s-${group.key}`">{{ group.label }}</span>
            <b>{{ entry.title }}</b>
            <em>{{ entry.agent ? `${entry.agent} · ` : "" }}{{ entry.stepsTotal > 0 ? `${entry.stepsDone}/${entry.stepsTotal} 环节` : entry.rawState }}</em>
          </div>
          <!-- 待审阅桶并入确认链真实条目（与②同源，不重复计数来源） -->
          <template v-if="group.key === 'review'">
            <div v-for="card in pendingApprovals" :key="`ap-${card.id}`" class="wfb-task" data-bucket="review">
              <span class="wfb-st s-review">待审阅</span>
              <b>{{ card.title }}</b>
              <em>AI 预审完成 · 待确认</em>
            </div>
          </template>
        </template>
        <p v-if="boardBlock.data.unknownStates > 0" class="fdv-empty" data-testid="wb-tb-unknown">
          另有 {{ boardBlock.data.unknownStates }} 项计划状态未识别（不在已知六态清单，未计入分组，如实披露）
        </p>
      </template>
    </section>

    <!-- ⑤ 任务步进（原型 V24 TASKFLOW L11711 · 步进链 L1810-1817 语义：done √ / wait ● / lock 🔒；
         真实源 /api/ai/agent/plans 的 steps 六态按门控折算三态） -->
    <section class="wfb" data-testid="wb-feed-taskflow" :data-state="flowBlock.state" :data-retry-available="canRetry(flowBlock.state)" aria-label="任务步进">
      <div class="fdv-block-title">
        任务步进<span>环节门控 · √ 已完成 / ● 进行中 / 🔒 未解锁 · 完成上一步后解锁下一环节</span>
      </div>
      <p v-if="flowBlock.state === 'loading'" class="fdv-empty" data-testid="wb-tf-loading">{{ flowBlock.message }}</p>
      <template v-else-if="canRetry(flowBlock.state)">
        <p class="fdv-empty" :class="{ 'is-error': flowBlock.state === 'error' }" data-testid="wb-tf-note">
          {{ flowBlock.state === "unavailable" ? "待接入 · " : "读取失败 · " }}{{ flowBlock.message }}
        </p>
        <button type="button" class="wfb-retry" data-testid="wb-tf-retry" @click="refreshQueue">重试</button>
      </template>
      <p v-else-if="flowBlock.state === 'empty'" class="fdv-empty" data-testid="wb-tf-empty">{{ flowBlock.message }}</p>
      <div v-else class="act24-list">
        <div v-for="flow in flowBlock.data.slice(0, 3)" :key="flow.id" class="act24-card" :data-act24f="flow.id">
          <div class="act24-hd">
            任务步进 · AI 实时跟踪<b>{{ flow.title }}</b>
            <span class="act24-tag">#{{ flow.id }}</span>
            <span class="act24-tag" :class="flow.doneCount === flow.steps.length ? 'ok' : 'run'">{{ flow.statusText }}</span>
          </div>
          <div class="act24-steps">
            <template v-for="(step, index) in flow.steps" :key="step.key">
              <i v-if="index > 0" class="act24-arrow">→</i>
              <b class="act24-st" :class="step.cls" :title="`状态：${step.rawStatus}`">{{ step.mark }} {{ step.label }}</b>
            </template>
          </div>
        </div>
      </div>
    </section>

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
 * 工作台信息流主面（WORKBENCH-06 · 原型 renderFeed L2069 的结构对齐版；
 * WORKBENCH-10-F1 区域 B 在此完成默认工作台五块：KPI 区 / 待办审批 / 经营异动播报 /
 * 主管动作队列 / 任务步进，每块 loading·empty·unavailable·error 可区分并给重试入口）
 *
 * 数据全部真实、可复跑，取数折算在 shared/workbench/wb-feed-*.ts 适配器：
 *   - KPI = GET /admin/dashboard/overview（与管理端 Dashboard 同一契约 dashboard-contract）；
 *   - 待办审批 = GET {AI_BASE}/api/chat/confirmations（通过/驳回走底座确认链，回执 operationId 留痕）；
 *   - 经营异动播报 = 底座无播报端点 ⇒ 恒「待接入」（agent-directory 同口径，不伪造建议文案）；
 *   - 主管动作队列 / 任务步进 = GET {AI_BASE}/api/ai/agent/plans（六态计划/步骤按门控折算）；
 *   - 业务动态 = GET /admin/wb-notifications（与 MessageCenter 同一端点同一形态）；
 *   - 实时推送 = connectAiPushSocket（AI 底座 WS；离线如实标注「推送离线」，不影响人工）；
 *   - 原型 FEED 里的事件流/订单跟踪进度条依赖底座 feed 端点（能力台账 ai-03 = PLANNED）⇒
 *     不伪造，登记差异清单。问候语/日期为本地计算，非数据源。
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Bell, MagicStick, Stamp } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
import { api } from "../../api/request";
import { AI_BASE_URL, cancelAiOperation, confirmAiOperation, connectAiPushSocket, fetchAiConfirmations } from "../../api/ai";
import { fetchDashboardOverview } from "../../api/report";
import { useAuthStore } from "../../stores/auth";
import type { ManifestItem } from "../../shared/workbench/route-manifest";
import {
  classifyFeedError,
  feedLoading,
  type FeedBlock,
  type FeedBlockState,
} from "../../shared/workbench/wb-feed-types";
import { loadWbKpi, type WbKpiMetric } from "../../shared/workbench/wb-feed-kpi";
import { loadWbApprovals, type WbApprovalCard } from "../../shared/workbench/wb-feed-approvals";
import { loadWbBroadcasts, type WbBroadcastItem } from "../../shared/workbench/wb-feed-broadcast";
import { parseWbTaskBoard, type WbTaskBoard } from "../../shared/workbench/wb-feed-taskboard";
import { parseWbTaskFlows, type WbTaskFlow } from "../../shared/workbench/wb-feed-taskflow";

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

// ── 区域 B · 五块状态机（每块 FeedBlock：loading/ready/empty/unavailable/error；retry=入口）──
const EMPTY_BOARD: WbTaskBoard = {
  groups: [
    { key: "run", label: "进行中", entries: [] },
    { key: "review", label: "待审阅", entries: [] },
    { key: "done", label: "已完成", entries: [] },
  ],
  unknownStates: 0,
  totalEntries: 0,
};

const kpiBlock = ref<FeedBlock<WbKpiMetric[]>>(feedLoading<WbKpiMetric[]>([], "经营指标"));
const approvalsBlock = ref<FeedBlock<WbApprovalCard[]>>(feedLoading<WbApprovalCard[]>([], "待办审批"));
const broadcastBlock = ref<FeedBlock<WbBroadcastItem[]>>(feedLoading<WbBroadcastItem[]>([], "经营异动播报"));
const boardBlock = ref<FeedBlock<WbTaskBoard>>(feedLoading<WbTaskBoard>(EMPTY_BOARD, "主管动作队列"));
const flowBlock = ref<FeedBlock<WbTaskFlow[]>>(feedLoading<WbTaskFlow[]>([], "任务步进"));

/** error / unavailable 两态显示重试入口（第五态 retry 的落点） */
function canRetry(state: FeedBlockState): boolean {
  return state === "error" || state === "unavailable";
}

/** AI 底座计划列表（主管动作队列 + 任务步进共用一次真实读取；404 ⇒ 待接入） */
async function fetchAgentPlans(): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  try {
    const token = useAuthStore().token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* 无登录态也发出请求，由底座裁决（诚实降级，不在本地吞掉） */
  }
  const resp = await fetch(`${AI_BASE_URL}/api/ai/agent/plans`, { headers });
  if (!resp.ok) throw new Error(`任务计划端点响应异常（HTTP ${resp.status}）`);
  return (await resp.json()) as unknown;
}

async function refreshKpi(): Promise<void> {
  kpiBlock.value = feedLoading<WbKpiMetric[]>([], "经营指标");
  kpiBlock.value = await loadWbKpi({ fetchOverview: fetchDashboardOverview });
}

async function refreshApprovals(): Promise<void> {
  approvalsBlock.value = feedLoading<WbApprovalCard[]>([], "待办审批");
  approvalsBlock.value = await loadWbApprovals({ fetchConfirmations: fetchAiConfirmations });
}

/** 播报：底座端点不存在 ⇒ loadWbBroadcasts 不注入读取器，恒 unavailable（待接入 + 重试） */
async function refreshBroadcast(): Promise<void> {
  broadcastBlock.value = feedLoading<WbBroadcastItem[]>([], "经营异动播报");
  broadcastBlock.value = await loadWbBroadcasts();
}

async function refreshQueue(): Promise<void> {
  boardBlock.value = feedLoading<WbTaskBoard>(EMPTY_BOARD, "主管动作队列");
  flowBlock.value = feedLoading<WbTaskFlow[]>([], "任务步进");
  try {
    const raw = await fetchAgentPlans();
    boardBlock.value = parseWbTaskBoard(raw);
    flowBlock.value = parseWbTaskFlows(raw);
  } catch (err) {
    boardBlock.value = classifyFeedError(err, "主管动作队列", EMPTY_BOARD);
    flowBlock.value = classifyFeedError(err, "任务步进", []);
  }
}

// ── 审批动作（真实确认链：通过 = 底座确认执行；驳回 = 取消并转人工）──
interface ExecutedApprovalCard extends WbApprovalCard {
  /** 底座返回的操作回执号（可能为空串：底座未下发 operationId 时如实留空） */
  operationId: string;
}
const executedApprovals = ref<ExecutedApprovalCard[]>([]);
const approvalBusy = ref<string | null>(null);
const approvalActionError = ref("");
const approvalNotice = ref("");

const pendingApprovals = computed<WbApprovalCard[]>(() => {
  if (approvalsBlock.value.state !== "ready") return [];
  const executedIds = new Set(executedApprovals.value.map((card) => card.id));
  return approvalsBlock.value.data.filter((card) => card.status === "pending" && !executedIds.has(card.id));
});

const broadcastLabel = computed(() => {
  switch (broadcastBlock.value.state) {
    case "ready":
      return `${broadcastBlock.value.data.length} 条`;
    case "empty":
      return "暂无异动";
    case "unavailable":
      return "待接入";
    case "error":
      return "读取失败";
    default:
      return "读取中";
  }
});

async function approveCard(card: WbApprovalCard): Promise<void> {
  if (approvalBusy.value !== null) return;
  approvalBusy.value = card.id;
  approvalActionError.value = "";
  approvalNotice.value = "";
  try {
    const operationId = await confirmAiOperation(card.id);
    executedApprovals.value = [
      { ...card, status: "done", operationId },
      ...executedApprovals.value,
    ];
    await refreshApprovals();
    approvalNotice.value = `已通过「${card.title}」${operationId ? `（操作号 ${operationId}）` : ""} · 结果已回流工作台`;
  } catch (err) {
    approvalActionError.value = `确认执行失败：${err instanceof Error ? err.message : String(err)}（操作未生效，可重试）`;
  } finally {
    approvalBusy.value = null;
  }
}

async function rejectCard(card: WbApprovalCard): Promise<void> {
  if (approvalBusy.value !== null) return;
  approvalBusy.value = card.id;
  approvalActionError.value = "";
  approvalNotice.value = "";
  try {
    await cancelAiOperation(card.id);
    await refreshApprovals();
    approvalNotice.value = `已驳回「${card.title}」并转人工 · AI 写操作未执行`;
  } catch (err) {
    approvalActionError.value = `驳回失败：${err instanceof Error ? err.message : String(err)}（确认单仍在列表，可重试）`;
  } finally {
    approvalBusy.value = null;
  }
}

let disconnectPush: (() => void) | null = null;
onMounted(() => {
  loadMessages();
  refreshKpi();
  refreshApprovals();
  refreshBroadcast();
  refreshQueue();
  disconnectPush = connectAiPushSocket({
    onMessage: () => {
      // 收到推送即刷新动态与审批（真实触发，不本地伪造）
      loadMessages();
      refreshApprovals();
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
  /* 对齐原型 L147-148 `.feed-ask` hover（WORKBENCH-06F3 MISSING #7：变色有、过渡缺） */
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
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
  /* 对齐原型 L150 `.feed-card{transition:.15s;animation:fin .35s}`：
     ① 入场动画 fin → wb-fdv-in（WORKBENCH-06F3 MISSING #5）
     ② hover 过渡 + 边框高亮（MISSING #4 卡片 hover 缺失一侧） */
  animation: wb-fdv-in 350ms ease-out both;
  transition: border-color 150ms ease, background-color 150ms ease;
}
.fdv-item:hover {
  border-color: var(--wb-primary, #2563eb);
}
/**
 * 入场动画：与原型 `@keyframes fin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}` 对齐。
 * `both` 保证动画结束保留终态（不会闪回未动画前的初始渲染）。
 */
@keyframes wb-fdv-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  /* 无障碍：与全局 tokens.css 同口径 —— 用户选择减少动效时不播入场动画 */
  .fdv-item {
    animation: none;
  }
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

/* ══ 区域 B · 默认工作台五块（WORKBENCH-10-F1）══
   类名对齐原型锚点：.wb-kpis/.wb-kpi{.l/.v/.d}、.wb-ap{.hd/.tt/.amt/.ai/.a-acts/.done-tag}、
   .act24-steps/.act24-arrow/.act24-st(done|wait|lock)。
   动效纪律（ui-animation #10）：transition 一律 150ms；不新增 animation/keyframes；
   不新增第二个 reduced-motion 块（无障碍全局规则与上方 .fdv-item 就地规则保持唯一）。 */
.wfb {
  margin-bottom: 18px;
}
.wb-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.wb-kpi {
  padding: 12px 14px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 12px;
  background: var(--wb-panel, #fff);
  transition: border-color 150ms ease;
}
.wb-kpi:hover {
  border-color: var(--wb-primary, #2563eb);
}
.wb-kpi .l {
  font-size: 11.5px;
  color: var(--wb-ink2, #8a8f98);
}
.wb-kpi .v {
  margin-top: 6px;
  font-size: 20px;
  font-weight: 800;
  color: var(--wb-ink, #16181d);
}
.wb-kpi .d {
  margin-top: 5px;
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
}
.wb-kpi .d.up {
  color: #16a34a;
  font-weight: 600;
}
.wb-kpi .d.warn {
  color: #ad6800;
  font-weight: 600;
}
.wb-apps {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.wb-ap {
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 13px;
  padding: 13px 15px;
  background: var(--wb-panel, #fff);
  transition: border-color 150ms ease;
}
.wb-ap:hover {
  border-color: var(--wb-primary, #2563eb);
}
.wb-ap .hd {
  display: flex;
  align-items: center;
  gap: 11px;
}
.wb-ap .wb-ap-ic {
  color: var(--wb-ink2, #8a8f98);
  display: inline-flex;
  flex-shrink: 0;
}
.wb-ap .tt {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
}
.wb-ap .tt small {
  display: block;
  font-weight: 400;
  color: var(--wb-ink2, #8a8f98);
  font-size: 11px;
  margin-top: 2px;
}
.wb-ap .amt {
  font-weight: 700;
  font-size: 13px;
  color: var(--wb-ink, #16181d);
}
.wb-ap .ai {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--wb-primary-soft, #eff4ff);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--wb-ink, #16181d);
}
.wb-ap .ai b {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--wb-primary, #2563eb);
  font-size: 12px;
  margin-bottom: 4px;
}
.wb-ap .ai .a-acts {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.wb-ap.done {
  background: #f6fef9;
  border-color: #bbf7d0;
}
.wb-ap.done .done-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  font-size: 11.5px;
  font-weight: 600;
  color: #166534;
  white-space: nowrap;
}
.wfb-btn {
  padding: 5px 12px;
  border: 1px solid var(--wb-primary, #2563eb);
  border-radius: 7px;
  background: var(--wb-primary, #2563eb);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: opacity 150ms ease;
}
.wfb-btn:hover {
  opacity: 0.85;
}
.wfb-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.wfb-btn.is-ghost {
  background: transparent;
  color: var(--wb-ink, #16181d);
  border-color: var(--wb-line, #eceef1);
}
.wfb-retry {
  margin-top: 6px;
  padding: 4px 12px;
  border: 1px dashed var(--wb-primary, #2563eb);
  border-radius: 7px;
  background: transparent;
  color: var(--wb-primary, #2563eb);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 150ms ease;
}
.wfb-retry:hover {
  background: var(--wb-primary-soft, #eff4ff);
}
.wfb-bcs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.wfb-bc {
  padding: 11px 14px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 10px;
  background: var(--wb-panel, #fff);
}
.wfb-bc-metric {
  font-size: 13px;
  font-weight: 700;
  color: var(--wb-ink, #16181d);
  margin-right: 8px;
}
.wfb-bc-value {
  font-size: 12.5px;
  color: var(--wb-primary, #2563eb);
  font-weight: 600;
}
.wfb-bc-advice {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--wb-ink2, #8a8f98);
}
.wfb-bc-advice em {
  font-style: normal;
  color: #ad6800;
}
.wfb-nav4 {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.wfb-nav-item {
  padding: 6px 10px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 8px;
  background: var(--wb-panel, #fff);
  font-size: 12px;
  color: var(--wb-ink, #16181d);
}
.wfb-nav-item em {
  font-style: normal;
  margin-left: 6px;
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
}
.wfb-group-title {
  margin: 10px 2px 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--wb-ink2, #8a8f98);
}
.wfb-task {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 9px;
  background: var(--wb-panel, #fff);
  margin-bottom: 6px;
  font-size: 12.5px;
}
.wfb-task b {
  flex: 1;
  min-width: 0;
  color: var(--wb-ink, #16181d);
}
.wfb-task em {
  font-style: normal;
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
  white-space: nowrap;
}
.wfb-st {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--wb-line, #eceef1);
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
}
.wfb-st.s-run {
  background: var(--wb-primary-soft, #eff4ff);
  border-color: #bcd0f7;
  color: var(--wb-primary, #2563eb);
}
.wfb-st.s-review {
  background: #fff7e6;
  border-color: #f5d9a8;
  color: #ad6800;
}
.wfb-st.s-done {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #166534;
}
.act24-card {
  padding: 12px 14px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 12px;
  background: var(--wb-panel, #fff);
  margin-bottom: 8px;
}
.act24-hd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--wb-ink2, #8a8f98);
  margin-bottom: 6px;
}
.act24-hd b {
  font-size: 13px;
  color: var(--wb-ink, #16181d);
}
.act24-tag {
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--wb-line, #eceef1);
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
}
.act24-tag.ok {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #166534;
}
.act24-tag.run {
  background: var(--wb-primary-soft, #eff4ff);
  border-color: #bcd0f7;
  color: var(--wb-primary, #2563eb);
}
.act24-steps {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin: 9px 0;
}
.act24-arrow {
  font-style: normal;
  font-size: 11px;
  color: var(--wb-ink2, #8a8f98);
}
.act24-st {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--wb-line, #eceef1);
  background: var(--bg-soft, #f7f8fa);
  color: var(--wb-ink2, #8a8f98);
  font-size: 11.5px;
  font-weight: 600;
  transition: filter 150ms ease;
}
.act24-st.done {
  background: var(--wb-primary-soft, #eff4ff);
  border-color: var(--wb-primary, #2563eb);
  color: var(--wb-primary, #2563eb);
}
.act24-st.wait {
  background: var(--wb-primary, #2563eb);
  border-color: var(--wb-primary, #2563eb);
  color: #fff;
}
.act24-st.lock {
  opacity: 0.55;
}
</style>
