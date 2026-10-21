# QODER-23 · AES-GCM 认证标签长度正确性

【派单 QODER-23】修复 AES-GCM 接受非规范标签长度与概率假红
派单人：凌舟（总负责人）｜2026-10-21
执行方：Qoder（移动端；`D:\Users\ZXQL\wt-agents\QODER-23`）
优先级 / 时间盒：P1 · 半天

## 回传格式（照抄填满）

```
【汇报 QODER-23】QODER-23 AES-GCM 标签长度正确性 <一句话结论>
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜<YYYY-MM-DD>
交付物：<逐条，含文件路径 + 提交哈希>
证据（可复跑）：<命令 + 原始输出摘要 + 行号 + SHA256>
验收自评：<逐条 通过/未通过 + 依据>
未完成与阻塞：<逐条；无也写“无”>
风险与自我报备：<逐条；无也写“无”>
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-23-回传.md
关联卡：docs/tasks/inbox/QODER-23-gcm-tag-length.md
```

## 一、基线与范围

- 基线：QODER-22 尖端 `bc1087ee`；分支：`fix/qoder-23-gcm-tag-length`。
- 只准改：`app-mobile/src/utils/crypto.ts`、`app-mobile/tests/storage-crypto.spec.ts`、本单回传卡与 `docs/evidence/qoder-23/**`。
- 根因现状：`crypto.ts:626-628` 固定比较 16 字节但未先拒绝 `tag.length !== 16`；测试 `storage-crypto.spec.ts:36-37` 对 base64 尾四字符替换会解出 18 字节标签，只有约 1/256 概率命中被比较的第 16 字节。

## 二、交付物

1. `aesGcmDecrypt` 在进入常量时间比较前校验认证标签长度；长度不是 16 字节立即返回 `null`。
2. 测试改为**确定性**篡改：先断言合法标签解码长度为 16，再翻转一个明确的标签字节，必须抛错，不再依赖概率。
3. 增加非规范长度用例：构造可解码为 18 字节的标签，必须被拒绝。
4. 保留既有密钥长度、往返、随机 IV、错误密钥等断言，不放宽任何既有门禁。
5. 反测：临时摘掉长度守卫 ⇒ 18 字节标签用例必红并点名；`cp` 复原后工作树 SHA256 与注入前一致 ⇒ 复跑绿。

## 三、硬验收

- `npm --workspace app-mobile run check:gates` EXIT=0；type 0=0、lint error 0、warning ≤12872、test 全过且基线按实测只上调不下降。
- `npm --workspace app-mobile run build:h5` EXIT=0。
- 两条反测均记录 `INJECT_EXIT=0`、注入后回读、目标测试 EXIT=1、复原 SHA、复跑 EXIT=0。
- `git diff bc1087ee..HEAD -- backend/` = 0；工作树 clean。

## 四、红线

- 不得 push、不得开 PR、不得 `git add -A`、不得共用其他 QODER 工作树。
- 不得用放宽断言、跳过用例、改超时或吞异常方式换绿。
- 不得改动 H5/APP 存储策略、KDF、AES-CTR/GHASH 既有语义；本单只补认证标签长度边界。
- SHA 必须标注 `worktree-crlf` / `git-blob-lf` 形态，不得跨形态直接比较。
