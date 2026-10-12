/**
 * 回库错误 → 业务文案（该族的**唯一**共享实现，S3-155 抽取）
 *
 * 背景（同族缺陷）：S3-151（建品/批量导入/改条码）、S3-154（商品 CSV 导入）、S3-155（催收批量提醒 /
 * 平台商品库批量导入 / 离线销售单提交）——多处"逐行/逐条 catch 直接把库报错原文回给调用方"，
 * 典型泄漏为 `Duplicate entry 'xxx' for key 'uk_yyy'`。
 *
 * 口径（延续 S3-154，标准 §零.3「公共逻辑只写一次」）：
 *  - 撞"条码"列 ⇒ 统一中文文案 `BARCODE_DUPLICATE_MESSAGE`；
 *  - 撞其它唯一键 ⇒ 由调用方给出**本领域**中文文案（`dupMessage`，禁止张冠李戴）；
 *  - 非撞键错误 ⇒ 保留原始信息（不误吞、不掩盖）。
 */

/** 撞"条码"列时的统一中文业务文案（S3-154 定口径） */
export const BARCODE_DUPLICATE_MESSAGE = "该条码已被其他商品使用";

/** 回库唯一键撞车判定：只认 1062（ER_DUP_ENTRY），不吞其它错误 */
export function isDuplicateEntryError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    ((e as { code?: string }).code === "ER_DUP_ENTRY" ||
      (e as { errno?: number }).errno === 1062)
  );
}

/** 撞的是不是"条码"这一列（同一张表往往还有别的唯一键，不能混为一谈） */
export function isBarcodeDuplicateError(e: unknown): boolean {
  return isDuplicateEntryError(e) && /barcode/i.test(String((e as { message?: string }).message ?? ""));
}

/** `rowErrorMessage` 的入参 */
export interface RowErrorMessageOptions {
  /** 撞其它唯一键时的**领域化**中文文案（必填：每个调用点给本领域的说法） */
  dupMessage: string;
  /** 撞"条码"列时的中文文案，缺省用 `BARCODE_DUPLICATE_MESSAGE` */
  barcodeMessage?: string;
  /** 非撞键且取不到原始信息时的兜底文案，缺省「处理失败」 */
  fallback?: string;
}

/**
 * 逐行/逐条失败文案：撞键 ⇒ 中文业务文案；其它 ⇒ 保留原始信息（不误吞、不掩盖）。
 * 非 Error / 非字符串的抛出错（undefined、普通对象等）取不到原文时回落到 `fallback`。
 */
export function rowErrorMessage(err: unknown, options: RowErrorMessageOptions): string {
  if (isBarcodeDuplicateError(err)) return options.barcodeMessage ?? BARCODE_DUPLICATE_MESSAGE;
  if (isDuplicateEntryError(err)) return options.dupMessage;
  const fallback = options.fallback ?? "处理失败";
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return raw || fallback;
}

/* ============================================================================
 * S3-181：单条写请求（非逐行导入）的「回库错误 → 业务文案」口径
 *
 * 背景：写端点把库报错直接抛到全局 errorHandler 时，`ER_DUP_ENTRY` /
 * `ER_BAD_NULL_ERROR` / `ER_NO_DEFAULT_FOR_FIELD` 都没有 statusCode ⇒ 一律落进
 * "未知错误"分支 ⇒ 500（生产实例：`Column 'mobile' cannot be null`、
 * `Duplicate entry '13900000001' for key 't_member.uk_member_mobile'`）。
 *
 * 口径（与上方 rowErrorMessage 同源，不另立第二套）：
 *  - 撞唯一键 ⇒ 人类可读业务文案，**不回显 SQL 原文**、不回显字段值（手机号属 PII）；
 *  - 缺列（1048/1364）⇒ 报出列名，便于定位缺哪个必填参数；
 *  - 其余码 ⇒ 不在此映射，保持原有 500 + 日志栈（不误吞）。
 * ========================================================================== */

/** 唯一键名 → 本领域中文文案（表内其它唯一键不得张冠李戴；未登记的键走通用兜底） */
export const UNIQUE_KEY_MESSAGES: Record<string, string> = {
  uk_member_mobile: "该手机号已存在",
  uk_member_openid: "该微信账号已绑定其它会员",
  uk_product_sku_barcode: BARCODE_DUPLICATE_MESSAGE,
  uk_product_sku_tenant_barcode: BARCODE_DUPLICATE_MESSAGE,
};

/** 撞了未登记唯一键时的兜底文案（仍不回显 SQL 原文） */
export const DUPLICATE_ENTRY_FALLBACK_MESSAGE = "该记录已存在，请检查是否重复提交";

/** 从驱动文案里取唯一键名（`Duplicate entry 'x' for key 'uk_y'` ⇒ `uk_y`） */
function uniqueKeyName(e: unknown): string {
  const raw = (e as { message?: string })?.message ?? "";
  const matched = /for key '([^']+)'/i.exec(String(raw));
  return matched?.[1] ?? "";
}

/**
 * `ER_DUP_ENTRY`（1062）⇒ 人类可读业务文案。
 * 已登记的键返回领域文案；未登记的键返回通用文案 —— 两者都不含 SQL 原文与字段值。
 */
export function duplicateEntryMessage(e: unknown): string {
  const key = uniqueKeyName(e);
  // 驱动可能把键名写成 `db.table.key` 或 `table.key`，取最后一段再查表
  const leaf = key.includes(".") ? key.slice(key.lastIndexOf(".") + 1) : key;
  return UNIQUE_KEY_MESSAGES[leaf] ?? DUPLICATE_ENTRY_FALLBACK_MESSAGE;
}

/** `ER_NO_DEFAULT_FOR_FIELD`(1364) 的驱动文案：`Field 'x' doesn't have a default value` */
const NO_DEFAULT_FIELD_RE = /Field '([^']+)' doesn't have a default value/i;
/** `ER_BAD_NULL_ERROR`(1048) 的驱动文案：`Column 'x' cannot be null` */
const BAD_NULL_COLUMN_RE = /Column '([^']+)' cannot be null/i;

/**
 * 入参缺列类错误（1048 / 1364）⇒ 缺的列名；非此类返回 `null`。
 * 只认这两个已定性的码，其余 DB 错误仍交给全局 500 分支（保留日志栈）。
 */
export function missingColumnName(e: unknown): string | null {
  const code = (e as { code?: string })?.code;
  const raw = String((e as { message?: string })?.message ?? "");
  if (code === "ER_BAD_NULL_ERROR") return BAD_NULL_COLUMN_RE.exec(raw)?.[1] ?? "";
  if (code === "ER_NO_DEFAULT_FOR_FIELD") return NO_DEFAULT_FIELD_RE.exec(raw)?.[1] ?? "";
  return null;
}
