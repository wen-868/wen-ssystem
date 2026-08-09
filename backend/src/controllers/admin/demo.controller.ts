import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as demoService from "../../services/admin/demo.service";

/** 初始化演示数据（幂等，仅填充空库） */
export const seedDemo = asyncHandler(async (req, res) => {
  const result = await demoService.seedDemoData((req as any).tenantId as string);
  res.json(ok(result));
});

/** 系统初始化：清空业务数据，保留系统账号/角色/菜单/配置 */
export const resetSystem = asyncHandler(async (req, res) => {
  const body = z.object({ confirm: z.string().min(1) }).parse(req.body);
  const result = await demoService.resetSystemData(req.user!, body.confirm);
  res.json(ok(result));
});
