<template>
  <div class="ai-preview-card">
    <div class="preview-head">
      <span class="preview-title">{{ preview.operation || "写操作预览" }}</span>
      <el-tag size="small" type="warning" effect="light">待确认</el-tag>
    </div>

    <div v-if="preview.summary" class="preview-summary">{{ preview.summary }}</div>

    <div class="preview-details">
      <div v-for="(value, key) in preview.details" :key="key" class="detail-row">
        <span class="detail-label">{{ key }}</span>
        <span class="detail-value">{{ formatValue(value) }}</span>
      </div>
    </div>

    <div class="preview-actions">
      <template v-if="state === 'confirm' || state === 'executing'">
        <el-button
          type="primary"
          size="small"
          :loading="state === 'executing'"
          @click="emitConfirm"
        >
          确认执行
        </el-button>
        <el-button size="small" :disabled="state === 'executing'" @click="emitCancel">
          取消
        </el-button>
      </template>

      <template v-else-if="state === 'executed' || state === 'revoking'">
        <el-tag size="small" type="success" effect="light">已执行</el-tag>
        <el-button size="small" :loading="state === 'revoking'" @click="emitRevoke">
          撤销（3分钟内）
        </el-button>
      </template>

      <el-tag v-else-if="state === 'cancelled'" size="small" type="info" effect="light">已取消</el-tag>
      <el-tag v-else-if="state === 'revoked'" size="small" type="info" effect="light">已撤销</el-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AiPreviewPayload } from "../../api/ai";

const props = defineProps<{
  preview: AiPreviewPayload;
  confirmationId?: string;
  operationId?: string;
  /** 执行中标记（确认 / 撤销进行时按钮置 loading） */
  pending?: boolean;
  cancelled?: boolean;
  revoked?: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm", confirmationId: string): void;
  (e: "cancel", confirmationId: string): void;
  (e: "revoke", operationId: string): void;
}>();

type PreviewState = "confirm" | "executing" | "revoking" | "executed" | "cancelled" | "revoked";

/** 预览卡片当前状态机：由父组件更新的消息字段驱动 */
const state = computed<PreviewState>(() => {
  if (props.revoked) return "revoked";
  if (props.cancelled) return "cancelled";
  if (props.operationId) return props.pending ? "revoking" : "executed";
  return props.pending ? "executing" : "confirm";
});

/** 格式化预览明细值：标量直接展示，对象 / 数组转为紧凑 JSON */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function emitConfirm(): void {
  if (props.confirmationId) emit("confirm", props.confirmationId);
}

function emitCancel(): void {
  if (props.confirmationId) emit("cancel", props.confirmationId);
}

function emitRevoke(): void {
  if (props.operationId) emit("revoke", props.operationId);
}
</script>

<style scoped>
.ai-preview-card {
  margin-top: 8px;
  border: 1px solid var(--border-normal);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  padding: 10px 12px;
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.preview-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.preview-summary {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-normal);
  background: var(--bg-soft);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  margin-bottom: 6px;
}

.preview-details {
  border-top: 1px solid var(--border-light);
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 4px 0;
  font-size: var(--text-sm);
}

.detail-label {
  flex-shrink: 0;
  color: var(--text-muted);
  min-width: 72px;
}

.detail-value {
  color: var(--text-primary);
  word-break: break-all;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-light);
}
</style>
