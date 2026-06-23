/**
 * 即时零售统一类型定义
 * Instant Retail Unified Type Definitions
 */

/** 支持的即时零售平台类型 */
export type PlatformType = 'JD' | 'MEITUAN' | 'ELEME';

/** 平台订单状态 */
export type PlatformOrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DELIVERING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDING';

/** 平台接入凭证 */
export interface PlatformCredentials {
  platform: PlatformType;
  storeId: string;
  appKey: string;
  appSecret: string;
  merchantId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpireAt: Date;
  enabled: boolean;
  configJson?: Record<string, unknown> | null;
}

/** 平台订单原始数据 */
export interface PlatformOrder {
  platformOrderId: string;
  platform: PlatformType;
  storeId: string;
  platformStatus: string;
  orderDataJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** 平台商品映射 */
export interface PlatformProductMap {
  id: string;
  platform: PlatformType;
  storeId: string;
  localSkuId: string;
  platformSkuId: string;
  platformSpuId: string;
  syncStatus: 'SYNCED' | 'PENDING' | 'FAILED' | 'UNSYNCED';
}

/** 统一订单商品项 */
export interface UnifiedOrderItem {
  localSkuId: string;
  platformSkuId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  spec?: string;
}

/** 统一收货地址信息 */
export interface UnifiedAddress {
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  latitude?: number;
  longitude?: number;
}

/** 统一订单结构 */
export interface UnifiedOrder {
  orderId: string;
  platform: PlatformType;
  platformOrderId: string;
  storeId: string;
  items: UnifiedOrderItem[];
  totalAmount: number;
  deliveryFee: number;
  discountAmount: number;
  payAmount: number;
  address: UnifiedAddress;
  remark?: string;
  status: PlatformOrderStatus;
  createdAt: Date;
  updatedAt: Date;
  platformRawData?: Record<string, unknown>;
}

/** 统一商品结构 */
export interface UnifiedProduct {
  localSkuId: string;
  platformSkuId: string;
  platformSpuId: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  price: number;
  originalPrice?: number;
  stock: number;
  unit?: string;
  spec?: string;
  images: string[];
  status: 'ONLINE' | 'OFFLINE' | 'SOLD_OUT';
  platform: PlatformType;
  storeId: string;
}

/** 库存更新参数 */
export interface UpdateInventoryParams {
  localSkuId: string;
  platformSkuId: string;
  stock: number;
  storeId: string;
}

/** 库存更新结果 */
export interface UpdateInventoryResult {
  success: boolean;
  localSkuId: string;
  platformSkuId: string;
  message?: string;
}

/** Webhook 验签结果 */
export interface WebhookVerificationResult {
  valid: boolean;
  platform?: PlatformType;
  eventType?: string;
  payload?: Record<string, unknown>;
}

/** 同步订单结果 */
export interface SyncOrdersResult {
  orders: UnifiedOrder[];
  hasMore: boolean;
  nextCursor?: string;
}

/** 适配器必须实现的接口 */
export interface AdapterInterface {
  /** 认证并刷新 Token */
  authenticate(): Promise<PlatformCredentials>;

  /** 同步订单列表 */
  syncOrders(params?: {
    startTime?: Date;
    endTime?: Date;
    status?: PlatformOrderStatus;
    cursor?: string;
    limit?: number;
  }): Promise<SyncOrdersResult>;

  /** 获取订单详情 */
  getOrderDetail(platformOrderId: string): Promise<UnifiedOrder>;

  /** 确认接单 */
  confirmOrder(platformOrderId: string): Promise<boolean>;

  /** 拒单 */
  rejectOrder(platformOrderId: string, reason?: string): Promise<boolean>;

  /** 开始配送 */
  startDelivery(platformOrderId: string, courierInfo?: {
    name?: string;
    phone?: string;
    courierId?: string;
  }): Promise<boolean>;

  /** 完成配送 */
  completeDelivery(platformOrderId: string): Promise<boolean>;

  /** 取消订单 */
  cancelOrder(platformOrderId: string, reason?: string): Promise<boolean>;

  /** 同步商品列表 */
  syncProducts(params?: {
    cursor?: string;
    limit?: number;
  }): Promise<{
    products: UnifiedProduct[];
    hasMore: boolean;
    nextCursor?: string;
  }>;

  /** 更新库存 */
  updateInventory(params: UpdateInventoryParams[]): Promise<UpdateInventoryResult[]>;

  /** 验证 Webhook 签名 */
  verifyWebhook(payload: unknown, signature: string, timestamp?: string): Promise<WebhookVerificationResult>;
}
