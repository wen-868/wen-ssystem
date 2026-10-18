/**
 * S3-236（立码第二批 · 四域 38 码）：目录条目的**共用形状与校验**
 *
 * 为什么单独一个文件：四域各一个 per-域常量文件 + 一个汇总文件，共用同一个 entry 形状与
 * `模块:子域:动作` 形态校验，避免"五个文件各写一套形状"造成断言看不全。
 * 形状逐字对照 S3-232 的 `SystemPermissionEntry`（先例），**只增不改**：
 *   `code / module / name / action / routeFile / endpoints / menuParent / frontendEntry`。
 */
export interface Batch2PermissionEntry {
  /** 权限码（`模块:子域:动作`） */
  code: string;
  /** 模块名（取 079_权限矩阵.sql 的既有模块码：report / system / store / miniapp / dashboard） */
  module: string;
  /** 中文名（写进 `t_sys_menu.menu_name`，与迁移 207 逐字同值） */
  name: string;
  /** 动作（`模块:子域:动作` 的第三段） */
  action: string;
  /** 路由文件（相对 `backend/src/routes/`）：与 `endpoints` 一一对应 */
  routeFile: string;
  /** 该码覆盖的写端点（`METHOD /api/...`，路径字面量，供断言逐条核对） */
  endpoints: ReadonlyArray<string>;
  /**
   * 逐端点对应的路由文件（**与 `endpoints` 同下标同序**）。
   * 只有"一个码覆盖多个不同路由文件"的条目才需要（本批 = 报表域 4 条：v2 与模板同码）。
   * 缺省时断言按 `routeFile` 单个文件核对。
   */
  routeFiles?: ReadonlyArray<string>;
  /** 注册进 `t_sys_menu` 的父行 menu_code（必须取自 079 的既有 CATALOG 码） */
  menuParent: string;
  /**
   * 前端调用点检索用的**宽松形状**（落地面 4）：断言要求的端点字面量含 `:id(\\d+)` 这类
   * Express 正则段，前端不会那样写 ⇒ 另给一份按 `:id` 检索的形状，供扫描装置使用。
   */
  callPatterns?: ReadonlyArray<string>;
  /**
   * 前端**请求路径**字面量（多数前端的 api 层写**相对前缀**，如 app-mobile 的
   * `post("/admin/print/records")`，不带 `/api`）⇒ 供落地面 4 的检索装置使用，
   * 避免"扫不到就登记成无入口"的**假读数**。
   */
  requestPatterns?: ReadonlyArray<string>;
  /** 前端入口（有则写页面/调用点，无则写"暂无前端入口，仅后端授权位"） */
  frontendEntry: string;
}

/** 允许的模块白名单：**只允许 079 既有模块码**（不许自造模块名，提案 §三） */
export const BATCH2_PERMISSION_MODULES: ReadonlyArray<string> = [
  "dashboard",
  "report",
  "store",
  "system",
  "miniapp",
];

/** 禁止的"万能码"动作（授权模型提案 §三：商家侧不再新增 `xxx:manage`） */
export const BATCH2_FORBIDDEN_PERMISSION_ACTIONS: ReadonlyArray<string> = ["manage"];

/**
 * 允许的 **两段式** 码形态（`模块:动作`）。
 *
 * 为什么要有这个白名单：本仓命名规范是 `模块:子域:动作`，但 **079 既有码族里有两段式先例**
 * （`store:list` / `store:create` / `store:edit`，079 第 169/216/217 行），
 * 且本批清单 §2.1 明确要求 `report:export`（"动作取 079 规范动作 `export`"）
 * ⇒ 断言不能一律要求三段（否则把"照抄清单"判成违规）。两段式的**动作段**限定在本表内。
 */
export const BATCH2_ALLOWED_TWO_SEGMENT_ACTIONS: ReadonlyArray<string> = [
  "backup",
  "batch",
  "cancel",
  "check",
  "create",
  "delete",
  "edit",
  "export",
  "handle",
  "import",
  "list",
  "print",
  "publish",
  "read",
  "reset",
  "restore",
  "run",
  "send",
  "test",
  "toggle",
  "view",
];

/**
 * 声明一条目录条目：形状合法性与命名规范**在这里统一校验**（写错当场抛，不留给运行时）。
 * 校验项：① 码是 `模块:子域:动作`（三段）**或** `模块:动作`（两段，动作在白名单内）；
 *        ② 模块在白名单内且与码首段同值；③ 无 `*` / 无 `manage` / 段内只允许 `[a-z0-9-]`；
 *        ④ 末段 = `action`；⑤ 端点非空且形如 `METHOD /api/...`。
 */
export function defineBatch2Entry(entry: Batch2PermissionEntry): Batch2PermissionEntry {
  const segments = entry.code.split(":");
  if (segments.length !== 3 && segments.length !== 2) {
    throw new Error(`权限码必须是 模块:子域:动作（三段）或 模块:动作（两段）：${entry.code}`);
  }
  if (segments[0] !== entry.module) {
    throw new Error(`权限码首段与 module 不一致：${entry.code} / ${entry.module}`);
  }
  if (!BATCH2_PERMISSION_MODULES.includes(entry.module)) {
    throw new Error(`模块不在 079 既有模块码白名单内：${entry.module}`);
  }
  if (segments[segments.length - 1] !== entry.action) {
    throw new Error(`权限码末段与 action 不一致：${entry.code} / ${entry.action}`);
  }
  if (segments.length === 2 && !BATCH2_ALLOWED_TWO_SEGMENT_ACTIONS.includes(entry.action)) {
    throw new Error(`两段式码的动作不在白名单内（079 既有动作先例）：${entry.code}`);
  }
  for (const segment of segments) {
    if (segment === "*") throw new Error(`权限码不得含通配符：${entry.code}`);
    if (BATCH2_FORBIDDEN_PERMISSION_ACTIONS.includes(segment)) {
      throw new Error(`权限码不得含万能动作：${entry.code}`);
    }
    if (!/^[a-z0-9-]+$/.test(segment)) {
      throw new Error(`权限码段只允许 [a-z0-9-]：${entry.code}`);
    }
  }
  if (entry.endpoints.length === 0) throw new Error(`权限码必须声明至少一个端点：${entry.code}`);
  for (const endpoint of entry.endpoints) {
    if (!/^(GET|POST|PUT|PATCH|DELETE) \/api\//.test(endpoint)) {
      throw new Error(`端点必须形如 "METHOD /api/..."：${entry.code} → ${endpoint}`);
    }
  }
  return entry;
}
