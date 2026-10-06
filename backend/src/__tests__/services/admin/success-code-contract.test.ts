/**
 * S3-19：后端成功码契约统一——本批 3 处（改前 → 改后 响应对比）
 *
 * 改前：`services/admin/instant-retail.service.ts` 饿了么分支成功码 "200"
 *       `services/instant-retail/platform-integration.service.ts` 饿了么分支成功码 "200"
 *       `services/admin/payment.service.ts` 微信回调成功码 "SUCCESS"
 * 改后：均为本仓统一口径 code="0"
 *
 * 三个来源与 `docs/tasks/current-tasks.md:194`（S3-19 登记）逐条一致；
 * 前端白名单 `saas-admin/src/utils/http-error.ts:60-84` 的收缩由凌舟在共享文件层收口。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithTenant: vi.fn(),
  queryOneWithTenant: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
  query: hoisted.query,
  queryOne: hoisted.queryOne,
  queryWithTenant: hoisted.queryWithTenant,
  queryOneWithTenant: hoisted.queryOneWithTenant,
  transaction: hoisted.transaction,
}));

vi.mock("../../../shared/id", () => ({ makeBizNo: vi.fn(() => "PAY20261006001") }));

import { handleWebhook } from "../../../services/admin/instant-retail.service";
import { handleWxCallback } from "../../../services/admin/payment.service";
import { buildWebhookResponse } from "../../../services/instant-retail/platform-integration.service";

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.transaction.mockImplementation(
    async (runner: (conn: unknown) => Promise<unknown>) =>
      runner({
        execute: async () => [[], {}],
      })
  );
});

describe("S3-19：成功码统一为 code=\"0\"", () => {
  it("即时零售 webhook（本仓信封）成功码 = \"0\"，不再出现 \"200\"", async () => {
    hoisted.queryOne.mockResolvedValue(null); // 无平台配置 ⇒ 直接返回成功响应（不触碰事务）
    const eleme = await handleWebhook("ELEME", {}, "sig", "123");
    expect(eleme).toMatchObject({ status: 200, response: { code: "0", message: "success" } });

    const jd = await handleWebhook("JD", {}, "sig", "123");
    expect(jd).toMatchObject({ status: 200, response: { code: "0" } });
  });

  it("微信支付回调成功返回 code=\"0\"（不再返回 \"SUCCESS\"）", async () => {
    const wechatPay = {
      verifyNotifySignature: () => true,
      decryptNotifyData: () =>
        JSON.stringify({
          out_trade_no: "ZF001",
          transaction_id: "tx001",
          trade_state: "SUCCESS",
          amount: { total: 10000 },
        }),
    };
    const res = await handleWxCallback({}, { resource: { associated_data: "a", nonce: "n", ciphertext: "c" } } as never, wechatPay as never);
    expect(res).toMatchObject({ success: true, code: "0" });
    expect(res.code).not.toBe("SUCCESS");
  });

  it("即时零售 webhook（platform-integration 同名分支）成功码 = \"0\"，不再出现 \"200\"", () => {
    expect(buildWebhookResponse("ELEME", true)).toMatchObject({ code: "0", message: "success" });
    expect(buildWebhookResponse("ELEME", true).code).not.toBe("200");
    expect(buildWebhookResponse("ELEME", false)).toMatchObject({ code: "500" });
    // 同函数其余平台分支口径不变（回归护栏）
    expect(buildWebhookResponse("JD", true)).toMatchObject({ code: "0" });
    expect(buildWebhookResponse("MEITUAN", true)).toMatchObject({ data: "OK" });
  });
});
