import { ok } from "../shared/response";
import { selfRegisterMember, sendRegisterSmsCode } from "../services/admin/member.service";

export async function sendSmsCode(req: any, res: any) {
  const { mobile, tenantId } = req.body;
  if (!mobile || !tenantId) {
    res.status(400).json({ success: false, code: "400", message: "缺少必填字段" });
    return;
  }
  const result = await sendRegisterSmsCode(mobile, tenantId);
  res.json(ok(result));
}

export async function registerMember(req: any, res: any) {
  const { mobile, password, smsCode, name, tenantId } = req.body;
  if (!mobile || !password || !smsCode || !tenantId) {
    res.status(400).json({ success: false, code: "400", message: "缺少必填字段" });
    return;
  }
  const result = await selfRegisterMember({ mobile, password, smsCode, name, tenantId });
  res.json(ok({ ...result, message: "注册成功" }));
}
