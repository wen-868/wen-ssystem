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
    startTime?: string | Date;
    endTime?: string | Date;
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
    deliveryCompany?: string;
    deliveryNo?: string;
    deliveryMan?: string;
    deliveryPhone?: string;
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

// ==================== 第三方平台 API 响应接口 ====================

/**
 * 美团即时零售 API 通用响应
 * 美团开放平台响应统一包装在 data 字段中
 */
export interface MeituanResponse<T = unknown> {
  data: T;
  /** 业务状态码（部分接口返回） */
  code?: number;
  /** 业务消息（部分接口返回） */
  msg?: string;
  /** 是否成功（部分接口返回） */
  success?: boolean;
}

/**
 * 饿了么即时零售 API 通用响应
 * 饿了么开放平台响应统一包装在 body 字段中
 */
export interface ElemeResponse<T = unknown> {
  body: T;
  /** 业务状态码（部分接口返回） */
  code?: string | number;
  /** 业务消息（部分接口返回） */
  msg?: string;
  /** 是否成功（部分接口返回） */
  success?: boolean;
}

/**
 * 京东到家即时零售 API 通用响应
 * 京东到家开放平台响应包含 code/msg/data 三个字段
 * 注：confirmOrder 等仅返回 code+msg 的接口使用 { code: number; msg: string } 窄类型
 */
export interface JdResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
  /** 是否成功（部分接口返回） */
  success?: boolean;
}

/**
 * 平台商品同步结果
 */
export interface ProductSyncResult {
  success: boolean;
  localSkuId?: string;
  platformSkuId?: string;
  message?: string;
}

/**
 * 平台订单推送响应
 */
export interface OrderPushResult {
  success: boolean;
  platformOrderId?: string;
  message?: string;
}

/**
 * 平台配置脱敏入参约束（maskConfig 接收的行结构约束）
 * maskConfig 使用泛型 <T extends MaskConfigInput> 保留行对象的所有字段
 * 注：appSecret/accessToken/refreshToken 兼容 null（数据库字段可能为 null）
 */
export interface MaskConfigInput {
  appSecret?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
}

/**
 * 零售门店配置入参（saveShopConfig 接收的 body）
 */
export interface RetailShopConfigInput {
  shop_name?: string;
  shop_logo?: string | null;
  shop_description?: string | null;
  contact_phone?: string | null;
  business_hours?: string | null;
  delivery_enabled?: boolean;
  pickup_enabled?: boolean;
  min_order_amount?: number | string;
  delivery_fee?: number | string;
  delivery_radius?: number | string | null;
  estimated_delivery_time?: string | null;
  announcement?: string | null;
  status?: string;
}

/**
 * 零售分类入参（createCategory / updateCategory 接收的 body）
 */
export interface RetailCategoryInput {
  category_name?: string;
  category_icon?: string | null;
  parent_id?: number | null;
  sort_order?: number;
  status?: string;
}

/**
 * 零售商品入参（addRetailProduct / updateRetailProduct 接收的 body）
 */
export interface RetailProductInput {
  product_id?: number;
  sku_id?: number | null;
  category_id?: number | null;
  retail_price?: number | string;
  original_price?: number | string | null;
  stock?: number;
  is_recommended?: boolean;
  is_hot?: boolean;
  is_new?: boolean;
  sort_order?: number;
  status?: string;
}

/**
 * 零售 Banner 入参（createBanner / updateBanner 接收的 body）
 */
export interface RetailBannerInput {
  banner_title?: string | null;
  banner_image?: string;
  link_type?: string;
  link_value?: string | null;
  sort_order?: number;
  status?: string;
  start_time?: string | Date | null;
  end_time?: string | Date | null;
}

/**
 * 零售分类树节点（buildCategoryTree 返回结构）
 */
export interface RetailCategoryTreeNode {
  id: number;
  name: string;
  icon: string | null;
  parentId: number | null;
  sortOrder: number;
  status: string;
  children: RetailCategoryTreeNode[];
}

/**
 * 配送参数（startDelivery 接收的 body，对应适配器 courierInfo）
 */
export interface DeliveryBodyInput {
  deliveryCompany?: string;
  deliveryNo?: string;
  deliveryMan?: string;
  deliveryPhone?: string;
}

/**
 * 同步订单参数（与 AbstractPlatformAdapter.syncOrders 签名一致）
 * platform-integration.service.ts 的 syncOrders 直接转发给 adapter
 */
export interface SyncOrdersParams {
  startTime?: string | Date;
  endTime?: string | Date;
  status?: PlatformOrderStatus;
  cursor?: string;
  limit?: number;
}

/**
 * 同步商品参数（与 AbstractPlatformAdapter.syncProducts 签名一致）
 * platform-integration.service.ts 的 syncProducts 直接转发给 adapter
 */
export interface SyncProductsParams {
  cursor?: string;
  limit?: number;
}
