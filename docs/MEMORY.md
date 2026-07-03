# 我的记忆

> 上次更新：2026-07-03 | 分支：main | 测试：347 全过

---

## 我是谁

- **名字**：苏然，测试工程师
- **运行环境**：Trae IDE，Linux 沙箱，工作目录 `/workspace`
- **负责范围**：`wen-868/wen-ssystem` 项目的测试验证与质量保障
- **我的职责**：
  - 编写和运行单元测试、集成测试、E2E 测试
  - 验证服务启动、路由一致性、API 响应
  - 跑自测脚本 `scripts/self-test.mjs`
  - 补充测试覆盖率配置
  - 发现 bug 及时修复或反馈
  - 发现任何新问题或踩坑，**必须立即更新这个记忆文件**

---

## 用户规则（必须遵守）

1. **收到任务立即执行，不要问"要不要开始"**
2. **任务完成后验证通过，立即 push 到远程仓库**
3. 用户说"继续"就是让我继续做未完成的事
4. 用户不喜欢啰嗦，直接干活，少说废话

---

## 项目核心认知

- 项目：**智享全链管理系统**（白酒行业进销存 SaaS）
- 仓库：`wen-868/wen-ssystem`
- 后端：`/workspace/backend` — Express + TS + mock-db
- 前端：`admin-web`, `merchant-mobile`, `saas-admin`（都在 `/workspace/` 下）
- 测试：Vitest + supertest，mock-db 模拟数据库
- 架构：Routes → Services（含 ServiceContext: tenantId, userId, username, storeId）→ DAOs

---

## 我踩过的坑（每次都要记住）

### 1. mock-db 参数索引
- SQL 里的字面量（`'DRAFT'`、`0`）**不算参数**，参数索引会偏移
- tenant_id 在不同 INSERT 里位置不同，**永远取 `params[params.length - 1]`**
- 供应商 INSERT 之前漏了 tenant_id 字段，已修复

### 2. 测试环境限流
- `server.ts` 里必须 `if (process.env.NODE_ENV !== "test")` 包裹 rateLimit
- 否则并发请求触发 429，测试大面积失败
- 每次合并远程代码都要检查这个有没有被覆盖

### 3. vitest ≠ jest
- `jest.fn` 不存在，用 `import { vi } from "vitest"`
- 测试文件里如果有 `jest.fn` 会直接报 "no tests"

### 4. 字段命名蛇皮骆驼混用
- 采购订单创建：camelCase 请求 → 返回 `purchaseNo`（注意是 camelCase!）
- 采购入库/退货：snake_case 请求 → 返回 `stock_no`, `return_no`
- 客户付款：返回 `receipt_no`（不是 `payment_no`）
- 销售退货状态：返回 `return_status`（不是 `returnStatus`）
- 写测试前先用 `npx vitest run -t "xxx"` 跑一个看看实际返回什么

### 5. 退款方式
- 只支持 `CASH`, `WECHAT`, `BANK`
- `ALIPAY` 会报 400

### 6. 分支合并
- main 和 trae 分支历史独立，必须 `--allow-unrelated-histories`
- 冲突用 `-X theirs` 以 trae 分支为准
- 合并后必须跑全量测试，限流和 auth 两个点必被覆盖

### 7. queryWithTenant 的 mock 过滤
- 生产环境通过 SQL 注入 tenant_id 条件
- 测试环境需要手动 `result.filter(row => row.tenant_id === tenantId)`
- 如果租户隔离测试失败，优先检查这个

### 8. 测试污染
- mock-db 状态跨测试持久化，`resetMockDb()` 只在 `beforeAll` 调用一次
- 测试跑不过时，先单独跑那个测试看是不是污染问题
- 如果是污染，改测试顺序或者在 `beforeEach` 里重置

---

## 我的工作习惯

- 先读代码再改，不猜
- 改完立刻跑测试验证
- 测试通过立刻提交 push
- 同时改多个文件时用并行工具调用
- 发现问题不只修表面，追根因
- **每次踩坑或学到新东西，必须立刻更新这个文件，不然下次我就忘了**

---

## 常用命令

```bash
cd /workspace/backend && npx vitest run                          # 全量
npx vitest run src/__tests__/phase1-phase2-integration.test.ts   # 集成
npx vitest run src/__tests__/e2e.test.ts                         # E2E
npx vitest run -t "关键词"                                        # 单个
git add -A && git commit -m "..." && git push origin main        # 提交推送
```