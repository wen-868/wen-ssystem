import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { ProviderFactory } from '../providers/provider-factory';
import { ToolRegistry } from '../tools/tool-registry';
import { ToolExecutor } from '../tools/tool-executor';
import type { ToolCall } from '../providers/provider.interface';
import type {
  ToolContext,
  ToolMeta,
  ToolResult,
} from '../tools/tool.interface';
import { ChatTestDto } from './dto/chat-test.dto';
import { ExecuteToolDto } from './dto/execute-tool.dto';

/**
 * 临时管理测试 Controller（R70-03 / R70-04 验收用）
 *
 * 提供以下端点用于验证 Provider 层和 Tool 系统是否正常工作：
 * - GET  /api/admin/test-connection — 测试默认 Provider 连通性（R70-03）
 * - POST /api/admin/chat-test       — 非流式对话测试（R70-03）
 * - GET  /api/admin/tools           — 列出所有已注册工具（R70-04）
 * - POST /api/admin/tools/execute   — 手动执行工具（R70-04）
 *
 * 重要：本 Controller 在 R70-06 Gateway 任务中会被正式的 AdminController + ChatController 替代。
 * 当前仅用于验收，不暴露给业务前端。
 *
 * 注意：
 * - 所有调用必须通过 IModelProvider / ITool 接口，禁止在 Controller 里直接调 axios
 * - 工具执行必须通过 ToolExecutor，禁止直接调 tool.execute（ToolExecutor 负责参数解析/错误兜底/审计）
 */
@Controller('admin')
export class AdminTestController {
  private readonly logger = new Logger(AdminTestController.name);

  constructor(
    private readonly factory: ProviderFactory,
    private readonly registry: ToolRegistry,
    private readonly executor: ToolExecutor,
  ) {}

  // ──────────────────────────────────────────────────────────────
  // Provider 层验收（R70-03）
  // ──────────────────────────────────────────────────────────────

  /**
   * 测试默认 Provider 连通性
   *
   * @returns { type, success, message, latencyMs }
   * - 未配置 API Key 时返回 success: false（接口本身正常工作）
   * - 配置正确时返回 success: true + 模型回复片段
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
   * 非流式对话测试
   *
   * @param dto { message: string }
   * @returns AI 回复内容 + token 用量
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
  // Tool 系统验收（R70-04）
  // ──────────────────────────────────────────────────────────────

  /**
   * 列出所有已注册工具
   *
   * @returns 工具元信息列表（含 name/description/category/isWriteOperation/parameters）
   *
   * 验收命令：curl http://localhost:3016/api/admin/tools
   */
  @Get('tools')
  listTools(): {
    total: number;
    tools: ToolMeta[];
  } {
    const tools = this.registry.list();
    this.logger.log(`收到 tools 请求，返回 ${tools.length} 个工具`);
    return {
      total: tools.length,
      tools,
    };
  }

  /**
   * 手动执行工具
   *
   * 用于验证 Tool 系统（ToolRegistry 注册 + ToolExecutor 执行）是否正常工作。
   *
   * @param dto { name, args, context }
   * @returns 工具执行结果 ToolResult
   *
   * 验收命令：
   * curl -X POST http://localhost:3016/api/admin/tools/execute \
   *   -H "Content-Type: application/json" \
   *   -d '{"name":"echo","args":{"message":"你好"},"context":{"tenantId":"test-tenant"}}'
   */
  @Post('tools/execute')
  async executeTool(@Body() dto: ExecuteToolDto): Promise<ToolResult> {
    this.logger.log(
      `收到 tools/execute 请求：name="${dto.name}", tenantId="${dto.context.tenantId}"`,
    );

    // 构造 ToolCall（模拟 LLM 返回的 function call 格式）
    const toolCall: ToolCall = {
      id: `manual_${Date.now()}`,
      type: 'function',
      function: {
        name: dto.name,
        arguments: JSON.stringify(dto.args ?? {}),
      },
    };

    // 构造执行上下文
    const context: ToolContext = {
      tenantId: dto.context.tenantId,
      userId: dto.context.userId,
      sessionId: dto.context.sessionId,
      requestId: dto.context.requestId,
      role: dto.context.role,
    };

    // 通过 ToolExecutor 执行（内部处理参数解析/工具查找/错误兜底/审计）
    return this.executor.executeToolCall(toolCall, context);
  }
}
