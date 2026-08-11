/**
 * Orchestrator — Agent Loop 编排器
 *
 * 职责：
 * 1. 编排完整的 Agent Loop：加载历史 → 构建上下文 → LLM调用 → 工具执行 → 结果处理
 * 2. 支持流式输出（AsyncGenerator 逐步 yield 事件）
 * 3. 最大 10 轮循环，防止死循环
 * 4. 对话历史持久化（MemoryManager）
 * 5. 审计日志记录（AuditLogger）
 *
 * Agent Loop 流程：
 *   用户消息 → 加载历史 → 构建上下文 → LLM调用 → 判断结果
 *     │
 *     ├─ 纯文本（stop）→ 流式输出 → 保存记忆 → 写审计日志 → 结束
 *     │
 *     ├─ 工具调用（tool_calls）→ 执行工具 → 结果加入上下文 → 回到 LLM调用
 *     │
 *     └─ 达到长度限制（length）→ 截断输出 → 结束
 *
 * 事件类型（OrchestratorEvent）：
 *   - { type: 'text', content: string }           — LLM 生成的增量文本
 *   - { type: 'tool_start', tool: string }         — 开始执行工具
 *   - { type: 'tool_result', tool: string, ... }   — 工具执行结果
 *   - { type: 'done', conversationId, usage }      — 对话完成
 *   - { type: 'error', message: string }           — 错误事件
 *
 * 对应文档：
 * - docs/ai-base/智享AI底座-开发文档.md 第八章 8.1 Orchestrator
 * - docs/ai-base/智享AI底座-架构设计文档.md 第九章 核心数据流
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-01
 */
import { Injectable, Logger } from '@nestjs/common';
import { ProviderFactory } from '../providers/provider-factory';
import { ToolExecutor } from '../tools/tool-executor';
import { ToolRegistry } from '../tools/tool-registry';
import { AuditLogger } from '../bridge/audit-logger';
import { AiConfigService } from '../tenant/ai-config.service';
import { TenantContext } from '../tenant/tenant-context';
import { ContextBuilder } from './context-builder.service';
import { MemoryManager } from './memory-manager.service';
import { ConfirmationService } from './confirmation.service';
import type { ChatMessage, ChatResult } from '../providers/provider.interface';
import type { ToolContext, ToolResult } from '../tools/tool.interface';

/** Agent Loop 最大迭代次数（防止死循环） */
const MAX_ITERATIONS = 10;

/**
 * Orchestrator 产出的事件
 *
 * ChatController 将此转为 SSE 格式发送给前端。
 */
export type OrchestratorEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; tool: string }
  | {
      type: 'tool_result';
      tool: string;
      success: boolean;
      data?: unknown;
      error?: string;
      /** R70-15：写操作预览（工具返回 preview 时携带，供前端渲染确认卡片） */
      preview?: ToolResult['preview'];
      /** R70-15：待确认操作 ID（写操作预览时由 ConfirmationService 生成） */
      confirmationId?: string;
    }
  | {
      type: 'done';
      conversationId: string;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        latencyMs: number;
        iterations: number;
      };
    }
  | { type: 'error'; message: string };

/**
 * Orchestrator 执行参数
 */
export interface OrchestratorParams {
  /** 用户消息 */
  message: string;
  /** 会话 ID（不传则自动生成） */
  conversationId?: string;
  /** 租户 ID（不传则从 TenantContext 获取） */
  tenantId?: string;
  /** 用户 ID */
  userId?: string;
  /** 用户角色 */
  role?: string;
  /** JWT auth token（透传给 ServiceClient） */
  authToken?: string;
}

@Injectable()
export class Orchestrator {
  private readonly logger = new Logger(Orchestrator.name);

  constructor(
    private readonly factory: ProviderFactory,
    private readonly executor: ToolExecutor,
    private readonly registry: ToolRegistry,
    private readonly auditLogger: AuditLogger,
    private readonly aiConfigService: AiConfigService,
    private readonly tenantContext: TenantContext,
    private readonly contextBuilder: ContextBuilder,
    private readonly memoryManager: MemoryManager,
    private readonly confirmationService: ConfirmationService,
  ) {}

  /**
   * 执行 Agent Loop（流式）
   *
   * 返回 AsyncGenerator，调用方逐个消费事件。
   *
   * 用法：
   *   for await (const event of orchestrator.run(params)) {
   *     // 处理事件（转 SSE / 转 WebSocket / ...）
   *   }
   */
  async *run(params: OrchestratorParams): AsyncGenerator<OrchestratorEvent> {
    // ── 1. 解析租户信息 ──
    const ctxData = this.tenantContext.getData();
    const tenantId = params.tenantId ?? ctxData?.tenantId;
    const userId = params.userId ?? ctxData?.userId;
    const role = params.role ?? ctxData?.role;
    const authToken = params.authToken ?? ctxData?.authToken;

    if (!tenantId) {
      yield {
        type: 'error',
        message: '未认证：无法确定租户身份（无 JWT 且未传入 tenantId）',
      };
      return;
    }

    // 生成或复用会话 ID
    const conversationId =
      params.conversationId ?? this.memoryManager.generateSessionId();

    this.logger.log(
      `Agent Loop 启动：tenant=${tenantId} user=${userId ?? 'anonymous'} session=${conversationId} msg="${params.message.slice(0, 50)}..."`,
    );

    // ── 2. 获取租户 AI 配置 ──
    let providerName = 'unknown';
    let modelName: string | undefined;
    let systemPrompt: string | null = null;

    try {
      const resolvedConfig = await this.aiConfigService.getResolvedConfig();
      providerName = resolvedConfig.provider;
      modelName = resolvedConfig.model;
      systemPrompt = resolvedConfig.systemPrompt;

      this.logger.log(
        `租户 ${tenantId} AI 配置：provider=${providerName} model=${modelName} source=${resolvedConfig.source}`,
      );

      // 创建 Provider
      const provider = this.factory.create(
        resolvedConfig.provider,
        resolvedConfig.providerConfig,
      );

      // ── 3. 加载对话历史 ──
      const history = await this.memoryManager.loadHistory(
        tenantId,
        conversationId,
      );
      if (history.length > 0) {
        this.logger.debug(`加载对话历史：${history.length} 条消息`);
      }

      // ── 4. 构建上下文 ──
      // R70-21：build 已升级为异步（内部做 RAG 知识库检索注入，embedding 未配置时自动跳过）
      const messages = await this.contextBuilder.build(
        {
          tenantId,
          userId,
          role,
          userMessage: params.message,
          history,
          systemPrompt: systemPrompt ?? undefined,
        },
        this.registry,
      );

      // 工具定义（供 LLM function calling）
      const toolDefinitions = this.registry.toToolDefinitions();

      // 构造工具执行上下文
      const toolContext: ToolContext = {
        tenantId,
        userId,
        sessionId: conversationId,
        role,
        authToken,
      };

      // ── 5. Agent Loop ──
      const startTime = Date.now();
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;
      const allToolCalls: Record<string, unknown>[] = [];
      // 工具结果记录：模型未输出总结文本时用于生成兜底摘要
      const toolResults: Array<{
        tool: string;
        success: boolean;
        data?: unknown;
        error?: string;
      }> = [];
      let finalAssistantText = '';
      const newMessagesToSave: ChatMessage[] = [
        { role: 'user', content: params.message },
      ];

      let iteration = 0;

      for (; iteration < MAX_ITERATIONS; iteration++) {
        this.logger.debug(`Agent Loop 第 ${iteration + 1} 轮`);

        // 调用 LLM（流式）
        const generator = provider.chat(messages, {
          tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
          temperature: resolvedConfig.temperature,
          max_tokens: resolvedConfig.maxTokens,
        });

        // 消费流式生成器
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
            yield { type: 'text', content: value };
          }
        } catch (genErr) {
          throw new Error(
            `LLM 流式生成失败：${genErr instanceof Error ? genErr.message : String(genErr)}`,
          );
        }

        // 累计 token
        totalPromptTokens += chatResult!.prompt_tokens;
        totalCompletionTokens += chatResult!.completion_tokens;

        // 检查工具调用
        const toolCalls = chatResult!.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
          // 无工具调用，对话结束
          finalAssistantText = contentBuf;
          // assistant 消息加入待保存列表
          newMessagesToSave.push({
            role: 'assistant',
            content: contentBuf,
          });
          break;
        }

        // 有工具调用
        // 先把 assistant 消息（含 tool_calls）加入上下文
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: contentBuf,
          tool_calls: toolCalls,
        };
        messages.push(assistantMsg);
        newMessagesToSave.push(assistantMsg);

        // 执行工具
        for (const tc of toolCalls) {
          yield {
            type: 'tool_start',
            tool: tc.function.name,
          };

          this.logger.debug(`执行工具：${tc.function.name}`);

          const toolResult = await this.executor.executeToolCall(
            tc,
            toolContext,
          );

          // ── R70-15：写操作预览 → 注册待确认操作 ──
          // 工具返回 preview（写操作未确认）时，由 ConfirmationService 生成
          // confirmationId，并在 tool_result 事件中携带，供前端渲染确认卡片。
          let confirmationId: string | undefined;
          if (toolResult.preview) {
            try {
              const confirmation = this.confirmationService.create({
                tenantId,
                conversationId,
                toolName: tc.function.name,
                args: JSON.parse(tc.function.arguments) as Record<
                  string,
                  unknown
                >,
                preview: toolResult.preview,
                operationLabel:
                  toolResult.preview.operation ?? tc.function.name,
              });
              confirmationId = confirmation.confirmationId;
            } catch (err) {
              this.logger.warn(
                `注册待确认操作失败：${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }

          yield {
            type: 'tool_result',
            tool: tc.function.name,
            success: toolResult.success,
            data: toolResult.data,
            error: toolResult.error,
            preview: toolResult.preview,
            confirmationId,
          };

          allToolCalls.push({
            tool_name: tc.function.name,
            success: toolResult.success,
            error: toolResult.error,
          });
          toolResults.push({
            tool: tc.function.name,
            success: toolResult.success,
            data: toolResult.data,
            error: toolResult.error,
          });

          // 工具结果加入消息历史
          const toolMsg: ChatMessage = {
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(toolResult),
          };
          messages.push(toolMsg);
          newMessagesToSave.push(toolMsg);
        }

        // 工具执行完毕，继续下一轮 LLM 调用
      }

      if (iteration >= MAX_ITERATIONS) {
        this.logger.warn(
          `Agent Loop 达到最大迭代次数 ${MAX_ITERATIONS}，强制终止`,
        );
      }

      // ── 5.5 兜底总结：模型未输出任何文本但执行过工具时，用工具结果生成摘要 ──
      // 解决模型在工具调用后直接结束（无总结文本）导致前端只显示工具 JSON 的问题
      if (finalAssistantText.trim().length === 0 && toolResults.length > 0) {
        const fallbackText = this.buildFallbackSummary(toolResults);
        yield { type: 'text', content: fallbackText };
        // 将兜底摘要写入最后一条 assistant 消息（供对话历史保存）
        for (let i = newMessagesToSave.length - 1; i >= 0; i--) {
          const m = newMessagesToSave[i];
          if (m.role === 'assistant' && !m.content) {
            m.content = fallbackText;
            break;
          }
        }
      }

      // ── 6. 保存对话历史 ──
      await this.memoryManager.saveHistory(
        tenantId,
        conversationId,
        newMessagesToSave,
      );

      // ── 7. 发送 done 事件 ──
      const latencyMs = Date.now() - startTime;
      yield {
        type: 'done',
        conversationId,
        usage: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
          latencyMs,
          iterations: iteration + 1,
        },
      };

      // ── 8. 审计日志 ──
      this.auditLogger.logAiCall({
        tenantId,
        userId,
        sessionId: conversationId,
        provider: providerName,
        model: modelName,
        intent: 'chat',
        userMessage: params.message,
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        latencyMs,
        success: true,
      });

      this.logger.log(
        `Agent Loop 完成：session=${conversationId} iterations=${iteration + 1} tokens=${totalPromptTokens + totalCompletionTokens} latency=${latencyMs}ms tools=${allToolCalls.length}`,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Agent Loop 失败：${errorMsg}`,
        err instanceof Error ? err.stack : undefined,
      );

      yield {
        type: 'error',
        message: `对话处理失败：${errorMsg}`,
      };

      // 审计日志：记录失败的 AI 调用
      this.auditLogger.logAiCall({
        tenantId,
        userId,
        sessionId: conversationId,
        provider: providerName,
        model: modelName,
        intent: 'chat',
        userMessage: params.message,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
        success: false,
        errorMessage: errorMsg,
      });
    }
  }

  /**
   * 工具结果兜底摘要：模型未输出总结时，从工具返回数据生成可读中文摘要。
   * 覆盖高频工具（销售单/报表/查询类），未覆盖的工具给出通用提示。
   */
  private buildFallbackSummary(
    toolResults: Array<{
      tool: string;
      success: boolean;
      data?: unknown;
      error?: string;
    }>,
  ): string {
    const parts: string[] = [];
    for (const tr of toolResults) {
      if (!tr.success) {
        parts.push(`「${tr.tool}」执行失败：${tr.error || '未知错误'}`);
        continue;
      }
      const d = (tr.data ?? {}) as Record<string, unknown>;
      switch (tr.tool) {
        case 'createSalesOrder': {
          const items = Array.isArray(d.items)
            ? (d.items as Array<Record<string, unknown>>)
            : [];
          const itemText = items
            .map((it) => {
              const name = String(it.skuName ?? it.productName ?? '');
              const box = it.boxQty ? `${it.boxQty}箱` : '';
              const bottle = it.bottleQty ? `${it.bottleQty}瓶` : '';
              const price =
                it.totalPrice != null ? `（¥${it.totalPrice}）` : '';
              return [name, box, bottle, price].filter(Boolean).join(' ');
            })
            .filter(Boolean)
            .join('、');
          parts.push(
            `销售单 ${d.billNo ?? ''} 创建成功：客户 ${d.customerName ?? '未知'}，` +
              `${itemText || `${d.itemCount ?? ''} 种商品`}，` +
              `总金额 ¥${d.totalAmount ?? '未知'}。`,
          );
          break;
        }
        case 'salesReport': {
          const list = Array.isArray(d.list) ? d.list : [];
          parts.push(
            `销售报表查询完成：${d.reportType === 'trend' ? '趋势报表' : '日报'}，` +
              `日期 ${d.dateStart ?? '-'} 至 ${d.dateEnd ?? '-'}，` +
              `共 ${list.length} 条记录。`,
          );
          break;
        }
        case 'querySaleBills': {
          const list = Array.isArray(d.list) ? d.list : [];
          parts.push(`共查询到 ${list.length} 张销售单。`);
          break;
        }
        case 'searchProduct': {
          const list = Array.isArray(d.list) ? d.list : [];
          parts.push(`共找到 ${list.length} 个匹配商品。`);
          break;
        }
        case 'searchCustomer': {
          const list = Array.isArray(d.list) ? d.list : [];
          parts.push(`共找到 ${list.length} 个匹配客户。`);
          break;
        }
        case 'checkInventory': {
          const list = Array.isArray(d.list) ? d.list : [];
          parts.push(`库存查询完成，共 ${list.length} 条记录。`);
          break;
        }
        case 'queryReceivables': {
          const list = Array.isArray(d.list) ? d.list : [];
          parts.push(`应收账款查询完成，共 ${list.length} 条记录。`);
          break;
        }
        case 'queryPayables': {
          const list = Array.isArray(d.list) ? d.list : [];
          parts.push(`应付账款查询完成，共 ${list.length} 条记录。`);
          break;
        }
        default: {
          parts.push(`「${tr.tool}」执行完成。`);
        }
      }
    }
    return parts.join('\n');
  }
}
