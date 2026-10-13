# 【派单 S3-191】构建产物里的动态 import() 漏补扩展名（生产 500）＋ 7 个非法编码文件复核

- 派单人：**凌舟（总负责人）｜2026-10-14**（本单是 S3-188 的**重派**：原单执行方零产出）
- 执行方：**阿坚（后端 / 构建脚本）**
- 工作区：从 origin/main 起**新工作树**，分支 fix/s3-191-dynamic-import-esm
- 依据：收口总清单第 **19、20** 项

> ⚠️ **你不是凌舟。** 不得写任何「凌舟裁定 / 验收结论」；只动自己的工作树与本分支；不得 push、不得开 PR。
> 完成后写 docs/tasks/inbox/ACTIVE-回执-S3-191.md，把本卡移入 docs/tasks/inbox/archive/，最终回答给结论摘要。

---

## 一、第 19 项（成立，凌舟已复验）

- scripts/fix-esm-extensions.js **只给静态 from "..." 补 .js**，**不处理动态 await import("...")**（rg -n 'import\(' scripts/fix-esm-extensions.js ⇒ **0 命中**）。
- 后果已实测：backend/dist/controllers/miniapp/miniapp.controller.js 保留 `await import("../../services/wechat-pay.service")`（无扩展名）⇒ 运行期 `Cannot find module` ⇒ `POST /api/miniapp/pay/notify` **500**。
- **影响面可能覆盖全部编译产物里的动态相对导入（含生产）**，不只这一个端点。

### 要求

1. 先**枚举**：把 backend/dist/** 里所有「动态相对 import 且不带扩展名」的处数列出来（给命令与原始输出），按**文件 + 行 + 原字面量**记账；同时给出源码侧（backend/src/**）同形写法清单。
2. 改 scripts/fix-esm-extensions.js：让它**同样处理动态 import()**（静态与动态两条路都补 .js；不要误伤包名导入、绝对路径、node: 前缀）。
3. 重新构建后复测：产物里「无扩展名的动态相对 import」必须为 **0**。
4. **运行期实证**：用真实产物启动（可 USE_MOCK_DB=true），打 `POST /api/miniapp/pay/notify` ⇒ **不再是 500**（给原始响应；若是支付回调签名校验类失败，用 4xx 且**不是** Cannot find module 证明即可）。

## 二、第 20 项（7 个「非法编码」文件）

清单：payment / alert / customer-merge / export / miniapp-order-sync / stock-check / sys-config（原报告称含 GBK 混编注释、工具读不了）。

### 要求

1. **逐个复核**是否真存在非法编码（凌舟此前量过 7 个全为 0 命中，需独立确认）：给逐文件判定 + 证据（按 UTF-8 解码是否报错、是否含替换字符、git ls-files --eol 行尾）。
2. 若**确无**问题 ⇒ 在本单回执里逐条写明"不成立"并给证据，**不要为凑数去改**。
3. 若**确有** ⇒ 只做**编码归一为 UTF-8**、内容语义一字不动，并给「改前/改后字节 diff 规模 + 逐文件 sha256」。

## 三、验收判据（每条给原始输出）

1. 产物内无扩展名动态相对 import = **0**（命令 + 输出）。
2. `POST /api/miniapp/pay/notify` 运行期实测不再 Cannot find module（原始响应体）。
3. 第 20 项逐文件**判定表**（成立/不成立 + 证据）。
4. 门禁：npx vitest run（全量）**0 failed**、npx tsc --noEmit **EXIT=0**、npm run build **EXIT=0**、guard-route-auth / guard-tenant-status / guard-route-prefix **EXIT=0**。

## 四、反测（缺一不可）

把 scripts/fix-esm-extensions.js 的**动态分支**复原（即不处理 import()）⇒ 产物里**重现**无扩展名动态 import，且 pay/notify 回到 500 / Cannot find module（红）；复原脚本 ⇒ 绿。

## 五、红线

1. 只修有问题的地方，禁止顺手重构、禁止改无关文件；**不得改业务逻辑**（本单只动构建脚本 + 必要时的编码归一）；
2. 不得用"看起来没问题"代替数字证据；不得把"登记"当"已修复"；
3. 生产库**零写操作**；
4. 删工作树前先 `cmd /c rmdir node_modules`（**不带 /s**）摘 junction。
