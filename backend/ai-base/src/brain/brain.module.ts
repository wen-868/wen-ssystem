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
import { RagModule } from '../rag/rag.module';
import { ContextBuilder } from './context-builder.service';
import { MemoryManager } from './memory-manager.service';
import { Orchestrator } from './orchestrator.service';
import { ConfirmationService } from './confirmation.service';
import { RollbackExecutorService } from './rollback-executor.service';
import { CheckpointerService } from './graph/checkpointer.service';
import { GraphExecutorService } from './graph/graph-executor.service';
import { ReviewTaskService } from './review/review-task.service';
import { ProviderRouterService } from './router/provider-router.service';
import { EvidenceLedgerService } from './evidence/evidence-ledger.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiReviewTaskEntity } from '../database/entities/ai-review-task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiReviewTaskEntity]),
    ProvidersModule,
    ToolsModule,
    BridgeModule,
    TenantModule,
    RagModule,
  ],
  providers: [
    ContextBuilder,
    MemoryManager,
    Orchestrator,
    ConfirmationService,
    RollbackExecutorService,
    CheckpointerService,
    GraphExecutorService,
    ReviewTaskService,
    ProviderRouterService,
    EvidenceLedgerService,
  ],
  exports: [
    Orchestrator,
    MemoryManager,
    ConfirmationService,
    RollbackExecutorService,
    CheckpointerService,
    GraphExecutorService,
    ReviewTaskService,
    ProviderRouterService,
    EvidenceLedgerService,
  ],
})
export class BrainModule {}
