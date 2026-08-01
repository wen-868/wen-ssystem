/**
 * Chat Controller — SSE 流式对话接口
 *
 * 职责：
 * 1. 接收用户消息，委托 Orchestrator 执行 Agent Loop
 * 2. 将 Orchestrator 产出的事件转为 SSE 格式发送给前端
 * 3. 仅负责 HTTP/SSE 传输，不包含业务逻辑（Agent Loop 在 Orchestrator 中）
 *
 * SSE 事件格式（每行 `data: {JSON}\n\n`）：
 * - {"type":"text","content":"增量文本"}      — LLM 生成的文本片段
 * - {"type":"tool_start","tool":"工具名"}       — 开始执行工具
 * - {"type":"tool_result","tool":"工具名","success":true,"data":{...}} — 工具执行结果
 * - {"type":"done","conversationId":"xxx","usage":{...}} — 对话结束
 * - {"type":"error","message":"错误描述"}       — 错误事件
 *
 * R70-08 重构：Agent Loop 逻辑已迁移到 Orchestrator，Controller 仅负责 SSE 传输
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
import { Orchestrator } from '../brain/orchestrator.service';
import { TenantContext } from '../tenant/tenant-context';
import { ChatDto } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly orchestrator: Orchestrator,
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

    this.logger.log(
      `收到对话请求：tenant=${tenantId} user=${ctxData?.userId ?? dto.userId ?? 'anonymous'} msg="${dto.message.slice(0, 50)}..."`,
    );

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx 关闭缓冲
    res.flushHeaders();

    try {
      // ── 委托 Orchestrator 执行 Agent Loop，逐事件转 SSE ──
      for await (const event of this.orchestrator.run({
        message: dto.message,
        conversationId: dto.conversationId,
        tenantId,
        userId: ctxData?.userId ?? dto.userId,
        role: ctxData?.role ?? dto.role,
        authToken: ctxData?.authToken,
      })) {
        this.sendSse(res, event);
      }
    } catch (err) {
      // Orchestrator 内部已有 try-catch，此处兜底防止未捕获异常导致连接挂起
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`SSE 传输异常：${errMsg}`, err instanceof Error ? err.stack : undefined);
      this.sendSse(res, { type: 'error', message: `SSE 传输异常：${errMsg}` });
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
