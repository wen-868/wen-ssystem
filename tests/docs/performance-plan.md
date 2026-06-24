
# 智享营销系统 - 性能测试方案

> 目标: 评估系统在预期负载下的响应时间、并发能力和稳定性

---

## 1. 测试环境

| 项目 | 规格 |
|---|---|
| 后端服务器 | Node.js 20 |
| 数据库 | MySQL 8.4 |
| 缓存 | Redis 7 |
| 测试工具 | k6 / wrk / 自定义脚本 |
| 测试地址 | http://localhost:8080 (开发环境) |

## 2. 性能指标定义

| 指标 | 目标 | 说明 |
|---|---|---|
| P50 响应时间 | < 200ms | 半数用户响应时间 |
| P95 响应时间 | < 500ms | 95% 用户响应时间 |
| P99 响应时间 | < 1000ms | 99% 用户响应时间 |
| 并发用户 | 100+ | 稳定并发 |
| 错误率 | < 1% | 不超过 1% |
| 资源占用 | CPU < 70% | 正常负载 |

## 3. 测试场景

### 场景 1: 健康检查接口基准测试 (基准)
- 目标: `/health`
- 时长: 30 秒
- 并发: 100 VUs
- 预期: P95 < 50ms

### 场景 2: 登录接口压力测试
- 目标: `POST /api/admin/auth/login`
- 时长: 30 秒
- 并发: 10 VUs
- 预期: P95 < 200ms

### 场景 3: 商品列表查询
- 目标: `GET /api/admin/products` (需 Token)
- 时长: 60 秒
- 并发: 100 VUs
- 预期: P95 < 500ms

### 场景 4: 订单列表查询
- 目标: `GET /api/admin/orders`
- 时长: 60 秒
- 并发: 100 VUs
- 预期: P95 < 500ms

### 场景 5: 创建销售单
- 目标: `POST /api/store/sale-bills`
- 时长: 30 秒
- 并发: 10 VUs
- 预期: P95 < 300ms

### 场景 6: 小程序下单
- 目标: `POST /api/miniapp/orders`
- 时长: 30 秒
- 并发: 20 VUs
- 预期: P95 < 500ms

### 场景 7: 报表看板
- 目标: `GET /api/admin/reports/dashboard`
- 时长: 30 秒
- 并发: 20 VUs
- 预期: P95 < 1000ms

## 4. 测试脚本示例 (k6)

```javascript
// tests/k6-healthcheck.js
import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
  vus: 100,
  duration: "30s",
  thresholds: {
    "http_req_duration{name:healthcheck}": ["p(95)<50"],
    "http_req_duration{name:healthcheck}": ["p(99)<100"],
    "http_reqs": ["rate>100"],
  },
};

export default function () {
  const res = http.get("http://localhost:8080/health", {
    tags: { name: "healthcheck" },
  });
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(1);
}
```

```javascript
// tests/k6-login.js
import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
};

const loginBody = JSON.stringify({ username: "admin", password: "admin123" });
const loginParams = { headers: { "Content-Type": "application/json" } };

export default function () {
  const res = http.post("http://localhost:8080/api/admin/auth/login",
    loginBody, loginParams);
  check(res, { "login ok": (r) => r.status === 200 });
  sleep(1);
}
```

```javascript
// tests/k6-products.js
import http from "k6/http";
import { check, group } from "k6";

export const options = {
  vus: 100,
  duration: "1m",
  thresholds: {
    "http_req_duration": ["p(95)<500"],
    "http_req_duration": ["p(99)<1000"],
  },
};

// 先登录获取 token (setup 只执行一次)
export function setup() {
  const loginRes = http.post("http://localhost:8080/api/admin/auth/login",
    JSON.stringify({ username: "admin", password: "admin123" }),
    { headers: { "Content-Type": "application/json" } });
  const body = JSON.parse(loginRes.body || "{}");
  return { token: body.data?.token || "" };
}

export default function (data) {
  const params = {
    headers: {
      "Authorization": `Bearer ${data.token}`,
      "Content-Type": "application/json",
    },
  };
  const res = http.get("http://localhost:8080/api/admin/products?page=1&pageSize=10", params);
  check(res, { "products ok": (r) => r.status === 200 });
}
```

## 5. 执行步骤

```bash
# Step 1: 启动后端 (确保 MySQL 可连)
USE_MOCK_DB=false npm --workspace backend run dev

# Step 2: 健康检查基准
k6 run tests/k6-healthcheck.js

# Step 3: 登录接口压力
k6 run tests/k6-login.js

# Step 4: 商品列表查询
k6 run tests/k6-products.js

# Step 5: 订单列表查询
k6 run tests/k6-orders.js

# Step 6: 创建销售单
k6 run tests/k6-sale-bills.js

# Step 7: 报表
k6 run tests/k6-reports.js
```

## 6. 结果记录模板

| 场景 | VUs | 时长 | P50 | P95 | P99 | 错误率 | 结论 |
|---|---|---|---|---|---|---|---|
| 健康检查 | 100 | 30s | | | | | |
| 登录 | 10 | 30s | | | | | |
| 商品列表 | 100 | 60s | | | | | |
| 订单列表 | 100 | 60s | | | | | |
| 创建销售单 | 10 | 30s | | | | | |
| 小程序下单 | 20 | 30s | | | | | |
| 报表看板 | 20 | 30s | | | | | |

## 7. 优化建议（如发现性能瓶颈）

1. **数据库层面**: 添加索引、SQL 优化
2. **缓存层面**: 使用 Redis 缓存热点数据
3. **应用层面**: 连接池优化、异步处理
4. **部署层面**: 多实例部署、负载均衡

## 8. 注意事项

- 测试前确认数据库有数据（建议至少 1000 条订单、100 个 SKU）
- 测试过程中监控服务器 CPU/内存/IO
- 不要在生产环境进行高压力测试
- 发现瓶颈后先优化，再重新测试
