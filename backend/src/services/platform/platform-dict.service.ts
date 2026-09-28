/**
 * R101-C6-3-1：平台数据字典（t_platform_dict + t_platform_dict_item）
 *
 * 依据：docs/tasks/cards/R101-派单-20260927-C6-3-1.md 交付物 B①②、验收标准③
 *       + docs/migrations/185_平台数据字典.sql（表结构与零预置口径的唯一真相源）
 *
 * 口径（与卡逐条对齐）：
 * - 四类字典类型是**代码常量**（`DICT_TYPES`，与卡 §三B① 的 unit / category_template /
 *   payment_channel / bill_type 逐字一致），因为它承担两个职责：
 *   ① 校验"未知 dictType ⇒ 404"的合法集合；② 首次整包替换时补建父表行所需的 dict_name。
 * - 零预置：迁移不写任何行（MIG-4 写闸门默认 block），故父表在全新库为空 ⇒ 列表端点返回 items: []；
 *   字典项只允许由真实整包替换（PUT）产生；**预置内容（如 瓶/箱/件/千克）走前端代码常量**，
 *   既不进迁移也不进库（卡 §三B③）。
 * - 平台级表（无 tenant_id）：用 query()/queryOne()；写侧在 transaction 内完成"父表 upsert + 子表整包替换"，
 *   保证幂等（重复提交同一份 items 结果一致，不产生重复行）。
 * - 未知 dictType ⇒ AppError 404；同一请求内 itemCode 重复 ⇒ AppError 400。
 * - "随租户初始化复制"不在本单（卡 §三B③／§六），归属初始化模板域，本服务不做任何租户侧写入。
 */
import { query, transaction, connExecute, connQueryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

/** 四类字典类型（卡 §三B① 逐字）：编码 + 名称，代码常量为唯一来源 */
export const DICT_TYPES = [
  { dictType: "unit", dictName: "计量单位" },
  { dictType: "category_template", dictName: "商品分类模板" },
  { dictType: "payment_channel", dictName: "支付渠道" },
  { dictType: "bill_type", dictName: "单据类型" },
] as const;

const DICT_TYPE_MAP = new Map<string, string>(DICT_TYPES.map((t) => [t.dictType, t.dictName]));

/** 合法字典类型集合（未知类型一律 404，不做模糊匹配、不自动建类型） */
export function isKnownDictType(dictType: string): boolean {
  return DICT_TYPE_MAP.has(dictType);
}

interface DictListRow {
  dictType: string;
  dictName: string;
  remark: string | null;
  status: string | null;
  itemCount: number | string;
}

interface DictItemRow {
  itemCode: string;
  itemName: string;
  sortNo: number | string;
  status: string;
  remark: string | null;
}

interface DictIdRow extends RowDataPacket {
  id: number;
}

export interface DictListItem {
  dictType: string;
  dictName: string;
  remark: string | null;
  status: string | null;
  itemCount: number;
}

export interface DictItemInput {
  itemCode: string;
  itemName: string;
  sortNo?: number;
  status?: string;
  remark?: string | null;
}

export interface DictItemView {
  itemCode: string;
  itemName: string;
  sortNo: number;
  status: string;
  remark: string | null;
}

/**
 * GET /api/platform/config/data-dict
 * 零预置 ⇒ 全新库父表为空 ⇒ { items: [] }（诚实空态，不内置四类假行）
 */
export async function listDictTypes(): Promise<{ items: DictListItem[] }> {
  const rows = await query<DictListRow>(
    `SELECT d.dict_type AS dictType, d.dict_name AS dictName, d.remark, d.status,
            COUNT(i.id) AS itemCount
       FROM t_platform_dict d
       LEFT JOIN t_platform_dict_item i ON i.dict_id = d.id
      GROUP BY d.id, d.dict_type, d.dict_name, d.remark, d.status
      ORDER BY d.dict_type ASC`
  );

  return {
    items: rows.map((row) => ({
      dictType: row.dictType,
      dictName: row.dictName,
      remark: row.remark ?? null,
      status: row.status ?? null,
      itemCount: Number(row.itemCount ?? 0),
    })),
  };
}

/**
 * GET /api/platform/config/data-dict/:dictType/items
 * 合法类型但尚未落库 ⇒ { items: [] }（诚实空态）；未知类型 ⇒ 404
 */
export async function listDictItems(
  dictType: string
): Promise<{ dictType: string; items: DictItemView[] }> {
  if (!isKnownDictType(dictType)) {
    throw new AppError(`未知字典类型：${dictType}`, 404);
  }

  const rows = await query<DictItemRow>(
    `SELECT i.item_code AS itemCode, i.item_name AS itemName, i.sort_no AS sortNo,
            i.status, i.remark
       FROM t_platform_dict_item i
       JOIN t_platform_dict d ON d.id = i.dict_id
      WHERE d.dict_type = ?
      ORDER BY i.sort_no ASC, i.id ASC`,
    [dictType]
  );

  return {
    dictType,
    items: rows.map((row) => ({
      itemCode: row.itemCode,
      itemName: row.itemName,
      sortNo: Number(row.sortNo ?? 0),
      status: row.status,
      remark: row.remark ?? null,
    })),
  };
}

/**
 * PUT /api/platform/config/data-dict/:dictType —— 整包替换该类型字典项
 *
 * 幂等：先按 dict_type 取（或补建）父表行，再在同一事务内 DELETE 全部子行 + 逐条 INSERT 新行；
 * 重复提交同一份 items ⇒ 结果完全一致（不产生重复行、不需要客户端比对）。
 */
export async function replaceDictItems(
  dictType: string,
  items: DictItemInput[]
): Promise<{ dictType: string; saved: number }> {
  const dictName = DICT_TYPE_MAP.get(dictType);
  if (!dictName) {
    throw new AppError(`未知字典类型：${dictType}`, 404);
  }

  const seen = new Set<string>();
  for (const item of items) {
    const itemCode = String(item.itemCode).trim();
    if (seen.has(itemCode)) {
      throw new AppError(`字典项编码重复：${itemCode}`, 400);
    }
    seen.add(itemCode);
  }

  const normalized = items.map((item) => ({
    itemCode: String(item.itemCode).trim(),
    itemName: String(item.itemName).trim(),
    sortNo: Number.isFinite(Number(item.sortNo)) ? Number(item.sortNo) : 0,
    status: item.status && String(item.status).trim() ? String(item.status).trim() : "ACTIVE",
    remark: item.remark === null || item.remark === undefined || String(item.remark).trim() === ""
      ? null
      : String(item.remark),
  }));

  await transaction(async (conn) => {
    // 父表 upsert：已存在只同步名称（不覆盖 status/remark，避免整包替换字典项时误改类型级元数据）
    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_platform_dict (dict_type, dict_name, status)
       VALUES (?, ?, 'ACTIVE')
       ON DUPLICATE KEY UPDATE dict_name = ?
       `,
      [dictType, dictName, dictName]
    );

    const dictRow = await connQueryOne<DictIdRow>(
      conn,
      "SELECT id FROM t_platform_dict WHERE dict_type = ?",
      [dictType]
    );
    if (!dictRow) {
      throw new AppError(`字典类型初始化失败：${dictType}`, 500);
    }

    await connExecute<ResultSetHeader>(
      conn,
      "DELETE FROM t_platform_dict_item WHERE dict_id = ?",
      [dictRow.id]
    );

    for (const item of normalized) {
      await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_platform_dict_item
           (dict_id, item_code, item_name, sort_no, status, remark)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [dictRow.id, item.itemCode, item.itemName, item.sortNo, item.status, item.remark]
      );
    }
  });

  return { dictType, saved: normalized.length };
}
