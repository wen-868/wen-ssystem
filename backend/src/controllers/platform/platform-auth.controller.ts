import { ok, fail } from "../../shared/response";
import * as platformAuthService from "../../services/platform/platform-auth.service";

export async function platformLogin(req: any, res: any) {
  try {
    const result = await platformAuthService.login(req.body.username, req.body.password);
    res.json(ok(result));
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json(fail(e.message, String(status)));
  }
}

export async function getPlatformMe(req: any, res: any) {
  try {
    const result = await platformAuthService.getMe(req.user.id);
    res.json(ok(result));
  } catch (e: any) {
    const status = e.statusCode || 404;
    res.status(status).json(fail(e.message, String(status)));
  }
}

export async function createPlatformAdmin(req: any, res: any) {
  try {
    const result = await platformAuthService.createAdmin(req.body);
    res.json(ok(result));
  } catch (e: any) {
    const status = e.statusCode || 400;
    res.status(status).json(fail(e.message, String(status)));
  }
}
