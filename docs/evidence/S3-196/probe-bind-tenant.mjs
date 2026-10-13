import { createHmac } from "node:crypto";
const JWT_SECRET = "s3196-e2e-jwt-secret", CSRF_SECRET = "s3196-e2e-csrf-secret";
const b64 = (v) => Buffer.from(v).toString("base64url");
const data = `${b64(JSON.stringify({alg:"HS256",typ:"JWT"}))}.${b64(JSON.stringify({wxUserId:9001,openid:"openid-s196",iat:Math.floor(Date.now()/1000)}))}`;
const token = `${data}.${createHmac("sha256",JWT_SECRET).update(data).digest("base64url")}`;
const csrf = createHmac("sha256", CSRF_SECRET).update("9001").digest("hex");
const body = JSON.stringify({ username: "member01", password: "P@ssw0rd", bindingType: "CONSUMER" });
for (const [label, headers] of [
  ["两源都缺（反测③）", { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-csrf-token": csrf }],
  ["带 X-Tenant-Id（对照）", { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-csrf-token": csrf, "X-Tenant-Id": "default" }],
]) {
  const res = await fetch("http://127.0.0.1:18096/api/miniapp/wechat/auth/bind", { method: "POST", headers, body });
  console.log(label, "→", res.status, (await res.text()).slice(0, 160));
}
