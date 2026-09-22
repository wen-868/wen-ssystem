import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";

/**
 * C2-0 实现段：平台公共打印模板（t_platform_print_template，清账草案 3-B）
 *
 * 依据：docs/tasks/cards/R101-C2-0-凌舟裁定.md §二（否决 3-A，选方案 B 新表）+ §三（端点 #5~#7）。
 * 口径：
 * - 不复用租户表 t_print_template（避免把平台行写进租户作用域表），本表独立；
 * - 上传即 is_public=1（平台侧维护的公共模板）；「设为公共模板」为幂等操作；
 * - 空态诚实：无数据返回 { records: [], total: 0 }，不造种子。
 */

export interface PrintTemplateRow {
  id: number;
  name: string;
  billType: string;
  paperType: string;
  spec: string;
  content: string | null;
  isPublic: number;
  version: number;
  status: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrintTemplateItem {
  id: number;
  name: string;
  billType: string;
  paperType: string;
  spec: string;
  content: string | null;
  public: boolean;
  version: number;
  status: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrintTemplateUploadInput {
  name: string;
  billType: string;
  content: string;
  paperType?: string;
  spec?: string;
}

interface InsertResult {
  insertId: number;
  affectedRows: number;
}

function asArray<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function toItem(row: PrintTemplateRow): PrintTemplateItem {
  return {
    id: Number(row.id),
    name: row.name,
    billType: row.billType,
    paperType: row.paperType,
    spec: row.spec ?? "",
    content: row.content ?? null,
    public: Number(row.isPublic) === 1,
    version: Number(row.version ?? 1),
    status: Number(row.status ?? 1),
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** 公共打印模板列表；billType 传入时按单据类型筛选（合法性由 controller 的 zod 保证） */
export async function listPrintTemplates(
  billType?: string
): Promise<{ records: PrintTemplateItem[]; total: number; billType: string | null }> {
  const conditions = ["status = 1"];
  const params: unknown[] = [];
  if (billType) {
    conditions.push("bill_type = ?");
    params.push(billType);
  }

  const rows = await query<PrintTemplateRow>(
    `SELECT id, name, bill_type AS billType, paper_type AS paperType, spec, content,
            is_public AS isPublic, version, status, created_by AS createdBy,
            created_at AS createdAt, updated_at AS updatedAt
       FROM t_platform_print_template
      WHERE ${conditions.join(" AND ")}
      ORDER BY id ASC`,
    params
  );
  const records = asArray<PrintTemplateRow>(rows).map(toItem);
  return { records, total: records.length, billType: billType ?? null };
}

/** 上传（新建）公共打印模板：落库 is_public=1 */
export async function uploadPrintTemplate(
  input: PrintTemplateUploadInput,
  operator: string
): Promise<{ id: number; name: string; billType: string; paperType: string; public: boolean; version: number }> {
  const name = input.name.trim();
  const paperType = input.paperType?.trim() || "RECEIPT_80";

  const result = await query<InsertResult>(
    `INSERT INTO t_platform_print_template
       (name, bill_type, paper_type, content, spec, is_public, version, status, created_by)
     VALUES (?, ?, ?, ?, ?, 1, 1, 1, ?)`,
    [name, input.billType, paperType, input.content, input.spec?.trim() ?? "", operator]
  );
  const insertId = Number((result as unknown as InsertResult).insertId);

  return { id: insertId, name, billType: input.billType, paperType, public: true, version: 1 };
}

/** 设为公共模板（幂等）；不存在 ⇒ 404 */
export async function setPrintTemplatePublic(
  id: number
): Promise<{ id: number; public: boolean; changed: boolean }> {
  const row = await queryOne<{ id: number; isPublic: number }>(
    "SELECT id, is_public AS isPublic FROM t_platform_print_template WHERE id = ?",
    [id]
  );
  if (!row) {
    throw new AppError(`公共打印模板不存在：${id}`, 404);
  }

  const changed = Number(row.isPublic) !== 1;
  if (changed) {
    await query(
      "UPDATE t_platform_print_template SET is_public = 1, updated_at = NOW() WHERE id = ?",
      [id]
    );
  }
  return { id, public: true, changed };
}
