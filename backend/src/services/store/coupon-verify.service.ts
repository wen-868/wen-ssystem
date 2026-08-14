import { queryOneWithTenant, transaction, connExecute } from "../../shared/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

/** 用户优惠券行（核销校验用） */
interface UserCouponVerifyRow extends RowDataPacket {
  id: number;
  coupon_no: string;
  template_id: number;
  user_id: number;
  coupon_type: string;
  coupon_name: string;
  coupon_value: number | string;
  min_purchase: number | string;
  max_discount: number | string | null;
  status: string;
  valid_start: string | Date;
  valid_end: string | Date;
}

/** 会员行 */
interface MemberRow extends RowDataPacket {
  name: string | null;
  mobile: string | null;
}

/** 优惠券模板行（更新 used_quantity 用） */
interface CouponTemplateRow extends RowDataPacket {
  id: number;
}

/** 计算券实际优惠金额 */
function calcDiscount(
  couponType: string,
  couponValue: number,
  maxDiscount: number | null,
  orderAmount: number | undefined
): number {
  // 无订单金额时按券面值核销（核销场景通常伴随收款，金额由收银台另行核算）
  if (!orderAmount || orderAmount <= 0) {
    return couponType === "GIFT" ? 0 : Math.round(couponValue * 100) / 100;
  }
  if (couponType === "AMOUNT") {
    // 满减券：实际优惠不超过券面值，且不超过订单金额
    return Math.min(couponValue, orderAmount);
  }
  if (couponType === "DISCOUNT") {
    // 折扣券：coupon_value 为折扣率（如 0.9=9折），优惠 = 订单金额*(1-折扣率)，不超过最大优惠
    const rate = Math.min(Math.max(couponValue, 0), 1);
    const discount = orderAmount * (1 - rate);
    return Math.round((maxDiscount != null ? Math.min(discount, maxDiscount) : discount) * 100) / 100;
  }
  // GIFT 礼品券：无现金优惠
  return 0;
}

/**
 * 按券码核销优惠券（扫码/顾客出示券码）
 * 幂等：券已核销时返回明确业务错误，防止重复核销；事务内按状态条件更新防并发。
 */
export async function verifyCouponByCode(params: {
  tenantId: string;
  code: string;
  orderNo?: string;
  orderAmount?: number;
  operatorId?: number;
  operatorName?: string;
}) {
  const { tenantId, code, orderNo, orderAmount } = params;
  const coupon = await queryOneWithTenant<UserCouponVerifyRow>(
    `SELECT id, coupon_no, template_id, user_id, coupon_type, coupon_name,
            coupon_value, min_purchase, max_discount, status, valid_start, valid_end
     FROM t_user_coupon WHERE coupon_no = ? AND tenant_id = ?`,
    [code, tenantId],
    tenantId
  );
  if (!coupon) {
    throw Object.assign(new Error("优惠券不存在"), { statusCode: 404 });
  }

  const now = new Date();
  const validStart = new Date(coupon.valid_start);
  const validEnd = new Date(coupon.valid_end);
  if (coupon.status !== "UNUSED") {
    const statusText: Record<string, string> = {
      USED: "已核销",
      EXPIRED: "已过期",
      LOCKED: "已锁定",
    };
    throw Object.assign(new Error(`优惠券${statusText[coupon.status] || coupon.status}`), { statusCode: 400 });
  }
  if (now < validStart || now > validEnd) {
    throw Object.assign(new Error("优惠券不在有效期内"), { statusCode: 400 });
  }
  if (orderAmount != null && Number(coupon.min_purchase) > 0 && orderAmount < Number(coupon.min_purchase)) {
    throw Object.assign(new Error(`未满足最低消费¥${Number(coupon.min_purchase)}`), { statusCode: 400 });
  }

  const discountAmount = calcDiscount(
    coupon.coupon_type,
    Number(coupon.coupon_value),
    coupon.max_discount != null ? Number(coupon.max_discount) : null,
    orderAmount
  );

  const result = await transaction(async (conn) => {
    const [updateResult] = await connExecute<ResultSetHeader>(
      conn,
      `UPDATE t_user_coupon
       SET status = 'USED', used_at = NOW(),
           used_order_no = ?, used_amount = ?, discount_amount = ?
       WHERE coupon_no = ? AND tenant_id = ? AND status = 'UNUSED'`,
      [orderNo ?? null, orderAmount ?? null, discountAmount, code, tenantId]
    );
    if (updateResult.affectedRows === 0) {
      throw Object.assign(new Error("优惠券已被核销，请勿重复操作"), { statusCode: 400 });
    }
    const template = await queryOneWithTenant<CouponTemplateRow>(
      "SELECT id FROM t_coupon_template WHERE id = ? AND tenant_id = ?",
      [coupon.template_id, tenantId],
      tenantId
    );
    if (template) {
      await connExecute<ResultSetHeader>(
        conn,
        `UPDATE t_coupon_template SET used_quantity = used_quantity + 1 WHERE id = ? AND tenant_id = ?`,
        [template.id, tenantId]
      );
    }
  });

  const member = await queryOneWithTenant<MemberRow>(
    "SELECT name, mobile FROM t_member WHERE id = ? AND tenant_id = ?",
    [coupon.user_id, tenantId],
    tenantId
  );

  return {
    couponId: coupon.id,
    couponNo: coupon.coupon_no,
    couponName: coupon.coupon_name,
    couponType: coupon.coupon_type,
    couponValue: Number(coupon.coupon_value),
    discountAmount,
    orderNo: orderNo ?? null,
    userName: member?.name ?? null,
    userMobile: member?.mobile ?? null,
    status: "USED",
    usedAt: new Date().toISOString(),
  };
}

/**
 * 手动核销优惠券（顾客报手机号/券码）
 * 支持按 mobile（需与券归属用户一致）或直接 couponCode 核销。
 */
export async function manualVerifyCoupon(params: {
  tenantId: string;
  couponCode: string;
  mobile?: string;
  saleBillNo?: string;
  orderAmount?: number;
  operatorId?: number;
  operatorName?: string;
}) {
  const { tenantId, couponCode, mobile } = params;
  const coupon = await queryOneWithTenant<UserCouponVerifyRow>(
    `SELECT id, coupon_no, template_id, user_id, coupon_type, coupon_name,
            coupon_value, min_purchase, max_discount, status, valid_start, valid_end
     FROM t_user_coupon WHERE coupon_no = ? AND tenant_id = ?`,
    [couponCode, tenantId],
    tenantId
  );
  if (!coupon) {
    throw Object.assign(new Error("优惠券不存在"), { statusCode: 404 });
  }
  if (mobile) {
    const member = await queryOneWithTenant<MemberRow>(
      "SELECT id, name, mobile FROM t_member WHERE id = ? AND tenant_id = ?",
      [coupon.user_id, tenantId],
      tenantId
    );
    if (!member || member.mobile !== mobile) {
      throw Object.assign(new Error("券归属与手机号不匹配，请核对后重试"), { statusCode: 400 });
    }
  }
  return verifyCouponByCode({
    tenantId,
    code: couponCode,
    orderNo: params.saleBillNo,
    orderAmount: params.orderAmount,
    operatorId: params.operatorId,
    operatorName: params.operatorName,
  });
}
