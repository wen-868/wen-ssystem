import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../shared/env";
import { query, queryOne } from "../shared/db";
import { fail } from "../shared/response";
import { tenantMiddleware } from "./tenant";
import {
  MERCHANT_JWT_AUDIENCE,
  MERCHANT_JWT_ISSUER,
  type AuthUser,
} from "./auth";

/**
 * 消费者身份适配层（S3-196：收口总清单第 52 项）
 *
 * 【为什么需要】消费者端（`/api/miniapp/**`）的端点此前一律挂 `requireAuthWithTenant`，
 *   要的是**商家端 JWT**（issuer=zhixiang-system）。但微信原生小程序手上只有
 *   `/api/miniapp/wechat/auth/login` 下发的**微信令牌**（payload 只有 wxUserId/openid）
 *   ⇒ 老端对消费者端点恒 401（"看起来能用、实际打不通"）。
 *   让消费者去换商家 JWT 需要消费者持有商家账号，产品上不成立（凌舟 2026-10-14 裁定③）。
 *
 * 【本中间件做什么】在消费者端接受**两种**载体：
 *   ① 商家端 JWT —— 原样透传（既有调用方/既有测试行为逐字不变，属回归保护）；
 *   ② 微信令牌 —— 解析出**绑定的消费者身份**并注入最小可用的 `req.user`：
 *        · 身份来源 = `t_member`（会员），按 `openid` + 租户匹配（`t_member.id` 即消费者口径的"用户 id"，
 *          见 community-marketing.service.ts:704「小程序用户 id 即 t_member.id」；订单表亦以
 *          `t_miniapp_order.member_id` 关联 t_member，见 miniapp.service.ts:489-492）；
 *        · `roles` 恒为 `[]` —— 消费者身份**不携带任何商家角色**，不可能被 requireRoles/requirePermission
 *          当成商家或平台身份放行；
 *        · `tenantId` 来源顺序：**令牌携带 → `X-Tenant-Id` 请求头 → 从绑定身份解析 → 不伪造**（凌舟裁定③/④）。
 *          ⚠️ 第三步是**实现期补入并已报备**的：老 miniapp 全仓 `rg -i tenant miniapp` 零命中
 *          （客户端既不发 `X-Tenant-Id`、也无租户概念，部署产物只注入 apiBase/storeId）⇒ 只有前两步
 *          时「老端三处调用 401 ⇒ 200」这条判据**不可达**。故当两源都缺时，按 openid 唯一命中会员
 *          取其租户；**0 命中或多命中（跨租户歧义）一律 401**，绝不默认租户、绝不取第一条。
 *
 * 【显式失败，不静默】以下三种情况一律 401（不落库、不做任何降级猜测）：
 *   · 无凭证 / 令牌非法；
 *   · 微信令牌路径下租户不可解析（两源都缺、且 openid 未命中或跨租户歧义）；
 *   · 解析不到该租户下绑定的会员（消费者身份未建立/已禁用）——不许凭空造身份。
 *
 * 【CSRF 主体】登录响应里的 csrfToken = HMAC(微信用户 id)（services/wechat.service.ts:73），
 *   而本中间件注入的业务身份是会员 id（两者不同）。二者同属同一登录态，故用
 *   `req.csrfSubjectIds` 把它俩一并声明给 csrfMiddleware（见 middleware/csrf.ts 注释）。
 */

declare global {
  namespace Express {
    interface Request {
      /** 允许通过 x-csrf-token 的等价主体 id 集合（见 middleware/csrf.ts） */
      csrfSubjectIds?: number[];
      /** 消费者登录态里的微信用户 id（t_wx_user.id），供需要微信身份的逻辑读取 */
      consumerWxUserId?: number;
    }
  }
}

/** 微信令牌载荷（signWxToken 签发，见 middleware/wechat-auth.ts） */
type WxTokenPayload = { wxUserId: number; openid: string; tenantId?: string };

/** 绑定到该微信 openid 的会员（消费者身份） */
type BoundConsumer = { id: number; name: string | null; tenant_id: string };

function bearerToken(req: { headers: Record<string, unknown> }): string {
  const authorization = (req.headers.authorization as string) || "";
  return authorization.replace(/^Bearer\s+/i, "");
}

/** 商家端 JWT：与本仓库既有口径（issuer/audience 双校验）逐字一致 */
function tryVerifyMerchantToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: MERCHANT_JWT_ISSUER,
      audience: MERCHANT_JWT_AUDIENCE,
    }) as AuthUser;
  } catch {
    return null;
  }
}

/** 微信令牌：payload 必须同时带数值型 wxUserId 与字符串 openid，否则不认 */
function tryVerifyWxToken(token: string): WxTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as Partial<WxTokenPayload>;
    const wxUserId = Number(decoded?.wxUserId);
    if (!Number.isInteger(wxUserId) || wxUserId <= 0) return null;
    if (typeof decoded?.openid !== "string" || !decoded.openid) return null;
    return {
      wxUserId,
      openid: decoded.openid,
      tenantId: typeof decoded.tenantId === "string" ? decoded.tenantId : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 按 openid + 租户解析绑定的会员（消费者身份）。
 * 只读一条、不带任何租户兜底；`status = 1` 之外的会员视为不可用。
 */
async function findBoundConsumer(openid: string, tenantId: string): Promise<BoundConsumer | null> {
  return await queryOne<BoundConsumer>(
    "SELECT id, name, tenant_id FROM t_member WHERE openid = ? AND tenant_id = ? AND status = 1",
    [openid, tenantId]
  );
}

/**
 * 两源都缺时的租户解析：按 openid 在**全部租户**里找绑定会员。
 * 只接受「唯一命中」——0 命中（未绑定）与多命中（跨租户歧义）都返回 null，由调用方显式 401。
 */
async function findUniqueBoundConsumer(openid: string): Promise<BoundConsumer | null> {
  const rows = await query<BoundConsumer>(
    "SELECT id, name, tenant_id FROM t_member WHERE openid = ? AND status = 1 LIMIT 2",
    [openid]
  );
  return rows.length === 1 ? rows[0] : null;
}

export const requireConsumerAuth: RequestHandler = (req, res, next) => {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json(fail("未登录", "401"));
    return;
  }

  // ① 商家端 JWT：原样透传（既有消费者端调用方与测试的兼容路径）
  const merchant = tryVerifyMerchantToken(token);
  if (merchant) {
    req.user = merchant;
    next();
    return;
  }

  // ② 微信令牌：解析绑定的消费者身份
  const wx = tryVerifyWxToken(token);
  if (!wx) {
    res.status(401).json(fail("登录已失效", "401"));
    return;
  }

  const explicitTenantId = wx.tenantId || ((req.headers["x-tenant-id"] as string) || "");

  const resolveConsumer = async (): Promise<BoundConsumer | null> =>
    explicitTenantId
      ? await findBoundConsumer(wx.openid, explicitTenantId)
      : await findUniqueBoundConsumer(wx.openid);

  void resolveConsumer()
    .then((member) => {
      if (!member) {
        // 凌舟裁定④：身份/租户不可解析时**显式失败**（400/401 级），
        // 禁止静默落库到空租户、默认租户或"第一条命中"。
        res
          .status(401)
          .json(
            fail(
              explicitTenantId
                ? "消费者身份未建立（该微信未绑定本租户会员）"
                : "缺少租户信息（令牌未携带租户、未提供 X-Tenant-Id，且该微信未唯一绑定某一租户会员）",
              "401"
            )
          );
        return;
      }
      const tenantId = member.tenant_id;
      const consumer = {
        id: member.id,
        username: `wx_${wx.openid}`,
        realName: member.name || undefined,
        // 消费者身份不携带任何商家角色
        roles: [] as string[],
        storeId: null,
        tenantId,
      } satisfies AuthUser;
      req.user = consumer;
      req.consumerWxUserId = wx.wxUserId;
      // 同一登录态的两个等价主体：业务身份（会员 id）＋会话身份（微信用户 id，登录下发 csrfToken 用的就是它）
      req.csrfSubjectIds = [member.id, wx.wxUserId];
      next();
    })
    .catch(next);
};

export const requireConsumerAuthWithTenant = [requireConsumerAuth, tenantMiddleware] as RequestHandler[];
