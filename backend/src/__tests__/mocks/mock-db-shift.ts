/**
 * 交接班（S3-145）dev/测试数据面：t_shift / t_daily_settlement 的最小 handler
 *
 * 为什么需要它：`backend/src/__tests__/mocks/` 下此前**没有** `t_shift` /
 * `t_daily_settlement` 的任何 handler，而 `mock-db-index.ts` 的 `mockQuery` 对未命中 SQL
 * 返回 `[]`（不抛错）⇒ 直接用 dev mock 跑真服务时，交接班列表/详情**必然为空**，
 * 拿不到任何运行期主判据（凌舟 S3-145 附注 3 已实测并授权本文件）。
 *
 * 定位：**本地可复跑装置的数据面，不是产品逻辑**。本文件不改动任何产品分支，
 * 只按真实 SQL 的列/别名投影返回数据；主判据声明「数据来自 dev mock，非真实库」。
 *
 * 说明：
 *  1. 表结构以 `docs/migrations/148_shift_stock_check.sql`（t_shift）与
 *     `docs/migrations/124_drift_tables_fill.sql`（t_daily_settlement）为准；
 *  2. 单号口径：t_shift → `JB…`（createShift），t_daily_settlement → `BJ…`（settleShift）；
 *  3. 盘点端点的 JOIN 投影也在此实现（否则会被 inventory 的通用 handler 兜走，
 *     账面数量恒 0）——它属于同一"交接班链路"的数据面。
 */
import { state, result, Row, fromTable } from "./mock-db-state";

/** 交接班记录（t_shift） */
const shifts: Row[] = [];
/** 班结/日结记录（t_daily_settlement） */
const dailySettlements: Row[] = [];

/** 重置本数据面（供测试用例隔离；server 进程内首次为空即可） */
export function resetShiftMockState() {
  shifts.length = 0;
  dailySettlements.length = 0;
}

/** t_shift 行 → 服务层 SELECT 别名形状 */
function projectShift(row: Row): Row {
  return {
    id: row.id,
    shiftNo: row.shift_no,
    storeId: row.store_id,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    openingCash: row.opening_cash,
    remark: row.remark,
  };
}

/** 严格匹配 `from t_shift`（带词边界），避免误吞 `from t_shift_stock_check` */
const isShiftListSql = (s: string) => /\bfrom t_shift\b/.test(s);

export const queryHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // ① t_shift 单行（getShiftRow / shift.service.ts）：WHERE shift_no = ?
  (s, params) => {
    if (isShiftListSql(s) && s.includes("shift_no = ?")) {
      const shiftNo = String(params[0] ?? "");
      const row = shifts.find((r) => String(r.shift_no) === shiftNo);
      return row ? [projectShift(row)] : [];
    }
    return null;
  },

  // ② t_shift 列表（getShiftList / S3-145）：tenant_id + store_id [+ DATE(start_time)]
  (s, params) => {
    if (isShiftListSql(s) && s.includes("order by start_time desc")) {
      const tenantId = String(params[0] ?? "");
      const storeId = Number(params[1] ?? 0);
      const date = s.includes("date(start_time) = ?") ? String(params[2] ?? "") : "";
      return shifts
        .filter((r) => String(r.tenant_id) === tenantId && Number(r.store_id) === storeId)
        .filter((r) => !date || String(r.start_time).slice(0, 10) === date)
        .map(projectShift);
    }
    return null;
  },

  // ③ t_daily_settlement 历史（getShiftHistory）
  (s, params) => {
    if (fromTable(s, "daily_settlement") && s.includes("order by created_at desc")) {
      const storeId = Number(params[0] ?? 0);
      const tenantId = String(params[1] ?? "");
      const limit = Number(params[2] ?? dailySettlements.length);
      const offset = Number(params[3] ?? 0);
      return dailySettlements
        .filter((r) => Number(r.store_id) === storeId && String(r.tenant_id) === tenantId)
        .slice()
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(offset, offset + limit);
    }
    return null;
  },

  // ④ 交接班盘点：t_inventory_balance JOIN t_product_sku JOIN t_product_spu（getShiftStockCheck）
  //    必须是"具体条件"匹配，避免兜走其他库存查询。
  (s, params) => {
    if (
      /\bfrom t_inventory_balance ib\b/.test(s) &&
      s.includes("join t_product_sku") &&
      s.includes("as bookqty")
    ) {
      const storeId = Number(params[0] ?? 0);
      return state.inventory
        .filter((inv: Row) => Number(inv.storeId) === storeId)
        .map((inv: Row) => {
          const product = state.products.find((p: Row) => Number(p.skuId) === Number(inv.skuId));
          return {
            skuId: inv.skuId,
            skuName: (product?.skuName as string) ?? inv.skuName ?? "",
            productName: (product?.name as string) ?? "",
            // mock 的 t_product_spu 种子没有 specs 字段（真实库有），按空串返回，避免编造
            spec: "",
            bookQty: inv.availableQty,
          };
        });
    }
    return null;
  },
];

/**
 * 取 `(` 起始处的括号内容（配平括号；不处理 SQL 字符串里的括号，本模块用不到）。
 * 用配平扫描而不是 `[^)]+`：`coalesce(?, current_timestamp)` 内含括号与逗号，
 * 正则会把列/值切错位（实测：`opening_cash` 拿到 `current_timestamp)`，`remark` 拿到 openingCash）。
 */
function parenContent(input: string, openIndex: number): { content: string; end: number } | null {
  if (input[openIndex] !== "(") return null;
  let depth = 0;
  for (let i = openIndex; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return { content: input.slice(openIndex + 1, i), end: i + 1 };
    }
  }
  return null;
}

/** 按顶层逗号切分（跳过括号内与引号内的逗号） */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (const ch of input) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts;
}

/** 解析 `INSERT INTO <表> (列…) VALUES (值…)` 的列与值 token */
function parseInsertStatement(s: string, table: string): { columns: string[]; tokens: string[] } | null {
  const head = new RegExp(`insert into (?:t_)?${table} \\(`).exec(s);
  if (!head) return null;
  const columnsParen = parenContent(s, head.index + head[0].length - 1);
  if (!columnsParen) return null;
  const rest = s.slice(columnsParen.end);
  const valuesHead = /^ values \(/.exec(rest);
  if (!valuesHead) return null;
  const valuesParen = parenContent(rest, valuesHead[0].length - 1);
  if (!valuesParen) return null;
  return {
    columns: splitTopLevel(columnsParen.content),
    tokens: splitTopLevel(valuesParen.content),
  };
}

/** 把 VALUES 里的 token 逐个映射到参数（`coalesce(?, current_timestamp)` 只吃 1 个参数） */
function mapInsertValues(s: string, table: string, params: unknown[]): Row | null {
  const parsed = parseInsertStatement(s, table);
  if (!parsed) return null;
  const { columns, tokens } = parsed;
  if (columns.length !== tokens.length) return null;
  const record: Row = {};
  let index = 0;
  tokens.forEach((token, tokenIndex) => {
    const column = columns[tokenIndex];
    if (token === "?") {
      record[column] = params[index];
      index += 1;
    } else if (token.startsWith("coalesce(")) {
      // coalesce(?, current_timestamp)：参数为空时按 DB 默认取当前时间
      const value = params[index];
      index += 1;
      record[column] = value ?? new Date().toISOString().slice(0, 19).replace("T", " ");
    } else {
      record[column] = token.replace(/^'|'$/g, "");
    }
  });
  return record;
}

export const executeHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // t_shift 插入（createShift）
  (s, params) => {
    if (/\binsert into t_shift \(/.test(s)) {
      const record = mapInsertValues(s, "shift", params);
      if (!record) return null;
      const id = shifts.length + 1;
      shifts.push({
        id,
        // 148_shift_stock_check.sql：status NOT NULL DEFAULT 'OPEN'、end_time DEFAULT NULL，
        // 而 createShift 的 INSERT 不含这两列 ⇒ 这里补 DB 默认值（否则详情 status/end_time 为 undefined）
        status: "OPEN",
        end_time: null,
        ...record,
      });
      return result(id);
    }
    return null;
  },

  // t_daily_settlement 插入（settleShift）
  (s, params) => {
    if (/\binsert into t_daily_settlement \(/.test(s)) {
      const record = mapInsertValues(s, "daily_settlement", params);
      if (!record) return null;
      const id = dailySettlements.length + 1;
      dailySettlements.push({
        id,
        created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
        ...record,
      });
      return result(id);
    }
    return null;
  },
];
