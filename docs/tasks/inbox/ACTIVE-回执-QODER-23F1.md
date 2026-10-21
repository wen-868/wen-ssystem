# ACTIVE-回执-QODER-23F1

【汇报 QODER-23F1】QODER-23F1 AES-GCM IV 与短标签边界：IV 规范长度守卫落在构造 J0 之前（crypto.ts:618），短 tag（15）/长 tag（18）/短 IV（11）/长 IV（13、17）边界补成可反测，两轮反测各摘一守卫均红且点名、SHA 恒等复绿
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-22

- 改了什么（一句话）：`app-mobile/src/utils/crypto.ts`（aesGcmDecrypt 头部 IV 守卫 + JSDoc 两行）、`app-mobile/tests/storage-crypto.spec.ts`（5→9 用例，既有 5 条逐字保留）、`app-mobile/scripts/gates-baseline.json`（tests.testCount 187→191，note 末尾追加本卡段，机检 startsWith=true）。
- 提交：基线 `2568ef03`（QODER-23 尖端实测）→ 实现提交 `bbc8aa9ec380133629733222bc766d8722d55b0a` → 文档提交见 `git log --oneline -3`（docs/evidence/qoder-23f1/raw/11）。
- 证据（可复跑）：`docs/evidence/qoder-23f1/`（raw/00~12、anti/R-IV、anti/R-TAG、probe 存档）。四门收尾 EXIT=0（11 文件/191 用例，raw/10）；build:h5/mp-weixin/app 均 EXIT=0（raw/06~08）；`git diff bc1087ee..HEAD -- backend/ | wc -c` = 0；守卫前探针实测 13 字节 IV 静默解密成功（raw/02c P1）、17 字节抛未分类 RangeError（P4），守卫后全部收敛为已分类『AES-256-GCM 解密失败』（raw/03）。
- 反测：R-IV 摘 IV 守卫 ⇒ spec.ts:136/149/163 三条 IV 用例红并点名（INJECT_EXIT=0、SHA 恒等 1a6bd4ef、MARKER_RG_EXIT=1、复跑 EXIT=0）；R-TAG 摘 tag 守卫 ⇒ spec.ts:78/120 两条 tag 用例红并点名（同台账齐全）。
- 阻塞：无。
- 待裁：① IV 非法复用的用户可见文案语义偏宽（是否另立文案卡）；② 加密侧 iv 参数是否加开发期断言（本卡红线未动加密侧）。
- 全文回传卡：`docs/tasks/cards/R101-QODER-23F1-回传.md`；关联派单卡：`docs/tasks/inbox/QODER-23F1-aes-boundary.md`（本回执按本轮协议用独立文件名，ACTIVE.md 路由由负责人收口）。
