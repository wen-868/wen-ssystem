/**
 * make-notify-payload.mjs —— 生成一条「微信支付 API v3 回调」JSON 报文，用于运行期验证
 *
 * 与 backend/src/services/wechat-pay.service.ts 的 decryptResource 同构：
 *   key  = api_v3_key（32 字节）
 *   nonce= 12 字节字符串，AAD = associated_data
 *   ciphertext = base64(密文 || 16 字节 GCM tag)
 * 用法：node make-notify-payload.mjs <api_v3_key> <trade_state> <out_trade_no> <输出 json 路径>
 */

import crypto from "node:crypto";
import { writeFileSync } from "node:fs";

const [, , apiV3Key, tradeState, outTradeNo, outPath] = process.argv;
if (!apiV3Key || !tradeState || !outTradeNo || !outPath) {
  console.error("用法：node make-notify-payload.mjs <api_v3_key> <trade_state> <out_trade_no> <输出 json 路径>");
  process.exit(2);
}

const key = Buffer.from(apiV3Key, "utf8");
if (key.length !== 32) throw new Error(`api_v3_key 必须 32 字节，当前 ${key.length}`);
const nonce = "123456789012";
const aad = "transaction";
const plaintext = JSON.stringify({ out_trade_no: outTradeNo, trade_state: tradeState });

const cipher = crypto.createCipheriv("aes-256-gcm", key, Buffer.from(nonce, "utf8"));
cipher.setAAD(Buffer.from(aad, "utf8"));
const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
const ciphertext = Buffer.concat([enc, cipher.getAuthTag()]).toString("base64");

const body = {
  id: "s3191-runtime-proof",
  event_type: "TRANSACTION.SUCCESS",
  resource: { algorithm: "AEAD_AES_256_GCM", ciphertext, nonce, associated_data: aad },
};
writeFileSync(outPath, JSON.stringify(body), "utf-8");
console.log(`payload -> ${outPath}`);
console.log(`  plaintext = ${plaintext}`);
console.log(`  ciphertext(base64) = ${ciphertext}`);
