/**
 * R101-C6-3-1：功能开关服务（t_platform_feature_switch）
 *
 * 口径（对应派单卡 §三A② 与验收标准③）：
 * - 空表诚实空态：items: []，读路径零写库、不生种子；
 * - 只改传了的字段；未传字段不得被覆盖；
 * - 未知 code ⇒ AppError 404（不 upsert、不静默建行）；
 * - 「无变更」两种形态都 400：① 三个字段都没给（控制器 zod 已挡，服务侧再兜一层空 assignments）
 *   ② 给了但与当前值完全相同 ⇒ 400「提交内容与当前配置一致，无字段变更」。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  listFeatureSwitches,
  updateFeatureSwitch,
} from "../../../services/platform/platform-feature-switch.service";
import { AppError } from "../../../shared/app-error";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("C6-3-1 · listFeatureSwitches", () => {
  it("空表 ⇒ items: []，且 SQL 只读 t_platform_feature_switch（不碰 t_platform_config / t_subscription_plan）", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const result = await listFeatureSwitches();
    expect(result).toEqual({ items: [] });
    const sql = String(mocks.query.mock.calls[0][0]);
    expect(sql).toContain("t_platform_feature_switch");
    expect(sql).not.toContain("t_platform_config");
    expect(sql).not.toContain("t_subscription_plan");
  });

  it("TINYINT 归一为 boolean（1 ⇒ true / 0 ⇒ false，NULL remark ⇒ null）", async () => {
    mocks.query.mockResolvedValueOnce([
      {
        featureCode: "member",
        featureName: "会员",
        enabled: 1,
        defaultForNewTenant: 0,
        remark: null,
      },
    ]);
    const result = await listFeatureSwitches();
    expect(result.items).toEqual([
      {
        featureCode: "member",
        featureName: "会员",
        enabled: true,
        defaultForNewTenant: false,
        remark: null,
      },
    ]);
  });
});

describe("C6-3-1 · updateFeatureSwitch", () => {
  it("未知 code ⇒ AppError 404，且不执行任何 UPDATE", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    await expect(updateFeatureSwitch("nope", { enabled: true })).rejects.toThrow(AppError);
    await expect(updateFeatureSwitch("nope", { enabled: true })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("只改 enabled ⇒ changedFields 仅含 enabled，UPDATE 只带该列 + updated_by", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      featureCode: "multi_unit",
      featureName: "多计量单位",
      enabled: 0,
      defaultForNewTenant: 1,
      remark: null,
    });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    const result = await updateFeatureSwitch("multi_unit", { enabled: true }, 9);

    expect(result).toEqual({ featureCode: "multi_unit", changedFields: ["enabled"] });
    const [sql, params] = mocks.query.mock.calls[0];
    expect(String(sql)).toContain("enabled = ?");
    expect(String(sql)).toContain("updated_by = ?");
    expect(String(sql)).not.toContain("default_for_new_tenant = ?");
    expect(String(sql)).not.toContain("remark = ?");
    expect(params).toEqual([1, 9, "multi_unit"]);
  });

  it("三个字段都给且都变 ⇒ changedFields 三项（驼峰命名）", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      featureCode: "report",
      featureName: "报表模块",
      enabled: 0,
      defaultForNewTenant: 0,
      remark: "旧备注",
    });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    const result = await updateFeatureSwitch(
      "report",
      { enabled: true, defaultForNewTenant: true, remark: "新备注" },
      null
    );

    expect(result.changedFields).toEqual(["enabled", "defaultForNewTenant", "remark"]);
    expect(mocks.query.mock.calls[0][1]).toEqual([1, 1, "新备注", null, "report"]);
  });

  it("提交值与当前值完全相同 ⇒ AppError 400（不得静默成功），且不执行 UPDATE", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      featureCode: "member",
      featureName: "会员",
      enabled: 1,
      defaultForNewTenant: 0,
      remark: null,
    });
    await expect(updateFeatureSwitch("member", { enabled: true, remark: null })).rejects.toMatchObject({
      statusCode: 400,
      message: "提交内容与当前配置一致，无字段变更",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("空 body（三个字段都 undefined）⇒ AppError 400，且不执行 UPDATE", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      featureCode: "member",
      featureName: "会员",
      enabled: 0,
      defaultForNewTenant: 0,
      remark: null,
    });
    await expect(updateFeatureSwitch("member", {})).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("remark 由文本改为 null 也算变更（可以清除备注）", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      featureCode: "member",
      featureName: "会员",
      enabled: 0,
      defaultForNewTenant: 0,
      remark: "有备注",
    });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    const result = await updateFeatureSwitch("member", { remark: null });
    expect(result.changedFields).toEqual(["remark"]);
    expect(mocks.query.mock.calls[0][1]).toEqual([null, null, "member"]);
  });

  it("remark 传空串 ⇒ 归一为 NULL 落库（不落空串）；现值已是 NULL 时视作无变更 ⇒ 400", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      featureCode: "member",
      featureName: "会员",
      enabled: 0,
      defaultForNewTenant: 0,
      remark: "旧备注",
    });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    const cleared = await updateFeatureSwitch("member", { remark: "   " });
    expect(cleared.changedFields).toEqual(["remark"]);
    expect(mocks.query.mock.calls[0][1]).toEqual([null, null, "member"]);

    vi.resetAllMocks();
    mocks.queryOne.mockResolvedValueOnce({
      featureCode: "member",
      featureName: "会员",
      enabled: 0,
      defaultForNewTenant: 0,
      remark: null,
    });
    await expect(updateFeatureSwitch("member", { remark: "" })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
