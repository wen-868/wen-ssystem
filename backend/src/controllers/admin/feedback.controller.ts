import { Request, Response } from "express";
import { insertFeedback, listFeedbacks, updateFeedbackStatus } from "../../services/admin/feedback.service.js";
import { ok } from "../../shared/response.js";

export async function submitFeedback(req: Request, res: Response) {
  const { type, title, content, contact, screenshot_urls, page_url, browser_info } = req.body;
  const tenant_id = (req as any).tenantId || "default";
  const user_id = (req as any).userId;

  if (!type || !title || !content) {
    return res.status(400).json({ code: "400", message: "类型、标题和内容不能为空" });
  }

  const id = await insertFeedback({
    type,
    title,
    content,
    contact,
    screenshot_urls,
    page_url,
    browser_info,
    user_id,
    tenant_id,
  });

  res.json(ok({ id }));
}

export async function getFeedbacks(req: Request, res: Response) {
  const tenant_id = (req as any).tenantId || "default";
  const { type, status, keyword, page = "1", pageSize = "20" } = req.query;

  const result = await listFeedbacks({
    type: type as string,
    status: status as string,
    keyword: keyword as string,
    page: parseInt(page as string, 10) || 1,
    pageSize: Math.min(parseInt(pageSize as string, 10) || 20, 100),
    tenant_id,
  });

  res.json(ok(result));
}

export async function updateFeedback(req: Request, res: Response) {
  const { id } = req.params;
  const { status, reply } = req.body;
  const tenant_id = (req as any).tenantId || "default";

  if (!id) {
    return res.status(400).json({ code: "400", message: "缺少反馈ID" });
  }

  await updateFeedbackStatus(parseInt(id, 10), status, reply, tenant_id);
  res.json(ok({ result: "更新成功" }));
}