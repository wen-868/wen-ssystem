/**
 * 工作台双模式状态与特征开关（WORKBENCH-02）
 *
 * - 模式：`human`（人工操作台，承载现有二级页面）/ `ai`（AI 数字员工骨架）。
 * - 开关：默认启用新壳；可用 localStorage `wb.shell.v2=0` 或构建期
 *   `VITE_WORKBENCH_SHELL_V2=0` 回退到旧 `MainLayout`（灰度回滚路径）。
 */
import { ref } from "vue";

export type WorkbenchMode = "human" | "ai";

export const WORKBENCH_MODE_KEY = "wb.shell.mode";
export const WORKBENCH_SHELL_FLAG_KEY = "wb.shell.v2";

function readLocal(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    // 隐私模式/禁用存储时仅保留内存态
  }
}

/** 新壳是否启用：显式关闭优先，其次构建期环境变量，最后默认启用 */
export function isWorkbenchShellV2Enabled(): boolean {
  const stored = readLocal(WORKBENCH_SHELL_FLAG_KEY);
  if (stored === "0" || stored === "off") return false;
  if (stored === "1" || stored === "on") return true;
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const configured = env?.VITE_WORKBENCH_SHELL_V2;
  if (configured === "0" || configured === "false") return false;
  if (configured === "1" || configured === "true") return true;
  return true;
}

/** 当前工作台模式（默认人工操作台；刷新后保持上次选择） */
export const workbenchMode = ref<WorkbenchMode>(readLocal(WORKBENCH_MODE_KEY) === "ai" ? "ai" : "human");

export function setWorkbenchMode(mode: WorkbenchMode): void {
  workbenchMode.value = mode;
  writeLocal(WORKBENCH_MODE_KEY, mode);
}
