import { nextTick, reactive } from "vue";

/**
 * 全局表格偏好（列宽 + 列前后位置），Excel 式鼠标拖拽调整并持久化
 * - 列宽：el-table border + @header-dragend 自动保存
 * - 列顺序：表头 th 拖拽重排，自动保存/恢复
 * - 存储变量：zhixiang:table-prefs:<表名>（localStorage），客户自调后保留
 *
 * 用法：
 *   const tableRef = ref();
 *   const { widthOf, onDragEnd, setupReorder } = useTablePrefs("sale-bills");
 *   onMounted(() => setupReorder(tableRef));
 *   <el-table ref="tableRef" border @header-dragend="onDragEnd">
 *     <el-table-column :width="widthOf('billNo', 160)" ... />
 */

const PREF_PREFIX = "zhixiang:table-prefs";

interface TablePrefs {
  widths: Record<string, number>;
  order: string[];
}

function load(tableKey: string): TablePrefs {
  try {
    const raw = localStorage.getItem(`${PREF_PREFIX}:${tableKey}`);
    if (!raw) return { widths: {}, order: [] };
    const d = JSON.parse(raw);
    return { widths: d.widths || {}, order: d.order || [] };
  } catch {
    return { widths: {}, order: [] };
  }
}

function persist(tableKey: string, prefs: TablePrefs) {
  try {
    localStorage.setItem(`${PREF_PREFIX}:${tableKey}`, JSON.stringify(prefs));
  } catch {
    /* 忽略 */
  }
}

export function useTablePrefs(tableKey: string, defaults: Record<string, number> = {}) {
  const prefs = reactive<TablePrefs>(load(tableKey));
  const widths = reactive<Record<string, number>>({ ...defaults, ...prefs.widths });

  /** 取列宽：优先客户自调值，其次默认值 */
  function widthOf(prop: string, fallback = 120): number {
    return widths[prop] ?? fallback;
  }

  /** 绑定 el-table @header-dragend：保存拖拽后列宽（EP 参数：newWidth, oldWidth, column） */
  function onDragEnd(newWidth: number, _oldWidth: number, column?: { property?: string; prop?: string }) {
    const prop = column?.property ?? column?.prop;
    if (!prop || newWidth === undefined) return;
    widths[prop] = Math.max(40, Math.round(newWidth));
    prefs.widths[prop] = widths[prop];
    persist(tableKey, { widths: prefs.widths, order: prefs.order });
  }

  function keyOf(c: any): string {
    return c?.id || c?.property || c?.label || "";
  }

  /** 挂载后调用：恢复保存的列顺序 */
  async function restoreOrder(tableRef: any) {
    await nextTick();
    const store = tableRef?.value?.store;
    const cols = store?.states?._columns?.value;
    if (!store || !Array.isArray(cols) || prefs.order.length === 0) return;
    cols.sort((a: any, b: any) => {
      const ia = prefs.order.indexOf(keyOf(a));
      const ib = prefs.order.indexOf(keyOf(b));
      return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
    });
    store.updateColumns?.();
    store.scheduleLayout?.();
  }

  /** 挂载后调用：启用表头拖拽重排（非固定列），结果持久化 */
  function setupReorder(tableRef: any) {
    restoreOrder(tableRef);
    const bind = () => {
      const inst = tableRef?.value;
      const el = (inst?.$el || inst) as HTMLElement | undefined;
      if (!el) return;
      const header = el.querySelector(".el-table__header-wrapper");
      if (!header) return;
      const store = inst?.store;
      if (!store) return;
      let dragCol: any = null;

      const colFromTh = (th: Element): any => {
        const cls = Array.from(th.classList).find((c) => /column_\d+/.test(c));
        if (!cls || !store?.states?.columns?.value) return null;
        return store.states.columns.value.find((c: any) => c.id === cls) || null;
      };

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
          prefs.order = cols.map(keyOf).filter(Boolean);
          persist(tableKey, { widths: prefs.widths, order: prefs.order });
          store.updateColumns?.();
          store.scheduleLayout?.();
        });
      });
    };
    nextTick(bind);
    // 数据加载/分页等导致表头重建时自动重新绑定
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(bind, 60);
    });
    const startObserve = () => {
      const inst = tableRef?.value;
      const el = (inst?.$el || inst) as HTMLElement | undefined;
      if (el) {
        observer.observe(el, { childList: true, subtree: true });
      } else {
        setTimeout(startObserve, 100);
      }
    };
    startObserve();
  }

  /** 重置该表列宽与顺序为默认 */
  function resetPrefs() {
    Object.keys(widths).forEach((k) => delete widths[k]);
    prefs.widths = {};
    prefs.order = [];
    try {
      localStorage.removeItem(`${PREF_PREFIX}:${tableKey}`);
    } catch {
      /* 忽略 */
    }
  }

  return { widthOf, onDragEnd, setupReorder, restoreOrder, resetPrefs };
}
