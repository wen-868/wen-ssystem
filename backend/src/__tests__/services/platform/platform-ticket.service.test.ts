/**
 * C6-2-T7：平台工单系统服务单测
 * （t_support_ticket / t_support_ticket_message / t_support_ticket_attachment / t_support_ticket_category）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T7.md 交付物②③⑤、验收标准②⑦⑧
 * 覆盖：
 *   · 看板列表：空表诚实空态 / onlyMine 作用域 / status 精确筛选 / 分页（每组各自生效）/ summary 四态计数；
 *   · 详情：不存在 404 / 字段口径（含 description·resolvedAt·closedAt，**无 tenantName**）；
 *   · **公/私隔离（交付物③）**：`listTimeline` 缺省视角排除 INTERNAL，只有显式 `'platform'` 才包含；
 *   · 状态机：reply（PENDING⇒PROCESSING）/ note（不改状态）/ transfer（不改状态 + SYSTEM 留痕）/
 *     resolve（RESOLVED|CLOSED ⇒ 400）/ close（仅 RESOLVED，重复关闭 ⇒ 400）；
 *   · 报表：口径未定 ⇒ `{ items: [], definitionPending: true }`（零查库、不硬凑指标）；
 *   · 类型配置：空表 ⇒ `categories: []`；
 *   · 权限点常量与 T6 目录逐字一致（双向核对的自动化版本）。
 *
 * 注意：本沙箱 vitest 无法启动（spawn EPERM，踩坑 [118]），用例只写好，执行由凌舟在本机跑。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  connExecute: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
  transaction: mocks.transaction,
  connExecute: mocks.connExecute,
}));

import {
  TICKET_PERMISSIONS,
  listTicketBoard,
  getTicketDetail,
  listTimeline,
  replyToTicket,
  addInternalNote,
  transferTicket,
  resolveTicket,
  closeTicket,
  getServiceReport,
  listTicketCategories,
} from "../../../services/platform/platform-ticket.service";
import { PERMISSION_CATALOG } from "../../../services/platform/platform-role.service";
import { AppError } from "../../../shared/app-error";

interface ExecCall {
  sql: string;
  params: unknown[];
}

function execCalls(): ExecCall[] {
  return (mocks.connExecute.mock.calls as unknown[][]).map((call) => ({
    sql: String(call[1]),
    params: (call[2] ?? []) as unknown[],
  }));
}

function queryCalls(): ExecCall[] {
  return (mocks.query.mock.calls as unknown[][]).map((call) => ({
    sql: String(call[0]),
    params: (call[1] ?? []) as unknown[],
  }));
}

const ACTOR = { adminId: 9, adminName: "测试管理员" };

/** 一条工单行（列别名口径 = 服务层 CARD_COLUMNS 的别名，与 mysql2 实际返回一致） */
const TICKET_ROW = {
  id: 5,
  ticketNo: "TK202609260001",
  tenantId: "3f1c0d1e-0000-4000-8000-000000000001",
  categoryId: "9",
  title: "登录异常",
  priority: "HIGH",
  status: "PENDING",
  assigneeId: null as number | null,
  createdAt: "2026-09-26 10:00:00",
  updatedAt: "2026-09-26 10:00:00",
};

describe("C6-2-T7 · GET /api/platform/support/tickets（看板列表）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ insertId: 1, affectedRows: 1 }, undefined]);
  });

  it("零数据 ⇒ 三组空数组 + 四态 0（诚实空态，不造示例工单）", async () => {
    mocks.query.mockResolvedValue([]);

    const board = await listTicketBoard({ onlyMine: false });

    expect(board).toEqual({
      groups: { pending: [], processing: [], resolved: [] },
      summary: { pending: 0, processing: 0, resolved: 0, closed: 0 },
    });
    // 读路径：3 次分组查询 + 1 次统计查询，零写库
    expect(mocks.query).toHaveBeenCalledTimes(4);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.connExecute).not.toHaveBeenCalled();
  });

  it("summary 只从真实 GROUP BY 结果派生（缺的态记 0，不是硬编码）", async () => {
    mocks.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { status: "PENDING", cnt: "2" },
        { status: "CLOSED", cnt: 5 },
      ]);

    const board = await listTicketBoard({});

    expect(board.summary).toEqual({ pending: 2, processing: 0, resolved: 0, closed: 5 });
    expect(String(queryCalls()[3].sql)).toContain("GROUP BY status");
  });

  it("TicketCard 字段逐项映射（categoryId 数字、assigneeId 可空），且**不含 tenantName**", async () => {
    mocks.query
      .mockResolvedValueOnce([TICKET_ROW])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const board = await listTicketBoard({});
    const card = board.groups.pending[0];

    expect(card).toEqual({
      id: 5,
      ticketNo: "TK202609260001",
      tenantId: "3f1c0d1e-0000-4000-8000-000000000001",
      categoryId: 9,
      title: "登录异常",
      priority: "HIGH",
      status: "PENDING",
      assigneeId: null,
      createdAt: "2026-09-26 10:00:00",
      updatedAt: "2026-09-26 10:00:00",
    });
    // 卡内硬口径：不引入 tenantName（不 JOIN t_tenant）
    expect(card).not.toHaveProperty("tenantName");
    expect(Object.keys(card).sort()).toEqual(
      [
        "assigneeId",
        "categoryId",
        "createdAt",
        "id",
        "priority",
        "status",
        "tenantId",
        "ticketNo",
        "title",
        "updatedAt",
      ].sort()
    );
    // 不 JOIN 任何既有表：SQL 里不得出现 JOIN
    for (const call of queryCalls()) {
      expect(call.sql).not.toMatch(/\bJOIN\b/i);
    }
  });

  it("onlyMine=true ⇒ 分组与统计都带 assignee_id = 当前管理员（反测：去掉作用域即变红）", async () => {
    mocks.query.mockResolvedValue([]);

    await listTicketBoard({ onlyMine: true, adminId: 7 });

    const calls = queryCalls();
    expect(calls[0].sql).toContain("AND assignee_id = ?");
    expect(calls[0].params).toEqual(["PENDING", 7, 20, 0]);
    expect(calls[3].sql).toContain("WHERE assignee_id = ?");
    expect(calls[3].params).toEqual([7]);
  });

  it("onlyMine=false（默认）⇒ WHERE 无受理人过滤、params 不含当前管理员（反测：恒加 assignee_id 过滤即变红）", async () => {
    mocks.query.mockResolvedValue([]);

    await listTicketBoard({ onlyMine: false, adminId: 7 });

    const calls = queryCalls();
    // 判据只钉"有没有按受理人过滤"，不钉"整条 SQL 有没有 assignee_id 字样"：
    // 服务层 SELECT 列表合法含 `assignee_id AS assigneeId`（工单卡必须回传受理人，见服务层 CARD_COLUMNS），
    // 故必须定点看 WHERE 子句——整条 SQL 判 not.toContain 是恒红断言（踩坑[127] 同族）。
    expect(calls[0].sql).not.toMatch(/WHERE[^;]*?assignee_id\s*=\s*\?/i);
    expect(calls[3].sql).not.toMatch(/WHERE[^;]*?assignee_id\s*=\s*\?/i);
    // 更强判据：传给 DB 的 params 不得出现当前管理员 id（= 没有按受理人过滤）
    expect(calls[0].params).not.toContain(7);
    expect(calls[3].params).not.toContain(7);
    // 附：SELECT 列表仍须回传受理人（防"删掉 assignee_id 列即变绿"的假修复）
    expect(calls[0].sql).toMatch(/assignee_id\s+AS\s+assigneeId/i);
    // 参数逐位保留（与 onlyMine=true 用例对称）
    expect(calls[0].params).toEqual(["PENDING", 20, 0]);
    expect(calls[3].params).toEqual([]);
  });

  it("onlyMine=true 但无管理员身份 ⇒ 显式 400（不静默忽略筛选条件）", async () => {
    await expect(listTicketBoard({ onlyMine: true, adminId: null })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("status 精确筛选：只查被筛中的那一组（其余两组保持空数组，不查库）", async () => {
    mocks.query.mockResolvedValue([]);

    const board = await listTicketBoard({ status: "PROCESSING" });

    expect(board.groups.pending).toEqual([]);
    expect(board.groups.resolved).toEqual([]);
    // 1 次分组查询（PROCESSING）+ 1 次统计查询
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(queryCalls()[0].params[0]).toBe("PROCESSING");
  });

  it("分页：page/pageSize 对每个分组各自生效（第 3 页 × 10 条 ⇒ OFFSET 20）", async () => {
    mocks.query.mockResolvedValue([]);

    await listTicketBoard({ page: 3, pageSize: 10 });

    expect(queryCalls()[0].params).toEqual(["PENDING", 10, 20]);
  });

  it("pageSize 超上限时服务层夹到 100（防线；控制器另有 400 硬闸）", async () => {
    mocks.query.mockResolvedValue([]);

    await listTicketBoard({ pageSize: 999 });

    expect(queryCalls()[0].params).toEqual(["PENDING", 100, 0]);
  });
});

describe("C6-2-T7 · GET /api/platform/support/tickets/:id（详情）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("不存在 ⇒ 404（AppError，不是 TypeError/500），且零事务", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);

    await expect(getTicketDetail(999)).rejects.toBeInstanceOf(AppError);
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(getTicketDetail(999)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("存在 ⇒ 卡片字段 + description/resolvedAt/closedAt，仍不含 tenantName", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      ...TICKET_ROW,
      description: "无法登录工作台",
      resolvedAt: null,
      closedAt: null,
    });

    const detail = await getTicketDetail(5);

    expect(detail.description).toBe("无法登录工作台");
    expect(detail.resolvedAt).toBeNull();
    expect(detail.closedAt).toBeNull();
    expect(detail).not.toHaveProperty("tenantName");
    expect(String(mocks.queryOne.mock.calls[0][0])).toContain("resolved_at AS resolvedAt");
  });
});

describe("C6-2-T7 · 公/私回复隔离（listTimeline viewer 必填显式参数）", () => {
  /**
   * 按 SQL 是否带排除条件返回行的 mock —— 模拟真实库行为：
   * SQL 要求排除 INTERNAL 时就**不会**返回 INTERNAL 行。
   * 这样"缺省视角泄漏内部备注"这一类回归会落在**行为断言**上（而不是只比 SQL 文本）。
   */
  const MESSAGES = [
    {
      id: 1,
      senderType: "TENANT",
      senderName: "租户张三",
      bubbleType: "PUBLIC",
      content: "租户公开提问",
      createdAt: "2026-09-26 09:00:00",
    },
    {
      id: 2,
      senderType: "PLATFORM",
      senderName: "测试管理员",
      bubbleType: "INTERNAL",
      content: "平台内部备注-仅内部可见",
      createdAt: "2026-09-26 09:05:00",
    },
    {
      id: 3,
      senderType: "PLATFORM",
      senderName: "测试管理员",
      bubbleType: "PUBLIC",
      content: "平台公开回复",
      createdAt: "2026-09-26 09:10:00",
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.queryOne.mockResolvedValue({ id: 5, status: "PROCESSING", assigneeId: null });
    mocks.query.mockImplementation((sql: string, params: unknown[]) => {
      const excludeInternal = sql.includes("bubble_type <> ?") && params.includes("INTERNAL");
      const rows = excludeInternal
        ? MESSAGES.filter((m) => m.bubbleType !== "INTERNAL")
        : MESSAGES.slice();
      return Promise.resolve(rows);
    });
  });

  it("缺省视角（不传 viewer）⇒ 结果**不含** INTERNAL 备注内容（反测 b：改成默认含 INTERNAL 即变红）", async () => {
    const result = await listTimeline(5);

    const contents = result.items.map((item) => item.content);
    expect(contents).not.toContain("平台内部备注-仅内部可见");
    expect(result.items.map((item) => item.bubbleType)).toEqual(["PUBLIC", "PUBLIC"]);
    expect(result.items).toHaveLength(2);
    // SQL 层面同样带上排除条件 + 参数化取值
    expect(queryCalls()[0].sql).toContain("bubble_type <> ?");
    expect(queryCalls()[0].params).toEqual([5, "INTERNAL"]);
  });

  it("显式 viewer='platform' ⇒ 三类气泡全含（PUBLIC/INTERNAL/TENANT）", async () => {
    const result = await listTimeline(5, "platform");

    expect(result.items).toHaveLength(3);
    expect(result.items.map((item) => item.bubbleType)).toEqual(["PUBLIC", "INTERNAL", "PUBLIC"]);
    expect(result.items.map((item) => item.content)).toContain("平台内部备注-仅内部可见");
    // 平台视角不加排除条件（也就不会多传 INTERNAL 参数）
    expect(queryCalls()[0].sql).not.toContain("bubble_type <> ?");
    expect(queryCalls()[0].params).toEqual([5]);
  });

  it("工单不存在 ⇒ 404（不返回空时间线冒充正常）", async () => {
    mocks.queryOne.mockResolvedValue(null);

    await expect(listTimeline(999, "platform")).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("时间线字段口径：id/senderType/senderName/bubbleType/content/createdAt", async () => {
    const result = await listTimeline(5, "platform");

    expect(Object.keys(result.items[0]).sort()).toEqual(
      ["bubbleType", "content", "createdAt", "id", "senderName", "senderType"].sort()
    );
    expect(result.items[0].senderName).toBe("租户张三");
  });
});

describe("C6-2-T7 · POST /:id/reply（公开回复）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ insertId: 77, affectedRows: 1 }, undefined]);
  });

  it("PENDING ⇒ 写 PUBLIC/PLATFORM 消息 + 同时置 PROCESSING（同一事务两条语句）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "PENDING", assigneeId: null });

    const result = await replyToTicket(5, "您好，请提供报错截图", ACTOR);

    expect(result).toEqual({ id: 5, messageId: 77, status: "PROCESSING" });
    const calls = execCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].sql).toContain("INSERT INTO t_support_ticket_message");
    expect(calls[0].sql).toContain("'PLATFORM'");
    expect(calls[0].sql).toContain("'PUBLIC'");
    expect(calls[0].params).toEqual([5, "9", "测试管理员", "您好，请提供报错截图"]);
    expect(calls[1].sql).toContain("status = 'PROCESSING'");
    expect(calls[1].params).toEqual([5]);
  });

  it("PROCESSING ⇒ 只写消息、**不改状态**（反测：无条件置 PROCESSING 即变红）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "PROCESSING", assigneeId: null });

    const result = await replyToTicket(5, "补充说明", ACTOR);

    expect(result.status).toBe("PROCESSING");
    expect(execCalls()).toHaveLength(1);
    expect(execCalls()[0].sql).toContain("INSERT INTO t_support_ticket_message");
  });

  it("RESOLVED ⇒ 也不改状态（状态机只由 resolve/close 驱动）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "RESOLVED", assigneeId: 3 });

    const result = await replyToTicket(5, "再次确认", ACTOR);

    expect(result.status).toBe("RESOLVED");
    expect(execCalls()).toHaveLength(1);
  });

  it("内容为空白 ⇒ 400，且不写库", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "PENDING", assigneeId: null });

    await expect(replyToTicket(5, "   ", ACTOR)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("工单不存在 ⇒ 404，且不写库", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);

    await expect(replyToTicket(404, "内容", ACTOR)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("C6-2-T7 · POST /:id/note（内部备注）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ insertId: 88, affectedRows: 1 }, undefined]);
  });

  it("写 INTERNAL/PLATFORM 消息；**不改状态**（只有一条 INSERT，无 UPDATE）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "PROCESSING", assigneeId: null });

    const result = await addInternalNote(5, "内部备注：疑似租户库表缺失", ACTOR);

    expect(result).toEqual({ id: 5, messageId: 88, status: "PROCESSING" });
    const calls = execCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("INSERT INTO t_support_ticket_message");
    expect(calls[0].sql).toContain("'INTERNAL'");
    expect(calls[0].sql).not.toContain("UPDATE t_support_ticket");
    expect(calls[0].params).toEqual([5, "9", "测试管理员", "内部备注：疑似租户库表缺失"]);
  });

  it("工单不存在 ⇒ 404", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);

    await expect(addInternalNote(404, "备注", ACTOR)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("C6-2-T7 · POST /:id/transfer（转交，不改状态）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ insertId: 99, affectedRows: 1 }, undefined]);
  });

  it("只换 assignee_id + 写一条 INTERNAL/SYSTEM 留痕；**状态不变**", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 8, status: "PROCESSING", assigneeId: 3 });

    const result = await transferTicket(8, 12, ACTOR);

    expect(result).toEqual({ id: 8, assigneeId: 12, status: "PROCESSING" });
    const calls = execCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].sql).toContain("UPDATE t_support_ticket SET assignee_id = ?");
    expect(calls[0].sql).not.toContain("status");
    expect(calls[0].params).toEqual([12, 8]);
    expect(calls[1].sql).toContain("'SYSTEM'");
    expect(calls[1].sql).toContain("'INTERNAL'");
    expect(String(calls[1].params[3])).toContain("3");
    expect(String(calls[1].params[3])).toContain("12");
  });

  it("未分配工单转交 ⇒ 留痕写「未分配」（不编造原受理人）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 8, status: "PENDING", assigneeId: null });

    await transferTicket(8, 12, ACTOR);

    expect(String(execCalls()[1].params[3])).toContain("未分配");
  });

  it("工单不存在 ⇒ 404", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);

    await expect(transferTicket(404, 12, ACTOR)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("C6-2-T7 · POST /:id/resolve（非法状态转移必须 400）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ affectedRows: 1 }, undefined]);
  });

  it("PENDING ⇒ RESOLVED（写 resolved_at）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "PENDING", assigneeId: null });

    expect(await resolveTicket(5)).toEqual({ id: 5, status: "RESOLVED" });
    expect(execCalls()[0].sql).toContain("status = 'RESOLVED'");
    expect(execCalls()[0].sql).toContain("resolved_at = NOW()");
  });

  it("PROCESSING ⇒ RESOLVED", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "PROCESSING", assigneeId: 3 });

    expect(await resolveTicket(5)).toEqual({ id: 5, status: "RESOLVED" });
  });

  it("RESOLVED ⇒ 400（重复解决），且不写库", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "RESOLVED", assigneeId: 3 });

    await expect(resolveTicket(5)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("CLOSED → RESOLVED ⇒ 400（卡内点名反例），且不写库", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "CLOSED", assigneeId: 3 });

    await expect(resolveTicket(5)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.connExecute).not.toHaveBeenCalled();
  });

  it("工单不存在 ⇒ 404", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);

    await expect(resolveTicket(404)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("C6-2-T7 · POST /:id/close（仅 RESOLVED 可关闭）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ affectedRows: 1 }, undefined]);
  });

  it("RESOLVED ⇒ CLOSED（写 closed_at）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "RESOLVED", assigneeId: 3 });

    expect(await closeTicket(5)).toEqual({ id: 5, status: "CLOSED" });
    expect(execCalls()[0].sql).toContain("status = 'CLOSED'");
    expect(execCalls()[0].sql).toContain("closed_at = NOW()");
  });

  it("PENDING ⇒ 400（跨状态关闭被拒），且不写库", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "PENDING", assigneeId: null });

    await expect(closeTicket(5)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("重复 close（CLOSED ⇒ CLOSED）⇒ 400（卡内点名反例）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 5, status: "CLOSED", assigneeId: 3 });

    await expect(closeTicket(5)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("工单不存在 ⇒ 404", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);

    await expect(closeTicket(404)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("C6-2-T7 · GET /api/platform/support/tickets/report（服务报表口径未定）", () => {
  beforeEach(() => vi.resetAllMocks());

  it("返回 { items: [], definitionPending: true }：零查库、零事务、零硬凑指标", async () => {
    const report = getServiceReport();

    expect(report).toEqual({ items: [], definitionPending: true });
    expect(report.items).toHaveLength(0);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.queryOne).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("C6-2-T7 · GET /api/platform/support/ticket-categories（类型配置）", () => {
  beforeEach(() => vi.resetAllMocks());

  it("零预置 ⇒ categories: []（不造内置类型清单）", async () => {
    mocks.query.mockResolvedValueOnce([]);

    expect(await listTicketCategories()).toEqual({ categories: [] });
    expect(String(mocks.query.mock.calls[0][0])).toContain("ORDER BY sort_no ASC, id ASC");
  });

  it("有配置 ⇒ 字段映射 + TINYINT 归一化为 boolean", async () => {
    mocks.query.mockResolvedValueOnce([
      { id: 3, name: "功能异常", slug: "bug", slaHours: "24", sortNo: 1, enabled: 1 },
      { id: 4, name: "咨询建议", slug: "advice", slaHours: 48, sortNo: 2, enabled: 0 },
    ]);

    const { categories } = await listTicketCategories();

    expect(categories).toEqual([
      { id: 3, name: "功能异常", slug: "bug", slaHours: 24, sortNo: 1, enabled: true },
      { id: 4, name: "咨询建议", slug: "advice", slaHours: 48, sortNo: 2, enabled: false },
    ]);
  });
});

describe("C6-2-T7 · 权限点常量（与 T6 目录逐字一致）", () => {
  it("TICKET_PERMISSIONS 的 7 个取值 = T6 目录中 ticket 域 BUTTON 项（双向核对）", () => {
    const catalogTicketButtons = PERMISSION_CATALOG.filter(
      (entry) => entry.moduleCode === "ticket" && entry.permLevel === "BUTTON"
    )
      .map((entry) => entry.permCode)
      .sort();
    const ownValues = Object.values(TICKET_PERMISSIONS).sort();

    expect(ownValues).toEqual([
      "ticket:category:config",
      "ticket:close",
      "ticket:note",
      "ticket:reply",
      "ticket:report",
      "ticket:resolve",
      "ticket:transfer",
    ]);
    expect(ownValues).toEqual(catalogTicketButtons);
  });
});
