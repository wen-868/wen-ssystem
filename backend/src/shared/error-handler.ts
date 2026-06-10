import type { ErrorRequestHandler } from "express";
import { fail } from "./response.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json(fail("服务器内部错误", "500"));
};
