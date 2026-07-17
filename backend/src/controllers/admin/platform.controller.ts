import { ok } from "../../shared/response";
import * as platformService from "../../services/platform.service";

export async function getPlatformOverview(_req: any, res: any) {
  const data = await platformService.getOverview();
  res.json(ok(data));
}

export async function listPlatformTenants(_req: any, res: any) {
  const data = await platformService.getTenants();
  res.json(ok(data));
}
