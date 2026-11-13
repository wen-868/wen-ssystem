/**
 * AI 结果 → 系统原生业务表单/页面。
 *
 * AI 不复制单据详情或开单表单：只把工具结果映射到系统已存在的路由。
 * - createSalesOrder preview → 销售开单原表单（AI 预填，人工核对后沿用原提交链）
 * - querySaleBills / getSaleBillDetail → 销售单原详情页
 */
import type { AiPreviewPayload } from "../../api/ai";

export const AI_SALES_ORDER_DRAFT_KEY = "wb.ai.sales-order-draft.v1";

export interface AiSalesOrderDraftItem {
  skuId: number | null;
  skuName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface AiSalesOrderDraft {
  customerId: number | null;
  customerName: string;
  saleType: "CASH" | "CREDIT";
  customerRemark: string;
  internalRemark: string;
  items: AiSalesOrderDraftItem[];
  createdAt: number;
}

export interface AiNativeFormAction {
  id: string;
  kind: "sales-order-form" | "sale-bill-detail";
  label: string;
  path: string;
  draft?: AiSalesOrderDraft;
  /** 从 AI 挂起预览转交原表单时，先取消这条待确认记录，避免同一记录两处入口重复提交。 */
  confirmationId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function positiveNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function draftFromPreview(preview: AiPreviewPayload): AiSalesOrderDraft | null {
  const details = preview.details;
  if (!isRecord(details)) return null;
  const rawItems = Array.isArray(details.items) ? details.items : [];
  const items = rawItems
    .filter(isRecord)
    .map((item) => {
      const quantity = positiveNumber(item.totalBottleQty ?? item.bottleQty ?? item.quantity);
      const unitPrice = positiveNumber(item.unitPrice);
      return {
        skuId: positiveInt(item.skuId),
        skuName: text(item.skuName),
        quantity,
        unitPrice,
        subtotal: positiveNumber(item.totalPrice) || Number((quantity * unitPrice).toFixed(2)),
      };
    })
    .filter((item) => item.skuName || item.skuId);
  if (items.length === 0) return null;
  return {
    customerId: positiveInt(details.customerId),
    customerName: text(details.customerName),
    saleType: text(details.saleType).toUpperCase() === "CREDIT" ? "CREDIT" : "CASH",
    customerRemark: text(details.remark),
    internalRemark: text(details.internalRemark),
    items,
    createdAt: Date.now(),
  };
}

function detailAction(billNo: string): AiNativeFormAction {
  return {
    id: `sale-bill-detail:${billNo}`,
    kind: "sale-bill-detail",
    label: `查看完整销售单 ${billNo}`,
    path: `/sale-bills/${encodeURIComponent(billNo)}`,
  };
}

export function resolveAiNativeFormActions(input: {
  tool?: string;
  data?: unknown;
  preview?: AiPreviewPayload;
  confirmationId?: string;
}): AiNativeFormAction[] {
  const tool = text(input.tool);
  if (tool === "createSalesOrder" && input.preview) {
    const draft = draftFromPreview(input.preview);
    if (draft) {
      return [
        {
          id: "sales-order-form:ai-preview",
          kind: "sales-order-form",
          label: "打开完整销售开单",
          path: "/sales/create?source=ai&mode=form",
          draft,
          confirmationId: text(input.confirmationId) || undefined,
        },
      ];
    }
  }

  if (!isRecord(input.data)) return [];
  const billNo = text(input.data.billNo);
  if (billNo) return [detailAction(billNo)];

  if (!Array.isArray(input.data.list)) return [];
  const seen = new Set<string>();
  return input.data.list
    .filter(isRecord)
    .map((row) => text(row.billNo))
    .filter((no) => no && !seen.has(no) && Boolean(seen.add(no)))
    .slice(0, 10)
    .map(detailAction);
}

export function stageAiSalesOrderDraft(
  draft: AiSalesOrderDraft,
  storage: Pick<Storage, "setItem"> | null =
    typeof sessionStorage === "undefined" ? null : sessionStorage,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(AI_SALES_ORDER_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function consumeAiSalesOrderDraft(
  storage: Pick<Storage, "getItem" | "removeItem"> | null =
    typeof sessionStorage === "undefined" ? null : sessionStorage,
): AiSalesOrderDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(AI_SALES_ORDER_DRAFT_KEY);
    storage.removeItem(AI_SALES_ORDER_DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) return null;
    const items = parsed.items
      .filter(isRecord)
      .map((item) => ({
        skuId: positiveInt(item.skuId),
        skuName: text(item.skuName),
        quantity: positiveNumber(item.quantity),
        unitPrice: positiveNumber(item.unitPrice),
        subtotal: positiveNumber(item.subtotal),
      }))
      .filter((item) => item.skuName || item.skuId);
    if (items.length === 0) return null;
    return {
      customerId: positiveInt(parsed.customerId),
      customerName: text(parsed.customerName),
      saleType: text(parsed.saleType).toUpperCase() === "CREDIT" ? "CREDIT" : "CASH",
      customerRemark: text(parsed.customerRemark),
      internalRemark: text(parsed.internalRemark),
      items,
      createdAt: Number(parsed.createdAt) || Date.now(),
    };
  } catch {
    return null;
  }
}
