export type CustomerType = "RETAIL" | "WHOLESALE";
export type PayStatus = "UNPAID" | "PAID" | "PARTIAL";
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "WAIT_DELIVERY"
  | "DELIVERING"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type FulfillmentAction = "START_DELIVERY" | "COMPLETE" | "REJECT" | "CANCEL";

export function calcReservation(input: { orderQty: number; availableQty: number }) {
  const orderQty = Math.max(0, Math.trunc(input.orderQty));
  const availableQty = Math.max(0, Math.trunc(input.availableQty));
  const reservedQty = Math.min(orderQty, availableQty);
  return {
    reservedQty,
    unreservedQty: orderQty - reservedQty
  };
}

export function getInitialMiniappOrderState(customerType: CustomerType): {
  orderStatus: OrderStatus;
  payStatus: PayStatus;
} {
  if (customerType === "WHOLESALE") {
    return { orderStatus: "WAIT_DELIVERY", payStatus: "UNPAID" };
  }
  return { orderStatus: "PENDING_PAYMENT", payStatus: "UNPAID" };
}

export function nextFulfillmentState(current: OrderStatus, action: FulfillmentAction): OrderStatus {
  if (action === "START_DELIVERY") {
    if (current !== "WAIT_DELIVERY") throw new Error("只有待配送订单可以开始配送");
    return "DELIVERING";
  }
  if (action === "COMPLETE") {
    if (current !== "WAIT_DELIVERY" && current !== "DELIVERING") throw new Error("只有待配送或配送中订单可以完成");
    return "COMPLETED";
  }
  if (action === "REJECT") {
    if (current !== "WAIT_DELIVERY" && current !== "DELIVERING") throw new Error("只有待配送或配送中订单可以拒收");
    return "REJECTED";
  }
  if (action === "CANCEL") {
    if (current === "COMPLETED") throw new Error("已完成订单不能取消");
    return "CANCELLED";
  }
  throw new Error("未知履约动作");
}
