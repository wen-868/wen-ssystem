import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProvidersModule } from './providers/providers.module';
import { ToolsModule } from './tools/tools.module';
import { DatabaseModule } from './database/database.module';
import { BridgeModule } from './bridge/bridge.module';
import { BrainModule } from './brain/brain.module';
import { GatewayModule } from './gateway/gateway.module';
import { TenantModule } from './tenant/tenant.module';

/**
 * 应用根模块
 *
 * 模块依赖关系（按加载顺序）：
 * 1. ConfigModule — 环境变量全局加载
 * 2. DatabaseModule — TypeORM MySQL 连接 + 5 张 AI 表 Entity 注册 ✅ R70-05 已接入
 * 3. ProvidersModule — DeepSeek / Ollama 模型服务商 ✅ R70-03 已接入
 * 4. BridgeModule — ServiceClient(HTTP 调用后端) + AuditLogger(审计日志) ✅ R70-05 已接入
 * 5. ToolsModule — ToolRegistry + ToolExecutor + EchoTool ✅ R70-04 已接入（R70-05 接入 AuditLogger）
 * 6. TenantModule — TenantContext + CryptoService + AiConfigService + TenantMiddleware ✅ R70-07 已接入
 * 7. BrainModule — ContextBuilder + MemoryManager(Redis) + Orchestrator(Agent Loop) ✅ R70-08 已接入
 * 8. GatewayModule — ChatController(SSE) + AdminController(管理API) ✅ R70-06 已接入（R70-08 接入 Orchestrator）
 *
 * 后续任务将逐步导入以下模块：
 * - RagModule（rag/）— 知识库检索增强
 */
@Module({
  imports: [
    // 环境变量全局加载
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    // 数据库层（TypeORM MySQL 连接 + Entity 注册）
    DatabaseModule,
    // Provider 层（DeepSeek + Ollama + ProviderFactory）
    ProvidersModule,
    // Bridge 层（ServiceClient HTTP 客户端 + AuditLogger 审计日志）
    BridgeModule,
    // Tool 系统（ToolRegistry + ToolExecutor + EchoTool 示例工具）
    ToolsModule,
    // 多租户层（TenantContext + CryptoService + AiConfigService + TenantMiddleware）
    TenantModule,
    // 大脑引擎（ContextBuilder + MemoryManager + Orchestrator Agent Loop）
    BrainModule,
    // Gateway 层（ChatController SSE 流式对话 + AdminController 管理 API）
    GatewayModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
