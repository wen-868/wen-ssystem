const base = process.env.API_BASE || "http://localhost:8080/api";

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  const body = JSON.parse(text);
  if (!res.ok || body.code !== "0") {
    throw new Error(`${path} failed: ${res.status} ${text}`);
  }
  return body.data;
}

const login = await request("/admin/auth/login", {
  method: "POST",
  body: JSON.stringify({ username: "admin", password: "admin123" })
});
const auth = { Authorization: `Bearer ${login.token}` };

const hold = await request("/store/hold-orders", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    customerName: "快速测试客户",
    customerMobile: "13800000003",
    amount: 129,
    remark: "快速测试挂单",
    items: [{ skuId: 1, skuName: "示例白酒", quantity: 1, unitPrice: 129, subtotalAmount: 129 }]
  })
});

const list = await request("/store/hold-orders", { headers: auth });
const restored = await request(`/store/hold-orders/${hold.holdNo}/restore`, { method: "POST", headers: auth });
await request(`/store/hold-orders/${hold.holdNo}`, { method: "DELETE", headers: auth });

if (!hold.holdNo || list.records.length < 1 || restored.items.length !== 1) {
  throw new Error("门店挂单/取单快速测试失败");
}

console.log("QUICK_STORE_TEST_PASS", hold.holdNo);
