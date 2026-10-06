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
  getSysConfig,
  updateSysConfig,
} from "../../../services/platform/platform-sys-config.service";

/**
 * R101-S2-02 组4① 护栏④：
 * DEFAULTS 只作表单初值；前端必须能区分「未配置（置灰阻断）」，
 * 且 DEFAULTS / 元字段不得被当作已生效配置回写。
 */
describe("platform/platform-sys-config.service（R101-S2-02 组4①）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("库中无记录：switches/channels 为 null，且全部键标记 _unconfigured", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const cfg = await getSysConfig();
    expect(cfg.switches).toBeNull();
    expect(cfg.channels).toBeNull();
    expect(Array.isArray(cfg._unconfigured)).toBe(true);
    expect(cfg._unconfigured).toContain("switches");
    expect(cfg._unconfigured).toContain("channels");
    expect(cfg._unconfigured).toContain("platformName");
  });

  it("已存 switches 时：_unconfigured 不再含 switches（可区分未配置 vs 已配置）", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      config_value: JSON.stringify({
        switches: { openApi: { enabled: true, defaultEnabled: false } },
      }),
    });
    const cfg = await getSysConfig();
    expect(cfg._unconfigured).not.toContain("switches");
    expect(cfg._unconfigured).toContain("channels");
    const switches = cfg.switches as Record<string, { enabled: boolean }>;
    expect(switches.openApi.enabled).toBe(true);
  });

  it("保存时剔除 _ 前缀元字段与 null（不把「未配置」固化成空值）", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 7 });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });

    await updateSysConfig(
      { platformName: "智享全链", switches: null, _unconfigured: ["switches"] } as Record<
        string,
        unknown
      >,
      "platform"
    );

    const params = mocks.query.mock.calls[0][1] as unknown[];
    const json = JSON.parse(String(params[0]));
    expect(json.platformName).toBe("智享全链");
    expect("switches" in json).toBe(false);
    expect("_unconfigured" in json).toBe(false);
    // 护栏③：JSON 包必须带 version
    expect(json.version).toBe(1);
  });

  it("护栏③：GET 响应恒带 version（历史包无 version 时按 1 呈现）", async () => {
    mocks.queryOne.mockResolvedValueOnce({
      config_value: JSON.stringify({ platformName: "智享全链" }),
    });
    const cfg = await getSysConfig();
    expect(cfg.version).toBe(1);

    mocks.queryOne.mockResolvedValueOnce(null);
    const cfg2 = await getSysConfig();
    expect(cfg2.version).toBe(1);
  });

  it("护栏③：包内 version 为非法值（0 / 非数字）时被规范为 1", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 9 });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    await updateSysConfig({ platformName: "智享全链", version: 0 } as Record<string, unknown>, "platform");
    const json = JSON.parse(String(mocks.query.mock.calls[0][1][0]));
    expect(json.version).toBe(1);
  });

  it("S3-22：loginBanner / copyrightInfo / icpNumber 在 DEFAULTS 中（空串初值），未落库时列入 _unconfigured", async () => {
    mocks.queryOne.mockResolvedValueOnce(null);
    const cfg = await getSysConfig();
    expect(cfg.loginBanner).toBe("");
    expect(cfg.copyrightInfo).toBe("");
    expect(cfg.icpNumber).toBe("");
    const unconf = cfg._unconfigured as string[];
    expect(unconf).toContain("loginBanner");
    expect(unconf).toContain("copyrightInfo");
    expect(unconf).toContain("icpNumber");
  });

  it("S3-22：写入 → 读回一致（三个合规/文案键走既有 t_platform_config 整包 JSON）", async () => {
    const payload = {
      loginBanner: "让批零生意，全链路智能运转",
      copyrightInfo: "© 2026 智享全链",
      icpNumber: "京ICP备12345678号",
    };

    // 写入：已存在配置行 ⇒ UPDATE
    mocks.queryOne.mockResolvedValueOnce({ id: 7 });
    mocks.query.mockResolvedValueOnce({ affectedRows: 1 });
    await updateSysConfig(payload, "platform");

    const writtenJson = String(mocks.query.mock.calls[0][1][0]);
    const written = JSON.parse(writtenJson);
    expect(written.loginBanner).toBe(payload.loginBanner);
    expect(written.copyrightInfo).toBe(payload.copyrightInfo);
    expect(written.icpNumber).toBe(payload.icpNumber);

    // 读回：库中 config_value 即写入的 JSON
    mocks.queryOne.mockResolvedValueOnce({ config_value: writtenJson });
    const cfg = await getSysConfig();
    expect(cfg.loginBanner).toBe(payload.loginBanner);
    expect(cfg.copyrightInfo).toBe(payload.copyrightInfo);
    expect(cfg.icpNumber).toBe(payload.icpNumber);
    expect((cfg._unconfigured as string[])).not.toContain("icpNumber");
  });
});
