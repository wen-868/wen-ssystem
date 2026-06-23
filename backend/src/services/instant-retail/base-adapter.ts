/**
 * 即时零售平台适配器抽象基类
 * Abstract Base Adapter for Instant Retail Platforms
 *
 * 所有平台适配器（京东、美团、饿了么）必须继承此类，
 * 并实现平台特定的认证、订单同步、库存管理等功能。
 */

import crypto from 'crypto';
import type {
  AdapterInterface,
  PlatformCredentials,
  PlatformType,
  PlatformOrderStatus,
  UnifiedOrder,
  UnifiedProduct,
  UpdateInventoryParams,
  UpdateInventoryResult,
  WebhookVerificationResult,
  SyncOrdersResult,
} from './types.js';

/** 抽象平台适配器 */
export abstract class AbstractPlatformAdapter implements AdapterInterface {
  /** 平台类型标识 */
  protected abstract readonly platform: PlatformType;

  /** 平台接入凭证 */
  protected credentials: PlatformCredentials | null = null;

  /** 构造函数 */
  constructor(credentials?: PlatformCredentials) {
    if (credentials) {
      this.credentials = credentials;
    }
  }

  /**
   * 设置/更新凭证
   * @param credentials 平台接入凭证
   */
  setCredentials(credentials: PlatformCredentials): void {
    this.credentials = credentials;
  }

  /**
   * 获取当前凭证
   * @returns 当前平台接入凭证
   */
  getCredentials(): PlatformCredentials | null {
    return this.credentials;
  }

  /**
   * 认证并刷新 Token
   * 子类必须覆盖此方法，实现平台特定的 OAuth / 签名认证流程
   *
   * @returns 更新后的平台接入凭证
   */
  abstract authenticate(): Promise<PlatformCredentials>;

  /**
   * 同步订单列表
   * 子类必须覆盖此方法，实现平台特定的订单查询/拉取逻辑
   *
   * @param params 同步参数（时间范围、状态、分页游标等）
   * @returns 统一订单列表及分页信息
   */
  abstract syncOrders(params?: {
    startTime?: Date;
    endTime?: Date;
    status?: PlatformOrderStatus;
    cursor?: string;
    limit?: number;
  }): Promise<SyncOrdersResult>;

  /**
   * 获取订单详情
   * 默认实现基于 syncOrders 查询，子类可覆盖以支持平台原生订单详情接口
   *
   * @param platformOrderId 平台订单ID
   * @returns 统一订单结构
   */
  async getOrderDetail(platformOrderId: string): Promise<UnifiedOrder> {
    const result = await this.syncOrders({
      cursor: undefined,
      limit: 100,
    });
    const order = result.orders.find((o: UnifiedOrder) => o.platformOrderId === platformOrderId);
    if (!order) {
      throw new Error(`Order not found: ${platformOrderId}`);
    }
    return order;
  }

  /**
   * 确认接单
   * 子类必须覆盖此方法，调用平台接单接口
   *
   * @param platformOrderId 平台订单ID
   * @returns 是否成功
   */
  abstract confirmOrder(platformOrderId: string): Promise<boolean>;

  /**
   * 拒单
   * 默认实现直接返回失败，子类可覆盖
   *
   * @param platformOrderId 平台订单ID
   * @param reason 拒单原因
   * @returns 是否成功
   */
  async rejectOrder(platformOrderId: string, _reason?: string): Promise<boolean> {
    console.warn(`[${this.platform}] rejectOrder not implemented for ${platformOrderId}`);
    return false;
  }

  /**
   * 开始配送
   * 子类必须覆盖此方法，调用平台配送接口
   *
   * @param platformOrderId 平台订单ID
   * @param courierInfo 骑手信息（可选）
   * @returns 是否成功
   */
  abstract startDelivery(
    platformOrderId: string,
    courierInfo?: { name?: string; phone?: string; courierId?: string }
  ): Promise<boolean>;

  /**
   * 完成配送
   * 子类必须覆盖此方法，调用平台完成配送接口
   *
   * @param platformOrderId 平台订单ID
   * @returns 是否成功
   */
  abstract completeDelivery(platformOrderId: string): Promise<boolean>;

  /**
   * 取消订单
   * 子类必须覆盖此方法，调用平台取消订单接口
   *
   * @param platformOrderId 平台订单ID
   * @param reason 取消原因（可选）
   * @returns 是否成功
   */
  abstract cancelOrder(platformOrderId: string, reason?: string): Promise<boolean>;

  /**
   * 同步商品列表
   * 子类必须覆盖此方法，调用平台商品查询接口
   *
   * @param params 同步参数（分页游标等）
   * @returns 统一商品列表及分页信息
   */
  abstract syncProducts(params?: {
    cursor?: string;
    limit?: number;
  }): Promise<{
    products: UnifiedProduct[];
    hasMore: boolean;
    nextCursor?: string;
  }>;

  /**
   * 更新库存
   * 子类必须覆盖此方法，调用平台库存更新接口
   *
   * @param params 库存更新参数数组
   * @returns 库存更新结果数组
   */
  abstract updateInventory(params: UpdateInventoryParams[]): Promise<UpdateInventoryResult[]>;

  /**
   * 验证 Webhook 签名
   * 子类必须覆盖此方法，实现平台特定的推送签名验证逻辑
   *
   * @param payload 推送消息体
   * @param signature 签名
   * @param timestamp 时间戳（可选）
   * @returns 验签结果
   */
  abstract verifyWebhook(
    payload: unknown,
    signature: string,
    timestamp?: string
  ): Promise<WebhookVerificationResult>;

  /**
   * 生成请求签名
   * 子类必须覆盖此方法，实现平台特定的签名算法
   *
   * @param params 待签名参数
   * @returns 签名字符串
   */
  abstract sign(params: Record<string, unknown>): string;

  /**
   * 通用 MD5 签名辅助方法
   * @param input 待哈希字符串
   * @returns MD5 哈希值（小写）
   */
  protected md5(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').toLowerCase();
  }

  /**
   * 通用 HMAC-SHA256 签名辅助方法
   * @param input 待签名字符串
   * @param secret 密钥
   * @returns HMAC-SHA256 签名（Base64）
   */
  protected hmacSha256(input: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(input).digest('base64');
  }

  /**
   * 检查凭证是否有效（未过期）
   * @returns 凭证是否存在且未过期
   */
  protected isTokenValid(): boolean {
    if (!this.credentials) return false;
    const now = new Date();
    const expireAt = this.credentials.tokenExpireAt;
    return expireAt > now;
  }

  /**
   * 确保 Token 有效，若过期则自动刷新
   */
  protected async ensureAuthenticated(): Promise<void> {
    if (!this.isTokenValid()) {
      await this.authenticate();
    }
  }
}
