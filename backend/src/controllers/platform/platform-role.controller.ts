import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/platform-role.service";

/**
 * C6-2-T6：平台角色与权限点目录控制器（7 条端点，路径由派单卡钉死）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T6.md 交付物②
 *   · GET    /api/platform/admins/roles            → { roles: [{ id, name, code, type, domainCount }] }
 *   · GET    /api/platform/permissions/catalog     → { modules: [{ moduleCode, moduleName, permissions: [...] }] }
 *   · POST   /api/platform/roles                   → { id }
 *   · PUT    /api/platform/roles/:id               → { id, changedFields }
 *   · DELETE /api/platform/roles/:id               → { id, deletedPermissions }
 *   · GET    /api/platform/roles/:id/permissions   → { roleId, matrix: [{ moduleCode, canMenu, canPageBtn, dataScope }] }
 *   · PUT    /api/platform/roles/:id/permissions   → { roleId, saved }
 *
 * 校验口径：zod 解析失败 ⇒ ZodError ⇒ 由 errorHandler 统一转 400；
 * 业务冲突（code 重复 409 / 角色不存在 404 / 内置角色保护 400 / 目录外的域或档位 400）由 service 抛 AppError。
 * 本控制器**不吞错**：不做 try/catch 包装，异常一律交给 errorHandler（红线⑤）。
 */

const idSchema = z.coerce.number().int().positive();

const flagSchema = z.union([z.boolean(), z.coerce.number().int().min(0).max(1)]);

/** 角色编码：小写字母开头，2-32 位小写字母/数字/下划线（派单卡附录裁定） */
const codeSchema = z
  .string()
  .trim()
  .regex(
    service.ROLE_CODE_PATTERN,
    "角色编码须为小写字母开头、2-32 位小写字母/数字/下划线"
  );

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(64),
  code: codeSchema,
  remark: z.string().trim().max(255).optional(),
});

const updateBodySchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  remark: z.string().trim().max(255).optional(),
  enabled: flagSchema.optional(),
});

const replaceMatrixBodySchema = z.object({
  matrix: z.array(
    z.object({
      moduleCode: z.string().trim().min(1).max(32),
      canMenu: flagSchema.optional(),
      canPageBtn: flagSchema.optional(),
      dataScope: z.string().trim().max(32).nullish(),
    })
  ),
});

/** GET /api/platform/admins/roles —— 角色列表（空表 ⇒ roles: []） */
export async function listRoles(_req: any, res: any) {
  res.json(ok(await service.listPlatformRoles()));
}

/** GET /api/platform/permissions/catalog —— 权限点目录（空目录 ⇒ modules: []） */
export async function getPermissionCatalog(_req: any, res: any) {
  res.json(ok(await service.listPermissionCatalog()));
}

/** POST /api/platform/roles —— 新建自定义角色 */
export async function createRole(req: any, res: any) {
  const body = createBodySchema.parse(req.body ?? {});
  res.status(201).json(ok(await service.createPlatformRole(body)));
}

/** PUT /api/platform/roles/:id —— 改 name/remark/enabled（未传字段不改） */
export async function updateRole(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const body = updateBodySchema.parse(req.body ?? {});
  res.json(ok(await service.updatePlatformRole(id, body)));
}

/** DELETE /api/platform/roles/:id —— 删除角色与矩阵行（内置角色 400） */
export async function deleteRole(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  res.json(ok(await service.deletePlatformRole(id)));
}

/** GET /api/platform/roles/:id/permissions —— 角色权限矩阵（目录中每个域都出现） */
export async function getRolePermissions(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  res.json(ok(await service.getRolePermissions(id)));
}

/** PUT /api/platform/roles/:id/permissions —— 整表替换（同一事务先删后插） */
export async function replaceRolePermissions(req: any, res: any) {
  const id = idSchema.parse(req.params.id);
  const body = replaceMatrixBodySchema.parse(req.body ?? {});
  const matrix = body.matrix.map((cell) => ({
    moduleCode: cell.moduleCode,
    canMenu: cell.canMenu === true || Number(cell.canMenu) === 1,
    canPageBtn: cell.canPageBtn === true || Number(cell.canPageBtn) === 1,
    dataScope: cell.dataScope ?? "",
  }));
  res.json(ok(await service.replaceRolePermissions(id, matrix)));
}
