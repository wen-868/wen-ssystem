/**
 * S3-143：app-mobile 25 个页面菜单码的**单一真相源**（代码常量）+ 启动**幂等自愈**
 *
 * 一、为什么走代码常量而不是迁移（与 C6-2-T6-F2 同一口径，非新发明）
 *  - backend/src/shared/migration.ts:350 `resolveWriteGate()`：**只有显式** `MIGRATION_WRITE_GATE=allow`
 *    才放行 INSERT/UPDATE/DELETE/REPLACE/CALL；未设置一律回落 block。生产 `.env` 无该变量（凌舟实测）
 *    ⇒ 迁移里的补码 INSERT 每次启动都会被跳过（`R101-S3-136-F1-凌舟裁定.md` 一、二）；
 *  - `runMigrations()` 由 server.ts **每次启动调用**、全仓**无执行账本表** ⇒ 数据写入本就不能依赖迁移；
 *  - 项目既有口径：**目录走代码常量、迁移只做 DDL**（先例：`platform-role.service.ts` 的 PERMISSION_CATALOG）。
 *
 * 二、25 个码的清单/parent/显示名/排序：**照抄，不自拟**
 *  - 逐码清单与"持有该前缀的角色集合"证据：`docs/tasks/cards/R101-S3-136-F1-阿澈回传.md`、
 *    `docs/tasks/cards/R101-S3-136-F1-阿澈-可见性对照表.md`（§三 页面清单 + 附录 C 真库原始输出）、
 *    `docs/tasks/cards/R101-S3-136-F1-生产矩阵基线.md`（生产 64 码真值）；
 *  - 与阿澈产出的迁移 `docs/migrations/186_app-mobile页面菜单码补齐.sql` **逐条同值**
 *    （code / parent / menu_name / path / sort_no 61~85 完全一致），唯一区别是**执行载体**
 *    ——本单走"代码常量 + 启动自愈"，不再依赖迁移写闸门，故新环境/灾备库可复现。
 *
 * 三、等价规则（硬）
 *  对每个新码 `X:Y`，其角色映射 = **当前持有前缀 X 的全部角色**（持有 `X` 本身或 `X:任意`），
 *  集合在"新增方向"上完全相等：持有前缀的角色一个不少，未持有前缀的角色一个不多。
 *  映射**在执行时从库内绑定现算**，不写角色白名单字面量 ⇒ 对库内全部角色天然等价。
 *  角色关联只按 `rm.menu_id` 关联、按 `m.tenant_id` 过滤菜单（与 `menu-permission.service.ts`
 *  的 `getUserMenus` 取数口径一致）——**不**用 `t_sys_role_menu.tenant_id` 过滤，
 *  否则一旦该列取值与 'default' 不一致，映射会插 0 行。
 *
 * 四、幂等（精确表述）
 *  "存在则跳过、缺失则补"：菜单行按 `(menu_code, tenant_id)` 判定，角色映射按 `(role_id, menu_id)` 判定；
 *  两道防线 = 计划期守卫（只对缺失项生成 INSERT）+ 库内唯一键
 *  （`t_sys_menu.uk_sys_menu_code_tenant`、`t_sys_role_menu.uk_sys_role_menu`，配合 `INSERT IGNORE`）。
 *  已存在的行一律不动：**不 UPDATE、不 DELETE、不 REPLACE**，既有 64 码与既有绑定零改动。
 *
 * 五、全新空库 / 灾备库
 *  父码（`customer` / `goods` 等 CATALOG 行）不存在时，该码**整条跳过**（不插孤儿行、不报错、不阻断启动），
 *  与 186 的"父码不存在 ⇒ SELECT 返回 0 行"同义；这是全新空库尚未灌菜单时的预期结果。
 *
 * 六、SUPER_ADMIN
 *  生产 `t_sys_role_menu` 里超管是 **0 行**（超管按代码旁路：`menu-permission.service.ts`
 *  `getUserMenus` 对 SUPER_ADMIN 直接返回全量 `t_sys_menu`）⇒ 本自愈**不给超管补行**、
 *  也**不得**按"0 行 ⇒ 全不可见"推。补码后超管自动可见这 25 页。
 */
import type { ResultSetHeader } from "mysql2";
import { query, transaction, connExecute } from "./db";
import logger from "./logger";

/** 25 个码落在的租户（与生产 `t_sys_menu.tenant_id` 取值一致） */
export const APP_MOBILE_MENU_TENANT_ID = "default";

/** 日志前缀（便于在启动日志里检索本自愈的每次结果） */
export const APP_MOBILE_MENU_LOG_TAG = "[app-mobile-menu]";

/** 单条页面菜单码种子（parent/name/path/sortNo 与 186 迁移逐条同值） */
export interface AppMobileMenuSeedEntry {
  /** menu_code，如 `customer:address` */
  code: string;
  /** 前缀父码（CATALOG 行的 menu_code），如 `customer` */
  parent: string;
  /** menu_name（中文显示名） */
  name: string;
  /** path（与 186 同值：`/` + code 中的 `:` 换成 `/`） */
  path: string;
  /** sort_no：61~85，排在既有子项之后 */
  sortNo: number;
}

/** app-mobile 功能页需要、而生产菜单表里不存在的 25 个码（顺序即 sort_no 升序） */
export const APP_MOBILE_MENU_CATALOG: ReadonlyArray<AppMobileMenuSeedEntry> = [
  { code: "customer:address", parent: "customer", name: "收货地址", path: "/customer/address", sortNo: 61 },
  { code: "customer:level", parent: "customer", name: "会员等级", path: "/customer/level", sortNo: 62 },
  { code: "customer:points", parent: "customer", name: "积分管理", path: "/customer/points", sortNo: 63 },
  { code: "customer:stored-card", parent: "customer", name: "储值卡", path: "/customer/stored-card", sortNo: 64 },
  { code: "finance:expenses", parent: "finance", name: "费用支出", path: "/finance/expenses", sortNo: 65 },
  { code: "finance:reconciliation", parent: "finance", name: "收银对账", path: "/finance/reconciliation", sortNo: 66 },
  { code: "finance:transfer", parent: "finance", name: "门店调拨", path: "/finance/transfer", sortNo: 67 },
  { code: "goods:loss-gain", parent: "goods", name: "报损报益", path: "/goods/loss-gain", sortNo: 68 },
  { code: "goods:stock-check", parent: "goods", name: "盘点调拨", path: "/goods/stock-check", sortNo: 69 },
  { code: "goods:stock-warning", parent: "goods", name: "库存预警", path: "/goods/stock-warning", sortNo: 70 },
  { code: "goods:trace", parent: "goods", name: "溯源查询", path: "/goods/trace", sortNo: 71 },
  { code: "marketing:activities", parent: "marketing", name: "营销活动", path: "/marketing/activities", sortNo: 72 },
  { code: "marketing:bargain", parent: "marketing", name: "砍价活动", path: "/marketing/bargain", sortNo: 73 },
  { code: "marketing:community", parent: "marketing", name: "社区营销", path: "/marketing/community", sortNo: 74 },
  { code: "marketing:seckill", parent: "marketing", name: "秒杀活动", path: "/marketing/seckill", sortNo: 75 },
  { code: "report:dashboard", parent: "report", name: "经营报表", path: "/report/dashboard", sortNo: 76 },
  { code: "report:finance-report", parent: "report", name: "财务报表", path: "/report/finance-report", sortNo: 77 },
  { code: "report:inventory", parent: "report", name: "库存报表", path: "/report/inventory", sortNo: 78 },
  { code: "report:purchase", parent: "report", name: "采购报表", path: "/report/purchase", sortNo: 79 },
  { code: "store:employees", parent: "store", name: "员工管理", path: "/store/employees", sortNo: 80 },
  { code: "store:roles", parent: "store", name: "角色管理", path: "/store/roles", sortNo: 81 },
  { code: "system:more", parent: "system", name: "更多功能", path: "/system/more", sortNo: 82 },
  { code: "system:operation-log", parent: "system", name: "操作日志", path: "/system/operation-log", sortNo: 83 },
  { code: "system:permission", parent: "system", name: "报表权限", path: "/system/permission", sortNo: 84 },
  { code: "system:print", parent: "system", name: "单据打印", path: "/system/print", sortNo: 85 },
];

/** 本单只碰这 25 个码（既有 64 码一行不碰） */
export const APP_MOBILE_MENU_CODES: ReadonlyArray<string> = APP_MOBILE_MENU_CATALOG.map((e) => e.code);

/** 25 个码涉及的前缀父码去重（7 个：customer/finance/goods/marketing/report/store/system） */
export const APP_MOBILE_MENU_PREFIXES: ReadonlyArray<string> = [
  ...new Set(APP_MOBILE_MENU_CATALOG.map((e) => e.parent)),
];

/** 库内菜单行（只取自愈需要的两列） */
export interface MenuRowIdentity {
  id: number;
  menuCode: string;
}

/** 库内角色↔菜单绑定行（只取自愈需要的两列） */
export interface RoleMenuRowIdentity {
  roleId: number;
  menuCode: string;
}

/** 待插入的菜单行（parent_id 已解析） */
export interface AppMobileMenuInsert {
  parentId: number;
  code: string;
  name: string;
  path: string;
  sortNo: number;
}

/** 待插入的角色映射（附 code，便于执行期用"新插入菜单的 id"回填） */
export interface AppMobileMenuBindingInsert {
  roleId: number;
  code: string;
}

/** 自愈计划（纯计算产物，可单测） */
export interface AppMobileMenuSelfHealPlan {
  /** 需要新增的菜单行（已存在的码不在此列） */
  menusToInsert: AppMobileMenuInsert[];
  /** 需要新增的角色映射（已存在的绑定不在此列） */
  bindingsToInsert: AppMobileMenuBindingInsert[];
  /** 因父码不存在而跳过的码（全新空库尚未灌菜单时的预期结果） */
  skippedCodes: string[];
}

/** 自愈执行结果（启动日志 + 回传证据用） */
export interface AppMobileMenuSelfHealResult {
  /** false = 本次未执行（读取失败/异常），不阻断启动 */
  applied: boolean;
  insertedMenus: number;
  insertedBindings: number;
  skippedCodes: string[];
  /** 自愈前库内菜单行数（default 租户），用于"64 → 89"这类核对 */
  existingMenuCount: number;
}

/** 菜单码 → 前缀（`customer:address` → `customer`；无 `:` 时返回自身） */
export function menuPrefixOf(menuCode: string): string {
  const idx = menuCode.indexOf(":");
  return idx < 0 ? menuCode : menuCode.slice(0, idx);
}

function addToSetMap(map: Map<string, Set<number>>, key: string, value: number): void {
  const set = map.get(key);
  if (set) {
    set.add(value);
  } else {
    map.set(key, new Set([value]));
  }
}

/**
 * 计算自愈计划（**纯函数**，不碰数据库）：
 *  - 菜单：catalog 中"库里没有且父码存在"的码 → 新增；父码不存在 → 跳过（不产生孤儿行）；
 *  - 角色映射：每个码的目标角色集合 = 当前持有该前缀的角色集合；只补"缺失的绑定"。
 * 已存在的菜单行、已存在的绑定**不进入计划** ⇒ 重复执行天然幂等、既有 64 码零改动。
 */
export function planAppMobileMenuSelfHeal(input: {
  menuRows: ReadonlyArray<MenuRowIdentity>;
  bindingRows: ReadonlyArray<RoleMenuRowIdentity>;
  catalog?: ReadonlyArray<AppMobileMenuSeedEntry>;
}): AppMobileMenuSelfHealPlan {
  const catalog = input.catalog ?? APP_MOBILE_MENU_CATALOG;

  const idByCode = new Map<string, number>();
  for (const row of input.menuRows) {
    idByCode.set(row.menuCode, Number(row.id));
  }

  // 「持有前缀 X」= 持有 X 本身或 X:任意（与 186 的 `menu_code = 'X' OR menu_code LIKE 'X:%'` 同义）
  const holderRolesByPrefix = new Map<string, Set<number>>();
  const boundRolesByCode = new Map<string, Set<number>>();
  for (const row of input.bindingRows) {
    const roleId = Number(row.roleId);
    addToSetMap(holderRolesByPrefix, menuPrefixOf(row.menuCode), roleId);
    addToSetMap(boundRolesByCode, row.menuCode, roleId);
  }

  const menusToInsert: AppMobileMenuInsert[] = [];
  const bindingsToInsert: AppMobileMenuBindingInsert[] = [];
  const skippedCodes: string[] = [];

  for (const entry of catalog) {
    if (idByCode.get(entry.code) === undefined) {
      const parentId = idByCode.get(entry.parent);
      if (parentId === undefined) {
        skippedCodes.push(entry.code);
        continue;
      }
      menusToInsert.push({
        parentId,
        code: entry.code,
        name: entry.name,
        path: entry.path,
        sortNo: entry.sortNo,
      });
    }

    const holders = holderRolesByPrefix.get(entry.parent);
    if (!holders) continue;
    const bound = boundRolesByCode.get(entry.code);
    for (const roleId of [...holders].sort((a, b) => a - b)) {
      if (!bound || !bound.has(roleId)) {
        bindingsToInsert.push({ roleId, code: entry.code });
      }
    }
  }

  bindingsToInsert.sort((a, b) =>
    a.code === b.code ? a.roleId - b.roleId : a.code < b.code ? -1 : 1
  );

  return { menusToInsert, bindingsToInsert, skippedCodes };
}

/** 读库：default 租户的菜单行（id + menu_code） */
export const LIST_APP_MOBILE_TARGET_MENUS_SQL =
  "SELECT id, menu_code AS menuCode FROM t_sys_menu WHERE tenant_id = ?";

/**
 * 读库：角色 ↔ 菜单绑定（带 menu_code）。
 * 只按 `m.tenant_id` 过滤菜单、**不**按 `rm.tenant_id` 过滤绑定——与后端 `getUserMenus`
 * 和生产取证 SQL 同口径（见文件头"三、等价规则"）。
 */
export const LIST_APP_MOBILE_TARGET_BINDINGS_SQL =
  "SELECT rm.role_id AS roleId, m.menu_code AS menuCode " +
  "FROM t_sys_role_menu rm JOIN t_sys_menu m ON m.id = rm.menu_id WHERE m.tenant_id = ?";

/** 写库：新增菜单行（列与 186 迁移一致；menu_type=MENU、icon=NULL、status 走列默认） */
export const INSERT_APP_MOBILE_MENU_SQL =
  "INSERT IGNORE INTO t_sys_menu " +
  "(parent_id, menu_code, menu_name, menu_type, path, icon, sort_no, tenant_id) " +
  "VALUES (?, ?, ?, 'MENU', ?, NULL, ?, ?)";

/** 写库：新增角色映射（唯一键 uk_sys_role_menu(role_id, menu_id) 兜底） */
export const INSERT_APP_MOBILE_ROLE_MENU_SQL =
  "INSERT IGNORE INTO t_sys_role_menu (tenant_id, role_id, menu_id) VALUES (?, ?, ?)";

/**
 * 启动幂等自愈：存在则跳过、缺失则补。
 *
 * 调用时机：`server.ts` 的 `start()` 内、`runMigrations()` 之后（表结构已就绪）。
 * 失败姿态：读库失败/写库异常一律**只记日志、不抛**，绝不阻断后端启动（与 `runMigrations` 同姿态）。
 */
export async function ensureAppMobileMenus(
  tenantId: string = APP_MOBILE_MENU_TENANT_ID
): Promise<AppMobileMenuSelfHealResult> {
  const notApplied: AppMobileMenuSelfHealResult = {
    applied: false,
    insertedMenus: 0,
    insertedBindings: 0,
    skippedCodes: [],
    existingMenuCount: 0,
  };

  let menuRows: MenuRowIdentity[];
  let bindingRows: RoleMenuRowIdentity[];
  try {
    menuRows = await query<MenuRowIdentity>(LIST_APP_MOBILE_TARGET_MENUS_SQL, [tenantId]);
    bindingRows = await query<RoleMenuRowIdentity>(LIST_APP_MOBILE_TARGET_BINDINGS_SQL, [tenantId]);
  } catch (e) {
    logger.warn(
      `${APP_MOBILE_MENU_LOG_TAG} 读取 t_sys_menu / t_sys_role_menu 失败，本次跳过自愈（不阻断启动）: ` +
        `${(e as Error).message}`
    );
    return notApplied;
  }

  const plan = planAppMobileMenuSelfHeal({ menuRows, bindingRows });
  const result: AppMobileMenuSelfHealResult = {
    applied: true,
    insertedMenus: 0,
    insertedBindings: 0,
    skippedCodes: plan.skippedCodes,
    existingMenuCount: menuRows.length,
  };

  if (plan.skippedCodes.length > 0) {
    logger.warn(
      `${APP_MOBILE_MENU_LOG_TAG} ${plan.skippedCodes.length} 个码因父码不存在被跳过（全新空库尚未灌菜单属预期）: ` +
        plan.skippedCodes.join(",")
    );
  }

  if (plan.menusToInsert.length === 0 && plan.bindingsToInsert.length === 0) {
    logger.info(
      `${APP_MOBILE_MENU_LOG_TAG} 已是最新：25 个页面菜单码与角色映射均在库（既有 ${result.existingMenuCount} 条菜单未改动），本次 0 变更`
    );
    return result;
  }

  const menuIdByCode = new Map<string, number>();
  for (const row of menuRows) {
    menuIdByCode.set(row.menuCode, Number(row.id));
  }

  try {
    await transaction(async (conn) => {
      for (const row of plan.menusToInsert) {
        const [res] = await connExecute<ResultSetHeader>(conn, INSERT_APP_MOBILE_MENU_SQL, [
          row.parentId,
          row.code,
          row.name,
          row.path,
          row.sortNo,
          tenantId,
        ]);
        if (res.affectedRows > 0 && res.insertId) {
          menuIdByCode.set(row.code, res.insertId);
          result.insertedMenus += 1;
        }
      }

      for (const row of plan.bindingsToInsert) {
        const menuId = menuIdByCode.get(row.code);
        if (menuId === undefined) continue;
        const [res] = await connExecute<ResultSetHeader>(conn, INSERT_APP_MOBILE_ROLE_MENU_SQL, [
          tenantId,
          row.roleId,
          menuId,
        ]);
        if (res.affectedRows > 0) result.insertedBindings += 1;
      }
    });
  } catch (e) {
    logger.error(
      `${APP_MOBILE_MENU_LOG_TAG} 写入失败已回滚，本次自愈未生效（不阻断启动）: ${(e as Error).message}`
    );
    return { ...result, applied: false, insertedMenus: 0, insertedBindings: 0 };
  }

  logger.info(
    `${APP_MOBILE_MENU_LOG_TAG} 自愈完成：新增菜单 ${result.insertedMenus} 条、角色映射 ${result.insertedBindings} 条` +
      `（自愈前既有菜单 ${result.existingMenuCount} 条，一行未改动）`
  );
  return result;
}
