import { ok, fail } from "../../shared/response";
import { query, queryOne } from "../../shared/db";
import { asyncHandler } from "../../middleware/async-handler";

/**
 * Open API — 商品库控制器
 *
 * 所有接口只返回 APPROVED 状态的数据，不含内部字段。
 */

/** SPU 公开字段白名单 */
const SPU_PUBLIC_FIELDS = [
  "id", "spu_code", "name", "brand_id", "specs", "unit",
  "main_image", "image_urls", "properties", "description", "detail",
  "suggested_retail_price", "status", "source", "created_at", "updated_at",
];

/** SKU 公开字段白名单 */
const SKU_PUBLIC_FIELDS = [
  "id", "spu_id", "sku_code", "barcode", "sku_name",
  "volume", "packaging", "base_unit", "box_unit", "box_ratio",
  "sku_image", "status", "created_at", "updated_at",
];

/** 品牌公开字段白名单 */
const BRAND_PUBLIC_FIELDS = [
  "id", "name", "logo", "description", "origin_country", "sort_no", "status",
];

/**
 * GET /spus/:id — 查询单个 SPU 详情
 * 仅返回已审核通过（APPROVED）的商品
 */
export const getSpuById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isFinite(id)) {
    res.status(400).json(fail("无效的商品ID", "400"));
    return;
  }

  const fields = SPU_PUBLIC_FIELDS.join(", ");
  const spu = await queryOne(
    `SELECT ${fields} FROM t_library_spu WHERE id = ? AND status = 'APPROVED'`,
    [id]
  );
  if (!spu) {
    res.status(404).json(fail("商品不存在", "404"));
    return;
  }

  // 解析 JSON 字段
  if (typeof spu.image_urls === "string") spu.image_urls = JSON.parse(spu.image_urls);
  if (typeof spu.properties === "string") spu.properties = JSON.parse(spu.properties);

  res.json(ok(spu));
});

/**
 * GET /spus/:id/skus — 查询 SPU 下所有 SKU
 * 仅返回已审核通过（APPROVED）的 SKU
 */
export const getSkusBySpuId = asyncHandler(async (req, res) => {
  const spuId = Number(req.params.id);
  if (!spuId || !Number.isFinite(spuId)) {
    res.status(400).json(fail("无效的SPU ID", "400"));
    return;
  }

  // 先确认 SPU 存在且已审核
  const spu = await queryOne(
    "SELECT id FROM t_library_spu WHERE id = ? AND status = 'APPROVED'",
    [spuId]
  );
  if (!spu) {
    res.status(404).json(fail("商品不存在", "404"));
    return;
  }

  const fields = SKU_PUBLIC_FIELDS.join(", ");
  const skus = await query(
    `SELECT ${fields} FROM t_library_sku WHERE spu_id = ? AND status = 'APPROVED' ORDER BY id`,
    [spuId]
  );

  res.json(ok(skus));
});

/**
 * GET /sku/barcode/:barcode — 按条码查询 SKU + SPU 信息
 * 仅返回已审核通过（APPROVED）的数据
 */
export const getSkuByBarcode = asyncHandler(async (req, res) => {
  const barcode = req.params.barcode;
  if (!barcode) {
    res.status(400).json(fail("缺少条码参数", "400"));
    return;
  }

  // 查询 SKU 关联 SPU 信息
  const skuFields = SKU_PUBLIC_FIELDS.join(", ");
  const spuFields = "s.id AS spu_id, s.spu_code, s.name AS spu_name, s.brand_id, s.main_image AS spu_main_image";

  const result = await queryOne(
    `SELECT ${skuFields}, ${spuFields}
     FROM t_library_sku k
     INNER JOIN t_library_spu s ON k.spu_id = s.id AND s.status = 'APPROVED'
     WHERE k.barcode = ? AND k.status = 'APPROVED'`,
    [barcode]
  );

  if (!result) {
    res.status(404).json(fail("未找到对应商品", "404"));
    return;
  }

  res.json(ok(result));
});

/**
 * GET /brands — 品牌列表
 * 仅返回启用状态（status = 1）的品牌，按 sort_no 升序
 */
export const getBrands = asyncHandler(async (req, res) => {
  const fields = BRAND_PUBLIC_FIELDS.join(", ");
  const brands = await query(
    `SELECT ${fields} FROM t_library_brand WHERE status = 1 ORDER BY sort_no ASC, id ASC`
  );

  res.json(ok(brands));
});
