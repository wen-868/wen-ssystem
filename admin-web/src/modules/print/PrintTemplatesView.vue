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

    <!-- 模板编辑弹窗 -->
    <el-dialog
      v-model="editorVisible"
      :title="editingId ? '编辑打印模板' : '新建打印模板'"
      width="1180px"
      align-center
      top="4vh"
    >
      <el-form :model="form" label-width="90px" label-position="left">
        <div class="editor-grid">
          <el-form-item label="单据类型">
            <el-select v-model="form.billType" style="width: 100%" :disabled="!!editingId" @change="onBillTypeChange">
              <el-option v-for="b in billTypes" :key="b.value" :label="b.label" :value="b.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="纸张类型">
            <el-select v-model="form.paperType" style="width: 100%">
              <el-option v-for="p in paperTypes" :key="p.value" :label="p.label" :value="p.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="模板名称">
            <el-input v-model="form.templateName" maxlength="64" placeholder="如：我的 80mm 小票" />
          </el-form-item>
          <el-form-item label="状态">
            <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="停用" />
          </el-form-item>
        </div>

        <el-form-item label="模板内容">
          <PrintTemplateEditor v-model="form.content" :bill-type="form.billType" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 本机打印设置 -->
    <PrintSettingsPanel v-model="settingsVisible" @saved="onLocalSettingsSaved" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
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
  updatePrintTemplate,
} from "./api";
import { PAPER_TYPE_LABELS } from "./localConfig";
import { fillPrintWindow, openPrintWindow, renderAnyTemplate } from "./printClient";
import { sampleVars } from "./sampleVars";
import { BILL_TYPE_LABELS } from "./variables";
import PrintSettingsPanel from "./PrintSettingsPanel.vue";
import PrintTemplateEditor from "./PrintTemplateEditor.vue";
import type { PrintBillType, PrintPaperType, PrintTemplate } from "./types";

const loading = ref(false);
const saving = ref(false);
const templates = ref<PrintTemplate[]>([]);
const billTypes = ref<Array<{ value: string; label: string }>>([]);
const paperTypes = ref<Array<{ value: string; label: string }>>([]);
const filterBillType = ref("");
const filterPaperType = ref("");
const editorVisible = ref(false);
const settingsVisible = ref(false);
const editingId = ref<number | null>(null);

const form = reactive({
  billType: "SALE_RECEIPT" as string,
  paperType: "RECEIPT_80" as string,
  templateName: "",
  content: "",
  status: 1,
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
  editingId.value = null;
  Object.assign(form, {
    billType: "SALE_RECEIPT",
    paperType: "RECEIPT_80",
    templateName: "",
    content: "",
    status: 1,
  });
  editorVisible.value = true;
}

function openEdit(row: PrintTemplate) {
  editingId.value = row.id;
  Object.assign(form, {
    billType: row.billType,
    paperType: row.paperType,
    templateName: row.templateName,
    content: row.content,
    status: row.status,
  });
  editorVisible.value = true;
}

function onBillTypeChange(value: string) {
  form.paperType = value === "LABEL" ? "LABEL_60X40" : "RECEIPT_80";
}

async function handleSave() {
  if (!form.billType || !form.paperType) {
    ElMessage.warning("请选择单据类型与纸张类型");
    return;
  }
  if (!form.content.trim()) {
    ElMessage.warning("模板内容不能为空");
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      await updatePrintTemplate(editingId.value, {
        paperType: form.paperType as PrintPaperType,
        templateName: form.templateName,
        content: form.content,
        status: form.status,
      });
    } else {
      await createPrintTemplate({
        billType: form.billType as PrintBillType,
        paperType: form.paperType as PrintPaperType,
        templateName: form.templateName,
        content: form.content,
        status: form.status,
      });
    }
    ElMessage.success("模板已保存");
    editorVisible.value = false;
    await loadTemplates();
  } catch (e) {
    ElMessage.error(`保存失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    saving.value = false;
  }
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
</style>
