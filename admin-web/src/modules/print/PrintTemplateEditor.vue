<template>
  <div class="print-editor">
    <!-- 顶部工具栏 -->
    <div class="editor-topbar">
      <div class="tb-left">
        <el-button size="small" :icon="ArrowLeft" title="返回模板列表" @click="emit('back')">返回</el-button>
        <span class="tb-title">可视化模板设计</span>
        <el-tag size="small" type="info">{{ billTypeLabel }}</el-tag>
        <span class="tb-paper">{{ paper.width }} × {{ paper.height }}mm · {{ paperOrientationLabel }}</span>
      </div>
      <div class="tb-center">
        <el-button-group>
          <el-button size="small" :disabled="historyIndex <= 0" :icon="Back" title="撤销 (Ctrl+Z)" @click="undo">撤销</el-button>
          <el-button size="small" :disabled="historyIndex >= historyStack.length - 1" :icon="Right" title="重做 (Ctrl+Y)" @click="redo">重做</el-button>
        </el-button-group>
        <el-button-group class="tb-align-group">
          <el-button size="small" title="左对齐" @click="alignWidgets('left')">左对齐</el-button>
          <el-button size="small" title="水平居中" @click="alignWidgets('hcenter')">水平居中</el-button>
          <el-button size="small" title="垂直居中" @click="alignWidgets('vcenter')">垂直居中</el-button>
          <el-button size="small" title="右对齐" @click="alignWidgets('right')">右对齐</el-button>
        </el-button-group>
        <div class="tb-zoom">
          <span>缩放</span>
          <el-slider v-model="zoom" :min="30" :max="300" :step="5" style="width: 110px" @change="manualZoom = true" />
          <span class="zoom-num">{{ zoom }}%</span>
        </div>
      </div>
      <div class="tb-right">
        <el-button size="small" :icon="View" @click="preview">预览</el-button>
      </div>
    </div>

    <div class="editor-body">
      <!-- 左侧控件库 -->
      <aside class="widget-library">
        <div class="lib-section-title">工具控件</div>
        <div
          v-for="t in toolItems"
          :key="t.kind"
          class="lib-item"
          draggable="true"
          @dragstart="onToolDragStart($event, t.kind)"
          @click="addWidgetByKind(t.kind)"
        >
          <span class="lib-ico">{{ t.icon }}</span>{{ t.label }}
        </div>

        <div class="lib-section-title">数据字段</div>
        <div class="lib-hint">拖入画布或点击添加，自动绑定数据</div>
        <div
          v-for="v in fieldItems"
          :key="v.key"
          class="lib-field"
          draggable="true"
          @dragstart="onFieldDragStart($event, v)"
          @click="addFieldWidget(v)"
        >
          <span class="lib-fname">{{ v.label }}</span>
          <span class="lib-fkey">{{ v.key }}</span>
        </div>
      </aside>

      <!-- 中间画布 -->
      <div class="editor-canvas" @dragover.prevent @drop="onCanvasDrop">
        <div class="canvas-scroll">
          <div
            class="canvas-paper"
            :style="paperStyle"
            @mousedown="deselect"
            @click.self="deselect"
          >
            <div
              v-for="w in widgets"
              :key="w.id"
              class="ed-widget"
              :class="{ selected: isSelected(w.id), locked: w.locked }"
              :style="widgetBoxStyle(w)"
              @mousedown.stop="onWidgetMouseDown($event, w)"
              @dblclick.stop="onWidgetDblClick(w)"
            >
              <div class="ed-widget-inner" :style="widgetInnerStyle(w)" v-html="renderContent(w)"></div>

              <template v-if="isSelected(w.id)">
                <div
                  v-for="h in handles"
                  :key="h"
                  :class="['ed-handle', h]"
                  @mousedown.stop="onHandleMouseDown($event, w, h)"
                ></div>
                <div class="ed-size-tip">{{ fmt(w.x) }}, {{ fmt(w.y) }} · {{ fmt(w.width) }}×{{ fmt(w.height) }}mm</div>
              </template>
              <div v-if="w.locked" class="ed-lock-tag">已锁定</div>
            </div>

            <!-- 对齐辅助线 -->
            <div
              v-for="(g, i) in guides"
              :key="'g' + i"
              class="ed-guide"
              :class="g.vertical ? 'v' : 'h'"
              :style="guideStyle(g)"
            ></div>

            <div v-if="widgets.length === 0" class="canvas-empty">从左侧拖入控件，或点击控件库添加<br />支持自由摆放、拖拽缩放、对齐吸附</div>
          </div>
        </div>
      </div>

      <!-- 右侧属性面板 -->
      <aside class="props-panel">
        <template v-if="selectedWidget">
          <div class="props-title">
            {{ widgetKindLabel(selectedWidget.kind) }} · 属性
            <el-button text size="small" type="danger" @click="removeSelected">删除</el-button>
          </div>
          <div class="props-body">
            <el-form label-width="76px" size="small" label-position="left">
              <el-divider content-position="left">位置与尺寸（mm）</el-divider>
              <div class="prop-grid">
                <el-form-item label="X"><el-input-number v-model="selectedWidget.x" :min="0" :max="paper.width" size="small" controls-position="right" @change="mutate" /></el-form-item>
                <el-form-item label="Y"><el-input-number v-model="selectedWidget.y" :min="0" :max="paper.height" size="small" controls-position="right" @change="mutate" /></el-form-item>
                <el-form-item label="宽度"><el-input-number v-model="selectedWidget.width" :min="3" :max="paper.width" size="small" controls-position="right" @change="mutate" /></el-form-item>
                <el-form-item label="高度"><el-input-number v-model="selectedWidget.height" :min="2" :max="paper.height" size="small" controls-position="right" @change="mutate" /></el-form-item>
              </div>
              <el-form-item label="锁定"><el-switch v-model="selectedWidget.locked" size="small" @change="mutate" /></el-form-item>

              <el-divider content-position="left">样式</el-divider>
              <el-form-item label="字号">
                <el-input-number v-model="selectedWidget.fontSize" :min="6" :max="72" size="small" controls-position="right" @change="mutate" /> pt
              </el-form-item>
              <el-form-item label="加粗"><el-switch v-model="selectedWidget.fontWeight" active-value="bold" inactive-value="normal" size="small" @change="mutate" /></el-form-item>
              <el-form-item label="对齐">
                <el-radio-group v-model="selectedWidget.align" size="small" @change="mutate">
                  <el-radio-button value="left">左</el-radio-button>
                  <el-radio-button value="center">中</el-radio-button>
                  <el-radio-button value="right">右</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="文字颜色">
                <el-color-picker v-model="selectedWidget.color" size="small" @change="mutate" />
              </el-form-item>
              <el-form-item label="边框">
                <div class="border-row">
                  <el-input-number v-model="selectedWidget.borderWidth" :min="0" :max="10" size="small" controls-position="right" @change="mutate" />
                  <el-color-picker v-if="selectedWidget.borderWidth" v-model="selectedWidget.borderColor" size="small" @change="mutate" />
                </div>
              </el-form-item>
              <el-form-item label="背景色">
                <el-color-picker v-model="selectedWidget.backgroundColor" size="small" @change="mutate" />
              </el-form-item>

              <template v-if="selectedWidget.kind === 'text'">
                <el-divider content-position="left">文本内容</el-divider>
                <el-form-item label="内容">
                  <el-input
                    v-model="selectedWidget.text"
                    type="textarea"
                    :rows="3"
                    placeholder="支持 {{变量}} 占位符"
                    @input="mutate"
                  />
                </el-form-item>
                <div class="props-tip">{{ placeholderExample }}</div>
              </template>

              <template v-if="selectedWidget.kind === 'field'">
                <el-divider content-position="left">数据绑定</el-divider>
                <el-form-item label="数据字段">
                  <el-select v-model="selectedWidget.fieldKey" size="small" filterable @change="onFieldKeyChange">
                    <el-option v-for="v in fieldItems" :key="v.key" :label="v.label" :value="v.key" />
                  </el-select>
                </el-form-item>
                <el-form-item label="显示名">
                  <el-input v-model="selectedWidget.label" size="small" placeholder="留空=变量默认名" @input="mutate" />
                </el-form-item>
                <el-form-item label="显示标签"><el-switch v-model="selectedWidget.showLabel" size="small" @change="mutate" /></el-form-item>
                <el-form-item label="空值文案">
                  <el-input v-model="selectedWidget.emptyText" size="small" placeholder="如：-" @input="mutate" />
                </el-form-item>
              </template>

              <template v-if="selectedWidget.kind === 'table'">
                <el-divider content-position="left">表格配置</el-divider>
                <el-form-item label="数据源">
                  <el-select v-model="selectedTable!.dataSource" size="small" @change="mutate">
                    <el-option label="商品明细 (itemsRows)" value="itemsRows" />
                    <el-option label="报表数据 (reportRows)" value="reportRows" />
                  </el-select>
                </el-form-item>
                <el-form-item label="显示表头"><el-switch v-model="selectedTable!.showHeader" size="small" @change="mutate" /></el-form-item>
                <el-form-item label="行高"><el-input-number v-model="selectedTable!.rowHeight" :min="3" :max="20" size="small" controls-position="right" @change="mutate" /> mm</el-form-item>
                <div class="props-tip">列配置：拖拽上下调整顺序，勾选显示</div>
                <div class="table-col-list">
                  <div v-for="(col, ci) in selectedTable!.columns" :key="col.key" class="table-col-row">
                    <el-button text size="small" :disabled="ci === 0" @click="moveColumn(selectedTable!, ci, -1)">↑</el-button>
                    <el-button text size="small" :disabled="ci === selectedTable!.columns.length - 1" @click="moveColumn(selectedTable!, ci, 1)">↓</el-button>
                    <el-input v-model="col.label" size="small" class="col-label-input" placeholder="列名" @input="mutate" />
                    <el-select v-model="col.align" size="small" class="col-align-select" @change="mutate">
                      <el-option label="左" value="left" />
                      <el-option label="中" value="center" />
                      <el-option label="右" value="right" />
                    </el-select>
                    <el-input-number v-model="col.width" :min="5" :max="100" size="small" controls-position="right" class="col-width-input" @change="mutate" />
                    <el-button text type="danger" size="small" @click="removeColumn(selectedTable!, ci)">删</el-button>
                  </div>
                </div>
                <el-button size="small" class="add-col-btn" @click="addColumn(selectedTable!)">＋ 添加列</el-button>
              </template>

              <template v-if="selectedWidget.kind === 'image'">
                <el-divider content-position="left">图片</el-divider>
                <el-form-item label="图片地址">
                  <el-input v-model="selectedWidget.src" size="small" placeholder="URL 或 {{变量}}" @input="mutate" />
                </el-form-item>
                <el-form-item label="填充方式">
                  <el-select v-model="selectedWidget.fit" size="small" @change="mutate">
                    <el-option label="适应（完整显示）" value="contain" />
                    <el-option label="裁剪（铺满）" value="cover" />
                    <el-option label="拉伸" value="stretch" />
                  </el-select>
                </el-form-item>
              </template>

              <template v-if="selectedWidget.kind === 'barcode' || selectedWidget.kind === 'qrcode'">
                <el-divider content-position="left">码值</el-divider>
                <el-form-item label="编码内容">
                  <el-input v-model="selectedWidget.value" size="small" placeholder="固定值或 {{变量}}" @input="mutate" />
                </el-form-item>
                <el-form-item v-if="selectedWidget.kind === 'barcode'" label="码制">
                  <el-select v-model="selectedWidget.format" size="small" @change="mutate">
                    <el-option label="CODE128" value="CODE128" />
                    <el-option label="CODE39" value="CODE39" />
                    <el-option label="EAN13" value="EAN13" />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="selectedWidget.kind === 'barcode'" label="显示文字">
                  <el-switch v-model="selectedWidget.showText" size="small" @change="mutate" />
                </el-form-item>
              </template>

              <template v-if="selectedWidget.kind === 'rect'">
                <el-form-item label="圆角">
                  <el-input-number v-model="selectedWidget.borderRadius" :min="0" :max="50" size="small" controls-position="right" @change="mutate" />
                </el-form-item>
              </template>

              <template v-if="selectedWidget.kind === 'line'">
                <el-form-item label="线型">
                  <el-select v-model="selectedWidget.lineStyle" size="small" @change="mutate">
                    <el-option label="实线" value="solid" />
                    <el-option label="虚线" value="dashed" />
                    <el-option label="点线" value="dotted" />
                  </el-select>
                </el-form-item>
              </template>
            </el-form>
          </div>
        </template>

        <template v-else>
          <div class="props-title">纸张设置</div>
          <div class="props-body">
            <el-form label-width="76px" size="small" label-position="left">
              <el-form-item label="纸张类型">
                <el-select v-model="paper.type" size="small" @change="onPaperTypeChange">
                  <el-option v-for="p in paperTypes" :key="p.value" :label="p.label" :value="p.value" />
                </el-select>
              </el-form-item>
              <div class="prop-grid">
                <el-form-item label="宽度"><el-input-number v-model="paper.width" :min="20" :max="500" size="small" controls-position="right" @change="mutate" /> mm</el-form-item>
                <el-form-item label="高度"><el-input-number v-model="paper.height" :min="20" :max="1000" size="small" controls-position="right" @change="mutate" /> mm</el-form-item>
              </div>
              <el-form-item label="方向">
                <el-radio-group v-model="paper.orientation" size="small" @change="onOrientationChange">
                  <el-radio-button value="portrait">纵向</el-radio-button>
                  <el-radio-button value="landscape">横向</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-divider content-position="left">页边距（mm）</el-divider>
              <div class="prop-grid">
                <el-form-item label="上"><el-input-number v-model="paper.marginTop" :min="0" :max="50" size="small" controls-position="right" @change="mutate" /></el-form-item>
                <el-form-item label="下"><el-input-number v-model="paper.marginBottom" :min="0" :max="50" size="small" controls-position="right" @change="mutate" /></el-form-item>
                <el-form-item label="左"><el-input-number v-model="paper.marginLeft" :min="0" :max="50" size="small" controls-position="right" @change="mutate" /></el-form-item>
                <el-form-item label="右"><el-input-number v-model="paper.marginRight" :min="0" :max="50" size="small" controls-position="right" @change="mutate" /></el-form-item>
              </div>
              <div class="props-tip">小票/标签建议 3~5mm；A4 打印默认边距在打印机端设置</div>
              <el-button size="small" style="margin-top: 8px" @click="rebuildDefault">恢复默认版式</el-button>
            </el-form>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { ArrowLeft, Back, Right, View } from "@element-plus/icons-vue";
import {
  createDefaultV3Template,
  createWidget,
  uid,
  v2ToV3,
} from "./widgetFactory";
import {
  renderV3PaperHtml,
  renderV3WidgetContentHtml,
} from "./renderer";
import { fillPrintWindow, openPrintWindow } from "./printClient";
import { sampleVars } from "./sampleVars";
import { BILL_TYPE_LABELS, BILL_TYPE_VARIABLES, COMMON_PRINT_VARIABLES } from "./variables";
import { PAPER_TYPE_LABELS } from "./localConfig";
import type {
  PrintBillType,
  PrintPaperSettings,
  PrintPaperType,
  PrintTemplateJson,
  PrintTemplateV3,
  PrintTableColumn,
  PrintTableWidget,
  PrintWidget,
  PrintWidgetKind,
} from "./types";
import { PAPER_DEFAULT_SIZE } from "./types";
import type { PrintVariable } from "./variables";

const props = defineProps<{ modelValue: string; billType: string }>();
const emit = defineEmits<{ (e: "update:modelValue", value: string): void; (e: "save"): void; (e: "back"): void }>();

/** 工具控件库 */
const toolItems: Array<{ kind: PrintWidgetKind; label: string; icon: string }> = [
  { kind: "text", label: "文本", icon: "T" },
  { kind: "field", label: "数据字段", icon: "ƒ" },
  { kind: "table", label: "明细表格", icon: "≡" },
  { kind: "image", label: "图片", icon: "🖼" },
  { kind: "barcode", label: "条码", icon: "▮▮" },
  { kind: "qrcode", label: "二维码", icon: "▦" },
  { kind: "rect", label: "矩形", icon: "▭" },
  { kind: "line", label: "线条", icon: "─" },
];

const placeholderExample = "示例：{{customerName}} 将显示为客户名称";

const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

const paperTypes = Object.entries(PAPER_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const paper = ref<PrintPaperSettings>({ type: "A4", width: 210, height: 297, orientation: "portrait", marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5 });
const widgets = ref<PrintWidget[]>([]);
const selectedIds = ref<string[]>([]);
const zoom = ref(80);
const guides = ref<Array<{ vertical: boolean; pos: number }>>([]);
const manualZoom = ref(false);
let resizeObserver: ResizeObserver | null = null;

const historyStack = ref<string[]>([]);
const historyIndex = ref(-1);

const billTypeLabel = computed(() => (BILL_TYPE_LABELS as Record<string, string>)[props.billType] ?? props.billType);
const paperOrientationLabel = computed(() => (paper.value.orientation === "landscape" ? "横向" : "纵向"));
const selectedWidget = computed<PrintWidget | null>(() => widgets.value.find((w) => w.id === selectedIds.value[0]) ?? null);
const selectedTable = computed<PrintTableWidget | null>(() =>
  selectedWidget.value?.kind === "table" ? (selectedWidget.value as PrintTableWidget) : null
);

/** 数据字段列表（当前单据类型 + 通用） */
const fieldItems = computed<PrintVariable[]>(() => {
  const typeVars = (BILL_TYPE_VARIABLES as Record<string, PrintVariable[]>)[props.billType] ?? [];
  const merged = [...typeVars];
  for (const v of COMMON_PRINT_VARIABLES) {
    if (!merged.some((m) => m.key === v.key)) merged.push(v);
  }
  return merged;
});

/** 画布缩放系数 */
const zoomFactor = computed(() => zoom.value / 100);

/** 纸面样式：mm 数值当 px 渲染，transform 缩放 */
const paperStyle = computed(() => {
  const w = paper.value.width;
  const h = paper.value.height;
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: `scale(${zoomFactor.value})`,
    backgroundImage:
      "linear-gradient(rgba(22,119,255,.11) 1px, transparent 1px), linear-gradient(90deg, rgba(22,119,255,.11) 1px, transparent 1px)",
    backgroundSize: "5px 5px",
  };
});

function widgetBoxStyle(w: PrintWidget): Record<string, string> {
  return {
    left: `${w.x}px`,
    top: `${w.y}px`,
    width: `${w.width}px`,
    height: `${w.height}px`,
    zIndex: String(w.zIndex ?? 0),
  };
}

function widgetInnerStyle(w: PrintWidget): Record<string, string> {
  const s: Record<string, string> = {};
  if (w.fontSize) s.fontSize = `${w.fontSize}px`;
  if (w.fontWeight) s.fontWeight = w.fontWeight;
  if (w.align) s.textAlign = w.align;
  if (w.color) s.color = w.color;
  if (w.padding) s.padding = `${w.padding}px`;
  return s;
}

function renderContent(w: PrintWidget): string {
  return renderV3WidgetContentHtml(w, sampleVars(props.billType), props.billType);
}

/** 当前模板 JSON 文本 */
function jsonText(): string {
  const v3: PrintTemplateV3 = { version: 3, paper: paper.value, widgets: widgets.value };
  return JSON.stringify(v3);
}

function sync() {
  emit("update:modelValue", jsonText());
}

/** 历史快照 */
function pushHistory() {
  const snapshot = jsonText();
  if (historyStack.value[historyIndex.value] === snapshot) return;
  historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
  historyStack.value.push(snapshot);
  if (historyStack.value.length > 60) historyStack.value.shift();
  historyIndex.value = historyStack.value.length - 1;
}

function applySnapshot(snapshot: string) {
  try {
    const json = JSON.parse(snapshot) as PrintTemplateV3;
    paper.value = json.paper;
    widgets.value = json.widgets;
    sync();
  } catch {
    /* 忽略异常快照 */
  }
}

function undo() {
  if (historyIndex.value > 0) {
    historyIndex.value--;
    applySnapshot(historyStack.value[historyIndex.value]);
  }
}

function redo() {
  if (historyIndex.value < historyStack.value.length - 1) {
    historyIndex.value++;
    applySnapshot(historyStack.value[historyIndex.value]);
  }
}

/** 解析父级传入内容（v3 / v2 / 空） */
function parseModel() {
  const content = props.modelValue || "";
  try {
    const json = JSON.parse(content) as PrintTemplateJson | PrintTemplateV3;
    if (json.version === 3) {
      paper.value = json.paper;
      widgets.value = json.widgets;
    } else if (json.version === 2) {
      const v3 = v2ToV3(json, props.billType as PrintBillType);
      paper.value = v3.paper;
      widgets.value = v3.widgets;
      nextTick(sync);
    } else {
      resetDefault();
    }
  } catch {
    resetDefault();
  }
  pushHistory();
}

function resetDefault() {
  const v3 = createDefaultV3Template(props.billType as PrintBillType, paper.value.type);
  paper.value = v3.paper;
  widgets.value = v3.widgets;
  nextTick(sync);
}

function rebuildDefault() {
  const v3 = createDefaultV3Template(props.billType as PrintBillType, paper.value.type);
  paper.value = v3.paper;
  widgets.value = v3.widgets;
  pushHistory();
  sync();
  ElMessage.success("已恢复默认版式");
}

function isSelected(id: string): boolean {
  return selectedIds.value.includes(id);
}

function deselect() {
  selectedIds.value = [];
}

function selectWidget(w: PrintWidget, additive = false) {
  if (additive) {
    const idx = selectedIds.value.indexOf(w.id);
    if (idx >= 0) selectedIds.value.splice(idx, 1);
    else selectedIds.value.push(w.id);
  } else {
    selectedIds.value = [w.id];
  }
}

function removeSelected() {
  widgets.value = widgets.value.filter((w) => !selectedIds.value.includes(w.id));
  selectedIds.value = [];
  pushHistory();
  sync();
}

function fmt(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 对齐吸附：返回吸附后的坐标并生成辅助线 */
function snapPosition(nx: number, ny: number, w: PrintWidget): { x: number; y: number } {
  guides.value = [];
  const tol = 3 / zoomFactor.value;
  let bx = nx;
  let by = ny;
  const others = widgets.value.filter((o) => o.id !== w.id);

  for (const o of others) {
    const xTargets = [o.x, o.x + o.width / 2, o.x + o.width];
    const yTargets = [o.y, o.y + o.height / 2, o.y + o.height];

    for (const t of xTargets) {
      if (Math.abs(nx - t) < tol) {
        bx = t;
        pushGuide(true, t);
      }
      if (Math.abs(nx + w.width - t) < tol) {
        bx = t - w.width;
        pushGuide(true, t);
      }
      if (Math.abs(nx + w.width / 2 - t) < tol) {
        bx = t - w.width / 2;
        pushGuide(true, t);
      }
    }
    for (const t of yTargets) {
      if (Math.abs(ny - t) < tol) {
        by = t;
        pushGuide(false, t);
      }
      if (Math.abs(ny + w.height - t) < tol) {
        by = t - w.height;
        pushGuide(false, t);
      }
      if (Math.abs(ny + w.height / 2 - t) < tol) {
        by = t - w.height / 2;
        pushGuide(false, t);
      }
    }
  }
  return { x: bx, y: by };
}

function pushGuide(vertical: boolean, pos: number) {
  if (!guides.value.some((g) => g.vertical === vertical && Math.abs(g.pos - pos) < 0.5)) {
    guides.value.push({ vertical, pos });
  }
}

function guideStyle(g: { vertical: boolean; pos: number }): Record<string, string> {
  return g.vertical
    ? { left: `${g.pos}px`, top: "0", height: `${paper.value.height}px` }
    : { top: `${g.pos}px`, left: "0", width: `${paper.value.width}px` };
}

/** 拖拽移动控件 */
function onWidgetMouseDown(e: MouseEvent, w: PrintWidget) {
  selectWidget(w, e.shiftKey);
  if (w.locked || e.button !== 0) return;
  const startX = e.clientX;
  const startY = e.clientY;
  const origX = w.x;
  const origY = w.y;
  let moved = false;

  const onMove = (ev: MouseEvent) => {
    const dx = (ev.clientX - startX) / zoomFactor.value;
    const dy = (ev.clientY - startY) / zoomFactor.value;
    const snapped = snapPosition(origX + dx, origY + dy, w);
    w.x = Math.round(clamp(snapped.x, 0, paper.value.width - w.width));
    w.y = Math.round(clamp(snapped.y, 0, paper.value.height - w.height));
    moved = true;
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    guides.value = [];
    if (moved) {
      pushHistory();
      sync();
    }
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

/** 8 向手柄缩放 */
function onHandleMouseDown(e: MouseEvent, w: PrintWidget, dir: (typeof handles)[number]) {
  e.stopPropagation();
  const startX = e.clientX;
  const startY = e.clientY;
  const orig = { x: w.x, y: w.y, width: w.width, height: w.height };
  const min = 3;

  const onMove = (ev: MouseEvent) => {
    const dx = (ev.clientX - startX) / zoomFactor.value;
    const dy = (ev.clientY - startY) / zoomFactor.value;
    if (dir.includes("e")) w.width = Math.max(min, orig.width + dx);
    if (dir.includes("s")) w.height = Math.max(min, orig.height + dy);
    if (dir.includes("w")) {
      w.width = Math.max(min, orig.width - dx);
      w.x = orig.x + (orig.width - w.width);
    }
    if (dir.includes("n")) {
      w.height = Math.max(min, orig.height - dy);
      w.y = orig.y + (orig.height - w.height);
    }
    w.x = Math.round(clamp(w.x, 0, paper.value.width - min));
    w.y = Math.round(clamp(w.y, 0, paper.value.height - min));
    w.width = Math.round(clamp(w.width, min, paper.value.width - w.x));
    w.height = Math.round(clamp(w.height, min, paper.value.height - w.y));
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    pushHistory();
    sync();
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

/** 双击文本快速编辑 */
function onWidgetDblClick(w: PrintWidget) {
  selectWidget(w);
  if (w.kind === "text") {
    const text = window.prompt("编辑文本内容（支持 {{变量}}）：", (w as PrintWidget & { text: string }).text);
    if (text !== null) {
      (w as PrintWidget & { text: string }).text = text;
      pushHistory();
      sync();
    }
  }
}

/** 从控件库拖入 */
function onToolDragStart(e: DragEvent, kind: PrintWidgetKind) {
  e.dataTransfer?.setData("application/x-print-widget", kind);
  e.dataTransfer!.effectAllowed = "copy";
}

function onFieldDragStart(e: DragEvent, v: PrintVariable) {
  e.dataTransfer?.setData("application/x-print-field", JSON.stringify(v));
  e.dataTransfer!.effectAllowed = "copy";
}

function onCanvasDrop(e: DragEvent) {
  const paperEl = (e.currentTarget as HTMLElement).querySelector(".canvas-paper");
  if (!paperEl) return;
  const rect = paperEl.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * paper.value.width;
  const y = ((e.clientY - rect.top) / rect.height) * paper.value.height;

  const widgetKind = e.dataTransfer?.getData("application/x-print-widget");
  const fieldData = e.dataTransfer?.getData("application/x-print-field");
  if (widgetKind) {
    addWidgetByKind(widgetKind as PrintWidgetKind, x, y);
  } else if (fieldData) {
    const v = JSON.parse(fieldData) as PrintVariable;
    addFieldWidget(v, x, y);
  }
}

/** 添加工具控件（点击或拖入） */
function addWidgetByKind(kind: PrintWidgetKind, x?: number, y?: number) {
  const w = createWidget(kind, x ?? 10, y ?? 10, props.billType as PrintBillType);
  w.x = Math.round(clamp(w.x, 0, paper.value.width - w.width));
  w.y = Math.round(clamp(w.y, 0, paper.value.height - w.height));
  widgets.value.push(w);
  selectedIds.value = [w.id];
  pushHistory();
  sync();
}

/** 添加数据字段控件 */
function addFieldWidget(v: PrintVariable, x?: number, y?: number) {
  const w = createWidget("field", x ?? 10, y ?? 10, props.billType as PrintBillType) as PrintWidget & {
    fieldKey: string;
    label: string;
  };
  w.fieldKey = v.key;
  w.label = v.label;
  w.x = Math.round(clamp(w.x, 0, paper.value.width - w.width));
  w.y = Math.round(clamp(w.y, 0, paper.value.height - w.height));
  widgets.value.push(w);
  selectedIds.value = [w.id];
  pushHistory();
  sync();
}

/** 字段 key 变更时自动补默认显示名 */
function onFieldKeyChange(key: string) {
  const w = selectedWidget.value as PrintWidget & { label: string };
  if (!w) return;
  const found = fieldItems.value.find((v) => v.key === key);
  if (found && !w.label) w.label = found.label;
  mutate();
}

/** 对齐工具：单选对齐纸张，多选对齐到组边界 */
function alignWidgets(type: "left" | "hcenter" | "vcenter" | "right") {
  const selected = widgets.value.filter((w) => selectedIds.value.includes(w.id));
  if (selected.length === 0) {
    ElMessage.info("请先选中控件（点击画布上的控件，或 Shift 多选）");
    return;
  }
  if (selected.length === 1) {
    const w = selected[0];
    if (type === "left") w.x = paper.value.marginLeft;
    if (type === "right") w.x = paper.value.width - paper.value.marginRight - w.width;
    if (type === "hcenter") w.x = Math.round((paper.value.width - w.width) / 2);
    if (type === "vcenter") w.y = Math.round((paper.value.height - w.height) / 2);
  } else {
    const minX = Math.min(...selected.map((w) => w.x));
    const maxX = Math.max(...selected.map((w) => w.x + w.width));
    const minY = Math.min(...selected.map((w) => w.y));
    const maxY = Math.max(...selected.map((w) => w.y + w.height));
    if (type === "left") selected.forEach((w) => (w.x = minX));
    if (type === "right") selected.forEach((w) => (w.x = maxX - w.width));
    if (type === "hcenter") selected.forEach((w) => (w.x = minX + (maxX - minX) / 2 - w.width / 2));
    if (type === "vcenter") selected.forEach((w) => (w.y = minY + (maxY - minY) / 2 - w.height / 2));
  }
  pushHistory();
  sync();
}

/** 表格列操作 */
function moveColumn(w: PrintTableWidget, index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= w.columns.length) return;
  const [item] = w.columns.splice(index, 1);
  w.columns.splice(target, 0, item);
  mutate();
}

function removeColumn(w: PrintTableWidget, index: number) {
  w.columns.splice(index, 1);
  mutate();
}

function addColumn(w: PrintTableWidget) {
  const key = `col_${uid()}`;
  const col: PrintTableColumn = { key, label: "新列", width: 12, align: "left" };
  w.columns.push(col);
  mutate();
}

/** 纸张类型切换 */
function onPaperTypeChange(type: PrintPaperType) {
  const size = PAPER_DEFAULT_SIZE[type];
  if (size) {
    paper.value.width = size.width;
    paper.value.height = size.height;
  }
  mutate();
}

function onOrientationChange(orientation: "portrait" | "landscape") {
  paper.value.orientation = orientation;
  if (orientation === "landscape" && paper.value.width < paper.value.height) {
    [paper.value.width, paper.value.height] = [paper.value.height, paper.value.width];
  }
  if (orientation === "portrait" && paper.value.width > paper.value.height) {
    [paper.value.width, paper.value.height] = [paper.value.height, paper.value.width];
  }
  mutate();
}

/** 编辑操作：同步 + 防抖快照 */
let mutateTimer: ReturnType<typeof setTimeout> | null = null;
function mutate() {
  sync();
  if (mutateTimer) clearTimeout(mutateTimer);
  mutateTimer = setTimeout(() => {
    pushHistory();
  }, 600);
}

/** 预览 */
function preview() {
  sync();
  try {
    const json = JSON.parse(jsonText()) as PrintTemplateV3;
    const html = renderV3PaperHtml(json, sampleVars(props.billType), props.billType);
    const win = openPrintWindow();
    if (win) {
      fillPrintWindow(win, `预览：${billTypeLabel.value}`, html, 1);
    } else {
      ElMessage.error("请允许弹出窗口以预览");
    }
  } catch (e) {
    ElMessage.error(`预览失败：${e instanceof Error ? e.message : String(e)}`);
  }
}

/** 打开时按画布可用宽度自适应缩放（平铺工作区后画布更大） */
function fitZoom() {
  nextTick(() => {
    const canvasEl = document.querySelector(".editor-canvas") as HTMLElement | null;
    if (!canvasEl) return;
    // 纸面按实际纸张等比显示（宽度适配，默认不超过 150%，可手动放大）
    const avail = canvasEl.clientWidth * 0.92 - 48;
    const fit = Math.floor((avail / paper.value.width) * 100);
    zoom.value = Math.min(150, Math.max(40, fit));
  });
}

function widgetKindLabel(kind: PrintWidgetKind): string {
  return toolItems.find((t) => t.kind === kind)?.label ?? kind;
}

/** 键盘快捷键：Delete 删除、Ctrl+Z/Y 撤销重做 */
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    if (selectedIds.value.length > 0) {
      e.preventDefault();
      removeSelected();
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
    e.preventDefault();
    redo();
  }
}

watch(
  () => props.modelValue,
  (value) => {
    // 外部变更（如重置/另存）时重新解析；自身编辑产生的变更忽略
    if (value !== jsonText()) {
      const wasEditing = selectedIds.value.length > 0;
      parseModel();
      if (!wasEditing) selectedIds.value = [];
    }
  }
);

onMounted(() => {
  parseModel();
  // 布局稳定后再自适应（AI 面板/侧边栏就绪后画布宽度才正确）
  setTimeout(fitZoom, 350);
  const canvasEl = document.querySelector(".editor-canvas") as HTMLElement | null;
  if (canvasEl && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      if (!manualZoom.value) fitZoom();
    });
    resizeObserver.observe(canvasEl);
  }
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("keydown", onKeydown);
  if (mutateTimer) clearTimeout(mutateTimer);
});
</script>

<style scoped>
.print-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--border-light, #e5e6eb);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.editor-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-light, #e5e6eb);
  background: var(--gray-50, #fafafa);
  flex-shrink: 0;
}
.tb-left,
.tb-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.tb-title {
  font-size: 13px;
  font-weight: 600;
}
.tb-paper {
  font-size: 12px;
  color: var(--text-secondary, #666);
}
.tb-center {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tb-align-group {
  margin-left: 4px;
}
.tb-zoom {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary, #666);
}
.zoom-num {
  min-width: 36px;
  text-align: right;
}
.editor-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.widget-library {
  width: 150px;
  flex-shrink: 0;
  padding: 10px;
  border-right: 1px solid var(--border-light, #e5e6eb);
  background: var(--gray-50, #fafafa);
  overflow-y: auto;
}
.lib-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #666);
  margin: 8px 0 6px;
}
.lib-section-title:first-child {
  margin-top: 0;
}
.lib-hint {
  font-size: 11px;
  color: var(--text-muted, #aaa);
  margin-bottom: 6px;
}
.lib-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  margin-bottom: 5px;
  border: 1px solid #d9d9d9;
  border-radius: 5px;
  background: #fff;
  font-size: 12px;
  cursor: grab;
  transition: all 120ms;
}
.lib-item:hover {
  border-color: var(--color-primary, #1677ff);
  color: var(--color-primary, #1677ff);
}
.lib-ico {
  font-weight: 700;
  min-width: 20px;
  text-align: center;
}
.lib-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 8px;
  margin-bottom: 4px;
  border: 1px dashed #d9d9d9;
  border-radius: 5px;
  background: #fff;
  font-size: 12px;
  cursor: grab;
  transition: all 120ms;
}
.lib-field:hover {
  border-color: var(--color-primary, #1677ff);
  color: var(--color-primary, #1677ff);
}
.lib-fkey {
  font-size: 10px;
  color: var(--text-muted, #aaa);
}
.editor-canvas {
  flex: 1;
  min-width: 0;
  overflow: auto;
  /* 白板平铺：画布白底，纸面最大化铺开 */
  background: #fff;
  position: relative;
}
.canvas-scroll {
  padding: 24px;
  min-height: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.canvas-paper {
  position: relative;
  background: #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08), 0 4px 24px rgba(0, 0, 0, 0.08);
  transform-origin: top left;
  flex-shrink: 0;
}
.ed-widget {
  position: absolute;
  box-sizing: border-box;
  cursor: move;
  border: 1px dashed transparent;
}
.ed-widget:hover {
  border-color: #b8c6e8;
}
.ed-widget.selected {
  border-color: var(--color-primary, #1677ff);
  outline: 1px solid var(--color-primary, #1677ff);
  outline-offset: -1px;
}
.ed-widget.locked {
  cursor: not-allowed;
  opacity: 0.85;
}
.ed-widget-inner {
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}
.ed-widget-inner :deep(.zx-table) {
  font-size: inherit;
}
.ed-handle {
  position: absolute;
  width: 7px;
  height: 7px;
  background: #fff;
  border: 1px solid var(--color-primary, #1677ff);
  z-index: 5;
}
.ed-handle.nw { left: -4px; top: -4px; cursor: nwse-resize; }
.ed-handle.n { left: 50%; top: -4px; margin-left: -3px; cursor: ns-resize; }
.ed-handle.ne { right: -4px; top: -4px; cursor: nesw-resize; }
.ed-handle.e { right: -4px; top: 50%; margin-top: -3px; cursor: ew-resize; }
.ed-handle.se { right: -4px; bottom: -4px; cursor: nwse-resize; }
.ed-handle.s { left: 50%; bottom: -4px; margin-left: -3px; cursor: ns-resize; }
.ed-handle.sw { left: -4px; bottom: -4px; cursor: nesw-resize; }
.ed-handle.w { left: -4px; top: 50%; margin-top: -3px; cursor: ew-resize; }
.ed-size-tip {
  position: absolute;
  bottom: calc(100% + 3px);
  left: 0;
  background: var(--color-primary, #1677ff);
  color: #fff;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
  z-index: 6;
}
.ed-lock-tag {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
}
.ed-guide {
  position: absolute;
  background: #ff5b5b;
  z-index: 4;
  pointer-events: none;
}
.ed-guide.v { width: 1px; }
.ed-guide.h { height: 1px; }
.canvas-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-muted, #aaa);
  font-size: 13px;
  line-height: 1.8;
  pointer-events: none;
}
.props-panel {
  width: 240px;
  flex-shrink: 0;
  border-left: 1px solid var(--border-light, #e5e6eb);
  background: #fff;
  overflow-y: auto;
}
.props-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--border-light, #e5e6eb);
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 2;
}
.props-body {
  padding: 10px 12px 20px;
}
.props-body :deep(.el-form-item) {
  margin-bottom: 8px;
}
.props-body :deep(.el-divider--horizontal) {
  margin: 12px 0 8px;
}
.props-body :deep(.el-divider__text) {
  font-size: 12px;
  color: var(--text-secondary, #666);
}
.prop-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 8px;
}
.props-tip {
  font-size: 11px;
  color: var(--text-muted, #aaa);
  line-height: 1.5;
  margin: 4px 0 8px;
}
.border-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.table-col-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 4px 0;
}
.table-col-row {
  display: flex;
  align-items: center;
  gap: 3px;
}
.col-label-input {
  width: 86px;
}
.col-align-select {
  width: 46px;
}
.col-width-input {
  width: 52px;
}
.add-col-btn {
  width: 100%;
  margin-top: 2px;
}
</style>
