import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";

/**
 * C1-2 B1：套餐升降级流向报表（只读聚合）
 *
 * 数据源（先找源、后实现，非编造）：
 * - `t_subscription_operation_log`（`docs/migrations/033_add_subscription_operation_log.sql`）
 *   的 `operation_type` 已真实写入 UPGRADE / DOWNGRADE：
 *   `backend/src/services/admin/subscription.service.ts:330-333`（changePlan 按价差写 UPGRADE/DOWNGRADE）。
 * - 套餐名取自 `t_subscription_plan.plan_name`（LEFT JOIN，套餐被删则名称为 null，不用假名填充）。
 * - 租户数取 `COUNT(DISTINCT t_subscription.tenant_id)`（同一租户多次变更只计一次）。
 *
 * 若无任何变更记录 → `records: []` 空态（前端保持空态，禁止随机/写死数据凑图，硬性口径第 4 条）。
 */

export const UPGRADE_FLOW_RANGES = ["month", "3m", "12m"] as const;
export type UpgradeFlowRange = (typeof UPGRADE_FLOW_RANGES)[number];

/** range → 起始月偏移（month=当月，3m=当月+前 2 个月，12m=当月+前 11 个月） */
const RANGE_MONTHS: Record<UpgradeFlowRange, number> = { month: 0, "3m": 2, "12m": 11 };

const DATA_SOURCE = "t_subscription_operation_log(operation_type IN ('UPGRADE','DOWNGRADE'))";
const MAX_ROWS = 200;

interface FlowRow {
  direction: string;
  fromPlanId: number | null;
  fromPlanName: string | null;
  toPlanId: number | null;
  toPlanName: string | null;
  eventCount: number | string;
  tenantCount: number | string;
  lastAt: Date | string | null;
}

interface SummaryRow {
  events: number | string;
  tenants: number | string;
}

export interface UpgradeFlowRow {
  /** UPGRADE / DOWNGRADE（库里原值） */
  direction: "UPGRADE" | "DOWNGRADE";
  /** 前端展示口径：UP=升级 / DOWN=降级 */
  dir: "UP" | "DOWN";
  fromPlanId: number | null;
  fromPlanName: string | null;
  toPlanId: number | null;
  toPlanName: string | null;
  eventCount: number;
  tenantCount: number;
  lastAt: string | null;
}

export interface UpgradeFlowReport {
  range: UpgradeFlowRange;
  rangeStart: string;
  dataSource: string;
  summary: { events: number; tenants: number };
  records: UpgradeFlowRow[];
}

function formatDateTime(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(
      value.getHours()
    )}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  return String(value);
}

/** range 参数校验：非法 → 400（不静默回落默认值） */
export function normalizeRange(value: unknown): UpgradeFlowRange {
  const key = String(value ?? "month").trim().toLowerCase();
  if (!(UPGRADE_FLOW_RANGES as readonly string[]).includes(key)) {
    throw new AppError(`range 非法（可选：${UPGRADE_FLOW_RANGES.join(" / ")}）`, 400);
  }
  return key as UpgradeFlowRange;
}

export async function getUpgradeFlowReport(rangeInput?: unknown): Promise<UpgradeFlowReport> {
  const range = normalizeRange(rangeInput);
  const months = RANGE_MONTHS[range];

  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  rangeStart.setDate(1);
  rangeStart.setMonth(rangeStart.getMonth() - months);

  const rows = await query<FlowRow>(
    `SELECT l.operation_type AS direction,
            l.old_plan_id AS fromPlanId, fp.plan_name AS fromPlanName,
            l.new_plan_id AS toPlanId, tp.plan_name AS toPlanName,
            COUNT(*) AS eventCount,
            COUNT(DISTINCT s.tenant_id) AS tenantCount,
            MAX(l.created_at) AS lastAt
       FROM t_subscription_operation_log l
       LEFT JOIN t_subscription_plan fp ON fp.id = l.old_plan_id
       LEFT JOIN t_subscription_plan tp ON tp.id = l.new_plan_id
       LEFT JOIN t_subscription s ON s.id = l.subscription_id
      WHERE l.operation_type IN ('UPGRADE','DOWNGRADE')
        AND l.created_at >= ?
      GROUP BY l.operation_type, l.old_plan_id, l.new_plan_id, fp.plan_name, tp.plan_name
      ORDER BY lastAt DESC
      LIMIT ${MAX_ROWS}`,
    [rangeStart]
  );

  const summaryRow = await queryOne<SummaryRow>(
    `SELECT COUNT(*) AS events, COUNT(DISTINCT s.tenant_id) AS tenants
       FROM t_subscription_operation_log l
       LEFT JOIN t_subscription s ON s.id = l.subscription_id
      WHERE l.operation_type IN ('UPGRADE','DOWNGRADE')
        AND l.created_at >= ?`,
    [rangeStart]
  );

  return {
    range,
    rangeStart: formatDateTime(rangeStart) ?? "",
    dataSource: DATA_SOURCE,
    summary: {
      events: Number(summaryRow?.events ?? 0),
      tenants: Number(summaryRow?.tenants ?? 0),
    },
    records: rows.map((r) => ({
      direction: r.direction === "UPGRADE" ? "UPGRADE" : "DOWNGRADE",
      dir: r.direction === "UPGRADE" ? "UP" : "DOWN",
      fromPlanId: r.fromPlanId == null ? null : Number(r.fromPlanId),
      fromPlanName: r.fromPlanName ?? null,
      toPlanId: r.toPlanId == null ? null : Number(r.toPlanId),
      toPlanName: r.toPlanName ?? null,
      eventCount: Number(r.eventCount ?? 0),
      tenantCount: Number(r.tenantCount ?? 0),
      lastAt: formatDateTime(r.lastAt),
    })),
  };
}
