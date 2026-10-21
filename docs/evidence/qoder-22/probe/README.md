# QODER-22 附带发现 · `storage-crypto.spec.ts:37` 偶发红（非门禁抖动，已确定性复现）

> 汇报对象：凌舟｜发现人：Qoder（移动端执行方）｜日期：2026-10-21
> **本项不在 QODER-22 动作面内**：本卡未改 `src/utils/crypto.ts`、未改 `tests/storage-crypto.spec.ts`，只报告并给复现件。

## 一、现象

反测 v1 驱动的空转轮次里（注入器崩溃、文件一字节未改），A1 轮 2b 步在**清洁合并态**上跑了常驻 test 门：

```
TEST_GATE_EXIT=1
 FAIL  tests/storage-crypto.spec.ts > 存储加解密往返（AES-256-GCM） > tag 校验失败即抛（密文/认证标签被篡改时绝不返回明文）
AssertionError: expected [Function] to throw an error   ← storage-crypto.spec.ts:37:37
 Test Files  1 failed | 10 passed (11)   Tests  1 failed | 185 passed (186)
```

同一天 19:17 的 `check:gates` 四门全绿（186/186），19:32 清洁树复跑 `npm --workspace app-mobile run test` 亦绿（`RUN1_TEST_GATE_EXIT=0`）。⇒ 不是"环境坏了"，是**内容级概率红**。原始日志：`../anti/void-v1/README.note.txt` 与 `../anti/void-v1/VOID-A1-*.txt`。

## 二、根因（三步，全部有实测读数）

篡改式取自 `tests/storage-crypto.spec.ts:36`：`tag: enc.tag.slice(0, -4) + 'AAAA'`。

1. `encrypt()` 的 `tag` 是 **16 字节** GCM 标签的 base64 ⇒ 24 字符、末尾恒为 2 个 `=` 填充。`slice(0,-4)` 去掉的是「最后 2 个有效字符 + `==`」，补 `AAAA` 后 base64 解出 **18 字节**：前 15 字节与真标签完全相同，第 16/17/18 字节恒为 0。
   ⇒ 该篡改真正改动的**只有第 16 个字节**（原值 `tag[15]`，被换成 0）。
2. `src/utils/crypto.ts:626-628` 的校验循环：
   ```ts
   let diff = 0
   for (let i = 0; i < 16; i++) diff |= tag[i] ^ expectedTag[i]
   if (diff !== 0) return null
   ```
   循环上界写死 16、**从不检查 `tag.length`** ⇒ 多出来的 2 字节被无视，检出与否**只取决于 `tag[15]` 是否为 0**。
3. `tag[15] === 0` 的概率 = 1/256。命中时 `decrypt()` 不抛、直接返回原明文 ⇒ `:37` 的 `toThrow()` 红。

探针实测（`50-storage-crypto-flake-probe.log`，探针源码存档在本目录 `__q22-flake-probe.spec.ts.txt`）：

| 探针 | 读数 |
| --- | --- |
| A（确定性复现） | 第 **77** 次加密即命中：`tag=Ez/YxtiS7v8uD7FS5CKRAA==`（`tag[15]=0`）；篡改后 `…AAAA` 解出 **18 字节**、前 15 字节与真 tag 全同；`decrypt(篡改tag) 是否抛错=false`、`返回值="top-secret"` |
| B（对照） | 只改 tag base64 第 0 个字符 ⇒ `decrypt` 抛错（说明"能检出"完全来自逐字节比较，与常量时间写法无关） |
| C（概率） | 2000 次加密中 `tag[15]==0` 命中 **8** 次 = 0.00400，理论 1/256 = 0.00391；`tag` 字节数异常 0 次 |

## 三、影响面（如实，不夸大）

- **门禁侧**：`npm run test` / `check:gates` 每跑一次该用例约有 **0.4% 概率假红**。本会话内清洁合并态的全量门跑共 3 次：19:17 绿（186/186）、19:27 红（1 failed | 185 passed）、19:32 绿（186/186）⇒ 3 次里撞红 1 次，比理论值 1/256 偏高（样本太小，不足以外推），但根因不靠样本成立：探针 A 已**确定性**造出"篡改被接受"的密文。表现为"门不可信"，容易被误读成别人的改动引入回归。
- **产品侧**：`decrypt()` 对**标签编码形态不做校验**（长度不等于 16 也照样过）。这不是机密性破口（探针里密文未动，解出的明文本来就正确）；真正的含义是"认证标签校验的完备性弱于注释所述"——例如存储被截断/改写出的**非规范 base64** 可以被当作合法标签接受。是否要按密码学正确性收口（`tag.length !== 16 ⇒ return null`），请凌舟裁定。
- 与 pin-ssl 无关、与本卡双范围裁定无关，纯属合并态上撞出来的既有存量。

## 四、建议处置（不自行执行）

1. 用例侧：把 `:36` 的篡改改成**必然改变比较窗口**的写法（例如改 tag 首个字符，或整段替换为另一条密文的 tag），消除 1/256 概率红。
2. 实现侧（若凌舟判定要修）：`aesGcmDecrypt` 入口加 `if (tag.length !== 16) return null`；同时 `iv`/`ciphertext` 的形态校验可一并考虑。
3. 两处都在本卡红线之外（本卡动作面只有 `tests/pin-ssl-static.spec.ts` + `gates-baseline.json`），**建议另立一单**。

## 五、复现命令（凌舟可直接跑）

```bash
cp docs/evidence/qoder-22/probe/__q22-flake-probe.spec.ts.txt app-mobile/tests/__q22-flake-probe.spec.ts
cd app-mobile && npx vitest run tests/__q22-flake-probe.spec.ts
rm app-mobile/tests/__q22-flake-probe.spec.ts   # 探针不入库，跑完必须删
```

⚠️ 该探针会让 `npm run test` 门多算 1 文件 / 3 用例（基线 11/186 会变红），所以只在删掉之后再跑门。
