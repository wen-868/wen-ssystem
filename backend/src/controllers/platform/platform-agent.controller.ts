import { z } from "zod";
import { ok } from "../../shared/response";
import * as service from "../../services/platform/platform-agent.service";

/**
 * R101-C6-3-3：平台代理商**档案**控制器（5 条端点，路径由派单卡钉死，不得自拟）
 *
 * 依据：docs/tasks/cards/R101-派单-20260929-C6-3-3.md §四
 *   · GET  /api/platform/agents             → { items, total, page, pageSize }（分页 + 关键词）
 *   · POST /api/platform/agents             → 新建档案（重复 agentCode ⇒ 409；未知 levelId ⇒ 400）
 *   · GET  /api/platform/agents/:id         → 详情（未知 id ⇒ 404）  ← 卡 §二"详情"字面要求
 *   · PUT  /api/platform/agents/:id         → 部分更新（未知 id ⇒ 404；无变更 ⇒ 400）
 *   · POST /api/platform/agents/:id/status  → 状态流转（非法流转 ⇒ 400；未知 id ⇒ 404）
 *
 * 校验口径：zod 解析失败 ⇒ ZodError ⇒ errorHandler 统一转 400；
 *   业务错误（404 / 409 / 非法流转 400）由 service 抛 AppError。
 * 本控制器**不吞错**：不做 try/catch 包装，异常一律交给 errorHandler。
 * 零涉钱（红线①）：本控制器只透传档案字段，不认识任何金额字段。
 */

const agentIdSchema = z.coerce.number({ invalid_type_error: "代理商 ID 须为数字" }).int("代理商 ID 须为整数").positive("代理商 ID 须为正整数");

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "页码最小为 1").default(1),
  pageSize: z.coerce.number().int().min(1).max(100, "每页最多 100 条").default(10),
  keyword: z.string().trim().max(64, "关键词最长 64 字符").optional(),
});

/** 文本字段：空白串归一为 NULL（列语义 NULL=未填写，不用空串冒充），故先 trim 再判空 */
const optionalTextSchema = (max: number, label: string) =>
  z
    .string({ invalid_type_error: `${label}须为字符串或 null` })
    .trim()
    .max(max, `${label}最长 ${max} 字符`)
    .nullable()
    .optional();

/** POST body（卡 §四逐字字段集：agentCode/agentName/levelId + 4 个可选） */
const createBodySchema = z
  .object({
    agentCode: z
      .string({ required_error: "缺少代理商编码" })
      .trim()
      .min(1, "代理商编码不能为空")
      .max(32, "代理商编码最长 32 字符"),
    agentName: z
      .string({ required_error: "缺少代理商名称" })
      .trim()
      .min(1, "代理商名称不能为空")
      .max(64, "代理商名称最长 64 字符"),
    levelId: z.coerce.number({ required_error: "缺少层级 ID" }).int("层级 ID 须为整数").positive("层级 ID 须为正整数"),
    region: optionalTextSchema(128, "授权区域"),
    contactName: optionalTextSchema(32, "联系人姓名"),
    contactPhone: optionalTextSchema(20, "联系人电话"),
    remark: optionalTextSchema(255, "备注"),
  })
  .strict();

/** PUT body：全部可选，但至少要给一项（否则等价于无变更，必须 400 而不是静默成功） */
const updateBodySchema = z
  .object({
    agentName: z
      .string({ invalid_type_error: "代理商名称须为字符串" })
      .trim()
      .min(1, "代理商名称不能为空")
      .max(64, "代理商名称最长 64 字符")
      .optional(),
    levelId: z.coerce.number({ invalid_type_error: "层级 ID 须为数字" }).int("层级 ID 须为整数").positive("层级 ID 须为正整数").optional(),
    region: optionalTextSchema(128, "授权区域"),
    contactName: optionalTextSchema(32, "联系人姓名"),
    contactPhone: optionalTextSchema(20, "联系人电话"),
    remark: optionalTextSchema(255, "备注"),
  })
  .strict()
  .refine(
    (body) =>
      body.agentName !== undefined ||
      body.levelId !== undefined ||
      body.region !== undefined ||
      body.contactName !== undefined ||
      body.contactPhone !== undefined ||
      body.remark !== undefined,
    { message: "至少提供 agentName / levelId / region / contactName / contactPhone / remark 之一" }
  );

/** POST /:id/status body：只认四个状态（卡 §三① 逐字） */
const statusBodySchema = z
  .object({
    // 取值来自 service 的单一常量源（AGENT_STATUSES），展开成可写元组只为满足 zod 的入参类型
    status: z.enum([...service.AGENT_STATUSES] as [service.AgentStatus, ...service.AgentStatus[]], {
      required_error: "缺少 status",
      invalid_type_error: "status 须为 PENDING/ACTIVE/FROZEN/TERMINATED 之一",
    }),
  })
  .strict();

/** 当前平台管理员 ID（requirePlatformAuth 注入 req.user）；拿不到身份 ⇒ NULL，不编造 ID */
function currentAdminId(req: any): number | null {
  const adminId = Number(req?.user?.id ?? 0);
  return Number.isFinite(adminId) && adminId > 0 ? adminId : null;
}

/** GET /api/platform/agents —— 分页 + 关键词（空表 ⇒ items: []、total 0） */
export async function listAgents(req: any, res: any) {
  const query = listQuerySchema.parse(req.query ?? {});
  res.json(ok(await service.listAgents(query)));
}

/** GET /api/platform/agents/:id —— 详情（未知 id ⇒ 404） */
export async function getAgent(req: any, res: any) {
  const id = agentIdSchema.parse(req.params.id);
  res.json(ok(await service.getAgent(id)));
}

/** POST /api/platform/agents —— 新建档案（状态固定 PENDING，由 service 落默认值） */
export async function createAgent(req: any, res: any) {
  const body = createBodySchema.parse(req.body ?? {});
  res.json(ok(await service.createAgent(body, currentAdminId(req))));
}

/** PUT /api/platform/agents/:id —— 部分更新（未传字段不改） */
export async function updateAgent(req: any, res: any) {
  const id = agentIdSchema.parse(req.params.id);
  const body = updateBodySchema.parse(req.body ?? {});
  res.json(ok(await service.updateAgent(id, body, currentAdminId(req))));
}

/** POST /api/platform/agents/:id/status —— 状态流转（按 §三① 状态机） */
export async function changeAgentStatus(req: any, res: any) {
  const id = agentIdSchema.parse(req.params.id);
  const body = statusBodySchema.parse(req.body ?? {});
  res.json(ok(await service.changeAgentStatus(id, body.status, currentAdminId(req))));
}
