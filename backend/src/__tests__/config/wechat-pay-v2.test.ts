/**
 * 微信支付 APIv2 签名与 XML 工具单元测试
 * 被测文件：src/config/wechat-pay-v2.ts
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { buildXml, parseXml, signV2 } from "../../config/wechat-pay-v2";

describe("wechat-pay-v2 - XML", () => {
  it("buildXml 生成 CDATA 结构且忽略空值", () => {
    const xml = buildXml({ appid: "wx123", mch_id: "mch1", sign: "", body: "测试<商品>" });
    expect(xml).toContain("<appid><![CDATA[wx123]]></appid>");
    expect(xml).toContain("<body><![CDATA[测试&lt;商品&gt;]]></body>");
    expect(xml).not.toContain("<sign>");
  });

  it("parseXml 解析微信 V2 响应", () => {
    const xml = `<xml>
      <return_code><![CDATA[SUCCESS]]></return_code>
      <result_code><![CDATA[SUCCESS]]></result_code>
      <transaction_id><![CDATA[WX123456]]></transaction_id>
      <openid><![CDATA[oABC]]></openid>
    </xml>`;
    const parsed = parseXml(xml);
    expect(parsed.return_code).toBe("SUCCESS");
    expect(parsed.result_code).toBe("SUCCESS");
    expect(parsed.transaction_id).toBe("WX123456");
    expect(parsed.openid).toBe("oABC");
  });
});

describe("wechat-pay-v2 - signV2", () => {
  it("MD5 签名与官方示例一致（参数升序 + &key= 密钥）", () => {
    const params = { body: "测试", mch_id: "mch1", nonce_str: "abc", appid: "wx123" };
    const sign = signV2(params, "SECRETKEY123");
    // 手工复算：appid=wx123&body=测试&mch_id=mch1&nonce_str=abc&key=SECRETKEY123
    const expected = crypto
      .createHash("md5")
      .update("appid=wx123&body=测试&mch_id=mch1&nonce_str=abc&key=SECRETKEY123")
      .digest("hex")
      .toUpperCase();
    expect(sign).toBe(expected);
    expect(sign).toMatch(/^[A-F0-9]{32}$/);
  });

  it("签名排除 sign 字段本身", () => {
    const withSign = signV2({ a: "1", sign: "OLD" }, "k");
    const withoutSign = signV2({ a: "1" }, "k");
    expect(withSign).toBe(withoutSign);
  });
});
