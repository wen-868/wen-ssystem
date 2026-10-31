/**
 * 收银台交易链路适配（WORKBENCH-10 · D.3 收银台交易链路）
 *
 * **现状核对（2026-11-03，不是猜测）**——真实端点全部来自 `admin-web/src/api/pos.ts`：
 *   POST /store/sale-bills                              建销售单（返回 billNo / receivableAmount）
 *   POST /store/sale-bills/:billNo/offline-payment      现金 / 余额等线下收款（返回 receivedAmount / collectionStatus）
 *   POST /store/sale-bills/:billNo/pay-by-code          扫顾客付款码反扫收款（返回 channel / channelLabel / collectionStatus）
 *   GET  /store/payment/channels                        通道状态（wechat.ready / alipay.ready / box.ready）
 *
 * 三条**必须显式标 unavailable**的真实缺口（照 `agent-directory.ts` 的 no-fake 范式，
 * 返回结构化 unavailable + 原因，UI 显示「待接入」并给重试入口，绝不伪造扣款）：
 *   1. 微信 / 支付宝**没有「一键收款」端点**：`t_payment_config` 未配置（`GET /store/payment/channels`
 *      ⇒ `ready=false`）或探测本身失败时，按钮只能标 unavailable；`ready=true` 也**仍必须**有
 *      16~24 位顾客付款码才可能真扣款（`paySaleBillByCode` 的 zod 校验，
 *      `backend/src/controllers/store/sale-bill.controller.ts:152`）。
 *   2. 收款盒子（BOX）在反扫入口被后端直接抛错（`backend/src/services/payment/scan-pay.service.ts:109`
 *      「收款盒子通道未配置…」），收银台没有独立盒子收款端点 ⇒ unavailable。
 *   3. 库存：`offlinePayment` 与收款在**同一事务**内做出库扣减，库存行不足即抛
 *      409「库存不足，无法完成收款出库」（`backend/src/services/admin/sale-bill.service.ts:449`）。
 *      购物车里存在 `availableQty === null`（门店无库存行，见 `wb-pos-catalogue.ts`）时，
 *      结果只可能是真实 409 失败，UI 必须先提示「库存待接入」，不得预先宣称收款成功。
 *
 * 另外：服务端 `collectionStatus` 为 `PARTIAL` 时**只收到部分款**，本适配返回 `partial`
 * 而非 `success`，防止把未结清单据当已完成交易清车。
 *
 * 所有可注入依赖（`PosCheckoutDeps`）仅为无网络断言而设，默认实现即真实端点，视图不传即走真实链路。
 */

import {
  createStoreSaleBill,
  createStoreOfflinePayment,
  payStoreSaleBillByCode,
  fetchStorePaymentChannels,
} from "../../api/pos";
import { getErrorMessage } from "../../api/request";

/** 收银台支付方式：现金 / 微信 / 支付宝（弹层三按钮）+ 余额（收款台内）+ 反扫自动识别 */
export type PosPayMethod = "CASH" | "WECHAT" | "ALIPAY" | "BALANCE" | "SCAN";

/** 能力态：只有这两种，没有「假装可用」 */
export type PosCapabilityState = "ready" | "unavailable";

/**
 * 交易状态机（D.3 硬要求 5：成功 / 失败 / 取消 / 重试 四态可区分且由真实结果驱动）
 * - success    服务端 collectionStatus=PAID，真实到账
 * - partial    服务端只记了部分收款（collectionStatus=PARTIAL），不得清车
 * - unverified 请求 2xx 但服务端没回结清状态 ⇒ 到账未确认，按失败面处理（不清车）
 * - failure    真实请求被拒（网络 / 业务码），保留单号可重试
 * - cancelled  收银员取消收款，未发起任何扣款
 * - unavailable 能力缺失（通道未配置 / 无付款码 / 金额非法 / 空车），未发起任何请求
 */
export type PosCheckoutState =
  | "idle"
  | "submitting"
  | "success"
  | "partial"
  | "unverified"
  | "failure"
  | "cancelled"
  | "unavailable";

export interface PosChannelRow {
  ready?: boolean;
  label?: string;
  provider?: string;
  appId?: string;
}

export interface PosChannelStatus {
  wechat?: PosChannelRow;
  alipay?: PosChannelRow;
  box?: PosChannelRow;
}

/** 通道探测结果（探测失败 ⇒ state=unavailable，不给出任何 ready 猜测） */
export interface PosChannelProbe {
  state: "loading" | "ready" | "unavailable";
  channels: PosChannelStatus | null;
  message: string;
}

export const POS_PAYMENT_ENDPOINTS = {
  createBill: "POST /store/sale-bills",
  offlinePayment: "POST /store/sale-bills/:billNo/offline-payment",
  payByCode: "POST /store/sale-bills/:billNo/pay-by-code",
  channels: "GET /store/payment/channels",
} as const;

/**
 * 原型弹层三按钮（anchor L992-1004 `.pays > .pay-b[data-p]`）。
 * data-p 文案与原型逐字一致：现金支付 / 微信支付 / 支付宝。
 */
export const POS_PAY_BUTTONS: ReadonlyArray<{
  method: PosPayMethod;
  dataP: string;
  logo: string;
}> = [
  { method: "CASH", dataP: "现金支付", logo: "CASH" },
  { method: "WECHAT", dataP: "微信支付", logo: "WECHAT" },
  { method: "ALIPAY", dataP: "支付宝", logo: "ALIPAY" },
];

export const POS_PAY_METHOD_LABELS: Record<PosPayMethod, string> = {
  CASH: "现金支付",
  WECHAT: "微信支付",
  ALIPAY: "支付宝",
  BALANCE: "会员余额",
  SCAN: "扫码收款",
};

/** 只走线下记账端点的方式（后端 offlinePayment 的 paymentMethod 枚举包含 CASH / BALANCE） */
const OFFLINE_ONLY_METHODS: PosPayMethod[] = ["CASH", "BALANCE"];

/** 必须携带顾客付款码（16~24 位纯数字）才可能真扣款的方式 */
const AUTH_CODE_METHODS: PosPayMethod[] = ["WECHAT", "ALIPAY", "SCAN"];

export function requiresAuthCode(method: PosPayMethod): boolean {
  return AUTH_CODE_METHODS.includes(method);
}

export const AUTH_CODE_PATTERN = /^\d{16,24}$/;

/** 探测失败时的统一 unavailable 结构（照 agent-directory.ts：state + 原因，零伪造） */
export function unavailableChannelProbe(reason: string): PosChannelProbe {
  return { state: "unavailable", channels: null, message: `${POS_PAYMENT_ENDPOINTS.channels} ${reason}` };
}

/** 通道状态探测：真实调用 GET /store/payment/channels；失败/空返回体 ⇒ unavailable */
export async function probePosChannels(
  fetchChannels: () => Promise<PosChannelStatus | null> = fetchStorePaymentChannels,
): Promise<PosChannelProbe> {
  try {
    const channels = await fetchChannels();
    if (!channels || typeof channels !== "object") {
      return unavailableChannelProbe("返回体缺失，通道状态未知");
    }
    return { state: "ready", channels, message: "支付通道状态已接入" };
  } catch (error) {
    return unavailableChannelProbe(`请求失败（${getErrorMessage(error, "网络异常")}）`);
  }
}

export interface PosCapability {
  method: PosPayMethod;
  state: PosCapabilityState;
  /** 走哪个真实端点完成扣款；unavailable 时为缺口所在 */
  endpoint: string;
  /** unavailable 的具体缺什么（UI 直接展示，不套空话） */
  reason: string;
  /** 通道徽标签名（ready 时取服务端 label，缺省回落方式名） */
  channelLabel: string;
}

function channelName(key: keyof PosChannelStatus): string {
  return key === "wechat" ? "微信" : key === "alipay" ? "支付宝" : "收款盒子";
}

/**
 * 支付方式能力判定（弹层按钮 disabled / 待接入的唯一真源）：
 * - CASH / BALANCE ⇒ ready，走线下收款端点（真实存在）
 * - WECHAT / ALIPAY / SCAN ⇒ 只有探测成功且对应通道 `ready === true` 才 ready；
 *   否则 unavailable，原因里写清缺哪一条，绝不因「按钮点了」而伪造成功
 */
export function resolvePayCapability(probe: PosChannelProbe | null, method: PosPayMethod): PosCapability {
  const label = POS_PAY_METHOD_LABELS[method];

  if (OFFLINE_ONLY_METHODS.includes(method)) {
    return {
      method,
      state: "ready",
      endpoint: POS_PAYMENT_ENDPOINTS.offlinePayment,
      reason: "",
      channelLabel: label,
    };
  }

  if (!probe || probe.state === "loading") {
    return {
      method,
      state: "unavailable",
      endpoint: POS_PAYMENT_ENDPOINTS.channels,
      reason: `支付通道状态探测中（${POS_PAYMENT_ENDPOINTS.channels}），暂不能扣款`,
      channelLabel: label,
    };
  }

  if (probe.state === "unavailable" || !probe.channels) {
    return {
      method,
      state: "unavailable",
      endpoint: POS_PAYMENT_ENDPOINTS.channels,
      reason: `${probe.message || "通道状态未取到"} ⇒ ${label}待接入`,
      channelLabel: label,
    };
  }

  const keys: Array<keyof PosChannelStatus> = method === "SCAN" ? ["wechat", "alipay"] : [method === "WECHAT" ? "wechat" : "alipay"];
  const channels = probe.channels;
  const readyKeys = keys.filter((k) => channels[k]?.ready === true);

  if (readyKeys.length === 0) {
    const detail = keys.map((k) => `${k}.ready=${String(channels[k]?.ready ?? null)}`).join(" / ");
    return {
      method,
      state: "unavailable",
      endpoint: POS_PAYMENT_ENDPOINTS.channels,
      reason: `${keys.map(channelName).join("/")}付款码通道未配置（${detail}）⇒ ${label}待接入`,
      channelLabel: label,
    };
  }

  const firstReady = readyKeys[0];
  return {
    method,
    state: "ready",
    endpoint: POS_PAYMENT_ENDPOINTS.payByCode,
    reason: requiresAuthCode(method) ? "需扫顾客付款码（16~24 位）后扣款" : "",
    channelLabel: probe.channels[firstReady]?.label || POS_PAY_METHOD_LABELS[method],
  };
}

/** 购物车行（与 buildSaleItems 同形；仅声明收银链路用到的字段） */
export interface PosSaleItem {
  skuId: number;
  quantity: number;
  unitPrice: number;
  /** 门店可用库存：null/undefined ⇒ 无库存行（库存待接入），0 ⇒ 真实缺货 */
  availableQty?: number | null;
  [key: string]: unknown;
}

export interface PosCheckoutRequest {
  method: PosPayMethod;
  /** 本次应收金额（弹层 .pp-amt 同源） */
  amount: number;
  items: PosSaleItem[];
  /** 已有单号 ⇒ 复用（失败重试不重复建单）；空 ⇒ 先建单 */
  billNo?: string;
  /** 顾客付款码（WECHAT / ALIPAY / SCAN 必填） */
  authCode?: string;
  storeId?: number;
  customerId?: number;
  customerName?: string;
  customerMobile?: string;
  /** 弹层当前通道探测结果；unavailable ⇒ 直接返回 unavailable，零请求 */
  channelProbe?: PosChannelProbe | null;
}

export interface PosCheckoutResult {
  state: Exclude<PosCheckoutState, "idle" | "submitting">;
  method: PosPayMethod;
  message: string;
  /** 真实单号：failure / partial 时保留，供「重试」复用，避免重复建单 */
  billNo: string;
  /** 本次请求收款金额 */
  amount: number;
  /** 服务端累计实收（有则取，无则不臆造） */
  receivedAmount: number | null;
  /** 服务端结清状态（PAID / PARTIAL…），来自响应体，不由前端推断 */
  collectionStatus: string;
  channelLabel: string;
  /** 本次是否新建了销售单（重试为 false） */
  billCreated: boolean;
}

export interface PosCheckoutDeps {
  createBill?: (payload: unknown) => Promise<any>;
  payOffline?: (billNo: string, amount: number, paymentMethod: string) => Promise<any>;
  payByCode?: (billNo: string, amount: number, authCode: string) => Promise<any>;
}

function money(value: number): string {
  return `¥${Number(value || 0).toFixed(2)}`;
}

/**
 * 收银台一次收款：建单（若无单号）⇒ 扣款 ⇒ 用**服务端响应体**判定结果。
 * 任何前置缺口都在发请求之前返回 unavailable；任何请求异常都返回 failure，
 * 并在两种情况下都保留 billNo（若有）供「重试」——不产生第二次建单。
 */
export async function submitPosCheckout(
  req: PosCheckoutRequest,
  deps: PosCheckoutDeps = {},
): Promise<PosCheckoutResult> {
  const api = {
    createBill: deps.createBill ?? createStoreSaleBill,
    payOffline: deps.payOffline ?? createStoreOfflinePayment,
    payByCode: deps.payByCode ?? payStoreSaleBillByCode,
  };
  const method = req.method;
  const label = POS_PAY_METHOD_LABELS[method];
  const existedBillNo = String(req.billNo || "");
  const amount = Number(req.amount || 0);

  const base = {
    method,
    billNo: existedBillNo,
    amount,
    receivedAmount: null as number | null,
    collectionStatus: "",
    channelLabel: label,
    billCreated: false,
  };

  if (!(amount > 0)) {
    return { ...base, state: "unavailable", message: `应收金额为 ${money(amount)}，金额非法，未发起收款` };
  }
  if (!existedBillNo && (!Array.isArray(req.items) || req.items.length === 0)) {
    return { ...base, state: "unavailable", message: "购物车为空，未建单也未收款" };
  }

  const capability = resolvePayCapability(req.channelProbe ?? null, method);
  if (capability.state === "unavailable") {
    return { ...base, state: "unavailable", message: capability.reason, channelLabel: capability.channelLabel };
  }

  const authCode = String(req.authCode || "").trim();
  if (requiresAuthCode(method) && !AUTH_CODE_PATTERN.test(authCode)) {
    return {
      ...base,
      state: "unavailable",
      message: `${label}需顾客付款码（16~24 位纯数字），当前未扫入，未扣款`,
      channelLabel: capability.channelLabel,
    };
  }

  let billNo = existedBillNo;
  let payAmount = amount;

  try {
    if (!billNo) {
      const bill = await api.createBill({
        storeId: req.storeId,
        customerId: req.customerId && req.customerId > 0 ? req.customerId : undefined,
        customerName: req.customerName,
        customerMobile: req.customerMobile,
        items: req.items,
      });
      billNo = String(bill?.billNo || "");
      if (!billNo) {
        return { ...base, state: "failure", message: `${POS_PAYMENT_ENDPOINTS.createBill} 未返回单号，收款中止` };
      }
      // 服务端应收为权威值：与前端合计不一致时以服务端为准
      const receivable = Number(bill?.receivableAmount || 0);
      if (receivable > 0) payAmount = receivable;
      base.billCreated = true;
      base.amount = payAmount;
    }

    const isOffline = OFFLINE_ONLY_METHODS.includes(method);
    const paid = isOffline
      ? await api.payOffline(billNo, payAmount, method)
      : await api.payByCode(billNo, payAmount, authCode);

    const rawStatus = String(paid?.collectionStatus || "").trim().toUpperCase();
    const receivedAmount = paid?.receivedAmount === undefined || paid?.receivedAmount === null
      ? null
      : Number(paid.receivedAmount);
    const channelLabel = String(paid?.channelLabel || capability.channelLabel || label);
    const shared = { ...base, billNo, receivedAmount, collectionStatus: rawStatus, channelLabel };

    if (!rawStatus) {
      // 请求成功但没回结清状态：到账与否不知道 ⇒ 绝不写成 success，也不清车
      return {
        ...shared,
        state: "unverified",
        message: `${label}请求已完成，但服务端未回结清状态 ⇒ 到账未确认，请核对单号 ${billNo}（购物车保留）`,
      };
    }
    if (rawStatus !== "PAID") {
      return {
        ...shared,
        state: "partial",
        message: `${label} 仅部分到账：服务端实收 ${money(receivedAmount ?? 0)}，结清状态 ${rawStatus}（单据未结清，购物车保留）`,
      };
    }

    return {
      ...shared,
      state: "success",
      message: `${label} 收款成功 ${money(payAmount)} · 单号 ${billNo}`,
    };
  } catch (error) {
    return {
      ...base,
      billNo,
      state: "failure",
      message: `${label}失败：${getErrorMessage(error, "收款请求未完成")}`,
    };
  }
}

/**
 * 取消收款：只记录「未扣款」这一事实。
 * 已建单号**原样带回**，由视图保留，避免下次重试重复建单。
 */
export function cancelPosCheckout(req: {
  method: PosPayMethod;
  amount: number;
  billNo?: string;
}): PosCheckoutResult {
  return {
    state: "cancelled",
    method: req.method,
    message: `已取消收款 ${money(Number(req.amount || 0))}，未发起扣款；购物车保留`,
    billNo: String(req.billNo || ""),
    amount: Number(req.amount || 0),
    receivedAmount: null,
    collectionStatus: "",
    channelLabel: POS_PAY_METHOD_LABELS[req.method],
    billCreated: false,
  };
}

/** 结果态 → 中文徽标（弹层反馈区 / 购物车结果条共用，保证四态文案互斥可辨） */
export const POS_STATE_BADGES: Record<PosCheckoutState, string> = {
  idle: "",
  submitting: "收款中",
  success: "收款成功",
  partial: "部分到账",
  unverified: "到账待核对",
  failure: "收款失败",
  cancelled: "已取消",
  unavailable: "待接入",
};

/** 失败 / 部分到账 / 到账待核对 ⇒ 可重试（重试沿用同一单号，见 submitPosCheckout） */
export function canRetryPosCheckout(state: PosCheckoutState): boolean {
  return state === "failure" || state === "partial" || state === "unverified" || state === "unavailable";
}
