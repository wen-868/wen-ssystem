# R101-S3-205-阿坚-回传（脚本与门禁小单打包：第 23 ＋ 26 ＋ 68 项）

> 对应派单卡：`docs/tasks/inbox/archive/ACTIVE-S3-205-20261015.md`（原件 `docs/tasks/inbox/ACTIVE-S3-205.md`）
> 工作区：`D:\Users\ZXQL\wt-agents\S3-205`｜分支 `chore/s3-205-script-hygiene`｜基线 `origin/main` = `36a7a02f`
> 证据包：`docs/evidence/S3-205/`（README ＋ 枚举/判定 2 篇 ＋ 全部原始日志 ＋ `04-full.diff`）

```
【汇报 S3-205】对应派单 S3-205：第 23 / 26 / 68 三项已交付；`guard-rbac-wiring --strict` EXIT=0 是**真收口**
（39 条由「欠账待接线」改判为「消费者端保护形态」，守恒 680 = 641 + 39，一条未洗白）；全量 663 文件 /
7995 用例 0 失败；tsc / 三条 guard / `--strict` / backend build 全部 EXIT=0。**未提交、未 push、未开 PR**。

汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 / 脚本）｜2026-10-15

一、交付物（文件 + 关键行号 + 改动性质；全部在工作树，未提交）
  ① scripts/acceptance-all-domains.mjs（+57 / −26）——第 23 项：13 处默认凭据/地址全量去默认
  ② scripts/acceptance-production.mjs（+33 / −5）——第 23 项：4 处 `|| "默认值"` 回落分支全删
  ③ backend/scripts/guard-rbac-wiring.mjs（+100 / −22）——第 68 项：新增第三类 `consumer` 形态
     （新增 `CONSUMER_AUTH_CALL_RE` / `isConsumerProtectedCall`；`scanFile` 由二分改三分并输出 `authForm`）
  ④ backend/scripts/rbac-wiring-baseline.json（gaps 680→641 条；新增 `consumerEnd` 39 条 / 4 文件；
     新增 `_endpointClass` 语义说明；`_counts` 同步 155 / 641 / 4 / 39）
  ⑤ docs/tasks/R101-RBAC接线缺口清单.md（+126 / −6）——§三.15 `marketing-miniapp` 表**就地更正**
     （按端点路径匹配、补 `文件:行`=61/78/86/90）；文件尾新增 §十（判定/判据/影响面 39 条/守恒/反测/报备）
  ⑥ 第 26 项产品代码 6 文件：`services/admin/sys-user.service.ts`（L155/263）、
     `services/admin/employee.service.ts`（L134/135）、`services/platform/admin-account.service.ts`（L150/283）、
     `services/platform-tenant.service.ts`（L153）、`services/platform/tenant-admin.service.ts`（L300）、
     `shared/migration.ts`（L741/1178/1217）——共 11 处口令写入统一走 `shared/password.ts`
  ⑦ 第 26 项连带测试 3 文件：`__tests__/shared/migration.test.ts`（分辨断言）、
     `__tests__/services/platform/admin-account-c6.service.test.ts`（裸 bcrypt → verifyPasswordSync）、
     `__tests__/services/admin/employee.service.test.ts`（mock 入口改 hashPassword）
  ⑧ 证据包 docs/evidence/S3-205/**（含 `04-full.diff`，63991 字节）

二、证据（可复跑；原始输出全部落盘）
  第 23 项（两侧反测）：
    不设 env ⇒ `node scripts/acceptance-production.mjs` 打印
      「[验收·生产] 缺少必需环境变量 4 项：API_BASE / ADMIN_URL / ADMIN_USERNAME / ADMIN_PASSWORD | DEMO_PASSWORD」EXIT=1；
      `acceptance-all-domains.mjs` 同形报 7 项 EXIT=1（`logs/02-item23-*-noenv.log`，缺项提示计数 1 / 1）
    设齐 env（本地死端口 127.0.0.1:45999 假值）⇒ 缺项提示计数 **0 / 0**，失败原因变为网络层
      （`ECONNREFUSED 127.0.0.1:45999` / 阶段 1 起 `fetch failed`）⇒ 证明已越过 env 闸门且**无内置默认值参与**
      （`logs/02-item23-*-withenv.log`）
    收口核对：`rg 'admin@2026|Demo@2026|admin123' scripts/acceptance-*.mjs` ⇒ **0 命中**（零内置口令）
  第 26 项：`logs/03-item26-targeted-run1.log` = **隐患现场**（`admin-account-c6.service.test.ts` 用裸
    `bcrypt.compareSync` 校验产品哈希 ⇒ `expected false to be true` 两条红）；修后 `…run2.log` = 12 文件 / 206 用例全绿
  第 68 项：`logs/00-baseline-rbac-strict.log`（改前 EXIT=0 / 缺口 680）、`logs/05-item68-strict-final.log`
    （改后 EXIT=0 / gaps 641 + consumerEnd 39）、反测 `logs/06-item68-neg-{A,B,C}.log`
  门禁全量：`logs/90-vitest.log`（663 / 7995 / 0 failed）、`logs/91-tsc.log`（TSC_EXIT=0）、
    `logs/92-guards.log`（三条 guard + `--strict` 全 EXIT=0）、`logs/93-build.log`（BUILD_EXIT=0）

三、反测（门禁铁律：故意制造失败，证明它会红 —— 三条全部"红 → 复原 → 绿"）
  A 摘消费者认证（`marketing-miniapp.routes.ts:61` 去掉 `requireConsumerAuthWithTenant`，CSRF 仍在）
    ⇒ `--strict` EXIT=1 并点名 `marketing-miniapp.routes.ts:61 POST /api/miniapp/marketing/coupons/:templateId/claim`；复原 EXIT=0
  B 摘 CSRF（同一条只留消费者认证）⇒ 按「必须成对」判据回落 `gaps` 且未登记 ⇒ EXIT=1；复原 EXIT=0
  C 从台账 `consumerEnd` 删掉 claim 一条 ⇒ 报「未登记（消费者端形态）」⇒ EXIT=1；复原 EXIT=0
  逐字节还原：注入前后 route SHA256 = `BB9F43AA…E590EB`、baseline SHA256 = `60CAD6A2…E11347`（一致）；
    `git diff --name-only -- backend/src/routes/` 无输出
  分辨力（非恒绿）：同批输出里 `gaps` 仍如实报 641 条（含 `wechat.routes.ts` 5 条），消费者端识别未吞掉其它缺口

四、验收自评（逐条对照派单卡 §四）
  ✅ 1. 三项各有原始输出：第 23 项两侧反测齐全；第 26 项「扫描清单 + 逐条判定」见 `docs/evidence/S3-205/03-*.md`
       （A 类产品代码口令写入 11 处、B 类密钥族 4 处、C 类校验侧 0 处、D 类测试夹具逐条注明理由）；
       第 68 项含 `--strict` 由红转绿的完整过程（改前 680 条已登记/EXIT=0 的**前提核对** → 改后三分）
  ✅ 2. `npx vitest run` 663 文件 / 7995 用例 **0 failed**（尾部原始输出在 `logs/90-vitest.log`）；
       `npx tsc -p tsconfig.json --noEmit` **0**；三条 guard ＋ `--strict` **EXIT=0**；
       `npm --workspace backend run build` **EXIT=0**
  ✅ 3. 第 68 项**不需要**生产权限事实 ⇒ 未读取生产库、未停机；理由：判据是「消费者身份 ⇒ `roles` 恒空 ⇒
       商家权限码必然不命中」，与生产库里商家角色持有什么无关（`--holders` 只对商家角色有意义）

五、未完成与阻塞
  无。三项均已完成并各自留下两侧证据。**待你裁定/知晓 4 条**（不阻塞交付，但影响后续口径）：
  ① 第 26 项为统一口径，动了 **3 处既有测试断言**（其中 `migration.test.ts` 的"按 cost 分辨步骤"因口径统一失效，
     改为按参数形态分辨并**新增** `expect(rounds).toBe(12)`）——请确认是否认可；如需回退，我按你的口径返工。
  ② 第 68 项的门禁子类我加了**「消费者端形态必须逐条登记，未登记即判红」**（卡面只说"识别为合规形态"）。
     方向是从严（防"新端点抄两个中间件就自动洗绿"），若你认为过度，可退回为"自动识别不登记"。
  ③ 影响面比你卡面写的 3 条大：同一判据下共 **39 条 / 4 文件**（营销 4 ＋ 小程序 29 ＋ 售后 4 ＋ 通知 2）。
     我按"同缺陷全量扫影响面并给数字"处理，未逐条请示；如你只想动营销那 3 条，请告知，我改回窄口径。
  ④ 第 23 项我保留了旧 env 名 `DEMO_PASSWORD`（作 `ADMIN_PASSWORD` 的等价别名，二者都缺才 exit 1），
     理由是"名字沿用脚本既有约定"；若你要求只认单名，我删别名。

六、风险与自我报备
  1. **卡面前提与实测不一致（已按"先核前提"处理，未停工）**：卡面写"当前 `--strict` EXIT=1，3 条缺口在
     `marketing-miniapp.routes.ts:55/72/80`"，实测基线 `36a7a02f` 上 `--strict` **已 EXIT=0**（680 条全登记）、
     端点真实行号为 **61/78/86/90**。原因是 S3-198（PR #316 / `790d076c`）已按"同端点改名"把新路径登记进台账
     （见 `docs/tasks/R101-RBAC接线缺口清单.md` §9.4 台账同步说明）。故本单真正的收口点是"登记改成**判据合规**"，
     我已据此执行；**若你当时的用意只是"补台账"，请裁定，我按你的口径重做**。
  2. **第 26 项我把 `shared/migration.ts` 也算进"产品代码"并改了**（3 处种子/重置口令哈希）：依据是
     `shared/seed-data.ts` 自 S3-175 起就用 `hashPasswordSync`、登录链路全走 `verifyPassword`，全仓只有
     migration 这 3 处仍产"无 `v2$` 前缀 + cost 10"哈希 ⇒ 三种口径并存。此判断有争议空间（也可视为"步骤内自有口径"），
     故显式报备；兼容性我已核过：`verifyPassword` 对两种形态都能校验，且 migration 第 4 步的
     `NOT LIKE '$2b$%' AND LENGTH=64` 筛选不会把 `v2$`（63 位）误当 SHA256。
  3. **本会话沙箱与记忆里的旧结论不符**：`spawnSync`／管道**可用**（旧会话记录为 `spawn EPERM`），
     所以 vitest / tsc / build 都是真跑，没有走替代通道；该差异本身值得记进踩坑日志（旧结论不应再当作通用前提）。
  4. **未提交、未 push、未开 PR**（按红线）。因此**没有远端 ref**；R8.2 的"验证目标 ref"对本单不适用
     （本单不是验证类派单）。产物 = 工作树未提交改动 ＋ `docs/evidence/S3-205/04-full.diff`。
  5. **我没有覆盖 `docs/tasks/inbox/ACTIVE-回执.md`**：该文件在主仓当前是"已修改未提交"状态（内含别的会话的
     回执内容），覆盖会静默丢掉别人的在途回执。本单回执写在 `ACTIVE-回执-S3-205.md`（本卡同文）。
     若你要求固定名，请在确认无并发写者后再镜像覆盖。
  6. **同单 `s3208` 的残留风险**：路由表把 S3-205 同时指给 `s3208` 与 `s3210`（我），卡面注明"换人接手、s3208 零产出"。
     我按协议把 `ACTIVE-S3-205.md` 归档；若 s3208 之后醒来，会读到"卡已归档 + 已有回执"，不会重复开工。

七、范围外发现（只记录，不代做）
  1. **硬编码弱默认口令**：`services/admin/employee.service.ts:135` 与 `services/platform/tenant-admin.service.ts:300`
     建号默认口令字面量 `"123456"`（对应红线 9"禁止硬编码敏感信息"）。本单只改了**哈希口径**，未改这个默认值
     （属产品口径，会牵动登录/培训/文档）。建议另立单：默认口令改为随机并强制首登改密。
  2. **列名疑似写错**：`services/platform/tenant-admin.service.ts:303` 的 `INSERT INTO t_sys_user (…, password, …)`
     用的是 `password` 列，同表其它写入方（`sys-user.service.ts`、`migration.ts`、`seed-data.ts`）都用 `password_hash`；
     且该文件当前**无路由注册**（测试注释已记"防复发"）。建议另立单核实是否死代码/列名漂移。
  3. **密钥族未入封装**（第 26 项 B 类）：`open-api-key` / `open-webhook` / `library` 三处 `api_secret` / `sign_secret`
     仍是裸 bcrypt（无校验点、非口令）。建议另立 `shared/secret-hash.ts` 单，不要在口令封装里混。
  4. **消费者端判据未覆盖面**：`wechat.routes.ts` 5 条写端点用 `requireWxAuth`（S3-187 E 补了 `req.user`+CSRF），
     与 `cart.routes.ts` 的**声明式** `auth = "requireConsumerAuthWithTenant"` 都**未**进新判据（故仍在 `gaps`）。
     是否并入属判据口径问题，建议另立单，不擅自放宽。
  5. **文档滞后**：`docs/reports/P1-生产证据采集手册.md:17` 记的 `node scripts/acceptance-production.mjs`
     现已需 env（否则 exit 1）。手册更新属凌舟工作文件范围，我未动。
  6. 全量跑批时 `[auto-routes][根前缀共享告警]` 报 4 个根前缀被多文件共用（`/api/admin` 19 次等），与本单无关，仅记录。

八、终态复跑与交付面清单（补记，防"读数早于产物"）
  先跑门禁、后又改了 3 个 md（缺口清单 §十 / 踩坑日志 / 我的记忆文件）⇒ 为避免"用旧读数报交付"，
  **在最终树状态上把 7 项门禁全部复跑**，读数与首轮一致：
    `logs/90-vitest-final-tree.log` 663 文件 / 7995 用例 / 0 failed（VITEST_EXIT=0）
    `logs/92-guards-final-tree.log` TSC_EXIT=0 ＋ guard-route-auth / guard-tenant-status / guard-rbac-wiring
      （报告 + `--strict`）全 EXIT=0（`gaps` 641 全部已登记、`consumerEnd` 39 全部已登记、陈旧 0）
    `logs/93-build-final-tree.log` BUILD_EXIT=0（已处理 801 个 JS 文件，修复 1897 处导入路径）
  改动面（最终）：`git diff --stat` = **16 文件 / +505 −137**（含上面三份留痕文档），另加未跟踪目录
    `docs/evidence/S3-205/**`（README ＋ `01-item23-默认值枚举.md` ＋ `03-item26-bcrypt扫描与判定.md`
    ＋ `04-full.diff` 63991 字节 ＋ `logs/` 24 份原始日志与 2 份逐字节备份）。
  已按项目规则同步更新：`docs/踩坑日志.md` 新增 **[171]**（中间件"带参调用 vs 裸引用"⇒ 判据 0 命中且假绿；
  新判据必须先测"命中几条"）、**[172]**（"沙箱跑不了"是会话级事实，须 10 秒复验）；
  `docs/memories/阿坚-记忆.md` 新增 §三十二（S3-205 全程 + 5 条技术沉淀 + 4 条待裁定 + 范围外发现）。

回传要求：本汇报已落卡：docs/tasks/cards/R101-S3-205-阿坚-回传.md
关联卡：docs/tasks/inbox/archive/ACTIVE-S3-205-20261015.md
```
