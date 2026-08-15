import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import { listBanners, listCategories } from "../../services/instant-retail/retail-shop.service";

/** 门店维度解析（C 端：优先 x-store-id 头，无则查默认门店） */
async function resolveStoreId(tenantId: string, headerStoreId?: string): Promise<number | undefined> {
  if (headerStoreId) {
    const n = Number(headerStoreId);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const row = await queryOneWithTenant<{ id: number }>(
    `SELECT id FROM t_store WHERE tenant_id = ? AND status = 1 ORDER BY is_default DESC, id ASC LIMIT 1`,
    [tenantId],
    tenantId
  );
  return row?.id;
}

/** 首页轮播图 */
export const getHomeBanners = asyncHandler(async (req, res) => {
  const storeId = await resolveStoreId(req.tenantId!, String(req.headers["x-store-id"] || ""));
  const rows = await listBanners(storeId, req.tenantId!);
  res.json(ok(rows.map((b: any) => ({
    id: b.id,
    title: b.banner_title,
    image: b.banner_image,
    linkType: b.link_type,
    linkValue: b.link_value,
  }))));
});

/** 首页分类 */
export const getHomeCategories = asyncHandler(async (req, res) => {
  const storeId = await resolveStoreId(req.tenantId!, String(req.headers["x-store-id"] || ""));
  const tree = await listCategories(storeId, req.tenantId!);
  res.json(ok(tree));
});

/** 首页活动（营销活动 ACTIVE 且时间有效） */
export const getHomeActivities = asyncHandler(async (req, res) => {
  const rows = await queryWithTenant<{
    id: number;
    activity_code: string;
    activity_name: string;
    activity_type: string;
    activity_desc: string | null;
    start_time: string | Date;
    end_time: string | Date;
  }>(
    `SELECT id, activity_code, activity_name, activity_type, activity_desc, start_time, end_time
     FROM t_promotion_activity
     WHERE tenant_id = ? AND status = 'ACTIVE' AND start_time <= NOW() AND end_time >= NOW()
     ORDER BY priority DESC, start_time DESC
     LIMIT 20`,
    [req.tenantId!],
    req.tenantId!
  );
  res.json(ok(rows.map((r) => ({
    id: r.id,
    code: r.activity_code,
    name: r.activity_name,
    type: r.activity_type,
    desc: r.activity_desc,
    startTime: r.start_time,
    endTime: r.end_time,
  }))));
});

/** 热搜词 */
export const getHotSearches = asyncHandler(async (req, res) => {
  const rows = await queryWithTenant<{ keyword: string }>(
    `SELECT keyword FROM t_hot_search WHERE tenant_id = ? AND status = 1 ORDER BY sort_order ASC, id ASC LIMIT 10`,
    [req.tenantId!],
    req.tenantId!
  );
  res.json(ok(rows.map((r) => r.keyword)));
});
