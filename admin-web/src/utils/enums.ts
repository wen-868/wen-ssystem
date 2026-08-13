/**
 * 全局枚举中文映射工具
 * 用途：列表/详情页把后端返回的英文枚举值（status/customerType/levelCode 等）
 * 统一转换为中文展示，避免页面直接裸露英文。
 */

/** 通用业务状态 */
const STATUS_MAP: Record<string, string> = {
  DRAFT: "草稿",
  PENDING: "待确认",
  PENDING_PAY: "待付款",
  PENDING_SHIP: "待发货",
  PENDING_RECEIVE: "待收货",
  PENDING_REVIEW: "待审核",
  UNPAID: "未支付",
  PAID: "已支付",
  PARTIAL_PAID: "部分支付",
  SUCCESS: "成功",
  FAILED: "失败",
  ACTIVE: "启用",
  INACTIVE: "停用",
  ENABLED: "启用",
  DISABLED: "停用",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  VOIDED: "已作废",
  CLOSED: "已关闭",
  EXPIRED: "已过期",
  REFUNDED: "已退款",
  PROCESSING: "处理中",
  FINISHED: "已完成",
  REJECTED: "已驳回",
  APPROVED: "已通过",
  CONFIRMED: "已确认",
  UNCONFIRMED: "未确认",
};

/** 客户类型 */
const CUSTOMER_TYPE_MAP: Record<string, string> = {
  RETAIL: "零售",
  WHOLESALE: "批发",
  RETAIL_CUSTOMER: "零售客户",
  WHOLESALE_CUSTOMER: "批发客户",
};

/** 结算方式 */
const SETTLEMENT_TYPE_MAP: Record<string, string> = {
  CASH: "现金结算",
  ACCOUNT: "挂账",
  WECHAT: "微信",
  ALIPAY: "支付宝",
};

/** 支付方式 */
const PAY_METHOD_MAP: Record<string, string> = {
  CASH: "现金",
  WECHAT: "微信",
  WECHAT_PAY: "微信支付",
  ALIPAY: "支付宝",
  BALANCE: "余额",
  BANK: "银行卡",
  TRANSFER: "转账",
};

/** 会员等级（兜底，优先使用后端返回的 levelName） */
const LEVEL_MAP: Record<string, string> = {
  VIP: "VIP会员",
  GOLD: "金卡会员",
  SILVER: "银卡会员",
  NORMAL: "普通会员",
  BRONZE: "铜卡会员",
  DIAMOND: "钻石会员",
};

/** 门店营业状态 */
const BUSINESS_STATUS_MAP: Record<string, string> = {
  OPEN: "营业中",
  PAUSED: "暂停营业",
  CLOSED: "已关闭",
};

/** 渠道 */
const CHANNEL_MAP: Record<string, string> = {
  STORE: "门店",
  MINIAPP: "小程序",
  JD: "京东",
  MEITUAN: "美团",
  ELEME: "饿了么",
  OFFLINE: "线下",
  ONLINE: "线上",
};

/** 供应商类型 */
const SUPPLIER_CATEGORY_MAP: Record<string, string> = {
  WHOLESALER: "批发商",
  MANUFACTURER: "生产商",
  DISTRIBUTOR: "经销商",
  AGENT: "代理商",
  BRAND: "品牌",
};

/** 拜访方式 */
const VISIT_TYPE_MAP: Record<string, string> = {
  VISIT: "上门",
  PHONE: "电话",
  WECHAT: "微信",
};

/** 拜访目的 */
const PURPOSE_MAP: Record<string, string> = {
  DEVELOP: "新客开发",
  MAINTAIN: "维护关系",
  PROMOTE: "产品推介",
  FOLLOW_UP: "订单跟进",
  SERVICE: "售后服务",
  OTHER: "其他",
};

/** 泛化业务类型 */
const TYPE_MAP: Record<string, string> = {
  EARN: "获得",
  EARN_POINTS: "获得积分",
  CONSUME: "消费",
  RECHARGE: "充值",
  IN: "入库",
  RETURN_REFUND: "退货退款",
  REFUND_ONLY: "仅退款",
  EXCHANGE: "换货",
  REPAIR: "维修",
  FIXED: "固定",
  PERCENT: "比例",
  SHIPPING: "运费",
  REDUCTION: "立减",
  COUPON: "优惠券",
  FULL_REDUCTION: "满减",
  FLASH_SALE: "限时抢购",
  GROUP_BUY: "拼团",
  FULL: "全额",
  PARTIAL: "部分",
};

/** 账户类型 */
const ACCOUNT_TYPE_MAP: Record<string, string> = {
  DEBIT: "借记卡",
  CREDIT: "信用卡",
  CORPORATE: "对公账户",
};

/** 单据类型 */
const BILL_TYPE_MAP: Record<string, string> = {
  INVOICE: "发票",
  RECEIPT: "收款单",
  CHECK: "盘点单",
  SALE: "销售单",
  RETURN: "退货单",
  PURCHASE: "采购单",
  TRANSFER: "调拨单",
};

/** 配送状态 */
const DELIVERY_STATUS_MAP: Record<string, string> = {
  PENDING: "待配送",
  ASSIGNED: "已分配",
  PICKING: "拣货中",
  DELIVERING: "配送中",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

/** 库存状态 */
const INVENTORY_TYPE_MAP: Record<string, string> = {
  NORMAL: "正常",
  LOW: "低库存",
  OUT: "缺货",
};

/** 操作动作 */
const ACTION_MAP: Record<string, string> = {
  CREATE: "新增",
  UPDATE: "修改",
  DELETE: "删除",
  QUERY: "查询",
  LOGIN: "登录",
  LOGOUT: "退出",
  EXPORT: "导出",
  IMPORT: "导入",
  CANCEL: "取消",
  REMIND: "提醒",
  COMPLETE: "完成",
};

/** 订单类型 */
const ORDER_TYPE_MAP: Record<string, string> = {
  NORMAL: "普通订单",
  GROUP_BUY: "拼团订单",
  FLASH_SALE: "秒杀订单",
  RETAIL: "零售订单",
  WHOLESALE: "批发订单",
  MINIAPP: "小程序订单",
};

/** 超时类型 */
const TIMEOUT_TYPE_MAP: Record<string, string> = {
  PAYMENT: "付款超时",
  SHIPMENT: "发货超时",
  RECEIPT: "收货超时",
};

/** 合同类型 */
const CONTRACT_TYPE_MAP: Record<string, string> = {
  FRAME: "框架合同",
  SINGLE: "单次合同",
};

/** 信用等级 */
const CREDIT_LEVEL_MAP: Record<string, string> = {
  A: "A级",
  B: "B级",
  C: "C级",
};

/** 明细类型 */
const ITEM_TYPE_MAP: Record<string, string> = {
  PURCHASE: "采购",
  PAYMENT: "付款",
  RETURN: "退货",
};

/** 提成规则类型 */
const RULE_TYPE_MAP: Record<string, string> = {
  FIXED: "固定金额",
  RATIO: "比例",
  TIERED: "阶梯",
};

/** 资源类型 */
const RESOURCE_TYPE_MAP: Record<string, string> = {
  PRODUCT: "商品",
  ORDER: "订单",
  MEMBER: "客户",
  STAFF: "员工",
  STORE: "门店",
  MARKETING: "营销",
  SYSTEM: "系统",
  SALE_BILL: "销售单",
  PURCHASE_ORDER: "采购单",
};

/** 角色 */
const ROLE_MAP: Record<string, string> = {
  SUPER_ADMIN: "超级管理员",
  ADMIN: "管理员",
  MANAGER: "经理",
  STAFF: "员工",
  OPERATION_ADMIN: "运营管理员",
  STORE_MANAGER: "门店店长",
  STORE_OPERATOR: "门店操作员",
  SALES_STAFF: "销售员",
  PURCHASE_STAFF: "采购员",
  WAREHOUSE_STAFF: "仓管员",
  FINANCE_STAFF: "财务",
  CUSTOMER_SERVICE: "客服",
  READONLY: "只读观察员",
};

/** 告警级别 */
const SEVERITY_MAP: Record<string, string> = {
  FATAL: "致命",
  ERROR: "错误",
  WARN: "警告",
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  URGENT: "紧急",
  CRITICAL: "严重",
};

/** 来源 */
const SOURCE_MAP: Record<string, string> = {
  backend: "后端",
  frontend: "前端",
  STORE: "门店",
  MINIAPP: "小程序",
};

/** 职级 */
const LEVEL_MAP_EXT: Record<string, string> = {
  JUNIOR: "初级",
  MIDDLE: "中级",
  SENIOR: "高级",
  MANAGER: "管理层",
};

/** 客户生命周期 */
const LIFECYCLE_STAGE_MAP: Record<string, string> = {
  POTENTIAL: "潜客",
  NEW: "新客",
  ACTIVE: "活跃",
  DORMANT: "沉睡",
  LOST: "流失",
};

/** 通用：取映射值，未命中返回原值 */
function fmt(map: Record<string, string>, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const key = String(value);
  return map[key] ?? key;
}

export function fmtStatus(value: unknown): string {
  // 兼容数字状态：1=启用，0=停用
  if (value === 1 || value === "1") return "启用";
  if (value === 0 || value === "0") return "停用";
  return fmt(STATUS_MAP, value);
}

export function fmtCustomerType(value: unknown): string {
  return fmt(CUSTOMER_TYPE_MAP, value);
}

export function fmtSettlementType(value: unknown): string {
  return fmt(SETTLEMENT_TYPE_MAP, value);
}

export function fmtPayMethod(value: unknown): string {
  return fmt(PAY_METHOD_MAP, value);
}

export function fmtLevelCode(value: unknown): string {
  return fmt(LEVEL_MAP, value);
}

export function fmtBusinessStatus(value: unknown): string {
  return fmt(BUSINESS_STATUS_MAP, value);
}

export function fmtChannel(value: unknown): string {
  return fmt(CHANNEL_MAP, value);
}

export function fmtSupplierCategory(value: unknown): string {
  return fmt(SUPPLIER_CATEGORY_MAP, value);
}

export function fmtVisitType(value: unknown): string {
  return fmt(VISIT_TYPE_MAP, value);
}

export function fmtPurpose(value: unknown): string {
  return fmt(PURPOSE_MAP, value);
}

export function fmtType(value: unknown): string {
  return fmt(TYPE_MAP, value);
}

export function fmtAccountType(value: unknown): string {
  return fmt(ACCOUNT_TYPE_MAP, value);
}

export function fmtBillType(value: unknown): string {
  return fmt(BILL_TYPE_MAP, value);
}

export function fmtDeliveryStatus(value: unknown): string {
  return fmt(DELIVERY_STATUS_MAP, value);
}

export function fmtInventoryType(value: unknown): string {
  return fmt(INVENTORY_TYPE_MAP, value);
}

export function fmtAction(value: unknown): string {
  return fmt(ACTION_MAP, value);
}

export function fmtOrderType(value: unknown): string {
  return fmt(ORDER_TYPE_MAP, value);
}

export function fmtTimeoutType(value: unknown): string {
  return fmt(TIMEOUT_TYPE_MAP, value);
}

export function fmtContractType(value: unknown): string {
  return fmt(CONTRACT_TYPE_MAP, value);
}

export function fmtCreditLevel(value: unknown): string {
  return fmt(CREDIT_LEVEL_MAP, value);
}

export function fmtItemType(value: unknown): string {
  return fmt(ITEM_TYPE_MAP, value);
}

export function fmtRuleType(value: unknown): string {
  return fmt(RULE_TYPE_MAP, value);
}

export function fmtResourceType(value: unknown): string {
  return fmt(RESOURCE_TYPE_MAP, value);
}

export function fmtRole(value: unknown): string {
  return fmt(ROLE_MAP, value);
}

export function fmtSeverity(value: unknown): string {
  return fmt(SEVERITY_MAP, value);
}

export function fmtSource(value: unknown): string {
  return fmt(SOURCE_MAP, value);
}

export function fmtStaffLevel(value: unknown): string {
  return fmt(LEVEL_MAP_EXT, value);
}

export function fmtLifecycleStage(value: unknown): string {
  return fmt(LIFECYCLE_STAGE_MAP, value);
}
