﻿﻿﻿/**
 * 京东秒送平台适配器
 * JD Instant Delivery (京东秒送) Platform Adapter
 *
 * 真实 API 文档地址：https://openapi.jddj.com/djapi/
 * 京东秒送开放平台提供订单管理、商品同步、库存更新、配送状态等接口。
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
} from "../types";

/** 京东秒送开放平台 API 基础地址 */
const API_BASE = "https://openapi.jddj.com/djapi";

export class JdAdapter extends AbstractPlatformAdapter {
  protected readonly platform: PlatformType = "JD";

  /**
   * 京东 OAuth + MD5 签名认证
   * 真实接口：POST https://openapi.jddj.com/djapi/oauth/token
   *
   * 流程：
   * 1. 使用 app_key + timestamp + app_secret 生成 MD5 签名
   * 2. 调用京东 OAuth 接口获取 access_token
   * 3. 返回包含 token 和过期时间的凭证
   */
  async authenticate(): Promise<PlatformCredentials> {
    const appKey = this.credentials?.appKey ?? "mock_app_key";
    const appSecret = this.credentials?.appSecret ?? "mock_app_secret";
    const storeId = this.credentials?.storeId ?? "mock_store_id";
    const merchantId = this.credentials?.merchantId ?? "mock_merchant_id";

    const timestamp = Date.now().toString();
    const signStr = this.sign({ app_key: appKey, timestamp, app_secret: appSecret });

    const result = await platformCall<{
      code: number;
      msg: string;
      data: { accessToken: string; refreshToken: string; expiresIn: number };
    }>(
      "JD",
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
        throw new Error("[JD] Cannot refresh token: no credentials");
      },
      (async () => {
        logger.info("[JD] Mock authenticate");
        const expireAt = new Date(Date.now() + 7200 * 1000);
        const creds: PlatformCredentials = {
          platform: "JD",
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
      }) as any
    );

    const token = useMock()
      ? this.credentials!
      : {
        platform: "JD" as const,
        storeId,
        appKey,
        appSecret,
        merchantId,
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        tokenExpireAt: new Date(Date.now() + result.data.expiresIn * 1000),
        enabled: true,
      };

    this.credentials = token;
    return token;
  }

  private mapToUnifiedOrder(raw: Record<string, unknown>, storeId: string): UnifiedOrder {
    const items: UnifiedOrderItem[] = ((raw.orderItemList as Record<string, unknown>[]) ?? []).map(
      (item: Record<string, unknown>) => ({
        localSkuId: (item.skuId as string) ?? "",
        platformSkuId: (item.djSkuId as string) ?? "",
        name: (item.skuName as string) ?? "",
        quantity: (item.skuCount as number) ?? 1,
        unitPrice: (item.skuPrice as number) ?? 0,
        totalPrice: ((item.skuCount as number) ?? 1) * ((item.skuPrice as number) ?? 0),
        spec: (item.spec as string) ?? undefined,
      })
    );

    const address: UnifiedAddress = {
      name: (raw.consignee as string) ?? "",
      phone: (raw.consigneeMobile as string) ?? "",
      province: (raw.provinceName as string) ?? "",
      city: (raw.cityName as string) ?? "",
      district: (raw.districtName as string) ?? "",
      detail: (raw.deliveryAddress as string) ?? "",
      latitude: raw.latitude as number | undefined,
      longitude: raw.longitude as number | undefined,
    };

    const statusMap: Record<string, PlatformOrderStatus> = {
      WAIT_ACCEPT: "PENDING",
      ACCEPTED: "ACCEPTED",
      DELIVERING: "DELIVERING",
      COMPLETED: "COMPLETED",
      CANCELLED: "CANCELLED",
    };

    return {
      orderId: `local_${raw.orderId as string}`,
      platform: "JD",
      platformOrderId: raw.orderId as string,
      storeId,
      items,
      totalAmount: (raw.orderAmount as number) ?? 0,
      deliveryFee: (raw.deliveryFee as number) ?? 0,
      discountAmount: (raw.discountAmount as number) ?? 0,
      payAmount: (raw.payAmount as number) ?? 0,
      address,
      remark: (raw.remark as string) ?? undefined,
      status: statusMap[raw.orderStatus as string] ?? "PENDING",
      createdAt: new Date((raw.createTime as number) ?? Date.now()),
      updatedAt: new Date((raw.updateTime as number) ?? Date.now()),
      platformRawData: raw,
    };
  }

  private mapToUnifiedProduct(raw: Record<string, unknown>, storeId: string): UnifiedProduct {
    return {
      localSkuId: (raw.skuId as string) ?? "",
      platformSkuId: (raw.djSkuId as string) ?? "",
      platformSpuId: (raw.spuId as string) ?? "",
      name: (raw.skuName as string) ?? "",
      description: (raw.description as string) ?? undefined,
      categoryId: (raw.categoryId as string) ?? undefined,
      categoryName: (raw.categoryName as string) ?? undefined,
      price: (raw.skuPrice as number) ?? 0,
      originalPrice: (raw.originalPrice as number) ?? undefined,
      stock: (raw.stockNum as number) ?? 0,
      unit: (raw.unit as string) ?? undefined,
      spec: (raw.spec as string) ?? undefined,
      images: (raw.images as string[]) ?? [],
      status: ((raw.status as string) === "OFFLINE" ? "OFFLINE" : (raw.stockNum as number) <= 0 ? "SOLD_OUT" : "ONLINE") as "ONLINE" | "OFFLINE" | "SOLD_OUT",
      platform: "JD" as PlatformType,
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

    const statusMap: Record<string, string> = {
      PENDING: "WAIT_ACCEPT",
      ACCEPTED: "ACCEPTED",
      DELIVERING: "DELIVERING",
      COMPLETED: "COMPLETED",
      CANCELLED: "CANCELLED",
    };

    const result = await platformCall<{
      code: number;
      msg: string;
      data: { orderList: Record<string, unknown>[]; totalCount: number; pageNo: number; pageSize: number };
    }>(
      "JD",
      `${API_BASE}/order/queryList`,
      {
        method: "POST",
        body: {
          storeId,
          startTime: params?.startTime ? new Date(params.startTime).toISOString() : undefined,
          endTime: params?.endTime ? new Date(params.endTime).toISOString() : undefined,
          orderStatus: params?.status ? statusMap[params.status] : undefined,
          pageNo: params?.cursor ? Number(params.cursor) : 1,
          pageSize: limit,
        },
      },
      () => this.authenticate(),
      (async () => {
        const mockOrders: UnifiedOrder[] = Array.from({ length: Math.min(limit, 3) }).map((_, i) =>
          this.createMockOrder(`JD${Date.now()}${i}`, params?.status ?? "PENDING")
        );
        logger.info(`[JD] Mock synced ${mockOrders.length} orders`);
        return { orders: mockOrders, hasMore: false, nextCursor: undefined };
      }) as any
    );

    if (useMock()) {
      return result as unknown as SyncOrdersResult;
    }

    const orders = result.data.orderList.map((o: Record<string, unknown>) => this.mapToUnifiedOrder(o, storeId));
    const hasMore = result.data.pageNo * result.data.pageSize < result.data.totalCount;

    logger.info(`[JD] Synced ${orders.length} orders`);

    return {
      orders,
      hasMore,
      nextCursor: hasMore ? String(result.data.pageNo + 1) : undefined,
    };
  }

  async confirmOrder(platformOrderId: string): Promise<boolean> {
    await this.ensureAuthenticated();

    return platformCall<{ code: number; msg: string }>(
      "JD",
      `${API_BASE}/order/confirm`,
      {
        method: "POST",
        body: {
          storeId: this.credentials?.storeId,
          orderId: platformOrderId,
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[JD] Mock confirm order: ${platformOrderId}`);
        return { code: 0, msg: "success" };
      }
    ).then((r: any) => r.code === 0);
  }

  async startDelivery(platformOrderId: string, courierInfo?: { deliveryCompany?: string; deliveryNo?: string; deliveryMan?: string; deliveryPhone?: string }): Promise<boolean> {
    await this.ensureAuthenticated();

    return platformCall<{ code: number; msg: string }>(
      "JD",
      `${API_BASE}/order/deliveryStart`,
      {
        method: "POST",
        body: {
          storeId: this.credentials?.storeId,
          orderId: platformOrderId,
          courierName: courierInfo?.deliveryMan,
          courierPhone: courierInfo?.deliveryPhone,
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[JD] Mock start delivery: ${platformOrderId}`);
        return { code: 0, msg: "success" };
      }
    ).then((r: any) => r.code === 0);
  }

  async completeDelivery(platformOrderId: string): Promise<boolean> {
    await this.ensureAuthenticated();

    return platformCall<{ code: number; msg: string }>(
      "JD",
      `${API_BASE}/order/deliveryComplete`,
      {
        method: "POST",
        body: {
          storeId: this.credentials?.storeId,
          orderId: platformOrderId,
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[JD] Mock complete delivery: ${platformOrderId}`);
        return { code: 0, msg: "success" };
      }
    ).then((r: any) => r.code === 0);
  }

  async cancelOrder(platformOrderId: string, reason?: string): Promise<boolean> {
    await this.ensureAuthenticated();

    return platformCall<{ code: number; msg: string }>(
      "JD",
      `${API_BASE}/order/cancel`,
      {
        method: "POST",
        body: {
          storeId: this.credentials?.storeId,
          orderId: platformOrderId,
          cancelReason: reason,
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[JD] Mock cancel order: ${platformOrderId}, reason: ${reason ?? "N/A"}`);
        return { code: 0, msg: "success" };
      }
    ).then((r: any) => r.code === 0);
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
      code: number;
      msg: string;
      data: { skuList: Record<string, unknown>[]; totalCount: number; pageNo: number; pageSize: number };
    }>(
      "JD",
      `${API_BASE}/product/queryList`,
      {
        method: "POST",
        body: {
          storeId,
          pageNo: params?.cursor ? Number(params.cursor) : 1,
          pageSize: limit,
        },
      },
      () => this.authenticate(),
      (async () => {
        const mockProducts: UnifiedProduct[] = Array.from({ length: Math.min(limit, 2) }).map((_, i) => ({
          localSkuId: `local_sku_${i}`,
          platformSkuId: `jd_sku_${i}`,
          platformSpuId: `jd_spu_${i}`,
          name: `京东商品示例 ${i + 1}`,
          description: "京东秒送平台商品",
          categoryId: "cat_001",
          categoryName: "酒类",
          price: 199 + i * 10,
          originalPrice: 299 + i * 10,
          stock: 100 - i * 10,
          unit: "瓶",
          spec: "500ml",
          images: ["https://example.com/jd_img.jpg"],
          status: "ONLINE" as const,
          platform: "JD" as PlatformType,
          storeId,
        }));
        logger.info(`[JD] Mock synced ${mockProducts.length} products`);
        return { products: mockProducts, hasMore: false, nextCursor: undefined };
      }) as any
    );

    if (useMock()) {
      return result as unknown as { products: UnifiedProduct[]; hasMore: boolean; nextCursor?: string };
    }

    const products = result.data.skuList.map((p: Record<string, unknown>) => this.mapToUnifiedProduct(p, storeId));
    const hasMore = result.data.pageNo * result.data.pageSize < result.data.totalCount;

    logger.info(`[JD] Synced ${products.length} products`);

    return {
      products,
      hasMore,
      nextCursor: hasMore ? String(result.data.pageNo + 1) : undefined,
    };
  }

  async updateInventory(params: UpdateInventoryParams[]): Promise<UpdateInventoryResult[]> {
    await this.ensureAuthenticated();

    const storeId = this.credentials?.storeId ?? "mock_store";

    return platformCall<{
      code: number;
      msg: string;
      data: { results: UpdateInventoryResult[] };
    }>(
      "JD",
      `${API_BASE}/product/updateStock`,
      {
        method: "POST",
        body: {
          storeId,
          stockList: params.map((p) => ({
            djSkuId: p.platformSkuId,
            skuId: p.localSkuId,
            stockNum: p.stock,
          })),
        },
      },
      () => this.authenticate(),
      async () => {
        logger.info(`[JD] Mock updating inventory for ${params.length} items`);
        return {
          code: 0,
          msg: "success",
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
    ).then((r: any) => r.data?.results ?? params.map((p: any) => ({ success: false, localSkuId: p.localSkuId, platformSkuId: p.platformSkuId, message: "更新失败" })));
  }

  async verifyWebhook(payload: unknown, signature: string, timestamp?: string): Promise<WebhookVerificationResult> {
    const appSecret = this.credentials?.appSecret ?? "mock_app_secret";
    const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    const ts = timestamp ?? Date.now().toString();

    const expectedSign = this.md5(`${payloadStr}${ts}${appSecret}`);
    const valid = expectedSign === signature;

    logger.info(`[JD] Webhook verification: ${valid ? "passed" : "failed"}`);

    return {
      valid,
      platform: "JD",
      eventType: (payload as Record<string, unknown>)?.eventType as string | undefined,
      payload: payload as Record<string, unknown> | undefined,
    };
  }

  /**
   * 京东 MD5 签名算法
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
      platform: "JD",
      platformOrderId,
      storeId: this.credentials?.storeId ?? "mock_store",
      items: [
        {
          localSkuId: "sku_001",
          platformSkuId: "jd_sku_001",
          name: "飞天茅台 53度 500ml",
          quantity: 1,
          unitPrice: 1499,
          totalPrice: 1499,
          spec: "500ml",
        },
      ],
      totalAmount: 1499,
      deliveryFee: 0,
      discountAmount: 0,
      payAmount: 1499,
      address: {
        name: "张三",
        phone: "13800138000",
        province: "北京市",
        city: "北京市",
        district: "朝阳区",
        detail: "建国路88号",
        latitude: 39.9042,
        longitude: 116.4074,
      },
      remark: "请尽快送达",
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      platformRawData: { source: "jd_mock" },
    };
  }
}