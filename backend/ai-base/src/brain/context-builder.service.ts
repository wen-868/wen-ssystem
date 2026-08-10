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
import { Injectable, Logger } from '@nestjs/common';
import type { ChatMessage } from '../providers/provider.interface';
import type { ToolRegistry } from '../tools/tool-registry';
import { RetrieverService } from '../rag/retriever.service';

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
  /** RAG 知识库参考内容（由 build() 内部检索注入；embedding 未配置时跳过） */
  ragContext?: string;
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
  private readonly logger = new Logger(ContextBuilder.name);

  constructor(private readonly retriever: RetrieverService) {}

  /**
   * 构建完整的对话上下文
   *
   * 合并顺序：System Prompt（含 RAG 知识库参考）→ 对话历史 → 用户消息
   *
   * R70-21 RAG 增强：build 内部调用 RetrieverService 检索与用户消息相关的
   * 知识库分块，注入 System Prompt 的"知识库参考"段落。embedding 未配置时
   * 检索返回空，跳过注入（对话正常进行，不受影响）。
   *
   * @param params 构建参数
   * @param registry 工具注册中心（用于生成工具描述注入 System Prompt）
   * @returns 完整的 ChatMessage[] 供 LLM 调用
   */
  async build(
    params: BuildContextParams,
    registry: ToolRegistry,
  ): Promise<ChatMessage[]> {
    const ragContext = await this.buildRagContext(params);
    const systemPrompt = this.buildSystemPrompt(
      { ...params, ragContext },
      registry,
    );
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
   * RAG 知识库检索（降级安全）
   *
   * - embedding 未配置 → retriever 返回空数组 → 返回 undefined（跳过注入）
   * - 检索异常 → warn + 返回 undefined（对话主流程不受影响）
   *
   * @returns 拼接后的知识库参考文本；无可用知识时返回 undefined
   */
  private async buildRagContext(
    params: BuildContextParams,
  ): Promise<string | undefined> {
    try {
      const results = await this.retriever.search(
        params.userMessage,
        params.tenantId,
      );
      if (!results || results.length === 0) {
        return undefined;
      }
      return results
        .map(
          (r) =>
            `【${r.docName} 第${r.chunkIndex + 1}段】(相关度 ${(r.score * 100).toFixed(0)}%) ${r.text}`,
        )
        .join('\n');
    } catch (err) {
      this.logger.warn(
        `RAG 检索失败（跳过知识库增强）：${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
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

    // R70-21：追加 RAG 知识库参考（检索到相关知识时注入，优先采信）
    if (params.ragContext && params.ragContext.trim().length > 0) {
      prompt += `\n\n## 知识库参考（以下为检索到的内部知识，回答相关问题时优先采信）\n${params.ragContext}`;
    }

    // 无论租户使用默认提示词还是自定义提示词，都追加"缺失数据自动创建流程"规则，
    // 确保搜索未命中时 AI 会询问并自动创建（与智享AI助手-能力说明书 2.1.1 异常处理一致）
    prompt += `\n\n## 缺失数据自动创建流程（强制生效，勿遗漏）
1. 创建销售单/采购单等需要客户的流程中，searchCustomer 未找到客户时：
   - 第一轮只能向用户提问："未找到客户「名称」，是否创建该客户？"，禁止在提问前调用 createCustomer 或其他创建工具；
   - 用户明确回复"创建/确认/可以/好的"后，再调用 createCustomer（confirm=true 直接创建，无需二次预览）；
   - 客户类型按名称推断（含"批发/商行/贸易/经销/商贸"→ WHOLESALE，否则 CASH；批发客户 settlementType=ACCOUNT，其他 CASH）；
   - 创建成功后用返回的 memberId 继续后续开单流程。
2. searchProduct 未找到商品时：
   - 第一轮只能向用户提问："未找到商品「名称」，是否创建该商品？（请提供零售价或批发价）"；
   - 用户确认并提供价格后，再调用 createProduct（confirm=true 直接创建），创建成功后继续后续流程。
3. 其他写操作（创建销售单、库存调拨、盘点、退款等）先生成预览卡片（confirm=false），
   用户确认后再执行（confirm=true）。`;

    return prompt;
  }
}
