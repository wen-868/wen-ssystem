// S3-196 · 范围外发现的取证探针（只读/仅 scratch 库）
// 1) 老客户端路径与后端不对齐（双段重复）→ 期望 404
// 2) markMyRead 缺用户维度（IDs 越权面）→ 用 member4 的令牌标记 member5 的通知
import { createHmac } from "node:crypto";
const JWT_SECRET = "s3196-e2e-jwt-secret";
const CSRF_SECRET = "s3196-e2e-csrf-secret";
const b64 = (v) => Buffer.from(v).toString("base64url");
const wx = (id, openid) => {
  const data = `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify({ wxUserId: id, openid, iat: Math.floor(Date.now()/1000) }))}`;
  return `${data}.${createHmac("sha256", JWT_SECRET).update(data).digest("base64url")}`;
};
const csrf = (id) => createHmac("sha256", CSRF_SECRET).update(String(id)).digest("hex");
const BASE = "http://127.0.0.1:18096";
const h = (id, openid) => ({ "Content-Type": "application/json", Authorization: `Bearer ${wx(id, openid)}`, "x-csrf-token": csrf(id) });

async function probe(label, method, path, headers, body) {
  const res = await fetch(`${BASE}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await res.text();
  return { label, endpoint: `${method} ${path}`, status: res.status, body: text.slice(0, 200) };
}

const out = [];
// 1) 老客户端实际使用的路径（双段重复）
out.push(await probe("老端 home 页路径", "POST", "/api/miniapp/cart/cart/add", h(9001, "openid-s196"), { skuId: 1, quantity: 1 }));
out.push(await probe("老端 aftersale 页路径", "GET", "/api/miniapp/aftersales/aftersales/mine", h(9001, "openid-s196")));
out.push(await probe("老端 cart 页取车路径", "GET", "/api/miniapp/cart/cart", h(9001, "openid-s196")));
// 对照：后端真实路径
out.push(await probe("后端真实路径（对照）", "POST", "/api/miniapp/cart/add", h(9001, "openid-s196"), { skuId: 1, quantity: 1 }));

// 2) 通知已读的用户维度（用另一个会员的令牌标记）
out.push(await probe("另一个会员标记他人通知已读", "PUT", "/api/miniapp/notifications/1/read", h(9101, "openid-s196-other")));

console.log(JSON.stringify(out, null, 2));
