# 派单 · S3-177-F1（P0 收口）：把被 CSRF 契约变化打红的两份 wiring 测试补上 CSRF 头

- 派单人：**凌舟（总负责人）｜2026-10-10**
- 执行人：**阿坚（后端）**
- 工作区：`D:\Users\ZXQL\wt-agents\issue-278`（分支 `agent/issue-278`，**PR #280 已开、待修**）
- 触发：PR #280 的 required 检查 **`build-and-test` 失败**（run 37981516536，job 113992944652，"Backend unit tests"）

---

## 一、现象（CI 原始输出，非推断）

```
FAIL src/__tests__/routes/rbac-g0-wiring.test.ts:519  expected 403 to be 200
FAIL src/__tests__/routes/rbac-g1-wiring.test.ts:513  expected 'CSRF token 无效或缺失'
                                                       to be '无权限执行此操作，需要权限: finance:create'
FAIL src/__tests__/routes/rbac-g1-wiring.test.ts:528  expected 403 to be 200（多处）
```

## 二、根因（已定，不要改成改产品）

1. PR #280 给 `payment` / `aftersale` / `miniapp` 三个 `auth:"none"` 文件的写端点补了 **端点级** `csrfMiddleware`（`requireAuthWithTenant → csrfMiddleware → requirePermission/handler`）。
2. 这两份 wiring 测试用 `rawMount=true` 模拟 `auth:"none"` 文件（该分支**不发** `x-csrf-token`），于是新挂的 `csrfMiddleware` 先于 `requirePermission` 命中 ⇒ 403 变成 "CSRF token 无效或缺失"、"有权角色" 用例也变成 403。
3. **产品侧顺序是对的，不要动**：`rbac-g0-wiring.test.ts:368` 注释已写明本项目的挂载层契约是「**csrf 先于路由匹配**（踩坑[34]）」⇒ 端点级 `csrf → requirePermission` 与挂载层语义一致。**禁止**把 `csrfMiddleware` 挪到 `requirePermission` 之后来"让测试变绿"（那等于用测试反向削弱契约）。

## 三、交付物

| # | 文件 | 要做什么 |
|:--:|:--|:--|
| ① | `backend/src/__tests__/routes/rbac-g0-wiring.test.ts` | 让 `rawMount=true`（`auth:"none"`）的请求也带上有效 `x-csrf-token`（该文件已 `import { generateCsrfToken }`，用 `generateCsrfToken(uid)`，uid 与注入的登录态一致） |
| ② | `backend/src/__tests__/routes/rbac-g1-wiring.test.ts` | 同上 |
| ③ | 两文件内**新增/更新注释** | 写明「为什么 rawMount 现在也要发 CSRF」：S3-177 给这 3 个文件的写端点补了端点级 csrfMiddleware；契约与挂载层一致（csrf 先于路由匹配） |

## 四、验收标准

1. `cd backend && npx vitest run` —— **全量通过**（`0 failed`），原始输出随回传卡给出；至少点名 `rbac-g0-wiring` / `rbac-g1-wiring` 两个文件全绿。
2. **反测**：把 ①② 里补的 `x-csrf-token` 去掉 ⇒ 这两份用例**必须再红**（证明是"契约变化"而非"测试被改成恒绿"），复原 ⇒ 全绿。
3. `npx tsc -p tsconfig.json --noEmit` EXIT=0。
4. **不得**改动 `payment/aftersale/miniapp` 三个路由文件的中间件顺序；**不得**改产品代码（本单只允许改这 2 个测试文件）。

## 五、红线

1. 只改上述 2 个测试文件（+ 回传卡）；不得顺手重构、不得碰其它文件。
2. 把修复**追加提交到同一分支 `agent/issue-278`** 并推送（PR #280 会自动更新）；不要另开分支/PR。
3. 不得 `--no-verify`、不得改 CI 配置、不得改 `guard-route-auth.mjs`。
4. 不得把"能跑通"当证据；必须给命令 + 原始输出。

## 六、回传格式（照抄）

```
【汇报 S3-177-F1】<一句话结论>
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端）｜2026-10-10
一、交付物（文件 + 关键行号）
二、证据（vitest 全量原始输出：Test Files / Tests 计数）
三、反测（去掉 x-csrf-token ⇒ 红；复原 ⇒ 绿，两侧原始输出）
四、验收自评（对照 §四 四条）
五、未完成与阻塞
六、风险与自我报备
七、关联卡：docs/tasks/cards/R101-S3-177-阿坚回传.md
```

回传卡落 `docs/tasks/cards/R101-S3-177-F1-阿坚回传.md`（工作区内），并推送到同一分支。
