import { Injectable, OnModuleInit } from '@nestjs/common';
import { ToolRegistry } from './tool-registry';
import { EchoTool } from './definitions/echo.tool';
import { SearchCustomerTool } from './definitions/search-customer.tool';
import { SearchProductTool } from './definitions/search-product.tool';
import { CheckInventoryTool } from './definitions/check-inventory.tool';
import { CreateSalesOrderTool } from './definitions/create-sales-order.tool';
import { QuerySaleBillsTool } from './definitions/query-sale-bills.tool';
import { GetSaleBillDetailTool } from './definitions/get-sale-bill-detail.tool';
import { CancelOrderTool } from './definitions/cancel-order.tool';
import { InventoryTransferTool } from './definitions/inventory-transfer.tool';
import { StockCheckTool } from './definitions/stock-check.tool';
import { QueryInventoryTool } from './definitions/query-inventory.tool';

/**
 * Tool 注册引导器
 *
 * 职责：在 NestJS 模块初始化阶段，将所有 ITool 实现集中注册到 ToolRegistry。
 *
 * 设计理由：
 * - ToolRegistry 保持纯粹（只负责存储/查询/生成定义），不依赖具体工具实现
 * - ToolBootstrap 集中管理工具注册，后续新增工具只需在此处注入并 registerAll
 * - 利用 NestJS OnModuleInit 生命周期，确保工具在服务接收请求前完成注册
 *
 * 已注册工具（R70-09）：
 * - echo：回显测试工具（utility）
 * - searchCustomer：搜索客户（customer）
 * - searchProduct：搜索商品（product）
 * - checkInventory：查询库存（inventory）
 * - createSalesOrder：创建销售单（order，写操作）
 * - querySaleBills：查询销售单列表（order）
 * - getSaleBillDetail：查询销售单详情（order）
 * - cancelOrder：取消订单（order，写操作）
 *
 * R70-10 新增（库存管理）：
 * - inventoryTransfer：库存调拨（inventory，写操作+预览）
 * - stockCheck：库存盘点（inventory，写操作+预览）
 * - queryInventory：查询库存汇总（inventory，按仓库/分类维度）
 *
 * 注意：本 provider 不被任何模块 export，仅用于触发注册副作用，
 * 必须在 ToolsModule.providers 中声明才能生效。
 */
@Injectable()
export class ToolBootstrap implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly echoTool: EchoTool,
    private readonly searchCustomerTool: SearchCustomerTool,
    private readonly searchProductTool: SearchProductTool,
    private readonly checkInventoryTool: CheckInventoryTool,
    private readonly createSalesOrderTool: CreateSalesOrderTool,
    private readonly querySaleBillsTool: QuerySaleBillsTool,
    private readonly getSaleBillDetailTool: GetSaleBillDetailTool,
    private readonly cancelOrderTool: CancelOrderTool,
    private readonly inventoryTransferTool: InventoryTransferTool,
    private readonly stockCheckTool: StockCheckTool,
    private readonly queryInventoryTool: QueryInventoryTool,
  ) {}

  onModuleInit(): void {
    // 集中注册所有工具
    this.registry.registerAll([
      this.echoTool,
      // R70-09: 销售管理 7 个工具
      this.searchCustomerTool,
      this.searchProductTool,
      this.checkInventoryTool,
      this.createSalesOrderTool,
      this.querySaleBillsTool,
      this.getSaleBillDetailTool,
      this.cancelOrderTool,
      // R70-10: 库存管理 3 个工具
      this.inventoryTransferTool,
      this.stockCheckTool,
      this.queryInventoryTool,
    ]);
  }
}
