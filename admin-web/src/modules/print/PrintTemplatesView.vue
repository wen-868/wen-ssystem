<template>
  <div class="print-templates-view">
    <div class="page-header">
      <div>
        <h2 class="page-title">打印模板</h2>
        <p class="page-desc">小票 / 针式 / A4 / 标签模板统一管理，打印机与纸张等设备配置在本机打印设置中完成</p>
      </div>
      <div class="page-header-actions">
        <el-button :icon="Printer" @click="settingsVisible = true">本机打印设置</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建模板</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <div class="toolbar">
        <el-select v-model="filterBillType" placeholder="单据类型" clearable style="width: 180px" @change="loadTemplates">
          <el-option v-for="b in billTypes" :key="b.value" :label="b.label" :value="b.value" />
        </el-select>
        <el-select v-model="filterPaperType" placeholder="纸张类型" clearable style="width: 220px" @change="loadTemplates">
          <el-option v-for="p in paperTypes" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
        <el-button :icon="Refresh" @click="loadTemplates">刷新</el-button>
      </div>

      <el-table v-loading="loading" :data="templates" border stripe>
        <el-table-column prop="billType" label="单据类型" width="130">
          <template #default="{ row }">{{ billTypeLabel(row.billType) }}</template>
        </el-table-column>
        <el-table-column prop="templateName" label="模板名称" min-width="160" />
        <el-table-column prop="paperType" label="纸张类型" width="200">
          <template #default="{ row }">{{ paperTypeLabel(row.paperType) }}</template>
        </el-table-column>
        <el-table-column prop="isDefault" label="类型" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault === 1" size="small" type="success">默认启用</el-tag>
            <el-tag v-else size="small" type="info">普通</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="70" align="center" />
        <el-table-column prop="updatedAt" label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button size="small" link @click="handleDuplicate(row)">复制</el-button>
            <el-button size="small" link @click="handlePreview(row)">预览</el-button>
            <el-button v-if="row.isDefault !== 1" size="small" link @click="handleSetDefault(row)">设为默认</el-button>
            <el-button size="small" link :disabled="row.isDefault === 1" @click="handleReset(row)">重置</el-button>
            <el-button size="small" type="danger" link :disabled="row.isDefault === 1" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建模板（选择单据类型/纸张/名称后进入全屏设计器） -->
    <el-dialog
      v-model="createVisible"
      title="新建打印模板"
      width="520px"
      align-center
    >
      <el-form label-width="90px" label-position="left">
        <el-form-item label="单据类型" required>
          <el-select v-model="createForm.billType" style="width: 100%" @change="onBillTypeChange">
            <el-option v-for="b in billTypes" :key="b.value" :label="b.label" :value="b.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="纸张类型" required>
          <el-select v-model="createForm.paperType" style="width: 100%">
            <el-option v-for="p in paperTypes" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="模板名称">
          <el-input v-model="createForm.templateName" maxlength="64" placeholder="留空自动命名，如：销售单（默认）" />
        </el-form-item>
        <div class="create-tip">创建后将进入全屏设计器，已按所选单据类型生成完整默认版式，可直接修改使用</div>
      </el-form>

      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCreate">进入设计器</el-button>
      </template>
    </el-dialog>

    <!-- 本机打印设置 -->
    <PrintSettingsPanel v-model="settingsVisible" @saved="onLocalSettingsSaved" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Printer, Refresh } from "@element-plus/icons-vue";
import {
  createPrintTemplate,
  deletePrintTemplate,
  fetchPrintTemplate,
  fetchPrintMeta,
  fetchPrintTemplates,
  resetPrintTemplate,
  setDefaultPrintTemplate,
} from "./api";
import { PAPER_TYPE_LABELS } from "./localConfig";
import { fillPrintWindow, openPrintWindow, renderAnyTemplate } from "./printClient";
import { sampleVars } from "./sampleVars";
import { BILL_TYPE_LABELS } from "./variables";
import PrintSettingsPanel from "./PrintSettingsPanel.vue";
import type { PrintBillType, PrintPaperType, PrintTemplate } from "./types";

const router = useRouter();

const loading = ref(false);
const templates = ref<PrintTemplate[]>([]);
const billTypes = ref<Array<{ value: string; label: string }>>([]);
const paperTypes = ref<Array<{ value: string; label: string }>>([]);
const filterBillType = ref("");
const filterPaperType = ref("");
const settingsVisible = ref(false);
const createVisible = ref(false);

const createForm = reactive({
  billType: "SALE_BILL" as string,
  paperType: "A4" as string,
  templateName: "",
});

function billTypeLabel(value: string): string {
  return (BILL_TYPE_LABELS as Record<string, string>)[value] ?? value;
}

function paperTypeLabel(value: string): string {
  return (PAPER_TYPE_LABELS as Record<string, string>)[value] ?? value;
}

function formatTime(value: string): string {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 19);
}

async function loadMeta() {
  try {
    const meta = await fetchPrintMeta();
    billTypes.value = meta.billTypes;
    paperTypes.value = meta.paperTypes;
  } catch {
    ElMessage.warning("打印枚举加载失败，请确认后端已部署打印模块");
  }
}

async function loadTemplates() {
  loading.value = true;
  try {
    templates.value = await fetchPrintTemplates({
      billType: filterBillType.value || undefined,
      paperType: filterPaperType.value || undefined,
    });
  } catch (e) {
    ElMessage.error(`模板加载失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  Object.assign(createForm, {
    billType: "SALE_BILL",
    paperType: "A4",
    templateName: "",
  });
  createVisible.value = true;
}

function openEdit(row: PrintTemplate) {
  router.push(`/system/print/designer/${row.id}`);
}

function onBillTypeChange(value: string) {
  if (value === "LABEL") createForm.paperType = "LABEL_60X40";
  else if (value === "SALE_RECEIPT" || value === "SHIFT" || value === "DAILY_SETTLE") createForm.paperType = "RECEIPT_80";
  else createForm.paperType = "A4";
}

function confirmCreate() {
  if (!createForm.billType || !createForm.paperType) {
    ElMessage.warning("请选择单据类型与纸张类型");
    return;
  }
  createVisible.value = false;
  const params = new URLSearchParams({
    billType: createForm.billType,
    paperType: createForm.paperType,
  });
  if (createForm.templateName.trim()) params.set("name", createForm.templateName.trim());
  router.push(`/system/print/designer?${params.toString()}`);
}

async function handleReset(row: PrintTemplate) {
  await ElMessageBox.confirm(`确定将「${row.templateName}」重置为系统默认模板？当前内容将被覆盖。`, "恢复默认", { type: "warning" });
  try {
    await resetPrintTemplate(row.id);
    ElMessage.success("已恢复系统默认模板");
    await loadTemplates();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : String(e));
  }
}

/** 复制模板（同单据类型快速新建，便于多版本并存） */
async function handleDuplicate(row: PrintTemplate) {
  try {
    const detail = await fetchPrintTemplate(row.id);
    await createPrintTemplate({
      billType: detail.billType,
      paperType: detail.paperType,
      templateName: `${detail.templateName} - 副本`,
      content: detail.content,
      status: 1,
    });
    ElMessage.success("已复制为新模板");
    await loadTemplates();
  } catch (e) {
    ElMessage.error(`复制失败：${e instanceof Error ? e.message : String(e)}`);
  }
}

/** 设为默认（同单据类型仅一个默认启用） */
async function handleSetDefault(row: PrintTemplate) {
  await ElMessageBox.confirm(
    `将「${row.templateName}」设为 ${billTypeLabel(row.billType)} 的默认模板？自动打印将使用该模板。`,
    "设为默认",
    { type: "warning" }
  );
  try {
    await setDefaultPrintTemplate(row.id);
    ElMessage.success("已设为默认模板");
    await loadTemplates();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : String(e));
  }
}

async function handleDelete(row: PrintTemplate) {
  await ElMessageBox.confirm(`确定删除模板「${row.templateName}」？`, "删除模板", { type: "warning" });
  try {
    await deletePrintTemplate(row.id);
    ElMessage.success("模板已删除");
    await loadTemplates();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : String(e));
  }
}

async function handlePreview(row: PrintTemplate) {
  const html = renderAnyTemplate(row.content, sampleVars(row.billType), row.billType);
  const win = openPrintWindow();
  if (win) {
    fillPrintWindow(win, `预览：${row.templateName}`, html, 1);
  } else {
    ElMessage.error("请允许弹出窗口以预览");
  }
}

function onLocalSettingsSaved() {
  ElMessage.success("本机打印配置已生效");
}

onMounted(async () => {
  await loadMeta();
  await loadTemplates();
});
</script>

<style scoped>
.print-templates-view {
  padding: 16px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.page-title {
  margin: 0;
  font-size: 18px;
}
.page-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary, #888);
}
.page-header-actions {
  display: flex;
  gap: 8px;
}
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.editor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
.create-tip {
  font-size: 12px;
  color: var(--text-secondary, #888);
  line-height: 1.6;
  background: var(--gray-50, #fafafa);
  border-radius: 6px;
  padding: 8px 10px;
}
</style>
