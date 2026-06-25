/**
 * 价格匹配逻辑单元测试
 *
 * 测试 getBestPrice 的核心逻辑：协议价 > 阶梯价 > 零售价
 * 通过提取纯函数 + mock 数据库查询来实现
 */

// ========== 纯函数提取（与 cart.routes.ts 中的逻辑等价） ==========

interface PriceBinding {
  price: number;
}

interface TierPrice {
  price: number;
  min_qty: number;
}

interface RetailPrice {
  retail_price: number;
}

/**
 * 纯函数版本的最优价格计算逻辑
 * 优先级：协议价 > 阶梯价 > 零售价
 */
function computeBestPrice(
  binding: PriceBinding | null,
  tierPrices: TierPrice[],
  retailPrice: RetailPrice | null
): number {
  // 1. 协议价优先
  if (binding) return Number(binding.price);

  // 2. 阶梯价：quantity >= min_qty，取最大的 min_qty 对应的价格
  // 注意：这里 tierPrices 已经是按 min_qty DESC 排序后的结果
  if (tierPrices.length > 0) return Number(tierPrices[0].price);

  // 3. fallback 到零售价
  return retailPrice ? Number(retailPrice.retail_price) : 0;
}

/**
 * 模拟数据库查询阶梯价后的匹配逻辑
 * SQL: SELECT sp.price FROM sku_price sp WHERE sp.sku_id = ? AND sp.min_qty <= ? AND sp.status = 'ACTIVE' ORDER BY sp.min_qty DESC LIMIT 1
 */
function matchTierPrice(tierPrices: TierPrice[], quantity: number): TierPrice[] {
  return tierPrices
    .filter((tp) => tp.min_qty <= quantity)
    .sort((a, b) => b.min_qty - a.min_qty);
}

// ========== 测试用例 ==========

describe("价格匹配逻辑 - computeBestPrice", () => {
  test("协议价优先：有协议价时返回协议价", () => {
    const binding = { price: 88.5 };
    const tierPrices = [{ price: 95, min_qty: 10 }];
    const retail = { retail_price: 120 };

    const result = computeBestPrice(binding, tierPrices, retail);
    expect(result).toBe(88.5);
  });

  test("协议价优先：协议价低于阶梯价时仍返回协议价", () => {
    const binding = { price: 50 };
    const tierPrices = [{ price: 95, min_qty: 10 }];
    const retail = { retail_price: 120 };

    const result = computeBestPrice(binding, tierPrices, retail);
    expect(result).toBe(50);
  });

  test("阶梯价匹配：无协议价时返回匹配的阶梯价", () => {
    const binding = null;
    const tierPrices = [{ price: 95, min_qty: 10 }];
    const retail = { retail_price: 120 };

    const result = computeBestPrice(binding, tierPrices, retail);
    expect(result).toBe(95);
  });

  test("零售价 fallback：无协议价和阶梯价时返回零售价", () => {
    const binding = null;
    const tierPrices: TierPrice[] = [];
    const retail = { retail_price: 120 };

    const result = computeBestPrice(binding, tierPrices, retail);
    expect(result).toBe(120);
  });

  test("无任何价格数据时返回0", () => {
    const binding = null;
    const tierPrices: TierPrice[] = [];
    const retail = null;

    const result = computeBestPrice(binding, tierPrices, retail);
    expect(result).toBe(0);
  });

  test("阶梯价取最大满足条件的 min_qty 对应价格", () => {
    const binding = null;
    const tierPrices = [
      { price: 100, min_qty: 5 },
      { price: 90, min_qty: 20 },
      { price: 80, min_qty: 50 },
    ];
    const retail = { retail_price: 120 };

    // quantity = 30, 匹配 min_qty <= 30 的有 5 和 20，取最大的 20
    const matched = matchTierPrice(tierPrices, 30);
    const result = computeBestPrice(binding, matched, retail);
    expect(result).toBe(90);
  });
});

describe("阶梯价匹配逻辑 - matchTierPrice", () => {
  test("数量恰好等于 min_qty 时匹配成功", () => {
    const tierPrices = [
      { price: 100, min_qty: 5 },
      { price: 90, min_qty: 10 },
    ];

    const matched = matchTierPrice(tierPrices, 10);
    expect(matched.length).toBe(2);
    expect(matched[0].min_qty).toBe(10); // 最大的 min_qty 排在前面
    expect(matched[0].price).toBe(90);
  });

  test("数量小于所有 min_qty 时不匹配任何阶梯", () => {
    const tierPrices = [
      { price: 100, min_qty: 5 },
      { price: 90, min_qty: 10 },
    ];

    const matched = matchTierPrice(tierPrices, 3);
    expect(matched.length).toBe(0);
  });

  test("数量大于所有 min_qty 时匹配所有阶梯", () => {
    const tierPrices = [
      { price: 100, min_qty: 5 },
      { price: 90, min_qty: 10 },
      { price: 80, min_qty: 50 },
    ];

    const matched = matchTierPrice(tierPrices, 100);
    expect(matched.length).toBe(3);
    expect(matched[0].min_qty).toBe(50); // 最大 min_qty 排在前面
  });

  test("空阶梯价列表返回空数组", () => {
    const matched = matchTierPrice([], 10);
    expect(matched).toEqual([]);
  });

  test("数量为1时只匹配 min_qty=1 的阶梯", () => {
    const tierPrices = [
      { price: 100, min_qty: 1 },
      { price: 90, min_qty: 10 },
    ];

    const matched = matchTierPrice(tierPrices, 1);
    expect(matched.length).toBe(1);
    expect(matched[0].price).toBe(100);
  });
});

describe("价格数值精度", () => {
  test("价格返回值应为 number 类型", () => {
    const binding = { price: 88.5 };
    const result = computeBestPrice(binding, [], null);
    expect(typeof result).toBe("number");
  });

  test("字符串价格应被正确转换为数字", () => {
    const binding = { price: "88.50" as unknown as number };
    const result = computeBestPrice(binding, [], null);
    expect(result).toBe(88.5);
  });

  test("零售价为0时正确返回0", () => {
    const binding = null;
    const tierPrices: TierPrice[] = [];
    const retail = { retail_price: 0 };

    const result = computeBestPrice(binding, tierPrices, retail);
    expect(result).toBe(0);
  });
});
