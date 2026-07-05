import { z } from "zod";
import { Request, Response } from "express";
import { insertFeedback, listFeedbacks, updateFeedbackStatus } from "../../services/admin/feedback.service.js";
import { ok } from "../../shared/response.js";

const submitFeedbackSchema = z.object({
  type: z.enum(["BUG", "FEATURE", "IMPROVEMENT", "OTHER"]),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  contact: z.string().max(200).optional(),
  screenshot_urls: z.string().optional(),
  page_url: z.string().optional(),
  browser_info: z.string().optional(),
});

const updateFeedbackSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "RESOLVED", "REJECTED"]),
  reply: z.string().max(2000).optional(),
});

export async function submitFeedback(req: Request, res: Response) {
  const body = submitFeedbackSchema.parse(req.body);
  const { type, title, content, contact, screenshot_urls, page_url, browser_info } = body;
  const tenant_id = req.tenantId || "default";
  const user_id = (req as { user?: { id: number } }).userId;

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
  const tenant_id = req.tenantId || "default";
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
  const body = updateFeedbackSchema.parse(req.body);
  const { status, reply } = body;
  const tenant_id = req.tenantId || "default";

  await updateFeedbackStatus(parseInt(id, 10), status, reply, tenant_id);
  res.json(ok({ result: "更新成功" }));
}