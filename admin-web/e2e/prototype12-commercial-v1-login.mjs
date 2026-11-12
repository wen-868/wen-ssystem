// V1 真实登录端到端探针：真实口令登录 8081 → JWT → 记录链路；负例：错口令/坏 JWT
import fs from "node:fs";

const cfg = fs.readFileSync("D:/Users/ZXQL/ZXQL-WORK/.local/WORKBENCH-PROTOTYPE-12-COMMERCIAL-REVERIFY-01/config.local.ps1", "utf8");
const get = (k) => (cfg.match(new RegExp("\\b" + k + "\\s*=\\s*'([^']*)'", "m")) || [])[1];
const pwVerify = get("VerifyAdminPassword");
const API = "http://127.0.0.1:8081";
const out = {};

// 1) 真实登录（正确口令）
const r1 = await fetch(`${API}/api/admin/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "comm_verify_admin", password: pwVerify }),
});
const j1 = await r1.json().catch(() => null);
const token = j1?.data?.token || null;
out.real_login = {
  http: r1.status, code: j1?.code ?? null, msg: j1?.msg ?? null,
  has_token: !!token, token_prefix_shape: token ? token.split(".").length + "-parts-jwt" : null,
  token_payload_shape: token ? Object.keys(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())).sort() : null,
  token_payload_user_shape: token ? Object.keys(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())).filter(k => /name|role|tenant|store/i.test(k)) : null,
  data_keys: j1?.data ? Object.keys(j1.data).sort() : null,
  roles: j1?.data?.user?.roles ?? j1?.data?.roles ?? null,
  csrfToken_present: !!(j1?.data?.csrfToken),
};
console.log("real_login:", JSON.stringify(out.real_login));

// 2) 负例：错误口令（验证拒绝路径；不打印口令）
const r2 = await fetch(`${API}/api/admin/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "comm_verify_admin", password: "wrong-password-probe-not-real" }),
});
const j2 = await r2.json().catch(() => null);
out.wrong_password = { http: r2.status, code: j2?.code ?? null, msg: j2?.msg ?? null, has_token: !!(j2?.data?.token) };
console.log("wrong_password:", JSON.stringify(out.wrong_password));

// 3) 负例：无效 JWT 调 AI 侧（3016 当前可能未起；先打 8081 受保护端点）
const r3 = await fetch(`${API}/api/admin/menus/user`, { headers: { Authorization: "Bearer not-a-real-jwt" } });
out.invalid_jwt_8081 = { http: r3.status };
console.log("invalid_jwt_8081:", JSON.stringify(out.invalid_jwt_8081));

// 4) 无 JWT
const r4 = await fetch(`${API}/api/admin/menus/user`);
out.no_jwt_8081 = { http: r4.status };
console.log("no_jwt_8081:", JSON.stringify(out.no_jwt_8081));

// 5) 真 JWT 打 menus/user（真实授权链路）
if (token) {
  const r5 = await fetch(`${API}/api/admin/menus/user`, { headers: { Authorization: `Bearer ${token}` } });
  const t5 = await r5.text();
  out.real_jwt_menus = { http: r5.status, len: t5.length, menu_codes_head: (t5.match(/"menuCode":"/g) || []).length };
  console.log("real_jwt_menus:", JSON.stringify(out.real_jwt_menus));
}

fs.writeFileSync("D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-COMMERCIAL-REVERIFY-01/raw/10-v1-real-login.json", JSON.stringify(out, null, 2) + "\n");
console.log("DONE v1-probe");
