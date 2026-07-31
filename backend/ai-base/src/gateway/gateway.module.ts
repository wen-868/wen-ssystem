/**
 * Gateway 模块 — 对外接口层
 *
 * 职责：
 * 1. 注册 ChatController（SSE 流式对话接口）
 * 2. 注册 AdminController（管理 API：工具/Provider/健康检查/审计日志）
 *
 * 依赖：
 * - ProvidersModule（ProviderFactory：创建/管理 LLM Provider 实例）
 * - ToolsModule（ToolRegistry + ToolExecutor：工具注册与执行）
 * - BridgeModule（ServiceClient：后端 API 调用 + AuditLogger：审计日志）
 *
 * 被 AppModule 直接导入，Controller 自动注册到 NestJS 路由系统。
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-01
 */
import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { AdminController } from './admin.controller';
import { ProvidersModule } from '../providers/providers.module';
import { ToolsModule } from '../tools/tools.module';
import { BridgeModule } from '../bridge/bridge.module';

@Module({
  imports: [ProvidersModule, ToolsModule, BridgeModule],
  controllers: [ChatController, AdminController],
})
export class GatewayModule {}
