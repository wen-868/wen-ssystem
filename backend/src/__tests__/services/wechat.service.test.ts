import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("../../shared/db", () => ({
  query: mocks.query,
  queryOne: mocks.queryOne,
}));

import {
  login,
  getSessionKey,
  decryptPhone,
  updateProfile,
  getProfile,
} from "../../services/wechat.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("wechat.service - 微信用户", () => {
  it("login 新用户：插入并返回 token 与用户信息", async () => {
    mocks.queryOne
      .mockResolvedValueOnce(null) // 不存在
      .mockResolvedValueOnce({ id: 7, nickname: null, avatar_url: null, phone: null, gender: null, city: null, province: null, country: null });
    mocks.query.mockResolvedValueOnce([{ insertId: 7 }]); // database 归一化数组
    const signWxToken = vi.fn().mockReturnValue("wx-token");
    const res = await login({ openid: "o1", session_key: "sk", unionid: "u1" }, signWxToken);
    expect(res.token).toBe("wx-token");
    expect(res.userInfo.id).toBe(7);
    expect(res.userInfo.nickname).toBe("微信用户");
    // 验证 insertId 从数组首元素取值（database.ts 归一化），用户查询使用真实 id
    expect(mocks.queryOne.mock.calls[1][1]).toEqual([7]);
    const insertCall = mocks.query.mock.calls[0];
    expect(insertCall[0]).toContain("INSERT INTO t_wx_user");
  });

  it("login 老用户：更新 session_key 并复用 id", async () => {
    mocks.queryOne
      .mockResolvedValueOnce({ id: 3 })
      .mockResolvedValueOnce({ id: 3, nickname: "张三", avatar_url: "a", phone: "138", gender: null, city: null, province: null, country: null });
    mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const signWxToken = vi.fn().mockReturnValue("t2");
    const res = await login({ openid: "o2", session_key: "sk2" }, signWxToken);
    expect(res.userInfo.id).toBe(3);
    expect(res.userInfo.nickname).toBe("张三");
    const updateCall = mocks.query.mock.calls[0];
    expect(updateCall[0]).toContain("UPDATE t_wx_user SET session_key");
  });

  it("getSessionKey 返回会话密钥", async () => {
    mocks.queryOne.mockResolvedValue({ session_key: "sk" });
    expect(await getSessionKey(1)).toEqual({ session_key: "sk" });
  });

  it("decryptPhone 更新手机号", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    const res = await decryptPhone(1, "13800000000");
    expect(res).toEqual({ phone: "13800000000" });
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("SET phone = ?"),
      ["13800000000", 1]
    );
  });

  it("updateProfile 更新昵称头像", async () => {
    mocks.query.mockResolvedValue([{ affectedRows: 1 }]);
    await updateProfile(1, { nickname: "新昵称", avatarUrl: "url" });
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("SET nickname = ?, avatar_url = ?"),
      ["新昵称", "url", 1]
    );
  });

  it("getProfile 返回用户信息与绑定列表，无用户返回 null", async () => {
    mocks.queryOne.mockResolvedValueOnce({ id: 1, openid: "o", nickname: "n", avatarUrl: "a", phone: "p", gender: null, city: null, province: null, country: null, lastLoginAt: null, createdAt: null });
    mocks.query.mockResolvedValueOnce([{ id: 1, binding_type: "MERCHANT", status: "ACTIVE", bound_at: null, username: "admin", realName: "管理员" }]);
    const profile = await getProfile(1);
    expect(profile?.bindings).toHaveLength(1);
    expect(profile?.bindings[0].username).toBe("admin");

    mocks.queryOne.mockResolvedValueOnce(null);
    expect(await getProfile(99)).toBeNull();
  });
});
