import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * 应用根模块
 *
 * 后续任务将按 P0 优先级矩阵逐步导入以下模块：
 * - GatewayModule（gateway/）— SSE 流式对话 + 管理 API
 * - BrainModule（brain/）— 大脑引擎 + Agent Loop
 * - ProvidersModule（providers/）— DeepSeek / Ollama 模型服务商
 * - ToolsModule（tools/）— 业务工具注册与执行
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
