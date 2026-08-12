<template>
  <div class="print-editor">
    <div class="editor-topbar">
      <div class="topbar-left">
        <span class="topbar-label">纸张类型</span>
        <el-select v-model="json.paperType" style="width: 200px">
          <el-option v-for="p in paperTypes" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
      </div>
      <div class="topbar-tip">左侧添加模块 → 中间实时预览 → 右侧拖拽排序 / 点模块编辑内容</div>
    </div>

    <div class="editor-main">
      <!-- 模块库 -->
      <aside class="module-library">
        <div class="library-title">模块库（点击或拖入添加）</div>
        <div
          v-for="lib in libraryItems"
          :key="lib.type"
          class="lib-item"
          draggable="true"
          @dragstart="onLibDragStart(lib.type)"
          @click="addModule(lib.type)"
        >
          <span class="lib-plus">＋</span>{{ lib.label }}
        </div>
      </aside>

      <!-- 画布预览 -->
      <div class="editor-canvas">
        <div class="canvas-paper" :style="canvasStyle" v-html="previewHtml"></div>
      </div>

      <!-- 模块列表（拖拽排序） -->
      <aside class="module-list">
        <div class="list-title">模块顺序</div>
        <div
          v-for="(mod, idx) in json.modules"
          :key="mod.id"
          class="mod-item"
          :class="{ active: selectedId === mod.id, off: !mod.enabled }"
          draggable="true"
          @dragstart="onModDragStart(idx)"
          @dragover.prevent="onModDragOver(idx)"
          @drop="onModDrop"
          @click="selectedId = mod.id"
        >
          <div class="mod-head">
            <el-switch v-model="mod.enabled" size="small" @click.stop />
            <span class="mod-name">{{ moduleTypeLabel(mod.type) }}</span>
            <span class="mod-ops">
              <el-button text size="small" :disabled="idx === 0" @click.stop="moveModule(idx, -1)">↑</el-button>
              <el-button text size="small" :disabled="idx === json.modules.length - 1" @click.stop="moveModule(idx, 1)">↓</el-button>
              <el-button text type="danger" size="small" @click.stop="removeModule(idx)">删除</el-button>
            </span>
          </div>
        </div>
        <div v-if="json.modules.length === 0" class="list-empty">左侧添加模块后在此排序</div>
      </aside>
    </div>

    <!-- 属性面板 -->
    <div v-if="selected" class="editor-props">
      <div class="props-title">{{ moduleTypeLabel(selected.type) }} · 内容设置</div>
      <div class="props-body">
        <el-form label-width="70px" size="small" label-position="left">
          <template v-if="selected.type === 'title'">
            <el-form-item label="标题文字">
              <el-input v-model="selected.text" placeholder="如：销 售 单" />
            </el-form-item>
          </template>
          <template v-if="selected.type === 'footer'">
            <el-form-item label="页脚文案">
              <el-input v-model="selected.text" placeholder="如：谢谢惠顾，欢迎再次光临！" />
            </el-form-item>
          </template>
          <template v-if="fieldOptions(selected.type).length > 0">
            <el-form-item label="显示内容">
              <div class="field-checks">
                <el-checkbox
                  v-for="f in fieldOptions(selected.type)"
                  :key="f.key"
                  v-model="selected.fields![f.key]"
                >
                  {{ f.label }}
                </el-checkbox>
              </div>
            </el-form-item>
          </template>
          <el-form-item label="对齐">
            <el-radio-group v-model="selected.align">
              <el-radio-button value="left">左</el-radio-button>
              <el-radio-button value="center">中</el-radio-button>
              <el-radio-button value="right">右</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { renderJsonTemplate } from "./renderer";
import { PAPER_TYPE_LABELS } from "./localConfig";
import { sampleVars } from "./sampleVars";
import {
  BILL_TYPE_LABELS,
  COMMON_PRINT_VARIABLES,
  BILL_TYPE_VARIABLES,
  type PrintVariable,
} from "./variables";
import type {
  PrintModule,
  PrintModuleType,
  PrintPaperType,
  PrintTemplateJson,
} from "./types";

const props = defineProps<{
  modelValue: string;
  billType: string;
}>();
const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();

/** 模块类型中文名 */
const MODULE_TYPE_LABELS: Record<PrintModuleType, string> = {
  title: "单据标题",
  header: "门店抬头",
  billInfo: "单据信息",
  customer: "客户信息",
  items: "商品明细",
  summary: "金额汇总",
  memberBalance: "会员余额",
  remark: "备注",
  sign: "签章区",
  footer: "页脚文案",
};

/** 模块库条目 */
const libraryItems: Array<{ type: PrintModuleType; label: string }> = [
  { type: "title", label: "单据标题" },
  { type: "header", label: "门店抬头" },
  { type: "billInfo", label: "单据信息" },
  { type: "customer", label: "客户信息" },
  { type: "items", label: "商品明细" },
  { type: "summary", label: "金额汇总" },
  { type: "memberBalance", label: "会员余额" },
  { type: "remark", label: "备注" },
  { type: "sign", label: "签章区" },
  { type: "footer", label: "页脚文案" },
];

/** 各模块可勾选字段 */
const MODULE_FIELDS: Record<PrintModuleType, string[]> = {
  title: [],
  header: ["headerName", "headerPhone", "headerAddress", "storeName", "storePhone", "storeAddress"],
  billInfo: ["billNo", "billDate", "operatorName", "paymentMethod", "billStatus", "saleType", "customerName", "customerPhone", "skuName", "barcode", "unit", "reportPeriod", "shiftNo", "receiverName", "saleCount", "productName"],
  customer: ["customerName", "customerPhone"],
  items: [],
  summary: ["totalAmount", "paidAmount", "changeAmount", "discountAmount", "receivedAmount", "memberBalance", "price", "cashAmount", "wechatAmount", "alipayAmount", "balanceAmount"],
  memberBalance: ["memberBalance"],
  remark: ["remarkBlock"],
  sign: [],
  footer: [],
};

/** 变量中文名映射 */
const LABEL_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const v of COMMON_PRINT_VARIABLES) map[v.key] = v.label;
  for (const list of Object.values(BILL_TYPE_VARIABLES)) {
    for (const v of list) map[v.key] = v.label;
  }
  return map;
})();

const paperTypes = Object.entries(PAPER_TYPE_LABELS).map(([value, label]) => ({ value, label }));

function moduleTypeLabel(type: PrintModuleType): string {
  return MODULE_TYPE_LABELS[type] || type;
}

function fieldOptions(type: PrintModuleType): PrintVariable[] {
  return MODULE_FIELDS[type]?.map((key) => ({ key, label: LABEL_MAP[key] || key })) ?? [];
}

let seq = 0;
function newModule(type: PrintModuleType): PrintModule {
  seq += 1;
  const fields: Record<string, boolean> = {};
  for (const key of MODULE_FIELDS[type] ?? []) fields[key] = true;
  return {
    id: `${type}-${Date.now()}-${seq}`,
    type,
    enabled: true,
    fields,
    align: type === "title" || type === "header" || type === "footer" ? "center" : "left",
    text: type === "title" ? "单 据 标 题" : type === "footer" ? "谢谢惠顾，欢迎再次光临！" : "",
  };
}

/** 从 HTML 旧模板初始化为默认可视化结构 */
function buildDefaultJson(): PrintTemplateJson {
  const paper: PrintPaperType =
    props.billType === "LABEL" ? "LABEL_60X40"
    : ["SHIFT", "SALE_RECEIPT"].includes(props.billType) ? "RECEIPT_80"
    : "A4";
  const modules: PrintModule[] = [];
  const add = (type: PrintModuleType, fields?: string[], text?: string) => {
    const mod = newModule(type);
    if (fields) {
      const f: Record<string, boolean> = {};
      fields.forEach((k) => { f[k] = true; });
      mod.fields = f;
    }
    if (text !== undefined) mod.text = text;
    modules.push(mod);
  };
  if (props.billType === "SALE_RECEIPT") {
    add("header", ["headerName", "headerPhone", "headerAddress"]);
    add("billInfo", ["billNo", "billDate", "operatorName", "customerName"]);
    add("items");
    add("summary", ["totalAmount", "paidAmount", "changeAmount", "paymentMethod"]);
    add("memberBalance", ["memberBalance"]);
    add("remark", ["remarkBlock"]);
    add("footer", undefined, "谢谢惠顾，欢迎再次光临！");
  } else if (props.billType === "LABEL") {
    add("title", undefined, "{{productName}}");
    add("billInfo", ["skuName", "barcode", "unit"]);
    add("summary", ["price"]);
  } else if (props.billType === "SHIFT") {
    add("title", undefined, "交接班小票");
    add("billInfo", ["shiftNo", "operatorName", "receiverName", "billDate"]);
    add("summary", ["totalAmount", "saleCount", "cashAmount", "wechatAmount", "alipayAmount", "balanceAmount"]);
    add("footer", undefined, "谢谢惠顾，欢迎再次光临！");
  } else {
    add("title", undefined, "销 售 单");
    add("header", ["storeName", "storePhone", "storeAddress"]);
    add("billInfo", ["billNo", "billDate", "operatorName", "billStatus", "auditorName", "salesmanName"]);
    add("customer", ["customerName", "customerPhone"]);
    add("items");
    add("summary", ["totalAmount", "discountAmount", "paidAmount", "receivedAmount"]);
    add("remark", ["remarkBlock"]);
    add("sign");
    add("footer", undefined, "谢谢惠顾，欢迎再次光临！");
  }
  return { version: 2, paperType: paper, modules };
}

const json = reactive<PrintTemplateJson>(parseInitial());

function parseInitial(): PrintTemplateJson {
  const raw = props.modelValue || "";
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.includes('"modules"')) {
    try {
      const parsed = JSON.parse(raw) as PrintTemplateJson;
      if (Array.isArray(parsed.modules)) {
        return { version: 2, paperType: parsed.paperType || "RECEIPT_80", modules: parsed.modules };
      }
    } catch {
      /* 忽略 */
    }
  }
  return buildDefaultJson();
}

watch(
  () => props.modelValue,
  (val) => {
    const raw = val || "";
    if (raw.startsWith("{") && raw.includes('"modules"')) {
      try {
        Object.assign(json, JSON.parse(raw) as PrintTemplateJson);
      } catch {
        /* 忽略 */
      }
    }
  }
);

watch(
  json,
  () => emit("update:modelValue", JSON.stringify(json)),
  { deep: true }
);

const selectedId = ref<string | null>(json.modules[0]?.id ?? null);
const selected = computed(() => json.modules.find((m) => m.id === selectedId.value) ?? null);

const previewHtml = computed(() => {
  try {
    return renderJsonTemplate(json, sampleVars(props.billType));
  } catch {
    return "<div>模板预览渲染失败</div>";
  }
});

const canvasStyle = computed(() => {
  const p = json.paperType;
  if (p.startsWith("RECEIPT_")) {
    return { width: p === "RECEIPT_58" ? "220px" : p === "RECEIPT_110" ? "380px" : "290px" };
  }
  if (p.startsWith("LABEL")) return { width: "260px", margin: "0 auto" };
  return { width: "100%", minWidth: "560px" };
});

function addModule(type: PrintModuleType) {
  const mod = newModule(type);
  json.modules.push(mod);
  selectedId.value = mod.id;
}

function removeModule(idx: number) {
  const mod = json.modules[idx];
  json.modules.splice(idx, 1);
  if (selectedId.value === mod.id) {
    selectedId.value = json.modules[idx]?.id ?? json.modules[idx - 1]?.id ?? null;
  }
}

function moveModule(idx: number, dir: -1 | 1) {
  const target = idx + dir;
  if (target < 0 || target >= json.modules.length) return;
  const arr = json.modules;
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
}

/** 拖拽排序 */
let dragType: PrintModuleType | null = null;
let dragIdx = -1;

function onLibDragStart(type: PrintModuleType) {
  dragType = type;
  dragIdx = -1;
}

function onModDragStart(idx: number) {
  dragType = null;
  dragIdx = idx;
}

function onModDragOver(idx: number) {
  if (dragType) {
    // 从模块库拖入：插入到 idx 位置
    addModuleAt(dragType, idx);
    dragType = null;
    return;
  }
  if (dragIdx >= 0 && dragIdx !== idx) {
    moveModule(dragIdx, idx > dragIdx ? 1 : -1);
    dragIdx = idx;
  }
}

function addModuleAt(type: PrintModuleType, idx: number) {
  const mod = newModule(type);
  json.modules.splice(idx, 0, mod);
  selectedId.value = mod.id;
}

function onModDrop() {
  dragType = null;
  dragIdx = -1;
}
</script>

<style scoped>
.print-editor {
  border: 1px solid var(--border-light, #eee);
  border-radius: 8px;
  overflow: hidden;
}
.editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--gray-50, #fafafa);
  border-bottom: 1px solid var(--border-light, #eee);
}
.topbar-label {
  font-size: 13px;
  color: var(--text-secondary, #666);
  margin-right: 8px;
}
.topbar-tip {
  font-size: 12px;
  color: var(--text-secondary, #888);
}
.editor-main {
  display: flex;
  min-height: 460px;
}
.module-library {
  width: 160px;
  flex-shrink: 0;
  padding: 10px;
  border-right: 1px solid var(--border-light, #eee);
  background: var(--gray-50, #fafafa);
}
.library-title,
.list-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #666);
  margin-bottom: 8px;
}
.lib-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  margin-bottom: 6px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  cursor: grab;
  transition: all 120ms;
}
.lib-item:hover {
  border-color: var(--color-primary, #1677ff);
  color: var(--color-primary, #1677ff);
}
.lib-plus {
  color: var(--color-primary, #1677ff);
  font-weight: 700;
}
.editor-canvas {
  flex: 1;
  padding: 14px;
  overflow: auto;
  background: #f0f2f5;
}
.canvas-paper {
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  min-height: 200px;
  padding: 8px;
  border-radius: 4px;
}
.module-list {
  width: 190px;
  flex-shrink: 0;
  padding: 10px;
  border-left: 1px solid var(--border-light, #eee);
  background: var(--gray-50, #fafafa);
}
.mod-item {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  padding: 6px 8px;
  margin-bottom: 6px;
  cursor: grab;
  transition: all 120ms;
}
.mod-item.active {
  border-color: var(--color-primary, #1677ff);
  box-shadow: 0 0 0 1px var(--color-primary, #1677ff);
}
.mod-item.off {
  opacity: 0.55;
}
.mod-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mod-name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
}
.mod-ops {
  display: flex;
  gap: 2px;
}
.list-empty {
  font-size: 12px;
  color: var(--text-muted, #aaa);
  text-align: center;
  padding: 20px 0;
}
.editor-props {
  border-top: 1px solid var(--border-light, #eee);
  padding: 10px 14px;
  background: #fff;
}
.props-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}
.props-body {
  max-height: 220px;
  overflow-y: auto;
}
.field-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}
</style>
