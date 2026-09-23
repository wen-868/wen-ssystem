/**
 * 冒烟：证明"真实服务代码 + SQLite 引擎替身"这条通道可用（通道不通则后续核验无意义）。
 */
import { submitOfflineOrders } from "../../../../backend/src/services/sync/delta-sync.service";
import { probeQuery, sqlLog } from "./db-adapter.mjs";

const TENANT_A = "b2-tenant-a";

const r1 = await submitOfflineOrders(
  [
    {
      draftNo: "SMOKE-001",
      items: [
        { skuId: 1, skuName: "冒烟酒", boxQty: 1, bottleQty: 6, totalBottleQty: 6, unitPrice: 100, priceType: "RETAIL", subtotalAmount: 600 },
      ],
      totalAmount: 600,
      createdAt: "2026-09-23T00:00:00Z",
    },
  ],
  TENANT_A,
  1
);

console.log("RESULT:", JSON.stringify(r1));
console.log("BILLS:", JSON.stringify(probeQuery("SELECT bill_no, tenant_id, business_status, collection_status FROM t_sale_bill")));
console.log("ITEMS:", JSON.stringify(probeQuery("SELECT bill_no, tenant_id, sku_name FROM t_sale_bill_item")));
console.log("SQL:", JSON.stringify(sqlLog.map((s) => `${s.op} ${s.table}`)));
