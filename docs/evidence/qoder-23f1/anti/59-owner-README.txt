# 负责人自有反测轮次台账（与子代理轮次相互独立编写）

两份 anti 文件各含三段：注入器输出（含 `INJECT_EXIT`）、红态测试原始输出、复原与残留检查、绿态复跑。
注入器 `owner-inject-23f1.cjs` 见 `probe/owner-inject-23f1.cjs.txt`，由负责人自己从尖端文件读出守卫整行作为 needle，与子代理注入器无共用代码。
`crypto.ts` 两轮 `SHA_BEFORE` 与 `SHA_AFTER` 均为 `1a6bd4ef655e9526864a1298323b9f6df967ba9276a1ea338fd69c607862f29f`（worktree-crlf 形态）。

