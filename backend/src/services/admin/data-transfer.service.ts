/**
 * 数据导入导出服务（商品/客户）
 * 导出复用 export.service 查询，导入支持 CSV 文本解析写入。
 */
import { query } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import { makeBizNo } from "../../shared/id";
import { exportProducts, exportCustomers } from "./export.service";

/* ── 行业通用模板（中文表头，兼容管家婆/用友/金蝶等同行导出格式） ── */

/** 商品通用模板表头 */
export const PRODUCT_TEMPLATE_HEADERS = [
  "商品编码", "条码", "商品名称", "规格型号", "单位", "分类", "品牌",
  "进价", "售价", "批发价", "库存数量", "预警值",
] as const;

/** 客户通用模板表头 */
export const CUSTOMER_TEMPLATE_HEADERS = [
  "客户名称", "手机号", "客户类型", "积分", "等级", "状态",
] as const;

/** 商品表头同义词 → 内部字段（导入兼容同行各种叫法） */
const PRODUCT_HEADER_ALIASES: Record<string, string> = {
  "商品编码": "skuCode", "sku_code": "skuCode", "sku编码": "skuCode",
  "编码": "skuCode", "货号": "skuCode", "商品编号": "skuCode",
  "条码": "barcode", "barcode": "barcode", "条形码": "barcode", "商品条码": "barcode",
  "商品名称": "skuName", "sku_name": "skuName", "sku名称": "skuName",
  "名称": "skuName", "商品名": "skuName", "货品名称": "skuName",
  "规格型号": "specs", "specs": "specs", "规格": "specs", "型号": "specs",
  "单位": "unit", "unit": "unit", "计量单位": "unit", "基本单位": "unit",
  "分类": "category", "category": "category", "商品分类": "category", "类别": "category",
  "品牌": "brand", "brand": "brand", "品牌名称": "brand",
  "进价": "costPrice", "cost_price": "costPrice", "成本价": "costPrice",
  "进货价": "costPrice", "采购价": "costPrice",
  "售价": "retailPrice", "retail_price": "retailPrice", "零售价": "retailPrice",
  "销售价": "retailPrice", "单价": "retailPrice",
  "批发价": "wholesalePrice", "wholesale_price": "wholesalePrice", "批发价格": "wholesalePrice",
  "库存数量": "quantity", "quantity": "quantity", "库存": "quantity",
  "库存量": "quantity", "当前库存": "quantity", "现有库存": "quantity",
  "预警值": "warningThreshold", "warning_threshold": "warningThreshold",
  "预警阈值": "warningThreshold", "最低库存": "warningThreshold", "安全库存": "warningThreshold",
};

/** 客户表头同义词 → 内部字段 */
const CUSTOMER_HEADER_ALIASES: Record<string, string> = {
  "客户名称": "name", "name": "name", "姓名": "name", "客户姓名": "name", "会员名称": "name",
  "手机号": "mobile", "mobile": "mobile", "手机": "mobile", "电话": "mobile", "手机号码": "mobile",
  "客户类型": "customerType", "customertype": "customerType", "类型": "customerType", "客户类别": "customerType",
  "积分": "points", "points": "points",
  "等级": "levelCode", "levelcode": "levelCode", "会员等级": "levelCode",
  "状态": "status", "status": "status",
};

/** 商品模板导出（中文表头对象数组，前端直接转 CSV） */
export async function exportProductsData(tenantId: string, keyword?: string) {
  const rows = await exportProducts(tenantId, keyword);
  return rows.map((r) => ({
    "商品编码": r.skuCode ?? "",
    "条码": r.barcode ?? "",
    "商品名称": r.skuName ?? "",
    "规格型号": r.specs ?? "",
    "单位": r.baseUnit ?? "",
    "分类": r.categoryName ?? "",
    "品牌": r.brandName ?? "",
    "进价": r.costPrice ?? "",
    "售价": r.retailPrice ?? "",
    "批发价": r.wholesalePrice ?? "",
    "库存数量": r.quantity ?? 0,
    "预警值": r.warningThreshold ?? 0,
  }));
}

/** 租户客户类型配置（code → name） */
async function loadCustomerTypeMap(tenantId: string): Promise<Map<string, string>> {
  const rows = await query<{ code: string; name: string }>(
    "SELECT code, name FROM t_customer_type WHERE tenant_id = ? AND status = 1 ORDER BY sort ASC, id ASC",
    [tenantId]
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(String(r.code), String(r.name));
  }
  // 内置兜底
  map.set("RETAIL", "零售");
  map.set("WHOLESALE", "批发");
  return map;
}

/** 客户模板导出（中文表头对象数组，前端直接转 CSV） */
export async function exportCustomersData(tenantId: string, keyword?: string) {
  const rows = await exportCustomers(tenantId, keyword);
  const typeMap = await loadCustomerTypeMap(tenantId);
  return rows.map((r) => ({
    "客户名称": r.name ?? "",
    "手机号": r.mobile ?? "",
    "客户类型": typeMap.get(String(r.customerType ?? "")) ?? String(r.customerType ?? "零售"),
    "积分": r.points ?? 0,
    "等级": r.levelCode ?? "",
    "状态": String(r.status) === "0" ? "停用" : "正常",
  }));
}

/** 表头解析：同义词 → 内部字段列索引（返回 null 表示该字段未出现在文件中） */
function resolveHeaderIndex(header: string[], aliases: Record<string, string>, field: string): number | null {
  for (let i = 0; i < header.length; i++) {
    const key = header[i].trim().toLowerCase();
    if (aliases[key] === field) return i;
  }
  return null;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/** 解析 CSV 文本为二维数组（支持引号包裹） */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** 客户类型值兼容：优先匹配系统配置（code/name），再按同行常见叫法归类 */
async function normalizeCustomerType(
  value: string,
  tenantId: string,
  typeMap?: Map<string, string>
): Promise<string> {
  const v = (value || "").trim();
  if (!v) return "RETAIL";
  const map = typeMap ?? await loadCustomerTypeMap(tenantId);
  // 1) 精确匹配配置 name 或 code
  for (const [code, name] of map.entries()) {
    if (name === v || code === v) return code;
  }
  // 2) 按同行常见叫法归类
  const lower = v.toLowerCase();
  if (["wholesale", "批发", "批发客户", "经销商", "批发商"].includes(lower)) return "WHOLESALE";
  if (["retail", "零售", "零售客户", "散客", "会员", "普通"].includes(lower)) return "RETAIL";
  // 3) 无法识别则归为零售（避免导入失败）
  return "RETAIL";
}

/**
 * 客户 CSV 导入（行业通用中文模板）：
 * 客户名称,手机号,客户类型,积分,等级,状态
 * 同时兼容英文表头 name,mobile,customerType 以及各类同义词。
 */
export async function importCustomersCsv(csv: string, tenantId: string): Promise<ImportResult> {
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    throw new AppError("CSV 内容为空或缺少数据行", 400);
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const nameIdx = resolveHeaderIndex(header, CUSTOMER_HEADER_ALIASES, "name");
  const mobileIdx = resolveHeaderIndex(header, CUSTOMER_HEADER_ALIASES, "mobile");
  if (nameIdx === null || mobileIdx === null) {
    throw new AppError("CSV 表头需包含「客户名称」与「手机号」列（兼容 name/mobile）", 400);
  }
  const typeIdx = resolveHeaderIndex(header, CUSTOMER_HEADER_ALIASES, "customerType");
  const pointsIdx = resolveHeaderIndex(header, CUSTOMER_HEADER_ALIASES, "points");
  const levelIdx = resolveHeaderIndex(header, CUSTOMER_HEADER_ALIASES, "levelCode");
  const statusIdx = resolveHeaderIndex(header, CUSTOMER_HEADER_ALIASES, "status");
  const typeMap = await loadCustomerTypeMap(tenantId);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[nameIdx] || "").trim();
    const mobile = (r[mobileIdx] || "").trim().replace(/^\+?86[- ]?/, "");
    if (!name || !/^1[3-9]\d{9}$/.test(mobile)) {
      skipped++;
      errors.push(`第 ${i + 1} 行：客户名称或手机号不合法`);
      continue;
    }
    const existing = await query<{ id: number }>(
      "SELECT id FROM t_member WHERE mobile = ? AND tenant_id = ?",
      [mobile, tenantId]
    );
    if (existing.length > 0) {
      skipped++;
      errors.push(`第 ${i + 1} 行：手机号 ${mobile} 已存在`);
      continue;
    }
    const customerType = typeIdx !== null ? await normalizeCustomerType(r[typeIdx], tenantId, typeMap) : "RETAIL";
    const points = pointsIdx !== null ? Number((r[pointsIdx] || "").trim()) || 0 : 0;
    const levelCode = levelIdx !== null ? (r[levelIdx] || "").trim() : null;
    const statusValue = statusIdx !== null ? (r[statusIdx] || "").trim() : "";
    const status = ["0", "停用", "禁用"].includes(statusValue) ? 0 : 1;
    await query(
      `INSERT INTO t_member (name, mobile, customer_type, points, level_code, status, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, mobile, customerType, points, levelCode, status, tenantId]
    );
    imported++;
  }

  return { imported, updated: 0, skipped, errors: errors.slice(0, 20) };
}

/* ── 商品导入 ── */

/** 按名称查/建分类（返回分类ID） */
async function ensureCategory(name: string, tenantId: string): Promise<number> {
  const rows = await query<{ id: number }>(
    "SELECT id FROM t_product_category WHERE name = ? AND tenant_id = ? LIMIT 1",
    [name, tenantId]
  );
  if (rows.length > 0) return Number(rows[0].id);
  const result = await query<{ insertId: number }>(
    "INSERT INTO t_product_category (name, sort_no, status, tenant_id) VALUES (?, 0, 1, ?)",
    [name, tenantId]
  );
  return (result as unknown as { insertId: number }).insertId;
}

/** 按名称查/建 SPU（返回 SPU ID） */
async function ensureSpu(
  name: string,
  categoryId: number,
  brand: string | null,
  unit: string | null,
  specs: string | null,
  tenantId: string
): Promise<number> {
  const rows = await query<{ id: number }>(
    "SELECT id FROM t_product_spu WHERE name = ? AND tenant_id = ? LIMIT 1",
    [name, tenantId]
  );
  if (rows.length > 0) return Number(rows[0].id);
  const spuCode = makeBizNo("SPU");
  const result = await query<{ insertId: number }>(
    `INSERT INTO t_product_spu (spu_code, name, category_id, brand, unit, specs,
       sale_channels, sort_no, is_new, is_recommend, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), 0, 0, 0, 'ON_SALE', ?)`,
    [spuCode, name, categoryId, brand ?? null, unit ?? null, specs ?? null,
      JSON.stringify(["STORE", "MINIAPP"]), tenantId]
  );
  return (result as unknown as { insertId: number }).insertId;
}

/** 更新已有 SPU 的规格/品牌/单位（导入文件提供时生效） */
async function patchSpu(
  spuId: number,
  specs: string | null,
  brand: string | null,
  unit: string | null,
  tenantId: string
) {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (specs) { sets.push("specs = ?"); params.push(specs); }
  if (brand) { sets.push("brand = ?"); params.push(brand); }
  if (unit) { sets.push("unit = ?"); params.push(unit); }
  if (sets.length === 0) return;
  await query(`UPDATE t_product_spu SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, [...params, spuId, tenantId]);
}

/** 写入/更新 SKU 价格 */
async function upsertSkuPrice(
  skuId: number,
  prices: { retail: number; wholesale: number | null; miniapp: number | null; cost: number | null },
  tenantId: string
) {
  const existing = await query<{ id: number }>(
    "SELECT id FROM t_product_price WHERE sku_id = ? AND tenant_id = ? LIMIT 1",
    [skuId, tenantId]
  );
  if (existing.length > 0) {
    await query(
      `UPDATE t_product_price SET retail_price = ?, wholesale_price = ?, miniapp_price = ?, cost_price = ?, updated_at = NOW()
       WHERE sku_id = ? AND tenant_id = ?`,
      [prices.retail, prices.wholesale, prices.miniapp, prices.cost ?? 0, skuId, tenantId]
    );
  } else {
    await query(
      `INSERT INTO t_product_price (sku_id, cost_price, retail_price, wholesale_price, miniapp_price, store_price, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [skuId, prices.cost ?? 0, prices.retail, prices.wholesale, prices.miniapp, null, tenantId]
    );
  }
}

/** 数值列解析：空值返回 null */
function parseNumberCell(v: string | undefined): number | null {
  const t = (v || "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** 按列索引取值（列不存在时返回空字符串） */
function cell(idx: number | null, row: string[]): string {
  return idx !== null ? (row[idx] || "").trim() : "";
}

/** 租户默认门店（首个门店，库存导入写入目标） */
async function resolveDefaultStoreId(tenantId: string): Promise<number | null> {
  const row = await query<{ id: number }>(
    "SELECT id FROM t_store WHERE tenant_id = ? ORDER BY id ASC LIMIT 1",
    [tenantId]
  );
  return row.length > 0 ? Number(row[0].id) : null;
}

/** 写入默认门店库存（有则累加，无则初始化） */
async function upsertInventory(skuId: number, quantity: number, tenantId: string) {
  const storeId = await resolveDefaultStoreId(tenantId);
  if (!storeId) return false;
  await query(
    `INSERT INTO t_inventory_balance (tenant_id, store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty, version)
     VALUES (?, ?, ?, 'OFFLINE', ?, 0, ?, 0)
     ON DUPLICATE KEY UPDATE
       physical_qty = physical_qty + VALUES(physical_qty),
       available_qty = available_qty + VALUES(available_qty),
       updated_at = NOW()`,
    [tenantId, storeId, skuId, quantity, quantity]
  );
  return true;
}

/**
 * 商品 CSV 导入（行业通用中文模板）：
 * 商品编码,条码,商品名称,规格型号,单位,分类,品牌,进价,售价,批发价,库存数量,预警值
 * 同时兼容英文表头 sku_code,barcode,sku_name,category 等同类叫法。
 * - 商品编码/条码任一用于查重；已存在则更新，不存在则创建 SPU/SKU/价格
 * - 库存数量可选：导入到租户默认门店并累加（无门店时跳过）
 */
export async function importProductsCsv(csv: string, tenantId: string): Promise<ImportResult> {
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    throw new AppError("CSV 内容为空或缺少数据行", 400);
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (field: string) => resolveHeaderIndex(header, PRODUCT_HEADER_ALIASES, field);
  const iSkuCode = idx("skuCode");
  const iBarcode = idx("barcode");
  const iSkuName = idx("skuName");
  const iSpecs = idx("specs");
  const iUnit = idx("unit");
  const iCategory = idx("category");
  const iBrand = idx("brand");
  const iCost = idx("costPrice");
  const iRetail = idx("retailPrice");
  const iWholesale = idx("wholesalePrice");
  const iQuantity = idx("quantity");
  const iThreshold = idx("warningThreshold");

  if (iSkuName === null) {
    throw new AppError("CSV 表头需包含「商品名称」列（兼容 sku_name）", 400);
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let rIdx = 1; rIdx < rows.length; rIdx++) {
    const r = rows[rIdx];
    const skuName = (r[iSkuName] || "").trim();
    const categoryName = iCategory !== null ? (r[iCategory] || "").trim() : "";
    const skuCode = iSkuCode !== null ? (r[iSkuCode] || "").trim() : "";
    const barcode = iBarcode !== null ? (r[iBarcode] || "").trim() : "";
    const specs = iSpecs !== null ? (r[iSpecs] || "").trim() : "";
    const unit = iUnit !== null ? (r[iUnit] || "").trim() : "";
    const brand = iBrand !== null ? (r[iBrand] || "").trim() : "";
    if (!skuName) {
      skipped++;
      errors.push(`第 ${rIdx + 1} 行：缺少商品名称`);
      continue;
    }
    try {
      // 行业模板以商品名称为主名（SPU），规格型号单独一列
      const spuName = skuName;
      const categoryId = await ensureCategory(categoryName || "默认分类", tenantId);
      const spuId = await ensureSpu(spuName, categoryId, brand || null, unit || null, specs || null, tenantId);
      await patchSpu(spuId, specs || null, brand || null, unit || null, tenantId);
      const retail = parseNumberCell(cell(iRetail, r)) ?? 0;
      const wholesale = parseNumberCell(cell(iWholesale, r));
      const cost = parseNumberCell(cell(iCost, r));
      const threshold = parseNumberCell(cell(iThreshold, r)) ?? 0;

      const existing = skuCode
        ? await query<{ id: number }>("SELECT id FROM t_product_sku WHERE sku_code = ? AND tenant_id = ? LIMIT 1", [skuCode, tenantId])
        : barcode
          ? await query<{ id: number }>("SELECT id FROM t_product_sku WHERE barcode = ? AND tenant_id = ? LIMIT 1", [barcode, tenantId])
          : [];

      if (existing.length > 0) {
        const skuId = Number(existing[0].id);
        await query(
          `UPDATE t_product_sku SET sku_name = ?, barcode = COALESCE(?, barcode), warning_threshold = ?, updated_at = NOW() WHERE id = ?`,
          [skuName, barcode || null, threshold, skuId]
        );
        await upsertSkuPrice(skuId, { retail, wholesale, miniapp: null, cost }, tenantId);
        const qty = parseNumberCell(cell(iQuantity, r));
        if (qty && qty > 0) await upsertInventory(skuId, qty, tenantId);
        updated++;
      } else {
        const finalSkuCode = skuCode || makeBizNo("SKU");
        const result = await query<{ insertId: number }>(
          `INSERT INTO t_product_sku (spu_id, sku_code, barcode, sku_name, base_unit, box_unit, box_ratio,
             temperature, trace_enabled, warning_threshold, status, tenant_id)
           VALUES (?, ?, ?, ?, '瓶', '箱', 1, 'NORMAL', 0, ?, 1, ?)`,
          [spuId, finalSkuCode, barcode || null, skuName, threshold, tenantId]
        );
        const skuId = (result as unknown as { insertId: number }).insertId;
        await upsertSkuPrice(skuId, { retail, wholesale, miniapp: null, cost }, tenantId);
        const qty = parseNumberCell(cell(iQuantity, r));
        if (qty && qty > 0) await upsertInventory(skuId, qty, tenantId);
        imported++;
      }
    } catch (e: any) {
      skipped++;
      errors.push(`第 ${rIdx + 1} 行：${e?.message || "导入失败"}`);
    }
  }

  return { imported, updated, skipped, errors: errors.slice(0, 20) };
}

/* ── 模板下载 ── */

/** 商品导入模板（含表头 + 示例行，UTF-8 BOM，Excel 可直接打开） */
export function getProductTemplateCsv(): string {
  const header = PRODUCT_TEMPLATE_HEADERS.join(",");
  const sample = [
    "SKU20260814001", "6901234567890", "五粮液 52度 500ml", "500ml", "瓶",
    "白酒", "五粮液", "300", "450", "380", "100", "50",
  ].join(",");
  return `\uFEFF${header}\n${sample}\n`;
}

/** 客户导入模板（含表头 + 示例行，UTF-8 BOM） */
export function getCustomerTemplateCsv(): string {
  const header = CUSTOMER_TEMPLATE_HEADERS.join(",");
  const sample = ["张三", "13800138000", "零售", "100", "VIP", "正常"].join(",");
  return `\uFEFF${header}\n${sample}\n`;
}
