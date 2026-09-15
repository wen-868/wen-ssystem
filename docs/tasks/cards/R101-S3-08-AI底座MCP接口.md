# 任务卡 R101-S3-08 · AI 底座 MCP 接口

> 项目：智享全链 · 总后台 UI 设计稿 v1.6 对齐改造｜所属步骤：第 3 步 补齐缺失功能
> 执行方：林夕（UI/UX 设计），暂代阿坚（用户 2026-09-13 指定）｜优先级：P2｜预估：3 天｜状态：待开始
> 前置依赖：对应 S1 界面完成、S2 契约文档更新

> ## ⚠️ 执行仓库：`D:\Users\ZXQL\ZXQL-AI`（`wen-868/ZXQL-AI`）—— **不是 wen-ssystem**
>
> **2026-09-16 凌舟裁定（S3-36）**：AI 底座的权威源码在 ZXQL-AI，生产检出为 `/opt/zhixiang/ai-base`。
> 原因：2026-09-16 的 listen 收敛改动误落在 `wen-ssystem/backend/ai-base`
> （无 `.git` 的非部署旧分叉，提交 `828ea48f`），**改了不生效**，只得在权威仓库重做（`8884b8c`）。
> **该副本目录已于同日物理删除**（源码归档在仓库外 `D:/Users/ZXQL/ZXQL-MS/ai-base-fork-archive-20260916`），
> 因此本卡中若仍见该路径引用，一律视为**已失效**。
>
> 本卡所有"涉及文件"**均为 ZXQL-AI 仓库内路径**；前端若需新增 MCP 配置界面，
> 另在 wen-ssystem 单独提交，但**底座代码一律在 ZXQL-AI**。

## 一、开工前必读（逐份读完再动手，禁止跳读）

1. `docs/项目规则.md`
2. `docs/项目统一标准.md`
3. `docs/tasks/current-tasks.md`
4. `docs/总后台UI设计稿v1.5-改造方案.md`
5. `docs/智享全链_总后台UI设计稿_v1.6.html`
6. `docs/智享全链_总后台建设规划_v1.3.html`
7. `docs/踩坑日志.md`

重点章节：改造方案 §11「页面级实施对照表」中 R101-S3-08 对应行、§10.3「后台可配置项总表」。

## 二、任务目标（本次交付物）

- 引入 MCP SDK
- ToolRegistry 暴露为 MCP Tools（端点 /api/platform/ai/mcp，HTTP/SSE）
- 认证与租户映射（AppKey + 租户上下文）
- 工具白名单与调用审计

## 三、设计要求（设计稿 v1.6 逐页要点，逐项落实）

按设计文档 §14 实现 AI 底座 MCP Server：端点 /api/platform/ai/mcp（MCP over HTTP/SSE）；ToolRegistry 全部工具暴露为 MCP Tools；认证与租户映射（AppKey + 租户上下文）；工具白名单与调用审计；任意 MCP 客户端零定制接入验证。

## 四、涉及文件（**均为 ZXQL-AI 仓库内路径**）

- `src/mcp/*`（新增 MCP 模块：Server / Tools 暴露 / 认证与租户映射 / 工具白名单与调用审计）
- `src/tools/*`（ToolRegistry，改造为同时暴露为 MCP Tools）
- `migrations/*.sql`（**ZXQL-AI 仓库根目录**，不是 `wen-ssystem/docs/migrations`）
- ZXQL-AI 仓库内对应的 `*.spec.ts`

⚠️ 禁止写入以下位置（均不生效）：
`wen-ssystem/backend/src/services/platform/*`、`wen-ssystem/backend/ai-base/src/*`。

仅允许改动以上文件及为实现本卡目标必须新增的文件；不得顺手改动其他模块。

## 五、验收标准

- [ ] 任意 MCP 客户端 tools/list 成功
- [ ] 至少 1 个工具调用成功

统一门禁（凌舟复核时逐条核对）：
- [ ] **ZXQL-AI 仓库**：build exit 0 且全量测试全绿（该仓库基线见其提交记录，如 103 套件 986 用例）
- [ ] wen-ssystem（**仅当本卡同时改了前端**）：`backend` build 与 `saas-admin` build 均 exit 0
- [ ] ZXQL-AI 新增迁移须幂等，并登记该仓库的迁移账本 / 变更记录
- [ ] 页面区块/列名/按钮/弹窗与设计稿 §11 对照表逐项一致
- [ ] 关键操作具备二次确认与留痕
- [ ] 跨租户越权测试通过

## 六、硬性约束（违反即退回）

- **最小改动**：只改有问题的地方，禁止顺手重构、禁止扩大范围
- **数据真实性**：第 1 步允许空态，禁止模拟数据；第 2 步起全部真实接口
- **配置项界面化**：设计稿中的比例/汇率/阈值/开关一律做成后台配置界面，不写死默认值；未配置按设计稿置灰阻断
- **三不边界**：严守三不边界（不改业务数据/不看业务明细/不干预租户内部权限）
- **数据库变更**：新增表必须先写迁移脚本并登记 docs/数据库变更清单.md
- **API 契约**：新接口必须先更新 docs/API接口文档.md 契约
- **提交规范**：提交信息格式 type: 中文描述；只推 main 分支

## 七、完成后请输出

1. 交付说明：改了什么、每项对应本卡第几节；
2. 逐条证据：build / tsc / vitest 输出、页面截图或接口返回；
3. 阻塞点：做不了的部分写清原因与所需支持，不要用占位或假数据掩盖。
