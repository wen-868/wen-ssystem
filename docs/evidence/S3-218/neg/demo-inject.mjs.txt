/**
 * S3-218 反测夹具（**故意命中**）：证明 `guard:evidence-secrets` 确实会红，不是恒绿。
 *
 * 本文件**不在**守卫扫描范围内（位于 `docs/evidence/S3-218/neg/`，路径里没有 harness/ 或 tools/ 段），
 * 反测时才由命令复制到临时 root 的 `backend/scripts/` 下 —— 这样既不污染绿侧读数，
 * 又满足"反测不得改仓内文件"的要求（`--root` 指向临时副本）。
 *
 * 两行命中形态分别覆盖判据的两个分支：
 *   ① 模板插值把敏感键的值写进 `console.log`
 *   ② 值写进本仓自建的 tee 包装器 `say()`
 */
const DEMO_PASSWORD = "s3-218-inject-only-not-a-real-secret";

function say(s) {
  console.log(s);
}

console.log(`DEMO_PASSWORD=${DEMO_PASSWORD}`);
say(`TOKEN=${process.env.API_TOKEN}`);
