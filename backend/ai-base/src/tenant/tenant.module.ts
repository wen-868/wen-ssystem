/**
 * TenantModule — 多租户模块
 *
 * 职责：
 * 1. 注册 TenantContext / CryptoService / AiConfigService 为 NestJS Provider
 * 2. 注册 TenantMiddleware，应用于 /chat 路由（SSE 对话需要租户上下文）
 * 3. 导出 TenantContext / CryptoService / AiConfigService 供其他模块注入
 *
 * 依赖：
 * - DatabaseModule（TypeORM Repository：TenantAiConfigEntity / PlatformAiConfigEntity）
 * - ConfigService（JWT_SECRET / ENCRYPTION_KEY）
 *
 * 被 AppModule 导入，GatewayModule 也会导入以获取 AiConfigService。
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-01
 */
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantAiConfigEntity } from '../database/entities/tenant-ai-config.entity';
import { PlatformAiConfigEntity } from '../database/entities/platform-ai-config.entity';
import { TenantContext } from './tenant-context';
import { CryptoService } from './crypto.service';
import { AiConfigService } from './ai-config.service';
import { TenantMiddleware } from './tenant.middleware';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantAiConfigEntity, PlatformAiConfigEntity]),
  ],
  providers: [TenantContext, CryptoService, AiConfigService, TenantMiddleware],
  exports: [TenantContext, CryptoService, AiConfigService],
})
export class TenantModule implements NestModule {
  /**
   * 注册中间件
   *
   * TenantMiddleware 应用于 /chat 路由（POST /api/chat SSE 对话）。
   * Admin 路由（/admin/*）不应用此中间件，管理 API 无需租户上下文。
   *
   * 注意：forRoutes('chat') 匹配的是控制器路径（不含全局前缀 /api），
   * 实际匹配的 HTTP 路径为 POST /api/chat。
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('chat');
  }
}
