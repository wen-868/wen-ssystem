import { query, queryOne, transaction, connExecute } from "../../shared/db";
import type { ResultSetHeader } from "mysql2";
import { AppError } from "../../shared/app-error";

/**
 * C6-2-T6：平台角色（t_platform_role）+ 权限矩阵（t_platform_role_permission）+ 权限点目录（t_platform_permission_catalog）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T6.md（交付物② 七条端点、验收标准④~⑦）
 *       + docs/tasks/cards/R101-C6-2-批1-立项卡-T6+T7.md §三/§七（7 个功能域、三级权限点、权限点可双向核对）
 *
 * 口径（逐条可核对）：
 * - 平台级表（**无 tenant_id**）：用 query()/queryOne()，不走 queryWithTenant（不注入 tenant_id 条件）；
 * - 复用边界：**不复用也不修改** t_sys_role / t_sys_permission（租户级资产，含 tenant_id）；
 * - 零假数据：全部返回值来自真实查询；空表/空目录一律返回空态（roles: [] / permissions: [] / matrix 空值档），
 *   不写隐式种子、不硬编码兜底数据；
 * - 「域」的唯一来源是**权限点目录**：moduleCode 合法集合 = t_platform_permission_catalog 的 module_code 去重，
 *   dataScope 合法集合 = 目录中 perm_level='DATA' 行的 perm_code（同时接受其 perm_name 中文别名，见下）；
 * - domainCount 口径：can_menu=1 的 module_code **去重计数**（前端 AdminPermissions.vue:209 的 permissionState.menu 语义），
 *   不是"矩阵行数"、也不是"角色行数"。
 */

/** 角色编码规则（派单卡附录裁定）：小写字母开头，2-32 位小写字母/数字/下划线 */
export const ROLE_CODE_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;

/** 角色类型（仅两值，前端 AdminPermissions.vue:194-199 按 type 统计 builtin/custom） */
export const PLATFORM_ROLE_TYPES = ["builtin", "custom"] as const;

export interface PlatformRoleItem {
  id: number;
  name: string;
  code: string;
  type: string;
  domainCount: number;
}

export interface CatalogPermissionItem {
  permCode: string;
  permName: string;
  permLevel: string;
}

export interface CatalogModuleItem {
  moduleCode: string;
  moduleName: string;
  permissions: CatalogPermissionItem[];
}

export interface RolePermissionCell {
  moduleCode: string;
  canMenu: boolean;
  canPageBtn: boolean;
  dataScope: string;
}

export interface RoleCreateInput {
  name: string;
  code: string;
  remark?: string;
}

export interface RoleUpdateInput {
  name?: string;
  remark?: string;
  enabled?: boolean | number;
}

interface RoleRow {
  id: number;
  name: string;
  code: string;
  type: string;
  domainCount?: number | string | null;
}

interface RoleTypeRow {
  id: number;
  type: string;
}

interface CatalogRow {
  moduleCode: string;
  moduleName: string;
  permCode: string;
  permName: string;
  permLevel: string;
}

interface StoredCellRow {
  moduleCode: string;
  canMenu: number | boolean | null;
  canPageBtn: number | boolean | null;
  dataScope: string | null;
}

function rowsOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toFlag(value: boolean | number | undefined): number {
  if (value === undefined) return 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  return Number(value) === 1 ? 1 : 0;
}

function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: string; errno?: number };
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062;
}

/** 目录全量行（module_code / module_name / perm_code / perm_name / perm_level），按域与级别排序 */
const CATALOG_SQL = `SELECT module_code AS moduleCode, module_name AS moduleName,
       perm_code AS permCode, perm_name AS permName, perm_level AS permLevel
  FROM t_platform_permission_catalog`;

/** 权限点级别排序口径：MENU → BUTTON → DATA（同一域内） */
const PERM_LEVEL_ORDER = `FIELD(perm_level, 'MENU', 'BUTTON', 'DATA')`;

async function loadCatalog(): Promise<CatalogRow[]> {
  const rows = await query(
    `${CATALOG_SQL} ORDER BY module_code ASC, ${PERM_LEVEL_ORDER} ASC, perm_code ASC`
  );
  return rowsOf<CatalogRow>(rows);
}

/**
 * 数据范围档位的可接受取值：目录中 perm_level='DATA' 的 perm_code（canonical，落库值）
 * + 同一行的 perm_name（中文别名，与前端 DATA_SCOPES 四项字面一致）。
 *
 * 为什么接受别名：派单卡「交付物①」把这 4 条定义成 perm_code（scope:all …）并注明
 * "对应前端 DATA_SCOPES 四项"，而前端常量是中文标签（AdminPermissions.vue:218）
 * ⇒ 两种写法都是卡内已给定字面，故都接受，统一归一化为 perm_code 后落库。
 */
function buildScopeMap(catalog: CatalogRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of catalog) {
    if (String(row.permLevel).toUpperCase() !== "DATA") continue;
    map.set(row.permCode, row.permCode);
    map.set(row.permName, row.permCode);
  }
  return map;
}

/**
 * 角色列表（GET /api/platform/admins/roles）
 * domainCount = 该角色在矩阵表中 can_menu=1 的 module_code 去重数；空表 ⇒ roles: []
 */
export async function listPlatformRoles(): Promise<{ roles: PlatformRoleItem[] }> {
  const rows = await query(
    `SELECT r.id AS id, r.name AS name, r.code AS code, r.type AS type,
            COUNT(DISTINCT CASE WHEN p.can_menu = 1 THEN p.module_code END) AS domainCount
       FROM t_platform_role r
       LEFT JOIN t_platform_role_permission p ON p.role_id = r.id
      GROUP BY r.id, r.name, r.code, r.type
      ORDER BY r.id ASC`
  );
  const roles = rowsOf<RoleRow>(rows).map((row) => ({
    id: Number(row.id),
    name: row.name,
    code: row.code,
    type: row.type,
    domainCount: Number(row.domainCount ?? 0),
  }));
  return { roles };
}

/**
 * 权限点目录（GET /api/platform/permissions/catalog）
 * 按 module_code 分组，组内按 MENU→BUTTON→DATA 排序；目录为空 ⇒ modules: []
 */
export async function listPermissionCatalog(): Promise<{ modules: CatalogModuleItem[] }> {
  const catalog = await loadCatalog();
  const modules: CatalogModuleItem[] = [];
  const indexOfModule = new Map<string, number>();

  for (const row of catalog) {
    const moduleCode = String(row.moduleCode);
    let index = indexOfModule.get(moduleCode);
    if (index === undefined) {
      index = modules.length;
      indexOfModule.set(moduleCode, index);
      modules.push({ moduleCode, moduleName: String(row.moduleName), permissions: [] });
    }
    modules[index].permissions.push({
      permCode: String(row.permCode),
      permName: String(row.permName),
      permLevel: String(row.permLevel).toUpperCase(),
    });
  }
  return { modules };
}

/** 角色不存在 ⇒ 404（读角色类型，供内置角色保护用） */
async function requireRole(id: number): Promise<RoleTypeRow> {
  const role = await queryOne<RoleTypeRow>("SELECT id, type FROM t_platform_role WHERE id = ?", [id]);
  if (!role) {
    throw new AppError(`角色不存在：${id}`, 404);
  }
  return role;
}

/** 新建角色（POST /api/platform/roles）：type 固定 custom，code 冲突 ⇒ 409 */
export async function createPlatformRole(input: RoleCreateInput): Promise<{ id: number }> {
  const code = String(input.code ?? "").trim();
  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM t_platform_role WHERE code = ?",
    [code]
  );
  if (existing) {
    throw new AppError(`角色编码已存在：${code}`, 409);
  }

  let insertId = 0;
  try {
    insertId = await transaction(async (conn) => {
      // type 不在入参里（派单卡交付物② 只收 name/code/remark）：新建角色一律 custom，
      // builtin 内置角色只能由后续裁定/种子产生，避免 API 越权造出内置角色。
      const [result] = await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_platform_role (name, code, type, remark, enabled, created_at, updated_at)
         VALUES (?, ?, 'custom', ?, 1, NOW(), NOW())`,
        [String(input.name ?? "").trim(), code, input.remark?.trim() || null]
      );
      return result.insertId;
    });
  } catch (err) {
    // 并发竞态：唯一键 uk_code 兜底，同样按 409 语义返回（不外泄 500）
    if (isDuplicateKeyError(err)) {
      throw new AppError(`角色编码已存在：${code}`, 409);
    }
    throw err;
  }

  return { id: Number(insertId) };
}

/**
 * 修改角色（PUT /api/platform/roles/:id）
 * - 只写"传了的字段"（name / remark / enabled），未传字段保持原值，绝不覆盖成空；
 * - 内置角色（type='builtin'）不可改 name（派单卡附录裁定），remark/enabled 可改；
 * - 角色不存在 ⇒ 404；未传任何可改字段 ⇒ 400（不产生空 UPDATE）。
 */
export async function updatePlatformRole(
  id: number,
  input: RoleUpdateInput
): Promise<{ id: number; changedFields: string[] }> {
  const role = await requireRole(id);
  if (role.type === "builtin" && input.name !== undefined) {
    throw new AppError("内置角色的名称不可修改", 400);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  const changedFields: string[] = [];
  if (input.name !== undefined) {
    fields.push("name = ?");
    values.push(String(input.name).trim());
    changedFields.push("name");
  }
  if (input.remark !== undefined) {
    fields.push("remark = ?");
    values.push(String(input.remark).trim() || null);
    changedFields.push("remark");
  }
  if (input.enabled !== undefined) {
    fields.push("enabled = ?");
    values.push(toFlag(input.enabled));
    changedFields.push("enabled");
  }
  if (fields.length === 0) {
    throw new AppError("没有需要修改的字段", 400);
  }

  await transaction(async (conn) => {
    await connExecute<ResultSetHeader>(
      conn,
      `UPDATE t_platform_role SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`,
      [...values, id]
    );
  });

  return { id, changedFields };
}

/**
 * 删除角色（DELETE /api/platform/roles/:id）
 * 角色与其矩阵行在同一事务内删除；内置角色 ⇒ 400；不存在 ⇒ 404
 */
export async function deletePlatformRole(
  id: number
): Promise<{ id: number; deletedPermissions: number }> {
  const role = await requireRole(id);
  if (role.type === "builtin") {
    throw new AppError("内置角色不可删除", 400);
  }

  const deletedPermissions = await transaction(async (conn) => {
    const [permResult] = await connExecute<ResultSetHeader>(
      conn,
      "DELETE FROM t_platform_role_permission WHERE role_id = ?",
      [id]
    );
    await connExecute<ResultSetHeader>(conn, "DELETE FROM t_platform_role WHERE id = ?", [id]);
    return permResult.affectedRows;
  });

  return { id, deletedPermissions: Number(deletedPermissions ?? 0) };
}

/**
 * 角色权限矩阵（GET /api/platform/roles/:id/permissions）
 * 目录里的每个 module_code 都要出现；无记录 ⇒ false/false/''（诚实空态）
 */
export async function getRolePermissions(
  id: number
): Promise<{ roleId: number; matrix: RolePermissionCell[] }> {
  await requireRole(id);
  const catalog = await loadCatalog();
  const stored = rowsOf<StoredCellRow>(
    await query(
      `SELECT module_code AS moduleCode, can_menu AS canMenu, can_page_btn AS canPageBtn,
              data_scope AS dataScope
         FROM t_platform_role_permission WHERE role_id = ?`,
      [id]
    )
  );
  const storedByModule = new Map<string, StoredCellRow>();
  for (const row of stored) {
    storedByModule.set(String(row.moduleCode), row);
  }

  const matrix: RolePermissionCell[] = [];
  const seen = new Set<string>();
  for (const row of catalog) {
    const moduleCode = String(row.moduleCode);
    if (seen.has(moduleCode)) continue;
    seen.add(moduleCode);
    const cell = storedByModule.get(moduleCode);
    matrix.push({
      moduleCode,
      canMenu: Number(cell?.canMenu ?? 0) === 1,
      canPageBtn: Number(cell?.canPageBtn ?? 0) === 1,
      dataScope: String(cell?.dataScope ?? ""),
    });
  }
  return { roleId: id, matrix };
}

/**
 * 整表替换角色权限矩阵（PUT /api/platform/roles/:id/permissions）
 * - 同一事务内先删后插（派生自 uk_role_module：同角色同域只允许一行）；
 * - moduleCode 不在目录模块集合内 ⇒ 400；dataScope 不在 4 档内 ⇒ 400；角色不存在 ⇒ 404；
 * - matrix 内 moduleCode 重复 ⇒ 400（否则会撞 uk_role_module 变成 500，不做静默去重）；
 * - dataScope 为空/NULL ⇒ 落 NULL（未设置，不是空串假数据）。
 */
export async function replaceRolePermissions(
  id: number,
  matrix: RolePermissionCell[]
): Promise<{ roleId: number; saved: number }> {
  await requireRole(id);
  const catalog = await loadCatalog();
  const moduleCodes = new Set(catalog.map((row) => String(row.moduleCode)));
  const scopeMap = buildScopeMap(catalog);

  interface NormalizedCell {
    moduleCode: string;
    canMenu: number;
    canPageBtn: number;
    dataScope: string | null;
  }

  const normalized: NormalizedCell[] = [];
  const seen = new Set<string>();
  for (const cell of matrix) {
    const moduleCode = String(cell.moduleCode).trim();
    if (!moduleCodes.has(moduleCode)) {
      throw new AppError(`功能域不在权限点目录内：${moduleCode}`, 400);
    }
    if (seen.has(moduleCode)) {
      throw new AppError(`权限矩阵中功能域重复：${moduleCode}`, 400);
    }
    seen.add(moduleCode);

    const rawScope = cell.dataScope === null || cell.dataScope === undefined ? "" : String(cell.dataScope).trim();
    let dataScope: string | null = null;
    if (rawScope !== "") {
      const normalizedScope = scopeMap.get(rawScope);
      if (!normalizedScope) {
        throw new AppError(`数据范围不在 4 档内：${rawScope}`, 400);
      }
      dataScope = normalizedScope;
    }
    normalized.push({
      moduleCode,
      canMenu: toFlag(cell.canMenu),
      canPageBtn: toFlag(cell.canPageBtn),
      dataScope,
    });
  }

  await transaction(async (conn) => {
    await connExecute<ResultSetHeader>(
      conn,
      "DELETE FROM t_platform_role_permission WHERE role_id = ?",
      [id]
    );
    for (const cell of normalized) {
      await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_platform_role_permission
           (role_id, module_code, can_menu, can_page_btn, data_scope)
         VALUES (?, ?, ?, ?, ?)`,
        [id, cell.moduleCode, cell.canMenu, cell.canPageBtn, cell.dataScope]
      );
    }
  });

  return { roleId: id, saved: normalized.length };
}
