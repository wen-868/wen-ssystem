﻿﻿﻿import { queryWithTenant, queryOneWithTenant } from "../../shared/db";

// ===== 类型定义 =====
/** 秒杀活动查询行 */
interface FlashSaleRow {
  id: number | string;
  sku_id: number | string;
  flash_price: number | string;
  status: number | string;
  start_time: string | Date;
  end_time: string | Date;
}

/** 拼团团队查询行（含拼团活动信息） */
interface GroupBuyTeamRow {
  id: number | string;
  activity_id: number | string;
  status: string;
  target_size: number | string;
  current_size: number | string;
  group_price: number | string;
  sku_id: number | string;
  activityStatus: string;
}

/** 满减活动查询行 */
interface FullReductionRow {
  id: number | string;
  rules: string;
  applicable_scope: string;
  applicable_ids: string | null;
  stackable: number | string;
}

/** 优惠券模板查询行 */
interface CouponTemplateRow {
  id: number | string;
  type: string;
  value: number | string;
  min_amount: number | string;
  max_discount: number | string | null;
  applicable_scope: string;
  applicable_ids: string | null;
}

/** 优惠明细项 */
interface BreakdownItem {
  type: string;
  id: number | string;
  discount: number;
  description: string;
}

interface CalculateItem {
  skuId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  categoryId?: number;
  brandId?: number;
}

export async function calculatePromotion(
  body: {
    items: CalculateItem[];
    couponTemplateId?: number;
    flashSaleId?: number;
    groupBuyTeamId?: number;
    fullReductionIds?: number[];
  },
  tenantId: string
) {
  const now = new Date().toISOString();
  let originalTotal = 0;
  let discountedTotal = 0;
  const breakdown: BreakdownItem[] = [];

  for (const item of body.items) {
    originalTotal += item.unitPrice * item.quantity;
  }
  discountedTotal = originalTotal;

  if (body.flashSaleId) {
    const flashSale = await queryOneWithTenant<FlashSaleRow>(
      `SELECT id, sku_id, flash_price, status, start_time, end_time
       FROM t_flash_sale WHERE id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?`,
      [body.flashSaleId, now, now],
      tenantId
    );
    if (flashSale) {
      let flashDiscount = 0;
      for (const item of body.items) {
        if (item.skuId === Number(flashSale.sku_id)) {
          flashDiscount += (item.unitPrice - Number(flashSale.flash_price)) * item.quantity;
        }
      }
      if (flashDiscount > 0) {
        discountedTotal -= flashDiscount;
        breakdown.push({
          type: "FLASH_SALE",
          id: body.flashSaleId,
          discount: Number(flashDiscount.toFixed(2)),
          description: `秒杀优惠`
        });
      }
    }
  }

  if (body.groupBuyTeamId) {
    const team = await queryOneWithTenant<GroupBuyTeamRow>(
      `SELECT gbt.id, gbt.activity_id, gbt.status, gbt.target_size, gbt.current_size,
              gb.group_price, gb.sku_id, gb.status AS activityStatus
       FROM t_group_buy_team gbt
       JOIN t_group_buy gb ON gb.id = gbt.activity_id
       WHERE gbt.id = ? AND gbt.status = 'PENDING' AND gb.status = 'ACTIVE'`,
      [body.groupBuyTeamId],
      tenantId
    );
    if (team) {
      let groupDiscount = 0;
      for (const item of body.items) {
        if (item.skuId === Number(team.sku_id)) {
          groupDiscount += (item.unitPrice - Number(team.group_price)) * item.quantity;
        }
      }
      if (groupDiscount > 0) {
        discountedTotal -= groupDiscount;
        breakdown.push({
          type: "GROUP_BUY",
          id: body.groupBuyTeamId,
          discount: Number(groupDiscount.toFixed(2)),
          description: `拼团优惠`
        });
      }
    }
  }

  if (body.fullReductionIds && body.fullReductionIds.length > 0) {
    const placeholders = body.fullReductionIds.map(() => "?").join(", ");
    const fullReductions = await queryWithTenant<FullReductionRow>(
      `SELECT id, rules, applicable_scope, applicable_ids, stackable
       FROM t_full_reduction
       WHERE id IN (${placeholders}) AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?
       ORDER BY priority DESC`,
      [...body.fullReductionIds, now, now],
      tenantId
    );
    for (const fr of fullReductions) {
      const rules: Array<{ minAmount: number; reduceAmount: number }> = JSON.parse(fr.rules);
      const sortedRules = [...rules].sort((a, b) => b.minAmount - a.minAmount);
      for (const rule of sortedRules) {
        if (discountedTotal >= rule.minAmount) {
          discountedTotal -= rule.reduceAmount;
          breakdown.push({
            type: "FULL_REDUCTION",
            id: fr.id,
            discount: Number(rule.reduceAmount.toFixed(2)),
            description: `满${rule.minAmount}减${rule.reduceAmount}`
          });
          break;
        }
      }
    }
  }

  if (body.couponTemplateId) {
    const coupon = await queryOneWithTenant<CouponTemplateRow>(
      `SELECT id, type, value, min_amount, max_discount, applicable_scope, applicable_ids
       FROM t_coupon_template WHERE id = ? AND status = 'ACTIVE' AND start_time <= ? AND end_time >= ?`,
      [body.couponTemplateId, now, now],
      tenantId
    );
    if (coupon && discountedTotal >= Number(coupon.min_amount)) {
      let couponDiscount = 0;
      if (coupon.type === "FIXED") {
        couponDiscount = Number(coupon.value);
      } else if (coupon.type === "PERCENT") {
        const rawDiscount = discountedTotal * (1 - Number(coupon.value) / 100);
        couponDiscount = coupon.max_discount
          ? Math.min(rawDiscount, Number(coupon.max_discount))
          : rawDiscount;
      }
      if (couponDiscount > 0) {
        discountedTotal -= couponDiscount;
        breakdown.push({
          type: "COUPON",
          id: body.couponTemplateId,
          discount: Number(couponDiscount.toFixed(2)),
          description: coupon.type === "FIXED"
            ? `优惠券抵扣${coupon.value}元`
            : `优惠券${coupon.value}%折扣`
        });
      }
    }
  }

  discountedTotal = Math.max(0, discountedTotal);

  return {
    originalTotal: Number(originalTotal.toFixed(2)),
    discountedTotal: Number(discountedTotal.toFixed(2)),
    totalSaved: Number((originalTotal - discountedTotal).toFixed(2)),
    breakdown
  };
}
