import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

/** t_product_category 查询行（门店端分类列表） */
interface ProductCategoryRow {
  id: number; name: string; parentId: number | null; sortNo: number;
}

/** t_product_spu 详情查询行（含分类名） */
interface ProductSpuRow {
  id: number; spuCode: string; name: string; categoryId: number | null;
  categoryName: string | null; brand: string | null; unit: string | null;
  specs: string | null; alcoholContent: string | null; origin: string | null;
  mainImage: string | null; imageUrls: string | null; detail: string | null;
  saleChannels: string | null; sortNo: number; isNew: number; isRecommend: number;
  marketingTags: string | null; description: string | null; status: string;
  createdAt: string | Date; updatedAt: string | Date;
}

/** t_product_sku 详情查询行（含价格与可用库存） */
interface ProductSkuRow {
  id: number; skuCode: string; skuName: string; barcode: string | null;
  volume: string | null; packaging: string | null; baseUnit: string | null;
  boxUnit: string | null; boxRatio: number | string | null;
  temperature: string | null; traceEnabled: number; warningThreshold: number;
  costPrice: number | string | null; retailPrice: number | string | null;
  wholesalePrice: number | string | null; miniappPrice: number | string | null;
  storePrice: number | string | null; availableQty: number | string;
}

/** 商品列表查询行（sku + spu + 价格 + 库存） */
interface ProductListItemRow {
  skuId: number; skuCode: string; productName: string; spuId: number;
  skuName: string; barcode: string | null;
  retailPrice: number | string | null; wholesalePrice: number | string | null;
  storePrice: number | string | null; availableQty: number | string | null;
}

/** t_member 查询行（门店端会员列表） */
interface MemberRow {
  memberId: number; name: string; mobile: string | null;
  customerType: string | null; status: number;
}

export async function getCategories(tenantId: string) {
  const records = await queryWithTenant<ProductCategoryRow>(
    `SELECT id, name, parent_id AS parentId, sort_no AS sortNo
     FROM t_product_category
     WHERE tenant_id = ? AND status = 1
     ORDER BY sort_no ASC, id ASC`,
    [tenantId],
    tenantId
  );
  return { records };
}

export async function getProductDetail(spuId: number, tenantId: string) {
  const spu = await queryOneWithTenant<ProductSpuRow>(
    `SELECT p.id, p.spu_code AS spuCode, p.name, p.category_id AS categoryId,
            pc.name AS categoryName, p.brand, p.unit, p.specs,
            p.alcohol_content AS alcoholContent, p.origin,
            p.main_image AS mainImage, p.image_urls AS imageUrls, p.detail,
            p.sale_channels AS saleChannels, p.sort_no AS sortNo,
            p.is_new AS isNew, p.is_recommend AS isRecommend,
            p.marketing_tags AS marketingTags,
            p.description, p.status, p.created_at AS createdAt, p.updated_at AS updatedAt
     FROM t_product_spu p
     LEFT JOIN t_product_category pc ON pc.id = p.category_id
     WHERE p.id = ? AND p.tenant_id = ? AND p.status = 'ON_SALE'`,
    [spuId, tenantId], tenantId
  );
  if (!spu) throw Object.assign(new Error("商品不存在"), { statusCode: 404 });

  const skus = await queryWithTenant<ProductSkuRow>(
    `SELECT s.id, s.sku_code AS skuCode, s.sku_name AS skuName, s.barcode,
            s.volume, s.packaging, s.base_unit AS baseUnit, s.box_unit AS boxUnit,
            s.box_ratio AS boxRatio, s.temperature, s.trace_enabled AS traceEnabled,
            s.warning_threshold AS warningThreshold,
            pp.cost_price AS costPrice, pp.retail_price AS retailPrice,
            pp.wholesale_price AS wholesalePrice, pp.miniapp_price AS miniappPrice,
            pp.store_price AS storePrice,
            COALESCE(ib.available_qty, 0) AS availableQty
     FROM t_product_sku s
     LEFT JOIN t_product_price pp ON pp.sku_id = s.id
     LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.stock_type = 'OFFLINE'
     WHERE s.spu_id = ? AND s.tenant_id = ?
     ORDER BY s.id ASC`,
    [spuId, tenantId], tenantId
  );

  return { ...spu, skus };
}

export async function listProducts(params: {
  keyword?: string;
  barcode?: string;
  categoryId?: number;
  tagIds?: number[];
  storeId: number;
  tenantId: string;
}) {
  const { keyword = "", barcode = "", categoryId, tagIds, storeId, tenantId } = params;
  let sql = `SELECT s.id AS skuId, s.sku_code AS skuCode, p.name AS productName, p.id AS spuId,
            s.sku_name AS skuName, s.barcode, pp.retail_price AS retailPrice,
            pp.wholesale_price AS wholesalePrice, pp.store_price AS storePrice,
            ib.available_qty AS availableQty
     FROM t_product_sku s
     JOIN t_product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
     JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
     LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.store_id = ? AND ib.stock_type = 'OFFLINE' AND ib.tenant_id = s.tenant_id
     WHERE s.tenant_id = ?
       AND p.status = 'ON_SALE'
       AND (? = '' OR p.name LIKE ? OR s.sku_name LIKE ? OR s.sku_code LIKE ?)
       AND (? = '' OR s.barcode = ?)`;
  const paramsArr: unknown[] = [storeId, tenantId, keyword, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, barcode, barcode];

  if (categoryId) {
    sql += ` AND p.category_id = ?`;
    paramsArr.push(categoryId);
  }

  if (tagIds && tagIds.length > 0) {
    sql += ` AND p.id IN (SELECT DISTINCT ptr.spu_id FROM t_product_tag_relation ptr WHERE ptr.tag_id IN (${tagIds.map(() => '?').join(',')}))`;
    paramsArr.push(...tagIds);
  }

  sql += ` ORDER BY s.id DESC LIMIT 50`;

  const records = await queryWithTenant<ProductListItemRow>(sql, paramsArr, tenantId);
  return { records };
}

export async function listMembers(params: {
  keyword?: string;
  tenantId: string;
}) {
  const { keyword = "", tenantId } = params;
  const records = await queryWithTenant<MemberRow>(
    `SELECT id AS memberId, name, mobile, customer_type AS customerType, status
     FROM t_member
     WHERE tenant_id = ?
       AND status = 1
       AND (? = '' OR name LIKE ? OR mobile LIKE ?)
     ORDER BY id DESC
     LIMIT 50`,
    [tenantId, keyword, `%${keyword}%`, `%${keyword}%`],
    tenantId
  );
  return { records };
}