import { queryOne } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import { PLAN_STATUSES } from "../../schemas/plan.schema";
import * as subscriptionPlanService from "../admin/subscription-plan.service";
import { getPlanPolicy, updatePlanPolicy } from "./plan-policy.service";

/**
 * C1-2 B2：复制套餐（写操作）
 *
 * 复制范围（按卡）：套餐结构化字段 + features + moduleAccess + 策略包（t_platform_config
 * 的 `plan_policy:<planId>`）。策略包沿用 S2-02 组1 的既有落库约定，不新建表/列。
 *
 * 口径：
 * - 新套餐编码冲突 → **409**（资源冲突语义，二选一中取 409；自动生成编码时跳过已占用者）
 * - 副本状态默认 `INACTIVE`（停售）：复制品不得自动上架对客户可见，可显式传 status 覆盖
 * - 自证闭环：创建后立即用既有 `getPlan(newId)` 读回，读不回即判失败（500），
 *   并把读回结果放进响应 `readBack`，供验收方直接用 `GET /:planId` 复核
 * - 源套餐无策略配置时不写策略（不造默认值冒充「已复制配置」）
 */

export interface PlanCopyParams {
  planCode?: string;
  planName?: string;
  status?: string;
}

export interface PlanCopyResult {
  id: number;
  planCode: string;
  planName: string;
  status: string;
  sourcePlanId: number;
  copied: { features: boolean; moduleAccess: boolean; policy: boolean };
  warnings: string[];
  readBack: {
    id: number;
    planCode: string;
    planName: string;
    status: string;
    price: number;
    durationDays: number;
    maxUsers: number;
    maxStores: number;
    maxCustomers: number;
    maxProducts: number;
    maxStorageMb: number;
  };
}

function normalizeJson(value: unknown, fieldName: string, warnings: string[]): unknown {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      warnings.push(`${fieldName} 源值为非 JSON 字符串，已按「无数据」复制`);
      return null;
    }
  }
  return value;
}

async function buildCopyCode(sourceCode: string): Promise<string> {
  const base = `${sourceCode}-COPY`.slice(0, 32);
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base.slice(0, 28)}-${i + 1}`;
    const exists = await queryOne<{ id: number }>(
      "SELECT id FROM t_subscription_plan WHERE plan_code = ?",
      [candidate]
    );
    if (!exists) return candidate;
  }
  throw new AppError("自动生成套餐编码失败（冲突过多），请显式指定 planCode", 409);
}

function resolveStatus(input: string | undefined): string {
  const status = String(input ?? "INACTIVE").trim().toUpperCase();
  if (!(PLAN_STATUSES as readonly string[]).includes(status)) {
    throw new AppError(`套餐状态非法（可选：${PLAN_STATUSES.join(" / ")}）`, 400);
  }
  return status;
}

/** 显式编码走唯一性校验（冲突 409）；未给编码则按源编码派生并跳过已占用者 */
async function resolveCopyCode(requestedCode: string, sourceCode: string): Promise<string> {
  const requested = requestedCode.trim();
  if (!requested) return buildCopyCode(sourceCode);
  if (requested.length > 32) throw new AppError("套餐编码最长 32 字符", 400);
  const dup = await queryOne<{ id: number }>(
    "SELECT id FROM t_subscription_plan WHERE plan_code = ?",
    [requested]
  );
  if (dup) throw new AppError(`套餐编码已存在：${requested}`, 409);
  return requested;
}

/** 策略包复制：仅取真实存在的配置项（_ 前缀元字段与 null 不落库） */
async function resolvePolicyPayload(
  sourcePlanId: number
): Promise<{ payload: Record<string, unknown>; hasPolicy: boolean }> {
  const policy = await getPlanPolicy(sourcePlanId);
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(policy)) {
    if (!key.startsWith("_") && value != null) payload[key] = value;
  }
  return { payload, hasPolicy: Object.keys(payload).some((key) => key !== "version") };
}

type PlanSource = NonNullable<Awaited<ReturnType<typeof subscriptionPlanService.getPlan>>>;

/** 组装 createPlan 入参：源套餐结构化字段 + features/moduleAccess（策略包另走 t_platform_config） */
function buildCopyPayload(
  source: PlanSource,
  fields: { planCode: string; planName: string; status: string },
  features: unknown,
  moduleAccess: unknown
) {
  return {
    planCode: fields.planCode,
    planName: fields.planName,
    planType: source.planType,
    price: Number(source.price),
    originalPrice: source.originalPrice == null ? undefined : Number(source.originalPrice),
    durationDays: Number(source.durationDays),
    maxUsers: Number(source.maxUsers),
    maxStores: Number(source.maxStores),
    maxCustomers: Number(source.maxCustomers),
    maxProducts: Number(source.maxProducts),
    maxStorageMb: Number(source.maxStorageMb),
    features: features ?? undefined,
    moduleAccess: moduleAccess ?? undefined,
    description: source.description ?? undefined,
    sortOrder: Number(source.sortOrder ?? 0),
    status: fields.status,
  };
}

export async function copyPlan(
  sourcePlanId: number,
  params: PlanCopyParams,
  operator: string
): Promise<PlanCopyResult> {
  if (!Number.isInteger(sourcePlanId) || sourcePlanId <= 0) {
    throw new AppError("套餐ID非法", 400);
  }

  const source = await subscriptionPlanService.getPlan(sourcePlanId);
  if (!source) throw new AppError("源套餐不存在", 404);

  const warnings: string[] = [];
  const status = resolveStatus(params.status);
  const planCode = await resolveCopyCode(params.planCode ?? "", source.planCode);
  const planName = ((params.planName ?? "").trim() || `${source.planName}（副本）`).slice(0, 64);
  const features = normalizeJson(source.features, "features", warnings);
  const moduleAccess = normalizeJson(source.moduleAccess, "moduleAccess", warnings);

  const created = await subscriptionPlanService.createPlan(
    buildCopyPayload(source, { planCode, planName, status }, features, moduleAccess)
  );

  const newId = Number(created?.id ?? 0);
  if (!newId) throw new AppError("复制套餐失败：未取得新套餐 ID", 500);

  const { payload: policyPayload, hasPolicy } = await resolvePolicyPayload(sourcePlanId);
  if (hasPolicy) await updatePlanPolicy(newId, policyPayload, operator);

  // 自证闭环：读回
  const readBack = await subscriptionPlanService.getPlan(newId);
  if (!readBack) throw new AppError("复制套餐失败：新套餐读回为空", 500);

  return {
    id: newId,
    planCode,
    planName,
    status,
    sourcePlanId,
    copied: {
      features: features !== null,
      moduleAccess: moduleAccess !== null,
      policy: hasPolicy,
    },
    warnings,
    readBack: {
      id: Number(readBack.id),
      planCode: readBack.planCode,
      planName: readBack.planName,
      status: readBack.status,
      price: Number(readBack.price),
      durationDays: Number(readBack.durationDays),
      maxUsers: Number(readBack.maxUsers),
      maxStores: Number(readBack.maxStores),
      maxCustomers: Number(readBack.maxCustomers),
      maxProducts: Number(readBack.maxProducts),
      maxStorageMb: Number(readBack.maxStorageMb),
    },
  };
}
