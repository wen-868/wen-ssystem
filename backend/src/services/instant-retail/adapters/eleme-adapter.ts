/**
 * 饿了么平台适配器
 * Ele.me (饿了么) Platform Adapter
 *
 * 真实 API 文档地址：https://open-api.shop.ele.me/
 * 饿了么开放平台提供订单推送、商品管理、库存同步、配送状态等接口。
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

export class ElemeAdapter extends AbstractPlatformAdapter {
  protected readonly platform: PlatformType = 'ELEME';

  /**
   * 饿了么 OAuth2.0 认证
   * 真实接口：POST https://open-api.shop.ele.me/token
   *
   * 流程：
   * 1. 使用 client_id (app_key) + client_secret (app_secret) 获取 access_token
   * 2. 支持 refresh_token 刷新机制
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

    const signStr = this.sign({ client_id: appKey, timestamp, client_secret: appSecret });

    console.log(`[ELEME] Authenticating with sign: ${signStr}`);

    const expireAt = new Date(Date.now() + 86400 * 1000);
    const creds: PlatformCredentials = {
      platform: 'ELEME',
      storeId,
      appKey,
      appSecret,
      merchantId,
      accessToken: `ele_mock_token_${timestamp}`,
      refreshToken: `ele_mock_refresh_${timestamp}`,
      tokenExpireAt: expireAt,
      enabled: true,
    };

    this.credentials = creds;
    return creds;
  }

  /**
   * 同步饿了么订单列表
   * 真实接口：POST https://open-api.shop.ele.me/order/query
   *
   * 饿了么订单状态映射：
   * - 待接单 -> PENDING
   * - 已接单/待配送 -> ACCEPTED
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
      this.createMockOrder(`EL${Date.now()}${i}`, params?.status ?? 'PENDING')
    );

    console.log(`[ELEME] Synced ${mockOrders.length} orders`);

    return {
      orders: mockOrders,
      hasMore: false,
      nextCursor: undefined,
    };
  }

  /**
   * 确认接单
   * 真实接口：POST https://open-api.shop.ele.me/order/confirm
   *
   * @param platformOrderId 饿了么平台订单ID
   * @returns 是否成功
   */
  async confirmOrder(platformOrderId: string): Promise<boolean> {
    await this.ensureAuthenticated();
    console.log(`[ELEME] Confirming order: ${platformOrderId}`);
    return true;
  }

  /**
   * 开始配送
   * 真实接口：POST https://open-api.shop.ele.me/order/delivery
   *
   * @param platformOrderId 饿了么平台订单ID
   * @param courierInfo 骑手信息（可选）
   * @returns 是否成功
   */
  async startDelivery(
    platformOrderId: string,
    courierInfo?: { name?: string; phone?: string; courierId?: string }
  ): Promise<boolean> {
    await this.ensureAuthenticated();
    console.log(`[ELEME] Starting delivery for order: ${platformOrderId}`, courierInfo);
    return true;
  }

  /**
   * 完成配送
   * 真实接口：POST https://open-api.shop.ele.me/order/complete
   *
   * @param platformOrderId 饿了么平台订单ID
   * @returns 是否成功
   */
  async completeDelivery(platformOrderId: string): Promise<boolean> {
    await this.ensureAuthenticated();
    console.log(`[ELEME] Completing delivery for order: ${platformOrderId}`);
    return true;
  }

  /**
   * 取消订单
   * 真实接口：POST https://open-api.shop.ele.me/order/cancel
   *
   * @param platformOrderId 饿了么平台订单ID
   * @param reason 取消原因（可选）
   * @returns 是否成功
   */
  async cancelOrder(platformOrderId: string, reason?: string): Promise<boolean> {
    await this.ensureAuthenticated();
    console.log(`[ELEME] Cancelling order: ${platformOrderId}, reason: ${reason ?? 'N/A'}`);
    return true;
  }

  /**
   * 同步商品列表
   * 真实接口：POST https://open-api.shop.ele.me/product/list
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
      platformSkuId: `ele_sku_${i}`,
      platformSpuId: `ele_spu_${i}`,
      name: `饿了么商品示例 ${i + 1}`,
      description: '饿了么平台商品',
      categoryId: 'cat_003',
      categoryName: '红酒',
      price: 159 + i * 15,
      originalPrice: 259 + i * 15,
      stock: 60 - i * 3,
      unit: '瓶',
      spec: '750ml',
      images: ['https://example.com/ele_img.jpg'],
      status: 'ONLINE' as const,
      platform: 'ELEME' as PlatformType,
      storeId: this.credentials?.storeId ?? 'mock_store',
    }));

    console.log(`[ELEME] Synced ${mockProducts.length} products`);

    return {
      products: mockProducts,
      hasMore: false,
    };
  }

  /**
   * 更新库存
   * 真实接口：POST https://open-api.shop.ele.me/product/stock
   *
   * @param params 库存更新参数数组
   * @returns 库存更新结果数组
   */
  async updateInventory(params: UpdateInventoryParams[]): Promise<UpdateInventoryResult[]> {
    await this.ensureAuthenticated();

    console.log(`[ELEME] Updating inventory for ${params.length} items`);

    return params.map((p) => ({
      success: true,
      localSkuId: p.localSkuId,
      platformSkuId: p.platformSkuId,
      message: '库存更新成功',
    }));
  }

  /**
   * 验证饿了么 Webhook 推送签名
   * 真实逻辑：饿了么推送消息会携带 signature 和 timestamp，
   * 使用 app_secret 对 HTTP Body + timestamp 进行 HMAC-SHA256 签名比对。
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

    const expectedSign = this.hmacSha256(`${payloadStr}${ts}`, appSecret);
    const valid = expectedSign === signature;

    console.log(`[ELEME] Webhook verification: ${valid ? 'passed' : 'failed'}`);

    return {
      valid,
      platform: 'ELEME',
      eventType: (payload as Record<string, unknown>)?.eventType as string | undefined,
      payload: payload as Record<string, unknown> | undefined,
    };
  }

  /**
   * 饿了么签名算法
   * 格式：HMAC-SHA256(排序后的参数键值对拼接字符串, app_secret)
   *
   * 真实流程：
   * 1. 将所有业务参数按 key 升序排序
   * 2. 拼接为 key1=value1&key2=value2 格式
   * 3. 使用 app_secret 作为密钥进行 HMAC-SHA256 计算
   * 4. 结果转为 Base64 或十六进制字符串
   *
   * @param params 待签名参数
   * @returns 签名字符串（Base64 编码的 HMAC-SHA256）
   */
  sign(params: Record<string, unknown>): string {
    const sortedKeys = Object.keys(params).sort();
    const pairs = sortedKeys.map((k) => `${k}=${String(params[k])}`);
    const raw = `${pairs.join('&')}`;
    const appSecret = String(params.client_secret ?? params.app_secret ?? 'mock_secret');
    return this.hmacSha256(raw, appSecret);
  }

  /** 构造模拟统一订单 */
  private createMockOrder(platformOrderId: string, status: PlatformOrderStatus): UnifiedOrder {
    const items: UnifiedOrderItem[] = [
      {
        localSkuId: 'sku_003',
        platformSkuId: 'ele_sku_003',
        name: '拉菲传奇波尔多 750ml',
        quantity: 1,
        unitPrice: 388,
        totalPrice: 388,
        spec: '750ml',
      },
    ];

    const address: UnifiedAddress = {
      name: '王五',
      phone: '13700137000',
      province: '广东省',
      city: '深圳市',
      district: '南山区',
      detail: '科技园南路88号',
      latitude: 22.5431,
      longitude: 113.946,
    };

    return {
      orderId: `local_${platformOrderId}`,
      platform: 'ELEME',
      platformOrderId,
      storeId: this.credentials?.storeId ?? 'mock_store',
      items,
      totalAmount: 388,
      deliveryFee: 3,
      discountAmount: 20,
      payAmount: 371,
      address,
      remark: '放门口即可',
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      platformRawData: { source: 'eleme_mock' },
    };
  }
}
