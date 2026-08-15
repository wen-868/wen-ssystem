/**
 * GraphExecutorService — 有状态图执行引擎（完善度 P0-1/P0-2）
 *
 * 职责：
 * 1. 按图定义从入口节点顺序执行（tool / condition / agent / end）
 * 2. 工具节点复用 ToolExecutor（含写操作确认/审计链路）
 * 3. 每步经 Checkpointer 持久化状态（tenantId+sessionId），支持断点续跑
 * 4. 产出 SSE 事件流（node_start/node_end/tool_start/tool_result/text/graph_done/error）
 *
 * 当前边界（P0 骨架）：
 * - 工具节点参数为图定义静态 args（真实任务参数解析由后续 agent 节点完善）
 * - agent 节点为 LLM 单轮生成（多 Agent 协作后续扩展）
 * - needsReview 人工闸钩子预留（P0-4 对接审核流程）
 *
 * 对应计划：
 * - docs/ai-base/管理系统AI底座完善计划.md P0-1 Orchestrator graph 模式 / P0-2 Checkpointer
 */
import { Injectable, Logger } from '@nestjs/common';
import { ToolExecutor } from '../../tools/tool-executor';
import type { ToolCall } from '../../providers/provider.interface';
import type { IModelProvider } from '../../providers/provider.interface';
import type { ToolContext } from '../../tools/tool.interface';
import { CheckpointerService } from './checkpointer.service';
import { BUILTIN_GRAPHS, GraphDefinition } from './graph.types';

/** 图执行安全上限（防死循环） */
const MAX_NODE_STEPS = 50;

/** 图执行事件（对齐 Orchestrator SSE 风格） */
export type GraphRunEvent =
  | { type: 'node_start'; nodeId: string; label: string }
  | { type: 'node_end'; nodeId: string; label: string; success: boolean }
  | { type: 'tool_start'; tool: string }
  | {
      type: 'tool_result';
      tool: string;
      success: boolean;
      data?: unknown;
      error?: string;
    }
  | { type: 'text'; content: string }
  | { type: 'graph_done'; graphId: string }
  | { type: 'error'; message: string };

@Injectable()
export class GraphExecutorService {
  private readonly logger = new Logger(GraphExecutorService.name);

  constructor(
    private readonly executor: ToolExecutor,
    private readonly checkpointer: CheckpointerService,
  ) {}

  /**
   * 获取内置图（未知返回 null）
   */
  getGraph(graphId: string): GraphDefinition | null {
    return BUILTIN_GRAPHS[graphId] ?? null;
  }

  /**
   * 列出内置图（管理接口用）
   */
  listGraphs(): GraphDefinition[] {
    return Object.values(BUILTIN_GRAPHS);
  }

  /**
   * 执行有状态图（支持断点续跑）
   *
   * @param graph 图定义
   * @param sessionId 会话 ID
   * @param toolContext 工具上下文（tenantId/userId/authToken）
   * @param provider agent 节点用（可选，缺省时 agent 节点降级为直接跳转）
   */
  async *execute(
    graph: GraphDefinition,
    sessionId: string,
    toolContext: ToolContext,
    provider?: IModelProvider,
  ): AsyncGenerator<GraphRunEvent> {
    // 1. 恢复或初始化图状态
    let state =
      (await this.checkpointer.load(toolContext.tenantId, sessionId)) ?? null;
    if (!state || state.graphId !== graph.id || state.status === 'done') {
      state = {
        graphId: graph.id,
        tenantId: toolContext.tenantId,
        sessionId,
        currentNodeId: graph.entry,
        status: 'running',
        results: {},
        nodeOrder: [],
        history: [],
        updatedAt: Date.now(),
      };
    } else {
      this.logger.log(
        `图 ${graph.id} 从断点续跑：session=${sessionId} node=${state.currentNodeId}`,
      );
    }

    let steps = 0;
    while (steps < MAX_NODE_STEPS) {
      steps += 1;
      const node = graph.nodes.find((n) => n.id === state.currentNodeId);
      if (!node) {
        yield {
          type: 'error',
          message: `图节点不存在：${state.currentNodeId}`,
        };
        await this.checkpointer.clear(toolContext.tenantId, sessionId);
        return;
      }

      yield { type: 'node_start', nodeId: node.id, label: node.label };
      state.nodeOrder.push(node.id);

      try {
        switch (node.type) {
          case 'end': {
            state.status = 'done';
            state.history.push({
              nodeId: node.id,
              label: node.label,
              success: true,
            });
            yield {
              type: 'node_end',
              nodeId: node.id,
              label: node.label,
              success: true,
            };
            yield { type: 'graph_done', graphId: graph.id };
            // 完成后清除检查点，避免脏状态
            await this.checkpointer.clear(toolContext.tenantId, sessionId);
            return;
          }

          case 'tool': {
            if (!node.tool) {
              throw new Error(`工具节点缺少 tool 名：${node.id}`);
            }
            const toolCall: ToolCall = {
              id: `graph_${node.id}_${Date.now()}`,
              type: 'function',
              function: {
                name: node.tool,
                arguments: JSON.stringify(node.args ?? {}),
              },
            };
            yield { type: 'tool_start', tool: node.tool };
            const result = await this.executor.executeToolCall(
              toolCall,
              toolContext,
            );
            state.results[node.id] = result.data;
            state.history.push({
              nodeId: node.id,
              label: node.label,
              success: result.success,
            });
            yield {
              type: 'tool_result',
              tool: node.tool,
              success: result.success,
              data: result.data,
              error: result.error,
            };
            yield {
              type: 'node_end',
              nodeId: node.id,
              label: node.label,
              success: result.success,
            };
            if (!result.success) {
              state.status = 'error';
              state.error = result.error ?? '工具执行失败';
              await this.checkpointer.save(state);
              yield { type: 'error', message: state.error };
              return;
            }
            state.currentNodeId = node.next ?? 'end';
            break;
          }

          case 'condition': {
            const next = node.condition ? node.condition(state) : undefined;
            state.history.push({
              nodeId: node.id,
              label: node.label,
              success: true,
            });
            yield {
              type: 'node_end',
              nodeId: node.id,
              label: node.label,
              success: true,
            };
            state.currentNodeId = next ?? node.next ?? 'end';
            break;
          }

          case 'agent': {
            // P0 骨架：agent 节点 = LLM 单轮生成；多 Agent 协作后续扩展
            if (!provider) {
              state.currentNodeId = node.next ?? 'end';
              yield {
                type: 'node_end',
                nodeId: node.id,
                label: node.label,
                success: true,
              };
              break;
            }
            const result = await provider.chatSync([
              {
                role: 'system',
                content: node.prompt ?? `你是「${node.label}」域的专家 Agent。`,
              },
              {
                role: 'user',
                content: `请基于当前图状态产物完成本节点任务：${JSON.stringify(state.results).slice(0, 2000)}`,
              },
            ]);
            state.results[node.id] = result.content;
            state.history.push({
              nodeId: node.id,
              label: node.label,
              success: true,
            });
            yield { type: 'text', content: result.content };
            yield {
              type: 'node_end',
              nodeId: node.id,
              label: node.label,
              success: true,
            };
            state.currentNodeId = node.next ?? 'end';
            break;
          }

          default:
            throw new Error(
              `未知图节点类型：${(node as { type: string }).type}`,
            );
        }
      } catch (err) {
        state.status = 'error';
        state.error = err instanceof Error ? err.message : String(err);
        await this.checkpointer.save(state);
        yield { type: 'error', message: state.error };
        return;
      }

      // 每步持久化（断点续跑）
      await this.checkpointer.save(state);
    }

    state.status = 'error';
    state.error = `图执行超过 ${MAX_NODE_STEPS} 步（疑似死循环）`;
    await this.checkpointer.save(state);
    yield { type: 'error', message: state.error };
  }
}
