import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProvidersModule } from './providers/providers.module';
import { ToolsModule } from './tools/tools.module';
import { AdminTestController } from './gateway/admin-test.controller';
import { DatabaseModule } from './database/database.module';
import { BridgeModule } from './bridge/bridge.module';

/**
 * 应用根模块
 *
 * 模块依赖关系（按加载顺序）：
 * 1. ConfigModule — 环境变量全局加载
 * 2. DatabaseModule — TypeORM MySQL 连接 + 5 张 AI 表 Entity 注册 ✅ R70-05 已接入
 * 3. ProvidersModule — DeepSeek / Ollama 模型服务商 ✅ R70-03 已接入
 * 4. BridgeModule — ServiceClient(HTTP 调用后端) + AuditLogger(审计日志) ✅ R70-05 已接入
 * 5. ToolsModule — ToolRegistry + ToolExecutor + EchoTool ✅ R70-04 已接入（R70-05 接入 AuditLogger）
 *
 * 后续任务将逐步导入以下模块：
 * - GatewayModule（gateway/）— SSE 流式对话 + 管理 API（R70-06）
 * - BrainModule（brain/）— 大脑引擎 + Agent Loop（R70-08）
 * - TenantModule（tenant/）— 多租户上下文 + 配置（R70-07）
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
  ],
  controllers: [AppController, AdminTestController],
  providers: [AppService],
})
export class AppModule {}
