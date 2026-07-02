import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../server.js";
import { signToken } from "../shared/auth.js";
import { resetMockDb } from "../shared/mock-db.js";

const TOKEN = signToken({ id: 1, username: "admin", roles: ["SUPER_ADMIN"], storeId: null, tenantId: "default" });

describe("DEBUG", () => {
  it("debug supplier create then update", async () => {
    resetMockDb();
    const createRes = await request(app)
      .post("/api/admin/suppliers")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "测试供应商", shortName: "测试", supplyType: "白酒", settlementType: "MONTHLY", settlementDay: 15, contactPerson: "张三", contactMobile: "13800000000" });
    console.log("CREATE:", JSON.stringify(createRes.body));
    const id = createRes.body.data?.id;
    console.log("ID:", id);

    const detailRes = await request(app)
      .get(`/api/admin/suppliers/${id}`)
      .set("Authorization", `Bearer ${TOKEN}`);
    console.log("DETAIL:", detailRes.status, JSON.stringify(detailRes.body));

    const updateRes = await request(app)
      .put(`/api/admin/suppliers/${id}`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ name: "更新后的供应商", remark: "测试备注" });
    console.log("UPDATE:", updateRes.status, JSON.stringify(updateRes.body));
    expect(updateRes.status).toBe(200);
  });
});