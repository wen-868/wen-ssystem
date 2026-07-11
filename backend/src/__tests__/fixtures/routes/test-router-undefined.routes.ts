import { Router } from "express";

const validRouter = Router();
validRouter.get("/", (req, res) => res.json({ ok: 1 }));

export const routeConfigs = [
  { prefix: "/api/test-router-undefined", router: undefined, auth: "none" as const },
  { prefix: "/api/test-router-valid", router: validRouter, auth: "none" as const },
];
