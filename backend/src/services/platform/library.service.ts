/**
 * 平台商品库管理服务
 *
 * 功能：SPU/SKU管理、品牌管理、API Key管理
 * 注意：商品库为平台级数据（不带 tenant_id），使用 query() / queryOne() 而非 queryWithTenant
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { query, queryOne, transaction, connExecute } from "../../shared/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

// ─── 类型定义 ─────────────────────────────────────────────────

/** SPU 列表查询参数 */
export interface SpuListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  brandId?: number;
}

/** SPU 创建数据 */
export interface SpuCreateData {
  name: string;
  brandId?: number;
  specs?: string;
  unit?: string;
  mainImage?: string;
  imageUrls?: string;
  properties?: string;
  description?: string;
  detail?: string;
  suggestedRetailPrice?: number;
  source?: string;
  skus?: SkuCreateData[];
}

/** SPU 更新数据 */
export interface SpuUpdateData {
  name?: string;
  brandId?: number;
  specs?: string;
  unit?: string;
  mainImage?: string;
  imageUrls?: string;
  properties?: string;
  description?: string;
  detail?: string;
  suggestedRetailPrice?: number;
}

/** SKU 创建数据 */
export interface SkuCreateData {
  skuName?: string;
  barcode?: string;
  volume?: string;
  packaging?: string;
  baseUnit?: string;
  boxUnit?: string;
  boxRatio?: number;
  skuImage?: string;
}

/** SKU 更新数据 */
export interface SkuUpdateData {
  skuName?: string;
  barcode?: string;
  volume?: string;
  packaging?: string;
  baseUnit?: string;
  boxUnit?: string;
  boxRatio?: number;
  skuImage?: string;
  status?: string;
}

/** 品牌查询参数 */
export interface BrandListParams {
  page: number;
  pageSize: number;
  keyword?: string;
}

/** 品牌创建数据 */
export interface BrandCreateData {
  name: string;
  logo?: string;
  description?: string;
  originCountry?: string;
  sortNo?: number;
}

/** 品牌更新数据 */
export interface BrandUpdateData {
  name?: string;
  logo?: string;
  description?: string;
  originCountry?: string;
  sortNo?: number;
  status?: number;
}

/** API Key 创建数据 */
export interface ApiKeyCreateData {
  appName: string;
  allowedIps?: string;
  dailyLimit?: number;
  remark?: string;
}

/** API Key 更新数据 */
export interface ApiKeyUpdateData {
  dailyLimit?: number;
  allowedIps?: string;
  status?: number;
  remark?: string;
}

/** SPU 列表行 */
interface SpuListRow {
  id: number;
  spuCode: string;
  name: string;
  brandId: number | null;
  brandName: string | null;
  specs: string | null;
  unit: string | null;
  mainImage: string | null;
  imageUrls: string | null;
  properties: string | null;
  description: string | null;
  suggestedRetailPrice: number | null;
  status: string;
  source: string;
  submitCount: number;
  hitCount: number;
  reviewedBy: number | null;
  reviewedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** SPU 详情行 */
interface SpuDetailRow {
  id: number;
  spuCode: string;
  name: string;
  brandId: number | null;
  brandName: string | null;
  specs: string | null;
  unit: string | null;
  mainImage: string | null;
  imageUrls: string | null;
  properties: string | null;
  description: string | null;
  detail: string | null;
  suggestedRetailPrice: number | null;
  status: string;
  source: string;
  submitCount: number;
  hitCount: number;
  reviewedBy: number | null;
  reviewedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** SKU 行 */
interface SkuRow {
  id: number;
  spuId: number;
  skuCode: string;
  barcode: string | null;
  skuName: string | null;
  volume: string | null;
  packaging: string | null;
  baseUnit: string | null;
  boxUnit: string | null;
  boxRatio: number | null;
  skuImage: string | null;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** 品牌行 */
interface BrandRow {
  id: number;
  name: string;
  logo: string | null;
  description: string | null;
  originCountry: string | null;
  sortNo: number;
  status: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** API Key 列表行（不含 secret） */
interface ApiKeyListRow {
  id: number;
  appName: string;
  apiKey: string;
  allowedIps: string | null;
  dailyLimit: number;
  todayCount: number;
  lastCalledAt: Date | string | null;
  status: number;
  remark: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** API Key 统计行 */
interface ApiKeyStatsRow {
  id: number;
  appName: string;
  apiKey: string;
  dailyLimit: number;
  todayCount: number;
  lastCalledAt: Date | string | null;
  status: number;
  createdAt: Date | string;
}

/** 统计行 */
interface CountRow {
  total: number;
}

/** ID 存在性检查行 */
interface IdRow {
  id: number;
}

/** 状态行 */
interface StatusRow {
  id: number;
  status: string;
}

/** INSERT 返回结果行（mysql2 ResultSetHeader 包装） */
interface InsertResult {
  insertId: number;
  affectedRows: number;
}

// ─── 辅助函数 ─────────────────────────────────────────────────

/**
 * 生成 SPU 编码
 * 格式：SPU + YYYYMMDD + 3位随机数字
 */
function generateSpuCode(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const random = String(Math.floor(Math.random() * 900) + 100);
  return `SPU${dateStr}${random}`;
}

/**
 * 生成 API Key
 * 格式：zk_live_ + 32位随机十六进制字符串
 */
function generateApiKey(): string {
  return `zk_live_${crypto.randomBytes(16).toString("hex")}`;
}

/**
 * 生成 SKU 编码
 * 格式：SKU + 时间戳 + 3位随机数字
 */
function generateSkuCode(): string {
  return `SKU${Date.now()}${String(Math.floor(Math.random() * 900) + 100)}`;
}

// ─── SPU 管理 ──────────────────────────────────────────────────

/** SPU 分页列表 */
async function getSpus(params: SpuListParams) {
  const { page, pageSize, keyword, status, brandId } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["1=1"];
  const sqlParams: unknown[] = [];

  if (keyword) {
    conditions.push("(s.name LIKE ? OR s.spu_code LIKE ?)");
    const like = `%${keyword}%`;
    sqlParams.push(like, like);
  }
  if (status) {
    conditions.push("s.status = ?");
    sqlParams.push(status);
  }
  if (brandId) {
    conditions.push("s.brand_id = ?");
    sqlParams.push(brandId);
  }

  const where = conditions.join(" AND ");

  const [totalRow, records] = await Promise.all([
    queryOne<CountRow>(
      `SELECT COUNT(*) AS total FROM t_library_spu s WHERE ${where}`,
      sqlParams
    ),
    query<SpuListRow>(
      `SELECT s.id, s.spu_code AS spuCode, s.name, s.brand_id AS brandId,
              b.name AS brandName, s.specs, s.unit, s.main_image AS mainImage,
              s.image_urls AS imageUrls, s.properties, s.description,
              s.suggested_retail_price AS suggestedRetailPrice,
              s.status, s.source, s.submit_count AS submitCount,
              s.hit_count AS hitCount, s.reviewed_by AS reviewedBy,
              s.reviewed_at AS reviewedAt, s.created_at AS createdAt, s.updated_at AS updatedAt
       FROM t_library_spu s
       LEFT JOIN t_library_brand b ON b.id = s.brand_id
       WHERE ${where}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...sqlParams, pageSize, offset]
    ),
  ]);

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records,
  };
}

/** SPU 详情（含 SKU 列表） */
async function getSpuById(id: number) {
  const spu = await queryOne<SpuDetailRow>(
    `SELECT s.id, s.spu_code AS spuCode, s.name, s.brand_id AS brandId,
            b.name AS brandName, s.specs, s.unit, s.main_image AS mainImage,
            s.image_urls AS imageUrls, s.properties, s.description, s.detail,
            s.suggested_retail_price AS suggestedRetailPrice,
            s.status, s.source, s.submit_count AS submitCount,
            s.hit_count AS hitCount, s.reviewed_by AS reviewedBy,
            s.reviewed_at AS reviewedAt, s.created_at AS createdAt, s.updated_at AS updatedAt
     FROM t_library_spu s
     LEFT JOIN t_library_brand b ON b.id = s.brand_id
     WHERE s.id = ?`,
    [id]
  );

  if (!spu) return null;

  // 查询关联 SKU 列表
  const skus = await query<SkuRow>(
    `SELECT id, spu_id AS spuId, sku_code AS skuCode, barcode, sku_name AS skuName,
            volume, packaging, base_unit AS baseUnit, box_unit AS boxUnit,
            box_ratio AS boxRatio, sku_image AS skuImage,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM t_library_sku
     WHERE spu_id = ?
     ORDER BY created_at ASC`,
    [id]
  );

  return { ...spu, skus };
}

/** 创建 SPU（同时创建关联 SKU） */
async function createSpu(data: SpuCreateData) {
  const result = await transaction(async (conn) => {
    // 生成 spu_code，检查唯一性
    let spuCode = generateSpuCode();
    const [existing] = await conn.query<(IdRow & RowDataPacket)[]>(
      "SELECT id FROM t_library_spu WHERE spu_code = ?",
      [spuCode]
    );
    // 极小概率碰撞，再生成一次
    if (existing.length > 0) {
      spuCode = generateSpuCode();
    }

    // 如果有品牌 ID，检查品牌是否存在
    if (data.brandId) {
      const [brand] = await conn.query<(IdRow & RowDataPacket)[]>(
        "SELECT id FROM t_library_brand WHERE id = ?",
        [data.brandId]
      );
      if (brand.length === 0) {
        throw Object.assign(new Error("品牌不存在"), { statusCode: 400 });
      }
    }

    // 插入 SPU
    const [insertResult] = await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_library_spu
       (spu_code, name, brand_id, specs, unit, main_image, image_urls,
        properties, description, detail, suggested_retail_price, status, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        spuCode,
        data.name,
        data.brandId ?? null,
        data.specs ?? null,
        data.unit ?? null,
        data.mainImage ?? null,
        data.imageUrls ?? null,
        data.properties ?? null,
        data.description ?? null,
        data.detail ?? null,
        data.suggestedRetailPrice ?? null,
        data.source ?? "OFFICIAL",
      ]
    );

    const spuId = insertResult.insertId;

    // 批量插入 SKU
    if (data.skus && data.skus.length > 0) {
      for (const sku of data.skus) {
        const skuCode = generateSkuCode();
        await connExecute<ResultSetHeader>(
          conn,
          `INSERT INTO t_library_sku
           (spu_id, sku_code, barcode, sku_name, volume, packaging,
            base_unit, box_unit, box_ratio, sku_image, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
          [
            spuId,
            skuCode,
            sku.barcode ?? null,
            sku.skuName ?? null,
            sku.volume ?? null,
            sku.packaging ?? null,
            sku.baseUnit ?? null,
            sku.boxUnit ?? null,
            sku.boxRatio ?? null,
            sku.skuImage ?? null,
          ]
        );
      }
    }

    return { id: spuId, spuCode };
  });

  return result;
}

/** 更新 SPU */
async function updateSpu(id: number, data: SpuUpdateData) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_library_spu WHERE id = ?",
    [id]
  );
  if (!existing) {
    throw Object.assign(new Error("SPU不存在"), { statusCode: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    values.push(data.name);
  }
  if (data.brandId !== undefined) {
    fields.push("brand_id = ?");
    values.push(data.brandId);
  }
  if (data.specs !== undefined) {
    fields.push("specs = ?");
    values.push(data.specs);
  }
  if (data.unit !== undefined) {
    fields.push("unit = ?");
    values.push(data.unit);
  }
  if (data.mainImage !== undefined) {
    fields.push("main_image = ?");
    values.push(data.mainImage);
  }
  if (data.imageUrls !== undefined) {
    fields.push("image_urls = ?");
    values.push(data.imageUrls);
  }
  if (data.properties !== undefined) {
    fields.push("properties = ?");
    values.push(data.properties);
  }
  if (data.description !== undefined) {
    fields.push("description = ?");
    values.push(data.description);
  }
  if (data.detail !== undefined) {
    fields.push("detail = ?");
    values.push(data.detail);
  }
  if (data.suggestedRetailPrice !== undefined) {
    fields.push("suggested_retail_price = ?");
    values.push(data.suggestedRetailPrice);
  }

  if (fields.length === 0) {
    return { id, updated: true };
  }

  values.push(id);
  await query(
    `UPDATE t_library_spu SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return { id, updated: true };
}

/** 审核 SPU（PENDING → APPROVED / REJECTED） */
async function reviewSpu(id: number, status: string, reviewedBy: number) {
  if (!["APPROVED", "REJECTED"].includes(status)) {
    throw Object.assign(new Error("无效的审核状态，仅允许 APPROVED 或 REJECTED"), { statusCode: 400 });
  }

  const spu = await queryOne<StatusRow>(
    "SELECT id, status FROM t_library_spu WHERE id = ?",
    [id]
  );
  if (!spu) {
    throw Object.assign(new Error("SPU不存在"), { statusCode: 404 });
  }
  if (spu.status !== "PENDING") {
    throw Object.assign(new Error("仅待审核状态的SPU可以审核"), { statusCode: 400 });
  }

  await query(
    `UPDATE t_library_spu SET status = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [status, reviewedBy, id]
  );

  return { id, status, reviewedBy };
}

/** 删除 SPU（仅 OFFLINE 状态可删） */
async function deleteSpu(id: number) {
  const spu = await queryOne<StatusRow>(
    "SELECT id, status FROM t_library_spu WHERE id = ?",
    [id]
  );
  if (!spu) {
    throw Object.assign(new Error("SPU不存在"), { statusCode: 404 });
  }
  if (spu.status !== "OFFLINE") {
    throw Object.assign(new Error("仅下线状态的SPU可以删除"), { statusCode: 400 });
  }

  // 事务中同时删除关联 SKU
  await transaction(async (conn) => {
    await connExecute<ResultSetHeader>(conn, "DELETE FROM t_library_sku WHERE spu_id = ?", [id]);
    await connExecute<ResultSetHeader>(conn, "DELETE FROM t_library_spu WHERE id = ?", [id]);
  });

  return { id, deleted: true };
}

/** 批量导入 SPU */
async function importSpus(list: SpuCreateData[]) {
  let successCount = 0;
  let failCount = 0;
  const errors: { index: number; name: string; reason: string }[] = [];

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item.name) {
      failCount++;
      errors.push({ index: i, name: item.name || "未知", reason: "缺少商品名称" });
      continue;
    }
    try {
      await createSpu(item);
      successCount++;
    } catch (err: unknown) {
      failCount++;
      const reason = err instanceof Error ? err.message : String(err);
      errors.push({ index: i, name: item.name, reason });
    }
  }

  return { total: list.length, successCount, failCount, errors };
}

// ─── SKU 管理 ──────────────────────────────────────────────────

/** 获取 SPU 下的 SKU 列表 */
async function getSkusBySpuId(spuId: number) {
  const skus = await query<SkuRow>(
    `SELECT id, spu_id AS spuId, sku_code AS skuCode, barcode, sku_name AS skuName,
            volume, packaging, base_unit AS baseUnit, box_unit AS boxUnit,
            box_ratio AS boxRatio, sku_image AS skuImage,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM t_library_sku
     WHERE spu_id = ?
     ORDER BY created_at ASC`,
    [spuId]
  );
  return skus;
}

/** 为 SPU 添加 SKU */
async function addSku(spuId: number, data: SkuCreateData) {
  // 检查 SPU 是否存在
  const spu = await queryOne<IdRow>(
    "SELECT id FROM t_library_spu WHERE id = ?",
    [spuId]
  );
  if (!spu) {
    throw Object.assign(new Error("SPU不存在"), { statusCode: 404 });
  }

  // 如果有 barcode，检查唯一性
  if (data.barcode) {
    const existing = await queryOne<IdRow>(
      "SELECT id FROM t_library_sku WHERE barcode = ?",
      [data.barcode]
    );
    if (existing) {
      throw Object.assign(new Error("条码已存在"), { statusCode: 400 });
    }
  }

  // 生成 SKU 编码
  const skuCode = generateSkuCode();

  const result = await query<InsertResult>(
    `INSERT INTO t_library_sku
     (spu_id, sku_code, barcode, sku_name, volume, packaging,
      base_unit, box_unit, box_ratio, sku_image, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      spuId,
      skuCode,
      data.barcode ?? null,
      data.skuName ?? null,
      data.volume ?? null,
      data.packaging ?? null,
      data.baseUnit ?? null,
      data.boxUnit ?? null,
      data.boxRatio ?? null,
      data.skuImage ?? null,
    ]
  );

  const insertResult = result as unknown as InsertResult;
  return { id: insertResult.insertId, skuCode };
}

/** 更新 SKU */
async function updateSku(id: number, data: SkuUpdateData) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_library_sku WHERE id = ?",
    [id]
  );
  if (!existing) {
    throw Object.assign(new Error("SKU不存在"), { statusCode: 404 });
  }

  // 如果更新 barcode，检查唯一性
  if (data.barcode) {
    const dup = await queryOne<IdRow>(
      "SELECT id FROM t_library_sku WHERE barcode = ? AND id != ?",
      [data.barcode, id]
    );
    if (dup) {
      throw Object.assign(new Error("条码已存在"), { statusCode: 400 });
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.skuName !== undefined) {
    fields.push("sku_name = ?");
    values.push(data.skuName);
  }
  if (data.barcode !== undefined) {
    fields.push("barcode = ?");
    values.push(data.barcode);
  }
  if (data.volume !== undefined) {
    fields.push("volume = ?");
    values.push(data.volume);
  }
  if (data.packaging !== undefined) {
    fields.push("packaging = ?");
    values.push(data.packaging);
  }
  if (data.baseUnit !== undefined) {
    fields.push("base_unit = ?");
    values.push(data.baseUnit);
  }
  if (data.boxUnit !== undefined) {
    fields.push("box_unit = ?");
    values.push(data.boxUnit);
  }
  if (data.boxRatio !== undefined) {
    fields.push("box_ratio = ?");
    values.push(data.boxRatio);
  }
  if (data.skuImage !== undefined) {
    fields.push("sku_image = ?");
    values.push(data.skuImage);
  }
  if (data.status !== undefined) {
    fields.push("status = ?");
    values.push(data.status);
  }

  if (fields.length === 0) {
    return { id, updated: true };
  }

  values.push(id);
  await query(
    `UPDATE t_library_sku SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return { id, updated: true };
}

/** 删除 SKU */
async function deleteSku(id: number) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_library_sku WHERE id = ?",
    [id]
  );
  if (!existing) {
    throw Object.assign(new Error("SKU不存在"), { statusCode: 404 });
  }

  await query("DELETE FROM t_library_sku WHERE id = ?", [id]);
  return { id, deleted: true };
}

// ─── 品牌管理 ──────────────────────────────────────────────────

/** 品牌分页列表 */
async function getBrands(params: BrandListParams) {
  const { page, pageSize, keyword } = params;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["1=1"];
  const sqlParams: unknown[] = [];

  if (keyword) {
    conditions.push("(name LIKE ? OR origin_country LIKE ?)");
    const like = `%${keyword}%`;
    sqlParams.push(like, like);
  }

  const where = conditions.join(" AND ");

  const [totalRow, records] = await Promise.all([
    queryOne<CountRow>(
      `SELECT COUNT(*) AS total FROM t_library_brand WHERE ${where}`,
      sqlParams
    ),
    query<BrandRow>(
      `SELECT id, name, logo, description, origin_country AS originCountry,
              sort_no AS sortNo, status, created_at AS createdAt, updated_at AS updatedAt
       FROM t_library_brand
       WHERE ${where}
       ORDER BY sort_no ASC, created_at DESC
       LIMIT ? OFFSET ?`,
      [...sqlParams, pageSize, offset]
    ),
  ]);

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records,
  };
}

/** 创建品牌 */
async function createBrand(data: BrandCreateData) {
  // 检查品牌名唯一性
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_library_brand WHERE name = ?",
    [data.name]
  );
  if (existing) {
    throw Object.assign(new Error("品牌名称已存在"), { statusCode: 400 });
  }

  const result = await query<InsertResult>(
    `INSERT INTO t_library_brand (name, logo, description, origin_country, sort_no, status)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [
      data.name,
      data.logo ?? null,
      data.description ?? null,
      data.originCountry ?? null,
      data.sortNo ?? 0,
    ]
  );

  const insertResult = result as unknown as InsertResult;
  return { id: insertResult.insertId };
}

/** 更新品牌 */
async function updateBrand(id: number, data: BrandUpdateData) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_library_brand WHERE id = ?",
    [id]
  );
  if (!existing) {
    throw Object.assign(new Error("品牌不存在"), { statusCode: 404 });
  }

  // 如果更新名称，检查唯一性
  if (data.name) {
    const dup = await queryOne<IdRow>(
      "SELECT id FROM t_library_brand WHERE name = ? AND id != ?",
      [data.name, id]
    );
    if (dup) {
      throw Object.assign(new Error("品牌名称已存在"), { statusCode: 400 });
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    values.push(data.name);
  }
  if (data.logo !== undefined) {
    fields.push("logo = ?");
    values.push(data.logo);
  }
  if (data.description !== undefined) {
    fields.push("description = ?");
    values.push(data.description);
  }
  if (data.originCountry !== undefined) {
    fields.push("origin_country = ?");
    values.push(data.originCountry);
  }
  if (data.sortNo !== undefined) {
    fields.push("sort_no = ?");
    values.push(data.sortNo);
  }
  if (data.status !== undefined) {
    fields.push("status = ?");
    values.push(data.status);
  }

  if (fields.length === 0) {
    return { id, updated: true };
  }

  values.push(id);
  await query(
    `UPDATE t_library_brand SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return { id, updated: true };
}

/** 删除品牌（检查 SPU 引用） */
async function deleteBrand(id: number) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_library_brand WHERE id = ?",
    [id]
  );
  if (!existing) {
    throw Object.assign(new Error("品牌不存在"), { statusCode: 404 });
  }

  // 检查是否有 SPU 引用此品牌
  const refCount = await queryOne<CountRow>(
    "SELECT COUNT(*) AS total FROM t_library_spu WHERE brand_id = ?",
    [id]
  );
  if (refCount && refCount.total > 0) {
    throw Object.assign(new Error(`该品牌下有 ${refCount.total} 个商品SPU，无法删除`), { statusCode: 400 });
  }

  await query("DELETE FROM t_library_brand WHERE id = ?", [id]);
  return { id, deleted: true };
}

// ─── API Key 管理 ──────────────────────────────────────────────

/** API Key 列表（不返回 api_secret） */
async function getApiKeys() {
  const rows = await query<ApiKeyListRow>(
    `SELECT id, app_name AS appName, api_key AS apiKey,
            allowed_ips AS allowedIps, daily_limit AS dailyLimit,
            today_count AS todayCount, last_called_at AS lastCalledAt,
            status, remark, created_at AS createdAt, updated_at AS updatedAt
     FROM t_library_api_key
     ORDER BY created_at DESC`
  );
  return rows;
}

/** 创建 API Key */
async function createApiKey(data: ApiKeyCreateData) {
  // 生成 API Key 和 Secret
  const apiKey = generateApiKey();
  const apiSecretRaw = crypto.randomBytes(24).toString("hex");
  const apiSecretHash = await bcrypt.hash(apiSecretRaw, 10);

  const result = await query<InsertResult>(
    `INSERT INTO t_library_api_key
     (app_name, api_key, api_secret, allowed_ips, daily_limit, today_count, status, remark)
     VALUES (?, ?, ?, ?, ?, 0, 1, ?)`,
    [
      data.appName,
      apiKey,
      apiSecretHash,
      data.allowedIps ?? null,
      data.dailyLimit ?? 1000,
      data.remark ?? null,
    ]
  );

  const insertResult = result as unknown as InsertResult;
  // 明文 secret 仅此一次返回，后续不可查
  return {
    id: insertResult.insertId,
    apiKey,
    apiSecret: apiSecretRaw,
  };
}

/** 更新 API Key（限额/IP/状态） */
async function updateApiKey(id: number, data: ApiKeyUpdateData) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_library_api_key WHERE id = ?",
    [id]
  );
  if (!existing) {
    throw Object.assign(new Error("API Key不存在"), { statusCode: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.dailyLimit !== undefined) {
    fields.push("daily_limit = ?");
    values.push(data.dailyLimit);
  }
  if (data.allowedIps !== undefined) {
    fields.push("allowed_ips = ?");
    values.push(data.allowedIps);
  }
  if (data.status !== undefined) {
    fields.push("status = ?");
    values.push(data.status);
  }
  if (data.remark !== undefined) {
    fields.push("remark = ?");
    values.push(data.remark);
  }

  if (fields.length === 0) {
    return { id, updated: true };
  }

  values.push(id);
  await query(
    `UPDATE t_library_api_key SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return { id, updated: true };
}

/** 吊销 API Key */
async function deleteApiKey(id: number) {
  const existing = await queryOne<IdRow>(
    "SELECT id FROM t_library_api_key WHERE id = ?",
    [id]
  );
  if (!existing) {
    throw Object.assign(new Error("API Key不存在"), { statusCode: 404 });
  }

  await query("DELETE FROM t_library_api_key WHERE id = ?", [id]);
  return { id, deleted: true };
}

/** API Key 调用统计 */
async function getApiKeyStats(id: number) {
  const keyRow = await queryOne<ApiKeyStatsRow>(
    `SELECT id, app_name AS appName, api_key AS apiKey,
            daily_limit AS dailyLimit, today_count AS todayCount,
            last_called_at AS lastCalledAt, status,
            created_at AS createdAt
     FROM t_library_api_key WHERE id = ?`,
    [id]
  );
  if (!keyRow) {
    throw Object.assign(new Error("API Key不存在"), { statusCode: 404 });
  }

  return keyRow;
}

// ─── 导出服务类 ─────────────────────────────────────────────

class LibraryService {
  // SPU 管理
  getSpus = getSpus;
  getSpuById = getSpuById;
  createSpu = createSpu;
  updateSpu = updateSpu;
  reviewSpu = reviewSpu;
  deleteSpu = deleteSpu;
  importSpus = importSpus;

  // SKU 管理
  getSkusBySpuId = getSkusBySpuId;
  addSku = addSku;
  updateSku = updateSku;
  deleteSku = deleteSku;

  // 品牌管理
  getBrands = getBrands;
  createBrand = createBrand;
  updateBrand = updateBrand;
  deleteBrand = deleteBrand;

  // API Key 管理
  getApiKeys = getApiKeys;
  createApiKey = createApiKey;
  updateApiKey = updateApiKey;
  deleteApiKey = deleteApiKey;
  getApiKeyStats = getApiKeyStats;
}

export const libraryService = new LibraryService();
