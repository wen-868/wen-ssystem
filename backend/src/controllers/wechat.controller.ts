import { z } from "zod";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../shared/async-handler.js";
import { env } from "../shared/env.js";
import { ok, fail } from "../shared/response.js";
import { queryOne } from "../shared/db.js";
import * as service from "../services/wechat.service.js";

// 这些函数需要从路由文件中传入（因为它们在路由文件中定义）
type Code2SessionFn = (code: string) => Promise<{ openid: string; session_key: string; unionid?: string }>;
type AesDecryptFn = (encryptedData: string, iv: string, sessionKey: string) => string;
type SignWxTokenFn = (wxUserId: number, openid: string) => string;

export function createWechatController(
  code2Session: Code2SessionFn,
  aesDecrypt: AesDecryptFn,
  signWxToken: SignWxTokenFn
) {
  const login = asyncHandler(async (req, res) => {
    const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
    const wxData = await code2Session(code);
    const result = await service.login(wxData, signWxToken);
    res.json(ok(result));
  });

  const decryptPhone = asyncHandler(async (req, res) => {
    const { encryptedData, iv } = z.object({
      encryptedData: z.string().min(1),
      iv: z.string().min(1),
    }).parse(req.body);

    const authorization = req.headers.authorization || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) {
      res.status(401).json(fail("未登录", "401"));
      return;
    }
    const decoded = jwt.verify(token, env.JWT_SECRET) as { wxUserId: number; openid: string };

    const wxUser = await queryOne<{ session_key: string }>(
      "SELECT session_key FROM wx_user WHERE id = ?",
      [decoded.wxUserId]
    );
    if (!wxUser || !wxUser.session_key) {
      res.status(400).json(fail("session_key不存在，请重新登录", "400"));
      return;
    }

    const decrypted = aesDecrypt(encryptedData, iv, wxUser.session_key);
    const phoneData = JSON.parse(decrypted) as { phoneNumber: string; purePhoneNumber: string; watermark?: any };
    const phone = phoneData.phoneNumber || phoneData.purePhoneNumber;

    const result = await service.decryptPhone(decoded.wxUserId, phone);
    res.json(ok(result));
  });

  const updateProfile = asyncHandler(async (req, res) => {
    const wxUser = (req as any).wxUser;
    if (!wxUser) {
      res.status(401).json(fail("未登录", "401"));
      return;
    }

    const body = z.object({
      nickname: z.string().max(64).optional(),
      avatarUrl: z.string().max(512).optional(),
    }).parse(req.body);

    await service.updateProfile(wxUser.id, body);
    res.json(ok({ message: "更新成功" }));
  });

  const getProfile = asyncHandler(async (req, res) => {
    const wxUser = (req as any).wxUser;
    const userInfo = await service.getProfile(wxUser.id);

    if (!userInfo) {
      res.status(404).json(fail("用户不存在", "404"));
      return;
    }

    res.json(ok(userInfo));
  });

  const bind = asyncHandler(async (req, res) => {
    const wxUser = (req as any).wxUser;
    const body = z.object({
      username: z.string().min(1),
      password: z.string().min(1),
      bindingType: z.enum(["ADMIN", "MERCHANT", "CONSUMER"]),
    }).parse(req.body);

    const result = await service.bindUser(wxUser.id, body);

    if (!result.success) {
      res.status(400).json(fail(result.message!, result.code));
      return;
    }

    res.json(ok(result.data));
  });

  const unbind = asyncHandler(async (req, res) => {
    const wxUser = (req as any).wxUser;
    const body = z.object({
      systemUserId: z.number().int().positive(),
    }).parse(req.body);

    const result = await service.unbindUser(wxUser.id, body.systemUserId);

    if (!result.success) {
      res.status(400).json(fail(result.message!, result.code));
      return;
    }

    res.json(ok({ message: result.message }));
  });

  return {
    login,
    decryptPhone,
    updateProfile,
    getProfile,
    bind,
    unbind
  };
}