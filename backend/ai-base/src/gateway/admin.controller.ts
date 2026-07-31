/**
 * Admin Controller — 管理接口
 *
 * 职责：
 * 1. 工具管理：列出所有已注册工具、手动执行工具
 * 2. Provider 管理：测试连通性、列出可用 Provider
 * 3. 系统监控：健康检查（后端可达性）、审计日志查询
 *
 * 端点列表：
 * - GET  /api/admin/tools             — 列出所有工具
 * - POST /api/admin/tools/execute     — 手动执行工具
 * - GET  /api/admin/test-connection   — 测试默认 Provider 连通性
 * - GET  /api/admin/providers         — 列出所有已注册 Provider
 * - GET  /api/admin/health            — 健康检查（后端 + 数据库 + AI 服务）
 * - GET  /api/admin/audit-logs        — 查询审计日志
 *
 * 注意：
 * - R70-07 多租户接入后，所有端点需加 TenantGuard（从 JWT 解析 tenantId）
 * - 当前阶段 tenantId 通过查询参数传入（测试用）
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-01
 */
import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { ProviderFactory } from '../providers/provider-factory';
import { ToolRegistry } from '../tools/tool-registry';
import { ToolExecutor } from '../tools/tool-executor';
import { ServiceClient } from '../bridge/service-client';
import { AuditLogger } from '../bridge/audit-logger';
import type { ToolCall } from '../providers/provider.interface';
import type {
  ToolContext,
  ToolMeta,
  ToolResult,
} from '../tools/tool.interface';
import { ChatTestDto } from './dto/chat-test.dto';
import { ExecuteToolDto } from './dto/execute-tool.dto';

@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly factory: ProviderFactory,
    private readonly registry: ToolRegistry,
    private readonly executor: ToolExecutor,
    private readonly serviceClient: ServiceClient,
    private readonly auditLogger: AuditLogger,
  ) {}

  // ──────────────────────────────────────────────────────────────
  // 工具管理
  // ──────────────────────────────────────────────────────────────

  /**
   * 列出所有已注册工具
   *
   * GET /api/admin/tools
   */
  @Get('tools')
  listTools(): { total: number; tools: ToolMeta[] } {
    const tools = this.registry.list();
    this.logger.log(`收到 tools 请求，返回 ${tools.length} 个工具`);
    return { total: tools.length, tools };
  }

  /**
   * 手动执行工具（测试/调试用）
   *
   * POST /api/admin/tools/execute
   */
  @Post('tools/execute')
  async executeTool(@Body() dto: ExecuteToolDto): Promise<ToolResult> {
    this.logger.log(
      `收到 tools/execute 请求：name="${dto.name}", tenantId="${dto.context.tenantId}"`,
    );

    const toolCall: ToolCall = {
      id: `manual_${Date.now()}`,
      type: 'function',
      function: {
        name: dto.name,
        arguments: JSON.stringify(dto.args ?? {}),
      },
    };

    const context: ToolContext = {
      tenantId: dto.context.tenantId,
      userId: dto.context.userId,
      sessionId: dto.context.sessionId,
      requestId: dto.context.requestId,
      role: dto.context.role,
    };

    return this.executor.executeToolCall(toolCall, context);
  }

  // ──────────────────────────────────────────────────────────────
  // Provider 管理
  // ──────────────────────────────────────────────────────────────

  /**
   * 测试默认 Provider 连通性
   *
   * GET /api/admin/test-connection
   */
  @Get('test-connection')
  async testConnection(): Promise<{
    type: string;
    success: boolean;
    message: string;
    latencyMs: number;
  }> {
    this.logger.log('收到 test-connection 请求');
    return this.factory.testConnection();
  }

  /**
   * 列出所有已注册 Provider
   *
   * GET /api/admin/providers
   */
  @Get('providers')
  listProviders(): { total: number; providers: Array<{ type: string; name: string }> } {
    const providers = this.factory.listWithDetails();
    return { total: providers.length, providers };
  }

  // ──────────────────────────────────────────────────────────────
  // 非流式对话测试（R70-03 验收遗留，保留兼容）
  // ──────────────────────────────────────────────────────────────

  /**
   * 非流式对话测试
   *
   * POST /api/admin/chat-test
   */
  @Post('chat-test')
  async chatTest(@Body() dto: ChatTestDto): Promise<{
    provider: string;
    content: string;
    toolCalls?: unknown;
    usage: { promptTokens: number; completionTokens: number };
    finishReason?: string;
  }> {
    this.logger.log(
      `收到 chat-test 请求：message="${dto.message.slice(0, 50)}..."`,
    );
    const provider = this.factory.getDefault();
    const result = await provider.chatSync([
      { role: 'user', content: dto.message },
    ]);
    return {
      provider: provider.name,
      content: result.content,
      toolCalls: result.tool_calls,
      usage: {
        promptTokens: result.prompt_tokens,
        completionTokens: result.completion_tokens,
      },
      finishReason: result.finish_reason,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // 系统监控
  // ──────────────────────────────────────────────────────────────

  /**
   * 健康检查
   *
   * GET /api/admin/health
   *
   * 检查项：
   * 1. AI 底座服务状态（自身，总是 ok）
   * 2. 后端 API 可达性（通过 ServiceClient.healthCheck）
   * 3. Provider 状态（通过 factory.list()）
   */
  @Get('health')
  async healthCheck(): Promise<{
    status: 'ok' | 'degraded' | 'down';
    aiBase: { status: string; uptime: number };
    backend: { reachable: boolean; latencyMs: number; error?: string };
    providers: string[];
    timestamp: string;
  }> {
    const backendHealth = await this.serviceClient.healthCheck();

    let status: 'ok' | 'degraded' | 'down' = 'ok';
    if (!backendHealth.reachable) {
      status = 'degraded';
    }

    return {
      status,
      aiBase: {
        status: 'running',
        uptime: process.uptime(),
      },
      backend: backendHealth,
      providers: this.factory.list(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 查询审计日志
   *
   * GET /api/admin/audit-logs?tenantId=xxx&page=1&pageSize=20
   *
   * 查询参数：
   * - tenantId（必填）：租户 ID
   * - startDate（可选）：开始日期 YYYY-MM-DD
   * - endDate（可选）：结束日期 YYYY-MM-DD
   * - intent（可选）：意图标签
   * - sessionId（可选）：会话 ID
   * - page（可选）：页码，默认 1
   * - pageSize（可选）：每页条数，默认 20
   */
  @Get('audit-logs')
  async queryAuditLogs(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('intent') intent?: string,
    @Query('sessionId') sessionId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<{ list: unknown[]; total: number; page: number; pageSize: number }> {
    if (!tenantId) {
      return { list: [], total: 0, page: 1, pageSize: 20 };
    }

    const result = await this.auditLogger.queryAuditLogs(tenantId, {
      startDate,
      endDate,
      intent,
      sessionId,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });

    return {
      list: result.list,
      total: result.total,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
  }
}
