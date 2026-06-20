/**
 * 营销优惠计算单元测试
 *
 * 测试优惠券和满减活动的计算逻辑
 * 提取自 cart.routes.ts 中的 /checkout/preview 和 /checkout/create
 */

// ========== 纯函数提取 ==========

interface CouponTemplate {
  discount_value: number;
  discount_type: "FIXED" | "PERCENT";
  max_discount?: number; // PERCENT 类型时的最大折扣额
}

interface FullReductionRule {
  min_amount: number;
  discount_amount: number;
}

interface FullReduction {
  id: number;
  rules: string; // JSON 字符串
  status: string;
  start_time: string;
  end_time: string;
}

interface UserCoupon {
  id: number;
  coupon_template_id: number;
  status: string;
  expire_at: string;
}

/**
 * 计算优惠券折扣金额
 * - FIXED: 直接减固定金额
 * - PERCENT: 百分比折扣，不超过 maxDiscount
 */
function calcCouponDiscount(
  template: CouponTemplate | null,
  goodsAmount: number
): number {
  if (!template) return 0;

  if (template.discount_type === "FIXED") {
    return Math.min(Number(template.discount_value), goodsAmount);
  }

  if (template.discount_type === "PERCENT") {
    const percentDiscount = goodsAmount * (Number(template.discount_value) / 100);
    const maxDiscount = template.max_discount ?? Infinity;
    return Math.min(percentDiscount, maxDiscount, goodsAmount);
  }

  return 0;
}

/**
 * 匹配满减规则：多个规则取最大满足条件
 */
function matchFullReduction(
  fullReduction: FullReduction | null,
  goodsAmount: number
): { discount: number; desc: string } {
  if (!fullReduction) return { discount: 0, desc: "" };
  if (fullReduction.status !== "ACTIVE") return { discount: 0, desc: "" };

  try {
    const rules: FullReductionRule[] = JSON.parse(fullReduction.rules);
    const matched = rules
      .filter((r) => goodsAmount >= r.min_amount)
      .sort((a, b) => b.min_amount - a.min_amount)[0];

    if (matched) {
      return {
        discount: matched.discount_amount,
        desc: `满${matched.min_amount}减${matched.discount_amount}`,
      };
    }
  } catch {
    // rules JSON 解析失败，忽略
  }

  return { discount: 0, desc: "" };
}

/**
 * 计算总优惠（优惠券 + 满减），总优惠不超过商品总额
 */
function calcTotalDiscount(
  couponDiscount: number,
  fullReductionDiscount: number,
  goodsAmount: number
): { discountAmount: number; discountDesc: string } {
  let discountAmount = couponDiscount + fullReductionDiscount;

  // 总优惠不超过商品总额
  if (discountAmount > goodsAmount) discountAmount = goodsAmount;

  const parts: string[] = [];
  if (couponDiscount > 0) parts.push(`优惠券减${couponDiscount}`);
  if (fullReductionDiscount > 0) parts.push(`满减减${fullReductionDiscount}`);

  return {
    discountAmount,
    discountDesc: parts.join(" + "),
  };
}

/**
 * 计算运费（满99包邮）
 */
function calcShippingFee(goodsAmount: number): number {
  return goodsAmount >= 99 ? 0 : 10;
}

/**
 * 计算应付金额
 */
function calcPayableAmount(
  goodsAmount: number,
  discountAmount: number,
  shippingFee: number
): number {
  return Number((goodsAmount - discountAmount + shippingFee).toFixed(2));
}

// ========== 测试用例 ==========

describe("优惠券折扣计算 - calcCouponDiscount", () => {
  test("FIXED 类型：直接减固定金额", () => {
    const template: CouponTemplate = {
      discount_value: 20,
      discount_type: "FIXED",
    };
    expect(calcCouponDiscount(template, 100)).toBe(20);
  });

  test("FIXED 类型：折扣不超过商品总额", () => {
    const template: CouponTemplate = {
      discount_value: 200,
      discount_type: "FIXED",
    };
    expect(calcCouponDiscount(template, 100)).toBe(100);
  });

  test("PERCENT 类型：百分比折扣计算正确", () => {
    const template: CouponTemplate = {
      discount_value: 10, // 10%
      discount_type: "PERCENT",
    };
    // 100 * 10% = 10
    expect(calcCouponDiscount(template, 100)).toBe(10);
  });

  test("PERCENT 类型：折扣不超过 maxDiscount", () => {
    const template: CouponTemplate = {
      discount_value: 50, // 50%
      discount_type: "PERCENT",
      max_discount: 30,
    };
    // 100 * 50% = 50, 但 maxDiscount = 30, 所以返回 30
    expect(calcCouponDiscount(template, 100)).toBe(30);
  });

  test("无优惠券模板时折扣为0", () => {
    expect(calcCouponDiscount(null, 100)).toBe(0);
  });

  test("PERCENT 类型：折扣不超过商品总额", () => {
    const template: CouponTemplate = {
      discount_value: 100, // 100%
      discount_type: "PERCENT",
      max_discount: 999,
    };
    // 50 * 100% = 50, 不超过 goodsAmount
    expect(calcCouponDiscount(template, 50)).toBe(50);
  });
});

describe("满减规则匹配 - matchFullReduction", () => {
  const activeFullReduction: FullReduction = {
    id: 1,
    rules: JSON.stringify([
      { min_amount: 100, discount_amount: 10 },
      { min_amount: 200, discount_amount: 30 },
      { min_amount: 500, discount_amount: 80 },
    ]),
    status: "ACTIVE",
    start_time: "2024-01-01",
    end_time: "2025-12-31",
  };

  test("匹配最大的满足条件", () => {
    // goodsAmount = 300, 满足 100 和 200, 取最大的 200
    const result = matchFullReduction(activeFullReduction, 300);
    expect(result.discount).toBe(30);
    expect(result.desc).toBe("满200减30");
  });

  test("满足最高阶梯", () => {
    const result = matchFullReduction(activeFullReduction, 600);
    expect(result.discount).toBe(80);
    expect(result.desc).toBe("满500减80");
  });

  test("不满足任何条件时折扣为0", () => {
    const result = matchFullReduction(activeFullReduction, 50);
    expect(result.discount).toBe(0);
    expect(result.desc).toBe("");
  });

  test("恰好等于 min_amount 时匹配成功", () => {
    const result = matchFullReduction(activeFullReduction, 200);
    expect(result.discount).toBe(30);
  });

  test("满减活动非 ACTIVE 状态时不匹配", () => {
    const inactive: FullReduction = {
      ...activeFullReduction,
      status: "INACTIVE",
    };
    const result = matchFullReduction(inactive, 300);
    expect(result.discount).toBe(0);
  });

  test("rules JSON 解析失败时折扣为0", () => {
    const invalid: FullReduction = {
      ...activeFullReduction,
      rules: "invalid-json",
    };
    const result = matchFullReduction(invalid, 300);
    expect(result.discount).toBe(0);
  });

  test("无满减活动时折扣为0", () => {
    const result = matchFullReduction(null, 300);
    expect(result.discount).toBe(0);
    expect(result.desc).toBe("");
  });
});

describe("总优惠计算 - calcTotalDiscount", () => {
  test("优惠券 + 满减叠加", () => {
    const result = calcTotalDiscount(20, 30, 200);
    expect(result.discountAmount).toBe(50);
    expect(result.discountDesc).toBe("优惠券减20 + 满减减30");
  });

  test("总优惠不超过商品总额", () => {
    const result = calcTotalDiscount(80, 50, 100);
    expect(result.discountAmount).toBe(100);
  });

  test("无优惠券无满减时优惠为0", () => {
    const result = calcTotalDiscount(0, 0, 100);
    expect(result.discountAmount).toBe(0);
    expect(result.discountDesc).toBe("");
  });

  test("仅有优惠券", () => {
    const result = calcTotalDiscount(20, 0, 100);
    expect(result.discountAmount).toBe(20);
    expect(result.discountDesc).toBe("优惠券减20");
  });

  test("仅有满减", () => {
    const result = calcTotalDiscount(0, 30, 100);
    expect(result.discountAmount).toBe(30);
    expect(result.discountDesc).toBe("满减减30");
  });
});

describe("运费计算 - calcShippingFee", () => {
  test("满99包邮", () => {
    expect(calcShippingFee(99)).toBe(0);
    expect(calcShippingFee(100)).toBe(0);
    expect(calcShippingFee(200)).toBe(0);
  });

  test("不满99收运费10元", () => {
    expect(calcShippingFee(98)).toBe(10);
    expect(calcShippingFee(50)).toBe(10);
    expect(calcShippingFee(0)).toBe(10);
  });

  test("恰好99元包邮", () => {
    expect(calcShippingFee(99)).toBe(0);
  });
});

describe("应付金额计算 - calcPayableAmount", () => {
  test("正常计算：商品额 - 优惠 + 运费", () => {
    expect(calcPayableAmount(200, 30, 0)).toBe(170);
  });

  test("有运费时正确计算", () => {
    expect(calcPayableAmount(50, 0, 10)).toBe(60);
  });

  test("优惠 + 运费同时存在", () => {
    expect(calcPayableAmount(50, 10, 10)).toBe(50);
  });

  test("结果保留两位小数", () => {
    expect(calcPayableAmount(99.9, 10.5, 0)).toBe(89.4);
    expect(calcPayableAmount(100, 33.33, 10)).toBe(76.67);
  });

  test("优惠大于商品额时应付金额为运费", () => {
    // discountAmount 被 cap 到 goodsAmount, 所以 goodsAmount - goodsAmount + shippingFee = shippingFee
    expect(calcPayableAmount(100, 100, 10)).toBe(10);
  });
});
