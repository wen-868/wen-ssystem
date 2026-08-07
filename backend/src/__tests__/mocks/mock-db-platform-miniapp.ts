/**
 * 平台小程序 mock handlers：t_subscription_plan（套餐）+ t_platform_subscription_apply（订阅申请）
 * 关联任务：R98-01 平台小程序 MVP
 * 仅用于本地 mock 联调（USE_MOCK_DB=true），让公开套餐/提交申请/我的申请可端到端冒烟。
 */
import type { Row } from "./mock-db-state";

// 模块级内存态（进程内有效，重启即清空，与 mock-db-state 语义一致）
const subscriptionPlans: Row[] = [
  {
    id: 1,
    planCode: "MONTHLY_BASIC",
    planName: "基础版",
    planType: "MONTHLY",
    price: 299,
    description: "适合单店起步，进销存 + 即时零售全功能",
    features: '["批零一体","即时零售","AI助手","多门店管理","数据报表"]',
    sortOrder: 1,
    status: "ACTIVE",
  },
  {
    id: 2,
    planCode: "YEARLY_PRO",
    planName: "专业版",
    planType: "YEARLY",
    price: 2999,
    description: "适合多门店连锁，含营销中心与高级报表",
    features: '["批零一体","即时零售","AI助手","营销中心","高级报表"]',
    sortOrder: 2,
    status: "ACTIVE",
  },
];

const subscriptionApplies: Row[] = [];
let applySeq = 1;

export const queryHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // t_subscription_plan 按 id 查询（套餐校验）
  (s, params) => {
    if (s.includes("from t_subscription_plan") && s.includes("where id = ?")) {
      return subscriptionPlans.filter((p) => Number(p.id) === Number(params[0]));
    }
    return null;
  },
  // t_subscription_plan 列表（公开套餐）
  (s) => {
    if (s.includes("from t_subscription_plan")) {
      return subscriptionPlans
        .filter((p) => p.status === "ACTIVE")
        .map((p) => ({
          id: p.id,
          planCode: p.planCode,
          planName: p.planName,
          planType: p.planType,
          price: p.price,
          description: p.description,
          features: p.features,
          sortOrder: p.sortOrder,
          status: p.status,
        }));
    }
    return null;
  },
  // 订阅申请 COUNT（后台列表）
  (s, params) => {
    if (s.includes("count(*) as total from t_platform_subscription_apply")) {
      const filtered = s.includes("status = ?")
        ? subscriptionApplies.filter((a) => a.status === params[0])
        : subscriptionApplies;
      return [{ total: filtered.length }];
    }
    return null;
  },
  // 订阅申请按 id / id+status 查询（详情、审核前置检查、提交后回查）
  (s, params) => {
    if (s.includes("from t_platform_subscription_apply") && s.includes("where id = ?")) {
      const byId = subscriptionApplies.filter((a) => Number(a.id) === Number(params[0]));
      if (s.includes("and status = 'PENDING'")) {
        return byId.filter((a) => a.status === "PENDING");
      }
      return byId;
    }
    return null;
  },
  // 订阅申请按 openid 查询（我的申请）
  (s, params) => {
    if (s.includes("from t_platform_subscription_apply") && s.includes("openid = ?")) {
      return subscriptionApplies.filter((a) => a.openid === params[0]);
    }
    return null;
  },
  // 订阅申请按 mobile 查询（我的申请 / 防重复）
  (s, params) => {
    if (s.includes("from t_platform_subscription_apply") && s.includes("mobile = ?")) {
      return subscriptionApplies.filter((a) => a.mobile === params[0]);
    }
    return null;
  },
  // 订阅申请列表（后台审核列表）
  (s) => {
    // 仅匹配带 ORDER BY 的列表查询，避免误吞「按 company 查重」等单条件查询
    if (s.includes("from t_platform_subscription_apply") && s.includes("order by")) {
      return [...subscriptionApplies].sort((a, b) => Number(b.id) - Number(a.id));
    }
    return null;
  },
];

export const executeHandlers: Array<(s: string, params: unknown[]) => Row[] | null> = [
  // INSERT 订阅申请
  (s, params) => {
    if (s.includes("insert into t_platform_subscription_apply")) {
      const id = applySeq++;
      const now = new Date().toISOString();
      subscriptionApplies.push({
        id,
        openid: params[0] || "",
        planId: Number(params[1]),
        planName: params[2],
        company: params[3],
        contact: params[4],
        mobile: params[5],
        remark: params[6] || "",
        status: "PENDING",
        auditRemark: "",
        auditedAt: null,
        createdAt: now,
      });
      return [{ insertId: id, affectedRows: 1 }];
    }
    return null;
  },
  // UPDATE 订阅申请（审核）
  (s, params) => {
    if (s.includes("update t_platform_subscription_apply")) {
      const target = subscriptionApplies.find((a) => Number(a.id) === Number(params[params.length - 1]));
      if (target) {
        target.status = params[0];
        target.auditRemark = params[1] || "";
        target.auditedBy = params[2] ?? null;
        target.auditedAt = new Date().toISOString();
      }
      return [{ affectedRows: target ? 1 : 0 }];
    }
    return null;
  },
];
