/**
 * GraphExecutorService 单元测试
 *
 * 覆盖：线性图按序执行、条件分支、工具失败中止、断点续跑、未知图
 *
 * 负责人: 凌舟(AI协助) | 创建日期: 2026-08-15
 */
import { ToolExecutor } from '../../tools/tool-executor';
import type { ToolContext } from '../../tools/tool.interface';
import { CheckpointerService } from './checkpointer.service';
import { GraphExecutorService } from './graph-executor.service';
import { GraphDefinition, GraphState } from './graph.types';

/** 内存版 Checkpointer（模拟 Redis 持久化，便于断点测试） */
function makeCheckpointer() {
  const store = new Map<string, GraphState>();
  return {
    save: jest.fn((s: GraphState) => {
      store.set(`ai:graph:${s.tenantId}:${s.sessionId}`, s);
      return Promise.resolve();
    }),
    load: jest.fn((t: string, s: string) => {
      return Promise.resolve(store.get(`ai:graph:${t}:${s}`) ?? null);
    }),
    clear: jest.fn((t: string, s: string) => {
      store.delete(`ai:graph:${t}:${s}`);
      return Promise.resolve();
    }),
  };
}

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    tenantId: 't1',
    userId: 'u1',
    sessionId: 's1',
    role: 'STORE_MANAGER',
    authToken: 'jwt',
    ...overrides,
  };
}

const LINEAR_GRAPH: GraphDefinition = {
  id: 'test_linear',
  name: '线性测试图',
  entry: 'step1',
  nodes: [
    {
      id: 'step1',
      label: '第一步',
      type: 'tool',
      tool: 'searchCustomer',
      args: { name: '红星商行' },
      next: 'step2',
    },
    {
      id: 'step2',
      label: '第二步',
      type: 'tool',
      tool: 'checkInventory',
      args: { productName: '五粮液' },
      next: 'end',
    },
    { id: 'end', label: '完成', type: 'end' },
  ],
};

const BRANCH_GRAPH: GraphDefinition = {
  id: 'test_branch',
  name: '条件分支图',
  entry: 'check',
  nodes: [
    {
      id: 'check',
      label: '判断',
      type: 'condition',
      condition: (state) =>
        state.results['step1'] && state.results['step1'] === 'ok'
          ? 'success'
          : 'fallback',
    },
    {
      id: 'success',
      label: '成功分支',
      type: 'tool',
      tool: 'searchCustomer',
      next: 'end',
    },
    {
      id: 'fallback',
      label: '回退分支',
      type: 'tool',
      tool: 'searchCustomer',
      next: 'end',
    },
    { id: 'end', label: '完成', type: 'end' },
  ],
};

async function collectEvents(
  executor: GraphExecutorService,
  graph: GraphDefinition,
  ctx: ToolContext,
) {
  const events: Array<{ type: string; [k: string]: unknown }> = [];
  for await (const e of executor.execute(graph, ctx.sessionId, ctx)) {
    events.push(e);
  }
  return events;
}

describe('GraphExecutorService', () => {
  it('线性图按序执行工具并产出事件流', async () => {
    const executorMock = {
      executeToolCall: jest.fn().mockResolvedValue({
        success: true,
        data: { id: 1 },
      }),
    };
    const checkpointer = makeCheckpointer();
    const executor = new GraphExecutorService(
      executorMock as unknown as ToolExecutor,
      checkpointer as unknown as CheckpointerService,
    );

    const events = await collectEvents(executor, LINEAR_GRAPH, makeCtx());

    const types = events.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'node_start',
        'tool_start',
        'tool_result',
        'node_end',
        'graph_done',
      ]),
    );
    expect(executorMock.executeToolCall).toHaveBeenCalledTimes(2);
    // 完成后检查点已清除
    expect(checkpointer.clear).toHaveBeenCalled();
  });

  it('condition 节点按条件流转到成功分支', async () => {
    const executorMock = {
      executeToolCall: jest
        .fn()
        .mockResolvedValue({ success: true, data: 'ok' }),
    };
    const checkpointer = makeCheckpointer();
    const executor = new GraphExecutorService(
      executorMock as unknown as ToolExecutor,
      checkpointer as unknown as CheckpointerService,
    );
    // 预置 step1 结果驱动条件
    const ctx = makeCtx();
    await checkpointer.save({
      graphId: 'test_branch',
      tenantId: 't1',
      sessionId: 's1',
      currentNodeId: 'check',
      status: 'running',
      results: { step1: 'ok' },
      nodeOrder: [],
      history: [],
      updatedAt: 0,
    });

    const events = await collectEvents(executor, BRANCH_GRAPH, ctx);
    expect(
      events.some((e) => e.type === 'node_start' && e.nodeId === 'success'),
    ).toBe(true);
    expect(
      events.some((e) => e.type === 'node_start' && e.nodeId === 'fallback'),
    ).toBe(false);
  });

  it('工具执行失败时中止并写错误状态', async () => {
    const executorMock = {
      executeToolCall: jest.fn().mockResolvedValue({
        success: false,
        error: '库存不足',
      }),
    };
    const checkpointer = makeCheckpointer();
    const executor = new GraphExecutorService(
      executorMock as unknown as ToolExecutor,
      checkpointer as unknown as CheckpointerService,
    );

    const events = await collectEvents(executor, LINEAR_GRAPH, makeCtx());
    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(String(errorEvent?.message)).toContain('库存不足');
    // 状态保存为 error（可查）
    const state = await checkpointer.load('t1', 's1');
    expect(state?.status).toBe('error');
  });

  it('从断点续跑：已有 Checkpoint 时从 currentNodeId 继续', async () => {
    const executorMock = {
      executeToolCall: jest
        .fn()
        .mockResolvedValue({ success: true, data: { done: true } }),
    };
    const checkpointer = makeCheckpointer();
    const executor = new GraphExecutorService(
      executorMock as unknown as ToolExecutor,
      checkpointer as unknown as CheckpointerService,
    );
    // 断点：已完成 step1，从 step2 续跑
    await checkpointer.save({
      graphId: 'test_linear',
      tenantId: 't1',
      sessionId: 's1',
      currentNodeId: 'step2',
      status: 'running',
      results: { step1: { id: 1 } },
      nodeOrder: ['step1'],
      history: [{ nodeId: 'step1', label: '第一步', success: true }],
      updatedAt: 0,
    });

    const events = await collectEvents(executor, LINEAR_GRAPH, makeCtx());
    // step1 不应重新执行（从断点继续）
    const step1Starts = events.filter(
      (e) => e.type === 'node_start' && e.nodeId === 'step1',
    );
    expect(step1Starts).toHaveLength(0);
    expect(executorMock.executeToolCall).toHaveBeenCalledTimes(1);
  });

  it('getGraph 未知图返回 null，listGraphs 含内置图', () => {
    const executor = new GraphExecutorService(
      {} as ToolExecutor,
      makeCheckpointer() as unknown as CheckpointerService,
    );
    expect(executor.getGraph('sale_create_graph')).not.toBeNull();
    expect(executor.getGraph('not_exist')).toBeNull();
    expect(executor.listGraphs().length).toBeGreaterThanOrEqual(1);
  });
});
