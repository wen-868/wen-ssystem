/**
 * Chat Controller — SSE 流式对话接口
 *
 * 职责：
 * 1. 接收用户消息，通过 Provider 调用 LLM 生成回复
 * 2. 以 SSE（Server-Sent Events）流式返回增量文本
 * 3. 支持工具调用（Function Calling）：LLM 返回 tool_calls → 执行工具 → 结果回传 LLM → 继续生成
 * 4. 审计日志：每次对话完成记录 token 消耗、工具调用、延迟
 * 5. 多租户：从 TenantContext 获取租户信息，按租户配置选择 Provider/模型（R70-07）
 *
 * SSE 事件格式（每行 `data: {JSON}\n\n`）：
 * - {"type":"text","content":"增量文本"}      — LLM 生成的文本片段
 * - {"type":"tool_start","tool":"工具名"}       — 开始执行工具
 * - {"type":"tool_result","tool":"工具名","success":true,"data":{...}} — 工具执行结果
 * - {"type":"done","conversationId":"xxx","usage":{...}} — 对话结束
 * - {"type":"error","message":"错误描述"}       — 错误事件
 *
 * 当前阶段（R70-07）实现简化版 Agent Loop：
 * - 直接在 Controller 内编排 LLM 调用 + 工具执行循环
 * - R70-08 Brain Engine 接入后，Agent Loop 逻辑迁移到 Orchestrator，Controller 仅负责 SSE 传输
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-01
 */
import {
  Body,
  Controller,
  Logger,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProviderFactory } from '../providers/provider-factory';
import { ToolExecutor } from '../tools/tool-executor';
import { ToolRegistry } from '../tools/tool-registry';
import { AuditLogger } from '../bridge/audit-logger';
import { AiConfigService } from '../tenant/ai-config.service';
import { TenantContext } from '../tenant/tenant-context';
import type {
  ChatMessage,
  ChatResult,
} from '../providers/provider.interface';
import type { ToolContext } from '../tools/tool.interface';
import { ChatDto } from './dto/chat.dto';

/** Agent Loop 最大迭代次数（防止死循环） */
const MAX_ITERATIONS = 10;

/** 默认系统提示词（租户未配置自定义提示词时使用） */
const DEFAULT_SYSTEM_PROMPT = `你是"智享AI助手"，一个为酒水行业进销存管理系统设计的智能助手。

你的能力：
1. 销售管理：查询/创建销售单、查询客户信息、查询商品信息
2. 库存管理：查询库存、库存调拨、盘点
3. 采购管理：查询/创建采购单
4. 财务管理：查询对账、费用记录
5. 报表分析：销售报表、库存报表

你的规则：
1. 当用户需要查询或操作数据时，使用可用的工具（function calling）完成
2. 创建订单等写操作时，先向用户确认信息无误后再执行
3. 回答简洁专业，避免冗余解释
4. 不确定的信息要明确告知用户，不要编造数据
5. 所有金额单位为"元"，日期格式为"YYYY-MM-DD"`;

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly factory: ProviderFactory,
    private readonly executor: ToolExecutor,
    private readonly registry: ToolRegistry,
    private readonly auditLogger: AuditLogger,
    private readonly aiConfigService: AiConfigService,
    private readonly tenantContext: TenantContext,
  ) {}

  /**
   * SSE 流式对话
   *
   * POST /api/chat
   * Content-Type: application/json
   * Accept: text/event-stream
   *
   * 请求体：{ "message": "你好" }
   * Headers: Authorization: Bearer <JWT>（TenantMiddleware 自动解析 tenantId）
   *
   * 响应：SSE 流式事件
   */
  @Post()
  async chat(@Body() dto: ChatDto, @Res() res: Response): Promise<void> {
    // ── 多租户：从 TenantContext 获取租户信息（R70-07）──
    const ctxData = this.tenantContext.getData();
    const tenantId = ctxData?.tenantId ?? dto.tenantId;

    if (!tenantId) {
      this.logger.warn('对话请求缺少 tenantId（无 JWT 且请求体未传入）');
      res.status(401).json({
        statusCode: 401,
        message: '未认证：请在 Authorization Header 中携带 JWT，或在请求体中传入 tenantId',
      });
      return;
    }

    const userId = ctxData?.userId ?? dto.userId;
    const role = ctxData?.role ?? dto.role;
    const authToken = ctxData?.authToken;

    this.logger.log(
      `收到对话请求：tenant=${tenantId} user=${userId ?? 'anonymous'} msg="${dto.message.slice(0, 50)}..."`,
    );

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx 关闭缓冲
    res.flushHeaders();

    // 构造执行上下文（含 authToken，ServiceClient 透传给后端 API）
    const context: ToolContext = {
      tenantId,
      userId,
      sessionId: dto.conversationId,
      role,
      authToken,
    };

    // 生成会话 ID（如果未传入）
    const conversationId = dto.conversationId ?? `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 累计统计
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    const allToolCalls: Record<string, unknown>[] = [];
    const startTime = Date.now();
    let lastError: string | undefined;
    let providerName = 'unknown';
    let modelName: string | undefined;

    try {
      // ── 获取租户 AI 配置（R70-07 多租户）──
      const resolvedConfig = await this.aiConfigService.getResolvedConfig();
      providerName = resolvedConfig.provider;
      modelName = resolvedConfig.model;

      this.logger.log(
        `租户 ${tenantId} AI 配置：provider=${resolvedConfig.provider} model=${resolvedConfig.model} source=${resolvedConfig.source}`,
      );

      // 获取 Provider（按租户配置创建）
      const provider = this.factory.create(
        resolvedConfig.provider,
        resolvedConfig.providerConfig,
      );

      // 系统提示词（租户自定义 > 默认）
      const systemPrompt = resolvedConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

      // 对话消息历史
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: dto.message },
      ];

      // 获取工具定义列表（供 LLM function calling 使用）
      const toolDefinitions = this.registry.toToolDefinitions();

      // ─── Agent Loop（简化版，R70-08 将迁移到 Orchestrator）───
      for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        this.logger.debug(`Agent Loop 第 ${iteration + 1} 轮`);

        // 调用 LLM（流式）
        const generator = provider.chat(messages, {
          tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
          temperature: resolvedConfig.temperature,
          max_tokens: resolvedConfig.maxTokens,
        });

        // 消费流式生成器，逐 chunk 发送 SSE
        let chatResult: ChatResult;
        let contentBuf = '';
        try {
          while (true) {
            const { value, done } = await generator.next();
            if (done) {
              chatResult = value;
              break;
            }
            // value 是增量文本
            contentBuf += value;
            this.sendSse(res, { type: 'text', content: value });
          }
        } catch (genErr) {
          // 流式生成过程中出错（如网络中断）
          throw new Error(
            `LLM 流式生成失败：${genErr instanceof Error ? genErr.message : String(genErr)}`,
          );
        }

        // 累计 token 用量
        totalPromptTokens += chatResult!.prompt_tokens;
        totalCompletionTokens += chatResult!.completion_tokens;

        // 检查是否有工具调用
        const toolCalls = chatResult!.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
          // 无工具调用，对话结束
          break;
        }

        // 有工具调用，执行工具
        // 先把 assistant 消息（含 tool_calls）加入历史
        messages.push({
          role: 'assistant',
          content: contentBuf,
          tool_calls: toolCalls,
        });

        // 逐个执行工具并发送 SSE 事件
        for (const tc of toolCalls) {
          this.sendSse(res, { type: 'tool_start', tool: tc.function.name });
          this.logger.debug(`执行工具：${tc.function.name}`);

          const toolResult = await this.executor.executeToolCall(tc, context);

          this.sendSse(res, {
            type: 'tool_result',
            tool: tc.function.name,
            success: toolResult.success,
            data: toolResult.data,
            error: toolResult.error,
          });

          // 记录工具调用摘要（供审计日志）
          allToolCalls.push({
            tool_name: tc.function.name,
            success: toolResult.success,
            error: toolResult.error,
          });

          // 将工具结果加入消息历史（供 LLM 下一轮使用）
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(toolResult),
          });
        }

        // 工具执行完毕，继续下一轮 LLM 调用（LLM 会基于工具结果继续生成回复）
      }

      // Agent Loop 结束，发送 done 事件
      const latencyMs = Date.now() - startTime;
      this.sendSse(res, {
        type: 'done',
        conversationId,
        usage: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
          latencyMs,
        },
      });

      // 审计日志：记录本次 AI 调用
      this.auditLogger.logAiCall({
        tenantId,
        userId,
        sessionId: conversationId,
        provider: providerName,
        model: modelName,
        intent: 'chat',
        userMessage: dto.message,
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        latencyMs,
        success: true,
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      this.logger.error(`对话失败：${lastError}`, err instanceof Error ? err.stack : undefined);

      // 发送错误事件
      this.sendSse(res, {
        type: 'error',
        message: `对话处理失败：${lastError}`,
      });

      // 审计日志：记录失败的 AI 调用
      this.auditLogger.logAiCall({
        tenantId,
        userId,
        sessionId: conversationId,
        provider: providerName,
        model: modelName,
        intent: 'chat',
        userMessage: dto.message,
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        latencyMs: Date.now() - startTime,
        success: false,
        errorMessage: lastError,
      });
    } finally {
      res.end();
    }
  }

  /**
   * 发送 SSE 事件
   *
   * 格式：`data: {JSON}\n\n`
   * 客户端用 EventSource API 接收，或用 fetch + ReadableStream 读取。
   */
  private sendSse(res: Response, data: Record<string, unknown>): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
