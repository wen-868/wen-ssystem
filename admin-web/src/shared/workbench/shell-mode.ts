/**
 * 工作台双模式状态与特征开关（WORKBENCH-02 · WORKBENCH-06 修订）
 *
 * - 模式：`human`（人工操作台，承载现有二级页面）/ `ai`（AI 主面）。
 * - AI 面（WORKBENCH-06 · 原型对齐）：`feed`（工作台信息流，**默认主面**）/ `chat`（AI 会话）。
 *   原型口径：默认界面=工作台信息流；点「新对话/会话」才进入对话（`paintMain`，L2061）。
 * - 默认模式改为 `ai`（face=feed）：依据 `R101-WORKBENCH-05-凌舟复核纠正-20261024.md` §二
 *   「AI 信息流/会话作为默认主面」；人工页仍从二级菜单/路由直达（`actSub` 同语义）。
 * - 开关：可用 localStorage `wb.shell.v2=0` 或构建期
 *   `VITE_WORKBENCH_SHELL_V2=0` 回退到旧 `MainLayout`（灰度回滚路径，未变）。
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

/**
 * 当前工作台模式。
 *
 * **默认 = `ai`（信息流主面）**，依据 WORKBENCH-06 卡与 WT-05 纠正卡 §二：
 *   原型默认界面 = 工作台信息流（`mainMode='feed'`，paintMain L2061），人工页由
 *   二级菜单点击进入（actSub L2314）。旧默认 `human` 是 WT-02 骨架阶段的偏差
 *   （纠正卡 §三.1 已定性"从骨架阶段就把原型降级成普通侧栏+顶部模式 tab"）。
 * 显式持久化过选择时以持久化值为准（用户点过「人工」就记住，刷新仍回人工）。
 * 灰度回滚到旧壳（wb.shell.v2=0）时本模式不参与渲染，行为与改动前一致。
 */
export const workbenchMode = ref<WorkbenchMode>(
  readLocal(WORKBENCH_MODE_KEY) === "human" ? "human" : "ai",
);

export function setWorkbenchMode(mode: WorkbenchMode): void {
  workbenchMode.value = mode;
  writeLocal(WORKBENCH_MODE_KEY, mode);
}
