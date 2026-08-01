/**
 * BrainModule — 大脑引擎模块
 *
 * 注册 Brain Engine 的三个核心服务：
 * - ContextBuilder：上下文组装
 * - MemoryManager：对话记忆（Redis）
 * - Orchestrator：Agent Loop 编排器
 *
 * 依赖模块：
 * - ProvidersModule（ProviderFactory）
 * - ToolsModule（ToolRegistry + ToolExecutor）
 * - BridgeModule（AuditLogger）
 * - TenantModule（AiConfigService + TenantContext）
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-01
 */
import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { ToolsModule } from '../tools/tools.module';
import { BridgeModule } from '../bridge/bridge.module';
import { TenantModule } from '../tenant/tenant.module';
import { ContextBuilder } from './context-builder.service';
import { MemoryManager } from './memory-manager.service';
import { Orchestrator } from './orchestrator.service';
import { ConfirmationService } from './confirmation.service';

@Module({
  imports: [ProvidersModule, ToolsModule, BridgeModule, TenantModule],
  providers: [ContextBuilder, MemoryManager, Orchestrator, ConfirmationService],
  exports: [Orchestrator, MemoryManager, ConfirmationService],
})
export class BrainModule {}
