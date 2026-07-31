import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { ProviderFactory } from '../providers/provider-factory';
import { ChatTestDto } from './dto/chat-test.dto';

/**
 * 临时管理测试 Controller（R70-03 验收用）
 *
 * 提供两个端点用于验证 Provider 层是否正常工作：
 * - GET  /api/admin/test-connection — 测试默认 Provider 连通性
 * - POST /api/admin/chat-test       — 非流式对话测试
 *
 * 重要：本 Controller 在 R70-06 Gateway 任务中会被正式的 AdminController + ChatController 替代。
 * 当前仅用于验收，不暴露给业务前端。
 *
 * 注意：所有调用必须通过 IModelProvider 接口，禁止在 Controller 里直接调 axios。
 */
@Controller('admin')
export class AdminTestController {
  private readonly logger = new Logger(AdminTestController.name);

  constructor(private readonly factory: ProviderFactory) {}

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
}
