<template>
  <el-dialog
    :model-value="modelValue"
    title="打印设置（本机）"
    width="640px"
    align-center
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="print-settings">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="本机打印配置"
        description="打印机、纸张、份数等配置保存在当前终端（浏览器/电脑），不随账号同步；模板内容在系统设置中统一管理。"
        class="settings-tip"
      />

      <el-divider content-position="left">打印通道</el-divider>
      <el-form label-width="130px" label-position="left">
        <el-form-item label="本地打印助手">
          <el-switch v-model="form.useLocalAgent" @change="handleAgentToggle" />
          <span class="field-hint">开启后由本机打印助手直出（热敏小票/针式/标签推荐）</span>
        </el-form-item>
        <el-form-item v-if="form.useLocalAgent" label="助手地址">
          <el-input v-model="form.agentBaseUrl" style="width: 260px" placeholder="http://127.0.0.1:5178" />
          <el-button class="ml8" :loading="agentLoading" @click="handleDetectAgent">检测</el-button>
        </el-form-item>
        <el-form-item v-if="form.useLocalAgent && printers.length > 0" label="默认打印机">
          <el-select v-model="form.printerName" placeholder="选择本机打印机" style="width: 300px" clearable>
            <el-option
              v-for="p in printers"
              :key="p.name"
              :label="p.name"
              :value="p.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.useLocalAgent && printers.length === 0 && agentChecked" label="默认打印机">
          <el-input v-model="form.printerName" placeholder="手动输入打印机名称（留空=系统默认）" style="width: 300px" />
        </el-form-item>
      </el-form>

      <el-divider content-position="left">纸张与份数</el-divider>
      <el-form label-width="130px" label-position="left">
        <el-form-item label="默认纸张">
          <el-select v-model="form.paperType" style="width: 240px">
            <el-option
              v-for="(label, value) in paperTypeLabels"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="默认份数">
          <el-input-number v-model="form.copies" :min="1" :max="99" />
        </el-form-item>
        <el-form-item label="结算自动打印">
          <el-switch v-model="form.autoPrint" />
          <span class="field-hint">收银结算成功后自动打印小票</span>
        </el-form-item>
        <el-form-item v-if="form.paperType === 'LABEL_CUSTOM'" label="标签尺寸(mm)">
          <el-input-number v-model="form.labelWidth" :min="10" :max="300" /> ×
          <el-input-number v-model="form.labelHeight" :min="10" :max="300" />
        </el-form-item>
      </el-form>

      <el-divider content-position="left">抬头与页脚</el-divider>
      <el-form label-width="130px" label-position="left">
        <el-form-item label="小票抬头店名">
          <el-input v-model="form.headerName" style="width: 300px" maxlength="40" />
        </el-form-item>
        <el-form-item label="抬头电话">
          <el-input v-model="form.headerPhone" style="width: 300px" maxlength="30" />
        </el-form-item>
        <el-form-item label="抬头地址">
          <el-input v-model="form.headerAddress" style="width: 300px" maxlength="80" />
        </el-form-item>
        <el-form-item label="页脚文案">
          <el-input v-model="form.footerText" style="width: 300px" maxlength="100" />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="handleReset">恢复默认</el-button>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  DEFAULT_LOCAL_PRINT_CONFIG,
  getLocalPrintConfig,
  resetLocalPrintConfig,
  saveLocalPrintConfig,
  PAPER_TYPE_LABELS,
} from "./localConfig";
import { detectLocalAgent, listLocalPrinters } from "./printClient";
import type { LocalAgentPrinter, LocalPrintConfig } from "./types";

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "saved", config: LocalPrintConfig): void;
}>();

const paperTypeLabels = PAPER_TYPE_LABELS;
const form = reactive<LocalPrintConfig>({ ...getLocalPrintConfig() });
const printers = ref<LocalAgentPrinter[]>([]);
const agentLoading = ref(false);
const agentChecked = ref(false);

async function handleDetectAgent() {
  agentLoading.value = true;
  agentChecked.value = false;
  const ok = await detectLocalAgent(form.agentBaseUrl);
  if (ok) {
    printers.value = await listLocalPrinters(form.agentBaseUrl);
    agentChecked.value = true;
    ElMessage.success(`打印助手已连接，检测到 ${printers.value.length} 台打印机`);
  } else {
    printers.value = [];
    agentChecked.value = true;
    ElMessage.warning("未检测到本地打印助手，请确认助手已启动或检查地址");
  }
  agentLoading.value = false;
}

async function handleAgentToggle(value: boolean) {
  if (!value) return;
  await handleDetectAgent();
}

function handleSave() {
  saveLocalPrintConfig({ ...form });
  ElMessage.success("本机打印配置已保存");
  emit("saved", { ...form });
  emit("update:modelValue", false);
}

function handleReset() {
  const def = resetLocalPrintConfig();
  Object.assign(form, def);
  printers.value = [];
  agentChecked.value = false;
  ElMessage.success("已恢复默认配置");
}

onMounted(() => {
  Object.assign(form, getLocalPrintConfig());
  if (form.useLocalAgent && !form.printerName) {
    handleDetectAgent();
  }
});
</script>

<style scoped>
.print-settings {
  padding: 4px 8px;
}
.settings-tip {
  margin-bottom: 4px;
}
.field-hint {
  margin-left: 10px;
  font-size: 12px;
  color: var(--text-secondary, #888);
}
.ml8 {
  margin-left: 8px;
}
</style>
