import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProvidersModule } from './providers/providers.module';
import { ToolsModule } from './tools/tools.module';
import { AdminTestController } from './gateway/admin-test.controller';

/**
 * 应用根模块
 *
 * 后续任务将按 P0 优先级矩阵逐步导入以下模块：
 * - GatewayModule（gateway/）— SSE 流式对话 + 管理 API
 * - BrainModule（brain/）— 大脑引擎 + Agent Loop
 * - ProvidersModule（providers/）— DeepSeek / Ollama 模型服务商 ✅ R70-03 已接入
 * - ToolsModule（tools/）— 业务工具注册与执行 ✅ R70-04 已接入
 * - BridgeModule（bridge/）— 后端服务桥接 + 审计日志
 * - TenantModule（tenant/）— 多租户上下文 + 配置
 * - DatabaseModule（database/）— TypeORM Entity
 * - RagModule（rag/）— 知识库检索增强
 */
@Module({
  imports: [
    // 环境变量全局加载
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    // Provider 层（DeepSeek + Ollama + ProviderFactory）
    ProvidersModule,
    // Tool 系统（ToolRegistry + ToolExecutor + EchoTool 示例工具）
    ToolsModule,
  ],
  controllers: [AppController, AdminTestController],
  providers: [AppService],
})
export class AppModule {}
