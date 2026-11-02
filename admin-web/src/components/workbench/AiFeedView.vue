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
      <div class="fdv-block-title wb-sec">
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
      <div class="fdv-block-title wb-sec">
        待办审批<span>AI 已预审 · 确认后执行 · 全程留痕</span>
      </div>
      <!-- F3 §三.B：`#wbApps` 容器**恒在**（原型 L1764 同位），五态内容在容器内如实切换；
           数据不可得 ⇒ 占位 .wb-ap.is-unavailable（复用原型卡同款边框/圆角/内边距）+ 重试，绝不删区块、不造假数据。 -->
      <div id="wbApps" class="wb-apps" data-testid="wb-ap-zone">
        <p v-if="approvalsBlock.state === 'loading'" class="fdv-empty" data-testid="wb-ap-loading">{{ approvalsBlock.message }}</p>
        <div
          v-else-if="canRetry(approvalsBlock.state)"
          class="wb-ap is-unavailable"
          :class="{ 'is-error': approvalsBlock.state === 'error' }"
          data-testid="wb-ap-unavailable"
        >
          <div class="hd">
            <span class="wb-ap-ic"><el-icon :size="15"><Stamp /></el-icon></span>
            <div class="tt">
              待办审批<small
                data-testid="wb-ap-note"
              >{{ approvalsBlock.state === "unavailable" ? "待接入" : "读取失败" }} · {{ approvalsBlock.message }} ——
                无真实审批读数时不伪造待办项</small>
            </div>
            <button type="button" class="wfb-retry" data-testid="wb-ap-retry" @click="refreshApprovals">重试</button>
          </div>
        </div>
        <p v-else-if="approvalsBlock.state === 'empty'" class="fdv-empty" data-testid="wb-ap-empty">{{ approvalsBlock.message }}</p>
        <template v-else>
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
        </template>
      </div>
      <!-- AI 入口条（原型 al-v9-entry #al9Entry L6476＋CSS L6250、al-v10-entry #al10BCBar L7173＋CSS L6992：
           高 54 · 1px 虚线（审批中心蓝 / 播报紫 #A78BFA）· 圆角 10 · 内边距 9px 12px · 两条间隔 10px，
           与原型一致地紧贴在 #wbApps 之后）。读数只用本区真实计数：审批项数来自 /api/chat/confirmations，
           播报端点缺失 ⇒ broadcastLabel 如实显示「待接入」，不在此伪造未读数或异动。 -->
      <div class="wfb-entry al-v9-entry" data-testid="wb-ap-entry">
        <b>AI 审批中心 · 集中待审阅</b>
        <em>{{ approvalsEntryLabel }} · AI 结论 / 依据 / 影响分析在会话内并排核对</em>
        <button
          type="button"
          class="wfb-btn"
          data-testid="wb-ap-entry-go"
          @click="$emit('open-chat')"
        >
          进入会话核对
        </button>
      </div>
      <div class="wfb-entry al-v10-entry is-broadcast" data-testid="wb-bc-entry">
        <b>AI 主动播报 · 播报中心</b>
        <em>{{ broadcastLabel }} · 无真实播报读数时不本地伪造异动</em>
        <button
          type="button"
          class="wfb-btn is-ghost"
          data-testid="wb-bc-entry-go"
          @click="$emit('open-chat')"
        >
          进入会话询问
        </button>
      </div>
    </section>

    <!-- ③ 经营异动播报（原型 L5620/L5709；底座无播报端点 ⇒ 常态「待接入」，不本地伪造） -->
    <section class="wfb" data-testid="wb-feed-broadcast" :data-state="broadcastBlock.state" :data-retry-available="canRetry(broadcastBlock.state)" aria-label="经营异动播报">
      <div class="fdv-block-title wb-sec">
        经营异动播报<span>GMV 环比 / 退款率 / 毛利异动 · AI 建议 · 人工核实后处置</span>
      </div>
      <!-- F3 §三.B：`.wfb-bcs` 容器恒在（原型播报区同位），不可得 ⇒ 占位条 + 重试，读数照常如实。 -->
      <div class="wfb-bcs" data-testid="wb-bc-zone">
        <p v-if="broadcastBlock.state === 'loading'" class="fdv-empty" data-testid="wb-bc-loading">{{ broadcastBlock.message }}</p>
        <div
          v-else-if="canRetry(broadcastBlock.state)"
          class="wfb-bc is-unavailable"
          :class="{ 'is-error': broadcastBlock.state === 'error' }"
          data-testid="wb-bc-unavailable"
        >
          <span class="wfb-bc-metric">经营异动播报</span>
          <span class="wfb-bc-value">{{ broadcastBlock.state === "unavailable" ? "待接入" : "读取失败" }}</span>
          <p class="wfb-bc-advice" data-testid="wb-bc-note">
            {{ broadcastBlock.message }} —— 无真实播报读数时不本地伪造异动
            <button type="button" class="wfb-retry" data-testid="wb-bc-retry" @click="refreshBroadcast">重试</button>
          </p>
        </div>
        <p v-else-if="broadcastBlock.state === 'empty'" class="fdv-empty" data-testid="wb-bc-empty">{{ broadcastBlock.message }}</p>
        <template v-else>
          <div v-for="(bc, index) in broadcastBlock.data" :key="`${bc.metric}-${index}`" class="wfb-bc">
            <span class="wfb-bc-metric">{{ bc.metric }}</span>
            <span class="wfb-bc-value">{{ bc.value }}</span>
            <p class="wfb-bc-advice">
              AI 建议：{{ bc.advice || "（底座未返回建议原文 · 需人工核实）" }}
              <em v-if="bc.needHumanCheck">· 人工核实后处置</em>
            </p>
          </div>
        </template>
      </div>
    </section>

    <!-- ④ 主管动作队列（原型任务看板/主管视图 L6834/L6894；真实源 /api/ai/agent/plans + 确认链并入待审阅） -->
    <section class="wfb" data-testid="wb-feed-taskboard" :data-state="boardBlock.state" :data-retry-available="canRetry(boardBlock.state)" aria-label="主管动作队列">
      <div class="fdv-block-title wb-sec">
        主管动作队列<span>任务看板 + 助理绩效 + 审批中心 + 播报 · 按状态分组（进行中 / 待审阅 / 已完成）</span>
      </div>
      <!-- F3 §三.B：动作队列内容容器恒在；不可得 ⇒ 占位行 + 重试，标题区（上）不受状态影响。 -->
      <div class="wfb-board" data-testid="wb-tb-zone">
        <p v-if="boardBlock.state === 'loading'" class="fdv-empty" data-testid="wb-tb-loading">{{ boardBlock.message }}</p>
        <div
          v-else-if="canRetry(boardBlock.state)"
          class="wfb-task is-unavailable"
          :class="{ 'is-error': boardBlock.state === 'error' }"
          data-testid="wb-tb-unavailable"
        >
          <b>主管动作队列</b>
          <em data-testid="wb-tb-note">{{ boardBlock.state === "unavailable" ? "待接入" : "读取失败" }} · {{ boardBlock.message }} —— 无真实计划读数时不伪造任务项</em>
          <button type="button" class="wfb-retry" data-testid="wb-tb-retry" @click="refreshQueue">重试</button>
        </div>
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
      </div>
    </section>

    <!-- ⑤ 任务步进（原型 V24 TASKFLOW L11711 · 步进链 L1810-1817 语义：done √ / wait ● / lock 🔒；
         真实源 /api/ai/agent/plans 的 steps 六态按门控折算三态） -->
    <section class="wfb" data-testid="wb-feed-taskflow" :data-state="flowBlock.state" :data-retry-available="canRetry(flowBlock.state)" aria-label="任务步进">
      <div class="fdv-block-title wb-sec">
        任务步进<span>环节门控 · √ 已完成 / ● 进行中 / 🔒 未解锁 · 完成上一步后解锁下一环节</span>
      </div>
      <!-- F3 §三.B：`.act24-list` 容器恒在（原型 .act24-card 同位）；不可得 ⇒ 占位步进卡 + 重试，不伪造流程数据。 -->
      <div class="act24-list" data-testid="wb-tf-zone">
        <p v-if="flowBlock.state === 'loading'" class="fdv-empty" data-testid="wb-tf-loading">{{ flowBlock.message }}</p>
        <div
          v-else-if="canRetry(flowBlock.state)"
          class="act24-card is-unavailable"
          :class="{ 'is-error': flowBlock.state === 'error' }"
          data-testid="wb-tf-unavailable"
        >
          <div class="act24-hd">
            任务步进 · AI 实时跟踪<b>暂无真实任务读数</b>
            <span class="act24-tag">{{ flowBlock.state === "unavailable" ? "待接入" : "读取失败" }}</span>
            <button type="button" class="wfb-retry" data-testid="wb-tf-retry" @click="refreshQueue">重试</button>
          </div>
          <p class="fdv-empty" :class="{ 'is-error': flowBlock.state === 'error' }" data-testid="wb-tf-note">
            {{ flowBlock.message }} —— 环节链在无真实计划数据时不本地伪造
          </p>
        </div>
        <p v-else-if="flowBlock.state === 'empty'" class="fdv-empty" data-testid="wb-tf-empty">{{ flowBlock.message }}</p>
        <template v-else>
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
        </template>
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

/**
 * 审批中心入口条（#al9Entry）的读数文案：只有 ready/empty 才报真实项数，
 * loading/unavailable/error 如实标态 —— 不写「0 项待审阅」冒充读到了空列表。
 */
const approvalsEntryLabel = computed(() => {
  switch (approvalsBlock.value.state) {
    case "ready":
    case "empty":
      return `${pendingApprovals.value.length} 项待审阅`;
    case "unavailable":
      return "待接入 · 无审批读数";
    case "error":
      return "读取失败 · 无审批读数";
    default:
      return "读数读取中";
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
/* 内容列 = 原型 `.wb-wrap{max-width:1080px;margin:0 auto;padding:32px 44px 60px}`（L195）。
   `.fdv` 本身既是滚动容器又是这一列：壳层 `.wb-view.shown` 是 column flex，
   这里给 max-width + 左右 auto 边距即在该列内水平居中（不依赖 WorkbenchShell 的样式，
   也不需要额外包一层 div）。box-sizing:border-box ⇒ 1080 含左右 44 内边距，内柱实测 992。
   ⚠️ `width: 100%` 不是冗余：flex 项在交叉轴上带 auto 外边距时**不再 stretch**（CSS Flexbox
   「auto 外边距吸收剩余空间」），只写 max-width 会收缩成 fit-content。
   1440×1000 运行态实测：缺 width 时本列 741.84（内柱 653.84）vs 原型 992
   ⇒ §三.A.8 KPI/播报的 gridColumns 全红；显式 100% 后被 max-width 截到 1080，
   内柱 1080−44×2=992 与原型逐像素一致。 */
.fdv {
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  max-width: 1080px;
  margin: 0 auto;
  overflow-y: auto;
  padding: 32px 44px 60px;
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
/* 区块标题 = 原型 `.wb-sec{display:flex;align-items:baseline;gap:10px;margin:28px 0 12px;font-size:13.5px;font-weight:800}`
   ＋ `.wb-sec span{font-size:11px;color:var(--sub);font-weight:400}`（L223-224）；
   line-height:18px 使标题行实测高度落在 18。 */
.fdv-block-title.wb-sec {
  gap: 10px;
  min-height: 18px;
  margin: 28px 0 12px;
  font-size: 13.5px;
  line-height: 18px;
  font-weight: 800;
}
.fdv-block-title.wb-sec span {
  font-size: 11px;
  line-height: 18px;
}
.wb-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
}
/* 原型 `.wb-kpi{border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:var(--side)}`（L217）；
   .l/.v/.d 给死行高（16 / 25 / 15）＋ 间距（0 + 6 + 5）⇒ 内容 67 ＋ 内边距 28 ＋ 边框 2 = 实测高 97。 */
.wb-kpi {
  box-sizing: border-box;
  min-height: 97px;
  padding: 14px 16px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 14px;
  background: var(--wb-side, #f9fafb);
  transition: border-color 150ms ease;
}
.wb-kpi:hover {
  border-color: var(--wb-primary, #2563eb);
}
.wb-kpi .l {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--wb-ink2, #8a8f98);
}
.wb-kpi .v {
  margin-top: 6px;
  font-size: 20px;
  line-height: 25px;
  font-weight: 800;
  color: var(--wb-ink, #16181d);
}
.wb-kpi .d {
  margin-top: 5px;
  font-size: 11px;
  line-height: 15px;
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
/* 审批列表容器按原型 `#wbApps`（无自身样式，纯块级流），
   卡与卡的 9px 间距由 `.wb-ap{margin-bottom:9px}` 提供（L225），不再叠加 flex gap。 */
.wb-apps {
  display: block;
}
/* 原型 `.wb-ap{border:1px solid var(--line);border-radius:14px;padding:13px 15px;margin-bottom:9px}`
   （圆角实测 14）；.hd 行高 35 ⇒ 35 ＋ 上下内边距 26 ＋ 边框 2 = 实测高 63、宽 992（满内柱）。
   带 AI 预审意见的待确认卡因正文展开必然高于 63，这是「不折叠真实预审意见」的取舍。 */
.wb-ap {
  box-sizing: border-box;
  min-height: 63px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 14px;
  padding: 13px 15px;
  margin-bottom: 9px;
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
  min-height: 35px;
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
  line-height: 1.4;
  font-weight: 600;
  color: var(--wb-ink, #16181d);
  overflow-wrap: anywhere;
}
.wb-ap .tt small {
  display: block;
  font-weight: 400;
  color: var(--wb-ink2, #8a8f98);
  font-size: 11px;
  line-height: 1.2;
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
/* F3 §三.B.6 占位变体：只改边框线型/文案色等诚实标记，**不动**门禁比对的圆角/内边距/外边距，
   保证区块在 unavailable/empty 时仍占据原型同位、同尺寸。 */
.wb-ap.is-unavailable,
.wfb-bc.is-unavailable,
.wfb-task.is-unavailable,
.act24-card.is-unavailable {
  border-style: dashed;
}
.wb-ap.is-unavailable .tt small,
.wfb-task.is-unavailable em,
.act24-card.is-unavailable .fdv-empty {
  color: var(--wb-ink2, #8a8f98);
}
.wb-ap.is-unavailable.is-error,
.wfb-bc.is-unavailable.is-error,
.wfb-task.is-unavailable.is-error,
.act24-card.is-unavailable.is-error {
  border-color: #fca5a5;
}
/* AI 入口条 = 原型 `.al-v9-entry`（#al9Entry，CSS L6250）与 `.al-v10-entry`（#al10BCBar，CSS L6992）：
   `display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px dashed …;border-radius:10px;
    padding:9px 12px;margin:10px 0;background:var(--panel2)}` ⇒ 实测高 54、两条之间 10px（相邻 margin 折叠）。
   审批中心虚线用主蓝，播报虚线用 #A78BFA。 */
.wfb-entry {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 54px;
  margin: 10px 0;
  padding: 9px 12px;
  border: 1px dashed var(--wb-primary, #2563eb);
  border-radius: 10px;
  background: var(--wb-panel2, #f4f6f8);
}
.wfb-entry.is-broadcast {
  border-color: var(--wb-violet, #a78bfa);
}
.wfb-entry b {
  flex-shrink: 0;
  font-size: 12.5px;
  line-height: 18px;
  color: var(--wb-ink, #16181d);
  white-space: nowrap;
}
.wfb-entry em {
  flex: 1;
  min-width: 0;
  font-style: normal;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--wb-ink2, #8a8f98);
}
.wfb-bcs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wfb-bc {
  box-sizing: border-box;
  padding: 13px 15px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 14px;
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
/* 主管动作队列（原型 #actHome 头部 + `.al-v10-nav4` 四合一聚合条，CSS L7039-7043）：
   四合一 chips = 圆角 10 · 内边距 10px 12px · 底色 #F4F6F8 · 栅格 4 列，块内间隔统一 ~10。 */
.wfb-nav4 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 10px 0;
}
.wfb-nav-item {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 10px;
  background: var(--wb-panel2, #f4f6f8);
  font-size: 12px;
  color: var(--wb-ink, #16181d);
}
.wfb-nav-item em {
  font-style: normal;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--wb-ink2, #8a8f98);
}
.wfb-group-title {
  margin: 12px 2px 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--wb-ink2, #8a8f98);
}
/* 队列行与审批卡同一套卡片语言：圆角 14 · 内边距 13px 15px · 行间隔 10 */
.wfb-task {
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  padding: 13px 15px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 14px;
  background: var(--wb-panel, #fff);
  margin-bottom: 10px;
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
/* 任务步进（原型 .act24-card L12010 系 + V24 TASKFLOW 面板）：F3 对齐原型真值 圆角 10 · 上下外边距 8 ·
   内边距 13px 15px；步进胶囊 .act24-st / 标签 .act24-tag 保持原型 999px 药丸（L12013/L12018），不改成方角。 */
.act24-card {
  box-sizing: border-box;
  padding: 13px 15px;
  border: 1px solid var(--wb-line, #eceef1);
  border-radius: 10px;
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

/* ── 响应式回退（1440×1000 / 1024×768 / 390×844 三档都要零横向溢出）──
   列宽真相源仍是 `.fdv` 的 max-width:1080；窄口只降栅格列数与内柱内边距，
   并把「不换行」的文本放开，避免 nowrap 子项把 min-content 顶出视口。 */
@media (max-width: 1024px) {
  .fdv {
    padding: 28px 24px 48px;
  }
  .wb-kpis,
  .wfb-nav4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 390px) {
  .fdv {
    padding: 20px 12px 40px;
  }
  .fdv-head {
    flex-wrap: wrap;
  }
  .fdv-name {
    overflow-wrap: anywhere;
  }
  .wb-kpis,
  .wfb-nav4 {
    grid-template-columns: minmax(0, 1fr);
  }
  .wb-ap .hd,
  .wfb-task,
  .wfb-entry {
    flex-wrap: wrap;
  }
  .wb-ap .amt,
  .wb-ap.done .done-tag,
  .wfb-entry b,
  .wfb-task em {
    white-space: normal;
  }
  .wb-ap.done .done-tag {
    margin-left: 0;
  }
  /* 长单号 / 长计划 ID 在窄口必须可断行，否则 min-content 会把主面顶出视口 */
  .wfb-nav-item,
  .wfb-task b,
  .act24-tag,
  .act24-hd b {
    overflow-wrap: anywhere;
  }
}
</style>
