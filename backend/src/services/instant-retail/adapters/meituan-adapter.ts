/**
 * 美团平台适配器
 * Meituan Platform Adapter
 *
 * 真实 API 文档地址：https://developer.meituan.com/
 * 美团开放平台提供外卖/闪购订单推送、商品管理、库存同步、配送状态等接口。
 * 注意：美团主要采用推送模式，但本适配器也模拟主动查询能力用于兜底同步。
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

export class MeituanAdapter extends AbstractPlatformAdapter {
  protected readonly platform: PlatformType = 'MEITUAN';

  /**
   * 美团 OAuth2.0 认证
   * 真实接口：POST https://openapi.waimai.meituan.com/oauth/token
   *
   * 流程：
   * 1. 使用 app_id + app_secret 获取 access_token
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

    const signStr = this.sign({ app_id: appKey, timestamp, app_secret: appSecret });

    console.log(`[MEITUAN] Authenticating with sign: ${signStr}`);

    const expireAt = new Date(Date.now() + 86400 * 1000);
    const creds: PlatformCredentials = {
      platform: 'MEITUAN',
      storeId,
      appKey,
      appSecret,
      merchantId,
      accessToken: `mt_mock_token_${timestamp}`,
      refreshToken: `mt_mock_refresh_${timestamp}`,
      tokenExpireAt: expireAt,
      enabled: true,
    };

    this.credentials = creds;
    return creds;
  }

  /**
   * 同步美团订单列表（主动查询模式）
   * 真实接口：POST https://openapi.waimai.meituan.com/api/order/queryByPage
   *
   * 说明：美团主要采用订单推送模式，本接口用于兜底同步或历史订单查询。
   * 美团订单状态映射：
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
      this.createMockOrder(`MT${Date.now()}${i}`, params?.status ?? 'PENDING')
    );

    console.log(`[MEITUAN] Synced ${mockOrders.length} orders (pull mode)`);

    return {
      orders: mockOrders,
      hasMore: false,
      nextCursor: undefined,
    };
  }

  /**
   * 确认接单
   * 真实接口：POST https://openapi.waimai.meituan.com/api/order/confirm
   *
   * @param platformOrderId 美团平台订单ID
   * @returns 是否成功
   */
  async confirmOrder(platformOrderId: string): Promise<boolean> {
    await this.ensureAuthenticated();
    console.log(`[MEITUAN] Confirming order: ${platformOrderId}`);
    return true;
  }

  /**
   * 开始配送
   * 真实接口：POST https://openapi.waimai.meituan.com/api/order/delivering
   *
   * @param platformOrderId 美团平台订单ID
   * @param courierInfo 骑手信息（可选）
   * @returns 是否成功
   */
  async startDelivery(
    platformOrderId: string,
    courierInfo?: { name?: string; phone?: string; courierId?: string }
  ): Promise<boolean> {
    await this.ensureAuthenticated();
    console.log(`[MEITUAN] Starting delivery for order: ${platformOrderId}`, courierInfo);
    return true;
  }

  /**
   * 完成配送
   * 真实接口：POST https://openapi.waimai.meituan.com/api/order/arrived
   *
   * @param platformOrderId 美团平台订单ID
   * @returns 是否成功
   */
  async completeDelivery(platformOrderId: string): Promise<boolean> {
    await this.ensureAuthenticated();
    console.log(`[MEITUAN] Completing delivery for order: ${platformOrderId}`);
    return true;
  }

  /**
   * 取消订单
   * 真实接口：POST https://openapi.waimai.meituan.com/api/order/cancel
   *
   * @param platformOrderId 美团平台订单ID
   * @param reason 取消原因（可选）
   * @returns 是否成功
   */
  async cancelOrder(platformOrderId: string, reason?: string): Promise<boolean> {
    await this.ensureAuthenticated();
    console.log(`[MEITUAN] Cancelling order: ${platformOrderId}, reason: ${reason ?? 'N/A'}`);
    return true;
  }

  /**
   * 同步商品列表
   * 真实接口：POST https://openapi.waimai.meituan.com/api/food/list
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
      platformSkuId: `mt_sku_${i}`,
      platformSpuId: `mt_spu_${i}`,
      name: `美团商品示例 ${i + 1}`,
      description: '美团外卖/闪购平台商品',
      categoryId: 'cat_002',
      categoryName: '白酒',
      price: 299 + i * 20,
      originalPrice: 399 + i * 20,
      stock: 80 - i * 5,
      unit: '瓶',
      spec: '500ml',
      images: ['https://example.com/mt_img.jpg'],
      status: 'ONLINE' as const,
      platform: 'MEITUAN' as PlatformType,
      storeId: this.credentials?.storeId ?? 'mock_store',
    }));

    console.log(`[MEITUAN] Synced ${mockProducts.length} products`);

    return {
      products: mockProducts,
      hasMore: false,
    };
  }

  /**
   * 更新库存
   * 真实接口：POST https://openapi.waimai.meituan.com/api/food/skuStock
   *
   * @param params 库存更新参数数组
   * @returns 库存更新结果数组
   */
  async updateInventory(params: UpdateInventoryParams[]): Promise<UpdateInventoryResult[]> {
    await this.ensureAuthenticated();

    console.log(`[MEITUAN] Updating inventory for ${params.length} items`);

    return params.map((p) => ({
      success: true,
      localSkuId: p.localSkuId,
      platformSkuId: p.platformSkuId,
      message: '库存更新成功',
    }));
  }

  /**
   * 验证美团 Webhook 推送签名
   * 真实逻辑：美团推送消息会携带 sig 参数，
   * 使用 app_secret 对排序后的参数键值对拼接字符串进行 SHA1 签名比对。
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

    console.log(`[MEITUAN] Webhook verification: ${valid ? 'passed' : 'failed'}`);

    return {
      valid,
      platform: 'MEITUAN',
      eventType: (payload as Record<string, unknown>)?.eventType as string | undefined,
      payload: payload as Record<string, unknown> | undefined,
    };
  }

  /**
   * 美团签名算法
   * 格式：SHA1(排序后的参数键值对拼接字符串 + app_secret)
   *
   * 真实流程：
   * 1. 将所有业务参数按 key 升序排序
   * 2. 拼接为 key1=value1&key2=value2 格式
   * 3. 末尾追加 app_secret
   * 4. 对整体字符串进行 SHA1 哈希
   *
   * @param params 待签名参数
   * @returns 签名字符串（40位小写SHA1）
   */
  sign(params: Record<string, unknown>): string {
    const sortedKeys = Object.keys(params).sort();
    const pairs = sortedKeys.map((k) => `${k}=${String(params[k])}`);
    const raw = `${pairs.join('&')}`;
    return this.sha1(raw);
  }

  /** 通用 SHA1 签名辅助方法 */
  private sha1(input: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha1').update(input).digest('hex').toLowerCase();
  }

  /** 构造模拟统一订单 */
  private createMockOrder(platformOrderId: string, status: PlatformOrderStatus): UnifiedOrder {
    const items: UnifiedOrderItem[] = [
      {
        localSkuId: 'sku_002',
        platformSkuId: 'mt_sku_002',
        name: '五粮液 52度 500ml',
        quantity: 2,
        unitPrice: 1099,
        totalPrice: 2198,
        spec: '500ml',
      },
    ];

    const address: UnifiedAddress = {
      name: '李四',
      phone: '13900139000',
      province: '上海市',
      city: '上海市',
      district: '浦东新区',
      detail: '陆家嘴环路1000号',
      latitude: 31.2304,
      longitude: 121.4737,
    };

    return {
      orderId: `local_${platformOrderId}`,
      platform: 'MEITUAN',
      platformOrderId,
      storeId: this.credentials?.storeId ?? 'mock_store',
      items,
      totalAmount: 2198,
      deliveryFee: 5,
      discountAmount: 10,
      payAmount: 2193,
      address,
      remark: '请送上楼',
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      platformRawData: { source: 'meituan_mock' },
    };
  }
}
