/**
 * 对话请求 DTO
 *
 * 用于 POST /api/chat 端点，接收用户消息并返回 SSE 流式响应。
 *
 * 当前阶段（R70-06）：tenantId 由请求体传入（测试用）。
 * R70-07 多租户接入后：tenantId 从 JWT 解析（TenantGuard 注入），请求体不再需要 tenantId。
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-01
 */
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class ChatDto {
  /** 用户消息内容（必填，最长 4000 字符） */
  @IsString({ message: 'message 必须是字符串' })
  @IsNotEmpty({ message: 'message 不能为空' })
  @MaxLength(4000, { message: 'message 不能超过 4000 字符' })
  message!: string;

  /** 会话 ID（可选，用于关联多轮对话上下文）
   *
   * 传入时：R70-08 Brain Engine 从 Redis 恢复对话历史
   * 不传时：创建新会话
   */
  @IsOptional()
  @IsString()
  conversationId?: string;

  /** 租户 ID（可选，R70-07 后由 JWT 自动解析）
   *
   * R70-07 多租户接入后：tenantId 从 JWT 解析（TenantMiddleware 注入 TenantContext），
   * 请求体不再需要传入。保留为可选字段仅用于过渡兼容（无 JWT 时从 body 读取）。
   */
  @IsOptional()
  @IsString()
  tenantId?: string;

  /** 用户 ID（可选，用于审计日志） */
  @IsOptional()
  @IsString()
  userId?: string;

  /** 用户角色（可选，用于权限校验） */
  @IsOptional()
  @IsString()
  role?: string;
}
