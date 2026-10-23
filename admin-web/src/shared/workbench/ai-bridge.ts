/**
 * AI 代办桥上下文（WORKBENCH-04）
 *
 * 职责边界：
 *   - 只把「当前页真实上下文」交给既有 AI 会话（AiSidePanel → POST /api/chat）；
 *   - 不执行任何写动作、不新增第二套动作目录、不绕过预览→确认→执行→撤销；
 *   - PLANNED/BLOCKED 动作明文标注「不能代办」并给出人工回退路径。
 *
 * 动作行一律取自 30 矩阵台账（parity-actions-gen.ts），禁止按名称相似临时编造。
 */
import type { ParityActionRow } from "./capability-types";
import { PARITY_ACTION_ROWS } from "./parity-actions-gen";

export interface PageDelegationInput {
  menuCode: string;
  title: string;
  routeName: string;
  path: string;
  /** 当前实体 ID（路由 params/query 可得时）；未知传 null */
  entityId?: string | null;
  /** 当前页动作行（默认由 routeNames 从静态台账筛选） */
  actionRows?: readonly ParityActionRow[];
}

export interface PageDelegationAction {
  id: string;
  status: ParityActionRow["status"];
  apiPath: string;
  /** LIVE/PARTIAL 才允许 AI 发起；PLANNED/BLOCKED 必须由人工操作 */
  canDelegate: boolean;
  note: string;
  fallback: string;
}

export interface PageDelegationResult {
  prompt: string;
  actions: readonly PageDelegationAction[];
  delegableCount: number;
  blockedCount: number;
  hasWrites: boolean;
  /** UI 一行摘要 */
  summary: string;
}

/** 按 routeName 从静态动作台账筛选当前页动作行（精确匹配，不做名称相似） */
export function selectPageActionRows(
  routeNames: readonly string[],
  rows: readonly ParityActionRow[] = PARITY_ACTION_ROWS,
): ParityActionRow[] {
  const wanted = new Set(routeNames);
  return rows.filter((row) => row.routeNames.some((name) => wanted.has(name)));
}

function actionNote(row: ParityActionRow): string {
  switch (row.status) {
    case "LIVE":
      return "可代办：AI 发起写操作后必须走预览→确认→执行→撤销";
    case "PARTIAL":
      return "部分可代办：AI 工具存在但未纳入确认链，只给建议，不得直接执行写操作";
    case "PLANNED":
      return "不能代办：AI 底座未注册覆盖该接口的工具，请人工在页面操作";
    case "BLOCKED":
      return "不能代办：该接口在本仓无对应后端路由注册，权限/审计不可判定，请人工在页面操作";
  }
}

function actionFallback(row: ParityActionRow): string {
  return `人工：${row.pages[0] ?? "对应页面"} 内该动作（${row.method} ${row.apiPath}）`;
}

export function buildPageDelegation(input: PageDelegationInput): PageDelegationResult {
  const rows = input.actionRows ?? selectPageActionRows([input.routeName]);
  const actions: PageDelegationAction[] = rows.map((row) => ({
    id: row.id,
    status: row.status,
    apiPath: row.apiPath,
    canDelegate: row.status === "LIVE" || row.status === "PARTIAL",
    note: actionNote(row),
    fallback: actionFallback(row),
  }));
  const delegable = actions.filter((action) => action.canDelegate);
  const blocked = actions.filter((action) => !action.canDelegate);

  const lines = [
    "【AI 代办当前页】请基于以下真实上下文协助我；不要直接执行任何写操作。",
    "如需写操作，必须先给出预览并等待我确认（预览→确认→执行→撤销），不得跳过确认链。",
    `菜单：${input.title}（${input.menuCode}）`,
    `路由：${input.routeName} ${input.path}`,
    `当前实体 ID：${input.entityId ?? "未提供"}`,
    `本页写动作共 ${actions.length} 项：`,
    ...actions.map(
      (action) => `- ${action.id} [${action.status}] ${action.note}；回退：${action.fallback}`,
    ),
  ];
  if (actions.length === 0) {
    lines.push("- 该页无写动作（只读页），只能做查询与解释，不得编造写入口。");
  }
  if (blocked.length > 0) {
    lines.push(`其中 ${blocked.length} 项不能代办，请提示我人工操作路径，不要给出“已可执行”的暗示。`);
  }

  return {
    prompt: lines.join("\n"),
    actions,
    delegableCount: delegable.length,
    blockedCount: blocked.length,
    hasWrites: actions.length > 0,
    summary:
      actions.length === 0
        ? "本页为只读页：AI 只做查询解释，无写动作"
        : `本页 ${actions.length} 项写动作：可代办 ${delegable.length} 项 · 不能代办 ${blocked.length} 项`,
  };
}