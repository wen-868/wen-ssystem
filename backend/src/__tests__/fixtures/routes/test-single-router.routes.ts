import { Router } from "express";

// 优先级 3：只导出单个 Router，从文件名推断 prefix
export const singleRouter = Router();
singleRouter.get("/", (req, res) => res.json({ ok: "single" }));
