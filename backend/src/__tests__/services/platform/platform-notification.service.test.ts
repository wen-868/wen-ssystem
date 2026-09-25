/**
 * C6-2-T1：平台通知服务单测（t_platform_notification / t_platform_notification_read）
 *
 * 依据：docs/tasks/cards/R101-派单-20260926-C6-2-T1.md 交付物③、验收标准⑤⑥
 * 覆盖：
 *   · 列表：空表诚实空态 / total 与 unreadCount 口径 / read 标记来自真实左连接 /
 *     参数化分页与夹取 / 可见性条件（全员 + 定向）与"按当前管理员"参数；
 *   · 未读数由服务端计算：unreadCount 与 unreadOnly 解耦（已读者不计）；
 *   · 标记已读：幂等（INSERT IGNORE，重复调用不报错、不新增行）/ 不可见或不存在 ⇒ 404 且零写入；
 *   · A 管理员标记已读不影响 B 管理员（全员通知场景）；
 *   · read-all：单条 INSERT IGNORE ... SELECT（非逐条插入）、marked = 本次新增行数、二次调用 0；
 *   · 权限点常量：取值登记 + **如实标注** PERMISSION_CATALOG 当前无 notification 域（不伪造一致性）。
 *
 * 注意：本沙箱 vitest 无法启动（spawn EPERM，踩坑 [118]），用例只写好，执行由凌舟在本机跑；
 * 本单另有 B 级行为 harness（docs/evidence/C6-2-T1）对同一批断言做等价实跑。
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
  PLATFORM_NOTIFICATION_PERMISSIONS,
  PLATFORM_NOTIFICATION_LEVELS,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../../services/platform/platform-notification.service";
import { PERMISSION_CATALOG } from "../../../services/platform/platform-role.service";
import { AppError } from "../../../shared/app-error";

interface ExecCall {
  sql: string;
  params: unknown[];
}

function queryCalls(): ExecCall[] {
  return (mocks.query.mock.calls as unknown[][]).map((call) => ({
    sql: String(call[0]),
    params: (call[1] ?? []) as unknown[],
  }));
}

function execCalls(): ExecCall[] {
  return (mocks.connExecute.mock.calls as unknown[][]).map((call) => ({
    sql: String(call[1]),
    params: (call[2] ?? []) as unknown[],
  }));
}

const ADMIN_A = 9;
const ADMIN_B = 12;

/** 一条通知行（列别名口径 = 服务层 SQL 的别名，与 mysql2 实际返回一致） */
const NOTIFICATION_ROW = {
  id: "31",
  title: "平台升级通知",
  content: null as string | null,
  type: "SYSTEM",
  level: "INFO",
  linkUrl: null as string | null,
  createdAt: "2026-09-26 10:00:00",
  isRead: 0 as number | null,
};

function stubCounts(total: number, unread: number) {
  mocks.query
    .mockResolvedValueOnce([{ total }]) // 可见总数（含已读）
    .mockResolvedValueOnce([{ total: unread }]); // 未读数
}

describe("C6-2-T1 · GET /api/platform/notifications（列表 + 未读数）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ insertId: 1, affectedRows: 1 }, undefined]);
  });

  it("零数据 ⇒ 诚实空态 records: [] / total: 0 / unreadCount: 0（不造示例通知、不返回 null）", async () => {
    mocks.query
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    const page = await listNotifications({ adminId: ADMIN_A });

    expect(page).toEqual({ total: 0, page: 1, pageSize: 20, unreadCount: 0, records: [] });
    // 读路径：2 次计数 + 1 次列表；零写库
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.connExecute).not.toHaveBeenCalled();
  });

  it("read 标记来自真实左连接（isRead=1 ⇒ true，NULL/0 ⇒ false），空字段保持 null", async () => {
    stubCounts(2, 1);
    mocks.query.mockResolvedValueOnce([
      { ...NOTIFICATION_ROW, id: 31, isRead: 0 },
      { ...NOTIFICATION_ROW, id: 32, title: "已读通知", content: "正文", linkUrl: "/x", isRead: 1 },
    ]);

    const page = await listNotifications({ adminId: ADMIN_A });

    expect(page.records).toHaveLength(2);
    expect(page.records[0]).toEqual({
      id: 31,
      title: "平台升级通知",
      content: null,
      type: "SYSTEM",
      level: "INFO",
      linkUrl: null,
      createdAt: "2026-09-26 10:00:00",
      read: false,
    });
    expect(page.records[1].read).toBe(true);
    // 列表 SQL 必须真的左连接已读表并按当前管理员关联（否则 read 就是假数据）
    const listSql = queryCalls()[2].sql;
    expect(listSql).toContain("LEFT JOIN t_platform_notification_read");
    expect(listSql).toContain("r.admin_id = ?");
    expect(queryCalls()[2].params).toEqual([ADMIN_A, ADMIN_A, 20, 0]);
  });

  it("unreadCount 与 unreadOnly 解耦：未筛选时 = 未读数；unreadOnly=true 时 total = 未读数且只查 2 次", async () => {
    stubCounts(5, 2);
    mocks.query.mockResolvedValueOnce([{ ...NOTIFICATION_ROW, isRead: 0 }]);

    const all = await listNotifications({ adminId: ADMIN_A });
    expect(all.total).toBe(5);
    expect(all.unreadCount).toBe(2);
    const allCalls = queryCalls();
    expect(allCalls).toHaveLength(3);
    // 未读计数 SQL 必须带 `r.id IS NULL`（已读者不计），不能退化成"通知总数"
    expect(allCalls[1].sql).toContain("r.id IS NULL");
    expect(allCalls[1].params).toEqual([ADMIN_A, ADMIN_A]);
    expect(allCalls[0].sql).not.toContain("r.id IS NULL");

    vi.resetAllMocks();
    mocks.query.mockResolvedValueOnce([{ total: 2 }]).mockResolvedValueOnce([]);

    const unreadOnly = await listNotifications({ adminId: ADMIN_A, unreadOnly: true });
    expect(unreadOnly).toEqual({ total: 2, page: 1, pageSize: 20, unreadCount: 2, records: [] });
    const unreadCalls = queryCalls();
    expect(unreadCalls).toHaveLength(2);
    expect(unreadCalls[0].sql).toContain("r.id IS NULL");
    expect(unreadCalls[1].sql).toContain("r.id IS NULL");
  });

  it("可见性 = 全员通知或定向给当前管理员（同一 WHERE 条件，绝不漏掉全员通知）", async () => {
    stubCounts(0, 0);
    mocks.query.mockResolvedValueOnce([]);

    await listNotifications({ adminId: ADMIN_A, page: 2, pageSize: 50 });

    for (const call of queryCalls()) {
      expect(call.sql).toContain("n.target_admin_id IS NULL OR n.target_admin_id = ?");
    }
    // 分页参数为 LIMIT/OFFSET；page=2/pageSize=50 ⇒ OFFSET 50
    expect(queryCalls()[2].params).toEqual([ADMIN_A, ADMIN_A, 50, 50]);
  });

  it("page/pageSize 再规范化（防止绕过 zod 的调用方）：page<1 ⇒ 1；pageSize>100 ⇒ 100", async () => {
    stubCounts(0, 0);
    mocks.query.mockResolvedValueOnce([]);

    const page = await listNotifications({ adminId: ADMIN_A, page: -3, pageSize: 1000 });

    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(100);
    expect(queryCalls()[2].params).toEqual([ADMIN_A, ADMIN_A, 100, 0]);
  });
});

describe("C6-2-T1 · POST /:id/read（标记已读，幂等）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.queryOne.mockResolvedValue({ id: 31 });
  });

  it("不可见或不存在 ⇒ 404，且零写入（不静默成功、不标记成功）", async () => {
    mocks.queryOne.mockResolvedValue(null);

    await expect(markNotificationRead(31, ADMIN_A)).rejects.toBeInstanceOf(AppError);
    await expect(markNotificationRead(31, ADMIN_A)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.connExecute).not.toHaveBeenCalled();
    // 可见性判定必须同时覆盖"全员"与"定向给当前管理员"
    expect(String(mocks.queryOne.mock.calls[0][0])).toContain(
      "(n.target_admin_id IS NULL OR n.target_admin_id = ?)"
    );
  });

  it("幂等：重复标记不报错、不新增行（marked 1 → 0；SQL 为 INSERT IGNORE + 唯一键语义）", async () => {
    mocks.connExecute
      .mockResolvedValueOnce([{ insertId: 7, affectedRows: 1 }, undefined])
      .mockResolvedValueOnce([{ insertId: 0, affectedRows: 0 }, undefined]);

    const first = await markNotificationRead(31, ADMIN_A);
    const second = await markNotificationRead(31, ADMIN_A);

    expect(first).toEqual({ id: 31, read: true, marked: 1 });
    expect(second).toEqual({ id: 31, read: true, marked: 0 });
    expect(execCalls()[0].sql).toContain("INSERT IGNORE INTO t_platform_notification_read");
    expect(execCalls()[0].sql).toContain("VALUES (?, ?, NOW())");
    expect(execCalls()[0].params).toEqual([31, ADMIN_A]);
    // 两次调用各写一次（幂等由唯一键 + IGNORE 保证），不产生第二行
    expect(execCalls()).toHaveLength(2);
    expect(execCalls()[1].params).toEqual([31, ADMIN_A]);
  });

  it("A 管理员标记已读不影响 B 管理员（全员通知场景）", async () => {
    // 已读表对 A 有行、对 B 无行 —— 用真实连接结果模拟（isRead 由 admin 参数决定）
    mocks.query
      .mockResolvedValueOnce([{ total: 1 }]) // A：总数
      .mockResolvedValueOnce([{ total: 0 }]) // A：未读
      .mockResolvedValueOnce([{ ...NOTIFICATION_ROW, isRead: 1 }]) // A：已读
      .mockResolvedValueOnce([{ total: 1 }]) // B：总数
      .mockResolvedValueOnce([{ total: 1 }]) // B：未读
      .mockResolvedValueOnce([{ ...NOTIFICATION_ROW, isRead: 0 }]); // B：仍未读

    const forA = await listNotifications({ adminId: ADMIN_A });
    const forB = await listNotifications({ adminId: ADMIN_B });

    expect(forA.records[0].read).toBe(true);
    expect(forA.unreadCount).toBe(0);
    expect(forB.records[0].read).toBe(false);
    expect(forB.unreadCount).toBe(1);
    // 两个管理员的查询参数不同 ⇒ 已读状态按"当前管理员"取值
    expect(queryCalls()[2].params[0]).toBe(ADMIN_A);
    expect(queryCalls()[5].params[0]).toBe(ADMIN_B);
  });
});

describe("C6-2-T1 · POST /read-all（可见的全部未读，一次性标记）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
  });

  it("marked = 本次真实新增行数（1 → 0），且为单条 INSERT IGNORE ... SELECT（非逐条插入）", async () => {
    mocks.connExecute
      .mockResolvedValueOnce([{ affectedRows: 2 }, undefined])
      .mockResolvedValueOnce([{ affectedRows: 0 }, undefined]);

    const first = await markAllNotificationsRead(ADMIN_A);
    const second = await markAllNotificationsRead(ADMIN_A);

    expect(first).toEqual({ marked: 2 });
    expect(second).toEqual({ marked: 0 });
    // 两次调用共 2 次写入；每次都是"一条" INSERT ... SELECT（不是 N 条逐行插入）
    expect(execCalls()).toHaveLength(2);
    for (const call of execCalls()) {
      expect(call.sql).toContain("INSERT IGNORE INTO t_platform_notification_read");
      expect(call.sql).toContain("SELECT n.id AS notification_id, ?, NOW()");
      expect(call.sql).toContain("FROM t_platform_notification n");
      // 反测 c 的落点：可见性条件必须在 SQL 里（否则会把不可见通知也标成已读）
      expect(call.sql).toContain("n.target_admin_id IS NULL OR n.target_admin_id = ?");
      expect(call.params).toEqual([ADMIN_A, ADMIN_A]);
    }
  });

  it("拿不到管理员身份 ⇒ 401，且不写库（不静默造 ID）", async () => {
    await expect(listNotifications({ adminId: 0 })).rejects.toMatchObject({ statusCode: 401 });
    await expect(markNotificationRead(31, 0)).rejects.toMatchObject({ statusCode: 401 });
    await expect(markAllNotificationsRead(0)).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.connExecute).not.toHaveBeenCalled();
  });
});

describe("C6-2-T1 · 权限点与目录（如实标注，不伪造一致性）", () => {
  it("权限点常量取值（按 T6 目录 ticket:* 命名风格预登记）", () => {
    expect(Object.values(PLATFORM_NOTIFICATION_PERMISSIONS)).toEqual([
      "notification:view",
      "notification:read",
    ]);
    expect([...PLATFORM_NOTIFICATION_LEVELS]).toEqual(["INFO", "WARN", "URGENT"]);
  });

  it("PERMISSION_CATALOG 当前**没有** notification 域 —— 本单不并入、也不得自称已一致", () => {
    // 卡内 ⑥ 的澄清（凌舟补充口径 §四.1）：目录 8 域 18 条里无 notification，
    // 因此本单只做"预登记 + 注释如实标注"，新增模块属另单，须凌舟裁定。
    expect(PERMISSION_CATALOG.filter((entry) => entry.moduleCode === "notification")).toEqual([]);
    expect(PERMISSION_CATALOG.filter((entry) => entry.permCode.startsWith("notification:"))).toEqual([]);
  });
});
