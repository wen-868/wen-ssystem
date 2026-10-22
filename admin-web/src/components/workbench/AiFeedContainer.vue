<template>
  <section class="afc" aria-label="AI 数字员工主交互面">
    <header class="afc-head">
      <h2 class="afc-title">{{ title }}</h2>
      <span class="afc-badge">AI 数字员工</span>
      <span class="afc-session" :data-session-state="sessionState">{{ sessionLabel }}</span>
    </header>

    <div class="afc-grid">
      <!-- 快捷经营指令：真实动作 = 复用现有对话 POST /api/chat（能力 ai-05 PARTIAL） -->
      <section class="afc-card">
        <h3 class="afc-card-title">快捷经营指令</h3>
        <p class="afc-card-sub">指令直接发起真实对话；底座无指令注册端点，状态为「部分接入」。</p>
        <div class="afc-commands">
          <button
            v-for="command in quickCommands"
            :key="command.label"
            type="button"
            class="afc-command"
            :data-capability-id="command.capabilityId"
            @click="emit('command', command.prompt)"
          >
            {{ command.label }}
          </button>
        </div>
      </section>

      <!-- Agent 运行状态：只展示真实会话状态与能力台账汇总，不展示虚构进度 -->
      <section class="afc-card">
        <h3 class="afc-card-title">Agent 运行状态</h3>
        <dl class="afc-status">
          <dt>会话通道</dt>
          <dd :data-session-state="sessionState">{{ sessionLabel }}</dd>
          <dt>能力台账</dt>
          <dd>{{ summary }}</dd>
          <dt>Agent 任务通道</dt>
          <dd>未接入（{{ agentTaskStatus }}）：本骨架不展示虚构进度</dd>
        </dl>
        <button type="button" class="afc-link" @click="emit('new-conversation')">新对话</button>
      </section>

      <!-- AI 信息流：本体未接入，只列真实业务入口，不造数据 -->
      <section class="afc-card afc-card-wide">
        <h3 class="afc-card-title">AI 信息流</h3>
        <div class="afc-placeholder">
          <p class="afc-placeholder-title">AI 信息流本体未接入（{{ infoFeedStatus }}）</p>
          <p class="afc-placeholder-desc">
            晨报、待办与异常播报需要底座 feed／晨报端点，本骨架不展示任何模拟数据；下方仅列当前角色可见的真实业务入口。
          </p>
        </div>
        <div v-if="items.length > 0" class="afc-items">
          <p class="afc-items-title">当前角色可见入口（{{ items.length }}）</p>
          <button
            v-for="entry in items"
            :key="entry.menuCode"
            type="button"
            class="afc-item"
            :data-menu-code="entry.menuCode"
            @click="emit('open', entry)"
          >
            <span class="afc-item-title">{{ entry.title }}</span>
            <span class="afc-item-hint">切人工并打开真实页面</span>
          </button>
        </div>
      </section>

      <!-- 能力台账：19 项逐条对账，PLANNED 一律禁用并展示缺失原因 -->
      <section class="afc-card afc-card-wide">
        <h3 class="afc-card-title">能力台账（{{ capabilities.length }}）</h3>
        <p class="afc-card-sub">状态与 P0 矩阵逐项一致；待建设项禁用，不伪造入口。</p>
        <ul class="afc-caps">
          <li
            v-for="capability in capabilities"
            :key="capability.id"
            class="afc-cap"
            :class="{ 'is-disabled': !isCapabilityEnabled(capability.status) }"
            :data-capability-id="capability.id"
            :data-status="capability.status"
            :title="capability.missingReason || capability.realAction"
          >
            <span class="afc-cap-status" :data-status="capability.status">
              {{ capabilityStatusLabel(capability.status) }}
            </span>
            <span class="afc-cap-title">{{ capability.title }}</span>
            <span class="afc-cap-action">{{ capability.missingReason || capability.realAction }}</span>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ManifestItem } from "../../shared/workbench/route-manifest";
import {
  CAPABILITIES,
  QUICK_COMMANDS,
  capabilityStatusLabel,
  capabilitySummary,
  getCapability,
  isCapabilityEnabled,
  type CapabilityEntry,
} from "../../shared/workbench/capability-registry";

const props = defineProps<{
  title: string;
  items: ManifestItem[];
  /** 右侧会话面板上报的真实状态（不臆造“在线”） */
  sessionState?: "idle" | "streaming" | "error";
  capabilities?: readonly CapabilityEntry[];
}>();

const emit = defineEmits<{
  (event: "open", entry: ManifestItem): void;
  (event: "command", prompt: string): void;
  (event: "new-conversation"): void;
}>();

// 说明：容器只展示能力台账与真实 manifest 可见入口，不伪造 AI 生成内容。
const capabilities = computed(() => props.capabilities ?? CAPABILITIES);
const quickCommands = QUICK_COMMANDS;
const summary = computed(() => capabilitySummary(capabilities.value));

const sessionLabel = computed(() => {
  switch (props.sessionState) {
    case "streaming":
      return "对话进行中";
    case "error":
      return "会话故障";
    default:
      return "待命";
  }
});

const agentTaskStatus = computed(() => getCapability("ai-06")?.status ?? "PLANNED");
const infoFeedStatus = computed(() => getCapability("ai-03")?.status ?? "PLANNED");
</script>

<style scoped>
.afc {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  padding: 20px 24px;
  background: var(--bg-soft, #f7f8fa);
}

.afc-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.afc-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.afc-badge {
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--color-primary-soft, rgba(63, 111, 239, 0.16));
  color: var(--color-primary, #3f6fef);
  font-size: 11px;
}

.afc-session {
  padding: 1px 8px;
  border-radius: 10px;
  border: 1px solid var(--border-light, #e5e7eb);
  background: var(--gray-0, #fff);
  font-size: 11px;
  color: #595959;
}

.afc-session[data-session-state="error"] {
  border-color: #f0c2c2;
  background: #fdf2f2;
  color: #b42318;
}

.afc-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.afc-card {
  padding: 14px 16px;
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 10px;
  background: var(--gray-0, #fff);
}

.afc-card-wide {
  grid-column: 1 / -1;
}

.afc-card-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.afc-card-sub {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #595959;
}

.afc-commands {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.afc-command {
  padding: 6px 12px;
  border: 1px solid var(--border-normal, #c9ced6);
  border-radius: 6px;
  background: var(--gray-0, #fff);
  font-size: 13px;
  color: #595959;
  cursor: pointer;
}

.afc-command:hover {
  border-color: var(--color-primary, #3f6fef);
  color: var(--color-primary, #3f6fef);
}

.afc-status {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 6px 10px;
  margin: 0 0 10px;
  font-size: 12px;
}

.afc-status dt {
  color: #8c8c8c;
}

.afc-status dd {
  margin: 0;
  color: var(--text-primary, #1f2937);
}

.afc-status dd[data-session-state="error"] {
  color: #b42318;
}

.afc-link {
  padding: 4px 10px;
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 6px;
  background: var(--gray-0, #fff);
  font-size: 12px;
  color: #595959;
  cursor: pointer;
}

.afc-link:hover {
  border-color: var(--color-primary, #3f6fef);
  color: var(--color-primary, #3f6fef);
}

.afc-placeholder {
  padding: 12px 14px;
  border: 1px dashed var(--border-normal, #c9ced6);
  border-radius: 8px;
  background: var(--bg-soft, #f7f8fa);
  margin-bottom: 12px;
}

.afc-placeholder-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.afc-placeholder-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #595959;
}

.afc-items-title {
  margin: 0 0 8px;
  font-size: 12px;
  color: #595959;
}

.afc-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.afc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 8px;
  background: var(--gray-0, #fff);
  font-size: 13px;
  color: var(--text-primary, #1f2937);
  text-align: left;
  cursor: pointer;
}

.afc-item:hover {
  border-color: var(--color-primary, #3f6fef);
  color: var(--color-primary, #3f6fef);
}

.afc-item-hint,
.afc-cap-action {
  font-size: 11px;
  color: #8c8c8c;
}

.afc-caps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.afc-cap {
  display: grid;
  grid-template-columns: 72px minmax(140px, 220px) 1fr;
  gap: 10px;
  align-items: baseline;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary, #1f2937);
}

.afc-cap.is-disabled {
  opacity: 0.55;
  background: var(--bg-soft, #f7f8fa);
}

.afc-cap-status {
  text-align: center;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 11px;
  background: #f2f3f5;
  color: #595959;
}

.afc-cap-status[data-status="LIVE"] {
  background: #e8f5e9;
  color: #1b5e20;
}

.afc-cap-status[data-status="PARTIAL"] {
  background: #fff7e6;
  color: #ad6800;
}

.afc-cap-status[data-status="PLANNED"] {
  background: #f2f3f5;
  color: #8c8c8c;
}

.afc-cap-status[data-status="BLOCKED"] {
  background: #fdf2f2;
  color: #b42318;
}
</style>
