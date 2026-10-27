/**
 * 订单进度事件底座 · 写入器（TOTAL-ORDER-PROGRESS-02）
 *
 * 契约：projects/ms/design/ORDER-PROGRESS-CONTRACT-v1.md
 * - §4.1 稳定幂等键（source_event_id 六成分，零时间戳、不依赖 progress_seq）+ 写入前去重
 * - §4.5 progress_seq 原子分配：MAX+1 → INSERT → uk_order_seq 冲突重试（至多 3 次），撞号事件都是合法事件，不判 stale
 * - §8.1 事件写入必须与业务状态变更在**同一事务**：调用方传入其事务 conn；写失败抛出即回滚业务
 * - §5.4 AI 步骤态禁入业务字段（由 contract 校验器硬拦）
 *
 * 负责人：阿坚（总台后端与数据）｜创建日期：2026-10-28
 */
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import logger from "./logger";
import {
  validateAndDerive,
  type OrderProgressEventInput,
} from "./order-progress-contract";

/** uk_order_seq 冲突重试参数（§4.5：至多 3 次，退避 10/50/100ms） */
const SEQ_RETRY_LIMIT = 3;
const SEQ_BACKOFF_MS = [10, 50, 100];

interface MaxSeqRow extends RowDataPacket {
  max_seq: number | null;
}

/** 1062 唯一键冲突时判定撞的是哪个唯一键（sqlMessage 含索引名） */
function dupKeyName(err: unknown): string | null {
  const e = err as { code?: string; sqlMessage?: string; message?: string };
  if (e?.code !== "ER_DUP_ENTRY") return null;
  const msg = `${e.sqlMessage ?? ""} ${e.message ?? ""}`;
  const m = msg.match(/for key '(?:[^']*\.)?([a-zA-Z0-9_]+)'/);
  if (m) return m[1];
  if (/uk_source_event/i.test(msg)) return "uk_source_event";
  if (/uk_idempotency/i.test(msg)) return "uk_idempotency";
  if (/uk_order_seq/i.test(msg)) return "uk_order_seq";
  return "unknown";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AppendResult {
  duplicate: boolean;
  progressSeq: number;
  sourceEventId: string;
  eventName: string;
}

/**
 * 在同一业务事务内追加一条订单进度事件。
 *
 * @param conn   调用方事务连接（**必须**与状态变更同事务；本函数自含重试，不开新事务）
 * @param input  事件语义（阶段/状态/actor/上游业务键/可见性快照等）
 * @returns duplicate=true 表示幂等命中（同 source_event_id 已存在），未新增行
 */
export async function appendOrderProgressEvent(
  conn: PoolConnection,
  input: OrderProgressEventInput,
): Promise<AppendResult> {
  const derived = validateAndDerive(input);
  const startedAt = toMysqlDateTime(input.startedAt);
  const endedAt = input.endedAt ? toMysqlDateTime(input.endedAt) : null;

  // 写入前去重（§4.1 规则 6）：命中即返回 duplicate，不产生第二行、不领新 seq
  // 注：统一走 conn.execute（带占位符 SELECT），与既有最小桩（仅 execute）兼容
  const [pre = [] as MaxSeqRow[]] = (await conn.execute<MaxSeqRow[]>(
    "SELECT progress_seq FROM t_order_progress_event WHERE tenant_id = ? AND source_event_id = ? LIMIT 1",
    [input.tenantId, derived.sourceEventId],
  )) ?? [];
  if (pre.length > 0) {
    return { duplicate: true, progressSeq: Number(pre[0].progress_seq), sourceEventId: derived.sourceEventId, eventName: derived.eventName };
  }

  const insertSql = `
    INSERT INTO t_order_progress_event (
      tenant_id, store_id, order_family, order_no, source_event_id, progress_seq,
      event_name, event_version, business_stage, business_status, failure_code,
      retry_entry, manual_intervention_url, status_reason, actor_type, actor_id,
      visible_to, field_filter, idempotency_key, started_at, ended_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  type ExecValue = string | number | boolean | Date | null;
  const values = (): ExecValue[] => [
    input.tenantId,
    input.storeId ?? null,
    input.orderFamily,
    input.orderNo,
    derived.sourceEventId,
    0, // 由每次尝试重新填 seq
    derived.eventName,
    "1.0.0",
    input.businessStage,
    input.businessStatus,
    input.failureCode ?? null,
    input.retryEntry ?? null,
    input.manualInterventionUrl ?? null,
    input.statusReason ?? null,
    input.actorType,
    input.actorId == null ? null : String(input.actorId),
    JSON.stringify(input.visibleTo),
    JSON.stringify(input.fieldFilter),
    derived.idempotencyKey,
    startedAt,
    endedAt,
  ];

  for (let attempt = 0; attempt <= SEQ_RETRY_LIMIT; attempt++) {
    const [maxRows = [] as MaxSeqRow[]] = (await conn.execute<MaxSeqRow[]>(
      "SELECT COALESCE(MAX(progress_seq), 0) AS max_seq FROM t_order_progress_event WHERE tenant_id = ? AND order_family = ? AND order_no = ?",
      [input.tenantId, input.orderFamily, input.orderNo],
    )) ?? [];
    const nextSeq = Number(maxRows[0]?.max_seq ?? 0) + 1;
    const row = values();
    row[5] = nextSeq;
    try {
      await conn.execute<ResultSetHeader>(insertSql, row);
      return { duplicate: false, progressSeq: nextSeq, sourceEventId: derived.sourceEventId, eventName: derived.eventName };
    } catch (err) {
      const key = dupKeyName(err);
      if (key === "uk_source_event" || key === "uk_idempotency") {
        // 并发下同一业务事实被另一路先写入 ⇒ 幂等命中，不是错误
        const [cur] = await conn.execute<MaxSeqRow[]>(
          "SELECT progress_seq FROM t_order_progress_event WHERE tenant_id = ? AND source_event_id = ? LIMIT 1",
          [input.tenantId, derived.sourceEventId],
        );
        return { duplicate: true, progressSeq: Number(cur[0]?.progress_seq ?? nextSeq), sourceEventId: derived.sourceEventId, eventName: derived.eventName };
      }
      if (key === "uk_order_seq" && attempt < SEQ_RETRY_LIMIT) {
        // 合法并发事件撞号 ⇒ 重读 MAX+1 重试取更大新 seq，绝不判 stale、绝不丢弃（§4.2/§4.5）
        logger.warn(`[order-progress] seq 冲突重试 order=${input.orderNo} seq=${nextSeq} attempt=${attempt + 1}`);
        await sleep(SEQ_BACKOFF_MS[attempt] ?? 100);
        continue;
      }
      if (key === "uk_order_seq") {
        // 三次仍冲突 ⇒ 抛出可重试错误，由调用方重放（重放时 source_event_id 不变，不会重复入账）
        throw new Error(`订单进度事件 seq 分配冲突超过重试上限（可重放）：order=${input.orderNo} tenant=${input.tenantId}`);
      }
      throw err;
    }
  }
  // 理论不可达（循环内已覆盖 return/throw）
  throw new Error("订单进度事件写入器状态异常");
}

/** DATETIME 字面量（mysql2 接受 Date，但 mock/单测口径需要确定性字符串） */
export function toMysqlDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * sale_bill 族的事件语义装配（§三 sale_bill 阶段值域 = t_sale_bill.business_status DDL 值域，init:717；
 * 结清事件的 business_status 携带收款维度真值 PAID，init:718——主表两维真值都进事件，不虚构状态）。
 * visible_to / field_filter 取契约 §六 / §五.3 默认。
 */
export function saleBillEvent(input: {
  tenantId: string;
  storeId: number;
  billNo: string;
  businessStage: "DRAFT" | "CREATED" | "COMPLETED" | "VOIDED" | "RETURNED";
  /** 主表状态真值（business_status 或本次动作落定的 collection_status） */
  businessStatus: string;
  actorType: "system" | "user" | "admin" | "ai" | "cron";
  actorId?: number | string | null;
  /** 稳定上游业务键：业务动作自身的幂等载体（如 billNo+动作复合键） */
  upstreamBizKey: string;
  statusReason?: string | null;
  at: Date;
}): OrderProgressEventInput {
  const terminal = input.businessStage === "VOIDED" || input.businessStage === "RETURNED" || input.businessStage === "COMPLETED";
  return {
    tenantId: input.tenantId,
    storeId: input.storeId,
    orderFamily: "sale_bill",
    orderNo: input.billNo,
    businessStage: input.businessStage,
    businessStatus: input.businessStatus,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    upstreamBizKey: input.upstreamBizKey,
    statusReason: input.statusReason ?? null,
    startedAt: input.at,
    endedAt: terminal ? input.at : null,
    visibleTo: ["store_staff", "store_manager", "hq_admin", "finance"],
    fieldFilter: {
      // §5.4：AI 通道不下发操作人 ID/幂等键/门店/可见性快照本身
      hidden_fields: {
        ai: ["actor_id", "source_event_id", "idempotency_key", "store_id", "visible_to", "field_filter", "event_version"],
      },
      // §5.3 + §5.4 自由文本金额脱敏：非豁免视角下 status_reason 夹带的金额数字一律打码
      //（列级裁剪拦不住"应收 258.00 成本 180.00"这类文本，必须文本级脱敏）
      money_in_free_text: {
        fields: ["status_reason"],
        exempt_roles: ["hq_admin", "finance", "store_manager"],
      },
    },
  };
}
