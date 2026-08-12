import { reactive } from "vue";

/**
 * 全局表格列宽记忆（表单规范：列宽像 Excel 一样支持鼠标拖拽调整，并持久化）
 * - 每次拖拽列宽（el-table @header-dragend）自动保存到 localStorage
 * - 同一表格下次打开恢复客户自调的宽度
 * - 用法：
 *   const { widthOf, onDragEnd } = useTableWidths("sale-bills");
 *   <el-table @header-dragend="onDragEnd">
 *     <el-table-column :width="widthOf('billNo', 200)" ... />
 */

function storageKey(tableKey: string): string {
  return `zhixiang:table-widths:${tableKey}`;
}

function loadWidths(tableKey: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey(tableKey));
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function useTableWidths(tableKey: string, defaults: Record<string, number> = {}) {
  const widths = reactive<Record<string, number>>({ ...defaults, ...loadWidths(tableKey) });

  /** 取列宽：优先客户自调值，其次默认值 */
  function widthOf(prop: string, fallback = 120): number {
    return widths[prop] ?? fallback;
  }

  /** 绑定到 el-table 的 @header-dragend，保存拖拽后的列宽（EP 参数：newWidth, oldWidth, column, event） */
  function onDragEnd(newWidth: number, _oldWidth: number, column?: { property?: string; prop?: string }) {
    const prop = column?.property ?? column?.prop;
    if (!prop || newWidth === undefined) return;
    widths[prop] = Math.max(40, Math.round(newWidth));
    try {
      localStorage.setItem(storageKey(tableKey), JSON.stringify(widths));
    } catch {
      /* 存储失败忽略 */
    }
  }

  /** 重置某表列宽为默认 */
  function resetWidths() {
    Object.keys(widths).forEach((k) => delete widths[k]);
    try {
      localStorage.removeItem(storageKey(tableKey));
    } catch {
      /* 忽略 */
    }
  }

  return { widths, widthOf, onDragEnd, resetWidths };
}
