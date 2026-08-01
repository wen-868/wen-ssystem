/**
 * ContextBuilder — 上下文构建器
 *
 * 职责：
 * 1. 组装 System Prompt（角色设定 + 业务规则 + 可用工具列表 + 租户信息）
 * 2. 合并 对话历史（MemoryManager 加载） + 用户消息
 * 3. 返回完整的 ChatMessage[] 供 LLM 调用
 *
 * System Prompt 结构：
 *   - 角色身份（智享AI助手 + 租户ID + 用户角色）
 *   - 能力列表（按业务域列出可用 Tool）
 *   - 工作规则（写操作确认 / 金额精确 / 结果表格化 / 异常如实告知）
 *   - 可用工具描述（ToolRegistry 生成）
 *
 * 对应文档：
 * - docs/ai-base/智享AI底座-开发文档.md 第八章 8.2 ContextBuilder
 * - docs/ai-base/智享AI底座-架构设计文档.md 第九章 核心数据流
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-01
 */
import { Injectable } from '@nestjs/common';
import type { ChatMessage } from '../providers/provider.interface';
import type { ToolRegistry } from '../tools/tool-registry';

/** ContextBuilder 构建参数 */
export interface BuildContextParams {
  /** 租户 ID */
  tenantId: string;
  /** 用户 ID */
  userId?: string;
  /** 用户角色 */
  role?: string;
  /** 当前用户消息 */
  userMessage: string;
  /** 对话历史（由 MemoryManager 加载，不含 system 消息） */
  history: ChatMessage[];
  /** 系统提示词（租户自定义 > 平台默认，由 AiConfigService 提供） */
  systemPrompt?: string;
}

/**
 * 默认系统提示词
 *
 * 当 AiConfigService 未返回租户自定义系统提示词时使用。
 */
export const DEFAULT_SYSTEM_PROMPT = `你是"智享AI助手"，一个为酒水行业进销存管理系统设计的智能助手。

## 你的身份
- 你服务于智享全链管理系统（批零一体即时零售SaaS平台）
- 当前租户ID：{tenantId}
- 当前用户：{userId}（角色：{role}）

## 你的能力
1. 销售管理：查询/创建销售单、查询客户信息、查询商品信息
2. 库存管理：查询库存、库存调拨、盘点
3. 采购管理：查询/创建采购单
4. 财务管理：查询对账、费用记录
5. 报表分析：销售报表、库存报表

## 工作规则
1. 当用户需要查询或操作数据时，使用可用的工具（function calling）完成
2. 创建订单等写操作时，先向用户确认信息无误后再执行
3. 回答简洁专业，避免冗余解释
4. 不确定的信息要明确告知用户，不要编造数据
5. 所有金额单位为"元"，日期格式为"YYYY-MM-DD"
6. 查询结果优先用表格呈现，便于阅读`;

@Injectable()
export class ContextBuilder {
  /**
   * 构建完整的对话上下文
   *
   * 合并顺序：System Prompt → 对话历史 → 用户消息
   *
   * @param params 构建参数
   * @param registry 工具注册中心（用于生成工具描述注入 System Prompt）
   * @returns 完整的 ChatMessage[] 供 LLM 调用
   */
  build(params: BuildContextParams, registry: ToolRegistry): ChatMessage[] {
    const systemPrompt = this.buildSystemPrompt(params, registry);
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

    // 加入对话历史（过滤掉 system 消息，避免重复）
    for (const msg of params.history) {
      if (msg.role !== 'system') {
        messages.push(msg);
      }
    }

    // 加入当前用户消息
    messages.push({ role: 'user', content: params.userMessage });

    return messages;
  }

  /**
   * 构建 System Prompt
   *
   * 优先使用租户自定义提示词（由 AiConfigService 提供），
   * 未提供时使用 DEFAULT_SYSTEM_PROMPT。
   *
   * 无论使用哪个提示词，都会替换 {tenantId}/{userId}/{role} 占位符。
   */
  buildSystemPrompt(
    params: BuildContextParams,
    registry: ToolRegistry,
  ): string {
    const base =
      params.systemPrompt && params.systemPrompt.length > 0
        ? params.systemPrompt
        : DEFAULT_SYSTEM_PROMPT;

    // 替换占位符
    let prompt = base
      .replace(/\{tenantId\}/g, params.tenantId)
      .replace(/\{userId\}/g, params.userId ?? '未知')
      .replace(/\{role\}/g, params.role ?? '未知');

    // 追加可用工具描述
    const tools = registry.list();
    if (tools.length > 0) {
      const toolList = tools
        .map((t) => `- ${t.name}（${t.category}）：${t.description}`)
        .join('\n');
      prompt += `\n\n## 当前可用工具\n${toolList}`;
    }

    return prompt;
  }
}
