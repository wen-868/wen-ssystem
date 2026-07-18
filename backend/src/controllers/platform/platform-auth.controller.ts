import { ok } from "../../shared/response";
import * as platformAuthService from "../../services/platform/platform-auth.service";

export async function platformLogin(req: any, res: any) {
  const result = await platformAuthService.login(req.body.username, req.body.password);
  res.json(ok(result));
}

export async function getPlatformMe(req: any, res: any) {
  const result = await platformAuthService.getMe(req.user.id);
  res.json(ok(result));
}

export async function createPlatformAdmin(req: any, res: any) {
  const result = await platformAuthService.createAdmin(req.body);
  res.json(ok(result));
}
