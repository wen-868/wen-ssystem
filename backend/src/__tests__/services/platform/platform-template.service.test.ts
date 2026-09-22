/**
 * C2-0 实现段：初始化模板服务（t_platform_template + t_platform_template_version）
 *
 * 口径（对应 R101-C2-0 凌舟裁定 二/三）：
 * - 空态诚实：无数据 返回 { records: [], total: 0 }，读路径不做任何写操作（无隐式种子）；
 * - 新建/编辑：主表与版本快照在同一事务内写入，编辑 version+1；
 * - 编码重复 409（含唯一键竞态兜底）；模板不存在 404。
 *
 * 注意：本沙箱 vitest 无法启动（spawn EPERM），用例只写好，执行由凌舟在本机跑。
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
  listInitTemplates,
  createInitTemplate,
  updateInitTemplate,
  listTemplateVersions,
} from "../../../services/platform/platform-template.service";
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

describe("platform/platform-template.service（C2-0）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (runner: any) => runner({}));
    mocks.connExecute.mockResolvedValue([{ insertId: 7, affectedRows: 1 }, undefined]);
  });

  it("列表空态：records 空数组，且读路径不写库（无隐式种子）", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const result = await listInitTemplates();

    expect(result).toEqual({ records: [], total: 0 });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(String(mocks.query.mock.calls[0][0])).toContain("FROM t_platform_template");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.connExecute).not.toHaveBeenCalled();
  });

  it("列表映射：config_json.copyConfigs 转为 copyConfigs（布尔化），标志位转布尔", async () => {
    mocks.query.mockResolvedValueOnce([
      {
        id: 1,
        code: "RETAIL_BASIC",
        name: "零售标准版",
        applicable: "单店",
        codeRule: "SP",
        convertRule: "箱-瓶",
        printRef: "12",
        defaultWhAccount: "主仓",
        configJson: JSON.stringify({
          copyConfigs: [{ label: "编号规则", public: true }, { label: "换算规则" }, { public: false }],
        }),
        freeAvailable: 1,
        recommended: 0,
        version: 2,
        refCount: 0,
        status: 1,
        createdBy: "platform_admin",
        createdAt: "2026-09-23 10:00:00",
        updatedAt: "2026-09-23 10:00:00",
      },
    ]);
    const { records } = await listInitTemplates();

    expect(records).toHaveLength(1);
    expect(records[0].copyConfigs).toEqual([
      { label: "编号规则", public: true },
      { label: "换算规则", public: false },
    ]);
    expect(records[0].freeAvailable).toBe(true);
    expect(records[0].recommended).toBe(false);
    expect(records[0].version).toBe(2);
  });

  it("脏 config_json（非 JSON 字符串）按无配置处理，不抛错也不造默认值", async () => {
    mocks.query.mockResolvedValueOnce([
      {
        id: 2,
        code: "BROKEN",
        name: "脏数据模板",
        applicable: "",
        codeRule: "",
        convertRule: "",
        printRef: "",
        defaultWhAccount: "",
        configJson: "not-json",
        freeAvailable: 0,
        recommended: 0,
        version: 1,
        refCount: 0,
        status: 1,
        createdBy: null,
        createdAt: "2026-09-23 10:00:00",
        updatedAt: "2026-09-23 10:00:00",
      },
    ]);
    const { records } = await listInitTemplates();

    expect(records[0].configJson).toBeNull();
    expect(records[0].copyConfigs).toEqual([]);
  });

  it("新建：主表与 version=1 版本快照在同一事务写入，操作人入列", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const result = await createInitTemplate(
      {
        code: "RETAIL_NEW",
        name: "零售新建模板",
        applicable: "单店",
        configJson: { copyConfigs: [{ label: "编号规则", public: true }] },
        freeAvailable: true,
      },
      "platform_admin"
    );

    expect(result.id).toBe(7);
    expect(result.version).toBe(1);
    expect(result.copyConfigs).toEqual([{ label: "编号规则", public: true }]);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    const calls = execCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].sql).toContain("INSERT INTO t_platform_template");
    expect(calls[0].params[0]).toBe("RETAIL_NEW");
    expect(calls[0].params[1]).toBe("零售新建模板");
    expect(calls[0].params[8]).toBe(1);
    expect(calls[0].params[calls[0].params.length - 1]).toBe("platform_admin");
    expect(calls[1].sql).toContain("INSERT INTO t_platform_template_version");
    expect(calls[1].sql).toContain("(template_id, version, config_json, change_note, created_by)");
    expect(calls[1].sql).toContain("VALUES (?, 1, ?, ?, ?)");
    expect(calls[1].params[0]).toBe(7);
    expect(JSON.parse(String(calls[1].params[1]))).toEqual({
      copyConfigs: [{ label: "编号规则", public: true }],
    });
    expect(calls[1].params[2]).toBe("新建模板首版本");
    expect(calls[1].params[3]).toBe("platform_admin");
  });

  it("新建：编码重复 409，且不进入事务", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1 });

    await expect(
      createInitTemplate({ code: "RETAIL_BASIC", name: "重复编码" }, "platform_admin")
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("新建：并发竞态（唯一键 ER_DUP_ENTRY）同样按 409 返回，不外泄 500", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    mocks.transaction.mockRejectedValueOnce(
      Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 })
    );

    await expect(
      createInitTemplate({ code: "RETAIL_RACE", name: "竞态" }, "platform_admin")
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("编辑：version+1 并写版本快照（快照取当前落库配置）", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      id: 3,
      version: 2,
      configJson: JSON.stringify({ copyConfigs: [{ label: "编号规则", public: true }] }),
    });
    const result = await updateInitTemplate(3, { name: "改名" }, "platform_admin");

    expect(result.version).toBe(3);
    expect(result.changedFields).toEqual(["name"]);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    const calls = execCalls();
    expect(calls[0].sql).toContain("UPDATE t_platform_template");
    expect(calls[0].sql).toContain("version = ?");
    expect(calls[0].params).toContain(3);
    expect(calls[1].sql).toContain("INSERT INTO t_platform_template_version");
    expect(calls[1].params[0]).toBe(3);
    expect(calls[1].params[1]).toBe(3);
    expect(JSON.parse(String(calls[1].params[2]))).toEqual({
      copyConfigs: [{ label: "编号规则", public: true }],
    });
  });

  it("编辑：模板不存在 404，且不进入事务", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);

    await expect(updateInitTemplate(999, { name: "x" }, "platform_admin")).rejects.toBeInstanceOf(
      AppError
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("编辑：未提供任何字段 400（不产生空 UPDATE）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 3, version: 1, configJson: null });

    await expect(updateInitTemplate(3, {}, "platform_admin")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("编辑：改 code 时查重命中 409", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ id: 3, version: 1, configJson: null })
      .mockResolvedValueOnce({ id: 9 });

    await expect(
      updateInitTemplate(3, { code: "TAKEN" }, "platform_admin")
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("版本记录：空态 records 空数组，按 version 倒序查询", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const result = await listTemplateVersions(5);

    expect(result).toEqual({ records: [], total: 0, templateId: 5 });
    expect(String(mocks.query.mock.calls[0][0])).toContain("ORDER BY version DESC");
  });

  it("版本记录：映射 changeNote / createdBy / 快照", async () => {
    mocks.query.mockResolvedValueOnce([
      {
        id: 2,
        templateId: 5,
        version: 2,
        configJson: { copyConfigs: [{ label: "打印模板", public: true }] },
        changeNote: "编辑模板（name）",
        createdBy: "platform_admin",
        createdAt: "2026-09-23 11:00:00",
      },
    ]);
    const { records } = await listTemplateVersions(5);

    expect(records[0].version).toBe(2);
    expect(records[0].changeNote).toBe("编辑模板（name）");
    expect(records[0].copyConfigs).toEqual([{ label: "打印模板", public: true }]);
  });

  it("写路径只存在于显式写入方法：列表/版本查询不产生 INSERT/UPDATE", async () => {
    mocks.query.mockResolvedValue([]);
    await listInitTemplates();
    await listTemplateVersions(1);

    const allSql = (mocks.query.mock.calls as unknown[][]).map((c) => String(c[0])).join("\n");
    expect(allSql).not.toContain("INSERT INTO");
    expect(allSql).not.toContain("UPDATE ");
    expect(mocks.connExecute).not.toHaveBeenCalled();
  });
});
