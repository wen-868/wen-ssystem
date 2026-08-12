import { Injectable, Logger } from '@nestjs/common';
import {
  ChatMessage,
  ChatOptions,
  ChatResult,
  ConnectionTestResult,
  IModelProvider,
  ProviderConfig,
} from './provider.interface';
import { ProviderError } from './provider-error';

/**
 * Ollama Provider（占位实现）
 *
 * - API 地址：http://127.0.0.1:11434（本地部署）
 * - 计划在 R70-21 RAG 任务中完整实现（含 chat / embedding）
 * - 当前所有调用方法抛 501 NotImplemented，保证 ProviderFactory 可注册但不会被误用
 *
 * 设计目的：让 ProviderFactory 能识别 'ollama' 名称，避免工作台选择 Ollama 时报"未知 provider"。
 *
 * 实现说明：
 * - chat/chatSync/embedding 用普通函数 + throw（throw 是合法控制流，函数返回类型不强制要求 return）
 * - testConnection 返回 Promise.resolve（不抛错，便于工作台展示"未实现"状态而非 500）
 * - 这样避免 ESLint 的 require-await / require-yield 规则对占位 async/generator 函数的误报
 */
@Injectable()
export class OllamaProvider implements IModelProvider {
  readonly name = 'ollama';
  private readonly logger = new Logger(OllamaProvider.name);

  configure(config: ProviderConfig): void {
    // 占位实现：仅记录日志，不持久化（noUnusedLocals 严格模式不持久化未读取字段）
    this.logger.log(
      `Ollama 配置已接收（model=${config.model}, baseUrl=${config.baseUrl ?? '默认'}），但 Provider 尚未实现`,
    );
  }

  /**
   * 流式对话（占位）
   *
   * 直接抛 501 NotImplemented，调用方 try/catch 捕获。
   * 函数签名返回 AsyncGenerator，但 throw 是合法控制流，TypeScript 不强制 return。
   */
  chat(
    _messages: ChatMessage[],
    _options?: ChatOptions,
  ): AsyncGenerator<string, ChatResult, unknown> {
    throw new ProviderError(
      'Ollama Provider 暂未实现，计划在 R70-21 RAG 任务中完成',
      501,
      this.name,
    );
  }

  /**
   * 非流式对话（占位）
   *
   * 直接抛 501 NotImplemented，调用方 try/catch 捕获。
   */
  chatSync(
    _messages: ChatMessage[],
    _options?: ChatOptions,
  ): Promise<ChatResult> {
    throw new ProviderError(
      'Ollama Provider 暂未实现，计划在 R70-21 RAG 任务中完成',
      501,
      this.name,
    );
  }

  /**
   * 文本嵌入（占位）
   *
   * 直接抛 501 NotImplemented。
   */
  embedding(_text: string): Promise<number[]> {
    throw new ProviderError(
      'Ollama embedding 暂未实现，计划在 R70-21 RAG 任务中完成',
      501,
      this.name,
    );
  }

  /**
   * 连通性测试（占位）
   *
   * 不抛错，返回 success: false + 明确提示，便于工作台展示"未实现"状态。
   */
  testConnection(): Promise<ConnectionTestResult> {
    return Promise.resolve({
      success: false,
      message: 'Ollama Provider 尚未实现，请使用 DeepSeek',
      latencyMs: 0,
    });
  }
}
