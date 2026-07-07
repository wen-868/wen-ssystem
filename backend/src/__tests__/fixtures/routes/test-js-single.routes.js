import { Router } from "express";

export const singleRouter = Router();
singleRouter.get("/", (req, res) => res.json({ ok: "js-single" }));
