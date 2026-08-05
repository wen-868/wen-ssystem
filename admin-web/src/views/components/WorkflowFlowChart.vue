<template>
  <div class="workflow-flow-chart">
    <div v-if="!levels || levels.length === 0" class="empty-chart">
      <el-empty description="暂无审核节点" :image-size="60" />
    </div>
    <div v-else class="flow-container">
      <!-- 起点节点 -->
      <div class="flow-node start-node">
        <div class="node-icon start-icon">
          <el-icon :size="20"><VideoPlay /></el-icon>
        </div>
        <div class="node-label">开始</div>
      </div>

      <!-- 箭头 -->
      <div class="flow-arrow">
        <el-icon :size="16" class="arrow-icon"><Right /></el-icon>
      </div>

      <!-- 审核节点 + 箭头 -->
      <template v-for="(level, index) in levels" :key="index">
        <div
          class="flow-node approval-node"
          :class="{
            'is-current': currentLevel === index,
            'is-approved': approvedLevels?.includes(index),
            'is-rejected': rejectedLevel === index
          }"
          @mouseenter="hoverIndex = index"
          @mouseleave="hoverIndex = -1"
        >
          <div class="node-icon" :class="getNodeIconClass(index)">
            <el-icon :size="20">
              <component :is="getNodeIcon(index)" />
            </el-icon>
          </div>
          <div class="node-label">{{ level.name }}</div>
          <div class="node-sub">{{ getRoleLabel(level.role) }}</div>

          <!-- 悬浮详情 -->
          <div v-if="hoverIndex === index" class="node-tooltip">
            <div class="tooltip-title">{{ level.name }}</div>
            <div class="tooltip-row">
              <span class="tooltip-label">审核角色：</span>
              <span class="tooltip-value">{{ getRoleLabel(level.role) }}</span>
            </div>
            <div v-if="level.approverName" class="tooltip-row">
              <span class="tooltip-label">指定审核人：</span>
              <span class="tooltip-value">{{ level.approverName }}</span>
            </div>
            <div class="tooltip-row">
              <span class="tooltip-label">审核时限：</span>
              <span class="tooltip-value">{{ level.timeLimitHours || 24 }}小时</span>
            </div>
            <div v-if="approvedLevels?.includes(index)" class="tooltip-row">
              <span class="tooltip-label">审核状态：</span>
              <span class="tooltip-value" style="color: #0EA879">已通过</span>
            </div>
            <div v-else-if="rejectedLevel === index" class="tooltip-row">
              <span class="tooltip-label">审核状态：</span>
              <span class="tooltip-value" style="color: #C0392B">已驳回</span>
            </div>
            <div v-else-if="currentLevel === index" class="tooltip-row">
              <span class="tooltip-label">审核状态：</span>
              <span class="tooltip-value" style="color: #D48B3A">待审核</span>
            </div>
          </div>
        </div>

        <div v-if="index < levels.length - 1" class="flow-arrow">
          <el-icon :size="16" class="arrow-icon"><Right /></el-icon>
        </div>
      </template>

      <!-- 箭头 -->
      <div class="flow-arrow">
        <el-icon :size="16" class="arrow-icon"><Right /></el-icon>
      </div>

      <!-- 终点节点 -->
      <div class="flow-node end-node" :class="{ 'is-approved': allApproved }">
        <div class="node-icon end-icon">
          <el-icon :size="20"><CircleCheck /></el-icon>
        </div>
        <div class="node-label">完成</div>
      </div>
    </div>

    <!-- 图例 -->
    <div v-if="showLegend" class="flow-legend">
      <div class="legend-item">
        <span class="legend-dot current"></span>
        <span>当前节点</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot approved"></span>
        <span>已通过</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot pending"></span>
        <span>待审核</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot rejected"></span>
        <span>已驳回</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Right, VideoPlay, CircleCheck, Clock, Check, Close } from "@element-plus/icons-vue";

interface Props {
  levels?: Array<{
    name: string;
    role: string;
    approverId?: number | null;
    approverName?: string;
    timeLimitHours?: number;
  }>;
  /** 当前审核级次（0开始），-1表示未开始或只展示流程 */
  currentLevel?: number;
  /** 已通过的级次索引数组 */
  approvedLevels?: number[];
  /** 被驳回的级次 */
  rejectedLevel?: number;
  /** 是否显示图例 */
  showLegend?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  levels: () => [],
  currentLevel: -1,
  approvedLevels: () => [],
  rejectedLevel: -1,
  showLegend: true
});

const hoverIndex = ref(-1);

const roleMap: Record<string, string> = {
  BOSS: "老板",
  MGR: "店长",
  FIN: "财务",
  STOCK: "库管",
  SALES: "业务员"
};

function getRoleLabel(role: string) {
  return roleMap[role] || role || "未设置";
}

const allApproved = computed(() => {
  if (!props.levels || props.levels.length === 0) return false;
  return props.approvedLevels.length === props.levels.length;
});

function getNodeIcon(index: number) {
  if (props.approvedLevels.includes(index)) return Check;
  if (props.rejectedLevel === index) return Close;
  if (props.currentLevel === index) return Clock;
  return Clock;
}

function getNodeIconClass(index: number) {
  if (props.approvedLevels.includes(index)) return "approved-icon";
  if (props.rejectedLevel === index) return "rejected-icon";
  if (props.currentLevel === index) return "current-icon";
  return "pending-icon";
}
</script>

<style scoped>
.workflow-flow-chart {
  padding: 24px 16px;
  background: var(--gray-50);
  border-radius: 8px;
}

.empty-chart {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.flow-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 100px;
}

.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  padding: 12px 16px;
  background: #fff;
  border: 2px solid var(--gray-200);
  border-radius: 12px;
  min-width: 100px;
  cursor: pointer;
  transition: all 0.3s;
  z-index: 1;
}

.flow-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.node-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  color: #fff;
}

.start-icon {
  background: linear-gradient(135deg, var(--color-success), #85ce61);
}

.end-icon {
  background: linear-gradient(135deg, var(--gray-400), #a6a9ad);
}

.end-node.is-approved .end-icon {
  background: linear-gradient(135deg, var(--color-success), #85ce61);
}

.pending-icon {
  background: linear-gradient(135deg, var(--gray-400), #a6a9ad);
}

.current-icon {
  background: linear-gradient(135deg, var(--color-warning), #f0c36d);
  animation: pulse 2s infinite;
}

.approved-icon {
  background: linear-gradient(135deg, var(--color-success), #85ce61);
}

.rejected-icon {
  background: linear-gradient(135deg, var(--color-danger), #f78989);
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(230, 162, 60, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(230, 162, 60, 0);
  }
}

.node-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-700);
  margin-bottom: 2px;
}

.node-sub {
  font-size: 12px;
  color: var(--gray-400);
}

.approval-node.is-current {
  border-color: var(--color-warning);
  background: var(--color-warning-soft);
}

.approval-node.is-approved {
  border-color: var(--color-success);
  background: var(--color-success-soft);
}

.approval-node.is-rejected {
  border-color: var(--color-danger);
  background: #fef0f0;
}

.start-node {
  border-color: var(--color-success);
  background: var(--color-success-soft);
}

.end-node {
  border-color: var(--gray-400);
  background: #f4f4f5;
}

.end-node.is-approved {
  border-color: var(--color-success);
  background: var(--color-success-soft);
}

.flow-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  color: var(--gray-300);
}

.arrow-icon {
  color: var(--gray-300);
}

.node-tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--gray-700);
  color: #fff;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 100;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}

.node-tooltip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--gray-700);
}

.tooltip-title {
  font-weight: 500;
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 4px;
}

.tooltip-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.tooltip-label {
  color: var(--gray-300);
}

.tooltip-value {
  color: #fff;
}

.flow-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--gray-600);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-dot.current {
  background: var(--color-warning);
}

.legend-dot.approved {
  background: var(--color-success);
}

.legend-dot.pending {
  background: var(--gray-400);
}

.legend-dot.rejected {
  background: var(--color-danger);
}
</style>
