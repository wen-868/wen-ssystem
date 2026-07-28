/**
 * 平台商品库管理控制器
 *
 * 处理 SPU/SKU/品牌/API Key 的 HTTP 请求
 */

import { ok, fail } from "../../shared/response";
import { libraryService } from "../../services/platform/library.service";

// ─── SPU 管理 ──────────────────────────────────────────────────

/** SPU 列表 */
export async function listSpus(req: any, res: any) {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = req.query.keyword as string | undefined;
  const status = req.query.status as string | undefined;
  const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;

  const result = await libraryService.getSpus({ page, pageSize, keyword, status, brandId });
  res.json(ok(result));
}

/** SPU 详情 */
export async function getSpu(req: any, res: any) {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json(fail("无效的SPU ID", "400"));
    return;
  }

  const spu = await libraryService.getSpuById(id);
  if (!spu) {
    res.status(404).json(fail("SPU不存在", "404"));
    return;
  }
  res.json(ok(spu));
}

/** 创建 SPU */
export async function createSpu(req: any, res: any) {
  const { name, brandId, specs, unit, mainImage, imageUrls, properties,
          description, detail, suggestedRetailPrice, source, skus } = req.body;

  if (!name) {
    res.status(400).json(fail("缺少必填字段：name", "400"));
    return;
  }

  const result = await libraryService.createSpu({
    name,
    brandId: brandId ? Number(brandId) : undefined,
    specs,
    unit,
    mainImage,
    imageUrls,
    properties,
    description,
    detail,
    suggestedRetailPrice: suggestedRetailPrice !== undefined ? Number(suggestedRetailPrice) : undefined,
    source,
    skus,
  });

  res.json(ok(result));
}

/** 更新 SPU */
export async function updateSpu(req: any, res: any) {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json(fail("无效的SPU ID", "400"));
    return;
  }

  const { name, brandId, specs, unit, mainImage, imageUrls, properties,
          description, detail, suggestedRetailPrice } = req.body;

  const result = await libraryService.updateSpu(id, {
    name,
    brandId: brandId !== undefined ? Number(brandId) : undefined,
    specs,
    unit,
    mainImage,
    imageUrls,
    properties,
    description,
    detail,
    suggestedRetailPrice: suggestedRetailPrice !== undefined ? Number(suggestedRetailPrice) : undefined,
  });

  res.json(ok(result));
}

/** 审核 SPU（PENDING → APPROVED / REJECTED） */
export async function reviewSpu(req: any, res: any) {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json(fail("无效的SPU ID", "400"));
    return;
  }

  const { status } = req.body;
  if (!status) {
    res.status(400).json(fail("缺少必填字段：status", "400"));
    return;
  }

  // 审核人 ID 从平台认证 token 中获取
  const reviewedBy = req.user?.id;
  if (!reviewedBy) {
    res.status(401).json(fail("无法获取审核人信息", "401"));
    return;
  }

  const result = await libraryService.reviewSpu(id, status, Number(reviewedBy));
  res.json(ok(result));
}

/** 删除 SPU */
export async function deleteSpu(req: any, res: any) {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json(fail("无效的SPU ID", "400"));
    return;
  }

  const result = await libraryService.deleteSpu(id);
  res.json(ok(result));
}

/** 批量导入 SPU */
export async function importSpus(req: any, res: any) {
  const list = req.body;
  if (!Array.isArray(list)) {
    res.status(400).json(fail("请求数据必须为数组", "400"));
    return;
  }

  const result = await libraryService.importSpus(list);
  res.json(ok(result));
}

// ─── SKU 管理 ──────────────────────────────────────────────────

/** SPU 下 SKU 列表 */
export async function listSkusBySpu(req: any, res: any) {
  const spuId = Number(req.params.spuId);
  if (!spuId) {
    res.status(400).json(fail("无效的SPU ID", "400"));
    return;
  }

  const skus = await libraryService.getSkusBySpuId(spuId);
  res.json(ok(skus));
}

/** 为 SPU 添加 SKU */
export async function addSku(req: any, res: any) {
  const spuId = Number(req.params.spuId);
  if (!spuId) {
    res.status(400).json(fail("无效的SPU ID", "400"));
    return;
  }

  const { skuName, barcode, volume, packaging, baseUnit, boxUnit, boxRatio, skuImage } = req.body;

  const result = await libraryService.addSku(spuId, {
    skuName,
    barcode,
    volume,
    packaging,
    baseUnit,
    boxUnit,
    boxRatio: boxRatio !== undefined ? Number(boxRatio) : undefined,
    skuImage,
  });

  res.json(ok(result));
}

/** 更新 SKU */
export async function updateSku(req: any, res: any) {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json(fail("无效的SKU ID", "400"));
    return;
  }

  const { skuName, barcode, volume, packaging, baseUnit, boxUnit, boxRatio, skuImage, status } = req.body;

  const result = await libraryService.updateSku(id, {
    skuName,
    barcode,
    volume,
    packaging,
    baseUnit,
    boxUnit,
    boxRatio: boxRatio !== undefined ? Number(boxRatio) : undefined,
    skuImage,
    status,
  });

  res.json(ok(result));
}

/** 删除 SKU */
export async function deleteSku(req: any, res: any) {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json(fail("无效的SKU ID", "400"));
    return;
  }

  const result = await libraryService.deleteSku(id);
  res.json(ok(result));
}

// ─── 品牌管理 ──────────────────────────────────────────────────

/** 品牌列表 */
export async function listBrands(req: any, res: any) {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const keyword = req.query.keyword as string | undefined;

  const result = await libraryService.getBrands({ page, pageSize, keyword });
  res.json(ok(result));
}

/** 创建品牌 */
export async function createBrand(req: any, res: any) {
  const { name, logo, description, originCountry, sortNo } = req.body;

  if (!name) {
    res.status(400).json(fail("缺少必填字段：name", "400"));
    return;
  }

  const result = await libraryService.createBrand({
    name,
    logo,
    description,
    originCountry,
    sortNo: sortNo !== undefined ? Number(sortNo) : undefined,
  });

  res.json(ok(result));
}

/** 更新品牌 */
export async function updateBrand(req: any, res: any) {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json(fail("无效的品牌 ID", "400"));
    return;
  }

  const { name, logo, description, originCountry, sortNo, status } = req.body;

  const result = await libraryService.updateBrand(id, {
    name,
    logo,
    description,
    originCountry,
    sortNo: sortNo !== undefined ? Number(sortNo) : undefined,
    status: status !== undefined ? Number(status) : undefined,
  });

  res.json(ok(result));
}

/** 删除品牌 */
export async function deleteBrand(req: any, res: any) {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json(fail("无效的品牌 ID", "400"));
    return;
  }

  const result = await libraryService.deleteBrand(id);
  res.json(ok(result));
}

// ─── API Key 管理 ──────────────────────────────────────────────

/** API Key 列表 */
export async function listApiKeys(req: any, res: any) {
  const result = await libraryService.getApiKeys();
  res.json(ok(result));
}

/** 创建 API Key */
export async function createApiKey(req: any, res: any) {
  const { appName, allowedIps, dailyLimit, remark } = req.body;

  if (!appName) {
    res.status(400).json(fail("缺少必填字段：appName", "400"));
    return;
  }

  const result = await libraryService.createApiKey({
    appName,
    allowedIps,
    dailyLimit: dailyLimit !== undefined ? Number(dailyLimit) : undefined,
    remark,
  });

  res.json(ok(result));
}

/** 更新 API Key */
export async function updateApiKey(req: any, res: any) {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json(fail("无效的 API Key ID", "400"));
    return;
  }

  const { dailyLimit, allowedIps, status, remark } = req.body;

  const result = await libraryService.updateApiKey(id, {
    dailyLimit: dailyLimit !== undefined ? Number(dailyLimit) : undefined,
    allowedIps,
    status: status !== undefined ? Number(status) : undefined,
    remark,
  });

  res.json(ok(result));
}

/** 吊销 API Key */
export async function deleteApiKey(req: any, res: any) {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json(fail("无效的 API Key ID", "400"));
    return;
  }

  const result = await libraryService.deleteApiKey(id);
  res.json(ok(result));
}

/** API Key 调用统计 */
export async function getApiKeyStats(req: any, res: any) {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json(fail("无效的 API Key ID", "400"));
    return;
  }

  const result = await libraryService.getApiKeyStats(id);
  res.json(ok(result));
}
