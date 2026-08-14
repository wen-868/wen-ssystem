import { Router } from "express";

// 优先级 4：导出多个 Router 但无 routeConfigs
export const multiRouterA = Router();
multiRouterA.get("/", (req, res) => res.json({ ok: "a" }));

export const multiRouterB = Router();
multiRouterB.get("/", (req, res) => res.json({ ok: "b" }));
