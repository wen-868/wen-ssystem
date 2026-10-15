# 【派单 S3-192】租户状态值域收敛：两处越界写入（EXPIRED / SUSPENDED）＋ 存量订正

- 派单人：**凌舟（总负责人）｜2026-10-14**
- 执行方：**阿坚（后端）**
- 工作区：从 origin/main 起**新工作树**，分支 fix/s3-192-tenant-status-domain
- 依据：收口总清单第 **59** 项（G2 门禁新暴露）

> ⚠️ **你不是凌舟。** 不得写任何「凌舟裁定 / 验收结论」；只动自己的工作树与本分支；不得 push、不得开 PR。
> 完成后写 docs/tasks/inbox/ACTIVE-回执-S3-192.md，把本卡移入 docs/tasks/inbox/archive/，最终回答给结论摘要。

---

## 一、凌舟已定的口径（**照此执行，不要另行设计**）

**t_tenant.status 的唯一可写值域 = ACTIVE / DISABLED。**

「到期停用」「被暂停」是**原因**，不是状态：用既有列 suspend_reason + suspended_at 表达，status 一律落 DISABLED。

理由：G2 的规范口径（S3-150 / 197 收敛）就是这两个值；再加第三个值会让**所有既有读侧过滤失效** —— 这正是本项缺陷本身（读侧按 DISABLED / 0 过滤时认不出 EXPIRED / SUSPENDED，到期停用或被暂停的租户可能仍以「在用」面貌出现在列表与鉴权判断里）。

## 二、要改的两处（凌舟已定位）

1. backend/src/services/subscription-expiry.service.ts:93
   现：`UPDATE t_tenant SET status = 'EXPIRED', suspend_reason = '订阅已到期', suspended_at = NOW() WHERE id = ? AND status = 'ACTIVE'`
   改为：status 落 **'DISABLED'**，其余（suspend_reason / suspended_at / WHERE … status = 'ACTIVE'）不变。
2. backend/src/services/saas/tenant.service.ts:265
   现：`if (body.status === "SUSPENDED") { … params.push(body.status, …) }` ⇒ 把非法值直接写进库。
   改为**二选一并在回执里说明选了哪个**：

   - (a) 把入参 SUSPENDED 归一为 DISABLED 落库（对外语义保持"暂停"）；
   - (b) 直接 **400 拒绝**非 ACTIVE / DISABLED 的入参（与 S3-150「非法状态值直接 400、不静默写脏数据」的既有口径一致）。

   **凌舟倾向 (b)**（拒绝比静默改写更不会掩盖调用方错误）；若你选 (a) 需给出"为什么不能让调用方知道"的理由。

## 三、还要做的三件事

1. **收编进 G2 域**：改完后这两个文件不再出现越界字面量 ⇒ 把它们从 backend/scripts/guard-tenant-status.mjs 的**登记豁免**里**移出**，让 R1 真正覆盖（若移出后门禁红，说明还有别的越界点，逐一处理，**不要退回豁免**）。
2. **存量数据订正迁移**：新增 docs/migrations/&lt;下一个序号&gt;_租户状态值域收敛.sql（序号取当时最大 +1，**先 rg 确认**），两件事，且**幂等**（用信息架构守卫 / WHERE 守卫，写法参照仓内 081 / 196）：

   - 把 status IN ('EXPIRED','SUSPENDED') 的行订正为 status='DISABLED' 且 suspend_reason 用 COALESCE 保留原值；
   - 给出订正**前后行数**的只读 SQL（执行前 SELECT COUNT(*)，执行后应为 0）。
3. **用例护栏**：新增单测钉死 —— ① 订阅到期后 t_tenant.status 落 DISABLED 且 suspend_reason 有值；② 非法入参不会写进库（按 §二 选的口径断言 400 或落 DISABLED）。

## 四、验收判据（原始输出）

1. 两处改动后的代码片段 + `rg -n "'EXPIRED'|'SUSPENDED'" backend/src` 的**全文命中清单**（应只剩枚举定义 / 映射函数 / 明确的只读分支 —— 逐条说明为何保留）。
2. 存量订正迁移：在**本机私有副本库**跑一遍，给「订正前计数 → 订正后计数 = 0」，并证明**第二遍跑零变更**（幂等）。
3. 用例护栏通过（vitest 原始输出）。
4. 门禁：npx vitest run **0 failed**、npx tsc --noEmit **0**、guard-tenant-status / guard-route-auth / guard-route-prefix **EXIT=0**、npm run build **EXIT=0**。

## 五、反测（缺一不可）

- 把 subscription-expiry.service.ts 改回写 'EXPIRED' ⇒ guard-tenant-status **必须红**（证明收编真的生效，不是靠豁免）；复原 ⇒ 绿。
- 把订正迁移的 WHERE 去掉 ⇒ 第二遍跑产生**非零变更**（红）；复原 ⇒ 幂等（绿）。

## 六、红线

1. 只修有问题的地方，禁止顺手重构、禁止改无关文件；
2. **不得**改 .github/**、deploy/**、R101-收口总清单.md；
3. 不得用"登记/注释"当"已修复"；不得用放宽门禁换绿；
4. 生产库**零写操作**（本单全程本机库）；
5. 删工作树前先 `cmd /c rmdir node_modules`（不带 /s）。

## 七、环境

本机私有 MariaDB 11.4.5：`D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin\mysqld.exe --datadir=<自建> --port=3406 --skip-grant-tables --skip-ssl`；迁移可复用 docs/evidence/S3-186/harness/run-case.ps1（DB_PORT=3406 / DB_USER=root / DB_PASSWORD=""）。
