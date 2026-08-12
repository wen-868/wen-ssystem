<template>
  <div class="designer-page">
    <!-- 页面工具条：返回 / 模板名 / 单据类型 / 纸张 / 保存 -->
    <div class="designer-toolbar">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <el-input v-model="templateName" placeholder="模板名称" maxlength="64" class="name-input" @input="markDirty" />
      <el-tag size="small" type="info">{{ billTypeLabel }}</el-tag>
      <span class="paper-hint">{{ paperHint }}</span>
      <div class="toolbar-spacer"></div>
      <el-button :icon="View" @click="preview">预览</el-button>
      <el-button type="primary" :icon="Check" :loading="saving" @click="handleSave">保存</el-button>
    </div>

    <!-- 编辑器（平铺占满工作区剩余高度） -->
    <div class="designer-body">
      <PrintTemplateEditor
        v-model="content"
        :bill-type="billType"
        @back="goBack"
        @save="handleSave"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { ArrowLeft, Check, View } from "@element-plus/icons-vue";
import PrintTemplateEditor from "./PrintTemplateEditor.vue";
import {
  createPrintTemplate,
  fetchPrintTemplate,
  updatePrintTemplate,
} from "./api";
import { fillPrintWindow, openPrintWindow, renderAnyTemplate } from "./printClient";
import { sampleVars } from "./sampleVars";
import { BILL_TYPE_LABELS } from "./variables";
import { createDefaultV3Template } from "./widgetFactory";
import type { PrintBillType, PrintPaperType, PrintTemplateV3 } from "./types";

const route = useRoute();
const router = useRouter();

const templateId = ref<number | null>(null);
const billType = ref<PrintBillType>("SALE_BILL");
const templateName = ref("");
const content = ref("");
const saving = ref(false);
const dirty = ref(false);

const billTypeLabel = computed(() => (BILL_TYPE_LABELS as Record<string, string>)[billType.value] ?? billType.value);

/** 当前纸张尺寸提示（从内容 JSON 读取） */
const paperHint = computed(() => {
  try {
    const json = JSON.parse(content.value || "{}") as PrintTemplateV3;
    if (json.paper) return `${json.paper.width} × ${json.paper.height}mm · ${json.paper.orientation === "landscape" ? "横向" : "纵向"}`;
  } catch {
    /* 忽略 */
  }
  return "";
});

function markDirty() {
  dirty.value = true;
}

function goBack() {
  if (dirty.value) {
    confirmLeave("模板有未保存的修改，确定离开？").then(
      () => router.push("/system/print"),
      () => {}
    );
  } else {
    router.push("/system/print");
  }
}

function confirmLeave(message: string): Promise<unknown> {
  // 动态引入避免页面加载时依赖 ElMessageBox
  return import("element-plus").then(({ ElMessageBox }) =>
    ElMessageBox.confirm(message, "未保存修改", { type: "warning", confirmButtonText: "离开", cancelButtonText: "留在本页" })
  );
}

/** 从内容提取纸张类型（保存用） */
function paperTypeFromContent(): PrintPaperType {
  try {
    const json = JSON.parse(content.value) as PrintTemplateV3;
    return json.paper?.type ?? "A4";
  } catch {
    return "A4";
  }
}

async function load() {
  const idParam = route.params.id;
  const q = route.query;

  if (idParam) {
    // 编辑既有模板
    templateId.value = Number(idParam);
    try {
      const row = await fetchPrintTemplate(templateId.value);
      billType.value = row.billType as PrintBillType;
      templateName.value = row.templateName;
      content.value = row.content;
    } catch (e) {
      ElMessage.error(`模板加载失败：${e instanceof Error ? e.message : String(e)}`);
      router.push("/system/print");
      return;
    }
  } else {
    // 新建：按传入单据类型/纸张生成完整默认模板
    billType.value = (q.billType as PrintBillType) || "SALE_BILL";
    const paperType = ((q.paperType as PrintPaperType) || "A4") as PrintPaperType;
    templateName.value = (q.name as string) || `${(BILL_TYPE_LABELS as Record<string, string>)[billType.value] ?? "单据"}（默认）`;
    const v3 = createDefaultV3Template(billType.value, paperType);
    content.value = JSON.stringify(v3);
  }
}

async function handleSave() {
  if (!content.value.trim()) {
    ElMessage.warning("模板内容为空");
    return;
  }
  saving.value = true;
  try {
    const paperType = paperTypeFromContent();
    if (templateId.value) {
      await updatePrintTemplate(templateId.value, {
        paperType,
        templateName: templateName.value || "未命名模板",
        content: content.value,
        status: 1,
      });
    } else {
      const res = await createPrintTemplate({
        billType: billType.value,
        paperType,
        templateName: templateName.value || "未命名模板",
        content: content.value,
        status: 1,
      });
      templateId.value = res.id;
    }
    dirty.value = false;
    ElMessage.success("模板已保存");
  } catch (e) {
    ElMessage.error(`保存失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    saving.value = false;
  }
}

function preview() {
  try {
    const html = renderAnyTemplate(content.value, sampleVars(billType.value), billType.value);
    const win = openPrintWindow();
    if (win) {
      fillPrintWindow(win, `预览：${templateName.value || "模板"}`, html, 1);
    } else {
      ElMessage.error("请允许弹出窗口以预览");
    }
  } catch (e) {
    ElMessage.error(`预览失败：${e instanceof Error ? e.message : String(e)}`);
  }
}

/** 页面离开前提醒未保存 */
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = "";
  }
}

onMounted(() => {
  load();
  window.addEventListener("beforeunload", onBeforeUnload);
});
</script>

<style scoped>
.designer-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px;
  box-sizing: border-box;
  gap: 8px;
}
.designer-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid var(--border-light, #e5e6eb);
  border-radius: 8px;
  flex-shrink: 0;
}
.name-input {
  width: 220px;
}
.paper-hint {
  font-size: 12px;
  color: var(--text-secondary, #888);
}
.toolbar-spacer {
  flex: 1;
}
.designer-body {
  flex: 1;
  min-height: 0;
}
</style>
