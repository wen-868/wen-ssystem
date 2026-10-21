# QODER-23F1 · AES-GCM IV 与短标签边界

【派单 QODER-23F1】把 AES-GCM 的 IV 规范长度与短 tag 拒绝补成可反测边界
派单人：凌舟（总负责人）｜2026-10-22
执行方：Qoder（移动端；`D:\Users\ZXQL\wt-agents\QODER-23F1`）
优先级 / 时间盒：P1 · 半天
基线：QODER-23 尖端 `2568ef03`

## 回传格式（照抄填满）

```
【汇报 QODER-23F1】QODER-23F1 AES-GCM IV 与短标签边界 <一句话结论>
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜<YYYY-MM-DD>
交付物：<逐条，含文件路径 + 提交哈希>
证据（可复跑）：<命令 + 原始输出摘要 + 行号 + SHA256>
验收自评：<逐条 通过/未通过 + 依据>
未完成与阻塞：<逐条；无也写“无”>
风险与自我报备：<逐条；无也写“无”>
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-23F1-回传.md
关联卡：docs/tasks/inbox/QODER-23F1-aes-boundary.md
```

## 一、交付物

1. `aesGcmDecrypt` 在构造 J0 之前校验 `iv.length === 12`；非 12 字节返回 `null`，不得依赖 `Uint8Array.set` 的溢出异常或短 IV 的零填充。
2. 测试补齐短 tag（如 15 字节）和长 tag（已有 18 字节）两侧；两者都必须被拒绝。
3. 测试补齐短 IV（如 11 字节）和长 IV（如 13 字节）；两者都必须抛解密失败，不得抛未分类 RangeError。
4. 保留 23 的确定性 `tag[0]` 篡改与合法 16 字节断言；不放宽既有用例。
5. 反测分别摘 IV 守卫、tag 守卫，目标短边界用例必须红并点名；复原 SHA 一致后复跑绿。

## 二、硬验收

- `npm --workspace app-mobile run check:gates` EXIT=0，test 文件仍为 11，用例数按实测上调。
- `build:h5`、`build:mp-weixin`、`build:app` 均 EXIT=0。
- 两轮反测均含 `INJECT_EXIT=0`、注入回读、目标红、复原 SHA 一致、复绿。
- `git diff bc1087ee..HEAD -- backend/` = 0，工作树 clean。

## 三、红线

- 不得 push、开 PR、`git add -A` 或共用其他工作树。
- 不得只补测试不补 IV 守卫；不得把异常类型不同当通过。
- 不得改 KDF、GHASH、CTR 或 H5 存储策略。
