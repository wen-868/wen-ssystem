/**
 * R101-C6-3-2a：平台渠道推广码**码档案**（t_promo_code，迁移 188）
 *
 * 依据：docs/tasks/cards/R101-派单-20260929-C6-3-2a.md §三①（逐列口径）、§四（端点与生成规则）
 *
 * 口径：
 * - 平台级表（**无 tenant_id**）：用 query()/queryOne()，不走 queryWithTenant；
 * - 生成规则（卡 §四 逐字）：`PC` + 8 位**大写字母数字（去易混）**；与既有码冲突时**重试至多 5 次**，
 *   仍冲突 ⇒ AppError 409（并发窗口下兜住唯一键 ER_DUP_ENTRY，同样按 409 / 重试处理）；
 * - 未知 id ⇒ 404；**已停用再停用 ⇒ 幂等 200 + 说明**（不是 400，也不是重复写）；
 * - 未知码值查归因 ⇒ 404；
 * - **零涉钱**（红线①）：本服务只读写码档案字段（码值/渠道类型/渠道名称/负责人/有效期/状态/备注），
 *   不写任何金额、不做任何计提／结算／提现的写入或计算；老带新台账与渠道效果报表归 C6-3-2b。
 */
import { randomInt } from "node:crypto";
import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import { normalizePagination, calculateOffset } from "../../shared/pagination";

/** 码状态枚举（卡 §三① 逐字，与迁移 188 的列注释一致） */
export const PROMO_CODE_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type PromoCodeStatus = (typeof PROMO_CODE_STATUSES)[number];

/** 码前缀与码体长度（卡 §四 逐字：`PC` + 8 位） */
export const PROMO_CODE_PREFIX = "PC";
export const PROMO_CODE_BODY_LENGTH = 8;

/**
 * 码体字母表：大写字母 + 数字，**去掉易混字符** `I` `O` `0` `1`
 * （I/l/1 与 O/0 在纸质海报、二维码旁文字里最容易读错；这是"去易混"的落地方式）
 */
export const PROMO_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 冲突重试上限（卡 §四 逐字：至多 5 次） */
export const PROMO_CODE_MAX_ATTEMPTS = 5;

export type IntRandom = (maxExclusive: number) => number;

/** 默认随机源：crypto.randomInt（无偏、无 Math.random 可预测性） */
const defaultIntRandom: IntRandom = (maxExclusive) => randomInt(maxExclusive);

/** 生成一个候选码值：`PC` + 8 位（去易混字母表）。可注入随机源，便于单测确定性断言。 */
export function generatePromoCode(intRandom: IntRandom = defaultIntRandom): string {
  let body = "";
  for (let i = 0; i < PROMO_CODE_BODY_LENGTH; i += 1) {
    body += PROMO_CODE_ALPHABET[intRandom(PROMO_CODE_ALPHABET.length)];
  }
  return `${PROMO_CODE_PREFIX}${body}`;
}

/** 码值是否合规（供自检/单测断言，不用于替代唯一键） */
export function isValidPromoCodeFormat(code: string): boolean {
  const pattern = new RegExp(
    `^${PROMO_CODE_PREFIX}[${PROMO_CODE_ALPHABET}]{${PROMO_CODE_BODY_LENGTH}}$`
  );
  return pattern.test(String(code ?? ""));
}

interface PromoCodeRow {
  id: number | string;
  promoCode: string;
  channelType: string;
  channelName: string;
  ownerAdminId: number | string | null;
  expireAt: string | Date | null;
  status: string;
  remark: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  attributionCount?: number | string;
}

export interface PromoCodeView {
  id: number;
  promoCode: string;
  channelType: string;
  channelName: string;
  ownerAdminId: number | null;
  expireAt: string | Date | null;
  status: string;
  remark: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  /** 该码已归因租户数（读 t_tenant_attribution 的真实 COUNT，不是估算值） */
  attributionCount: number;
}

export interface PromoCodeListInput {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
}

export interface PromoCodeListResult {
  items: PromoCodeView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PromoCodeCreateInput {
  channelType: string;
  channelName: string;
  expireAt?: string | Date | null;
  remark?: string | null;
}

export interface PromoCodeCreateResult {
  id: number;
  promoCode: string;
}

export interface PromoCodeDisableResult {
  id: number;
  status: PromoCodeStatus;
  /** 本次是否真的发生了状态变更（已停用 ⇒ false，幂等） */
  changed: boolean;
  /**
   * 与 `changed` 同值的显式别名（`alreadyDisabled = !changed`）。
   * 存在的理由：同批 saas-admin 工作流（ChannelPromotion.vue / api.ts）读取的是 `alreadyDisabled`，
   * 两端字段名必须对齐，否则"幂等命中"会被前端读成"刚刚停用"，提示文案失真。
   */
  alreadyDisabled: boolean;
  message: string;
}

export interface PromoCodeAttributionRow {
  id: number;
  tenantId: string;
  attributionType: string;
  promoCodeId: number | null;
  agentId: number | null;
  attributedAt: string | Date;
  createdAt?: string | Date;
}

export interface PromoCodeAttributionResult {
  promoCode: {
    id: number;
    promoCode: string;
    channelType: string;
    channelName: string;
    status: string;
  };
  items: PromoCodeAttributionRow[];
  total: number;
}

const SELECT_COLUMNS = `p.id, p.promo_code AS promoCode, p.channel_type AS channelType,
            p.channel_name AS channelName, p.owner_admin_id AS ownerAdminId,
            p.expire_at AS expireAt, p.status, p.remark,
            p.created_at AS createdAt, p.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM t_tenant_attribution a WHERE a.promo_code_id = p.id) AS attributionCount`;

/** 空白串（含 "" 与纯空格）归一为 NULL —— 列语义 NULL=未填写，不用空串冒充 */
function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/** 时间列统一格式化为 'YYYY-MM-DD HH:mm:ss'（本地时区，与 DATETIME 语义一致） */
export function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`有效期格式不正确：${String(value)}`, 400);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function toView(row: PromoCodeRow): PromoCodeView {
  return {
    id: Number(row.id),
    promoCode: row.promoCode,
    channelType: row.channelType,
    channelName: row.channelName,
    ownerAdminId: row.ownerAdminId === null || row.ownerAdminId === undefined ? null : Number(row.ownerAdminId),
    expireAt: row.expireAt ?? null,
    status: row.status,
    remark: row.remark ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    attributionCount: Number(row.attributionCount ?? 0),
  };
}

/**
 * GET /api/platform/promo-codes —— 分页 + 关键词 + 状态（返回 items/total/page/pageSize）
 * 关键词命中 码值 / 渠道名称 / 渠道类型；空表 ⇒ items: []。
 */
export async function listPromoCodes(input: PromoCodeListInput = {}): Promise<PromoCodeListResult> {
  const { page, pageSize } = normalizePagination({ page: input.page, pageSize: input.pageSize });
  const keyword = input.keyword === undefined ? "" : String(input.keyword).trim();
  const status = normalizeNullableText(input.status);

  const conditions: string[] = [];
  const whereParams: unknown[] = [];

  if (keyword) {
    conditions.push("(p.promo_code LIKE ? OR p.channel_name LIKE ? OR p.channel_type LIKE ?)");
    whereParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (status) {
    conditions.push("p.status = ?");
    whereParams.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalRows = await query<{ total: number | string }>(
    `SELECT COUNT(*) AS total FROM t_promo_code p ${where}`,
    whereParams
  );
  const total = Number(totalRows[0]?.total ?? 0);

  const rows = await query<PromoCodeRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM t_promo_code p
       ${where}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?`,
    [...whereParams, pageSize, calculateOffset(page, pageSize)]
  );

  return { items: rows.map(toView), total, page, pageSize };
}

/**
 * POST /api/platform/promo-codes —— 生成推广码
 * · 冲突重试至多 5 次（卡 §四 逐字）；5 次仍冲突 ⇒ 409
 * · 并发窗口下的唯一键撞车（ER_DUP_ENTRY）同样计入重试，不落 500
 * · 返回 `{ id, promoCode }`（卡 §四 逐字）
 */
export async function createPromoCode(
  input: PromoCodeCreateInput,
  operatorId?: number | null,
  intRandom: IntRandom = defaultIntRandom
): Promise<PromoCodeCreateResult> {
  const expireAt = input.expireAt ? formatDateTime(input.expireAt) : null;
  const channelType = String(input.channelType ?? "").trim();
  const channelName = String(input.channelName ?? "").trim();
  if (!channelType) {
    throw new AppError("渠道类型不能为空", 400);
  }
  if (!channelName) {
    throw new AppError("渠道名称不能为空", 400);
  }

  for (let attempt = 1; attempt <= PROMO_CODE_MAX_ATTEMPTS; attempt += 1) {
    const promoCode = generatePromoCode(intRandom);
    const duplicated = await queryOne<{ id: number }>(
      "SELECT id FROM t_promo_code WHERE promo_code = ?",
      [promoCode]
    );
    if (duplicated) continue;

    try {
      const result: any = await query(
        `INSERT INTO t_promo_code
           (promo_code, channel_type, channel_name, owner_admin_id, expire_at, status, remark)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        [
          promoCode,
          channelType,
          channelName,
          operatorId ?? null,
          expireAt,
          normalizeNullableText(input.remark),
        ]
      );
      const insertId = Number(result?.insertId ?? result?.[0]?.insertId ?? 0);
      if (!insertId) {
        throw new AppError("推广码生成失败：未取得新增主键", 500);
      }
      return { id: insertId, promoCode };
    } catch (err: any) {
      // 并发窗口：唯一键撞车 ⇒ 计入下一次重试
      if (err?.code === "ER_DUP_ENTRY") continue;
      throw err;
    }
  }

  throw new AppError(
    `推广码生成冲突：连续 ${PROMO_CODE_MAX_ATTEMPTS} 次候选码均与既有码重复，请重试`,
    409
  );
}

/**
 * POST /api/platform/promo-codes/:id/disable —— 停用
 * · 未知 id ⇒ 404
 * · 已停用 ⇒ **幂等 200 + 说明**（`changed:false`，不重复写库）
 */
export async function disablePromoCode(id: number): Promise<PromoCodeDisableResult> {
  const existing = await queryOne<{ id: number; status: string }>(
    "SELECT id, status FROM t_promo_code WHERE id = ?",
    [id]
  );
  if (!existing) {
    throw new AppError(`推广码不存在：${id}`, 404);
  }
  if (existing.status === "DISABLED") {
    return {
      id: Number(existing.id),
      status: "DISABLED",
      changed: false,
      alreadyDisabled: true,
      message: "该推广码已停用（幂等，无需重复停用）",
    };
  }

  await query("UPDATE t_promo_code SET status = 'DISABLED' WHERE id = ?", [id]);
  return {
    id: Number(existing.id),
    status: "DISABLED",
    changed: true,
    alreadyDisabled: false,
    message: "推广码已停用",
  };
}

/**
 * GET /api/platform/promo-codes/:code/attributions —— 该码的归因列表（只读聚合）
 * · `:code` 是**码值**不是主键；未知码值 ⇒ 404
 * · 只读：不 JOIN t_tenant（避免耦合租户表的列名漂移），只回归因行本身
 */
export async function listAttributionsByCode(code: string): Promise<PromoCodeAttributionResult> {
  const normalizedCode = normalizeNullableText(code);
  if (!normalizedCode) {
    throw new AppError("推广码不能为空", 400);
  }

  const promo = await queryOne<{
    id: number | string;
    promoCode: string;
    channelType: string;
    channelName: string;
    status: string;
  }>(
    `SELECT id, promo_code AS promoCode, channel_type AS channelType,
            channel_name AS channelName, status
       FROM t_promo_code WHERE promo_code = ?`,
    [normalizedCode]
  );
  if (!promo) {
    throw new AppError(`推广码不存在：${normalizedCode}`, 404);
  }

  const rows = await query<PromoCodeAttributionRow>(
    `SELECT id, tenant_id AS tenantId, attribution_type AS attributionType,
            promo_code_id AS promoCodeId, agent_id AS agentId,
            attributed_at AS attributedAt, created_at AS createdAt
       FROM t_tenant_attribution
      WHERE promo_code_id = ?
      ORDER BY id DESC`,
    [Number(promo.id)]
  );

  return {
    promoCode: {
      id: Number(promo.id),
      promoCode: promo.promoCode,
      channelType: promo.channelType,
      channelName: promo.channelName,
      status: promo.status,
    },
    items: rows.map((row) => ({
      id: Number(row.id),
      tenantId: row.tenantId,
      attributionType: row.attributionType,
      promoCodeId: row.promoCodeId === null || row.promoCodeId === undefined ? null : Number(row.promoCodeId),
      agentId: row.agentId === null || row.agentId === undefined ? null : Number(row.agentId),
      attributedAt: row.attributedAt,
      createdAt: row.createdAt,
    })),
    total: rows.length,
  };
}
