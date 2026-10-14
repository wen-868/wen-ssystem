/**
 * `route-prefix-rules.js` 的类型声明（S3-189 ③）。
 *
 * 该实现是普通 ESM `.js`（理由见其文件头注释：要同时被 TS 启动期与 `.mjs` 门禁脚本加载，
 * 且必须随 `dist/` 上生产）。此处提供声明文件，使 TS 侧拿到类型而不需要 `allowJs` 之外的特殊处理。
 */

/** 重复前缀 → 声明该前缀的路由文件（文件名已排序） */
export interface RoutePrefixDuplicate {
  prefix: string;
  files: string[];
}

/** `METHOD /完整路径` 被多个文件注册（真重复端点） */
export interface RoutePrefixDuplicateEndpoint {
  endpoint: string;
  files: string[];
}

/** 判据入口：一条 `prefix + router` 注册 */
export interface RoutePrefixEntry {
  prefix: string;
  file: string;
  /** 该 router 直接注册的端点（`"POST /api/x/y"`，已由 joinRoutePath 归一）；子树不可知时传 [] */
  endpoints?: string[];
  /** 该入口是否挂了子路由（子树端点不可知 ⇒ 只登记不静默） */
  nestedRouter?: boolean;
}

/** 路由前缀卫生检查结果 */
export interface RoutePrefixReport {
  duplicatePrefixes: RoutePrefixDuplicate[];
  unlistedDuplicatePrefixes: RoutePrefixDuplicate[];
  duplicateEndpoints: RoutePrefixDuplicateEndpoint[];
  nestedRouterFiles: string[];
  /** S3-195 ③：**根前缀**（形如 `/api/xxx`）被多文件共享 —— **只出声、不判红** */
  sharedRootPrefixes: RoutePrefixDuplicate[];
}

/** 逐条登记理由的重复前缀白名单（唯一一份，见实现文件） */
export declare const DUPLICATE_PREFIX_ALLOWLIST: Record<string, string>;

/** 拼出端点完整路径（折叠斜杠 / 去尾斜杠 / 参数名归一为 `:`） */
export declare function joinRoutePath(prefix: string, routePath?: string): string;

/** 判定重复前缀 / 未登记前缀 / 真重复端点（纯函数） */
export declare function classifyRoutePrefixes(entries: RoutePrefixEntry[]): RoutePrefixReport;

/** 「根前缀」= 形如 `/api/xxx` 的直接子段（再深一层如 `/api/store/coupons` 不算）—— S3-195 ③ */
export declare const ROOT_PREFIX_RE: RegExp;

/** 从重复前缀里筛出根前缀（S3-195 ③ 的告警判据；只出声、不判红） */
export declare function findSharedRootPrefixes(duplicatePrefixes: RoutePrefixDuplicate[]): RoutePrefixDuplicate[];
