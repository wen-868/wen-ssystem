/**
* 美团即时零售平台适配器
* Meituan Instant Retail Platform Adapter
*
* 真实 API 文档地址：https://developer.meituan.com/home/doc?docType=retail
* 支持 OAuth 2.0 认证、订单同步、商品同步、库存更新、配送状态管理等。
*/

import { AbstractPlatformAdapter } from "../base-adapter";
import { platformCall, useMock } from "../http-client";
import logger from "../../../shared/logger";
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
  MeituanResponse,
} from "../types";

/** 美团开放平台 API 基础地址 */
const API_BASE = "https://waimaiopen.meituan.com/api/v1";

export class MeituanAdapter extends AbstractPlatformAdapter {
  protected readonly platform: PlatformType = "MEITUAN";

  /**
   * 美团 OAuth 2.0 认证
   * 真实接口：POST https://waimaiopen.meituan.com/api/v1/oauth/token
   *
   * 流程：
   * 1. 使用 app_key + app_secret 生成系统级签名
   * 2. 调用美团 OAuth 接口获取 access_token
   * 3. 返回包含 token 和过期时间的凭证
   */
  async authenticate(): Promise<PlatformCredentials> {
    const appKey = this.credentials?.appKey ?? "mock_app_key";
    const appSecret = this.credentials?.appSecret ?? "mock_app_secret";
    const storeId = this.credentials?.storeId ?? "mock_store_id";
    const merchantId = this.credentials?.merchantId ?? "mock_merchant_id";

    const timestamp = Math.floor(Date.now() / 1000);
    const signStr = this.sign({ app_key: appKey, timestamp, app_secret: appSecret });

    type MeituanAuthData = { access_token: string; refresh_token: string; expires_in: number };
    type MeituanAuthResponse = MeituanResponse<MeituanAuthData>;

    const result = await platformCall<MeituanAuthResponse>(
      "MEITUAN",
      `${API_BASE}/oauth/token`,
      {
        method: "POST",
        body: {
          app_key: appKey,
          timestamp,
          sign: signStr,
          grant_type: "client_credentials",
        },
      },
      async () => {
        throw new Error("[MEITUAN] Cannot refresh token: no credentials");
      },
      (async (): Promise<MeituanAuthResponse> => {
        logger.info("[MEITUAN] Mock authenticate");
        const expireAt = new Date(Date.now() + 7200 * 1000);
        const creds: PlatformCredentials = {
          platform: "MEITUAN",
          storeId,
          appKey,
          appSecret,
          merchantId,
          accessToken: `meituan_mock_token_${timestamp}`,
          refreshToken: `meituan_mock_refresh_${timestamp}`,
          tokenExpireAt: expireAt,
          enabled: true,
        };
        this.credentials = creds;
        return creds as unknown as MeituanAuthResponse;
      })
    );

    const token = useMock()
      ? this.credentials!
      : {
        platform: "MEITUAN" as const,
        storeId,
        appKey,
        appSecret,
        merchantId,
        accessToken: result.data.access_token,
        refreshToken: result.data.refresh_token,
        tokenExpireAt: new Date(Date.now() + result.data.expires_in * 1000),
        enabled: true,
      };

    this.credentials = token;
    return token;
  }

  /** 构造统一订单 */
  private mapToUnifiedOrder(raw: Record<string, unknown>, storeId: string): UnifiedOrder {
    const items: UnifiedOrderItem[] = ((raw.items as Record<string, unknown>[]) ?? []).map(
      (item: Record<string, unknown>) => ({
        localSkuId: (item.sku_id as string) ?? "",
        platformSkuId: (item.platform_sku_id as string) ?? "",
        name: (item.food_name as string) ?? (item.product_name as string) ?? "",
        quantity: (item.quantity as number) ?? 1,
        unitPrice: (item.price as number) ?? 0,
        totalPrice: ((item.quantity as number) ?? 1) * ((item.price as number) ?? 0),
        spec: (item.spec as string) ?? undefined,
      })
    );

    const address: UnifiedAddress = {
      name: (raw.recipient_name as string) ?? "",
      phone: (raw.recipient_phone as string) ?? "",
      province: (raw.recipient_province as string) ?? "",
      city: (raw.recipient_city as string) ?? "",
      district: (raw.recipient_district as string) ?? "",
      detail: (raw.recipient_address as string) ?? "",
      latitude: raw.latitude as number | undefined,
      longitude: raw.longitude as number | undefined,
    };

    const statusMap: Record<string, PlatformOrderStatus> = {
      pending: "PENDING",
      accepted: "ACCEPTED",
      delivering: "DELIVERING",
      completed: "COMPLETED",
      cancelled: "CANCELLED",
    };

    return {
      orderId: `local_${raw.order_id as string}`,
      platform: "MEITUAN",
      platformOrderId: raw.order_id as string,
      storeId,
      items,
      totalAmount: (raw.total as number) ?? 0,
      deliveryFee: (raw.delivery_fee as number) ?? 0,
      discountAmount: (raw.discount as number) ?? 0,
      payAmount: (raw.pay_amount as number) ?? 0,
      address,
      remark: (raw.remark as string) ?? undefined,
      status: statusMap[raw.status as string] ?? "PENDING",
      createdAt: new Date((raw.created_at as number) ?? Date.now()),
      updatedAt: new Date((raw.updated_at as number) ?? Date.now()),
      platformRawData: raw,
    };
  }

  /** 构造统一商品 */
  private mapToUnifiedProduct(raw: Record<string, unknown>, storeId: string): UnifiedProduct {
    return {
      localSkuId: (raw.sku_id as string) ?? "",
      platformSkuId: (raw.platform_sku_id as string) ?? "",
      platformSpuId: (raw.spu_id as string) ?? "",
      name: (raw.name as string) ?? "",
      description: (raw.description as string) ?? undefined,
      categoryId: (raw.category_id as string) ?? undefined,
      categoryName: (raw.category_name as string) ?? undefined,
      price: (raw.price as number) ?? 0,
      originalPrice: (raw.original_price as number) ?? undefined,
      stock: (raw.stock as number) ?? 0,
      unit: (raw.unit as string) ?? undefined,
      spec: (raw.spec as string) ?? undefined,
      images: (raw.images as string[]) ?? [],
      status: ((raw.status as string) === "OFFLINE" ? "OFFLINE" : (raw.stock as number) <= 0 ? "SOLD_OUT" : "ONLINE") as "ONLINE" | "OFFLINE" | "SOLD_OUT",
      platform: "MEITUAN" as PlatformType,
      storeId,
    };
  }

  async syncOrders(params?: {
    startTime?: string | Date;
    endTime?: string | Date;
    status?: PlatformOrderStatus;
    cursor?: string;
    limit?: number;
  }): Promise<SyncOrdersResult> {
    await this.ensureAuthenticated();

    const storeId = this.credentials?.storeId ?? "mock_store";
    const limit = params?.limit ?? 20;
    const startTime = params?.startTime ? new Date(params.startTime).getTime() : undefined;
    const endTime = params?.endTime ? new Date(params.endTime).getTime() : undefined;

    const statusMap: Record<string, number> = {
      PENDING: 1,
      ACCEPTED: 2,
      DELIVERING: 3,
      COMPLETED: 4,
      CANCELLED: 5,
    };

    type MeituanOrderListData = { order_list: Record<string, unknown>[]; has_more: boolean; next_cursor: string };
    type MeituanOrderListResponse = MeituanResponse<MeituanOrderListData>;

    const result = await platformCall<MeituanOrderListResponse>(
      "MEITUAN",
      `${API_BASE}/order/queryByPage`,
      {
        method: "POST",
        body: {
          app_poi_code: storeId,
          start_time: startTime,
          end_time: endTime,
          order_status: params?.status ? statusMap[params.status] : undefined,
          offset: params?.cursor ? Number(params.cursor) : 0,
          limit,
        },
      },
      () => this.authenticate(),
      (async (): Promise<MeituanOrderListResponse> => {
        const mockOrders: UnifiedOrder[] = Array.from({ length: Math.min(limit, 3) }).map((_, i) =>
          this.createMockOrder(`MT${Date.now()}${i}`, params?.status ?? "PENDING")
        );
        logger.info(`[MEITUAN] Mock synced ${mockOrders.length} orders`);
        return { orders: mockOrders, hasMore: false, nextCursor: undefined } as unknown as MeituanOrderListResponse;
      })
    );

    if (useMock()) {
      return result as unknown as SyncOrdersResult;
    }

    const orders = result.data.order_list.map((o: Record<string, unknown>) => this.mapToUnifiedOrder(o, storeId));
    logger.info(`[MEITUAN] Synced ${orders.length} orders`);

    return {
      orders,
      hasMore: result.data.has_more,
      nextCursor: result.data.next_cursor ?? undefined,
    };
  }

  async confirmOrder(platformOrderId: string): Promise<boolean> {
    await this.ensureAuthenticated();

    return platformCall<MeituanResponse<{ success: boolean }>>(
      "MEITUAN",
      `${API_BASE}/order/confirm`,
      {
        method: "POST",
        body: {
          app_poi_code: this.credentials?.storeId,
          order_id: platformOrderId,
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[MEITUAN] Mock confirm order: ${platformOrderId}`);
        return { data: { success: true } };
      }
    ).then((r) => r.data?.success ?? true);
  }

  async startDelivery(platformOrderId: string, courierInfo?: { deliveryCompany?: string; deliveryNo?: string; deliveryMan?: string; deliveryPhone?: string }): Promise<boolean> {
    await this.ensureAuthenticated();

    return platformCall<MeituanResponse<{ success: boolean }>>(
      "MEITUAN",
      `${API_BASE}/order/delivering`,
      {
        method: "POST",
        body: {
          app_poi_code: this.credentials?.storeId,
          order_id: platformOrderId,
          courier_name: courierInfo?.deliveryMan,
          courier_phone: courierInfo?.deliveryPhone,
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[MEITUAN] Mock start delivery: ${platformOrderId}`);
        return { data: { success: true } };
      }
    ).then((r) => r.data?.success ?? true);
  }

  async completeDelivery(platformOrderId: string): Promise<boolean> {
    await this.ensureAuthenticated();

    return platformCall<MeituanResponse<{ success: boolean }>>(
      "MEITUAN",
      `${API_BASE}/order/complete`,
      {
        method: "POST",
        body: {
          app_poi_code: this.credentials?.storeId,
          order_id: platformOrderId,
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[MEITUAN] Mock complete delivery: ${platformOrderId}`);
        return { data: { success: true } };
      }
    ).then((r) => r.data?.success ?? true);
  }

  async cancelOrder(platformOrderId: string, reason?: string): Promise<boolean> {
    await this.ensureAuthenticated();

    return platformCall<MeituanResponse<{ success: boolean }>>(
      "MEITUAN",
      `${API_BASE}/order/cancel`,
      {
        method: "POST",
        body: {
          app_poi_code: this.credentials?.storeId,
          order_id: platformOrderId,
          cancel_reason: reason,
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[MEITUAN] Mock cancel order: ${platformOrderId}, reason: ${reason ?? "N/A"}`);
        return { data: { success: true } };
      }
    ).then((r) => r.data?.success ?? true);
  }

  async syncProducts(params?: { cursor?: string; limit?: number }): Promise<{
    products: UnifiedProduct[];
    hasMore: boolean;
    nextCursor?: string;
  }> {
    await this.ensureAuthenticated();

    const storeId = this.credentials?.storeId ?? "mock_store";
    const limit = params?.limit ?? 20;

    type MeituanProductListData = { product_list: Record<string, unknown>[]; has_more: boolean; next_cursor: string };
    type MeituanProductListResponse = MeituanResponse<MeituanProductListData>;

    const result = await platformCall<MeituanProductListResponse>(
      "MEITUAN",
      `${API_BASE}/food/queryList`,
      {
        method: "POST",
        body: {
          app_poi_code: storeId,
          offset: params?.cursor ? Number(params.cursor) : 0,
          limit,
        },
      },
      () => this.authenticate(),
      (async (): Promise<MeituanProductListResponse> => {
        const mockProducts: UnifiedProduct[] = Array.from({ length: Math.min(limit, 2) }).map((_, i) => ({
          localSkuId: `local_sku_${i}`,
          platformSkuId: `meituan_sku_${i}`,
          platformSpuId: `meituan_spu_${i}`,
          name: `美团商品示例 ${i + 1}`,
          description: "美团即时零售平台商品",
          categoryId: "cat_001",
          categoryName: "酒类",
          price: 199 + i * 10,
          originalPrice: 299 + i * 10,
          stock: 100 - i * 10,
          unit: "瓶",
          spec: "500ml",
          images: ["https://example.com/mt_img.jpg"],
          status: "ONLINE" as const,
          platform: "MEITUAN" as PlatformType,
          storeId,
        }));
        logger.info(`[MEITUAN] Mock synced ${mockProducts.length} products`);
        return { products: mockProducts, hasMore: false, nextCursor: undefined } as unknown as MeituanProductListResponse;
      })
    );

    if (useMock()) {
      return result as unknown as { products: UnifiedProduct[]; hasMore: boolean; nextCursor?: string };
    }

    const products = result.data.product_list.map((p: Record<string, unknown>) => this.mapToUnifiedProduct(p, storeId));
    logger.info(`[MEITUAN] Synced ${products.length} products`);

    return {
      products,
      hasMore: result.data.has_more,
      nextCursor: result.data.next_cursor ?? undefined,
    };
  }

  async updateInventory(params: UpdateInventoryParams[]): Promise<UpdateInventoryResult[]> {
    await this.ensureAuthenticated();

    const storeId = this.credentials?.storeId ?? "mock_store";

    return platformCall<MeituanResponse<{ results: UpdateInventoryResult[] }>>(
      "MEITUAN",
      `${API_BASE}/food/updateStock`,
      {
        method: "POST",
        body: {
          app_poi_code: storeId,
          food_data: params.map((p) => ({
            app_food_code: p.platformSkuId,
            sku_id: p.localSkuId,
            stock: p.stock,
          })),
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[MEITUAN] Mock updating inventory for ${params.length} items`);
        return {
          data: {
            results: params.map((p) => ({
              success: true,
              localSkuId: p.localSkuId,
              platformSkuId: p.platformSkuId,
              message: "库存更新成功",
            })),
          },
        };
      }
    ).then((r) => r.data?.results ?? params.map((p) => ({ success: false, localSkuId: p.localSkuId, platformSkuId: p.platformSkuId, message: "更新失败" })));
  }

  async verifyWebhook(payload: unknown, signature: string, timestamp?: string): Promise<WebhookVerificationResult> {
    const appSecret = this.credentials?.appSecret ?? "mock_app_secret";
    const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    const ts = timestamp ?? String(Math.floor(Date.now() / 1000));

    const expectedSign = this.sign({ payload: payloadStr, timestamp: ts, app_secret: appSecret });
    const valid = expectedSign === signature;

    logger.info(`[MEITUAN] Webhook verification: ${valid ? "passed" : "failed"}`);

    return {
      valid,
      platform: "MEITUAN",
      eventType: (payload as Record<string, unknown>)?.event_type as string | undefined,
      payload: payload as Record<string, unknown> | undefined,
    };
  }

  /**
   * 美团签名算法
   * 格式：SHA1(app_key + timestamp + app_secret) 或 MD5 取决于平台配置
   */
  sign(params: Record<string, unknown>): string {
    const appKey = String(params.app_key ?? "");
    const timestamp = String(params.timestamp ?? "");
    const appSecret = String(params.app_secret ?? "");
    const raw = `${appKey}${timestamp}${appSecret}`;
    return this.md5(raw);
  }

  private createMockOrder(platformOrderId: string, status: PlatformOrderStatus): UnifiedOrder {
    return {
      orderId: `local_${platformOrderId}`,
      platform: "MEITUAN",
      platformOrderId,
      storeId: this.credentials?.storeId ?? "mock_store",
      items: [
        {
          localSkuId: "sku_001",
          platformSkuId: "meituan_sku_001",
          name: "国窖1573 52度 500ml",
          quantity: 1,
          unitPrice: 899,
          totalPrice: 899,
          spec: "500ml",
        },
      ],
      totalAmount: 899,
      deliveryFee: 5,
      discountAmount: 0,
      payAmount: 904,
      address: {
        name: "李四",
        phone: "13900139000",
        province: "上海市",
        city: "上海市",
        district: "浦东新区",
        detail: "陆家嘴金融中心",
        latitude: 31.2304,
        longitude: 121.4737,
      },
      remark: "请尽快送达",
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      platformRawData: { source: "meituan_mock" },
    };
  }
}