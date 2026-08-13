import { ok } from "../../shared/response";
import {
  listSmsTemplates,
  createSmsTemplate,
  updateSmsTemplate,
  deleteSmsTemplate,
} from "../../services/sms-template.service";

export async function handleListSmsTemplates(req: any, res: any) {
  const items = await listSmsTemplates(req.tenantId);
  res.json(ok(items));
}

export async function handleCreateSmsTemplate(req: any, res: any) {
  const result = await createSmsTemplate(req.body || {}, req.tenantId);
  res.json(ok(result));
}

export async function handleUpdateSmsTemplate(req: any, res: any) {
  await updateSmsTemplate(Number(req.params.id), req.body || {}, req.tenantId);
  res.json(ok({ id: Number(req.params.id) }));
}

export async function handleDeleteSmsTemplate(req: any, res: any) {
  await deleteSmsTemplate(Number(req.params.id), req.tenantId);
  res.json(ok({ id: Number(req.params.id) }));
}
