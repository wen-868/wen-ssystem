<template>
  <div class="aep">
    <button
      type="button"
      class="aep-btn"
      :disabled="disabled"
      data-testid="employee-picker"
      aria-label="选择当前对话的数字员工"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ employee?.name || "总负责人" }}
    </button>
    <div v-if="open" class="aep-menu" data-testid="employee-picker-menu">
      <button type="button" class="aep-item" @click="choose('__supervisor')">
        <strong>总负责人</strong><small>系统调度角色</small>
      </button>
      <template v-for="group in groups" :key="group.name">
        <p class="aep-group">{{ group.name }}</p>
        <button
          v-for="staff in group.staffs"
          :key="staff.employeeUid"
          type="button"
          class="aep-item"
          @click="choose(staff.employeeUid || '__supervisor')"
        >
          <strong>{{ staff.name }}</strong><small>{{ staff.post }}</small>
        </button>
      </template>
      <p v-if="groups.length === 0" class="aep-empty">暂无真实数字员工</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { ActiveAiEmployee, DirectoryGroup } from "../../shared/workbench/agent-directory";

withDefaults(
  defineProps<{
    employee?: ActiveAiEmployee | null;
    groups?: readonly DirectoryGroup[];
    disabled?: boolean;
  }>(),
  { groups: () => [] },
);

const emit = defineEmits<{ (event: "change", employeeUid: string): void }>();
const open = ref(false);

function choose(employeeUid: string): void {
  open.value = false;
  emit("change", employeeUid || "__supervisor");
}
</script>

<style scoped>
.aep {
  position: relative;
  margin-left: 8px;
}
.aep-btn {
  border: 0;
  background: transparent;
  color: var(--wb-ink2, #6b7280);
  font-size: 12px;
  line-height: 28px;
  padding: 0 6px;
  cursor: pointer;
}
.aep-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.aep-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  width: 220px;
  max-height: 280px;
  overflow: auto;
  padding: 6px;
  border: 1px solid var(--wb-line, #e5e7eb);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  z-index: 30;
}
.aep-group {
  margin: 8px 8px 4px;
  font-size: 11px;
  color: #98a2b3;
}
.aep-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.aep-item:hover {
  background: #f3f4f6;
}
.aep-item small,
.aep-empty {
  font-size: 11px;
  color: #98a2b3;
}
.aep-empty {
  margin: 8px;
}
</style>
