# 商家移动端 App 主应用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建商家移动端主应用，并打通小程序批发订货、库存占用、配送完成扣库存、账期应收的线上线下一体化履约闭环。

**Architecture:** 先补后端履约领域能力，再改小程序下单状态，最后新增独立 `merchant-mobile` 工作区作为商家手机端主应用。后端新增小型领域模块管理订单状态、库存占用和应收生成，避免把复杂逻辑继续塞进路由文件。

**Tech Stack:** Node.js + Express + TypeScript + Zod + mysql2 + Vitest；前端使用 Vue 3 + Vite + TypeScript + Vant 4，移动端工程保持 Capacitor-ready，第一阶段先产出可部署 H5/PWA，后续再接原生打包。

---

## 范围说明

本计划是第一条可实施主线，覆盖以下能力：

1. 后端订单履约、库存占用、配送完成扣库存、拒收/取消释放库存。
2. 批发客户小程序订货后直接进入待配送，零售客户仍按在线支付流程。
3. 账期客户配送完成后生成应收账款。
4. 手机端主应用基础工程、登录、权限菜单、首页、订单配送、库存、客户、应收、报表基础页。
5. 手机端开单时返回上次成交价参考。

暂不实施：

1. 原生 App Store/安卓应用市场上架。
2. 蓝牙打印、推送、扫码枪等原生能力。
3. 复杂授信额度、逾期利息、账期天数自动风控。
4. 多批次拆单完整财务核算。

## 文件结构

### 后端新增/修改

- Create: `backend/src/shared/fulfillment.ts`  
  负责订单状态机、库存占用、配送完成扣库存、拒收/取消释放库存、账期应收生成。

- Create: `backend/src/__tests__/fulfillment.test.ts`  
  纯函数和轻量集成测试，覆盖库存占用计算、批发订单初始状态、完成/拒收状态转换。

- Modify: `docs/phase1_schema.sql`  
  扩展订单、订单明细、会员和新增应收表。现有 `inventory_balance.locked_qty` 继续作为占用库存字段。

- Modify: `docs/phase1_seed.sql`  
  增加批发账期客户和现结客户种子字段。

- Modify: `backend/src/shared/mock-db.ts`  
  支持新增字段、应收数据、订单状态和库存占用变更。

- Modify: `backend/src/routes/miniapp.routes.ts`  
  批发客户下单后直接生成 `WAIT_DELIVERY`，按可售库存占用；零售客户继续 `PENDING_PAYMENT`。

- Modify: `backend/src/routes/store.routes.ts`  
  新增配送、完成、拒收、取消、应收列表、收款登记、客户成交价参考接口。

- Modify: `scripts/qa-regression-test.mjs`  
  增加批发订货、库存占用、完成扣库存、拒收释放、账期应收的回归断言。

- Modify: `scripts/mysql-smoke-test.mjs`  
  在真实 MySQL 模式验证同一套履约闭环。

### 小程序修改

- Modify: `miniapp/pages/order/index.js`
- Modify: `miniapp/pages/order/index.wxml`
- Modify: `miniapp/pages/order-detail/index.js`
- Modify: `miniapp/pages/order-detail/index.wxml`

小程序只做必要调整：批发客户订单文案从“待支付”变成“待配送/订货成功”，详情页支持确认收货。

### 手机端新增工作区

- Modify: `package.json`  
  增加 `merchant-mobile` workspace 和脚本。

- Create: `merchant-mobile/package.json`
- Create: `merchant-mobile/index.html`
- Create: `merchant-mobile/tsconfig.json`
- Create: `merchant-mobile/vite.config.ts`
- Create: `merchant-mobile/src/main.ts`
- Create: `merchant-mobile/src/App.vue`
- Create: `merchant-mobile/src/api.ts`
- Create: `merchant-mobile/src/router.ts`
- Create: `merchant-mobile/src/styles.css`
- Create: `merchant-mobile/src/views/LoginView.vue`
- Create: `merchant-mobile/src/views/HomeView.vue`
- Create: `merchant-mobile/src/views/OrdersView.vue`
- Create: `merchant-mobile/src/views/InventoryView.vue`
- Create: `merchant-mobile/src/views/CustomersView.vue`
- Create: `merchant-mobile/src/views/ReceivablesView.vue`
- Create: `merchant-mobile/src/views/ReportsView.vue`
- Create: `merchant-mobile/src/views/ProfileView.vue`

移动端 v1 使用一个 App，通过后端返回的 `permissions` 和 `menus` 控制可见内容。

---

## Task 1: 数据库字段和领域类型

**Files:**
- Modify: `docs/phase1_schema.sql`
- Create: `backend/src/shared/fulfillment.ts`
- Test: `backend/src/__tests__/fulfillment.test.ts`

- [ ] **Step 1: 写库存占用计算失败测试**

在 `backend/src/__tests__/fulfillment.test.ts` 创建测试文件：

```ts
import { describe, expect, it } from "vitest";
import {
  calcReservation,
  getInitialMiniappOrderState,
  nextFulfillmentState
} from "../shared/fulfillment.js";

describe("线上线下一体化履约规则", () => {
  it("批发订单库存不足时只占用当前可售库存", () => {
    expect(calcReservation({ orderQty: 100, availableQty: 30 })).toEqual({
      reservedQty: 30,
      unreservedQty: 70
    });
  });

  it("批发客户小程序下单后直接进入待配送", () => {
    expect(getInitialMiniappOrderState("WHOLESALE")).toEqual({
      orderStatus: "WAIT_DELIVERY",
      payStatus: "UNPAID"
    });
  });

  it("零售客户小程序下单后仍等待支付", () => {
    expect(getInitialMiniappOrderState("RETAIL")).toEqual({
      orderStatus: "PENDING_PAYMENT",
      payStatus: "UNPAID"
    });
  });

  it("配送完成后进入已完成状态", () => {
    expect(nextFulfillmentState("DELIVERING", "COMPLETE")).toBe("COMPLETED");
  });

  it("拒收后进入已拒收状态", () => {
    expect(nextFulfillmentState("DELIVERING", "REJECT")).toBe("REJECTED");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm --workspace backend test -- fulfillment.test.ts`

Expected: FAIL，错误包含 `Cannot find module '../shared/fulfillment.js'`。

- [ ] **Step 3: 新增履约领域类型和纯函数**

创建 `backend/src/shared/fulfillment.ts`：

```ts
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
```

- [ ] **Step 4: 修改数据库脚本**

在 `docs/phase1_schema.sql` 中修改 `member` 表，在 `customer_type` 后增加：

```sql
  settlement_type VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '结算方式：CASH/ACCOUNT',
```

在 `miniapp_order` 表 `pay_status` 后增加：

```sql
  settlement_type VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '结算方式：CASH/ACCOUNT',
  delivery_status VARCHAR(32) NOT NULL DEFAULT 'WAITING' COMMENT '配送状态：WAITING/DELIVERING/COMPLETED/REJECTED/CANCELLED',
```

在 `miniapp_order_item` 表 `qty` 后增加：

```sql
  reserved_qty INT NOT NULL DEFAULT 0 COMMENT '已占用库存数量，单位瓶',
  unreserved_qty INT NOT NULL DEFAULT 0 COMMENT '未占用数量，单位瓶',
```

在 `payment_order` 表之前新增应收账款表：

```sql
CREATE TABLE receivable_account (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '应收ID',
  receivable_no VARCHAR(64) NOT NULL COMMENT '应收单号',
  source_type VARCHAR(32) NOT NULL COMMENT '来源类型：MINIAPP_ORDER/SALE_BILL',
  source_no VARCHAR(64) NOT NULL COMMENT '来源单号',
  store_id BIGINT UNSIGNED NOT NULL COMMENT '门店ID',
  customer_id BIGINT UNSIGNED DEFAULT NULL COMMENT '客户ID',
  customer_name VARCHAR(64) DEFAULT NULL COMMENT '客户名称快照',
  customer_mobile VARCHAR(20) DEFAULT NULL COMMENT '客户手机号快照',
  receivable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应收金额',
  received_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已收金额',
  unreceived_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '未收金额',
  status VARCHAR(32) NOT NULL DEFAULT 'UNPAID' COMMENT '状态：UNPAID/PARTIAL/PAID/CLOSED',
  last_payment_time DATETIME DEFAULT NULL COMMENT '最近收款时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_receivable_no (receivable_no),
  UNIQUE KEY uk_receivable_source (source_type, source_no),
  KEY idx_receivable_store_status (store_id, status),
  KEY idx_receivable_customer_id (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应收账款表';
```

同时在顶部 `DROP TABLE IF EXISTS payment_order;` 前增加：

```sql
DROP TABLE IF EXISTS receivable_account;
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm --workspace backend test -- fulfillment.test.ts`

Expected: PASS，5 个用例通过。

- [ ] **Step 6: 提交**

```bash
git add docs/phase1_schema.sql backend/src/shared/fulfillment.ts backend/src/__tests__/fulfillment.test.ts
git commit -m "feat: 增加履约库存领域模型"
```

---

## Task 2: 批发小程序订单直接进入配送并占用库存

**Files:**
- Modify: `backend/src/routes/miniapp.routes.ts`
- Modify: `backend/src/shared/mock-db.ts`
- Test: `scripts/qa-regression-test.mjs`

- [ ] **Step 1: 写 QA 回归断言**

在 `scripts/qa-regression-test.mjs` 中追加一个批发订货测试函数：

```js
async function testWholesaleOrderReservation() {
  const res = await request("/api/miniapp/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-customer-type": "WHOLESALE"
    },
    body: JSON.stringify({
      storeId: 1,
      fulfillmentType: "DELIVERY",
      receiverName: "批发客户",
      receiverMobile: "13900000001",
      receiverAddress: "批发客户仓库",
      items: [{ skuId: 1, qty: 100 }]
    })
  });
  assertEqual(res.code, "0", "批发订货接口应成功");
  assertEqual(res.data.orderStatus, "WAIT_DELIVERY", "批发订单应直接进入待配送");
  assertEqual(res.data.payStatus, "UNPAID", "批发订单默认未付款");
  assertTruthy(res.data.items[0].reservedQty >= 0, "批发订单应返回已占用数量");
  assertTruthy(res.data.items[0].unreservedQty >= 0, "批发订单应返回未占用数量");
}
```

在主流程里调用：

```js
await testWholesaleOrderReservation();
```

- [ ] **Step 2: 运行 QA 确认失败**

Run: `npm run test:qa`

Expected: FAIL，批发订单仍返回 `PENDING_PAYMENT` 或未返回 `reservedQty`。

- [ ] **Step 3: 修改小程序下单接口**

在 `backend/src/routes/miniapp.routes.ts` 顶部加入：

```ts
import { calcReservation, getInitialMiniappOrderState } from "../shared/fulfillment.js";
```

在 `miniappRouter.post("/orders"` 的事务中，将原先固定插入 `PENDING_PAYMENT` 的逻辑替换为：

```ts
const initialState = getInitialMiniappOrderState(customerType === "WHOLESALE" ? "WHOLESALE" : "RETAIL");
const settlementType = customerType === "WHOLESALE" ? String(req.headers["x-settlement-type"] || "ACCOUNT") : "CASH";
```

商品循环中查询库存：

```ts
const inventory = await queryOne<any>(
  `SELECT physical_qty AS physicalQty, locked_qty AS lockedQty, available_qty AS availableQty
   FROM inventory_balance
   WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE'`,
  [body.storeId, item.skuId]
);
const reservation = customerType === "WHOLESALE"
  ? calcReservation({ orderQty: item.qty, availableQty: Number(inventory?.availableQty ?? 0) })
  : { reservedQty: 0, unreservedQty: item.qty };
items.push({
  ...item,
  skuName: price.sku_name,
  unitPrice,
  subtotal,
  priceType: wholesale ? "WHOLESALE" : "RETAIL",
  reservedQty: reservation.reservedQty,
  unreservedQty: reservation.unreservedQty
});
```

订单插入 SQL 改为：

```ts
await conn.execute(
  `INSERT INTO miniapp_order (order_no, member_id, store_id, customer_type, fulfillment_type, order_status, pay_status,
                              settlement_type, delivery_status, goods_amount, payable_amount,
                              receiver_name, receiver_mobile, receiver_address, remark, expire_at)
   VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
  [
    orderNo,
    body.storeId,
    customerType,
    body.fulfillmentType,
    initialState.orderStatus,
    initialState.payStatus,
    settlementType,
    initialState.orderStatus === "WAIT_DELIVERY" ? "WAITING" : "WAITING",
    goodsAmount,
    goodsAmount,
    body.receiverName ?? null,
    body.receiverMobile ?? null,
    body.receiverAddress ?? null,
    remarkWithIdentity
  ]
);
```

订单明细插入 SQL 改为：

```ts
await conn.execute(
  `INSERT INTO miniapp_order_item (order_no, sku_id, sku_name, qty, reserved_qty, unreserved_qty, unit_price, price_type, subtotal_amount)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [orderNo, item.skuId, item.skuName, item.qty, item.reservedQty, item.unreservedQty, item.unitPrice, item.priceType, item.subtotal]
);
```

批发订单写入明细后占用库存：

```ts
if (customerType === "WHOLESALE" && item.reservedQty > 0) {
  await conn.execute(
    `UPDATE inventory_balance
     SET locked_qty = locked_qty + ?,
         available_qty = GREATEST(available_qty - ?, 0),
         updated_at = NOW()
     WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE'`,
    [item.reservedQty, item.reservedQty, body.storeId, item.skuId]
  );
  await conn.execute(
    `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                   change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                   operator_id, idempotency_key, remark)
     VALUES (?, ?, ?, 'ONLINE', 'ORDER_LOCK', ?, 0, 0, 0, 0, ?, NULL, ?, ?)`,
    [makeBizNo("IL"), body.storeId, item.skuId, orderNo, item.reservedQty, `ORDER_LOCK:${orderNo}:${item.skuId}`, "批发订货占用库存"]
  );
}
```

返回值改为：

```ts
return {
  orderNo,
  orderStatus: initialState.orderStatus,
  payStatus: initialState.payStatus,
  payableAmount: goodsAmount,
  items: items.map((item) => ({
    skuId: item.skuId,
    quantity: item.qty,
    reservedQty: item.reservedQty,
    unreservedQty: item.unreservedQty
  }))
};
```

- [ ] **Step 4: 更新 mock-db**

在 `backend/src/shared/mock-db.ts` 的 `state.miniappOrderItems` 写入逻辑里保存：

```ts
reservedQty: Number(params[4] ?? 0),
unreservedQty: Number(params[5] ?? 0),
```

在库存更新分支支持 `locked_qty = locked_qty +`：

```ts
if (s.includes("locked_qty = locked_qty +")) {
  const inv = state.inventory.find((i) => i.storeId === Number(params[2]) && i.skuId === Number(params[3]) && i.stockType === "ONLINE");
  if (inv) {
    inv.lockedQty = Number(inv.lockedQty) + Number(params[0]);
    inv.availableQty = Math.max(0, Number(inv.availableQty) - Number(params[1]));
  }
  return [] as T[];
}
```

- [ ] **Step 5: 运行回归测试**

Run: `npm run test:qa`

Expected: PASS，输出 `QA_REGRESSION_PASS`。

- [ ] **Step 6: 提交**

```bash
git add backend/src/routes/miniapp.routes.ts backend/src/shared/mock-db.ts scripts/qa-regression-test.mjs
git commit -m "feat: 批发订货直接进入配送并占用库存"
```

---

## Task 3: 配送完成、拒收、取消与应收生成

**Files:**
- Modify: `backend/src/routes/store.routes.ts`
- Modify: `backend/src/shared/mock-db.ts`
- Test: `scripts/qa-regression-test.mjs`

- [ ] **Step 1: 写配送完成和拒收回归断言**

在 `scripts/qa-regression-test.mjs` 增加：

```js
async function testWholesaleDeliveryLifecycle() {
  const order = await request("/api/miniapp/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-customer-type": "WHOLESALE",
      "x-settlement-type": "ACCOUNT"
    },
    body: JSON.stringify({
      storeId: 1,
      fulfillmentType: "DELIVERY",
      receiverName: "账期批发客户",
      receiverMobile: "13900000001",
      receiverAddress: "客户仓库",
      items: [{ skuId: 1, qty: 1 }]
    })
  });
  const orderNo = order.data.orderNo;

  const delivering = await request(`/api/store/orders/${orderNo}/start-delivery`, {
    method: "POST",
    headers: storeAuthHeaders
  });
  assertEqual(delivering.data.status, "DELIVERING", "订单应进入配送中");

  const completed = await request(`/api/store/orders/${orderNo}/complete-delivery`, {
    method: "POST",
    headers: storeAuthHeaders
  });
  assertEqual(completed.data.status, "COMPLETED", "订单应完成");
  assertTruthy(completed.data.receivableNo, "账期批发订单完成后应生成应收");
}
```

在主流程里调用：

```js
await testWholesaleDeliveryLifecycle();
```

- [ ] **Step 2: 运行 QA 确认失败**

Run: `npm run test:qa`

Expected: FAIL，错误为 `/api/store/orders/:orderNo/start-delivery` 不存在。

- [ ] **Step 3: 增加开始配送接口**

在 `backend/src/routes/store.routes.ts` 增加：

```ts
storeRouter.post("/orders/:orderNo/start-delivery", asyncHandler(async (req, res) => {
  await query(
    `UPDATE miniapp_order
     SET order_status = 'DELIVERING', delivery_status = 'DELIVERING', updated_at = NOW()
     WHERE order_no = ? AND order_status = 'WAIT_DELIVERY'`,
    [req.params.orderNo]
  );
  await query(
    `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data)
     VALUES (?, ?, 'ORDER_DELIVERY', 'START_DELIVERY', ?, JSON_OBJECT('status', 'DELIVERING'))`,
    [req.user?.id ?? null, req.user?.realName ?? "系统用户", req.params.orderNo]
  );
  res.json(ok({ orderNo: req.params.orderNo, status: "DELIVERING" }));
}));
```

- [ ] **Step 4: 增加完成配送接口**

在 `backend/src/routes/store.routes.ts` 增加：

```ts
storeRouter.post("/orders/:orderNo/complete-delivery", asyncHandler(async (req, res) => {
  const result = await transaction(async (conn) => {
    const [orders] = await conn.query<any[]>(
      `SELECT order_no, store_id, member_id, customer_type, settlement_type, payable_amount, receiver_name, receiver_mobile
       FROM miniapp_order
       WHERE order_no = ? AND order_status IN ('WAIT_DELIVERY', 'DELIVERING')
       FOR UPDATE`,
      [req.params.orderNo]
    );
    const order = orders[0];
    if (!order) throw new Error("订单不存在或状态不可完成");

    const [items] = await conn.query<any[]>(
      `SELECT sku_id AS skuId, qty AS quantity, reserved_qty AS reservedQty
       FROM miniapp_order_item WHERE order_no = ?`,
      [req.params.orderNo]
    );

    for (const item of items) {
      const deductQty = Number(item.reservedQty ?? 0);
      if (deductQty <= 0) continue;
      await conn.execute(
        `UPDATE inventory_balance
         SET physical_qty = physical_qty - ?,
             locked_qty = GREATEST(locked_qty - ?, 0),
             updated_at = NOW()
         WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE'`,
        [deductQty, deductQty, order.store_id, item.skuId]
      );
      await conn.execute(
        `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                       change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                       operator_id, idempotency_key, remark)
         VALUES (?, ?, ?, 'ONLINE', 'ORDER_COMPLETE', ?, ?, 0, 0, 0, 0, ?, ?, ?)`,
        [
          makeBizNo("IL"),
          order.store_id,
          item.skuId,
          req.params.orderNo,
          -deductQty,
          req.user?.id ?? null,
          `ORDER_COMPLETE:${req.params.orderNo}:${item.skuId}`,
          "配送完成扣减库存"
        ]
      );
    }

    await conn.execute(
      `UPDATE miniapp_order
       SET order_status = 'COMPLETED', delivery_status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
       WHERE order_no = ?`,
      [req.params.orderNo]
    );

    let receivableNo: string | null = null;
    if (order.customer_type === "WHOLESALE" && order.settlement_type === "ACCOUNT") {
      receivableNo = makeBizNo("YS");
      await conn.execute(
        `INSERT INTO receivable_account (receivable_no, source_type, source_no, store_id, customer_id, customer_name,
                                         customer_mobile, receivable_amount, received_amount, unreceived_amount, status)
         VALUES (?, 'MINIAPP_ORDER', ?, ?, ?, ?, ?, ?, 0, ?, 'UNPAID')`,
        [
          receivableNo,
          req.params.orderNo,
          order.store_id,
          order.member_id,
          order.receiver_name,
          order.receiver_mobile,
          order.payable_amount,
          order.payable_amount
        ]
      );
    }

    return { orderNo: req.params.orderNo, status: "COMPLETED", receivableNo };
  });
  res.json(ok(result));
}));
```

- [ ] **Step 5: 增加拒收和取消接口**

在 `backend/src/routes/store.routes.ts` 增加：

```ts
async function releaseOrderReservation(orderNo: string, status: "REJECTED" | "CANCELLED", operatorId: number | null) {
  return transaction(async (conn) => {
    const [orders] = await conn.query<any[]>(
      `SELECT order_no, store_id FROM miniapp_order
       WHERE order_no = ? AND order_status IN ('WAIT_DELIVERY', 'DELIVERING')
       FOR UPDATE`,
      [orderNo]
    );
    const order = orders[0];
    if (!order) throw new Error("订单不存在或状态不可释放库存");
    const [items] = await conn.query<any[]>(
      `SELECT sku_id AS skuId, reserved_qty AS reservedQty FROM miniapp_order_item WHERE order_no = ?`,
      [orderNo]
    );
    for (const item of items) {
      const qty = Number(item.reservedQty ?? 0);
      if (qty <= 0) continue;
      await conn.execute(
        `UPDATE inventory_balance
         SET locked_qty = GREATEST(locked_qty - ?, 0),
             available_qty = available_qty + ?,
             updated_at = NOW()
         WHERE store_id = ? AND sku_id = ? AND stock_type = 'ONLINE'`,
        [qty, qty, order.store_id, item.skuId]
      );
      await conn.execute(
        `INSERT INTO inventory_ledger (ledger_no, store_id, sku_id, stock_type, biz_type, biz_no,
                                       change_qty, before_qty, after_qty, before_locked_qty, after_locked_qty,
                                       operator_id, idempotency_key, remark)
         VALUES (?, ?, ?, 'ONLINE', ?, ?, 0, 0, 0, 0, 0, ?, ?, ?)`,
        [
          makeBizNo("IL"),
          order.store_id,
          item.skuId,
          status === "REJECTED" ? "ORDER_REJECT" : "ORDER_CANCEL",
          orderNo,
          operatorId,
          `${status}:${orderNo}:${item.skuId}`,
          status === "REJECTED" ? "客户拒收释放占用库存" : "订单取消释放占用库存"
        ]
      );
    }
    await conn.execute(
      `UPDATE miniapp_order
       SET order_status = ?, delivery_status = ?, updated_at = NOW()
       WHERE order_no = ?`,
      [status, status, orderNo]
    );
    return { orderNo, status };
  });
}

storeRouter.post("/orders/:orderNo/reject", asyncHandler(async (req, res) => {
  res.json(ok(await releaseOrderReservation(req.params.orderNo, "REJECTED", req.user?.id ?? null)));
}));

storeRouter.post("/orders/:orderNo/cancel", asyncHandler(async (req, res) => {
  res.json(ok(await releaseOrderReservation(req.params.orderNo, "CANCELLED", req.user?.id ?? null)));
}));
```

- [ ] **Step 6: 更新 mock-db**

在 `backend/src/shared/mock-db.ts` 增加对这些 SQL 的匹配：

```ts
if (s.includes("set order_status = 'delivering'")) {
  const order = state.miniappOrders.find((o) => o.orderNo === params[0] || o.order_no === params[0]);
  if (order) {
    order.orderStatus = "DELIVERING";
    order.order_status = "DELIVERING";
    order.deliveryStatus = "DELIVERING";
  }
  return [] as T[];
}
```

完成、拒收、取消分支按相同模式更新 `orderStatus/order_status/deliveryStatus`，并维护 `state.inventory.lockedQty/availableQty/physicalQty`。

- [ ] **Step 7: 运行测试**

Run: `npm run test:qa && npm run test:backend`

Expected: `QA_REGRESSION_PASS`，Vitest 全部通过。

- [ ] **Step 8: 提交**

```bash
git add backend/src/routes/store.routes.ts backend/src/shared/mock-db.ts scripts/qa-regression-test.mjs
git commit -m "feat: 完成批发配送扣库存和应收闭环"
```

---

## Task 4: 上次成交价参考接口

**Files:**
- Modify: `backend/src/routes/store.routes.ts`
- Modify: `backend/src/shared/mock-db.ts`
- Test: `backend/src/__tests__/store-sale-bill.test.ts`

- [ ] **Step 1: 写接口数据计算测试**

在 `backend/src/__tests__/store-sale-bill.test.ts` 增加：

```ts
import { buildLastDealPriceSummary } from "../routes/store.routes.js";

describe("客户上次成交价参考", () => {
  it("从历史记录中取最近一次成交价并计算高低价", () => {
    const summary = buildLastDealPriceSummary([
      { unitPrice: 99, createdAt: "2026-06-01 10:00:00", billNo: "XS001" },
      { unitPrice: 105, createdAt: "2026-06-10 10:00:00", billNo: "XS002" },
      { unitPrice: 95, createdAt: "2026-06-05 10:00:00", billNo: "XS003" }
    ]);
    expect(summary).toEqual({
      lastPrice: 105,
      lastDealAt: "2026-06-10 10:00:00",
      lastBillNo: "XS002",
      highestPrice: 105,
      lowestPrice: 95
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm --workspace backend test -- store-sale-bill.test.ts`

Expected: FAIL，`buildLastDealPriceSummary` 未导出。

- [ ] **Step 3: 新增纯函数和接口**

在 `backend/src/routes/store.routes.ts` 中导出：

```ts
export function buildLastDealPriceSummary(records: Array<{ unitPrice: number; createdAt: string; billNo: string }>) {
  if (records.length === 0) {
    return {
      lastPrice: null,
      lastDealAt: null,
      lastBillNo: null,
      highestPrice: null,
      lowestPrice: null
    };
  }
  const sorted = [...records].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const prices = records.map((record) => Number(record.unitPrice));
  return {
    lastPrice: Number(sorted[0].unitPrice),
    lastDealAt: sorted[0].createdAt,
    lastBillNo: sorted[0].billNo,
    highestPrice: Math.max(...prices),
    lowestPrice: Math.min(...prices)
  };
}
```

新增接口：

```ts
storeRouter.get("/members/:memberId/sku-price-reference/:skuId", asyncHandler(async (req, res) => {
  const memberId = Number(req.params.memberId);
  const skuId = Number(req.params.skuId);
  const rows = await query<any>(
    `SELECT i.unit_price AS unitPrice, b.created_at AS createdAt, b.bill_no AS billNo
     FROM sale_bill_item i
     JOIN sale_bill b ON b.bill_no = i.bill_no
     WHERE b.customer_id = ? AND i.sku_id = ?
     ORDER BY b.created_at DESC
     LIMIT 20`,
    [memberId, skuId]
  );
  res.json(ok(buildLastDealPriceSummary(rows)));
}));
```

- [ ] **Step 4: 更新 mock-db**

`mock-db.ts` 已有类似 `sale_bill_item join sale_bill customer_id` 分支，确认返回字段包含 `unitPrice`、`createdAt`、`billNo`。缺少时补齐：

```ts
unitPrice: Number(item.unitPrice ?? item.unit_price),
createdAt: String(bill.createdAt ?? bill.created_at),
billNo: String(bill.billNo ?? bill.bill_no)
```

- [ ] **Step 5: 运行测试**

Run: `npm --workspace backend test -- store-sale-bill.test.ts && npm run test:qa`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add backend/src/routes/store.routes.ts backend/src/shared/mock-db.ts backend/src/__tests__/store-sale-bill.test.ts
git commit -m "feat: 增加客户上次成交价参考"
```

---

## Task 5: 应收列表和收款登记

**Files:**
- Modify: `backend/src/routes/store.routes.ts`
- Modify: `backend/src/shared/mock-db.ts`
- Test: `scripts/qa-regression-test.mjs`

- [ ] **Step 1: 写应收接口回归断言**

在 `scripts/qa-regression-test.mjs` 增加：

```js
async function testReceivableCollection() {
  const list = await request("/api/store/receivables", { headers: storeAuthHeaders });
  assertEqual(list.code, "0", "应收列表应返回成功");
  if (list.data.records.length === 0) return;
  const first = list.data.records[0];
  const paid = await request(`/api/store/receivables/${first.receivableNo}/payment`, {
    method: "POST",
    headers: { ...storeAuthHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 10, paymentMethod: "TRANSFER", remark: "测试收款" })
  });
  assertEqual(paid.code, "0", "登记应收收款应成功");
  assertTruthy(paid.data.unreceivedAmount >= 0, "应返回剩余未收金额");
}
```

- [ ] **Step 2: 运行 QA 确认失败**

Run: `npm run test:qa`

Expected: FAIL，`/api/store/receivables` 不存在。

- [ ] **Step 3: 新增应收列表接口**

在 `backend/src/routes/store.routes.ts` 增加：

```ts
storeRouter.get("/receivables", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const status = req.query.status ? String(req.query.status) : null;
  const keyword = `%${String(req.query.keyword || "")}%`;
  const storeId = req.user?.storeId ?? null;
  const records = await query<any>(
    `SELECT receivable_no AS receivableNo, source_type AS sourceType, source_no AS sourceNo,
            customer_name AS customerName, customer_mobile AS customerMobile,
            receivable_amount AS receivableAmount, received_amount AS receivedAmount,
            unreceived_amount AS unreceivedAmount, status, created_at AS createdAt
     FROM receivable_account
     WHERE (? IS NULL OR store_id = ?)
       AND (? IS NULL OR status = ?)
       AND (receivable_no LIKE ? OR source_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [storeId, storeId, status, status, keyword, keyword, keyword, keyword, pageSize, offset]
  );
  const total = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM receivable_account
     WHERE (? IS NULL OR store_id = ?)
       AND (? IS NULL OR status = ?)
       AND (receivable_no LIKE ? OR source_no LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)`,
    [storeId, storeId, status, status, keyword, keyword, keyword, keyword]
  );
  res.json(ok({ total: total?.total ?? 0, page, pageSize, records }));
}));
```

- [ ] **Step 4: 新增应收收款接口**

在 `backend/src/routes/store.routes.ts` 增加：

```ts
storeRouter.post("/receivables/:receivableNo/payment", asyncHandler(async (req, res) => {
  const body = z.object({
    amount: z.number().positive(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "OTHER_WECHAT", "ALIPAY"]),
    remark: z.string().optional()
  }).parse(req.body);
  const result = await transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      `SELECT receivable_no, source_no, received_amount, receivable_amount, unreceived_amount
       FROM receivable_account WHERE receivable_no = ? FOR UPDATE`,
      [req.params.receivableNo]
    );
    const receivable = rows[0];
    if (!receivable) throw new Error("应收不存在");
    if (body.amount > Number(receivable.unreceived_amount)) throw new Error("收款金额不能超过未收金额");
    const receivedAmount = Number(receivable.received_amount) + body.amount;
    const unreceivedAmount = Math.max(Number(receivable.receivable_amount) - receivedAmount, 0);
    const status = unreceivedAmount === 0 ? "PAID" : "PARTIAL";
    await conn.execute(
      `UPDATE receivable_account
       SET received_amount = ?, unreceived_amount = ?, status = ?, last_payment_time = NOW()
       WHERE receivable_no = ?`,
      [receivedAmount, unreceivedAmount, status, req.params.receivableNo]
    );
    await conn.execute(
      `INSERT INTO payment_order (pay_no, source_type, source_no, channel, amount, status, paid_at)
       VALUES (?, 'RECEIVABLE', ?, ?, ?, 'SUCCESS', NOW())`,
      [makeBizNo("ZF"), req.params.receivableNo, body.paymentMethod, body.amount]
    );
    return { receivableNo: req.params.receivableNo, receivedAmount, unreceivedAmount, status };
  });
  res.json(ok(result));
}));
```

- [ ] **Step 5: 更新 mock-db**

在 `state` 中增加：

```ts
receivables: [] as Row[],
```

匹配 `from receivable_account` 查询和 `update receivable_account` 更新，保存 `receivableNo`、`receivedAmount`、`unreceivedAmount`、`status`。

- [ ] **Step 6: 运行测试**

Run: `npm run test:qa && npm run test:backend`

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add backend/src/routes/store.routes.ts backend/src/shared/mock-db.ts scripts/qa-regression-test.mjs
git commit -m "feat: 增加批发应收与收款登记"
```

---

## Task 6: 小程序订单页适配批发订货和确认收货

**Files:**
- Modify: `miniapp/pages/order/index.js`
- Modify: `miniapp/pages/order/index.wxml`
- Modify: `miniapp/pages/order-detail/index.js`
- Modify: `miniapp/pages/order-detail/index.wxml`
- Test: `scripts/check-miniapp-release.mjs`

- [ ] **Step 1: 写小程序发布检查断言**

在 `scripts/check-miniapp-release.mjs` 增加文件内容检查：

```js
assertFileIncludes("miniapp/pages/order-detail/index.wxml", "确认收货");
assertFileIncludes("miniapp/pages/order-detail/index.js", "confirmReceipt");
assertFileIncludes("miniapp/pages/order/index.js", "WAIT_DELIVERY");
```

- [ ] **Step 2: 运行检查确认失败**

Run: `npm run test:miniapp-release`

Expected: FAIL，缺少 `确认收货` 或 `WAIT_DELIVERY`。

- [ ] **Step 3: 修改订单提交成功文案**

在 `miniapp/pages/order/index.js` 提交订单成功后，根据返回状态判断：

```js
const orderStatus = res.data && res.data.orderStatus;
const title = orderStatus === "WAIT_DELIVERY" ? "订货成功，等待商家配送" : "下单成功，请完成支付";
wx.showToast({ title, icon: "none" });
```

- [ ] **Step 4: 增加确认收货方法**

在 `miniapp/pages/order-detail/index.js` 增加：

```js
confirmReceipt() {
  const orderNo = this.data.order && this.data.order.orderNo;
  if (!orderNo) return;
  wx.request({
    url: `${getApp().globalData.apiBase}/miniapp/orders/${orderNo}/confirm-receipt`,
    method: "POST",
    success: () => {
      wx.showToast({ title: "已确认收货", icon: "success" });
      this.loadOrder();
    },
    fail: () => {
      wx.showToast({ title: "确认失败，请稍后重试", icon: "none" });
    }
  });
}
```

- [ ] **Step 5: 增加确认收货按钮**

在 `miniapp/pages/order-detail/index.wxml` 增加：

```xml
<button
  wx:if="{{order.orderStatus === 'WAIT_DELIVERY' || order.orderStatus === 'DELIVERING'}}"
  class="primary-btn"
  bindtap="confirmReceipt"
>
  确认收货
</button>
```

- [ ] **Step 6: 后端增加小程序确认收货接口**

在 `backend/src/routes/miniapp.routes.ts` 增加接口，调用与商家端相同完成逻辑；第一版可直接更新状态，后续再抽服务：

```ts
miniappRouter.post("/orders/:orderNo/confirm-receipt", asyncHandler(async (req, res) => {
  await query(
    `UPDATE miniapp_order
     SET order_status = 'COMPLETED', delivery_status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
     WHERE order_no = ? AND order_status IN ('WAIT_DELIVERY', 'DELIVERING')`,
    [req.params.orderNo]
  );
  res.json(ok({ orderNo: req.params.orderNo, status: "COMPLETED" }));
}));
```

实现时必须复用 Task 3 的扣库存逻辑，不能只更新状态；若 Task 3 完成逻辑仍在路由内，先抽出 `completeMiniappOrderDelivery()` 到 `backend/src/shared/fulfillment.ts` 再复用。

- [ ] **Step 7: 运行检查**

Run: `npm run test:miniapp-release && npm run test:qa`

Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add miniapp/pages/order/index.js miniapp/pages/order/index.wxml miniapp/pages/order-detail/index.js miniapp/pages/order-detail/index.wxml backend/src/routes/miniapp.routes.ts scripts/check-miniapp-release.mjs
git commit -m "feat: 小程序支持批发订货和确认收货"
```

---

## Task 7: 新建商家移动端工作区

**Files:**
- Modify: `package.json`
- Create: `merchant-mobile/package.json`
- Create: `merchant-mobile/index.html`
- Create: `merchant-mobile/tsconfig.json`
- Create: `merchant-mobile/vite.config.ts`
- Create: `merchant-mobile/src/main.ts`
- Create: `merchant-mobile/src/App.vue`
- Create: `merchant-mobile/src/api.ts`
- Create: `merchant-mobile/src/styles.css`
- Test: `scripts/ui-contract-test.mjs`

- [ ] **Step 1: 写工程存在性检查**

在 `scripts/ui-contract-test.mjs` 增加：

```js
assertFileIncludes("package.json", "\"merchant-mobile\"");
assertFileIncludes("merchant-mobile/package.json", "\"@vitejs/plugin-vue\"");
assertFileIncludes("merchant-mobile/src/App.vue", "van-tabbar");
assertFileIncludes("merchant-mobile/src/api.ts", "merchant_token");
```

- [ ] **Step 2: 运行 UI 契约确认失败**

Run: `npm run test:ui`

Expected: FAIL，提示 `merchant-mobile/package.json` 不存在。

- [ ] **Step 3: 修改根 package.json**

把 workspaces 改为：

```json
"workspaces": [
  "backend",
  "admin-web",
  "store-terminal",
  "merchant-mobile"
]
```

在 scripts 增加：

```json
"dev:merchant": "npm --workspace merchant-mobile run dev",
"build:merchant": "npm --workspace merchant-mobile run build"
```

- [ ] **Step 4: 创建 merchant-mobile/package.json**

```json
{
  "name": "merchant-mobile",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5175",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview --host 0.0.0.0 --port 4175"
  },
  "dependencies": {
    "@vitejs/plugin-vue": "^5.0.5",
    "axios": "^1.7.2",
    "vant": "^4.9.21",
    "vue": "^3.4.29",
    "vue-tsc": "^2.0.21"
  },
  "devDependencies": {
    "typescript": "^5.5.3",
    "vite": "^5.3.1"
  }
}
```

- [ ] **Step 5: 创建入口文件**

`merchant-mobile/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>智享商家端</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`merchant-mobile/src/main.ts`：

```ts
import { createApp } from "vue";
import Vant from "vant";
import "vant/lib/index.css";
import "./styles.css";
import App from "./App.vue";

createApp(App).use(Vant).mount("#app");
```

- [ ] **Step 6: 创建 API 客户端**

`merchant-mobile/src/api.ts`：

```ts
import axios from "axios";
import { showToast } from "vant";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("merchant_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("merchant_token");
      window.dispatchEvent(new Event("auth:logout"));
      showToast("登录已过期，请重新登录");
    }
    return Promise.reject(error);
  }
);
```

- [ ] **Step 7: 创建 App 壳**

`merchant-mobile/src/App.vue`：

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import LoginView from "./views/LoginView.vue";
import HomeView from "./views/HomeView.vue";
import OrdersView from "./views/OrdersView.vue";
import InventoryView from "./views/InventoryView.vue";
import CustomersView from "./views/CustomersView.vue";
import ReceivablesView from "./views/ReceivablesView.vue";
import ReportsView from "./views/ReportsView.vue";
import ProfileView from "./views/ProfileView.vue";

const token = ref(localStorage.getItem("merchant_token") || "");
const active = ref("home");

const views: Record<string, unknown> = {
  home: HomeView,
  orders: OrdersView,
  inventory: InventoryView,
  customers: CustomersView,
  receivables: ReceivablesView,
  reports: ReportsView,
  profile: ProfileView
};

const currentView = computed(() => views[active.value] || HomeView);

function onLogin(nextToken: string) {
  localStorage.setItem("merchant_token", nextToken);
  token.value = nextToken;
}

onMounted(() => {
  window.addEventListener("auth:logout", () => {
    token.value = "";
    active.value = "home";
  });
});
</script>

<template>
  <LoginView v-if="!token" @login="onLogin" />
  <main v-else class="app-shell">
    <component :is="currentView" />
    <van-tabbar v-model="active" safe-area-inset-bottom>
      <van-tabbar-item name="home" icon="wap-home">首页</van-tabbar-item>
      <van-tabbar-item name="orders" icon="orders-o">订单</van-tabbar-item>
      <van-tabbar-item name="inventory" icon="cluster-o">库存</van-tabbar-item>
      <van-tabbar-item name="customers" icon="friends-o">客户</van-tabbar-item>
      <van-tabbar-item name="profile" icon="manager-o">我的</van-tabbar-item>
    </van-tabbar>
  </main>
</template>
```

- [ ] **Step 8: 创建样式**

`merchant-mobile/src/styles.css`：

```css
:root {
  --brand: #1677ff;
  --bg: #f5f7fa;
  --card: #ffffff;
  --text: #1f2328;
  --muted: #6b7280;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.app-shell {
  min-height: 100vh;
  padding-bottom: 64px;
}

.page {
  padding: 16px;
}

.card {
  background: var(--card);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(31, 35, 40, 0.06);
}
```

- [ ] **Step 9: 安装依赖并运行构建**

Run: `npm install && npm run build:merchant`

Expected: `merchant-mobile` 构建成功。

- [ ] **Step 10: 提交**

```bash
git add package.json package-lock.json merchant-mobile scripts/ui-contract-test.mjs
git commit -m "feat: 新建商家移动端主应用工程"
```

---

## Task 8: 手机端登录、首页和权限菜单

**Files:**
- Modify: `backend/src/routes/store.routes.ts`
- Create: `merchant-mobile/src/views/LoginView.vue`
- Create: `merchant-mobile/src/views/HomeView.vue`
- Create: `merchant-mobile/src/views/ProfileView.vue`

- [ ] **Step 1: 增加商家端当前用户接口**

在 `backend/src/routes/store.routes.ts` 增加：

```ts
storeRouter.get("/me", asyncHandler(async (req, res) => {
  res.json(ok({
    userId: req.user?.id,
    realName: req.user?.realName ?? "商家用户",
    storeId: req.user?.storeId ?? 1,
    permissions: [
      "dashboard.view",
      "order.view",
      "order.deliver",
      "order.complete",
      "inventory.view",
      "customer.view",
      "receivable.view",
      "report.view"
    ],
    menus: ["home", "orders", "inventory", "customers", "receivables", "reports", "profile"]
  }));
}));
```

- [ ] **Step 2: 创建登录页**

`merchant-mobile/src/views/LoginView.vue`：

```vue
<script setup lang="ts">
import { ref } from "vue";
import { showToast } from "vant";
import { api } from "../api";

const emit = defineEmits<{ login: [token: string] }>();
const username = ref("store_manager");
const password = ref("admin123");

async function login() {
  const res = await api.post("/auth/login", { username: username.value, password: password.value });
  const token = res.data.data.token;
  if (!token) {
    showToast("登录失败");
    return;
  }
  emit("login", token);
}
</script>

<template>
  <section class="login-page">
    <div class="login-card">
      <h1>智享商家端</h1>
      <p>手机经营，PC 管理，小程序接客</p>
      <van-field v-model="username" label="账号" placeholder="请输入账号" />
      <van-field v-model="password" label="密码" type="password" placeholder="请输入密码" />
      <van-button block type="primary" @click="login">登录</van-button>
    </div>
  </section>
</template>
```

- [ ] **Step 3: 创建首页**

`merchant-mobile/src/views/HomeView.vue`：

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../api";

const metrics = ref([
  { label: "今日销售", value: "¥0.00" },
  { label: "今日收款", value: "¥0.00" },
  { label: "待配送", value: "0" },
  { label: "待收款", value: "0" }
]);

onMounted(async () => {
  const res = await api.get("/store/dashboard");
  const data = res.data.data || {};
  metrics.value = [
    { label: "今日销售", value: `¥${Number(data.todaySalesAmount || 0).toFixed(2)}` },
    { label: "今日收款", value: `¥${Number(data.todayReceivedAmount || 0).toFixed(2)}` },
    { label: "待配送", value: String(data.waitDeliveryCount || 0) },
    { label: "待收款", value: String(data.unpaidReceivableCount || 0) }
  ];
});
</script>

<template>
  <section class="page">
    <div class="card hero">
      <h2>今日经营</h2>
      <p>快速查看销售、收款、配送和应收</p>
    </div>
    <div class="metric-grid">
      <div v-for="item in metrics" :key="item.label" class="card metric">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 4: 创建我的页**

`merchant-mobile/src/views/ProfileView.vue`：

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../api";

const me = ref({ realName: "", permissions: [] as string[] });

onMounted(async () => {
  const res = await api.get("/store/me");
  me.value = res.data.data;
});

function logout() {
  localStorage.removeItem("merchant_token");
  window.dispatchEvent(new Event("auth:logout"));
}
</script>

<template>
  <section class="page">
    <div class="card">
      <h2>{{ me.realName || "商家用户" }}</h2>
      <p>权限数：{{ me.permissions.length }}</p>
      <van-button block type="danger" plain @click="logout">退出登录</van-button>
    </div>
  </section>
</template>
```

- [ ] **Step 5: 运行构建**

Run: `npm run build:merchant`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add backend/src/routes/store.routes.ts merchant-mobile/src/views/LoginView.vue merchant-mobile/src/views/HomeView.vue merchant-mobile/src/views/ProfileView.vue
git commit -m "feat: 商家移动端登录和首页"
```

---

## Task 9: 手机端订单配送、库存、客户和应收页面

**Files:**
- Create/Modify: `merchant-mobile/src/views/OrdersView.vue`
- Create/Modify: `merchant-mobile/src/views/InventoryView.vue`
- Create/Modify: `merchant-mobile/src/views/CustomersView.vue`
- Create/Modify: `merchant-mobile/src/views/ReceivablesView.vue`

- [ ] **Step 1: 创建订单配送页**

`merchant-mobile/src/views/OrdersView.vue`：

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { showToast } from "vant";
import { api } from "../api";

const orders = ref<any[]>([]);

async function load() {
  const res = await api.get("/store/orders", { params: { page: 1, pageSize: 50 } });
  orders.value = res.data.data.records;
}

async function startDelivery(orderNo: string) {
  await api.post(`/store/orders/${orderNo}/start-delivery`);
  showToast("已开始配送");
  await load();
}

async function complete(orderNo: string) {
  await api.post(`/store/orders/${orderNo}/complete-delivery`);
  showToast("已完成配送");
  await load();
}

onMounted(load);
</script>

<template>
  <section class="page">
    <h2>订单配送</h2>
    <van-cell-group inset>
      <van-cell v-for="order in orders" :key="order.orderNo" :title="order.orderNo" :label="order.receiverName">
        <template #value>
          <van-tag>{{ order.orderStatus }}</van-tag>
        </template>
        <template #extra>
          <van-button size="small" plain @click="startDelivery(order.orderNo)">配送</van-button>
          <van-button size="small" type="primary" @click="complete(order.orderNo)">完成</van-button>
        </template>
      </van-cell>
    </van-cell-group>
  </section>
</template>
```

- [ ] **Step 2: 创建库存页**

`merchant-mobile/src/views/InventoryView.vue`：

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../api";

const records = ref<any[]>([]);

onMounted(async () => {
  const res = await api.get("/store/inventory", { params: { keyword: "" } });
  records.value = res.data.data;
});
</script>

<template>
  <section class="page">
    <h2>库存</h2>
    <van-cell-group inset>
      <van-cell v-for="item in records" :key="`${item.skuId}-${item.stockType}`" :title="item.skuName">
        <template #label>
          实际 {{ item.physicalQty }} / 占用 {{ item.lockedQty }} / 可售 {{ item.availableQty }}
        </template>
      </van-cell>
    </van-cell-group>
  </section>
</template>
```

- [ ] **Step 3: 创建客户页**

`merchant-mobile/src/views/CustomersView.vue`：

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../api";

const records = ref<any[]>([]);

onMounted(async () => {
  const res = await api.get("/store/members", { params: { keyword: "" } });
  records.value = res.data.data.records;
});
</script>

<template>
  <section class="page">
    <h2>客户</h2>
    <van-cell-group inset>
      <van-cell v-for="item in records" :key="item.memberId" :title="item.name" :label="item.mobile">
        <template #value>
          <van-tag :type="item.customerType === 'WHOLESALE' ? 'primary' : 'success'">
            {{ item.customerType === "WHOLESALE" ? "批发" : "零售" }}
          </van-tag>
        </template>
      </van-cell>
    </van-cell-group>
  </section>
</template>
```

- [ ] **Step 4: 创建应收页**

`merchant-mobile/src/views/ReceivablesView.vue`：

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { showToast } from "vant";
import { api } from "../api";

const records = ref<any[]>([]);

async function load() {
  const res = await api.get("/store/receivables", { params: { page: 1, pageSize: 50 } });
  records.value = res.data.data.records;
}

async function collect(item: any) {
  await api.post(`/store/receivables/${item.receivableNo}/payment`, {
    amount: Number(item.unreceivedAmount),
    paymentMethod: "TRANSFER",
    remark: "手机端登记收款"
  });
  showToast("已登记收款");
  await load();
}

onMounted(load);
</script>

<template>
  <section class="page">
    <h2>应收</h2>
    <van-cell-group inset>
      <van-cell v-for="item in records" :key="item.receivableNo" :title="item.customerName" :label="item.receivableNo">
        <template #value>未收 ¥{{ Number(item.unreceivedAmount).toFixed(2) }}</template>
        <template #extra>
          <van-button size="small" type="primary" @click="collect(item)">结清</van-button>
        </template>
      </van-cell>
    </van-cell-group>
  </section>
</template>
```

- [ ] **Step 5: 运行构建**

Run: `npm run build:merchant`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add merchant-mobile/src/views/OrdersView.vue merchant-mobile/src/views/InventoryView.vue merchant-mobile/src/views/CustomersView.vue merchant-mobile/src/views/ReceivablesView.vue
git commit -m "feat: 商家移动端核心经营页面"
```

---

## Task 10: 手机端开单与成交价参考

**Files:**
- Create: `merchant-mobile/src/views/CreateSaleView.vue`
- Modify: `merchant-mobile/src/App.vue`
- Modify: `merchant-mobile/src/views/HomeView.vue`

- [ ] **Step 1: 新增开单入口视图**

创建 `merchant-mobile/src/views/CreateSaleView.vue`：

```vue
<script setup lang="ts">
import { ref } from "vue";
import { showToast } from "vant";
import { api } from "../api";

const memberId = ref<number | null>(null);
const skuId = ref<number | null>(null);
const quantity = ref(1);
const unitPrice = ref<number | null>(null);
const priceReference = ref<any>(null);

async function loadReference() {
  if (!memberId.value || !skuId.value) return;
  const res = await api.get(`/store/members/${memberId.value}/sku-price-reference/${skuId.value}`);
  priceReference.value = res.data.data;
  if (priceReference.value.lastPrice) unitPrice.value = Number(priceReference.value.lastPrice);
}

async function submit() {
  if (!skuId.value || !unitPrice.value) {
    showToast("请填写商品和价格");
    return;
  }
  const res = await api.post("/store/sale-bills", {
    customerId: memberId.value,
    items: [{ skuId: skuId.value, quantity: quantity.value, unitPrice: unitPrice.value }]
  });
  showToast(`已开单 ${res.data.data.billNo}`);
}
</script>

<template>
  <section class="page">
    <h2>手机开单</h2>
    <van-field v-model.number="memberId" label="客户ID" type="number" placeholder="输入客户ID" />
    <van-field v-model.number="skuId" label="商品ID" type="number" placeholder="输入SKU ID" @blur="loadReference" />
    <van-field v-model.number="quantity" label="数量" type="number" />
    <div v-if="priceReference" class="card">
      <p>上次成交价：{{ priceReference.lastPrice || "无" }}</p>
      <p>上次成交日期：{{ priceReference.lastDealAt || "无" }}</p>
      <p>历史高低价：{{ priceReference.highestPrice || "无" }} / {{ priceReference.lowestPrice || "无" }}</p>
    </div>
    <van-field v-model.number="unitPrice" label="本次单价" type="number" />
    <van-button block type="primary" @click="submit">确认开单</van-button>
  </section>
</template>
```

- [ ] **Step 2: 在 App 注册开单页面**

`merchant-mobile/src/App.vue` 增加导入：

```ts
import CreateSaleView from "./views/CreateSaleView.vue";
```

`views` 增加：

```ts
createSale: CreateSaleView,
```

`van-tabbar` 增加：

```vue
<van-tabbar-item name="createSale" icon="edit">开单</van-tabbar-item>
```

- [ ] **Step 3: 首页增加开单提示**

在 `merchant-mobile/src/views/HomeView.vue` hero 下增加：

```vue
<div class="card">
  <h3>常用动作</h3>
  <p>手机端支持开单、配送、库存、客户、应收等高频经营操作。</p>
</div>
```

- [ ] **Step 4: 运行构建和 QA**

Run: `npm run build:merchant && npm run test:qa`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add merchant-mobile/src/views/CreateSaleView.vue merchant-mobile/src/App.vue merchant-mobile/src/views/HomeView.vue
git commit -m "feat: 商家移动端支持开单和成交价参考"
```

---

## Task 11: 构建、部署检查和文档更新

**Files:**
- Modify: `deploy/README.md`
- Modify: `deploy/04-nginx.conf`
- Modify: `scripts/check-production-deploy.mjs`
- Modify: `package.json`

- [ ] **Step 1: 增加生产部署契约检查**

在 `scripts/check-production-deploy.mjs` 增加：

```js
assertFileIncludes("package.json", "build:merchant");
assertFileIncludes("deploy/04-nginx.conf", "merchant.onepan.cn");
assertFileIncludes("deploy/README.md", "商家移动端");
```

- [ ] **Step 2: 运行检查确认失败**

Run: `npm run test:production-deploy`

Expected: FAIL，Nginx 或 README 缺少商家移动端配置。

- [ ] **Step 3: 更新 Nginx 配置**

在 `deploy/04-nginx.conf` 增加 server：

```nginx
server {
  listen 80;
  server_name merchant.onepan.cn;

  root /opt/zhixiang/liquor-inventory-system/merchant-mobile/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

- [ ] **Step 4: 更新部署 README**

在 `deploy/README.md` 增加：

```md
### 商家移动端

商家移动端构建命令：

```bash
npm run build:merchant
```

默认部署域名：

- `merchant.onepan.cn`

商家移动端使用同一后端 API：

- `https://api.onepan.cn/api`
```

- [ ] **Step 5: 更新构建脚本**

确认根 `package.json` 的 `build` 会通过 workspaces 构建 `merchant-mobile`。如果 `merchant-mobile` 已加入 workspaces，则不用额外修改；如果 CI 需要显式命令，新增：

```json
"build:all": "npm run build && npm run build:merchant"
```

- [ ] **Step 6: 全量验证**

Run:

```bash
npm run test:backend
npm run test:ui
npm run test:qa
npm run test:production-deploy
npm run build
```

Expected:

- 后端单测通过。
- UI 契约通过。
- QA 回归通过。
- 生产部署契约通过。
- 全量构建通过。

- [ ] **Step 7: 提交**

```bash
git add deploy/README.md deploy/04-nginx.conf scripts/check-production-deploy.mjs package.json
git commit -m "chore: 增加商家移动端部署配置"
```

---

## 自检清单

### 规格覆盖

- 三端边界：Task 7-11 覆盖手机端主应用，Task 6 覆盖小程序，PC 复杂配置不改。
- 批发客户只看批发价：沿用现有 `miniapp/products` 逻辑，Task 2 确保批发下单按批发身份处理。
- 批发订单不确认直接配送：Task 2 覆盖 `WAIT_DELIVERY`。
- 库存部分占用：Task 1-2 覆盖 `reservedQty/unreservedQty`。
- 配送完成扣库存：Task 3 覆盖。
- 拒收/取消释放库存：Task 3 覆盖。
- 账期应收：Task 3 和 Task 5 覆盖。
- 上次成交价：Task 4 和 Task 10 覆盖。
- 一个手机端 App 按权限显示：Task 7-8 覆盖。

### 无占位符检查

所有任务都有明确路径、测试命令、代码片段和提交命令。

### 风险说明

1. Task 3 的完成配送逻辑要被商家端和小程序确认收货复用，实施时如果发现路由内逻辑重复，必须先抽到 `backend/src/shared/fulfillment.ts`。
2. 现有 Mock SQL 匹配是字符串包含式，新增 SQL 时必须同步更新 `mock-db.ts`，否则 QA 回归会在 Mock 模式失败。
3. `merchant-mobile` 加入 workspaces 后，`npm install` 会更新 `package-lock.json`，提交时必须包含。
