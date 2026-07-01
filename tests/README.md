
# 智享全链管理系统 - 测试文档 & 脚本

本目录包含 Sprint 1 (2026/06/17 - 2026/06/24) 的全部测试交付物。

## 目录结构

```
tests/
├── docs/
│   ├── test-plan.md              # 测试计划文档
│   ├── test-cases.md             # 功能测试用例集 (13 个模块 / 50+ 用例)
│   ├── performance-plan.md       # 性能测试方案 (含 k6 脚本示例)
│   ├── security-checklist.md     # 安全测试清单 (12 大类 / 80+ 检查项)
│   └── compatibility-matrix.md   # 兼容性测试矩阵
├── api-test-suite.mjs           # 接口自动化测试集合 (Node.js)
├── mysql-smoke-test.mjs          # MySQL 冒烟测试 (实际位于 scripts/)
├── qa-regression-test.mjs        # QA 重点回归测试 (实际位于 scripts/)
└── README.md                      # 本文件
```

## 接口覆盖范围

本系统共包含 6 个路由模块，39+ 接口，覆盖：

| 模块 | 路由文件 | 接口数 |
|---|---|---|
| 管理后台 | admin.routes.ts | ~18 |
| 门店操作 | store.routes.ts | ~10 |
| 微信小程序 | miniapp.routes.ts | ~5 |
| 健康检查 | 直接挂在 server | 1 |

## 测试工具

| 测试类型 | 工具 | 说明 |
|---|---|---|
| 功能测试 | 手工 + Postman/Apifox | 测试计划 & 测试用例 |
| 接口测试 | Node.js 脚本 (`tests/api-test-suite.mjs`) | 覆盖所有主要接口 |
| 权限测试 | 手工 + 脚本 | token 验证、越权测试 |
| 性能测试 | k6 | 基准测试、并发压力测试 |
| 安全测试 | 手工脚本 + 自动化脚本 | SQL 注入、XSS、CSRF、敏感数据 |
| 兼容性测试 | 手工验证 | 浏览器/设备矩阵 |

## 运行测试

### 1. 健康检查

```bash
curl http://localhost:8080/health
```

### 2. 接口自动化测试集合

```bash
# 需要先启动后端
USE_MOCK_DB=false DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root \
  DB_PASSWORD=root123456 DB_NAME=liquor_inventory \
  npm --workspace backend run dev

# 执行测试 (另起终端)
node tests/api-test-suite.mjs

# 或指定 API 地址
API_BASE=http://localhost:8080 node tests/api-test-suite.mjs
```

### 3. MySQL 冒烟测试

```bash
node scripts/mysql-smoke-test.mjs
# 期望: 25/25 通过
```

### 4. QA 重点回归测试

```bash
node scripts/qa-regression-test.mjs
# 期望: 输出 QA_REGRESSION_PASS
```

### 5. 性能测试 (k6)

```bash
# 安装 k6 (如未安装)
# macOS: brew install k6
# Ubuntu: sudo apt install k6

# 运行单个场景
k6 run tests/k6-healthcheck.js
k6 run tests/k6-products.js
```

## 测试用例统计

| 模块 | 测试用例数 | 优先级 |
|---|---|---|
| 认证模块 | 10 | P0 |
| 商品管理 | 9 | P0 |
| 门店管理 | 4 | P0 |
| 订单管理 | 7 | P0 |
| 销售单 | 6 | P0 |
| 库存管理 | 8 | P0 |
| 客户管理 | 6 | P1 |
| 收款与退款 | 8 | P0 |
| 挂单 | 5 | P1 |
| 报表 | 5 | P1 |
| 权限与安全 | 9 | P0 |
| 性能测试 | 7 | P1 |
| 响应结构 | 3 | P1 |
| **合计** | **~90** | **—** |

## 准入/准出标准

### 准入标准
- 所有接口通过自动化测试
- 核心业务流程全部通过
- 无高严重性缺陷 (P0)

### 准出标准
- 核心功能测试用例通过率 100%
- 次要功能测试用例通过率 >= 95%
- P0/P1 缺陷清零
- P2 缺陷数量 <= 5 个

## 每日站会流程

**时间**: 每天 09:30

**内容**:
1. 昨天完成什么
2. 今天计划什么
3. 有什么阻塞

**阻塞问题记录格式**:
```
- 问题描述
- 涉及模块
- 阻塞原因
- 需要的支持
- 预计解决时间
```

## Bug 记录格式

```
- [BUG-编号] [模块] [严重程度] 问题描述
  - 复现步骤: 1. 2. 3.
  - 预期行为:
  - 实际行为:
  - 影响范围:
  - 相关开发: @XXX
  - 截图/日志: [链接]
```

## 严重等级定义

| 等级 | 定义 | 示例 | 响应时间 |
|---|---|---|---|
| P0 | 功能阻塞、核心流程阻断、数据丢失风险 | 无法登录、订单创建失败、SQL 注入成功 | 24 小时 |
| P1 | 重要功能有缺陷、影响业务流程但可绕 | 商品列表分页错误、价格计算不一致、Token 过期策略问题 | 1 周 |
| P2 | 次要问题、不影响核心流程、UI/样式问题 | 按钮样式不统一、字段对齐问题 | 下一版本 |

## Sprint 1 进度追踪

- [x] 测试计划制定
- [x] 功能测试用例编写
- [x] 接口测试脚本编写
- [x] 性能测试方案
- [x] 安全测试清单
- [x] 兼容性测试矩阵
- [ ] 第一轮功能测试执行
- [ ] 缺陷记录
- [ ] 第二轮回归测试
- [ ] 测试报告输出

## 相关资源

| 资源 | 位置 |
|---|---|
| 项目代码 | /workspace |
| 后端启动 | `npm --workspace backend run dev` |
| 管理后台 | `npm --workspace admin-web run dev` |
| 门店终端 | `npm --workspace store-terminal run dev` |
| 数据库初始化 | 后端启动时自动执行 |
| MySQL 初始化脚本 | `/workspace/backend/src/db/schema.sql` & `seed.sql` |

## 联系方式

- 测试负责人: 苏然
- 开发负责人: 阿坚
- 产品负责人: 林夕
- 项目对接: 凌舟

---

**最后更新时间**: 2026/06/17
