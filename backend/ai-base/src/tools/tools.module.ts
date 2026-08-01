import { Module } from '@nestjs/common';
import { ToolRegistry } from './tool-registry';
import { ToolExecutor } from './tool-executor';
import { ToolBootstrap } from './tool-bootstrap';
import { EchoTool } from './definitions/echo.tool';
import { SearchCustomerTool } from './definitions/search-customer.tool';
import { SearchProductTool } from './definitions/search-product.tool';
import { CheckInventoryTool } from './definitions/check-inventory.tool';
import { CreateSalesOrderTool } from './definitions/create-sales-order.tool';
import { QuerySaleBillsTool } from './definitions/query-sale-bills.tool';
import { GetSaleBillDetailTool } from './definitions/get-sale-bill-detail.tool';
import { CancelOrderTool } from './definitions/cancel-order.tool';
// R70-10: 库存管理 3 个工具
import { InventoryTransferTool } from './definitions/inventory-transfer.tool';
import { StockCheckTool } from './definitions/stock-check.tool';
import { QueryInventoryTool } from './definitions/query-inventory.tool';
import { BridgeModule } from '../bridge/bridge.module';

/**
 * Tool 系统模块
 *
 * 注册并导出 ToolRegistry + ToolExecutor，供 Brain Engine（R70-08）和 Gateway（R70-06）注入使用。
 * ToolBootstrap 负责在模块初始化时将所有工具注册到 ToolRegistry（不导出，仅触发注册副作用）。
 *
 * 依赖关系：
 * - ToolRegistry 无外部依赖（纯内存 Map）
 * - ToolExecutor 依赖 ToolRegistry（同模块内注入）+ AuditLogger（BridgeModule 提供，异步写审计日志）
 * - ToolBootstrap 依赖 ToolRegistry + 所有 ITool 实现（触发注册）
 * - 业务工具依赖 ServiceClient（调用后端 API）→ BridgeModule 提供
 *
 * 已注册工具（R70-09）：
 * - EchoTool：回显测试工具（utility）
 * - SearchCustomerTool：搜索客户（customer）
 * - SearchProductTool：搜索商品（product）
 * - CheckInventoryTool：查询库存（inventory）
 * - CreateSalesOrderTool：创建销售单（order，写操作+预览）
 * - QuerySaleBillsTool：查询销售单列表（order）
 * - GetSaleBillDetailTool：查询销售单详情（order）
 * - CancelOrderTool：取消订单（order，写操作）
 *
 * 后续 R70-10~13 新增业务工具（inventory/product/customer/purchase/delivery/finance/report）时：
 * 1. 创建 src/tools/definitions/xxx.tool.ts（实现 ITool 接口）
 * 2. 在本模块 providers 数组中注册该工具
 * 3. 在 ToolBootstrap 构造函数注入该工具，并在 onModuleInit 的 registerAll 数组中添加
 */
@Module({
  imports: [BridgeModule],
  providers: [
    ToolRegistry,
    ToolExecutor,
    ToolBootstrap,
    EchoTool,
    // R70-09: 销售管理 7 个工具
    SearchCustomerTool,
    SearchProductTool,
    CheckInventoryTool,
    CreateSalesOrderTool,
    QuerySaleBillsTool,
    GetSaleBillDetailTool,
    CancelOrderTool,
    // R70-10: 库存管理 3 个工具
    InventoryTransferTool,
    StockCheckTool,
    QueryInventoryTool,
  ],
  exports: [ToolRegistry, ToolExecutor],
})
export class ToolsModule {}
