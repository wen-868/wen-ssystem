import type { ErrorRequestHandler } from "express";
import { ZodError, type ZodIssue } from "zod";
import { fail } from "./response.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);

  // ZodError：参数校验失败，返回 400 及具体字段错误
  if (err instanceof ZodError) {
    const fieldErrors = err.errors.map((e: ZodIssue) => ({
      field: e.path.join(".") || "root",
      message: e.message,
      code: e.code
    }));
    res.status(400).json({ code: "400", message: "参数校验失败", errors: fieldErrors });
    return;
  }

  // 业务错误：带有 statusCode 属性的错误，返回对应状态码
  if (err && typeof err === "object" && "statusCode" in err) {
    const status = (err as any).statusCode as number;
    const message = (err as any).message || "请求错误";
    const code = String(status);
    res.status(status).json(fail(message, code));
    return;
  }

  // 未知错误：返回 500
  res.status(500).json(fail("服务器内部错误", "500"));
};
