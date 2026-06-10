import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env.js";

export type AuthUser = {
  id: number;
  username: string;
  roles: string[];
  storeId?: number | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: "8h" });
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ code: "401", message: "未登录" });
    return;
  }
  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    next();
  } catch {
    res.status(401).json({ code: "401", message: "登录已失效" });
  }
};
