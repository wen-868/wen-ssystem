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
            <el-tag v-if="row.isDefault === 1" size="small" type="info">系统默认</el-tag>
            <el-tag v-else size="small" type="success">自定义</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="70" align="center" />
        <el-table-column prop="updatedAt" label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button size="small" link @click="handlePreview(row)">预览</el-button>
            <el-button size="small" link @click="handleReset(row)">恢复默认</el-button>
            <el-button size="small" type="danger" link :disabled="row.isDefault === 1" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 模板编辑弹窗 -->
    <el-dialog
      v-model="editorVisible"
      :title="editingId ? '编辑打印模板' : '新建打印模板'"
      width="860px"
      align-center
      top="6vh"
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
          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="content-tip"
            title="模板内容为排版代码"
            description="看不懂没关系：直接点下方『预览』看打印效果，或点『载入系统默认』恢复官方模板。只需修改店名、电话、文案等 {{变量}} 内容。"
          />
          <div class="editor-body">
            <div class="variable-panel">
              <div class="variable-title">插入变量（{{ billTypeLabel(form.billType) }}）</div>
              <div class="variable-list">
                <button
                  v-for="v in currentVariables"
                  :key="v.key"
                  class="variable-chip"
                  :title="v.desc || v.label"
                  @click="insertVariable(v.key)"
                >
                  {{ v.label }}
                </button>
              </div>
              <div class="variable-tip">
                {{ itemsVariableTip }}
              </div>
            </div>
            <el-input
              v-model="form.content"
              type="textarea"
              :rows="20"
              class="content-editor"
              placeholder="粘贴 HTML 模板，使用 {{变量}} 占位符，可复制系统默认模板后修改"
            />
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button @click="loadDefaultContent">载入系统默认</el-button>
        <el-button :icon="View" @click="previewCurrent">预览</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 本机打印设置 -->
    <PrintSettingsPanel v-model="settingsVisible" @saved="onLocalSettingsSaved" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Printer, Refresh, View } from "@element-plus/icons-vue";
import {
  createPrintTemplate,
  deletePrintTemplate,
  fetchPrintMeta,
  fetchPrintTemplates,
  resetPrintTemplate,
  updatePrintTemplate,
} from "./api";
import { PAPER_TYPE_LABELS } from "./localConfig";
import { fillPrintWindow, openPrintWindow } from "./printClient";
import { buildTableHtml, rawHtml, renderTemplate } from "./renderer";
import {
  BILL_TYPE_LABELS,
  getBillTypeVariables,
} from "./variables";
import PrintSettingsPanel from "./PrintSettingsPanel.vue";
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

const currentVariables = computed(() =>
  getBillTypeVariables(form.billType as PrintBillType)
);

const itemsVariableTip = computed(() => {
  const items = currentVariables.value.find((v) => v.key === "items");
  return items ? `提示：${items.label}（${items.desc}）` : "提示：{{items}} 占位符由系统生成表格行";
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

function insertVariable(key: string) {
  if (key === "items") return; // 由系统生成，不手工插入
  const cursor = (document.activeElement as HTMLTextAreaElement | null);
  const textarea = cursor?.classList.contains("el-textarea__inner") ? cursor : null;
  const token = `{{${key}}}`;
  if (textarea) {
    const start = textarea.selectionStart ?? form.content.length;
    const end = textarea.selectionEnd ?? start;
    form.content = form.content.slice(0, start) + token + form.content.slice(end);
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + token.length;
      textarea.setSelectionRange(pos, pos);
    });
  } else {
    form.content += token;
  }
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

async function loadDefaultContent() {
  if (!form.billType) return;
  try {
    const list = await fetchPrintTemplates({ billType: form.billType });
    const def = list.find((t) => t.isDefault === 1) ?? list[0];
    if (def) {
      form.content = def.content;
      form.paperType = def.paperType;
      ElMessage.success("已载入系统默认模板内容");
    } else {
      ElMessage.info("暂无系统默认模板");
    }
  } catch {
    ElMessage.error("默认模板加载失败");
  }
}

/** 构造示例变量用于预览 */
function sampleVars(billType: string): Record<string, string> {
  const items = buildTableHtml(
    [
      { name: "五粮液 52度 500ml", qty: "10", price: "980.00" },
      { name: "剑南春 水晶剑 52度 500ml", qty: "5", price: "2,995.00" },
    ],
    [
      { key: "name", label: "商品", align: "left" },
      { key: "qty", label: "数量" },
      { key: "price", label: "金额", align: "right" },
    ]
  );
  const base: Record<string, string> = {
    storeName: "智享全链门店",
    storePhone: "0755-00000000",
    storeAddress: "深圳市宝安区示例路 1 号",
    billNo: "XS202608120001",
    billDate: "2026-08-12 12:00",
    operatorName: "演示账号",
    auditorName: "张店长",
    salesmanName: "李业务",
    customerName: "红星商行",
    customerPhone: "13900000000",
    saleType: "赊销",
    billStatus: "已创建",
    items: `__raw:${items}`,
    totalAmount: "3,975.00",
    discountAmount: "0.00",
    paidAmount: "3,975.00",
    receivedAmount: "3,975.00",
    changeAmount: "0.00",
    paymentMethod: "微信",
    amountChinese: "叁仟玖佰柒拾伍元整",
    headerName: "智享全链",
    memberBalanceRow: "",
    remarkBlock: "",
    roleRow: "",
    signRoles: "制单人：演示账号    审核人：张店长    业务员：李业务",
    footerText: "谢谢惠顾，欢迎再次光临！",
    reportTitle: "销售日报表",
    reportPeriod: "2026-08-01 ~ 2026-08-31",
    reportHeaders: rawHtml("<th>日期</th><th>销售额</th><th>订单数</th>"),
    productName: "五粮液",
    skuName: "52度 500ml",
    barcode: "6901234567890",
    price: "980.00",
    unit: "瓶",
    shiftNo: "20260812-01",
    receiverName: "王收银",
    saleCount: "36",
    cashAmount: "1,000.00",
    wechatAmount: "2,000.00",
    alipayAmount: "800.00",
    balanceAmount: "175.00",
  };
  void billType;
  return base;
}

function previewCurrent() {
  if (!form.content.trim()) {
    ElMessage.warning("模板内容为空，无法预览");
    return;
  }
  const html = renderTemplate(form.content, sampleVars(form.billType));
  const win = openPrintWindow();
  if (win) {
    fillPrintWindow(win, "打印模板预览", html, 1);
  } else {
    ElMessage.error("请允许弹出窗口以预览");
  }
}

async function handlePreview(row: PrintTemplate) {
  const html = renderTemplate(row.content, sampleVars(row.billType));
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
.editor-body {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 10px;
}
.content-tip {
  width: 100%;
  margin-bottom: 2px;
}
.variable-panel {
  width: 210px;
  flex-shrink: 0;
  border: 1px solid var(--border-light, #eee);
  border-radius: 6px;
  padding: 8px;
  max-height: 420px;
  overflow-y: auto;
  background: var(--gray-50, #fafafa);
}
.variable-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}
.variable-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.variable-chip {
  border: 1px solid #d9d9d9;
  background: #fff;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
  color: #333;
}
.variable-chip:hover {
  border-color: var(--color-primary, #1677ff);
  color: var(--color-primary, #1677ff);
}
.variable-tip {
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-secondary, #888);
  line-height: 1.5;
}
.content-editor {
  flex: 1;
}
</style>
