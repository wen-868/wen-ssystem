<template>
  <div class="ai-message" :class="[`is-${message.role}`, `kind-${message.kind}`]">
    <!-- 用户消息 -->
    <div v-if="message.role === 'user'" class="bubble user-bubble">
      {{ message.content }}
    </div>

    <!-- AI 文本回复（SSE 流式增量累积） -->
    <div v-else-if="message.kind === 'text'" class="bubble ai-bubble">
      <div v-if="!message.content" class="thinking">
        <span class="dot" />
        正在思考...
      </div>
      <div v-else class="ai-text">
        <template v-for="(seg, i) in contentSegments" :key="i">
          <span v-if="seg.type === 'text'" class="ai-text-seg">{{ seg.value }}</span>
          <AiChart v-else-if="seg.type === 'chart'" :content="seg.value" />
        </template>
        <el-button
          v-if="canSpeak"
          class="ai-speak-btn"
          size="small"
          text
          :icon="speaking ? 'Loading' : 'Bell'"
          @click="toggleSpeak"
        >
          {{ speaking ? "停止播报" : "播报" }}
        </el-button>
      </div>
    </div>

    <!-- AI 主动推送卡片（巡检预警/每日简报等） -->
    <div v-else-if="message.kind === 'proactive'" class="proactive-card">
      <div class="proactive-head">
        <el-icon class="proactive-icon"><Bell /></el-icon>
        <span class="proactive-title">{{ message.title || "AI 主动提醒" }}</span>
        <el-tag
          v-if="message.priority"
          :type="priorityTagType(message.priority)"
          size="small"
          effect="light"
        >
          {{ priorityLabel(message.priority) }}
        </el-tag>
      </div>
      <div class="proactive-content">{{ message.content }}</div>
    </div>

    <!-- 工具调用 / 写操作预览 -->
    <div v-else-if="message.kind === 'tool' || message.kind === 'preview'" class="tool-card">
      <div class="tool-head">
        <el-icon class="tool-icon" :class="`status-${message.toolStatus || 'running'}`">
          <Loading v-if="message.toolStatus === 'running'" class="is-loading" />
          <CircleCheck v-else-if="message.toolStatus === 'success'" />
          <CircleClose v-else />
        </el-icon>
        <span class="tool-name">{{ toolLabel(message.tool) }}</span>
        <el-tag :type="tagType(message.toolStatus)" size="small" effect="light">
          {{ tagText(message.toolStatus) }}
        </el-tag>
      </div>

      <AiPreviewCard
        v-if="message.preview"
        :preview="message.preview"
        :confirmation-id="message.confirmationId"
        :operation-id="message.operationId"
        :pending="message.pending"
        :cancelled="message.cancelled"
        :revoked="message.revoked"
        @confirm="emit('confirm', message.id, $event)"
        @cancel="emit('cancel', message.id, $event)"
        @revoke="emit('revoke', message.id, $event)"
      />

      <!-- 工具执行成功且无预览时的摘要 -->
      <div v-else-if="message.toolStatus === 'success' && toolSummary(message)" class="tool-summary">
        {{ toolSummary(message) }}
      </div>

      <!-- 工具执行失败 -->
      <div v-else-if="message.toolStatus === 'error'" class="tool-error">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ message.error || "工具执行失败" }}</span>
      </div>
    </div>

    <!-- 错误消息 -->
    <div v-else class="bubble error-bubble">
      <el-icon><WarningFilled /></el-icon>
      <span>{{ message.error || "发生未知错误" }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loading, CircleCheck, CircleClose, WarningFilled, Bell } from "@element-plus/icons-vue";
import { computed, onBeforeUnmount, ref } from "vue";
import AiPreviewCard from "./AiPreviewCard.vue";
import AiChart from "./AiChart.vue";
import type { AiChatMessage } from "./types";

const props = defineProps<{ message: AiChatMessage }>();

const emit = defineEmits<{
  (e: "confirm", messageId: string, confirmationId: string): void;
  (e: "cancel", messageId: string, confirmationId: string): void;
  (e: "revoke", messageId: string, operationId: string): void;
}>();

/** 将 AI 文本拆分为普通文本段与图表段（[CHART] 标记） */
const contentSegments = computed(() => {
  const content = props.message.content ?? "";
  const segments: Array<{ type: "text" | "chart"; value: string }> = [];
  const re = /\[CHART\][\s\S]*?\[\/CHART\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", value: content.slice(last, match.index) });
    }
    segments.push({ type: "chart", value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < content.length) {
    segments.push({ type: "text", value: content.slice(last) });
  }
  return segments.length > 0 ? segments : [{ type: "text", value: content }];
});

/** 语音播报（浏览器 speechSynthesis，中文） */
const speaking = ref(false);
const canSpeak =
  typeof window !== "undefined" && "speechSynthesis" in window;

function toggleSpeak() {
  if (!canSpeak) return;
  if (speaking.value) {
    window.speechSynthesis.cancel();
    speaking.value = false;
    return;
  }
  const text = (props.message.content ?? "")
    .replace(/\[CHART\][\s\S]*?\[\/CHART\]/g, "")
    .slice(0, 500);
  if (!text.trim()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.onend = () => {
    speaking.value = false;
  };
  utterance.onerror = () => {
    speaking.value = false;
  };
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  speaking.value = true;
}

onBeforeUnmount(() => {
  if (canSpeak) window.speechSynthesis.cancel();
});

/** 工具名 → 中文展示（未知工具名回退原样） */
function toolLabel(tool?: string): string {
  const map: Record<string, string> = {
    createSalesOrder: "创建销售单",
    querySaleBills: "查询销售单",
    cancelOrder: "取消销售单",
    searchProduct: "搜索商品",
    queryProductDetail: "查询商品详情",
    updateProductPrice: "更新商品价格",
    searchCustomer: "搜索客户",
    queryCustomerDetail: "查询客户详情",
    createCustomer: "创建客户",
    queryInventory: "查询库存",
    checkInventory: "库存校验",
    inventoryTransfer: "库存调拨",
    stockCheck: "库存盘点",
    createPurchaseOrder: "创建采购单",
    queryPurchaseOrders: "查询采购单",
    createDelivery: "创建配送任务",
    queryDeliveryStatus: "查询配送状态",
    queryReceivables: "查询应收",
    queryPayables: "查询应付",
    createSalesReturn: "创建销售退货",
    createRefund: "创建退款",
    createPaymentReconciliation: "付款对账",
    salesReport: "销售报表",
    inventoryReport: "库存报表",
    profitReport: "利润报表",
  };
  return map[tool || ""] || tool || "工具调用";
}

function tagType(status?: string): "success" | "warning" | "danger" | "info" {
  if (status === "success") return "success";
  if (status === "error") return "danger";
  return "warning";
}

function tagText(status?: string): string {
  if (status === "success") return "执行成功";
  if (status === "error") return "执行失败";
  return "执行中";
}

/** 推送优先级 → 中文标签 */
function priorityLabel(priority: string): string {
  const map: Record<string, string> = {
    urgent: "紧急",
    important: "重要",
    reminder: "提醒",
    suggestion: "建议",
  };
  return map[priority] || "通知";
}

/** 推送优先级 → 标签颜色 */
function priorityTagType(priority: string): "danger" | "warning" | "info" | "primary" {
  if (priority === "urgent") return "danger";
  if (priority === "important") return "warning";
  if (priority === "suggestion") return "info";
  return "primary";
}

/** 工具返回数据的摘要文本（成功且无预览时展示） */
function toolSummary(message: AiChatMessage): string {
  if (message.preview) return "";
  const data = message.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const list = Array.isArray(obj.list)
      ? (obj.list as unknown[])
      : Array.isArray(obj.records)
        ? (obj.records as unknown[])
        : null;
    // 空结果：直接展示工具自带的可读提示（如"未找到匹配...的客户/商品"）
    if (list && list.length === 0 && typeof obj.message === "string" && obj.message) {
      return obj.message;
    }
    // 有结果：展示数量，避免堆原始 JSON
    if (list && list.length > 0) {
      const total = typeof obj.total === "number" ? obj.total : list.length;
      return `查询到 ${list.length} 条结果${total !== list.length ? `（共 ${total} 条）` : ""}`;
    }
    if (typeof obj.message === "string" && obj.message) return obj.message;
    try {
      const text = JSON.stringify(data);
      return text.length > 200 ? `${text.slice(0, 200)}...` : text;
    } catch {
      return String(data);
    }
  }
  return "";
}
</script>

<style scoped>
.ai-message {
  display: flex;
}

.ai-message.is-user {
  justify-content: flex-end;
}

.ai-message.is-assistant {
  justify-content: flex-start;
}

.bubble {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  white-space: pre-wrap;
  word-break: break-word;
}

.user-bubble {
  background: var(--color-primary);
  color: var(--text-inverse);
  border-top-right-radius: 4px;
}

.ai-bubble {
  background: var(--gray-100);
  color: var(--text-primary);
  border-top-left-radius: 4px;
}

.ai-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.proactive-card {
  max-width: 85%;
  border: 1px solid var(--color-primary-soft, #dbeafe);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-md);
  background: var(--gray-50, #f9fafb);
  overflow: hidden;
}

.proactive-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--gray-100);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.proactive-icon {
  color: var(--color-primary);
  font-size: 14px;
}

.proactive-title {
  flex: 1;
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.proactive-content {
  padding: 8px 10px;
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--text-secondary, #374151);
  white-space: pre-wrap;
  word-break: break-word;
}

.thinking {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: dotPulse 1.2s ease-in-out infinite;
}

@keyframes dotPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.error-bubble {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  display: flex;
  align-items: flex-start;
  gap: 6px;
  max-width: 100%;
}

.tool-card {
  width: 100%;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  padding: 8px 10px;
}

.tool-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-icon {
  font-size: 15px;
}

.tool-icon.status-running { color: var(--color-warning); }
.tool-icon.status-success { color: var(--color-success); }
.tool-icon.status-error { color: var(--color-danger); }

.tool-icon.is-loading {
  animation: rotating 1.2s linear infinite;
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tool-name {
  flex: 1;
  font-size: var(--text-base);
  color: var(--text-primary);
}

.tool-summary {
  margin-top: 6px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-normal);
  word-break: break-all;
}

.tool-error {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-sm);
  color: var(--color-danger);
}
</style>
