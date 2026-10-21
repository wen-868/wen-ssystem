本目录四份日志 = QODER-22 反测 v1 轮，**全部作废**，不作任何判据引用（按项目纪律：作废读数另立 note，不改写原始证据文件）。

作废原因（两条，都是执行侧的）：
1) 注入器 inject.mjs 用 CommonJS 的 require() 写在 .mjs（ESM）文件里 ⇒ node 抛
   ReferenceError: require is not defined in ES module scope，退出码 1，**文件一个字节都没改**。
   驱动 v1 只把退出码写进日志、没有据此中止本轮 ⇒ 后续"红跑"其实是绿跑（VITEST_EXIT=0），
   得到 4 轮 INJECT_EXIT=1 / VITEST_EXIT=0 的空转读数。
   ⇒ v2 已改为 inject.cjs，并在驱动里加硬闸：INJECT_EXIT≠0 ⇒ 本轮立即 ROUND_VOID=1、只做保底复原、不再产出红/绿读数。
2) 附带发现（**独立于本卡动作面、须报**）：A1 轮的 2b 步在**未注入**的清洁合并态上跑
   `npm --workspace app-mobile run test` ⇒ TEST_GATE_EXIT=1，红的是
   tests/storage-crypto.spec.ts:37「tag 校验失败即抛」（AssertionError: expected [Function] to throw an error），
   1 failed | 185 passed。而 19:17 的 check:gates 四门全绿（186/186）。
   ⇒ 该 spec 存在**非确定性红**（用例内容与本卡无关，本卡未动 crypto.ts / storage-crypto.spec.ts）。
   复测计划与读数见 docs/evidence/qoder-22/raw/13-test-gate-repro-clean-tree.log 及其后续轮次。
