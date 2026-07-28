import { query, queryOne } from "../../shared/db";

/**
 * 商品库查询结果
 */
interface LookupResult {
  /** 是否命中 */
  matched: boolean;
  /** SPU 信息（命中时返回） */
  spu?: {
    id: number;
    spuCode: string;
    name: string;
    brandId: number;
    brandName: string;
    specs: string;
    unit: string;
    mainImage: string;
    imageUrls: string | object;
    properties: string | object;
    description: string;
    suggestedRetailPrice: string;
  };
  /** SKU 信息（命中时返回） */
  sku?: {
    id: number;
    spuId: number;
    skuCode: string;
    barcode: string;
    skuName: string;
    volume: string;
    packaging: string;
    baseUnit: string;
    boxUnit: string;
    boxRatio: number;
    skuImage: string;
  };
  /** 品牌信息（命中时返回） */
  brand?: {
    id: number;
    name: string;
    logo: string;
  };
}

/**
 * 商品库扫码查询服务
 *
 * 供商户端按条码查询商品库中的 SPU/SKU 信息。
 * 商品库为平台级数据，不携带 tenant_id，使用 query() / queryOne() 查询。
 */
class LibraryLookupService {
  /**
   * 按条码查询商品库
   *
   * 流程：
   * 1. 在 t_library_sku 中按条码查找已审核通过的 SKU
   * 2. 未命中直接返回 { matched: false }
   * 3. 命中后查询关联的 SPU（已审核通过）和品牌信息
   * 4. 对 SPU 的 hit_count +1（记录扫码命中次数）
   * 5. 返回组装后的 SPU/SKU/Brand 信息
   *
   * @param barcode - 商品条码
   * @returns 查询结果
   */
  async lookupByBarcode(barcode: string): Promise<LookupResult> {
    // 第一步：按条码查找 SKU（仅查找已审核通过的）
    const sku = await queryOne<any>(
      `SELECT id, spu_id, sku_code, barcode, sku_name, volume, packaging,
              base_unit, box_unit, box_ratio, sku_image, status
       FROM t_library_sku
       WHERE barcode = ? AND status = 'APPROVED'`,
      [barcode]
    );

    if (!sku) {
      return { matched: false };
    }

    // 第二步：查找关联的 SPU（仅查找已审核通过的）
    const spu = await queryOne<any>(
      `SELECT id, spu_code, name, brand_id, specs, unit, main_image,
              image_urls, properties, description, suggested_retail_price,
              status, hit_count
       FROM t_library_spu
       WHERE id = ? AND status = 'APPROVED'`,
      [sku.spu_id]
    );

    if (!spu) {
      return { matched: false };
    }

    // 第三步：查找品牌信息
    const brand = await queryOne<any>(
      `SELECT id, name, logo
       FROM t_library_brand
       WHERE id = ? AND status = 'APPROVED'`,
      [spu.brand_id]
    );

    // 第四步：SPU 扫码命中次数 +1
    const currentHitCount = Number(spu.hit_count) || 0;
    await query(
      `UPDATE t_library_spu SET hit_count = ? WHERE id = ?`,
      [currentHitCount + 1, spu.id]
    );

    // 组装返回结果
    return {
      matched: true,
      spu: {
        id: spu.id,
        spuCode: spu.spu_code,
        name: spu.name,
        brandId: spu.brand_id,
        brandName: brand?.name ?? "",
        specs: spu.specs ?? "",
        unit: spu.unit ?? "",
        mainImage: spu.main_image ?? "",
        imageUrls: spu.image_urls ?? "[]",
        properties: spu.properties ?? "{}",
        description: spu.description ?? "",
        suggestedRetailPrice: spu.suggested_retail_price ?? "0.00",
      },
      sku: {
        id: sku.id,
        spuId: sku.spu_id,
        skuCode: sku.sku_code,
        barcode: sku.barcode,
        skuName: sku.sku_name,
        volume: sku.volume ?? "",
        packaging: sku.packaging ?? "",
        baseUnit: sku.base_unit ?? "",
        boxUnit: sku.box_unit ?? "",
        boxRatio: Number(sku.box_ratio) || 1,
        skuImage: sku.sku_image ?? "",
      },
      brand: brand
        ? {
            id: brand.id,
            name: brand.name,
            logo: brand.logo ?? "",
          }
        : undefined,
    };
  }
}

export const libraryLookupService = new LibraryLookupService();
