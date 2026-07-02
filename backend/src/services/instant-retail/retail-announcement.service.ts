import { query, queryOne } from "../../shared/db.js";

export async function listAnnouncements(storeId: number) {
  return query<any>(
    "SELECT * FROM retail_announcement WHERE store_id = ? ORDER BY is_top DESC, created_at DESC",
    [storeId]
  );
}

export async function createAnnouncement(data: {
  store_id: number;
  title: string;
  content: string;
  is_top?: number;
  start_time?: string | null;
  end_time?: string | null;
}) {
  const result = await query<any>(
    "INSERT INTO retail_announcement (store_id, title, content, is_top, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, 1)",
    [data.store_id, data.title, data.content, data.is_top ?? 0, data.start_time ?? null, data.end_time ?? null]
  );
  return { id: (result as any).insertId };
}

export async function updateAnnouncement(
  id: number,
  data: {
    title?: string;
    content?: string;
    is_top?: number;
    start_time?: string | null;
    end_time?: string | null;
  }
) {
  await query<any>(
    "UPDATE retail_announcement SET title = ?, content = ?, is_top = ?, start_time = ?, end_time = ? WHERE id = ?",
    [data.title, data.content, data.is_top, data.start_time ?? null, data.end_time ?? null, id]
  );
  return { id };
}

export async function deleteAnnouncement(id: number) {
  await query<any>("DELETE FROM retail_announcement WHERE id = ?", [id]);
}

export async function getActiveAnnouncements(storeId: number) {
  return query<any>(
    "SELECT * FROM retail_announcement WHERE store_id = ? AND status = 1 AND (start_time IS NULL OR start_time <= NOW()) AND (end_time IS NULL OR end_time >= NOW()) ORDER BY is_top DESC, created_at DESC",
    [storeId]
  );
}