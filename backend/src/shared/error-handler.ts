import type { ErrorRequestHandler } from "express";
import { fail } from "./response.js";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const messages = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    res.status(400).json(fail(messages, "400"));
    return;
  }
  console.error(err);
  res.status(500).json(fail("服务器内部错误", "500"));
};
