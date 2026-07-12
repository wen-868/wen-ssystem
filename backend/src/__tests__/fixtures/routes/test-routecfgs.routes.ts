import { Router } from "express";

// 优先级 1：导出 routeConfigs 数组
const router1 = Router();
router1.get("/", (req, res) => res.json({ ok: 1 }));

const router2 = Router();
router2.get("/", (req, res) => res.json({ ok: 2 }));

const router3 = Router();
router3.get("/", (req, res) => res.json({ ok: 3 }));

export const routeConfigs = [
  { prefix: "/api/test-routecfgs-1", router: router1, auth: "none" as const },
  { prefix: "/api/test-routecfgs-2", router: router2, auth: "none" as const },
  { prefix: "", router: router3, auth: "none" as const },
];
