import { query, queryOne, transaction, connQuery, connQueryOne, connExecute } from "../../shared/db";
import type { ResultSetHeader, RowDataPacket, PoolConnection } from "mysql2/promise";
import { AppError } from "../../shared/app-error";
import { makeBizNo } from "../../shared/id";
import { getProductQuota } from "../platform/tenant-quota.service";

/**
 * R101-C6-4-1：租户侧「商品库复制式调取（COPY）」服务
 *
 * 依据：docs/tasks/cards/R101-C6-4-0-阿坚-立项草案.md §四.2（T1~T4 契约）
 *       docs/tasks/cards/R101-C6-4-0-凌舟裁定.md Q2/Q3/Q4/Q6/Q7（条码降级/1001/软删仍 SKIPPED/只写成功/方案 B）
 *
 * 统计边界（凌舟钉死，本文件是唯一落库点）：
 *   COPY＝调取 ⇒ 写 t_library_call_log + 扣商品配额 + 建租户私有档案（t_product_spu/t_product_sku/t_product_price）
 *   SCAN 条码查询（POST /api/admin/library/lookup）与 /api/open/library/* 读取＝查询 ⇒ 不写本服务的任何表
 *   页面人工检索 ⇒ 不落库（本服务的 listLibrarySpus 是纯只读）
 *
 * 幂等（Q7 方案 B）：判据 = t_tenant_library_copy 的 uk_tenant_library (tenant_id, library_spu_id)，
 *   同租户二次调取同一平台 SPU ⇒ SKIPPED（回既有 spuId），不新建档案、不写流水、不占配额。
 *   租户软删自己的档案后仍 SKIPPED（Q4 ①）：映射行保留，否则"删除→再调取"会成为绕过配额的循环。
 */

/** 调取结果取值（后端常量，不落库枚举 —— 流水表无 result 列，只记成功） */
export const LIBRARY_COPY_RESULTS = {
  /** 新建租户私有档案 */
  CREATED: "CREATED",
  /** 幂等命中：已调取过，回既有 spuId */
  SKIPPED: "SKIPPED",
  /** 被拒：配额不足或不可调取（不建档案、不写流水、不占配额） */
  REJECTED: "REJECTED",
} as const;

/** 调取类型（落 t_library_call_log.call_type，取值由常量定义） */
export const LIBRARY_CALL_TYPES = {
  /** 单条调取（librarySpuIds 长度为 1） */
  COPY: "COPY",
  /** 批量调取（librarySpuIds 长度 > 1） */
  BATCH_COPY: "BATCH_COPY",
} as const;

/** 调取流水来源字段：档案落库状态（与既有 createProduct 一致，商户确认价格后再上架） */
const COPIED_SPU_STATUS = "DRAFT";

// ─── 行类型 ────────────────────────────────────────────────────

interface LibrarySpuListRow extends RowDataPacket {
  id: number;
  spuCode: string;
  name: string;
  brandId: number | null;
  brandName: string | null;
  specs: string | null;
  unit: string | null;
  mainImage: string | null;
  suggestedRetailPrice: string | number | null;
  status: string;
  createdAt: Date | string;
  copied: number;
  copiedSpuId: number | null;
}

interface LibrarySpuDetailRow extends RowDataPacket {
  id: number;
  spuCode: string;
  name: string;
  brandId: number | null;
  brandName: string | null;
  specs: string | null;
  unit: string | null;
  mainImage: string | null;
  imageUrls: unknown;
  properties: unknown;
  description: string | null;
  detail: string | null;
  suggestedRetailPrice: string | number | null;
  status: string;
  createdAt: Date | string;
}

interface LibrarySkuRow extends RowDataPacket {
  id: number;
  spuId: number;
  skuCode: string;
  barcode: string | null;
  skuName: string;
  volume: string | null;
  packaging: string | null;
  baseUnit: string | null;
  boxUnit: string | null;
  boxRatio: number | null;
  skuImage: string | null;
}

interface CopySourceSpuRow extends RowDataPacket {
  id: number;
  spuCode: string;
  name: string;
  brandId: number | null;
  specs: string | null;
  unit: string | null;
  mainImage: string | null;
  imageUrls: unknown;
  description: string | null;
  detail: string | null;
  suggestedRetailPrice: string | number | null;
}

interface BrandNameRow extends RowDataPacket {
  id: number;
  name: string;
}

interface CopyMappingRow extends RowDataPacket {
  id: number;
  spu_id: number;
}

interface CallLogListRow extends RowDataPacket {
  id: number;
  librarySpuId: number;
  librarySpuCode: string;
  librarySpuName: string;
  spuId: number;
  skuCount: number;
  callType: string;
  operatorName: string | null;
  createdAt: Date | string;
}

interface CountRow extends RowDataPacket {
  total: number | string;
}

// ─── 结果类型 ──────────────────────────────────────────────────

export interface LibrarySpuListItem {
  id: number;
  spuCode: string;
  name: string;
  brandId: number | null;
  brandName: string;
  specs: string;
  unit: string;
  mainImage: string;
  suggestedRetailPrice: string;
  status: string;
  createdAt: Date | string;
  /** 本租户是否已调取过（方案 B：由 t_tenant_library_copy 左连判定，不靠猜） */
  copied: boolean;
  /** 已调取时的租户私有 SPU ID（未调取 ⇒ null） */
  copiedSpuId: number | null;
}

export interface CopyItemResult {
  librarySpuId: number;
  result: (typeof LIBRARY_COPY_RESULTS)[keyof typeof LIBRARY_COPY_RESULTS];
  /** CREATED/SKIPPED 时返回租户私有 SPU ID */
  spuId?: number;
  /** CREATED 时返回本次复制的 SKU 条数 */
  skuCount?: number;
  /** SKIPPED/REJECTED 的原因（必须显式，不得静默） */
  reason?: string;
  /** 降级/冲突的显式说明（如条码撞全库唯一键后降级为不带条码），无降级时为空数组 */
  warnings?: string[];
}

export interface CopyLibrarySpusResult {
  items: CopyItemResult[];
  summary: { created: number; skipped: number; rejected: number };
}

/** 单个 SPU 的事务内结论（warnings 在事务内收集，始终存在） */
interface CopyOutcome {
  result: (typeof LIBRARY_COPY_RESULTS)[keyof typeof LIBRARY_COPY_RESULTS];
  spuId?: number;
  skuCount?: number;
  reason?: string;
  warnings: string[];
}

// ─── 辅助 ──────────────────────────────────────────────────────

/** 轮播图参数归一：库表是 JSON 列，透传前统一成合法 JSON 数组文本 */
function imageUrlsParam(raw: unknown): string {
  if (Array.isArray(raw)) return JSON.stringify(raw);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(Array.isArray(parsed) ? parsed : [parsed]);
    } catch {
      return JSON.stringify(raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean));
    }
  }
  return JSON.stringify([]);
}

/** 条码撞租户内唯一键（S3-151 起为 uk_product_sku_tenant_barcode，此前是全库唯一）判定：只认 1062，不吞其它错误 */
function isDuplicateEntry(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    ((err as { code?: string }).code === "ER_DUP_ENTRY" ||
      (err as { errno?: number }).errno === 1062)
  );
}

/** 取该平台 SPU 下本次要复制的 SKU（未指定 skuSelection ⇒ 全部 APPROVED；指定则取交集，顺序按库内 id） */
async function loadChosenSkus(
  conn: PoolConnection,
  librarySpuId: number,
  requestedSkuIds?: number[]
): Promise<LibrarySkuRow[]> {
  const skus = await connQuery<LibrarySkuRow[]>(
    conn,
    `SELECT id, spu_id AS spuId, sku_code AS skuCode, barcode, sku_name AS skuName,
            volume, packaging, base_unit AS baseUnit, box_unit AS boxUnit, box_ratio AS boxRatio
     FROM t_library_sku
     WHERE spu_id = ? AND status = 'APPROVED'
     ORDER BY id ASC`,
    [librarySpuId]
  );
  if (!requestedSkuIds) return skus;
  return skus.filter((sku) => requestedSkuIds.includes(Number(sku.id)));
}

/**
 * 复制一条 SKU（含价格行）。
 * 条码撞租户内唯一键时按 Q2 裁定②降级：改写 barcode = NULL 并往 warnings 追加显式原因（不得 500、不得静默）。
 */
async function insertCopiedSku(
  conn: PoolConnection,
  params: {
    newSpuId: number;
    sku: LibrarySkuRow;
    retailPrice: string | number | null;
    tenantId: string;
    warnings: string[];
  }
): Promise<void> {
  const { newSpuId, sku, retailPrice, tenantId, warnings } = params;
  const barcode = sku.barcode && String(sku.barcode).trim() ? String(sku.barcode) : null;
  const insertSku = async (barcodeValue: string | null): Promise<number> => {
    const [result] = await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_product_sku (spu_id, sku_code, barcode, sku_name, volume, packaging,
       base_unit, box_unit, box_ratio, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newSpuId,
        makeBizNo("SKU"),
        barcodeValue,
        sku.skuName,
        sku.volume ?? null,
        sku.packaging ?? null,
        sku.baseUnit ?? "瓶",
        sku.boxUnit ?? "箱",
        Number(sku.boxRatio ?? 1),
        tenantId,
      ]
    );
    return Number(result.insertId);
  };

  let skuId: number;
  try {
    skuId = await insertSku(barcode);
  } catch (err) {
    if (!isDuplicateEntry(err)) throw err;
    skuId = await insertSku(null);
    warnings.push(`条码 ${barcode} 已被其他商品占用，SKU「${sku.skuName}」已降级为不带条码（可稍后在商品详情补录）`);
  }

  await connExecute<ResultSetHeader>(
    conn,
    `INSERT INTO t_product_price (sku_id, cost_price, retail_price, tenant_id)
     VALUES (?, 0.00, ?, ?)`,
    [skuId, retailPrice ?? 0, tenantId]
  );
}

// ─── T1：调取前检索（只读，不落库） ─────────────────────────────

export async function listLibrarySpus(params: {
  tenantId: string;
  keyword?: string;
  barcode?: string;
  brandId?: number;
  page: number;
  pageSize: number;
}): Promise<{
  total: number;
  page: number;
  pageSize: number;
  records: LibrarySpuListItem[];
}> {
  const { tenantId, keyword, barcode, brandId, page, pageSize } = params;
  const conditions: string[] = ["s.status = 'APPROVED'"];
  const whereParams: unknown[] = [];

  if (keyword) {
    conditions.push("(s.name LIKE ? OR s.spu_code LIKE ? OR EXISTS (SELECT 1 FROM t_library_sku k WHERE k.spu_id = s.id AND k.barcode LIKE ? AND k.status = 'APPROVED'))");
    const like = `%${keyword}%`;
    whereParams.push(like, like, like);
  }
  if (barcode) {
    conditions.push("EXISTS (SELECT 1 FROM t_library_sku k WHERE k.spu_id = s.id AND k.barcode = ? AND k.status = 'APPROVED')");
    whereParams.push(barcode);
  }
  if (brandId) {
    conditions.push("s.brand_id = ?");
    whereParams.push(brandId);
  }

  const where = conditions.join(" AND ");
  const offset = (page - 1) * pageSize;
  const joinParams: unknown[] = [tenantId];

  const totalRow = await queryOne<CountRow>(
    `SELECT COUNT(*) AS total
     FROM t_library_spu s
     WHERE ${where}`,
    whereParams
  );
  const records = await query<LibrarySpuListRow>(
    `SELECT s.id, s.spu_code AS spuCode, s.name, s.brand_id AS brandId, b.name AS brandName,
            s.specs, s.unit, s.main_image AS mainImage,
            s.suggested_retail_price AS suggestedRetailPrice, s.status, s.created_at AS createdAt,
            CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS copied,
            c.spu_id AS copiedSpuId
     FROM t_library_spu s
     LEFT JOIN t_library_brand b ON b.id = s.brand_id
     LEFT JOIN t_tenant_library_copy c ON c.library_spu_id = s.id AND c.tenant_id = ?
     WHERE ${where}
     ORDER BY s.created_at DESC, s.id DESC
     LIMIT ? OFFSET ?`,
    [...joinParams, ...whereParams, pageSize, offset]
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: records.map((row) => ({
      id: Number(row.id),
      spuCode: row.spuCode,
      name: row.name,
      brandId: row.brandId ?? null,
      brandName: row.brandName ?? "",
      specs: row.specs ?? "",
      unit: row.unit ?? "",
      mainImage: row.mainImage ?? "",
      suggestedRetailPrice: row.suggestedRetailPrice == null ? "0.00" : String(row.suggestedRetailPrice),
      status: row.status,
      createdAt: row.createdAt,
      copied: Number(row.copied) === 1,
      copiedSpuId: row.copiedSpuId == null ? null : Number(row.copiedSpuId),
    })),
  };
}

// ─── T2：调取前预览（含配额余量） ───────────────────────────────

export async function getLibrarySpuPreview(librarySpuId: number, tenantId: string) {
  const spu = await queryOne<LibrarySpuDetailRow>(
    `SELECT s.id, s.spu_code AS spuCode, s.name, s.brand_id AS brandId, b.name AS brandName,
            s.specs, s.unit, s.main_image AS mainImage, s.image_urls AS imageUrls, s.properties,
            s.description, s.detail, s.suggested_retail_price AS suggestedRetailPrice,
            s.status, s.created_at AS createdAt
     FROM t_library_spu s
     LEFT JOIN t_library_brand b ON b.id = s.brand_id
     WHERE s.id = ? AND s.status = 'APPROVED'`,
    [librarySpuId]
  );
  if (!spu) {
    throw new AppError("商品库商品不存在或未上架", 404);
  }

  const skus = await query<LibrarySkuRow>(
    `SELECT id, spu_id AS spuId, sku_code AS skuCode, barcode, sku_name AS skuName,
            volume, packaging, base_unit AS baseUnit, box_unit AS boxUnit,
            box_ratio AS boxRatio, sku_image AS skuImage
     FROM t_library_sku
     WHERE spu_id = ? AND status = 'APPROVED'
     ORDER BY id ASC`,
    [librarySpuId]
  );
  const mapping = await queryOne<CopyMappingRow>(
    `SELECT id, spu_id FROM t_tenant_library_copy WHERE tenant_id = ? AND library_spu_id = ?`,
    [tenantId, librarySpuId]
  );
  const quota = await getProductQuota(tenantId);

  return {
    id: Number(spu.id),
    spuCode: spu.spuCode,
    name: spu.name,
    brandId: spu.brandId ?? null,
    brandName: spu.brandName ?? "",
    specs: spu.specs ?? "",
    unit: spu.unit ?? "",
    mainImage: spu.mainImage ?? "",
    imageUrls: spu.imageUrls ?? [],
    properties: spu.properties ?? null,
    description: spu.description ?? "",
    detail: spu.detail ?? "",
    suggestedRetailPrice: spu.suggestedRetailPrice == null ? "0.00" : String(spu.suggestedRetailPrice),
    status: spu.status,
    createdAt: spu.createdAt,
    skus: skus.map((sku) => ({
      id: Number(sku.id),
      spuId: Number(sku.spuId),
      skuCode: sku.skuCode,
      barcode: sku.barcode ?? "",
      skuName: sku.skuName,
      volume: sku.volume ?? "",
      packaging: sku.packaging ?? "",
      baseUnit: sku.baseUnit ?? "",
      boxUnit: sku.boxUnit ?? "",
      boxRatio: Number(sku.boxRatio ?? 1),
      skuImage: sku.skuImage ?? "",
    })),
    copied: !!mapping,
    copiedSpuId: mapping ? Number(mapping.spu_id) : null,
    quota,
  };
}

// ─── T3：执行调取（COPY，写档案 + 写流水 + 扣配额） ──────────────

export async function copyLibrarySpus(input: {
  tenantId: string;
  operatorId: number | null;
  operatorName: string | null;
  librarySpuIds: number[];
  skuSelection?: Record<string, number[]>;
}): Promise<CopyLibrarySpusResult> {
  const { tenantId, operatorId, operatorName, librarySpuIds, skuSelection } = input;
  const uniqueIds = [...new Set(librarySpuIds.map((id) => Number(id)))];

  // ① 主数据预检：任一 id 不存在/非 APPROVED ⇒ 整体 404（不静默跳过，不写任何行）
  const sources = await query<CopySourceSpuRow>(
    `SELECT id, spu_code AS spuCode, name, brand_id AS brandId, specs, unit,
            main_image AS mainImage, image_urls AS imageUrls, description, detail,
            suggested_retail_price AS suggestedRetailPrice
     FROM t_library_spu
     WHERE id IN (?) AND status = 'APPROVED'`,
    [uniqueIds]
  );
  const sourceMap = new Map(sources.map((row) => [Number(row.id), row]));
  const missing = uniqueIds.filter((id) => !sourceMap.has(id));
  if (missing.length > 0) {
    throw new AppError(`商品库商品不存在或未上架：${missing.join("、")}`, 404);
  }

  // ② 品牌名快照（平台品牌 id 与租户品牌表 t_brand 不是同一域，故只带名称、不带 id）
  const brandIds = [...new Set(sources.map((row) => Number(row.brandId)).filter((id) => Number.isFinite(id) && id > 0))];
  const brandMap = new Map<number, string>();
  if (brandIds.length > 0) {
    const brands = await query<BrandNameRow>(`SELECT id, name FROM t_library_brand WHERE id IN (?)`, [brandIds]);
    for (const brand of brands) brandMap.set(Number(brand.id), brand.name);
  }

  const callType = uniqueIds.length === 1 ? LIBRARY_CALL_TYPES.COPY : LIBRARY_CALL_TYPES.BATCH_COPY;
  const items: CopyItemResult[] = [];

  for (const librarySpuId of uniqueIds) {
    const source = sourceMap.get(librarySpuId)!;
    const outcome = await transaction<CopyOutcome>(async (conn) => {
      // 幂等判据（方案 B 唯一键）：命中即 SKIPPED，不占配额、不写流水、不新建档案
      const existing = await connQueryOne<CopyMappingRow>(
        conn,
        `SELECT id, spu_id FROM t_tenant_library_copy WHERE tenant_id = ? AND library_spu_id = ?`,
        [tenantId, librarySpuId]
      );
      if (existing) {
        return {
          result: LIBRARY_COPY_RESULTS.SKIPPED,
          spuId: Number(existing.spu_id),
          reason: "已调取过",
          warnings: [],
        };
      }

      // 配额校验：与后续写入同一事务内先计数（Q3 裁定 ⇒ 不足时 400 + 业务码 1001）
      const quota = await getProductQuota(tenantId, conn);
      if (quota.limit !== null && quota.used >= quota.limit) {
        return {
          result: LIBRARY_COPY_RESULTS.REJECTED,
          reason: `商品配额不足（已用 ${quota.used} 个 / 上限 ${quota.limit} 个）`,
          warnings: [],
        };
      }

      // 该 SPU 下可调取的 SKU（未指定 skuSelection ⇒ 全部 APPROVED）
      const chosen = await loadChosenSkus(conn, librarySpuId, skuSelection?.[String(librarySpuId)]);
      if (chosen.length === 0) {
        return {
          result: LIBRARY_COPY_RESULTS.REJECTED,
          reason: "该商品没有可调取的SKU（未指定或全部未审核通过）",
          warnings: [],
        };
      }

      // 租户私有 SPU（复用既有商品中心表，改价/上下架/库存/开单/报表零额外开发）
      const brandName = source.brandId == null ? null : brandMap.get(Number(source.brandId)) ?? null;
      const [spuResult] = await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_product_spu (spu_code, name, category_id, brand_id, brand, unit, specs,
         main_image, image_urls, description, detail, status, tenant_id)
         VALUES (?, ?, 0, NULL, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?)`,
        [
          makeBizNo("SPU"),
          source.name,
          brandName,
          source.unit ?? null,
          source.specs ?? null,
          source.mainImage ?? null,
          imageUrlsParam(source.imageUrls),
          source.description ?? null,
          source.detail ?? null,
          COPIED_SPU_STATUS,
          tenantId,
        ]
      );
      const newSpuId = Number(spuResult.insertId);

      const warnings: string[] = [];
      for (const sku of chosen) {
        await insertCopiedSku(conn, {
          newSpuId,
          sku,
          retailPrice: source.suggestedRetailPrice,
          tenantId,
          warnings,
        });
      }

      // 幂等映射（方案 B）+ 成功流水（Q6 ①：只写成功）
      await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_tenant_library_copy (tenant_id, library_spu_id, spu_id) VALUES (?, ?, ?)`,
        [tenantId, librarySpuId, newSpuId]
      );
      await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_library_call_log (tenant_id, library_spu_id, library_spu_code, library_spu_name,
         spu_id, sku_count, call_type, operator_id, operator_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          librarySpuId,
          source.spuCode,
          source.name,
          newSpuId,
          chosen.length,
          callType,
          operatorId,
          operatorName,
        ]
      );

      return {
        result: LIBRARY_COPY_RESULTS.CREATED,
        spuId: newSpuId,
        skuCount: chosen.length,
        warnings,
      };
    });

    const item: CopyItemResult = { librarySpuId, result: outcome.result };
    if (outcome.spuId !== undefined) item.spuId = outcome.spuId;
    if (outcome.skuCount !== undefined) item.skuCount = outcome.skuCount;
    if (outcome.reason !== undefined) item.reason = outcome.reason;
    if (outcome.warnings.length > 0) item.warnings = outcome.warnings;
    items.push(item);
  }

  return {
    items,
    summary: {
      created: items.filter((item) => item.result === LIBRARY_COPY_RESULTS.CREATED).length,
      skipped: items.filter((item) => item.result === LIBRARY_COPY_RESULTS.SKIPPED).length,
      rejected: items.filter((item) => item.result === LIBRARY_COPY_RESULTS.REJECTED).length,
    },
  };
}

// ─── T4：我的调取记录（可见范围 = 当前令牌租户） ────────────────

export async function listMyCallLogs(params: {
  tenantId: string;
  page: number;
  pageSize: number;
}): Promise<{
  total: number;
  page: number;
  pageSize: number;
  records: Array<{
    id: number;
    librarySpuId: number;
    librarySpuCode: string;
    librarySpuName: string;
    spuId: number;
    skuCount: number;
    callType: string;
    operatorName: string | null;
    createdAt: Date | string;
  }>;
}> {
  const { tenantId, page, pageSize } = params;
  const offset = (page - 1) * pageSize;
  const totalRow = await queryOne<CountRow>(
    `SELECT COUNT(*) AS total FROM t_library_call_log WHERE tenant_id = ?`,
    [tenantId]
  );
  const records = await query<CallLogListRow>(
    `SELECT id, library_spu_id AS librarySpuId, library_spu_code AS librarySpuCode,
            library_spu_name AS librarySpuName, spu_id AS spuId, sku_count AS skuCount,
            call_type AS callType, operator_name AS operatorName, created_at AS createdAt
     FROM t_library_call_log
     WHERE tenant_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, offset]
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: records.map((row) => ({
      id: Number(row.id),
      librarySpuId: Number(row.librarySpuId),
      librarySpuCode: row.librarySpuCode,
      librarySpuName: row.librarySpuName,
      spuId: Number(row.spuId),
      skuCount: Number(row.skuCount),
      callType: row.callType,
      operatorName: row.operatorName ?? null,
      createdAt: row.createdAt,
    })),
  };
}
