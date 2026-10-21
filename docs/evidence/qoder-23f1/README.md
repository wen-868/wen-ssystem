# QODER-23F1 证据树（AES-GCM IV 与短标签边界）

- 卡：`docs/tasks/inbox/QODER-23F1-aes-boundary.md`
- 分支 / 基线：`fix/qoder-23f1-aes-boundary`，基线 `2568ef0352929f29e4c99ba79627fea2b5a26476`（QODER-23 尖端，开工实测）
- 实现提交：`bbc8aa9ec380133629733222bc766d8722d55b0a`（fix: IV 守卫 + 四条用例 + tests 基线 187→191）
- 执行方：Qoder（移动端）子代理｜2026-10-22｜回传见 `docs/tasks/cards/R101-QODER-23F1-回传.md`

## 结论读数速查（全部为现场原始输出，见对应文件）

| 项 | 读数 | 出处 |
|---|---|---|
| 基线四门（改动前） | EXIT=0，11 文件 / 187 用例 | raw/01 |
| 守卫前探针 | 13 字节 IV（13 字节=0x00）静默解密成功；17 字节 IV 抛未分类 RangeError | raw/02c P1/P4 行 |
| 守卫后探针 | 全部非规范输入抛已分类『AES-256-GCM 解密失败』 | raw/03 |
| 实现后门 3 | EXIT=0，11 文件 / 191 用例（基线未调时提示上调） | raw/04 |
| note 前缀机检 | STARTSWITH=true（追加 1262 字符），非 tests 段零改动 | raw/05b |
| build:h5 / mp-weixin / app | EXIT=0 / 0 / 0，产物 app-mobile/dist/build/<平台> | raw/06/07/08 |
| 反测 R-IV（摘 IV 守卫） | INJECT_EXIT=0；红点名 spec.ts:120/136/149/163 三条 IV 用例（146/160/172 行断言）；SHA 恒等 1a6bd4ef…；MARKER_RG_EXIT=1；复跑 EXIT=0 | anti/R-IV-guard-removed.txt |
| 反测 R-TAG（摘 tag 守卫） | INJECT_EXIT=0；红点名 spec.ts:78（88 行）与 spec.ts:120（133 行）两条 tag 用例；SHA 恒等 1a6bd4ef…；MARKER_RG_EXIT=1；复跑 EXIT=0 | anti/R-TAG-guard-removed.txt |
| 收尾全量四门 | EXIT=0，11/191 与基线一致 | raw/10 |
| backend diff | `git diff bc1087ee..HEAD -- backend/ | wc -c` = 0 | raw/11 |

## 目录

- `raw/00`：工作树与基线核对（rev-parse、branch、junction 实况）
- `raw/01`：改动前基线四门
- `raw/02`、`raw/02b`：**作废读数留档**（02=vitest 路径 MODULE_NOT_FOUND；02b=探针配置 JSDoc 内 glob `*/` 提前闭合注释致 esbuild 报错），修正后实跑在 `raw/02c`
- `raw/02c` / `raw/03`：守卫前 / 守卫后形态探针（同一段探针代码两次运行的全部 PROBE 行）
- `raw/04`：实现后门 3（191 用例实测）
- `raw/05`（作废留档：/tmp 盘符解析 ENOENT）/ `raw/05b`：note 前缀机检修正版
- `raw/06~08`：三平台构建原始日志
- `raw/10`：收尾全量 check:gates
- `raw/11`：收尾自检（porcelain / log -3 / backend diff 字节）
- `anti/`：两轮反测完整台账（注入器输出、红行原文、SHA 对、残留检查、复跑绿）
- `probe/`：探针 spec / 探针 vitest 配置 / 注入器 inject-f1.cjs 源码存档（`.txt` 后缀防误跑；工作树内临时件已删）

复现命令与判据自对账见回传卡 §十 / §四。
