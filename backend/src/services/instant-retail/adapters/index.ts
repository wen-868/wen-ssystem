/**
 * 即时零售平台适配器统一入口
 * Instant Retail Platform Adapters Entry Point
 *
 * 导出所有平台适配器，并在模块加载时自动注册到全局注册表。
 * 使用方式：
 *   import { createAdapter } from "../registry";
 *   const adapter = createAdapter('JD');
 */

import { register, createAdapter } from "../registry";
import type { PlatformType, UnifiedOrder, PlatformOrderStatus, UnifiedOrderItem, UnifiedAddress, PlatformCredentials } from "../types";

// 导入各平台适配器
import { JdAdapter } from "./jd-adapter";
import { MeituanAdapter } from "./meituan-adapter";
import { ElemeAdapter } from "./eleme-adapter";

// 注册到全局适配器注册表
register('JD', JdAdapter);
register('MEITUAN', MeituanAdapter);
register('ELEME', ElemeAdapter);

// 导出所有适配器类
export { JdAdapter } from "./jd-adapter";
export { MeituanAdapter } from "./meituan-adapter";
export { ElemeAdapter } from "./eleme-adapter";
export { createAdapter };

/**
 * 解析平台类型字符串
 * @param raw 原始平台标识字符串
 * @returns 标准化的 PlatformType
 */
export function parsePlatformType(raw: string): PlatformType {
  const upper = String(raw).toUpperCase();
  if (upper === 'JD' || upper === 'JINGDONG' || upper === '\u4EAC\u4E1C') return 'JD';
  if (upper === 'MEITUAN' || upper === 'MT' || upper === '\u7F8E\u56E2') return 'MEITUAN';
  if (upper === 'ELEME' || upper === 'ELE' || upper === '\u997F\u4E86\u4E48') return 'ELEME';
  throw new Error(`\u4E0D\u652F\u6301\u7684\u5E73\u53F0\u7C7B\u578B: ${raw}`);
}

/**
 * 将平台推送的原始数据解析为统一订单结构
 * 当前为模拟实现，真实接入时需根据各平台字段映射完善
 *
 * @param platform 平台类型
 * @param payload 平台推送的原始数据
 * @returns 统一订单结构
 */
export function parseUnifiedOrder(platform: PlatformType, payload: Record<string, unknown> | undefined): UnifiedOrder {
  const raw = payload ?? {};
  const platformOrderId = String(raw.platformOrderId ?? raw.orderId ?? raw.order_id ?? `UNKNOWN_${Date.now()}`);
  const storeId = String(raw.storeId ?? raw.store_id ?? raw.poiId ?? '1');

  // 状态映射（各平台原始状态 -> 统一状态）
  const rawStatus = String(raw.status ?? raw.orderStatus ?? raw.order_status ?? 'PENDING');
  const statusMap: Record<string, PlatformOrderStatus> = {
    '1': 'PENDING', '2': 'ACCEPTED', '4': 'ACCEPTED', '6': 'DELIVERING',
    '7': 'DELIVERING', '8': 'COMPLETED', '9': 'CANCELLED',
    'PENDING': 'PENDING', 'ACCEPTED': 'ACCEPTED', 'DELIVERING': 'DELIVERING',
    'COMPLETED': 'COMPLETED', 'CANCELLED': 'CANCELLED', 'REFUNDING': 'REFUNDING',
    '\u5F85\u63A5\u5355': 'PENDING', '\u5F85\u914D\u9001': 'ACCEPTED',
    '\u914D\u9001\u4E2D': 'DELIVERING', '\u5DF2\u5B8C\u6210': 'COMPLETED',
    '\u5DF2\u53D6\u6D88': 'CANCELLED'
  };
  const status = statusMap[rawStatus] ?? 'PENDING';

  // 商品项解析
  const items: UnifiedOrderItem[] = [];
  const rawItems = raw.items ?? raw.products ?? raw.orderItems ?? raw.detail ?? [];
  if (Array.isArray(rawItems)) {
    for (const item of rawItems) {
      if (typeof item === 'object' && item !== null) {
        const it = item as Record<string, unknown>;
        const qty = Number(it.qty ?? it.quantity ?? it.num ?? it.count ?? 1);
        const unitPrice = Number(it.unitPrice ?? it.price ?? it.unit_price ?? 0);
        items.push({
          localSkuId: String(it.localSkuId ?? it.skuId ?? it.sku_id ?? '0'),
          platformSkuId: String(it.platformSkuId ?? it.skuId ?? it.sku_id ?? '0'),
          name: String(it.name ?? it.skuName ?? it.sku_name ?? it.productName ?? '\u672A\u77E5\u5546\u54C1'),
          quantity: qty,
          unitPrice: unitPrice,
          totalPrice: Number(it.totalPrice ?? it.subtotal ?? it.subtotalAmount ?? qty * unitPrice),
          spec: String(it.spec ?? it.skuSpec ?? it.specification ?? '')
        });
      }
    }
  }
  if (items.length === 0) {
    // 兜底：至少放一个商品项
    items.push({
      localSkuId: '0',
      platformSkuId: '0',
      name: '\u5E73\u53F0\u5546\u54C1',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0
    });
  }

  // 地址解析
  const rawAddress = (raw.address ?? raw.receiverAddress ?? raw.receiver_address ?? {}) as Record<string, unknown>;
  const address: UnifiedAddress = {
    name: String(rawAddress.name ?? raw.receiverName ?? raw.receiver_name ?? ''),
    phone: String(rawAddress.phone ?? raw.receiverMobile ?? raw.receiver_mobile ?? raw.phone ?? ''),
    province: String(rawAddress.province ?? ''),
    city: String(rawAddress.city ?? ''),
    district: String(rawAddress.district ?? raw.area ?? ''),
    detail: String(rawAddress.detail ?? rawAddress.address ?? rawAddress.street ?? ''),
    latitude: rawAddress.latitude ? Number(rawAddress.latitude) : undefined,
    longitude: rawAddress.longitude ? Number(rawAddress.longitude) : undefined
  };

  const totalAmount = Number(raw.totalAmount ?? raw.total_amount ?? raw.originalPrice ?? raw.original_price ?? 0);
  const deliveryFee = Number(raw.deliveryFee ?? raw.delivery_fee ?? raw.shippingFee ?? 0);
  const discountAmount = Number(raw.discountAmount ?? raw.discount_amount ?? raw.discount ?? 0);
  const payAmount = Number(raw.payAmount ?? raw.pay_amount ?? raw.actualPrice ?? raw.actual_price ?? totalAmount);

  return {
    orderId: `IR_${platform}_${platformOrderId}`,
    platform,
    platformOrderId,
    storeId,
    items,
    totalAmount,
    deliveryFee,
    discountAmount,
    payAmount,
    address,
    remark: String(raw.remark ?? raw.note ?? raw.comment ?? ''),
    status,
    createdAt: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
    updatedAt: raw.updatedAt ? new Date(String(raw.updatedAt)) : new Date(),
    platformRawData: raw
  };
}

/**
 * 获取平台适配器实例（带凭证）
 * @param platform 平台类型
 * @param credentials 平台凭证
 * @returns 适配器实例
 */
export function getAdapter(platform: PlatformType, credentials: PlatformCredentials) {
  return createAdapter(platform, credentials);
}
