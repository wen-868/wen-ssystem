// ============================================================================
// 工作台（admin-web）「按钮级权限门」注册表（S3-240 · 授权模型裁定 D4）
//
// 背景（为什么要有这个文件）
//   后端已给一批写端点挂了权限码，但工作台页面对**不持码**的在用角色仍然把按钮
//   摆在眼前 ⇒ 点下去必 403（违反不变量 I1'②）。D4 裁定：这类「可见但点不了」的写能力，
//   必须由**前端按码显隐**补齐，后端才可收编接线。
//   依据：`docs/tasks/cards/R101-授权模型提案-凌舟-20261016.md` §〇·修订（I1'）+ §二（D4），
//        S3-233 裁定 §二.1（`goods:delete` / `system:user:*` / `system:role:*` ⇒ 另立本单）。
//
// 判据同源（**镜像，不许分叉**）
//   后端：`backend/src/services/admin/rbac.service.ts` 的 `matchPermission()`（:295）
//     ① `"*"` ⇒ 全通过；② `"<dom>:*"` 模块通配；③ `"*:<action>"` 动作通配；④ 精确码。
//   本文件 `matchPermissionCode()` 逐条等价，与手机端 `app-mobile/src/config/permission-gates.ts`
//   的镜像同形（同一身份域内两端口径必须同源，见 S3-203 口径）。
//   ⚠️ 为什么不能直接用 `permissions.includes(code)`：生产 `SUPER_ADMIN` / `OPERATION_ADMIN`
//     的角色权限串是 `["*"]`（见 `docs/evidence/_shared/prod-roles-20261016.txt`），
//     用 includes 会把**店主**打成"不持码" ⇒ 把删除/新增按钮从老板界面上藏掉（假回归）。
//
// 「未取到权限码」的处置（**失败关闭**，同 S3-231 F3 裁定 5）
//   · `permissions` 为 `null` / `undefined` ⇒ 尚未取到（登录响应与 `/admin/auth/me` 均会下发
//     `permissions`；升级前的本地缓存可能确实没有）⇒ **不显示**；
//   · `permissions` 为**空数组** ⇒ 确实取到了、且该用户没有任何码 ⇒ **不显示**；
//   · 门码数组为**空**（`status = 'registered'` 的登记项）⇒ **放行**（该按钮不设门，见各自 `note`）。
//
// 用法（页面里只写门 id，不手写权限码）
//   `<el-button v-if="canGate('goods-brand-delete')">删除</el-button>`
//   注册表是「按钮 ↔ 码」的**唯一真相源**：runtime 显隐、证据表、断言都从这里读；
//   新增按钮时**先加一行**，再在页面里引用该 id。
// ============================================================================

/**
 * 权限码匹配 —— 后端 `matchPermission()` 的逐条镜像（`backend/src/services/admin/rbac.service.ts:295`）。
 *
 * 判定顺序（与后端一致）：
 *  1. `"*"` ⇒ 全通过；
 *  2. 持码含 `"<dom>:*"`，且待判定码以 `<dom>:` 开头 ⇒ 通过（模块通配）；
 *  3. 持码含 `"*:<action>"`，且待判定码以 `:<action>` 结尾 ⇒ 通过（动作通配）；
 *  4. 精确码命中 ⇒ 通过；其余 ⇒ 不通过。
 *
 * @param perms    当前用户的权限码集合（`t_sys_role.permissions` 去重合并，含通配）
 * @param permCode 待判定的权限码（如 `goods:delete` / `system:user:edit`）
 */
export function matchPermissionCode(
  perms: readonly string[] | null | undefined,
  permCode: string
): boolean {
  if (!Array.isArray(perms) || typeof permCode !== "string" || permCode.length === 0) return false;
  if (perms.includes("*")) return true;

  const domIndex = permCode.indexOf(":");
  if (domIndex > 0 && perms.includes(`${permCode.slice(0, domIndex)}:*`)) return true;

  const actionIndex = permCode.lastIndexOf(":");
  if (
    actionIndex > -1 &&
    actionIndex < permCode.length - 1 &&
    perms.includes(`*:${permCode.slice(actionIndex + 1)}`)
  ) {
    return true;
  }
  return perms.includes(permCode);
}

/**
 * 「全部持有」判定：一个按钮若承载**多个不同码**的写端点，必须每个码都持有才显示
 * （否则其中某个端点仍会"看得到但点不了"，等于没补门）。
 *
 * · `codes` 为空 / `null` ⇒ 不设门 ⇒ 放行（`status='registered'` 的登记项走这条）；
 * · `perms` 为 `null` / `undefined` ⇒ 未取到权限码 ⇒ **不显示**（失败关闭）。
 */
export function hasPermissionCodes(
  perms: readonly string[] | null | undefined,
  codes: readonly string[] | undefined | null
): boolean {
  if (!codes || codes.length === 0) return true;
  if (perms === null || perms === undefined) return false;
  return codes.every((code) => matchPermissionCode(perms, code));
}

/** 门状态：`gated` = 已按码显隐；`registered` = 只登记不门（原因写在 `note`） */
export type GateStatus = "gated" | "registered";

export interface ButtonGate {
  /** 稳定 id（页面 / 证据 / 断言共用键） */
  id: string;
  /** 域（与后端路由文件分域一致） */
  domain: string;
  /** 承载该能力的写端点（方法 + 路径，逐条列出；后端注册行为准） */
  endpoints: string[];
  /** 入口所在页面（相对 `admin-web/src` 的路径，可多条） */
  pages: string[];
  /** 人读位置（页面上具体哪一处） */
  entry: string;
  /** 显隐依据的权限码；`registered` 项恒为空数组 */
  codes: string[];
  status: GateStatus;
  /** 仅 `registered` 项必填：为什么不门（写清楚，不留"待补"） */
  note?: string;
}

/**
 * 按钮级权限门注册表（唯一真相源）。
 *
 * 码的持有者以生产底稿为准：`docs/evidence/_shared/prod-roles-20261016.txt`
 * （`goods:delete` / `system:user:create|edit` / `system:role:create|edit` 当前仅由
 *  `["*"]` 通配角色 `SUPER_ADMIN` / `OPERATION_ADMIN` 持有 ⇒ 店长等在用角色点下去必 403）。
 */
export const BUTTON_GATES: readonly ButtonGate[] = [
  // ── 商品域（`goods:delete`）──────────────────────────────────────────────
  {
    id: "goods-brand-delete",
    domain: "商品",
    endpoints: ["DELETE /api/admin/brands/:id"],
    pages: ["views/product/Brands.vue"],
    entry: "品牌管理 · 列表「操作」列 · 删除（确认框）",
    codes: ["goods:delete"],
    status: "gated"
  },
  {
    id: "goods-tag-delete",
    domain: "商品",
    endpoints: ["DELETE /api/admin/product-tags/:id"],
    pages: ["views/product/ProductTags.vue"],
    entry: "商品标签 · 列表「操作」列 · 删除（确认框）",
    codes: ["goods:delete"],
    status: "gated"
  },
  {
    id: "goods-unit-group-delete",
    domain: "商品",
    endpoints: ["DELETE /api/admin/unit-groups/:id"],
    pages: ["views/product/Units.vue"],
    entry: "单位管理 · 单位组卡片 · 删除（确认框）",
    codes: ["goods:delete"],
    status: "gated"
  },
  {
    id: "goods-category-delete",
    domain: "商品",
    endpoints: ["DELETE /api/admin/products/categories/:id"],
    pages: ["views/product/ProductCategories.vue"],
    entry: "商品分类 · 树工具栏 · 删除",
    codes: ["goods:delete"],
    status: "gated"
  },
  {
    id: "goods-sku-unit-delete",
    domain: "商品",
    endpoints: ["DELETE /api/admin/products/skus/:skuId/units/:unitId"],
    pages: ["views/product/Products.vue"],
    entry: "商品管理 · SKU 明细 · 单位行 · 删除（非基础单位）",
    codes: ["goods:delete"],
    status: "gated"
  },

  // ── 员工 / 账号域（`system:user:create` / `system:user:edit`）──────────────
  {
    id: "staff-create",
    domain: "员工账号",
    endpoints: ["POST /api/admin/staff"],
    pages: ["views/system/EmployeesView.vue", "views/system/OrganizationView.vue"],
    entry: "员工管理 / 组织架构 · 页头 · 新增员工",
    codes: ["system:user:create"],
    status: "gated"
  },
  {
    id: "staff-edit",
    domain: "员工账号",
    endpoints: ["PUT /api/admin/staff/:id"],
    pages: ["views/system/EmployeesView.vue", "views/system/OrganizationView.vue"],
    entry: "员工管理 / 组织架构 · 列表「操作」列 · 编辑",
    codes: ["system:user:edit"],
    status: "gated"
  },
  {
    id: "staff-reset-password",
    domain: "员工账号",
    endpoints: ["POST /api/admin/sys-users/:id/reset-password"],
    pages: ["views/system/EmployeesView.vue", "views/system/OrganizationView.vue"],
    entry: "员工管理 / 组织架构 · 列表「操作」列 · 重置密码",
    codes: ["system:user:edit"],
    status: "gated"
  },
  {
    id: "staff-toggle-status",
    domain: "员工账号",
    endpoints: ["PUT /api/admin/staff/:id/status"],
    pages: ["views/system/EmployeesView.vue", "views/system/OrganizationView.vue"],
    entry: "员工管理 / 组织架构 · 列表「操作」列 · 禁用 / 启用",
    codes: ["system:user:edit"],
    status: "gated"
  },

  // ── 角色域（`system:role:create` / `system:role:edit`）────────────────────
  {
    id: "role-create",
    domain: "角色",
    endpoints: ["POST /api/admin/system/roles"],
    pages: ["views/system/SystemRoles.vue"],
    entry: "角色管理 · 页头 · 新增角色",
    codes: ["system:role:create"],
    status: "gated"
  },
  {
    id: "role-edit",
    domain: "角色",
    endpoints: ["PUT /api/admin/system/roles/:id"],
    pages: ["views/system/SystemRoles.vue"],
    entry: "角色管理 · 列表「操作」列 · 编辑",
    codes: ["system:role:edit"],
    status: "gated"
  },
  {
    id: "role-delete",
    domain: "角色",
    endpoints: ["DELETE /api/admin/system/roles/:id"],
    pages: ["views/system/SystemRoles.vue"],
    entry: "角色管理 · 列表「操作」列 · 删除（确认框）",
    codes: ["system:role:edit"],
    status: "gated"
  },
  {
    id: "role-assign-users",
    domain: "角色",
    endpoints: ["PUT /api/admin/system/roles/users/:userId/roles"],
    pages: ["views/system/SystemRoles.vue"],
    entry: "角色管理 · 列表「操作」列 · 分配用户",
    codes: ["system:role:edit"],
    status: "gated"
  },
  {
    id: "role-dialog-save",
    domain: "角色",
    endpoints: [
      "POST /api/admin/system/roles",
      "PUT /api/admin/system/roles/:id",
      "PUT /api/admin/system/roles/:id/data-permissions"
    ],
    pages: ["views/system/SystemRoles.vue"],
    entry: "角色管理 · 创建/编辑弹窗 · 保存",
    codes: [],
    status: "registered",
    note:
      "同一按钮在**不同模式下打不同码**（新增路径 = create + edit 两码；编辑路径 = edit 一码）⇒ 按派单卡「单按钮多码只登记、不自创规则」处置。" +
      "弹窗**只能**由已过入口门的「新增角色 / 编辑」打开（入口门已按 role-create / role-edit 显隐）⇒ 残留暴露面为 0。"
  },
  {
    id: "staff-dialog-save",
    domain: "员工账号",
    endpoints: ["POST /api/admin/staff", "PUT /api/admin/staff/:id"],
    pages: ["views/system/EmployeesView.vue", "views/system/OrganizationView.vue"],
    entry: "员工管理 / 组织架构 · 新增/编辑弹窗 · 保存",
    codes: [],
    status: "registered",
    note:
      "同上：保存按钮按模式分别走 create / edit 两个码（一次只打一个），静态无法二分 ⇒ 只登记。" +
      "弹窗只能由已过入口门的「新增员工 / 编辑」打开 ⇒ 残留暴露面为 0。"
  }
];

const GATE_INDEX: ReadonlyMap<string, ButtonGate> = new Map(BUTTON_GATES.map((g) => [g.id, g]));

/** 全部门 id（供证据脚本 / 断言枚举，避免"文档一套、代码一套"） */
export function gateIds(): string[] {
  return BUTTON_GATES.map((g) => g.id);
}

/**
 * 取某个门的显隐码集合。
 * 未登记的 id ⇒ 返回 `undefined`（调用方按**失败关闭**处理，并在控制台报出，避免静默放行）。
 */
export function codesOfGate(id: string): readonly string[] | undefined {
  return GATE_INDEX.get(id)?.codes;
}

/** 取某个门的完整定义（证据脚本用） */
export function gateOf(id: string): ButtonGate | undefined {
  return GATE_INDEX.get(id);
}

/**
 * 归一化后端下发的 `permissions` 字段：
 * · 非数组（含 `undefined` / `null` / 字符串 / 对象）⇒ 返回 `null`（= 未取到 ⇒ 失败关闭）；
 * · 数组 ⇒ 仅保留字符串项（与后端 `parsePermissions` 同口径），重复项去重。
 */
export function normalizePermissionList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return Array.from(new Set(list));
}
