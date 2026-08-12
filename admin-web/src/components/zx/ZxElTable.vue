<template>
  <ElTable ref="innerRef" v-bind="attrs" border @header-dragend="onHeaderDragend">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope" />
    </template>
  </ElTable>
</template>

<script setup lang="ts">
/**
 * 全局表格增强（替代所有 <el-table>）：
 * - 自动 border：启用 Element Plus 列宽鼠标拖拽（Excel 式）
 * - 表头整格拖拽换列（Excel 式），列宽/列序持久化到 localStorage
 * - 数据加载/分页后表头重建自动重新绑定
 */
import { nextTick, onBeforeUnmount, onMounted, ref, useAttrs } from "vue";
import { ElTable } from "element-plus/es/components/table/index";
// 显式引入 Element Plus 表格样式（替换解析器后需手动补充，否则表头行高/内边距缺失）
import "element-plus/es/components/table/style/css";

const attrs = useAttrs();
const innerRef = ref<any>(null);

const PREF_PREFIX = "zhixiang:table-prefs";

function tableKey(): string {
  const custom = (attrs as any)["data-table-key"];
  if (custom) return String(custom);
  const cls = typeof attrs.class === "string" ? attrs.class : "";
  return `${window.location.pathname}:${cls || "default"}`;
}

interface TablePrefs {
  widths: Record<string, number>;
  order: string[];
}

function load(): TablePrefs {
  try {
    const raw = localStorage.getItem(`${PREF_PREFIX}:${tableKey()}`);
    if (!raw) return { widths: {}, order: [] };
    const d = JSON.parse(raw);
    return { widths: d.widths || {}, order: d.order || [] };
  } catch {
    return { widths: {}, order: [] };
  }
}

function persist(prefs: TablePrefs) {
  try {
    localStorage.setItem(`${PREF_PREFIX}:${tableKey()}`, JSON.stringify(prefs));
  } catch {
    /* 忽略 */
  }
}

function keyOf(c: any): string {
  return c?.id || c?.property || c?.prop || c?.label || "";
}

function onHeaderDragend(newWidth: number, _oldWidth: number, column?: { property?: string; prop?: string }) {
  const prop = column?.property ?? column?.prop;
  if (!prop || newWidth === undefined) return;
  const prefs = load();
  prefs.widths[prop] = Math.max(40, Math.round(newWidth));
  persist(prefs);
}

function restoreOrderAndWidths(store: any) {
  const cols = store?.states?._columns?.value;
  if (!store || !Array.isArray(cols)) return;
  const prefs = load();
  if (prefs.order.length) {
    cols.sort((a: any, b: any) => {
      const ia = prefs.order.indexOf(keyOf(a));
      const ib = prefs.order.indexOf(keyOf(b));
      return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
    });
  }
  cols.forEach((c: any) => {
    const prop = c?.property ?? c?.prop;
    if (prop && prefs.widths[prop]) c.width = prefs.widths[prop];
  });
  store.updateColumns?.();
  store.scheduleLayout?.();
}

function bindReorder() {
  const inst = innerRef.value;
  const el = (inst?.$el || inst) as HTMLElement | undefined;
  if (!el) return;
  const header = el.querySelector(".el-table__header-wrapper");
  const store = inst?.store;
  if (!header || !store) return;

  const colFromTh = (th: Element): any => {
    const cls = Array.from(th.classList).find((c) => /column_\d+/.test(c));
    if (!cls || !store.states?.columns?.value) return null;
    return store.states.columns.value.find((c: any) => c.id === cls) || null;
  };

  let dragCol: any = null;
  header.querySelectorAll("th").forEach((th) => {
    if (th.getAttribute("data-zx-reorder") === "1") return;
    th.setAttribute("data-zx-reorder", "1");
    th.setAttribute("draggable", "true");
    th.classList.add("zx-col-draggable");
    th.addEventListener("dragstart", (e) => {
      dragCol = colFromTh(th);
      e.dataTransfer?.setData("text/plain", "x");
      th.classList.add("zx-col-dragging");
    });
    th.addEventListener("dragend", () => {
      dragCol = null;
      header.querySelectorAll("th").forEach((t) => t.classList.remove("zx-col-dragging", "zx-col-over"));
    });
    th.addEventListener("dragover", (e) => {
      e.preventDefault();
      th.classList.add("zx-col-over");
    });
    th.addEventListener("dragleave", () => th.classList.remove("zx-col-over"));
    th.addEventListener("drop", (e) => {
      e.preventDefault();
      th.classList.remove("zx-col-over");
      if (!dragCol) return;
      const targetCol = colFromTh(th);
      if (!targetCol || targetCol.id === dragCol.id) return;
      const cols = store.states._columns.value;
      const from = cols.indexOf(dragCol);
      const to = cols.indexOf(targetCol);
      if (from < 0 || to < 0) return;
      cols.splice(from, 1);
      cols.splice(to, 0, dragCol);
      const prefs = load();
      prefs.order = cols.map(keyOf).filter(Boolean);
      persist(prefs);
      store.updateColumns?.();
      store.scheduleLayout?.();
    });
    // 右键表头：重置本表列宽/列序（防止误拖后无法恢复）
    th.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      ElMessageBox.confirm("重置本表列宽与列顺序为默认？", "重置表格", { type: "warning" })
        .then(() => {
          try {
            localStorage.removeItem(`${PREF_PREFIX}:${tableKey()}`);
          } catch {
            /* 忽略 */
          }
          window.location.reload();
        })
        .catch(() => {});
    });
  });
}

let observer: MutationObserver | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  nextTick(() => {
    const store = innerRef.value?.store;
    if (store) {
      restoreOrderAndWidths(store);
      bindReorder();
    }
    const el = (innerRef.value?.$el || innerRef.value) as HTMLElement | undefined;
    if (el) {
      observer = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          bindReorder();
        }, 60);
      });
      observer.observe(el, { childList: true, subtree: true });
    }
  });
});

onBeforeUnmount(() => {
  observer?.disconnect();
  if (timer) clearTimeout(timer);
});
</script>
