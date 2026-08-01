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
      <div v-else class="ai-text">{{ message.content }}</div>
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
import { Loading, CircleCheck, CircleClose, WarningFilled } from "@element-plus/icons-vue";
import AiPreviewCard from "./AiPreviewCard.vue";
import type { AiChatMessage } from "./types";

const props = defineProps<{ message: AiChatMessage }>();

const emit = defineEmits<{
  (e: "confirm", messageId: string, confirmationId: string): void;
  (e: "cancel", messageId: string, confirmationId: string): void;
  (e: "revoke", messageId: string, operationId: string): void;
}>();

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

/** 工具返回数据的摘要文本（成功且无预览时展示） */
function toolSummary(message: AiChatMessage): string {
  if (message.preview) return "";
  if (typeof message.data === "string") return message.data;
  if (message.data && typeof message.data === "object") {
    try {
      const text = JSON.stringify(message.data);
      return text.length > 200 ? `${text.slice(0, 200)}...` : text;
    } catch {
      return String(message.data);
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
