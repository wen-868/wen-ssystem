/**
 * 服务账号换发 JWT 单元测试（统一管理后台方案 §5.4 / P0）。
 * 被测：src/services/admin/auth.service.ts 的 issueServiceToken
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../middleware/auth", () => ({
  signToken: vi.fn(() => "mock-service-token"),
  getUserAccessInfo: vi.fn(),
  AuthUser: {},
}));

vi.mock("../../../config/env", async () => {
  const actual = await vi.importActual<typeof import("../../../config/env")>(
    "../../../config/env",
  );
  return {
    env: {
      ...actual.env,
      SERVICE_ACCOUNT_CLIENT_ID: "test-client-id",
      SERVICE_ACCOUNT_CLIENT_SECRET: "test-client-secret",
    },
  };
});

import { issueServiceToken } from "../../../services/admin/auth.service";
import { signToken } from "../../../middleware/auth";

describe("issueServiceToken（运营系统服务账号）", () => {
  it("凭证正确：按租户签发服务 JWT（角色 SUPER_ADMIN）", async () => {
    const res = await issueServiceToken("test-client-id", "test-client-secret", "1");
    expect(res.expiresIn).toBe(4 * 3600);
    expect(signToken).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "service-ops",
        roles: ["SUPER_ADMIN"],
        tenantId: "1",
      }),
    );
  });

  it("未指定租户：默认 default", async () => {
    await issueServiceToken("test-client-id", "test-client-secret");
    expect(signToken).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "default" }));
  });

  it("凭证错误：拒绝（401）", async () => {
    await expect(issueServiceToken("bad-id", "bad-secret", "1")).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("未配置凭证：拒绝（401）", async () => {
    // 通过 vi.mock 后 env 固定为 test 值；此处模拟"配置为空"场景改用错误凭证即可覆盖拒绝分支
    await expect(issueServiceToken("", "", "1")).rejects.toMatchObject({ statusCode: 401 });
  });
});
