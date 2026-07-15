import { z } from "zod";
import { ok } from "../../shared/response";
import * as announcementService from "../../services/admin/platform-announcement.service";

export async function listAnnouncements(req: any, res: any) {
  const params = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    type: z.string().optional(),
    status: z.coerce.number().optional(),
    keyword: z.string().optional(),
  }).parse(req.query);
  const result = await announcementService.listAnnouncements(params);
  res.json(ok(result));
}

export async function getAnnouncementById(req: any, res: any) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await announcementService.getAnnouncementById(id);
  res.json(ok(result));
}

export async function createAnnouncement(req: any, res: any) {
  const data = z.object({
    title: z.string().min(1),
    type: z.string().min(1),
    content: z.string().min(1),
    isTop: z.coerce.number().default(0),
    status: z.coerce.number().default(0),
  }).parse(req.body);
  const result = await announcementService.createAnnouncement(data);
  res.json(ok(result));
}

export async function updateAnnouncement(req: any, res: any) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = z.object({
    title: z.string().optional(),
    type: z.string().optional(),
    content: z.string().optional(),
    isTop: z.coerce.number().optional(),
    status: z.coerce.number().optional(),
  }).parse(req.body);
  const result = await announcementService.updateAnnouncement(id, data);
  res.json(ok(result));
}

export async function deleteAnnouncement(req: any, res: any) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await announcementService.deleteAnnouncement(id);
  res.json(ok(result));
}

export async function togglePublish(req: any, res: any) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await announcementService.togglePublish(id);
  res.json(ok(result));
}
