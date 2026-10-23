# MOBILE-29F2 · 反测协议与执行记录

> 依据派单规范 §9.1（门禁反测标准顺序）与 §8.9（脚手架必须凌舟可复跑）。
> 反测装置必须能在「已知坏版本」上跑出红——跑不出红的装置不得用于验收。

## 一、两轮反测总览

| 轮次 | 注入对象 | 注入内容 | 期望红面 | 实测 | 结论 |
|:--|:--|:--|:--|:--|:--|
| **R1**（源码面） | `src/api/request.ts` | 摘掉 `buildSecureHeaders` 里的 Content-Type 剥离循环（回退到 MOBILE-29F1 形态） | 用例 **㉗** 红并点名 | ㉗ 红（×），㉑㉒㉓㉔ 仍绿 | 通过 |
| **R2**（环境面） | 工作树根 `.env.local` | 写入 `VITE_API_BASE=http://127.0.0.1:5199/api`（模拟 29F1 残留） | 从仓库根跑 spec **EXIT=1**（㉓㉔ 假红） | 注入态 EXIT=1，输出中 5199 命中 4 次；删除后 EXIT=0 | 通过 |

两轮均**逐字节复原**（R1 用 SHA256 对照；R2 删除注入文件）并**复跑绿**。

## 二、为什么 R1 是有效判据（㉒ 的缺口实证）

R1 注入后的实测形态（`R1-test-output.txt`）：

```
✓ ㉑ 登录态齐全 ⇒ 三头同源下发，且 Content-Type 一律不存在
✓ ㉒ extra（如 Accept）可下发，安全头仍最高优先，且绝不带入 Content-Type
× ㉗ extra 夹带 Content-Type（任意大小写形式）⇒ 一律被剥离，产物不含该键
✓ ㉓ 商品主图上传 …
✓ ㉔ 头像上传 …
```

㉒ 的**标题声称**「调用方塞 Content-Type 也不该出现」，但用例体只传了 `Accept` 与 `Authorization`，
**从未真传 Content-Type**——这正是凌舟 2026-10-24 验收阻断项 3.2 指出的覆盖缺口。
R1 实测显示：注入缺陷后 ㉒ 依然绿，**只有新增的 ㉗ 会红** ⇒ ㉗ 是该缺陷的唯一有效捕获点。

## 三、复跑命令（凌舟本机）

```bash
cd D:/Users/ZXQL/wt-agents/MOBILE-29F2

# R1（源码面）：摘剥离 ⇒ ㉗ 红；复原 SHA 恒等 ⇒ 复跑绿
node D:/Users/ZXQL/wt-agents/_mobile-29f2-tools/anti-r1.cjs

# R2（环境面）：注入残留 env ⇒ 从根跑假红；删除 ⇒ 复绿
node D:/Users/ZXQL/wt-agents/_mobile-29f2-tools/anti-r2-env.cjs
```

> 两个执行器也随证据树留档（若工具目录不可达，可照本 README 手工执行：
> 备份 → 注入 → 跑 spec → `cp` 复原 → SHA 对照 → 复跑）。

## 四、R1 的 SHA256 对照

```
注入前：c132b8c530deb7b25f20c6f6b2536f50717e4f671e9b6a15e5fbe6d7581e64c2
复原后：c132b8c530deb7b25f20c6f6b2536f50717e4f671e9b6a15e5fbe6d7581e64c2
恒等：YES
```

原始记录：`R1-sha-before.txt` / `R1-sha-after.txt`；注入前源码备份 `backup-R1-request.ts`。
