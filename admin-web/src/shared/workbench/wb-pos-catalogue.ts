/**
 * 收银台分类 / 商品 / 库存可用性适配（WORKBENCH-10 · D.3 收银台交易链路）
 *
 * **现状核对（2026-11-03，不是猜测）**——真实端点来自 `admin-web/src/api/pos.ts` 与 `api/product.ts`：
 *   GET /store/products                收银台商品目录（sku + spu + 价格 + 库存）
 *   GET /admin/products/categories     商品分类（返回数组，`category.controller.listCategories`）
 *   POST /store/trace/verify           追溯码带出商品
 *
 * 库存这一维**必须分层**：`backend/src/services/store/product.service.ts:106` 用
 * `LEFT JOIN t_inventory_balance ib ON ib.sku_id = ? AND ib.store_id = ? AND ib.stock_type='OFFLINE'`
 * 取 `ib.available_qty AS availableQty`，行类型声明为 `availableQty: number | string | null`
 * ⇒ 门店没有该 SKU 的库存行时字段是 **null（未知）**，不是 0、也不是「缺货」。
 * 而收款端 `offlinePayment` 与出库同事务，`beforeQty(=0) < quantity` 直接抛
 * 409「库存不足，无法完成收款出库」（`backend/src/services/admin/sale-bill.service.ts:449`）。
 * ⇒ 结论：`availableQty == null` 只能标 **unavailable（库存待接入）**；把它显示成「缺货」是误报，
 *   把它当「有货」并在收款时不说一句则是伪造可成功性。本文件把两者分开，交视图分别渲染。
 *
 * 原型的 `POS_GOODS`（芙蓉王 / 可乐 500ml / 农夫山泉…）与 `POS_FLOW` 是演示数据，
 * **不移植任何名称、单价、流水号**（派单卡 §六禁止原型 mock 数据）；目录一律走真实端点。
 */

import { searchStoreProducts } from "../../api/pos";
import { getErrorMessage } from "../../api/request";

/** 库存四态：真实有货 / 低库存 / 真实为 0 / 无库存行（待接入） */
export type PosStockState = "ok" | "low" | "out" | "unavailable";

export interface PosStockView {
  state: PosStockState;
  /** 卡片角标文案 */
  text: string;
  /** 样式后缀（stock-ok / stock-low / stock-out / stock-unknown） */
  className: string;
  /** 是否阻止加购：只有「真实缺货」阻止；「待接入」不阻止（无从判定） */
  blockAdd: boolean;
  /** 归一化后的数值；待接入时为 null，UI 不得画成 0 */
  qty: number | null;
}

/** 库存可用性判定（null / undefined / 空串 / NaN ⇒ 待接入） */
export function resolveStockState(availableQty: unknown, lowThreshold = 10): PosStockView {
  if (availableQty === null || availableQty === undefined || availableQty === "") {
    return { state: "unavailable", text: "库存待接入", className: "stock-unknown", blockAdd: false, qty: null };
  }
  const qty = Number(availableQty);
  if (!Number.isFinite(qty)) {
    return { state: "unavailable", text: "库存待接入", className: "stock-unknown", blockAdd: false, qty: null };
  }
  if (qty <= 0) return { state: "out", text: "缺货", className: "stock-out", blockAdd: true, qty: 0 };
  if (qty <= lowThreshold) {
    return { state: "low", text: `库存 ${qty}`, className: "stock-low", blockAdd: false, qty };
  }
  return { state: "ok", text: `库存 ${qty}`, className: "stock-ok", blockAdd: false, qty };
}

/** 商品行是否真实可售（缺货不可加购，其余含待接入均可加购） */
export function canAddToCart(product: { availableQty?: unknown } | null): boolean {
  if (!product) return false;
  return !resolveStockState(product.availableQty).blockAdd;
}

/** 商品是否已有真实库存行（false ⇒ 收款可能因出库 409 失败，需在弹层先提示） */
export function hasStockRow(product: { availableQty?: unknown } | null): boolean {
  return resolveStockState(product?.availableQty).state !== "unavailable";
}

export interface PosCatTab {
  /** 0 = 全部（与视图 activeCategory 约定一致） */
  id: number;
  name: string;
  /** 当前商品集合内该分类的条数（前端过滤，不重复请求） */
  count: number;
}

/**
 * `.pos-cats` 标签条数据（原型 anchor L497）：
 * 「全部」恒在首位，其后按接口顺序列分类；无分类数据时只出「全部」+ 由视图显示待接入。
 */
export function buildPosCatTabs(categories: any[], products: any[]): PosCatTab[] {
  const list = Array.isArray(categories) ? categories : [];
  const items = Array.isArray(products) ? products : [];
  const tabs: PosCatTab[] = [{ id: 0, name: "全部", count: items.length }];
  for (const cat of list) {
    const id = Number(cat?.id ?? cat?.categoryId ?? 0);
    if (!id) continue;
    tabs.push({
      id,
      name: String(cat?.name ?? cat?.categoryName ?? `分类-${id}`),
      count: items.filter((p) => Number(p?.categoryId) === id).length,
    });
  }
  return tabs;
}

export type PosCatalogueState = "loading" | "ready" | "unavailable";

export interface PosCatalogueResult {
  state: PosCatalogueState;
  records: any[];
  /** 本次查询里库存行缺失（待接入）的条数 */
  stockUnknownCount: number;
  message: string;
}

/** 商品目录装载：真实 GET /store/products；失败 ⇒ 结构化 unavailable，零伪造条目 */
export async function loadPosCatalogue(
  params?: { keyword?: string; categoryId?: number; barcode?: string },
  fetchProducts: (p?: { keyword?: string; categoryId?: number; barcode?: string }) => Promise<{ records: any[] }> = searchStoreProducts,
): Promise<PosCatalogueResult> {
  try {
    const data = await fetchProducts(params);
    const records = Array.isArray(data?.records) ? data.records : [];
    return {
      state: "ready",
      records,
      stockUnknownCount: records.filter((p) => !hasStockRow(p)).length,
      message: records.length === 0 ? "商品目录为空（GET /store/products 无匹配记录）" : "",
    };
  } catch (error) {
    return {
      state: "unavailable",
      records: [],
      stockUnknownCount: 0,
      message: `商品目录待接入（GET /store/products ${getErrorMessage(error, "请求失败")}）`,
    };
  }
}

/** 分类装载：真实 GET /admin/products/categories；失败 ⇒ unavailable + 原因（不回落假分类） */
export function normalizeCategoryRows(list: unknown): { rows: any[]; message: string } {
  if (Array.isArray(list)) return { rows: list, message: "" };
  const records = (list as any)?.records;
  if (Array.isArray(records)) return { rows: records, message: "" };
  return { rows: [], message: "商品分类待接入（GET /admin/products/categories 返回体缺失）" };
}

/**
 * 收款前的库存缺口提示：购物车里存在无库存行的 SKU 时返回说明文案，
 * 供弹层显式标 unavailable（真实后果：出库 409「库存不足，无法完成收款出库」）。
 * 全部有库存行 ⇒ 返回空串。
 */
export function describeStockGap(cart: Array<{ skuName?: string; availableQty?: unknown }> | null): string {
  const rows = Array.isArray(cart) ? cart : [];
  const unknown = rows.filter((r) => !hasStockRow(r));
  if (unknown.length === 0) return "";
  const names = unknown.slice(0, 3).map((r) => r?.skuName || "未命名商品").join("、");
  const more = unknown.length > 3 ? ` 等 ${unknown.length} 项` : "";
  return `${names}${more} 无门店库存行（t_inventory_balance 待接入），收款可能因出库校验失败`;
}
