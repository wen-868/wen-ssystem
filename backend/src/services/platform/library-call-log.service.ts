import { query, queryOne } from "../../shared/db";
import type { RowDataPacket } from "mysql2/promise";

/**
 * R101-C6-4-1：平台侧「商品库调取统计」只读服务（4 条端点）
 *
 *   · GET /api/platform/library/call-logs            → 调取流水明细（含"某商品被哪些租户调取"：传 librarySpuId 过滤）
 *   · GET /api/platform/library/stats                → KPI（本月调取次数 + 租户排行 Top10 + unavailable[]）
 *   · GET /api/platform/library/stats/rank           → 本月租户调取排行 Top10
 *   · GET /api/platform/library/stats/trend          → 近 N 天日调取次数（无数据返回空数组，不补 0 造假）
 *
 * 统计口径（卡内硬口径②）：平台侧"调取次数"一律取 t_library_call_log 行数，
 *   禁用 t_library_spu.hit_count（那是扫码命中），也不得把 /api/open/library/* 或扫码查询算进来。
 *
 * 边界铁律（立项草案 §4.3）：平台侧只可见"调取事实"（谁、何时、调取了哪个公共商品、生成多少 SKU、对应租户 spuId），
 *   **不得**提供任何查询租户私有档案内容的字段（进价/售价/库存/供应商/毛利一律不出现在本文件任何 SELECT 中）。
 *
 * P5（按类目分布）本期不实现（Q9 裁定）：t_library_spu 无类目列、公共类目树不存在（118 迁移逐字"不建 t_library_category 表"），
 *   故本服务**不注册**该路径，改由 stats 的 unavailable[] 显式说明"无载体"，不做"未分类单值"占位假图。
 */

/** 本月起始（与平台其它统计口径一致：当月 1 日 00:00） */
const MONTH_START = "DATE_FORMAT(NOW(), '%Y-%m-01')";

/** 排行/趋势默认条数 */
const DEFAULT_RANK_LIMIT = 10;
const DEFAULT_TREND_DAYS = 30;
const MAX_TREND_DAYS = 90;

interface CallLogRow extends RowDataPacket {
  id: number;
  tenantId: string;
  tenantDisplayName: string | null;
  librarySpuId: number;
  librarySpuCode: string;
  librarySpuName: string;
  spuId: number;
  skuCount: number;
  callType: string;
  operatorName: string | null;
  createdAt: Date | string;
}

interface CountRow extends RowDataPacket {
  total: number | string;
}

interface RankRow extends RowDataPacket {
  tenantId: string;
  tenantDisplayName: string | null;
  callCount: number | string;
}

interface TrendRow extends RowDataPacket {
  date: Date | string;
  count: number | string;
}

/** 归一为 YYYY-MM-DD（连接池 timezone 为 Z，日期列取 UTC 部分，与平台其它统计口径一致） */
function toDateString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

const UNAVAILABLE: { key: string; reason: string }[] = [
  {
    key: "categoryDist",
    reason: "公共类目树不存在（118_library_brand.sql 明写不建 t_library_category 表，t_library_spu 亦无类目列），按类目分布本期不实现（凌舟裁定 Q9）",
  },
];

/**
 * P1 调取流水明细（分页 + 筛选）
 * 传 librarySpuId 即"某商品被哪些租户调取"（同一端点的过滤视图，不再单独造端点）。
 */
export async function listCallLogs(params: {
  page: number;
  pageSize: number;
  tenantId?: string;
  librarySpuId?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { page, pageSize, tenantId, librarySpuId, dateFrom, dateTo } = params;
  const conditions: string[] = ["1=1"];
  const sqlParams: unknown[] = [];

  if (tenantId) {
    conditions.push("l.tenant_id = ?");
    sqlParams.push(tenantId);
  }
  if (librarySpuId) {
    conditions.push("l.library_spu_id = ?");
    sqlParams.push(librarySpuId);
  }
  if (dateFrom) {
    conditions.push("l.created_at >= ?");
    sqlParams.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("l.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    sqlParams.push(dateTo);
  }

  const where = conditions.join(" AND ");
  const offset = (page - 1) * pageSize;

  const totalRow = await queryOne<CountRow>(
    `SELECT COUNT(*) AS total FROM t_library_call_log l WHERE ${where}`,
    sqlParams
  );
  const records = await query<CallLogRow>(
    `SELECT l.id, l.tenant_id AS tenantId, t.name AS tenantDisplayName,
            l.library_spu_id AS librarySpuId, l.library_spu_code AS librarySpuCode,
            l.library_spu_name AS librarySpuName, l.spu_id AS spuId, l.sku_count AS skuCount,
            l.call_type AS callType, l.operator_name AS operatorName, l.created_at AS createdAt
     FROM t_library_call_log l
     LEFT JOIN t_tenant t ON t.id = l.tenant_id
     WHERE ${where}
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ? OFFSET ?`,
    [...sqlParams, pageSize, offset]
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: records.map((row) => ({
      id: Number(row.id),
      tenantId: row.tenantId,
      tenantDisplayName: row.tenantDisplayName ?? "",
      librarySpuId: Number(row.librarySpuId),
      librarySpuCode: row.librarySpuCode,
      librarySpuName: row.librarySpuName,
      spuId: Number(row.spuId),
      skuCount: Number(row.skuCount),
      callType: row.callType,
      operatorName: row.operatorName ?? null,
      createdAt: row.createdAt,
    })),
  };
}

/** P3 本月租户调取排行（Top N，默认 10） */
export async function getTenantRank(limit: number = DEFAULT_RANK_LIMIT) {
  const rows = await query<RankRow>(
    `SELECT l.tenant_id AS tenantId, t.name AS tenantDisplayName, COUNT(*) AS callCount
     FROM t_library_call_log l
     LEFT JOIN t_tenant t ON t.id = l.tenant_id
     WHERE l.created_at >= ${MONTH_START}
     GROUP BY l.tenant_id, t.name
     ORDER BY callCount DESC, l.tenant_id ASC
     LIMIT ?`,
    [limit]
  );
  return {
    items: rows.map((row) => ({
      tenantId: row.tenantId,
      tenantDisplayName: row.tenantDisplayName ?? "",
      callCount: Number(row.callCount),
    })),
  };
}

/** P4 近 N 天日调取次数（无数据的日期不补 0，返回空数组即诚实空态） */
export async function getCallTrend(days: number = DEFAULT_TREND_DAYS) {
  const safeDays = Math.min(Math.max(Math.trunc(days) || DEFAULT_TREND_DAYS, 1), MAX_TREND_DAYS);
  const rows = await query<TrendRow>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM t_library_call_log
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [safeDays]
  );
  return {
    days: safeDays,
    items: rows.map((row) => ({ date: toDateString(row.date), count: Number(row.count) })),
  };
}

/** P2 调取统计 KPI 汇总 */
export async function getCallStats() {
  const monthRow = await queryOne<CountRow>(
    `SELECT COUNT(*) AS total FROM t_library_call_log WHERE created_at >= ${MONTH_START}`
  );
  const rank = await getTenantRank(DEFAULT_RANK_LIMIT);

  return {
    monthCallCount: Number(monthRow?.total ?? 0),
    tenantRank: rank.items,
    // 无载体的维度显式列出，不用 0 或"未分类单值"冒充（Q9 裁定）
    unavailable: UNAVAILABLE,
  };
}
