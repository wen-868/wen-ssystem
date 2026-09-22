import { query, queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";

/**
 * C2-0 实现段：平台导入 / 导出模板（t_platform_io_template，清账草案 4）
 *
 * 依据：docs/tasks/cards/R101-C2-0-凌舟裁定.md §三（端点 #8~#10）。
 * 口径：
 * - 只有列表 + 下载会让端点「永远返回空」，故本轮给出写入路径（POST #9），读端点才有真实数据源；
 * - 下载：有 file_content ⇒ 200 + Content-Disposition: attachment；
 *         无 file_content ⇒ 404（明确 message，不用空文件冒充）；
 * - 空态诚实：无数据返回 { records: [], total: 0 }，不造种子。
 */

export interface IoTemplateRow {
  id: number;
  name: string;
  direction: string;
  version: string;
  fieldCount: number;
  compat: string;
  fieldDesc: string | null;
  fileName: string | null;
  hasFile: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IoTemplateItem {
  id: number;
  name: string;
  direction: string;
  version: string;
  fieldCount: number;
  compat: string;
  fieldDesc: string | null;
  fileName: string | null;
  hasFile: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IoTemplateCreateInput {
  name: string;
  direction: string;
  version?: string;
  fieldCount?: number;
  compat?: string;
  fieldDesc?: string;
  fileName?: string;
  fileContent?: string;
}

interface InsertResult {
  insertId: number;
  affectedRows: number;
}

function asArray<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function toItem(row: IoTemplateRow): IoTemplateItem {
  return {
    id: Number(row.id),
    name: row.name,
    direction: row.direction,
    version: row.version,
    fieldCount: Number(row.fieldCount ?? 0),
    compat: row.compat ?? "",
    fieldDesc: row.fieldDesc ?? null,
    fileName: row.fileName ?? null,
    hasFile: Number(row.hasFile ?? 0) === 1,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** 导入 / 导出模板列表；direction 传入时按方向筛选（合法性由 controller 的 zod 保证） */
export async function listIoTemplates(
  direction?: string
): Promise<{ records: IoTemplateItem[]; total: number; direction: string | null }> {
  const conditions = ["status = 1"];
  const params: unknown[] = [];
  if (direction) {
    conditions.push("direction = ?");
    params.push(direction);
  }

  const rows = await query<IoTemplateRow>(
    `SELECT id, name, direction, version, field_count AS fieldCount, compat,
            field_desc AS fieldDesc, file_name AS fileName,
            (file_content IS NOT NULL AND file_content <> '') AS hasFile,
            created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
       FROM t_platform_io_template
      WHERE ${conditions.join(" AND ")}
      ORDER BY id ASC`,
    params
  );
  const records = asArray<IoTemplateRow>(rows).map(toItem);
  return { records, total: records.length, direction: direction ?? null };
}

/** 新增导入 / 导出模板（列表 + 下载端点的数据来源） */
export async function createIoTemplate(
  input: IoTemplateCreateInput,
  operator: string
): Promise<{ id: number; name: string; direction: string; version: string; hasFile: boolean }> {
  const name = input.name.trim();
  const version = input.version?.trim() || "v1";
  const fileContent = input.fileContent ?? null;

  const result = await query<InsertResult>(
    `INSERT INTO t_platform_io_template
       (name, direction, version, field_count, compat, field_desc, file_name, file_content, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      name,
      input.direction,
      version,
      Number(input.fieldCount ?? 0),
      input.compat?.trim() ?? "",
      input.fieldDesc ?? null,
      input.fileName?.trim() ?? null,
      fileContent,
      operator,
    ]
  );
  const insertId = Number((result as unknown as InsertResult).insertId);

  return {
    id: insertId,
    name,
    direction: input.direction,
    version,
    hasFile: Boolean(fileContent && fileContent.length > 0),
  };
}

/** 模板文件下载；模板不存在或无文件内容 ⇒ 404（明确 message） */
export async function downloadIoTemplate(
  id: number
): Promise<{ id: number; name: string; fileName: string; content: string }> {
  const row = await queryOne<{
    id: number;
    name: string;
    fileName: string | null;
    fileContent: string | null;
  }>(
    `SELECT id, name, file_name AS fileName, file_content AS fileContent
       FROM t_platform_io_template
      WHERE id = ? AND status = 1`,
    [id]
  );
  if (!row) {
    throw new AppError(`导入/导出模板不存在：${id}`, 404);
  }

  const content = row.fileContent == null ? "" : String(row.fileContent);
  if (content.length === 0) {
    throw new AppError(`模板「${row.name}」未上传文件内容，无法下载`, 404);
  }

  const fileName =
    row.fileName && row.fileName.trim().length > 0 ? row.fileName.trim() : `template-${id}.json`;
  return { id: Number(row.id), name: row.name, fileName, content };
}
