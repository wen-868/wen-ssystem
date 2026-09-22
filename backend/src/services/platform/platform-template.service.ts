import { query, queryOne, transaction, connExecute } from "../../shared/db";
import type { ResultSetHeader } from "mysql2";
import { AppError } from "../../shared/app-error";

/**
 * C2-0 实现段：平台初始化模板（t_platform_template + t_platform_template_version）
 *
 * 依据：docs/tasks/cards/R101-C2-0-凌舟裁定.md §三（端点 #1~#4）+ 清账草案 1/2。
 * 口径：
 * - 主表存四段式配置摘要（code_rule / convert_rule / print_ref / default_wh_account）
 *   与 config_json（完整配置，开户套用的值复制来源）；
 * - 新建写 version=1 快照；编辑 version+1 并写一份快照（每次编辑都有可回看的版本）；
 * - 编码重复 ⇒ 409（唯一键 uk_platform_template_code 兜底竞态）；
 * - 空态诚实：无数据返回 { records: [], total: 0 }，不写种子、不造默认模板；
 * - t_platform_template* 为平台级表（无 tenant_id），使用 query()/queryOne()。
 */

/** 「将复制的配置」条目（config_json.copyConfigs 的元素） */
export interface CopyConfigItem {
  label: string;
  public: boolean;
}

export interface InitTemplateRow {
  id: number;
  code: string;
  name: string;
  applicable: string;
  codeRule: string;
  convertRule: string;
  printRef: string;
  defaultWhAccount: string;
  configJson: unknown;
  freeAvailable: number;
  recommended: number;
  version: number;
  refCount: number;
  status: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InitTemplateItem {
  id: number;
  code: string;
  name: string;
  applicable: string;
  codeRule: string;
  convertRule: string;
  printRef: string;
  defaultWhAccount: string;
  configJson: Record<string, unknown> | null;
  copyConfigs: CopyConfigItem[];
  freeAvailable: boolean;
  recommended: boolean;
  version: number;
  refCount: number;
  status: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InitTemplateVersionItem {
  id: number;
  templateId: number;
  version: number;
  configJson: Record<string, unknown> | null;
  copyConfigs: CopyConfigItem[];
  changeNote: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** 新建入参（code / name 必填由 controller 的 zod 保证） */
export interface InitTemplateCreateInput {
  code: string;
  name: string;
  applicable?: string;
  codeRule?: string;
  convertRule?: string;
  printRef?: string;
  defaultWhAccount?: string;
  configJson?: Record<string, unknown>;
  freeAvailable?: boolean | number;
  recommended?: boolean | number;
  changeNote?: string;
}

/** 编辑入参（全部可选；未传字段保持不变） */
export type InitTemplateUpdateInput = Partial<InitTemplateCreateInput> & { status?: number };

const LIST_SQL = `SELECT id, code, name, applicable,
                         code_rule AS codeRule, convert_rule AS convertRule,
                         print_ref AS printRef, default_wh_account AS defaultWhAccount,
                         config_json AS configJson,
                         free_available AS freeAvailable, recommended,
                         version, ref_count AS refCount, status,
                         created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
                    FROM t_platform_template`;

function asArray<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function parseConfigJson(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      // 脏数据（非 JSON）按「无配置」处理，不抛错也不造默认值
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** configJson.copyConfigs → 强类型数组（非法条目跳过，不造占位项） */
function toCopyConfigs(config: Record<string, unknown> | null): CopyConfigItem[] {
  const raw = config?.copyConfigs;
  if (!Array.isArray(raw)) return [];
  const list: CopyConfigItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as { label?: unknown; public?: unknown };
    const label = String(item.label ?? "").trim();
    if (!label) continue;
    list.push({ label, public: item.public === true || item.public === 1 || item.public === "1" });
  }
  return list;
}

function toItem(row: InitTemplateRow): InitTemplateItem {
  const configJson = parseConfigJson(row.configJson);
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    applicable: row.applicable ?? "",
    codeRule: row.codeRule ?? "",
    convertRule: row.convertRule ?? "",
    printRef: row.printRef ?? "",
    defaultWhAccount: row.defaultWhAccount ?? "",
    configJson,
    copyConfigs: toCopyConfigs(configJson),
    freeAvailable: Number(row.freeAvailable) === 1,
    recommended: Number(row.recommended) === 1,
    version: Number(row.version ?? 1),
    refCount: Number(row.refCount ?? 0),
    status: Number(row.status ?? 1),
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toFlag(value: boolean | number | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  return Number(value) === 1 ? 1 : 0;
}

function configJsonText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: string; errno?: number };
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062;
}

/** 编辑字段清单（列名 + 入参字段名 + 归一化函数），避免在函数体里堆一长串 if */
const UPDATE_FIELD_RULES: ReadonlyArray<{
  column: string;
  field: keyof InitTemplateUpdateInput;
  normalize: (value: unknown) => unknown;
}> = [
  { column: "code", field: "code", normalize: (v) => String(v).trim() },
  { column: "name", field: "name", normalize: (v) => String(v).trim() },
  { column: "applicable", field: "applicable", normalize: (v) => String(v).trim() },
  { column: "code_rule", field: "codeRule", normalize: (v) => String(v).trim() },
  { column: "convert_rule", field: "convertRule", normalize: (v) => String(v).trim() },
  { column: "print_ref", field: "printRef", normalize: (v) => String(v).trim() },
  { column: "default_wh_account", field: "defaultWhAccount", normalize: (v) => String(v).trim() },
  { column: "config_json", field: "configJson", normalize: (v) => configJsonText(v) },
  { column: "free_available", field: "freeAvailable", normalize: (v) => toFlag(v as boolean | number) },
  { column: "recommended", field: "recommended", normalize: (v) => toFlag(v as boolean | number) },
  { column: "status", field: "status", normalize: (v) => (Number(v) === 0 ? 0 : 1) },
];

function buildUpdate(input: InitTemplateUpdateInput): {
  fields: string[];
  values: unknown[];
  changedFields: string[];
} {
  const fields: string[] = [];
  const values: unknown[] = [];
  const changedFields: string[] = [];
  for (const rule of UPDATE_FIELD_RULES) {
    const value = input[rule.field];
    if (value === undefined) continue;
    fields.push(`${rule.column} = ?`);
    values.push(rule.normalize(value));
    changedFields.push(String(rule.field));
  }
  return { fields, values, changedFields };
}

/** 初始化模板列表（无数据 ⇒ records: []，不造种子） */
export async function listInitTemplates(): Promise<{ records: InitTemplateItem[]; total: number }> {
  const rows = await query<InitTemplateRow>(
    `${LIST_SQL} ORDER BY recommended DESC, id ASC`
  );
  const records = asArray<InitTemplateRow>(rows).map(toItem);
  return { records, total: records.length };
}

/** 新建初始化模板 + 写 version=1 版本快照（同一事务） */
export async function createInitTemplate(
  input: InitTemplateCreateInput,
  operator: string
): Promise<{ id: number; code: string; name: string; version: number; copyConfigs: CopyConfigItem[] }> {
  const code = String(input.code ?? "").trim();
  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM t_platform_template WHERE code = ?",
    [code]
  );
  if (existing) {
    throw new AppError(`模板编码已存在：${code}`, 409);
  }

  const snapshot = configJsonText(input.configJson);
  const changeNote = input.changeNote?.trim() || "新建模板首版本";

  let insertId = 0;
  try {
    insertId = await transaction(async (conn) => {
      const [main] = await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_platform_template
           (code, name, applicable, code_rule, convert_rule, print_ref, default_wh_account,
            config_json, free_available, recommended, version, ref_count, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 1, ?)`,
        [
          code,
          String(input.name ?? "").trim(),
          input.applicable?.trim() ?? "",
          input.codeRule?.trim() ?? "",
          input.convertRule?.trim() ?? "",
          input.printRef?.trim() ?? "",
          input.defaultWhAccount?.trim() ?? "",
          snapshot,
          toFlag(input.freeAvailable),
          toFlag(input.recommended),
          operator,
        ]
      );
      await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_platform_template_version
           (template_id, version, config_json, change_note, created_by)
         VALUES (?, 1, ?, ?, ?)`,
        [main.insertId, snapshot, changeNote, operator]
      );
      return main.insertId;
    });
  } catch (err) {
    // 并发竞态：唯一键 uk_platform_template_code 兜底，同样以 409 语义返回
    if (isDuplicateKeyError(err)) {
      throw new AppError(`模板编码已存在：${code}`, 409);
    }
    throw err;
  }

  return {
    id: Number(insertId),
    code,
    name: String(input.name ?? "").trim(),
    version: 1,
    copyConfigs: toCopyConfigs(parseConfigJson(snapshot)),
  };
}

/** 编辑初始化模板：version+1 并写版本快照；不存在 ⇒ 404 */
export async function updateInitTemplate(
  id: number,
  input: InitTemplateUpdateInput,
  operator: string
): Promise<{ id: number; version: number; changedFields: string[]; copyConfigs: CopyConfigItem[] }> {
  const current = await queryOne<{ id: number; version: number; configJson: unknown }>(
    "SELECT id, version, config_json AS configJson FROM t_platform_template WHERE id = ?",
    [id]
  );
  if (!current) {
    throw new AppError(`初始化模板不存在：${id}`, 404);
  }

  if (input.code !== undefined) {
    const code = String(input.code).trim();
    const dup = await queryOne<{ id: number }>(
      "SELECT id FROM t_platform_template WHERE code = ? AND id <> ?",
      [code, id]
    );
    if (dup) {
      throw new AppError(`模板编码已存在：${code}`, 409);
    }
  }

  const { fields, values, changedFields } = buildUpdate(input);

  if (fields.length === 0) {
    throw new AppError("未提供任何可更新字段", 400);
  }

  // 快照口径：本次请求带了 configJson 就用新值，否则用当前落库值（保证每个版本都有配置快照）
  const snapshot =
    input.configJson !== undefined ? configJsonText(input.configJson) : configJsonText(current.configJson);
  const nextVersion = Number(current.version ?? 1) + 1;
  const changeNote = input.changeNote?.trim() || `编辑模板（${changedFields.join("/")}）`;

  fields.push("version = ?");
  values.push(nextVersion);
  fields.push("updated_at = NOW()");
  values.push(id);

  await transaction(async (conn) => {
    await connExecute<ResultSetHeader>(
      conn,
      `UPDATE t_platform_template SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_platform_template_version
         (template_id, version, config_json, change_note, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [id, nextVersion, snapshot, changeNote, operator]
    );
  });

  return {
    id,
    version: nextVersion,
    changedFields,
    copyConfigs: toCopyConfigs(parseConfigJson(snapshot)),
  };
}

/** 模板版本记录（倒序；无数据 ⇒ records: []） */
export async function listTemplateVersions(
  templateId: number
): Promise<{ records: InitTemplateVersionItem[]; total: number; templateId: number }> {
  const rows = await query<{
    id: number;
    templateId: number;
    version: number;
    configJson: unknown;
    changeNote: string | null;
    createdBy: string | null;
    createdAt: string;
  }>(
    `SELECT id, template_id AS templateId, version, config_json AS configJson,
            change_note AS changeNote, created_by AS createdBy, created_at AS createdAt
       FROM t_platform_template_version
      WHERE template_id = ?
      ORDER BY version DESC`,
    [templateId]
  );
  const records = asArray<{
    id: number;
    templateId: number;
    version: number;
    configJson: unknown;
    changeNote: string | null;
    createdBy: string | null;
    createdAt: string;
  }>(rows).map((row) => {
    const configJson = parseConfigJson(row.configJson);
    return {
      id: Number(row.id),
      templateId: Number(row.templateId),
      version: Number(row.version),
      configJson,
      copyConfigs: toCopyConfigs(configJson),
      changeNote: row.changeNote ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt,
    };
  });
  return { records, total: records.length, templateId };
}
