# QODER-12 · `pin-ssl` 指纹轮换口径 + SPKI 采集脚本（并发卡：**不接线**）

> 派单人：凌舟｜端：**移动端 → Qoder**｜基线：`origin/main` 的 #368 分支尖端
> ⚠️ 不得 push / 开 PR / `git add -A`；**本卡明确不接线**（接线需另裁）。
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-12`｜分支 `docs/qoder-12-pinssl-runbook`

## 一、交付（两件）

### ① 口径文档 `app-mobile/docs/pin-ssl指纹维护口径.md`
必须逐条写清：
1. **谁负责更新**（角色名，非"相关人员"）；
2. **从哪取指纹**：SPKI 采集命令（`openssl s_client -connect … -servername … | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64`），**叶子 + 中间证书双指纹**；
3. **何时更新**：域名/证书变更、到期前 30 天（`validTo ≤ 30d` 告警口径）；
4. **轮换流程**：新指纹与旧指纹**同 PR 并存**，观察期过后删旧（避免"一刀切打挂全部客户端"）；
5. **失效表现**：指纹不匹配 ⇒ 请求失败（**不许静默放行**）+ 回滚步骤。

### ② 采集脚本 `app-mobile/scripts/pin-spki.sh`（只读，不联网则退出 1）
- 入参：域名（默认 `api.onepan.cn`）；
- 输出：叶子/中间证书的 SHA-256 SPKI base64 + `notAfter`；
- **不写入任何代码文件**，只打印（供人工粘贴）。

## 二、判据

1. 文档 5 节齐全；
2. 脚本 `bash -n` 通过；在有网环境跑一次给原始输出（无网则给"退出码 1 + 原因"）；
3. `app-mobile/src/utils/pin-ssl.ts` **零改动**（`git diff` 证明）——本卡不接线。

## 三、回传

`docs/tasks/cards/R101-QODER-12-回传.md`（十项）+ 回执。
