import { asyncHandler } from "../../shared/async-handler.js";
import * as retailAnnouncementService from "../../services/instant-retail/retail-announcement.service.js";

export const listAnnouncements = asyncHandler(async (req, res) => {
  const storeId = req.query.storeId ? Number(req.query.storeId) : undefined;
  if (!storeId) {
    res.status(400).json({ code: "400", message: "storeId is required" });
    return;
  }
  const result = await retailAnnouncementService.listAnnouncements(storeId);
  res.json({ code: "0", message: "ok", data: result });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const { store_id, title, content, is_top, start_time, end_time } = req.body;
  if (!store_id || !title || !content) {
    res.status(400).json({ code: "400", message: "store_id, title, content are required" });
    return;
  }
  const result = await retailAnnouncementService.createAnnouncement({
    store_id,
    title,
    content,
    is_top,
    start_time,
    end_time,
  });
  res.json({ code: "0", message: "ok", data: result });
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { title, content, is_top, start_time, end_time } = req.body;
  const result = await retailAnnouncementService.updateAnnouncement(id, {
    title,
    content,
    is_top,
    start_time,
    end_time,
  });
  res.json({ code: "0", message: "ok", data: result });
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await retailAnnouncementService.deleteAnnouncement(id);
  res.json({ code: "0", message: "ok", data: { deleted: true } });
});

export const getActiveAnnouncements = asyncHandler(async (req, res) => {
  const storeId = req.query.storeId ? Number(req.query.storeId) : undefined;
  if (!storeId) {
    res.status(400).json({ code: "400", message: "storeId is required" });
    return;
  }
  const result = await retailAnnouncementService.getActiveAnnouncements(storeId);
  res.json({ code: "0", message: "ok", data: result });
});