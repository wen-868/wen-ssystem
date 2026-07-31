import { Module } from '@nestjs/common';
import { ToolRegistry } from './tool-registry';
import { ToolExecutor } from './tool-executor';
import { ToolBootstrap } from './tool-bootstrap';
import { EchoTool } from './definitions/echo.tool';
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
 * - 业务工具（R70-09~13）会依赖 ServiceClient（调用微服务）+ TenantContext（多租户）
 *
 * 后续 R70-09~13 新增业务工具（order/inventory/product/customer/purchase/delivery/finance/report）时：
 * 1. 创建 src/tools/definitions/xxx.tool.ts（实现 ITool 接口）
 * 2. 在本模块 providers 数组中注册该工具
 * 3. 在 ToolBootstrap 构造函数注入该工具，并在 onModuleInit 的 registerAll 数组中添加
 */
@Module({
  imports: [BridgeModule],
  providers: [ToolRegistry, ToolExecutor, ToolBootstrap, EchoTool],
  exports: [ToolRegistry, ToolExecutor],
})
export class ToolsModule {}
