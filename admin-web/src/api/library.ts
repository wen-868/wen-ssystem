import { api } from "./request";

/**
 * 商品库扫码查询 — 商户端 admin-web 专用（R64-L09）
 *
 * 后端接口：POST /api/admin/library/lookup
 *   - 鉴权：requireAuthWithTenant（带租户隔离）
 *   - 命中：{ matched: true, spu, sku, brand }，不含 category（分类由商户自行选择）
 *   - 未命中：{ matched: false }
 */

export interface LibraryLookupResult {
  matched: boolean;
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
    suggestedRetailPrice: string | number;
  };
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
    boxRatio: number | string;
    skuImage: string;
  };
  brand?: {
    id: number;
    name: string;
    logo: string;
  };
}

/**
 * 按条码查询平台商品库（商户新增商品时快速录入）
 * @param barcode 商品条码（EAN-13/UPC 等）
 */
export async function lookupLibraryByBarcode(barcode: string): Promise<LibraryLookupResult> {
  const { data } = await api.post("/admin/library/lookup", { barcode });
  return (data?.data || data) as LibraryLookupResult;
}
