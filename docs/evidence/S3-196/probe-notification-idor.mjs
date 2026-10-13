import { createHmac } from "node:crypto";
const JWT_SECRET = "s3196-e2e-jwt-secret", CSRF_SECRET = "s3196-e2e-csrf-secret";
const b64 = (v) => Buffer.from(v).toString("base64url");
const wx = (id, openid) => { const d = `${b64(JSON.stringify({alg:"HS256",typ:"JWT"}))}.${b64(JSON.stringify({wxUserId:id,openid,iat:Math.floor(Date.now()/1000)}))}`; return `${d}.${createHmac("sha256",JWT_SECRET).update(d).digest("base64url")}`; };
const csrf = (id) => createHmac("sha256", CSRF_SECRET).update(String(id)).digest("hex");
const victimNotif = process.argv[2];
const res = await fetch(`http://127.0.0.1:18096/api/miniapp/notifications/${victimNotif}/read`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${wx(9101, "openid-s196-other")}`, "x-csrf-token": csrf(9101) },
});
console.log("member5 标记 member4 的通知", victimNotif, "→", res.status, await res.text());
