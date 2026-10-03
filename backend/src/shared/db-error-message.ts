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
