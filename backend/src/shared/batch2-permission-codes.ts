/**
 * S3-236（立码第二批 · 四域 38 码）：**汇总目录**（断言与门禁只认本文件）
 *
 * 一、为什么要有汇总层：四域各一个 per-域常量文件（report / hardware / miniapp / dashboard），
 *   断言要的是"整批 38 码"这一个数字与一份顺序，故用本文件把四域**按迁移 207 的 sort_no 顺序**
 *   拼成一个目录；顺带在这里重导出处（`batch2-entry.ts`）的类型，减少各域文件的样板 import。
 *
 * 二、条数口径（可复算）：报表 11 + 硬件打印 14 + 小程序 5 + 工作台 8 = **38**（卡 §一）。
 *   端点条数 45 = 报表 18 + 硬件 14 + 小程序 5 + 工作台 8（报表 4 条权限端点共用 1 码 ⇒ 码数 38 < 端点数 45）。
 *
 * 三、本批**不接任何业务路由**：`backend/src/routes/**` 零改动；本文件只被断言与后续接线批引用。
 */
import { defineBatch2Entry, type Batch2PermissionEntry } from "./batch2-entry";

export type { Batch2PermissionEntry };
export {
  BATCH2_ALLOWED_TWO_SEGMENT_ACTIONS,
  BATCH2_FORBIDDEN_PERMISSION_ACTIONS,
  BATCH2_PERMISSION_MODULES,
  defineBatch2Entry,
} from "./batch2-entry";

import {
  REPORT_PERMISSION_CATALOG,
  REPORT_PERMISSION_CODES,
  REPORT_PERMISSION_COUNT,
} from "./report-permission-codes";
import {
  HARDWARE_PERMISSION_CATALOG,
  HARDWARE_PERMISSION_CODES,
  HARDWARE_PERMISSION_COUNT,
} from "./hardware-permission-codes";
import {
  MINIAPP_PERMISSION_CATALOG,
  MINIAPP_PERMISSION_CODES,
  MINIAPP_PERMISSION_COUNT,
} from "./miniapp-permission-codes";
import {
  DASHBOARD_PERMISSION_CATALOG,
  DASHBOARD_PERMISSION_CODES,
  DASHBOARD_PERMISSION_COUNT,
} from "./dashboard-permission-codes";

// 汇总前逐条重跑形状校验：per-域文件即使被手改错，汇总层也会当场抛（不留给断言才发现）
const __ENTRIES: ReadonlyArray<Batch2PermissionEntry> = [
  ...REPORT_PERMISSION_CATALOG,
  ...HARDWARE_PERMISSION_CATALOG,
  ...MINIAPP_PERMISSION_CATALOG,
  ...DASHBOARD_PERMISSION_CATALOG,
];
for (const entry of __ENTRIES) defineBatch2Entry(entry);

/** 四域 38 码的汇总目录（顺序 = 迁移 207 的 sort_no 顺序 = 各 per-域文件的书写顺序） */
export const BATCH2_PERMISSION_CATALOG: ReadonlyArray<Batch2PermissionEntry> = __ENTRIES;

/** 四域 38 码（顺序同目录） */
export const BATCH2_PERMISSION_CODES: ReadonlyArray<string> = [
  ...REPORT_PERMISSION_CODES,
  ...HARDWARE_PERMISSION_CODES,
  ...MINIAPP_PERMISSION_CODES,
  ...DASHBOARD_PERMISSION_CODES,
];

/** 牌面码数：**域数/条数断言**的唯一出处（卡 §一：38） */
export const BATCH2_PERMISSION_COUNT = REPORT_PERMISSION_COUNT + HARDWARE_PERMISSION_COUNT + MINIAPP_PERMISSION_COUNT + DASHBOARD_PERMISSION_COUNT;

/** 本批立码覆盖的**写端点**条数（一码可覆盖多端点，故 ≥ 码数） */
export const BATCH2_PERMISSION_ENDPOINT_COUNT = BATCH2_PERMISSION_CATALOG.reduce(
  (sum, entry) => sum + entry.endpoints.length,
  0,
);

/** 逐域条数（供断言核对"11 / 14 / 5 / 8"逐域可复算） */
export const BATCH2_DOMAIN_COUNTS = {
  report: REPORT_PERMISSION_COUNT,
  hardware: HARDWARE_PERMISSION_COUNT,
  miniapp: MINIAPP_PERMISSION_COUNT,
  dashboard: DASHBOARD_PERMISSION_COUNT,
} as const;

/** 本批立码的迁移文件（断言"目录 ↔ 迁移一致"时读取的**唯一**文件） */
export const BATCH2_PERMISSION_MIGRATION = "207_四域权限点立码.sql";

/** 本批立码迁移的编号（断言快照用） */
export const BATCH2_PERMISSION_MIGRATION_NO = 207;
