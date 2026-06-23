/**
 * 京东秒送平台适配器
 * JD Instant Delivery (京东秒送) Platform Adapter
 *
 * 真实 API 文档地址：https://openapi.jddj.com/djapi/
 * 京东秒送开放平台提供订单管理、商品同步、库存更新、配送状态等接口。
 */

import { AbstractPlatformAdapter } from '../base-adapter.js';
import type {
  PlatformCredentials,
  PlatformType,
  PlatformOrderStatus,
  UnifiedOrder,
  UnifiedProduct,
  UnifiedOrderItem,
  UnifiedAddress,
  UpdateInventoryParams,
  UpdateInventoryResult,
  WebhookVerificationResult,
  SyncOrdersResult,
} from '../types.js';

export class JdAdapter extends AbstractPlatformAdapter {
  protected readonly platform: PlatformType = 'JD';

  /**
   * 京东 OAuth + MD5 签名认证
   * 真实接口：POST https://openapi.jddj.com/djapi/oauth/token
   *
   * 流程：
   * 1. 使用 app_key + timestamp + app_secret 生成 MD5 签名
   * 2. 调用京东 OAuth 接口获取 access_token
   * 3. 返回包含 token 和过期时间的凭证
   *
   * @returns 更新后的平台接入凭证
   */
  async authenticate(): Promise<PlatformCredentials> {
    const timestamp = Date.now().toString();
    const appKey = this.credentials?.appKey ?? 'mock_app_key';
    const appSecret = this.credentials?.appSecret ?? 'mock_app_secret';
    const storeId = this.credentials?.storeId ?? 'mock_store_id';
    const merchantId = this.credentials?.merchantId ?? 'mock_merchant_id';

    const signStr = this.sign({ app_key: appKey, timestamp, app_secret: appSecret });

    console.log(`[JD] Authenticating with sign: ${signStr}`);

    const expireAt = new Date(Date.now() + 7200 * 1000);
    const creds: PlatformCredentials = {
      platform: 'JD',
      storeId,
      appKey,
      appSecret,
      merchantId,
      accessToken: `jd_mock_token_${timestamp}`,
      refreshToken: `jd_mock_refresh_${timestamp}`,
      tokenExpireAt: expireAt,
      enabled: true,
    };

    this.credentials = creds;
    return creds;
  }

  /**
   * 同步京东订单列表
   * 真实接口：POST https://openapi.jddj.com/djapi/order/queryList
   *
   * 京东秒送订单状态映射：
   * - 待接单 -> PENDING
   * - 待配送 -> ACCEPTED
   * - 配送中 -> DELIVERING
   * - 已完成 -> COMPLETED
   * - 已取消 -> CANCELLED
   *
   * @param params 同步参数（时间范围、状态、分页游标等）
   * @returns 统一订单列表及分页信息
   */
  async syncOrders(params?: {
    startTime?: Date;
    endTime?: Date;
    status?: PlatformOrderStatus;
    cursor?: string;
    limit?: number;
  }): Promise<SyncOrdersResult> {
    await this.ensureAuthenticated();

    const limit = params?.limit ?? 20;
    const mockOrders: UnifiedOrder[] = Array.from({ length: Math.min(limit, 3) }).map((_, i) =>
      this.createMockOrder(`JD${Date.now()}${i}`, params?.status ?? 'PENDING')
    );

    console.log(`[JD] Synced ${mockOrders.length} orders`);

    return {
      orders: mockOrders,
      hasMore: false,
      nextCursor: undefined,
    };
  }

  /**
   * 确认接单
   * 真实接口：POST https://openapi.jddj.com/djapi/order/confirm
   *
   * @param platformOrderId 京东平台订单ID
   * @returns 是否成功
   */
  async confirmOrder(platformOrderId: string): Promise<boolean> {
    await this.ensureAuthenticated();
    console.log(`[JD] Confirming order: ${platformOrderId}`);
    return true;
  }

  /**
   * 开始配送
   * 真实接口：POST https://openapi.jddj.com/djapi/order/deliveryStart
   *
   * @param platformOrderId 京东平台订单ID
   * @param courierInfo 骑手信息（可选）
   * @returns 是否成功
   */
  async startDelivery(
    platformOrderId: string,
    courierInfo?: { name?: string; phone?: string; courierId?: string }
  ): Promise<boolean> {
    await this.ensureAuthenticated();
    console.log(`[JD] Starting delivery for order: ${platformOrderId}`, courierInfo);
    return true;
  }

  /**
   * 完成配送
   * 真实接口：POST https://openapi.jddj.com/djapi/order/deliveryComplete
   *
   * @param platformOrderId 京东平台订单ID
   * @returns 是否成功
   */
  async completeDelivery(platformOrderId: string): Promise<boolean> {
    await this.ensureAuthenticated();
    console.log(`[JD] Completing delivery for order: ${platformOrderId}`);
    return true;
  }

  /**
   * 取消订单
   * 真实接口：POST https://openapi.jddj.com/djapi/order/cancel
   *
   * @param platformOrderId 京东平台订单ID
   * @param reason 取消原因（可选）
   * @returns 是否成功
   */
  async cancelOrder(platformOrderId: string, reason?: string): Promise<boolean> {
    await this.ensureAuthenticated();
    console.log(`[JD] Cancelling order: ${platformOrderId}, reason: ${reason ?? 'N/A'}`);
    return true;
  }

  /**
   * 同步商品列表
   * 真实接口：POST https://openapi.jddj.com/djapi/product/queryList
   *
   * @param params 同步参数（分页游标等）
   * @returns 统一商品列表及分页信息
   */
  async syncProducts(params?: {
    cursor?: string;
    limit?: number;
  }): Promise<{
    products: UnifiedProduct[];
    hasMore: boolean;
    nextCursor?: string;
  }> {
    await this.ensureAuthenticated();

    const limit = params?.limit ?? 20;
    const mockProducts: UnifiedProduct[] = Array.from({ length: Math.min(limit, 2) }).map((_, i) => ({
      localSkuId: `local_sku_${i}`,
      platformSkuId: `jd_sku_${i}`,
      platformSpuId: `jd_spu_${i}`,
      name: `京东商品示例 ${i + 1}`,
      description: '京东秒送平台商品',
      categoryId: 'cat_001',
      categoryName: '酒类',
      price: 199 + i * 10,
      originalPrice: 299 + i * 10,
      stock: 100 - i * 10,
      unit: '瓶',
      spec: '500ml',
      images: ['https://example.com/jd_img.jpg'],
      status: 'ONLINE' as const,
      platform: 'JD' as PlatformType,
      storeId: this.credentials?.storeId ?? 'mock_store',
    }));

    console.log(`[JD] Synced ${mockProducts.length} products`);

    return {
      products: mockProducts,
      hasMore: false,
    };
  }

  /**
   * 更新库存
   * 真实接口：POST https://openapi.jddj.com/djapi/product/updateStock
   *
   * @param params 库存更新参数数组
   * @returns 库存更新结果数组
   */
  async updateInventory(params: UpdateInventoryParams[]): Promise<UpdateInventoryResult[]> {
    await this.ensureAuthenticated();

    console.log(`[JD] Updating inventory for ${params.length} items`);

    return params.map((p) => ({
      success: true,
      localSkuId: p.localSkuId,
      platformSkuId: p.platformSkuId,
      message: '库存更新成功',
    }));
  }

  /**
   * 验证京东 Webhook 推送签名
   * 真实逻辑：京东推送消息会携带 sign 和 timestamp，
   * 使用 app_secret 对 payload + timestamp 进行 MD5 签名比对。
   *
   * @param payload 推送消息体
   * @param signature 签名
   * @param timestamp 时间戳
   * @returns 验签结果
   */
  async verifyWebhook(
    payload: unknown,
    signature: string,
    timestamp?: string
  ): Promise<WebhookVerificationResult> {
    const appSecret = this.credentials?.appSecret ?? 'mock_app_secret';
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const ts = timestamp ?? Date.now().toString();

    const expectedSign = this.md5(`${payloadStr}${ts}${appSecret}`);
    const valid = expectedSign === signature;

    console.log(`[JD] Webhook verification: ${valid ? 'passed' : 'failed'}`);

    return {
      valid,
      platform: 'JD',
      eventType: (payload as Record<string, unknown>)?.eventType as string | undefined,
      payload: payload as Record<string, unknown> | undefined,
    };
  }

  /**
   * 京东 MD5 签名算法
   * 格式：MD5(app_key + timestamp + app_secret)
   *
   * @param params 待签名参数，需包含 app_key、timestamp、app_secret
   * @returns 签名字符串（32位小写MD5）
   */
  sign(params: Record<string, unknown>): string {
    const appKey = String(params.app_key ?? '');
    const timestamp = String(params.timestamp ?? '');
    const appSecret = String(params.app_secret ?? '');
    const raw = `${appKey}${timestamp}${appSecret}`;
    return this.md5(raw);
  }

  /** 构造模拟统一订单 */
  private createMockOrder(platformOrderId: string, status: PlatformOrderStatus): UnifiedOrder {
    const items: UnifiedOrderItem[] = [
      {
        localSkuId: 'sku_001',
        platformSkuId: 'jd_sku_001',
        name: '飞天茅台 53度 500ml',
        quantity: 1,
        unitPrice: 1499,
        totalPrice: 1499,
        spec: '500ml',
      },
    ];

    const address: UnifiedAddress = {
      name: '张三',
      phone: '13800138000',
      province: '北京市',
      city: '北京市',
      district: '朝阳区',
      detail: '建国路88号',
      latitude: 39.9042,
      longitude: 116.4074,
    };

    return {
      orderId: `local_${platformOrderId}`,
      platform: 'JD',
      platformOrderId,
      storeId: this.credentials?.storeId ?? 'mock_store',
      items,
      totalAmount: 1499,
      deliveryFee: 0,
      discountAmount: 0,
      payAmount: 1499,
      address,
      remark: '请尽快送达',
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      platformRawData: { source: 'jd_mock' },
    };
  }
}
