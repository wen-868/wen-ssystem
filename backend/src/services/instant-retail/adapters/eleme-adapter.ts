/**
 * 饿了么即时零售平台适配器
 * Eleme Instant Retail Platform Adapter
 *
 * 真实 API 文档地址：https://open.shop.ele.me/openapi/documents
 * 支持 OAuth 2.0 认证、订单同步、商品同步、库存更新、配送状态管理等。
 */

import { AbstractPlatformAdapter } from "../base-adapter.js";
import { platformCall, useMock } from "../http-client.js";
import logger from "../../../shared/logger.js";
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
} from "../types.js";

/** 饿了么开放平台 API 基础地址 */
const API_BASE = "https://open-api.shop.ele.me";

export class ElemeAdapter extends AbstractPlatformAdapter {
  protected readonly platform: PlatformType = "ELEME";

  /**
   * 饿了么 OAuth 2.0 认证
   * 真实接口：POST https://open-api.shop.ele.me/oauth/token
   *
   * 流程：
   * 1. 使用 app_key + app_secret 生成签名
   * 2. 调用饿了么 OAuth 接口获取 access_token
   * 3. 返回包含 token 和过期时间的凭证
   */
  async authenticate(): Promise<PlatformCredentials> {
    const appKey = this.credentials?.appKey ?? "mock_app_key";
    const appSecret = this.credentials?.appSecret ?? "mock_app_secret";
    const storeId = this.credentials?.storeId ?? "mock_store_id";
    const merchantId = this.credentials?.merchantId ?? "mock_merchant_id";

    const timestamp = Math.floor(Date.now() / 1000);
    const signStr = this.sign({ app_key: appKey, timestamp, app_secret: appSecret });

    const result = await platformCall<{
      body: { access_token: string; refresh_token: string; expires_in: number };
    }>(
      "ELEME",
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
        throw new Error("[ELEME] Cannot refresh token: no credentials");
      },
      (async () => {
        logger.info("[ELEME] Mock authenticate");
        const expireAt = new Date(Date.now() + 7200 * 1000);
        const creds: PlatformCredentials = {
          platform: "ELEME",
          storeId,
          appKey,
          appSecret,
          merchantId,
          accessToken: `eleme_mock_token_${timestamp}`,
          refreshToken: `eleme_mock_refresh_${timestamp}`,
          tokenExpireAt: expireAt,
          enabled: true,
        };
        this.credentials = creds;
        return creds;
      }) as any
    );

    const token = useMock()
      ? this.credentials!
      : {
          platform: "ELEME" as const,
          storeId,
          appKey,
          appSecret,
          merchantId,
          accessToken: result.body.access_token,
          refreshToken: result.body.refresh_token,
          tokenExpireAt: new Date(Date.now() + result.body.expires_in * 1000),
          enabled: true,
        };

    this.credentials = token;
    return token;
  }

  private mapToUnifiedOrder(raw: Record<string, unknown>, storeId: string): UnifiedOrder {
    const items: UnifiedOrderItem[] = ((raw.goodsList as Record<string, unknown>[]) ?? []).map(
      (item: Record<string, unknown>) => ({
        localSkuId: (item.skuId as string) ?? "",
        platformSkuId: (item.goodsId as string) ?? "",
        name: (item.goodsName as string) ?? "",
        quantity: (item.amount as number) ?? 1,
        unitPrice: (item.price as number) ?? 0,
        totalPrice: ((item.amount as number) ?? 1) * ((item.price as number) ?? 0),
        spec: (item.spec as string) ?? undefined,
      })
    );

    const address: UnifiedAddress = {
      name: (raw.consignee as string) ?? "",
      phone: (raw.mobile as string) ?? "",
      province: (raw.provinceName as string) ?? "",
      city: (raw.cityName as string) ?? "",
      district: (raw.districtName as string) ?? "",
      detail: (raw.address as string) ?? "",
      latitude: raw.latitude as number | undefined,
      longitude: raw.longitude as number | undefined,
    };

    const statusMap: Record<string, PlatformOrderStatus> = {
      pending: "PENDING",
      accepted: "ACCEPTED",
      delivering: "DELIVERING",
      completed: "COMPLETED",
      cancelled: "CANCELLED",
      refunding: "REFUNDING",
    };

    return {
      orderId: `local_${raw.orderId as string}`,
      platform: "ELEME",
      platformOrderId: raw.orderId as string,
      storeId,
      items,
      totalAmount: (raw.totalPrice as number) ?? 0,
      deliveryFee: (raw.deliverFee as number) ?? 0,
      discountAmount: (raw.discountAmount as number) ?? 0,
      payAmount: (raw.payAmount as number) ?? 0,
      address,
      remark: (raw.description as string) ?? undefined,
      status: statusMap[raw.orderStatus as string] ?? "PENDING",
      createdAt: new Date((raw.createdAt as number) ?? Date.now()),
      updatedAt: new Date((raw.updatedAt as number) ?? Date.now()),
      platformRawData: raw,
    };
  }

  private mapToUnifiedProduct(raw: Record<string, unknown>, storeId: string): UnifiedProduct {
    return {
      localSkuId: (raw.skuId as string) ?? "",
      platformSkuId: (raw.itemId as string) ?? "",
      platformSpuId: (raw.spuId as string) ?? "",
      name: (raw.name as string) ?? "",
      description: (raw.description as string) ?? undefined,
      categoryId: (raw.categoryId as string) ?? undefined,
      categoryName: (raw.categoryName as string) ?? undefined,
      price: (raw.price as number) ?? 0,
      originalPrice: (raw.originalPrice as number) ?? undefined,
      stock: (raw.stock as number) ?? 0,
      unit: (raw.unit as string) ?? undefined,
      spec: (raw.spec as string) ?? undefined,
      images: (raw.images as string[]) ?? [],
      status: ((raw.status as string) === "OFFLINE" ? "OFFLINE" : (raw.stock as number) <= 0 ? "SOLD_OUT" : "ONLINE") as "ONLINE" | "OFFLINE" | "SOLD_OUT",
      platform: "ELEME" as PlatformType,
      storeId,
    };
  }

  async syncOrders(params?: {
    startTime?: Date;
    endTime?: Date;
    status?: PlatformOrderStatus;
    cursor?: string;
    limit?: number;
  }): Promise<SyncOrdersResult> {
    await this.ensureAuthenticated();

    const storeId = this.credentials?.storeId ?? "mock_store";
    const limit = params?.limit ?? 20;

    const statusMap: Record<string, string> = {
      PENDING: "pending",
      ACCEPTED: "accepted",
      DELIVERING: "delivering",
      COMPLETED: "completed",
      CANCELLED: "cancelled",
    };

    const result = await platformCall<{
      body: { dataList: Record<string, unknown>[]; pageSize: number; currentPage: number; totalCount: number };
    }>(
      "ELEME",
      `${API_BASE}/order/query`,
      {
        method: "POST",
        body: {
          shopId: storeId,
          startTime: params?.startTime?.toISOString(),
          endTime: params?.endTime?.toISOString(),
          orderStatus: params?.status ? statusMap[params.status] : undefined,
          pageNo: params?.cursor ? Number(params.cursor) : 1,
          pageSize: limit,
        },
      },
      () => this.authenticate(),
      (async () => {
        const mockOrders: UnifiedOrder[] = Array.from({ length: Math.min(limit, 3) }).map((_, i) =>
          this.createMockOrder(`ELM${Date.now()}${i}`, params?.status ?? "PENDING")
        );
        logger.info(`[ELEME] Mock synced ${mockOrders.length} orders`);
        return { orders: mockOrders, hasMore: false, nextCursor: undefined };
      }) as any
    );

    if (useMock()) {
      return result as unknown as SyncOrdersResult;
    }

    const orders = result.body.dataList.map((o: Record<string, unknown>) => this.mapToUnifiedOrder(o, storeId));
    const hasMore = result.body.currentPage * result.body.pageSize < result.body.totalCount;

    logger.info(`[ELEME] Synced ${orders.length} orders`);

    return {
      orders,
      hasMore,
      nextCursor: hasMore ? String(result.body.currentPage + 1) : undefined,
    };
  }

  async confirmOrder(platformOrderId: string): Promise<boolean> {
    await this.ensureAuthenticated();

    return platformCall<{ body: { success: boolean } }>(
      "ELEME",
      `${API_BASE}/order/confirm`,
      {
        method: "POST",
        body: {
          shopId: this.credentials?.storeId,
          orderId: platformOrderId,
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[ELEME] Mock confirm order: ${platformOrderId}`);
        return { body: { success: true } };
      }
    ).then((r: any) => r.body?.success ?? true);
  }

  async startDelivery(platformOrderId: string, courierInfo?: { name?: string; phone?: string; courierId?: string }): Promise<boolean> {
    await this.ensureAuthenticated();

    return platformCall<{ body: { success: boolean } }>(
      "ELEME",
      `${API_BASE}/order/deliveryStart`,
      {
        method: "POST",
        body: {
          shopId: this.credentials?.storeId,
          orderId: platformOrderId,
          courierName: courierInfo?.name,
          courierPhone: courierInfo?.phone,
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[ELEME] Mock start delivery: ${platformOrderId}`);
        return { body: { success: true } };
      }
    ).then((r: any) => r.body?.success ?? true);
  }

  async completeDelivery(platformOrderId: string): Promise<boolean> {
    await this.ensureAuthenticated();

    return platformCall<{ body: { success: boolean } }>(
      "ELEME",
      `${API_BASE}/order/complete`,
      {
        method: "POST",
        body: {
          shopId: this.credentials?.storeId,
          orderId: platformOrderId,
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[ELEME] Mock complete delivery: ${platformOrderId}`);
        return { body: { success: true } };
      }
    ).then((r: any) => r.body?.success ?? true);
  }

  async cancelOrder(platformOrderId: string, reason?: string): Promise<boolean> {
    await this.ensureAuthenticated();

    return platformCall<{ body: { success: boolean } }>(
      "ELEME",
      `${API_BASE}/order/cancel`,
      {
        method: "POST",
        body: {
          shopId: this.credentials?.storeId,
          orderId: platformOrderId,
          cancelReason: reason,
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[ELEME] Mock cancel order: ${platformOrderId}, reason: ${reason ?? "N/A"}`);
        return { body: { success: true } };
      }
    ).then((r: any) => r.body?.success ?? true);
  }

  async syncProducts(params?: { cursor?: string; limit?: number }): Promise<{
    products: UnifiedProduct[];
    hasMore: boolean;
    nextCursor?: string;
  }> {
    await this.ensureAuthenticated();

    const storeId = this.credentials?.storeId ?? "mock_store";
    const limit = params?.limit ?? 20;

    const result = await platformCall<{
      body: { dataList: Record<string, unknown>[]; pageSize: number; currentPage: number; totalCount: number };
    }>(
      "ELEME",
      `${API_BASE}/item/query`,
      {
        method: "POST",
        body: {
          shopId: storeId,
          pageNo: params?.cursor ? Number(params.cursor) : 1,
          pageSize: limit,
        },
      },
      () => this.authenticate(),
      (async () => {
        const mockProducts: UnifiedProduct[] = Array.from({ length: Math.min(limit, 2) }).map((_, i) => ({
          localSkuId: `local_sku_${i}`,
          platformSkuId: `eleme_sku_${i}`,
          platformSpuId: `eleme_spu_${i}`,
          name: `饿了么商品示例 ${i + 1}`,
          description: "饿了么即时零售平台商品",
          categoryId: "cat_001",
          categoryName: "酒类",
          price: 199 + i * 10,
          originalPrice: 299 + i * 10,
          stock: 100 - i * 10,
          unit: "瓶",
          spec: "500ml",
          images: ["https://example.com/eleme_img.jpg"],
          status: "ONLINE" as const,
          platform: "ELEME" as PlatformType,
          storeId,
        }));
        logger.info(`[ELEME] Mock synced ${mockProducts.length} products`);
        return { products: mockProducts, hasMore: false, nextCursor: undefined };
      }) as any
    );

    if (useMock()) {
      return result as unknown as { products: UnifiedProduct[]; hasMore: boolean; nextCursor?: string };
    }

    const products = result.body.dataList.map((p: Record<string, unknown>) => this.mapToUnifiedProduct(p, storeId));
    const hasMore = result.body.currentPage * result.body.pageSize < result.body.totalCount;

    logger.info(`[ELEME] Synced ${products.length} products`);

    return {
      products,
      hasMore,
      nextCursor: hasMore ? String(result.body.currentPage + 1) : undefined,
    };
  }

  async updateInventory(params: UpdateInventoryParams[]): Promise<UpdateInventoryResult[]> {
    await this.ensureAuthenticated();

    const storeId = this.credentials?.storeId ?? "mock_store";

    return platformCall<{
      body: { results: UpdateInventoryResult[] };
    }>(
      "ELEME",
      `${API_BASE}/item/updateStock`,
      {
        method: "POST",
        body: {
          shopId: storeId,
          stockList: params.map((p) => ({
            itemId: p.platformSkuId,
            skuId: p.localSkuId,
            stock: p.stock,
          })),
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[ELEME] Mock updating inventory for ${params.length} items`);
        return {
          body: {
            results: params.map((p) => ({
              success: true,
              localSkuId: p.localSkuId,
              platformSkuId: p.platformSkuId,
              message: "库存更新成功",
            })),
          },
        };
      }
    ).then((r: any) => r.body?.results ?? params.map((p: any) => ({ success: false, localSkuId: p.localSkuId, platformSkuId: p.platformSkuId, message: "更新失败" })));
  }

  async verifyWebhook(payload: unknown, signature: string, timestamp?: string): Promise<WebhookVerificationResult> {
    const appSecret = this.credentials?.appSecret ?? "mock_app_secret";
    const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    const ts = timestamp ?? String(Math.floor(Date.now() / 1000));

    const expectedSign = this.hmacSha256(`${payloadStr}${ts}`, appSecret);
    const valid = expectedSign === signature;

    logger.info(`[ELEME] Webhook verification: ${valid ? "passed" : "failed"}`);

    return {
      valid,
      platform: "ELEME",
      eventType: (payload as Record<string, unknown>)?.eventType as string | undefined,
      payload: payload as Record<string, unknown> | undefined,
    };
  }

  /**
   * 饿了么签名算法
   * 格式：MD5(app_key + timestamp + app_secret)
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
      platform: "ELEME",
      platformOrderId,
      storeId: this.credentials?.storeId ?? "mock_store",
      items: [
        {
          localSkuId: "sku_002",
          platformSkuId: "eleme_sku_002",
          name: "五粮液 52度 500ml",
          quantity: 1,
          unitPrice: 1099,
          totalPrice: 1099,
          spec: "500ml",
        },
      ],
      totalAmount: 1099,
      deliveryFee: 3,
      discountAmount: 0,
      payAmount: 1102,
      address: {
        name: "王五",
        phone: "13700137000",
        province: "广东省",
        city: "深圳市",
        district: "南山区",
        detail: "科技园南路1号",
        latitude: 22.5431,
        longitude: 113.9498,
      },
      remark: "请尽快送达",
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      platformRawData: { source: "eleme_mock" },
    };
  }
}