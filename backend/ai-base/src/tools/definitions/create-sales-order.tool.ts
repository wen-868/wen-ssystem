/**
 * createSalesOrder 工具 — 创建销售单（写操作，含智能价格填充+预览机制）
 *
 * 用途：为指定客户创建销售单，支持智能价格填充和单位换算。
 * 这是写操作，必须先生成预览卡片，等待用户确认后真正执行。
 *
 * 对应后端 API：POST /api/store/sale-bills
 * 后端路由：store-sale-bill.routes.ts（prefix: /api/store）
 *
 * 智能价格填充规则（写入操作规范第三章）：
 * 1. 客户类型 → 价格等级匹配：
 *    - WHOLESALE（批发客户）→ wholesalePrice（批发价）
 *    - CASH（散客/零售）→ retailPrice（零售价）
 *    - VIP（VIP客户）→ retailPrice * 0.9（VIP折扣，暂用零售价标记，后续可扩展）
 * 2. 用户指定价 > 客户类型对应价（优先级）
 * 3. 单位换算：用户说"箱"→ 按 boxRatio 换算为瓶，单价始终是瓶单价
 * 4. 价格安全校验：低于进价时生成警告（不拦截），零价格阻止执行
 *
 * 确认机制（R70-15 完整实现，当前简化版）：
 * - 预览阶段（confirm=false）：返回 ToolResult.preview，不调用后端
 * - 执行阶段（confirm=true）：调用 POST /api/store/sale-bills 创建销售单
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-01
 */
import { Injectable, Logger } from '@nestjs/common';
import { ITool, ToolContext, ToolResult } from '../tool.interface';
import {
  ServiceClient,
  API_ENDPOINTS,
  BridgeError,
} from '../../bridge/service-client';

/** 创建销售单的参数 */
interface CreateSalesOrderArgs {
  customerId: number;
  customerName?: string;
  customerType?: string;
  items: OrderItemInput[];
  saleType?: 'CASH' | 'CREDIT';
  remark?: string;
  confirm?: boolean;
}

/** 订单商品项输入 */
interface OrderItemInput {
  skuId: number;
  skuName?: string;
  /** 箱数（可选，与瓶数二选一或组合） */
  boxQty?: number;
  /** 瓶数（可选） */
  bottleQty?: number;
  /** 用户指定的单价（可选，不传则自动匹配） */
  unitPrice?: number;
  /** 商品信息（由前置 searchProduct 工具提供） */
  productInfo?: ProductInfoForPricing;
}

/** 商品定价信息（来自 searchProduct 工具返回） */
interface ProductInfoForPricing {
  boxRatio: number;
  retailPrice: number;
  wholesalePrice: number;
  storePrice: number;
  costPrice: number;
}

/** 后端创建销售单返回 */
interface CreateSaleBillResult {
  billNo: string;
  totalAmount: number;
  [key: string]: unknown;
}

@Injectable()
export class CreateSalesOrderTool implements ITool {
  private readonly logger = new Logger(CreateSalesOrderTool.name);

  readonly name = 'createSalesOrder';
  readonly description =
    '创建销售单（写操作，需用户确认）。' +
    '支持智能价格填充：根据客户类型自动匹配价格（批发客户→批发价，散客→零售价），' +
    '支持单位换算（箱→瓶，按boxRatio换算）。' +
    '必须先调用 searchCustomer 获取 customerId 和 customerType，再调用 searchProduct 获取 skuId 和价格信息。' +
    '首次调用 confirm=false 生成预览，用户确认后 confirm=true 正式创建。' +
    '示例参数：{"customerId":1,"customerType":"WHOLESALE","items":[{"skuId":10,"boxQty":5,"productInfo":{"boxRatio":6,"retailPrice":1200,"wholesalePrice":980,"storePrice":1100,"costPrice":850}}],"confirm":false}';
  readonly category = 'order' as const;
  readonly isWriteOperation = true;
  readonly requiredTools = [
    'searchCustomer',
    'searchProduct',
    'checkInventory',
  ];

  readonly parameters = {
    type: 'object' as const,
    properties: {
      customerId: {
        type: 'number',
        description: '客户ID（从 searchCustomer 工具获取的 memberId）',
      },
      customerName: {
        type: 'string',
        description: '客户名称（可选，用于预览展示）',
      },
      customerType: {
        type: 'string',
        enum: ['CASH', 'WHOLESALE', 'VIP'],
        description:
          '客户类型（从 searchCustomer 获取：CASH=散客/WHOLESALE=批发/VIP=VIP客户）',
      },
      items: {
        type: 'array',
        description: '商品明细列表',
        items: {
          type: 'object',
          properties: {
            skuId: {
              type: 'number',
              description: 'SKU ID（从 searchProduct 获取）',
            },
            skuName: { type: 'string', description: 'SKU名称（用于预览展示）' },
            boxQty: {
              type: 'number',
              description: '箱数（可选，与 bottleQty 组合使用）',
            },
            bottleQty: {
              type: 'number',
              description: '瓶数（可选，与 boxQty 组合使用）',
            },
            unitPrice: {
              type: 'number',
              description: '用户指定单价（可选，不传则自动匹配）',
            },
            productInfo: {
              type: 'object',
              description:
                '商品定价信息（从 searchProduct 获取，用于自动匹配价格）',
              properties: {
                boxRatio: { type: 'number', description: '箱瓶比（1箱=N瓶）' },
                retailPrice: { type: 'number', description: '零售价' },
                wholesalePrice: { type: 'number', description: '批发价' },
                storePrice: { type: 'number', description: '门店价' },
                costPrice: { type: 'number', description: '进价' },
              },
            },
          },
        },
      },
      saleType: {
        type: 'string',
        enum: ['CASH', 'CREDIT'],
        description: '销售类型（CASH=现结/CREDIT=赊销，默认CASH）',
      },
      remark: {
        type: 'string',
        description: '备注（可选）',
      },
      confirm: {
        type: 'boolean',
        description: '是否确认执行（false=生成预览，true=正式创建。默认false）',
      },
    },
    required: ['customerId', 'items'],
  };

  constructor(private readonly serviceClient: ServiceClient) {}

  async execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    // ── 1. 参数校验 ──
    const parsed = this.parseArgs(args);
    if (!parsed.valid) {
      return {
        success: false,
        error: parsed.error,
        suggestion: parsed.suggestion,
      };
    }

    const orderArgs = parsed.data;
    const confirm = orderArgs.confirm === true;

    // ── 2. 智能价格填充 + 单位换算 ──
    const processedItems = orderArgs.items.map((item) =>
      this.processItem(item, orderArgs.customerType ?? 'CASH'),
    );

    // 检查是否有阻止性错误（零价格）
    const blockingItem = processedItems.find((item) => item.blocked);
    if (blockingItem) {
      return {
        success: false,
        error: blockingItem.error,
        suggestion:
          '请通过 searchProduct 获取商品价格信息，或在 items 中指定 unitPrice',
      };
    }

    // 计算合计
    const totalAmount = processedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );

    // 收集警告
    const warnings = processedItems
      .filter((item) => item.warning)
      .map((item) => item.warning) as string[];

    // ── 3. 预览阶段 ──
    if (!confirm) {
      const previewDetails: Record<string, unknown> = {
        customerId: orderArgs.customerId,
        customerName: orderArgs.customerName ?? '未知',
        customerType: orderArgs.customerType ?? 'CASH',
        saleType: orderArgs.saleType ?? 'CASH',
        items: processedItems.map((item) => ({
          skuId: item.skuId,
          skuName: item.skuName,
          boxQty: item.boxQty,
          bottleQty: item.bottleQty,
          totalBottleQty: item.totalBottleQty,
          unitPrice: item.unitPrice,
          priceSource: item.priceSource,
          totalPrice: item.totalPrice,
        })),
        totalAmount,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      this.logger.log(
        `生成销售单预览：customer=${orderArgs.customerName ?? orderArgs.customerId} ` +
          `${processedItems.length} 种商品 合计 ${totalAmount} 元`,
      );

      return {
        success: true,
        preview: {
          operation: '创建销售单',
          summary:
            `${orderArgs.customerName ?? '客户' + orderArgs.customerId} ` +
            `${processedItems.length} 种商品，合计 ${totalAmount.toFixed(2)} 元` +
            (warnings.length > 0 ? `（含 ${warnings.length} 条警告）` : ''),
          details: previewDetails,
        },
      };
    }

    // ── 4. 执行阶段：调用后端创建销售单 ──
    try {
      const requestBody = {
        customerId: orderArgs.customerId,
        customerName: orderArgs.customerName,
        saleType: orderArgs.saleType ?? 'CASH',
        remark: orderArgs.remark,
        items: processedItems.map((item) => ({
          skuId: item.skuId,
          boxQty: item.boxQty,
          bottleQty: item.bottleQty,
          totalBottleQty: item.totalBottleQty,
          unitPrice: item.unitPrice,
          priceType: this.mapPriceType(orderArgs.customerType ?? 'CASH'),
        })),
      };

      const result = await this.serviceClient.post<CreateSaleBillResult>(
        API_ENDPOINTS.STORE_SALE_BILLS,
        requestBody,
        context,
      );

      this.logger.log(
        `销售单创建成功：billNo=${result.billNo} totalAmount=${result.totalAmount ?? totalAmount}`,
      );

      return {
        success: true,
        data: {
          billNo: result.billNo,
          totalAmount: result.totalAmount ?? totalAmount,
          customerName: orderArgs.customerName,
          itemCount: processedItems.length,
          message: `销售单 ${result.billNo} 创建成功，合计 ${(result.totalAmount ?? totalAmount).toFixed(2)} 元`,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      };
    } catch (err) {
      const errorMsg =
        err instanceof BridgeError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);

      this.logger.error(`创建销售单失败：${errorMsg}`);
      return {
        success: false,
        error: `创建销售单失败：${errorMsg}`,
        suggestion: '请确认后端服务是否正常运行，检查客户ID和SKU ID是否正确',
      };
    }
  }

  // ── 私有方法 ──

  /** 解析并校验参数 */
  private parseArgs(
    args: Record<string, unknown>,
  ):
    | { valid: true; data: CreateSalesOrderArgs }
    | { valid: false; error: string; suggestion?: string } {
    const customerId = args.customerId;
    if (typeof customerId !== 'number' || customerId <= 0) {
      return {
        valid: false,
        error: '参数 customerId 必须为正整数',
        suggestion: '请先调用 searchCustomer 获取客户的 memberId',
      };
    }

    const items = args.items;
    if (!Array.isArray(items) || items.length === 0) {
      return {
        valid: false,
        error: '参数 items 必须为非空数组',
        suggestion: '请至少传入一个商品项',
      };
    }

    // 校验每个 item
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, unknown>;
      if (typeof item.skuId !== 'number' || item.skuId <= 0) {
        return {
          valid: false,
          error: `第 ${i + 1} 个商品的 skuId 必须为正整数`,
          suggestion: '请先调用 searchProduct 获取商品的 skuId',
        };
      }
      if (
        (typeof item.boxQty !== 'number' || item.boxQty <= 0) &&
        (typeof item.bottleQty !== 'number' || item.bottleQty <= 0)
      ) {
        return {
          valid: false,
          error: `第 ${i + 1} 个商品必须指定 boxQty 或 bottleQty（至少一个大于0）`,
          suggestion: '请传入箱数(boxQty)或瓶数(bottleQty)',
        };
      }
    }

    return {
      valid: true,
      data: {
        customerId,
        customerName:
          typeof args.customerName === 'string' ? args.customerName : undefined,
        customerType:
          typeof args.customerType === 'string' ? args.customerType : undefined,
        items: items as OrderItemInput[],
        saleType: args.saleType === 'CREDIT' ? 'CREDIT' : 'CASH',
        remark: typeof args.remark === 'string' ? args.remark : undefined,
        confirm: typeof args.confirm === 'boolean' ? args.confirm : false,
      },
    };
  }

  /**
   * 处理单个商品项：智能价格填充 + 单位换算
   */
  private processItem(
    item: OrderItemInput,
    customerType: string,
  ): ProcessedItem {
    const productInfo = item.productInfo;
    const boxRatio = productInfo?.boxRatio ?? 1;

    // ── 单位换算：箱+瓶 → 总瓶数 ──
    const boxQty = item.boxQty ?? 0;
    const bottleQty = item.bottleQty ?? 0;
    const totalBottleQty = boxQty * boxRatio + bottleQty;

    if (totalBottleQty <= 0) {
      return {
        skuId: item.skuId,
        skuName: item.skuName ?? `SKU-${item.skuId}`,
        boxQty,
        bottleQty,
        totalBottleQty: 0,
        unitPrice: 0,
        totalPrice: 0,
        priceSource: '未知',
        blocked: true,
        error: `商品 ${item.skuName ?? item.skuId} 总瓶数为0，无法创建销售单`,
      };
    }

    // ── 智能价格填充 ──
    let unitPrice: number;
    let priceSource: string;

    if (typeof item.unitPrice === 'number' && item.unitPrice > 0) {
      // 用户指定价优先
      unitPrice = item.unitPrice;
      priceSource = '用户指定价';
    } else if (productInfo) {
      // 按客户类型自动匹配
      const matched = this.matchPriceByCustomerType(productInfo, customerType);
      unitPrice = matched.price;
      priceSource = matched.source;
    } else {
      // 无价格信息
      return {
        skuId: item.skuId,
        skuName: item.skuName ?? `SKU-${item.skuId}`,
        boxQty,
        bottleQty,
        totalBottleQty,
        unitPrice: 0,
        totalPrice: 0,
        priceSource: '无价格',
        blocked: true,
        error: `商品 ${item.skuName ?? item.skuId} 无价格信息，请通过 searchProduct 获取或手动指定 unitPrice`,
      };
    }

    const totalPrice = unitPrice * totalBottleQty;

    // ── 价格安全校验 ──
    let warning: string | undefined;
    if (productInfo && productInfo.costPrice > 0) {
      if (unitPrice < productInfo.costPrice) {
        warning = `警告：商品 ${item.skuName ?? item.skuId} 的单价 ${unitPrice} 低于进价 ${productInfo.costPrice}，可能造成亏损`;
      }
    }

    if (unitPrice === 0) {
      return {
        skuId: item.skuId,
        skuName: item.skuName ?? `SKU-${item.skuId}`,
        boxQty,
        bottleQty,
        totalBottleQty,
        unitPrice: 0,
        totalPrice: 0,
        priceSource: '零价格',
        blocked: true,
        error: `商品 ${item.skuName ?? item.skuId} 单价为0，无法创建销售单`,
      };
    }

    return {
      skuId: item.skuId,
      skuName: item.skuName ?? `SKU-${item.skuId}`,
      boxQty,
      bottleQty,
      totalBottleQty,
      unitPrice,
      totalPrice,
      priceSource,
      warning,
      blocked: false,
    };
  }

  /**
   * 按客户类型匹配价格
   *
   * 优先级：用户指定价 > 客户类型对应价
   * 客户类型映射：
   * - WHOLESALE → wholesalePrice（批发价）
   * - CASH → retailPrice（零售价）
   * - VIP → retailPrice * 0.9（VIP九折，暂用零售价，后续可扩展）
   */
  private matchPriceByCustomerType(
    productInfo: ProductInfoForPricing,
    customerType: string,
  ): { price: number; source: string } {
    switch (customerType) {
      case 'WHOLESALE':
        if (productInfo.wholesalePrice > 0) {
          return {
            price: productInfo.wholesalePrice,
            source: '已自动应用批发客户价格',
          };
        }
        // 批发价为0时降级到零售价
        return {
          price: productInfo.retailPrice,
          source: '批发价未设置，已降级为零售价',
        };

      case 'VIP':
        if (productInfo.retailPrice > 0) {
          // VIP 九折（暂定，后续可根据 t_customer_level 表的折扣率计算）
          const vipPrice =
            Math.round(productInfo.retailPrice * 0.9 * 100) / 100;
          return {
            price: vipPrice,
            source: '已自动应用VIP客户价格（零售价九折）',
          };
        }
        return { price: productInfo.storePrice, source: '已自动应用门店价' };

      case 'CASH':
      default:
        if (productInfo.retailPrice > 0) {
          return {
            price: productInfo.retailPrice,
            source: '已自动应用零售价格',
          };
        }
        // 零售价为0时降级到门店价
        return {
          price: productInfo.storePrice,
          source: '零售价未设置，已降级为门店价',
        };
    }
  }

  /** 将客户类型映射为后端的 priceType 枚举 */
  private mapPriceType(customerType: string): 'RETAIL' | 'WHOLESALE' | 'STORE' {
    switch (customerType) {
      case 'WHOLESALE':
        return 'WHOLESALE';
      case 'VIP':
        return 'RETAIL'; // VIP 用零售价折扣，priceType 标记为 RETAIL
      case 'CASH':
      default:
        return 'RETAIL';
    }
  }
}

/** 处理后的商品项 */
interface ProcessedItem {
  skuId: number;
  skuName: string;
  boxQty: number;
  bottleQty: number;
  totalBottleQty: number;
  unitPrice: number;
  totalPrice: number;
  priceSource: string;
  warning?: string;
  blocked: boolean;
  error?: string;
}
