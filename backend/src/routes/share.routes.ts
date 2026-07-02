import { Router } from "express";
import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as shareService from "../services/share.service.js";

export const shareRouter = Router();

shareRouter.get("/collections/:token", asyncHandler(async (req, res) => {
  const result = await shareService.getCollectionLink(req.params.token);
  if (!result) {
    res.status(404).json({ code: "404", message: "收款单不存在或已失效" });
    return;
  }
  res.json(ok(result));
}));

shareRouter.get("/collections/:token/page", asyncHandler(async (req, res) => {
  const result = await shareService.getCollectionLinkPage(req.params.token);
  if (!result) {
    res.status(404).json({ code: "404", message: "收款单不存在或已失效" });
    return;
  }
  if (result.status === "EXPIRED") {
    res.status(410).json({ code: "410", message: "收款链接已过期" });
    return;
  }
  if (result.status === "PAID") {
    res.status(400).json({ code: "400", message: "该收款单已支付" });
    return;
  }
  if (result.status === "REVOKED") {
    res.status(400).json({ code: "400", message: "收款链接已撤销" });
    return;
  }
  res.json(ok(result));
}));

shareRouter.post("/collections/:token/pay", asyncHandler(async (req, res) => {
  const result = await shareService.payCollectionLink(req.params.token);
  if (!result) {
    res.status(400).json({ code: "400", message: "收款单不可支付" });
    return;
  }
  res.json(ok(result));
}));

shareRouter.post("/collections/:token/wx-notify", asyncHandler(async (req, res) => {
  const headers = req.headers as Record<string, string>;
  const result = await shareService.processWxNotify(req.params.token, headers, req.body);
  if (result.verified === false) {
    res.status(401).json({ code: "401", message: "签名验证失败" });
    return;
  }
  if (result.decryptFailed) {
    res.status(400).json({ code: "400", message: "通知数据解密失败" });
    return;
  }
  if (result.notFound) {
    res.status(404).json({ code: "404", message: "收款链接不存在" });
    return;
  }
  if (result.alreadyPaid) {
    res.json(ok({ message: "已支付，无需重复处理" }));
    return;
  }
  if (result.invalid) {
    res.status(400).json({ code: "400", message: "收款链接已失效" });
    return;
  }
  res.json(ok(result));
}));