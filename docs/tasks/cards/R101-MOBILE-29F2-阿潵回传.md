# 【汇报 MOBILE-29F2】冒烟环境清理与安全头防夹带 —— 六条硬验收全过

```
【汇报 MOBILE-29F2】冒烟环境清理与安全头防夹带
汇报对象：凌舟（总负责人）
汇报人：阿潵（移动端负责人）｜2026-10-24
执行通道：WorkBuddy
交付物：
  ① 清理 29F1 冒烟遗留的**工作树根** `.env.local`（`VITE_API_BASE=http://127.0.0.1:5199/api`，
     被根 .gitignore 忽略 ⇒ git status 假净）；现两棵树（MOBILE-29F1 / MOBILE-29F2）的
     根与 app-mobile 下均只剩仓库自带 `.env.example`，`127.0.0.1:5199` 命中 0，端口 5199 已释放；
  ② docs/evidence/mobile-29f2/smoke/run-smoke.mjs：env 处理改为**双文件快照/恢复**
     （工作树根 + app-mobile 两处 `.env.local`），并经 process.on('exit') + SIGINT/SIGTERM
     钩子兜底 ⇒ **异常退出也清理**（29F1 只靠 finally 分支，被中断即残留）；
     同文件新增 pageerror **分类裁决**（已知具名可豁免、未知判红并留全字段原文）；
  ③ app-mobile/src/api/request.ts：`buildSecureHeaders(extra)` 增加剥离循环，
     移除任意大小写形式的 Content-Type（凌舟验收阻断项 3.2）；
  ④ app-mobile/tests/request-contract.spec.ts：新增用例 ㉗（逐形态真实传入
     Content-Type / content-type / CONTENT-TYPE / CoNtEnT-TyPe，断言产物不含该键，
     且非 Content-Type 的 extra 与安全三头仍在）⇒ 用例 25 → 26；
  ⑤ app-mobile/scripts/gates-baseline.json：tests 段 16/328 → 16/329（实测即基线）；
  ⑥ 证据树 docs/evidence/mobile-29f2/**（不覆盖 29F1 原始证据，脚手架全留档）；
  ⑦ 本回传卡 docs/tasks/cards/R101-MOBILE-29F2-阿潵回传.md。
证据（可复跑）：
  ① 五门链 EXIT=0 —— raw/22-gates-chain-run5-all-green.log：type-check EXIT=0 /
     lint EXIT=0（error 0、warning 12872 未劣化）/ test EXIT=0（**16 文件 329 用例全过**）/
     check:contract EXIT=0 / guard:request EXIT=0；FINAL_EXIT=0。
     环境留痕：本机为多会话并发环境（8 核，空闲内存一度低至 ~1GB），vitest 默认 5s 超时
     在**链式串跑**下会被 import/计算密集用例击穿（超时续体不取消 ⇒ 污染后续用例 stub 计数），
     前四次链在 test 段分别红 4/9/9/4 例（raw/20、raw/21）；单独跑门 3 连续三次
     **329/329 全绿**（raw/12），第五次链在资源窗口内取得全绿。未为转绿放宽任何断言、
     未加 it.skip、未改超时配置。
  ② 三端构建 EXIT=0 —— raw/30-build-h5.log、raw/31-build-mp-weixin.log、
     raw/32-build-app.log 均 `DONE Build complete.` + `*_EXIT=0`。
  ③ 双 cwd spec 全绿 —— 从工作树根（`node node_modules/vitest/vitest.mjs run
     app-mobile/tests/request-contract.spec.ts`，带与不带 --root 两种）与从 app-mobile cwd
     各跑一次，**均 26/26 通过**。
  ④ 反测 R1（源码面，anti/）：摘掉剥离循环 ⇒ **㉗ 红并点名**，而 ㉑㉒㉓㉔ 仍绿
     （实证凌舟指出的 ㉒ 覆盖缺口：㉒ 标题声称「调用方塞 Content-Type 也不该出现」但
     用例体从未真传该键）；复原 SHA256 恒等
     （c132b8c530deb7b25f20c6f6b2536f50717e4f671e9b6a15e5fbe6d7581e64c2，前后一致）后 26/26 绿。
  ⑤ 反测 R2（环境面，anti/）：写入根 `.env.local`（5199 冒烟地址）⇒ 从仓库根跑 spec
     **EXIT=1 假红复现**（输出中 5199 命中 4 次）；删除后 **EXIT=0** ⇒ 交付态卫生判据有效。
  ⑥ 真实 H5 冒烟 EXIT=0 —— smoke/results.json **18/18 断言全过**：avatar/image 两条记录
     Content-Type 均为浏览器自生成 multipart 且 boundary 在场、multer 零错误、req.file 非空
     （字段名/70B 逐字节一致/image-png）、页面内返回解析成功；外加本单新增三条
     （无未知 pageerror、两处 .env.local 无残留、5199 端口已释放）。
  ⑦ pageerror 反测 —— raw/51-smoke-anti-unknown-pageerror.log：
     `SMOKE_INJECT_PAGEERROR=anti-unknown-marker-29f2 node run-smoke.mjs` ⇒ **EXIT=1**
     并留全字段原文（含 stack）⇒ 未知 pageerror 必红的裁决有效。
提交拓扑：57079530（基线）→ b6ae10d7（实现，3 文件 36+/4-）→ 7e703c43（证据树，36 文件）→ 本回传卡。
验收自评（对照派单硬验收 6 条）：
  1. 通过 —— 两棵树根与 app-mobile 下均无 .env.local；`.env*` 中 127.0.0.1:5199 命中 0；
     端口 5199 已释放。
  2. 通过 —— 从仓库根（两种写法）与从 app-mobile cwd 各跑上传 spec，均 26/26 全绿；
     反测 R2 证明残留 env 会假红、清理后复绿。
  3. 通过 —— check:gates EXIT=0（16/329）；tests 只升不降（328→329，+1 全为新增用例 ㉗）。
  4. 通过 —— 三端构建 EXIT=0；真实 H5 冒烟 18/18 EXIT=0（含 15 条原有上传断言）。
  5. 通过 —— 注入未知 pageerror ⇒ 冒烟 EXIT=1 并留原文；已知噪声带具名豁免通过
     （见风险报备②）。
  6. 通过 —— 工作树 clean、未 push、未开 PR、逐文件 add。
未完成与阻塞：无
风险与自我报备：
  ① **29F1 的交付卫生失误（本次已修，但须记档）**：29F1 首轮冒烟因路径 bug 把
     `.env.local` 写到了**工作树根**，随后我手动清理时只删了 docs/ 与 app-mobile/ 两处，
     **漏了根**；29F1 回传卡里「.env.local cleaned by teardown」的自述与实测不符
     （当时 git status 因 .gitignore 呈假净）。本单已删除该残留，并把 runner 的 env 处理
     改为「双文件快照 + exit/信号兜底」，不再依赖 teardown 分支被执行。
  ② **pageerror 白名单新增一条（须凌舟裁定）**：29F1 时报的 `pageerror: Object` 经本单
     全字段取证实为 **Playwright 工具侧空壳错误**
     （`{"name":"","ctor":"PlaywrightError","keys":["log","name"],"inspect":"[Object] { log: [] }","stack":""}`），
     并非 `hideTabBar:fail not TabBar page`（console 侧亦无 hideTabBar 线索）。我按
     「具名 + 紧判据」把它列为第二条豁免：**仅当 ctor=PlaywrightError 且 name/stack 为空
     且 log 为空数组**才豁免；反测⑦已证明带 message/stack 的错误仍判红。若凌舟认为
     不该豁免此类，我可改为判红（代价：冒烟恒 EXIT=1，需另寻消除该空壳的办法）。
  ③ 门禁链的环境 flaky 未消除（根因在本机多会话并发资源，非代码）：前四次链 test 段红
     4/9/9/4 例，第五次全绿；判定依据为「单独跑稳定绿 + 失败全为 5s 超时（非断言失败）
     + 失败集合固定在 import/计算密集用例」。未放宽任何门禁参数。
  ④ 本单零业务改动：未动后端上传路由、未动 multipart/boundary/业务码/CSRF 断言、
     未顺手重构其它 API；新增用例只增不删、未放宽既有断言。
回传要求：本汇报已落卡 docs/tasks/cards/R101-MOBILE-29F2-阿潵回传.md
关联卡：docs/tasks/inbox/MOBILE-29F2-smoke-cleanup-header-hardening.md
```

---

## 附：本单改动面速查（供验收抽看）

| 文件 | 改动 | 关键位置 |
|---|---|---|
| app-mobile/src/api/request.ts | `buildSecureHeaders` 剥离任意大小写 Content-Type | 124–135（含 4 行说明注释 + 3 行剥离循环） |
| app-mobile/tests/request-contract.spec.ts | 新增用例 ㉗ + 文件头覆盖说明 | 285–305 |
| app-mobile/scripts/gates-baseline.json | tests 段 16/328 → 16/329 + note 追加 | tests.testCount |
| docs/evidence/mobile-29f2/smoke/run-smoke.mjs | 双 env 快照/恢复 + exit 兜底；pageerror 取证与分类裁决；反测注入口 | 全文 |

未改动：products.ts / profile.ts / ai.ts / update.ts / guard 脚本（29F1 已定型的面保持原样）。
