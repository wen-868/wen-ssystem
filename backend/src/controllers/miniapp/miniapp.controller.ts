import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok, fail } from "../../shared/response";
import { getSettlementType, type CustomerType } from "../../shared/fulfillment";
import * as miniappService from "../../services/miniapp.service";
import * as cartService from "../../services/miniapp/cart.service";
import * as addressService from "../../services/miniapp/retail-consumer-address.service";
import * as memberService from "../../services/miniapp/member.service";
import * as wholesaleService from "../../services/miniapp/wholesale.service";
import * as productService from "../../services/admin/product.service";
import * as categoryService from "../../services/admin/category.service";

// ========== 商品模块 ==========

export const getProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = String(req.query.keyword || "");
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);

  // 优先使用通用产品服务查询
  const result = await productService.listProducts(keyword, page, pageSize, tenantId);
  
  // 对结果进行小程序适配
  const data = result.records.map((row: any) => {
    const wholesaleVisible = row.wholesalePrice != null;
    const price = wholesaleVisible ? Number(row.wholesalePrice) : Number(row.miniappPrice ?? row.retailPrice);
    const item: Record<string, unknown> = {
      spuId: row.spuId,
      skuId: row.skuId,
      name: row.name,
      skuName: row.skuName,
      image: row.mainImage,
      price,
      retailPrice: Number(row.retailPrice),
      priceType: wholesaleVisible ? "WHOLESALE" : "RETAIL",
      availableQty: Number(row.availableQty),
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      isNew: row.isNew,
      isRecommend: row.isRecommend,
      specs: row.specs
    };
    if (wholesaleVisible) item.wholesalePrice = Number(row.wholesalePrice);
    return item;
  });

  res.json(ok({ total: result.total, page, pageSize, records: data }));
});

export const getProductDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const spuId = Number(req.params.id);

  const result = await productService.getProductDetail(spuId, tenantId);

  // 适配小程序格式
  const skus = result.skus.map((sku: any) => {
    const wholesaleVisible = sku.wholesalePrice != null;
    const price = wholesaleVisible ? Number(sku.wholesalePrice) : Number(sku.miniappPrice ?? sku.retailPrice);
    return {
      skuId: sku.id,
      skuCode: sku.skuCode,
      skuName: sku.skuName,
      barcode: sku.barcode,
      volume: sku.volume,
      packaging: sku.packaging,
      baseUnit: sku.baseUnit,
      boxUnit: sku.boxUnit,
      boxRatio: sku.boxRatio,
      price,
      retailPrice: Number(sku.retailPrice),
      wholesalePrice: sku.wholesalePrice ? Number(sku.wholesalePrice) : undefined,
      costPrice: Number(sku.costPrice),
      availableQty: Number(sku.availableQty),
      priceType: wholesaleVisible ? "WHOLESALE" : "RETAIL"
    };
  });

  res.json(ok({
    spuId: result.id,
    spuCode: result.spuCode,
    name: result.name,
    categoryId: result.categoryId,
    categoryName: result.categoryName,
    allowOnlineSale: result.allowOnlineSale,
    brandId: result.brandId,
    brandName: result.brandName,
    unit: result.unit,
    specs: result.specs,
    alcoholContent: result.alcoholContent,
    origin: result.origin,
    mainImage: result.mainImage,
    imageUrls: result.imageUrls,
    detail: result.detail,
    saleChannels: result.saleChannels,
    isNew: result.isNew,
    isRecommend: result.isRecommend,
    description: result.description,
    marketingTags: result.marketingTags,
    status: result.status,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    skus
  }));
});

export const getCategories = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const pid = req.query.pid !== undefined ? Number(req.query.pid) : undefined;
  
  // 小程序只需要允许线上销售的分类
  const rows = await categoryService.list({ pid, tenantId, allowOnlineSale: 1, status: 1 });
  
  res.json(ok(rows));
});

// ========== 购物车模块 ==========

function getCustomerId(req: any): number {
  return Number(req.user?.id || req.headers["x-anonymous-member-id"] || 1);
}

export const getCart = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const result = await cartService.getCartList(tenantId, customerId, customerType);
  res.json(ok(result));
});

export const addToCart = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const body = z.object({
    skuId: z.number().int().positive(),
    quantity: z.number().int().positive().default(1)
  }).parse(req.body);
  const result = await cartService.addToCart(tenantId, customerId, body.skuId, body.quantity);
  if (!result.success) {
    res.status(400).json(fail(result.message));
    return;
  }
  res.json(ok({ message: result.message }));
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const id = Number(req.params.id);
  const body = z.object({
    quantity: z.number().int().min(0)
  }).parse(req.body);
  const result = await cartService.updateCartItemQuantity(tenantId, customerId, id, body.quantity);
  if (!result.success) {
    res.status(404).json(fail(result.message));
    return;
  }
  res.json(ok({ message: result.message }));
});

export const deleteCartItem = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const id = Number(req.params.id);
  const result = await cartService.deleteCartItem(tenantId, customerId, id);
  res.json(ok(result));
});

export const clearCart = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const customerId = getCustomerId(req);
  const result = await cartService.clearCart(tenantId, customerId);
  res.json(ok(result));
});

// ========== 订单模块 ==========

export const createOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const anonymousMemberId = String(req.headers["x-anonymous-member-id"] || "");
  const body = z.object({
    storeId: z.number(),
    fulfillmentType: z.enum(["DELIVERY", "PICKUP"]),
    receiverName: z.string().optional(),
    receiverMobile: z.string().optional(),
    receiverAddress: z.string().optional(),
    remark: z.string().optional(),
    items: z.array(z.object({
      skuId: z.number(),
      qty: z.number().int().positive().optional(),
      quantity: z.number().int().positive().optional()
    }).transform((item: any) => ({
      skuId: item.skuId,
      qty: item.qty ?? item.quantity ?? 0
    })).refine((item: any) => item.qty > 0, "qty or quantity is required")).min(1)
  }).parse(req.body);

  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const settlementType = getSettlementType(customerType as CustomerType, String(req.headers["x-settlement-type"] || "ACCOUNT"));

  const result = await miniappService.createOrder(tenantId, body, customerType, anonymousMemberId, settlementType);
  res.json(ok(result));
});

export const getOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const anonymousMemberId = String(req.headers["x-anonymous-member-id"] || "");
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const result = await miniappService.getOrders(tenantId, anonymousMemberId, page, pageSize);
  res.json(ok(result));
});

export const getOrderDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const anonymousMemberId = String(req.headers["x-anonymous-member-id"] || "");
  const result = await miniappService.getOrderDetail(tenantId, req.params.id, anonymousMemberId);
  res.json(ok(result));
});

export const payOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const orderNo = req.params.id;
  const body = z.object({
    paymentMethod: z.enum(["WECHAT_PAY", "BALANCE"])
  }).parse(req.body);

  // 查询订单信息
  const order = await miniappService.getOrderDetail(tenantId, orderNo, "");
  
  if (order.payStatus === "PAID") {
    res.status(400).json(fail("订单已支付"));
    return;
  }

  // 真实微信 JSAPI 支付（API v3 下单，RSA 签名）
  const openid = await miniappService.getOrderPayerOpenid(orderNo, tenantId);
  if (!openid) {
    res.status(400).json(fail("订单用户缺少微信 openid，无法发起微信支付"));
    return;
  }
  const { createJsapiPayment } = await import("../../services/wechat-pay.service");
  const payParams = await createJsapiPayment({
    tenantId,
    openid,
    orderNo: order.orderNo,
    amountYuan: Number(order.payableAmount),
    description: `智享酒水订单${order.orderNo}`,
  });

  res.json(ok(payParams));
});

// 取消订单（释放预留库存）
export const cancelOrder = asyncHandler(async (req, res) => {
  const body = z.object({ reason: z.string().max(255).optional() }).parse(req.body ?? {});
  const result = await miniappService.cancelOrder(req.params.id, req.tenantId!, body.reason);
  res.json(ok(result));
});

// 确认收货
export const confirmReceipt = asyncHandler(async (req, res) => {
  const result = await miniappService.confirmReceipt(req.params.id, req.tenantId!);
  res.json(ok(result));
});

// 查询订单支付结果
export const queryPayResult = asyncHandler(async (req, res) => {
  const result = await miniappService.queryPayResult(req.params.id, req.tenantId!);
  res.json(ok(result));
});

// 微信支付回调（API v3 通知，微信服务器调用，无登录态）
export const payNotify = async (req: any, res: any) => {
  try {
    const { handlePayNotify } = await import("../../services/wechat-pay.service");
    const result = await handlePayNotify({ body: req.body || {} });
    res.json(result);
  } catch (e) {
    // 未受理 → 返回 500 让微信重试
    res.status(500).json({ code: "FAIL", message: e instanceof Error ? e.message : "回调处理失败" });
  }
};

// ========== 用户模块 ==========

export const getProfile = asyncHandler(async (req, res) => {
  const customerType = String(req.headers["x-customer-type"] || "RETAIL");
  const result = miniappService.getProfile(customerType);
  res.json(ok(result));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const body = z.object({
    nickname: z.string().max(64).optional(),
    mobile: z.string().optional()
  }).parse(req.body);
  
  // 模拟更新用户信息
  const result = {
    message: "更新成功",
    data: { ...body }
  };
  
  res.json(ok(result));
});

export const getAddresses = asyncHandler(async (req, res) => {
  const userId = getCustomerId(req);
  const result = await addressService.listAddresses(userId);
  res.json(ok(result));
});

export const createAddress = asyncHandler(async (req, res) => {
  const userId = getCustomerId(req);
  const body = z.object({
    name: z.string().min(1).max(32),
    mobile: z.string().min(11).max(11),
    province: z.string().min(1),
    city: z.string().min(1),
    district: z.string().min(1),
    detail: z.string().min(1),
    is_default: z.number().int().min(0).max(1).optional()
  }).parse(req.body);
  
  const result = await addressService.createAddress(userId, body);
  res.json(ok(result));
});

export const updateAddress = asyncHandler(async (req, res) => {
  const userId = getCustomerId(req);
  const id = Number(req.params.id);
  const body = z.object({
    name: z.string().min(1).max(32),
    mobile: z.string().min(11).max(11),
    province: z.string().min(1),
    city: z.string().min(1),
    district: z.string().min(1),
    detail: z.string().min(1)
  }).parse(req.body);
  
  await addressService.updateAddress(id, userId, body);
  res.json(ok({ message: "更新成功" }));
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const userId = getCustomerId(req);
  const id = Number(req.params.id);
  await addressService.deleteAddress(id, userId);
  res.json(ok({ message: "删除成功" }));
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
  const userId = getCustomerId(req);
  const id = Number(req.params.id);
  await addressService.setDefault(id, userId);
  res.json(ok({ message: "设置成功" }));
});

// ========== 营销模块 ==========

export const getPromotions = asyncHandler(async (req, res) => {
  // 模拟营销活动列表
  const result = {
    total: 5,
    records: [
      { id: 1, name: "夏日清凉季", type: "FLASH_SALE", status: "ACTIVE", startTime: "2026-07-01 00:00:00", endTime: "2026-08-31 23:59:59", description: "全场满减优惠" },
      { id: 2, name: "会员专属折扣", type: "DISCOUNT", status: "ACTIVE", startTime: "2026-07-01 00:00:00", endTime: "2026-12-31 23:59:59", description: "会员享8折优惠" },
      { id: 3, name: "新品上市", type: "NEW_PRODUCT", status: "ACTIVE", startTime: "2026-07-10 00:00:00", endTime: "2026-07-20 23:59:59", description: "新品首发优惠" },
      { id: 4, name: "周末狂欢", type: "FULL_REDUCTION", status: "UPCOMING", startTime: "2026-07-18 00:00:00", endTime: "2026-07-19 23:59:59", description: "满199减30" },
      { id: 5, name: "清仓特惠", type: "CLEARANCE", status: "ACTIVE", startTime: "2026-07-01 00:00:00", endTime: "2026-07-31 23:59:59", description: "部分商品5折起" }
    ]
  };
  
  res.json(ok(result));
});

export const getCoupons = asyncHandler(async (_req, res) => {
  // 模拟可用优惠券列表
  const result = {
    total: 3,
    records: [
      { id: 1, templateId: 1, name: "满100减10", discountValue: 10, discountType: "FIXED", minAmount: 100, status: "AVAILABLE", expireAt: "2026-08-31 23:59:59" },
      { id: 2, templateId: 2, name: "满200减30", discountValue: 30, discountType: "FIXED", minAmount: 200, status: "AVAILABLE", expireAt: "2026-09-15 23:59:59" },
      { id: 3, templateId: 3, name: "9折优惠券", discountValue: 10, discountType: "PERCENT", minAmount: 50, status: "AVAILABLE", expireAt: "2026-07-31 23:59:59" }
    ]
  };
  
  res.json(ok(result));
});

export const useCoupon = asyncHandler(async (req, res) => {
  const couponId = Number(req.params.id);
  
  // 模拟使用优惠券
  const result = {
    message: "优惠券使用成功",
    couponId,
    discountAmount: 10
  };
  
  res.json(ok(result));
});

// ========== 会员模块 ==========

export const getMemberProfile = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const result = await memberService.getMemberProfile(memberId, tenantId);
  res.json(ok(result));
});

export const getMemberLevels = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await memberService.getMemberLevels(tenantId);
  res.json(ok(result));
});

export const getMemberPoints = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const type = req.query.type ? String(req.query.type) : undefined;
  const result = await memberService.getPointsRecords(memberId, tenantId, page, pageSize, type);
  res.json(ok(result));
});

export const getMemberGrowth = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const type = req.query.type ? String(req.query.type) : undefined;
  const result = await memberService.getGrowthRecords(memberId, tenantId, page, pageSize, type);
  res.json(ok(result));
});

export const getMemberCoupons = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status ? String(req.query.status) : undefined;
  const result = await memberService.getMyCoupons(memberId, tenantId, page, pageSize, status);
  res.json(ok(result));
});

export const receiveCoupon = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const templateId = Number(req.params.id);
  const result = await memberService.receiveCoupon(memberId, templateId, tenantId);
  res.json(ok(result));
});

// ========== 用户设置模块 ==========

export const updateUserProfile = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const body = z.object({
    nickname: z.string().max(64).optional(),
    avatar: z.string().max(512).optional(),
    gender: z.number().int().min(0).max(2).optional(),
    birthday: z.string().optional()
  }).parse(req.body);
  
  const result = await memberService.updateUserProfile(memberId, tenantId, body);
  res.json(ok(result));
});

export const changePassword = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const body = z.object({
    oldPassword: z.string().min(1),
    newPassword: z.string().min(1)
  }).parse(req.body);
  
  const result = await memberService.changePassword(memberId, tenantId, body.oldPassword, body.newPassword);
  res.json(ok(result));
});

// ========== 批发模块 ==========

export const getWholesaleProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const keyword = req.query.keyword ? String(req.query.keyword) : undefined;
  const categoryId = req.query.categoryId !== undefined ? Number(req.query.categoryId) : undefined;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
  const sortOrder = req.query.sortOrder ? String(req.query.sortOrder) : undefined;
  
  const result = await wholesaleService.getWholesaleProducts(tenantId, {
    keyword,
    categoryId,
    page,
    pageSize,
    sortBy,
    sortOrder
  });
  res.json(ok(result));
});

export const getWholesaleProductDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const spuId = Number(req.params.id);
  const result = await wholesaleService.getWholesaleProductDetail(spuId, tenantId);
  res.json(ok(result));
});

export const getWholesaleCategories = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const result = await wholesaleService.getWholesaleCategories(tenantId);
  res.json(ok(result));
});

export const getWholesaleCart = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const result = await wholesaleService.getWholesaleCart(memberId, tenantId);
  res.json(ok(result));
});

export const addWholesaleCartItem = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const body = z.object({
    skuId: z.number().int().positive(),
    quantity: z.number().int().positive().default(1)
  }).parse(req.body);
  
  const result = await wholesaleService.addWholesaleCartItem(memberId, tenantId, body.skuId, body.quantity);
  res.json(ok(result));
});

export const updateWholesaleCartItem = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const id = Number(req.params.id);
  const body = z.object({
    quantity: z.number().int().min(0)
  }).parse(req.body);
  
  const result = await wholesaleService.updateWholesaleCartItem(memberId, tenantId, id, body.quantity);
  res.json(ok(result));
});

export const deleteWholesaleCartItem = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const id = Number(req.params.id);
  const result = await wholesaleService.deleteWholesaleCartItem(memberId, tenantId, id);
  res.json(ok(result));
});

export const createWholesaleOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const body = z.object({
    items: z.array(z.object({
      skuId: z.number().int().positive(),
      quantity: z.number().int().positive()
    })).min(1),
    addressId: z.number().int().positive().optional(),
    receiverName: z.string().optional(),
    receiverMobile: z.string().optional(),
    receiverProvince: z.string().optional(),
    receiverCity: z.string().optional(),
    receiverDistrict: z.string().optional(),
    receiverAddress: z.string().optional(),
    remark: z.string().max(500).optional(),
    couponId: z.number().int().positive().optional()
  }).parse(req.body);
  
  const result = await wholesaleService.createWholesaleOrder(memberId, tenantId, body);
  res.json(ok(result));
});

export const getWholesaleOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status ? String(req.query.status) : undefined;
  const result = await wholesaleService.getWholesaleOrders(memberId, tenantId, page, pageSize, status);
  res.json(ok(result));
});

export const getWholesaleOrderDetail = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const memberId = getCustomerId(req);
  const orderNo = req.params.id;
  const result = await wholesaleService.getWholesaleOrderDetail(memberId, tenantId, orderNo);
  res.json(ok(result));
});
