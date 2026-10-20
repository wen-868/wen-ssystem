# QODER-16 证据目录（iOS 隐私描述 + 小程序录音授权）

执行方：Qoder（移动端）子代理｜分支：`fix/qoder-16-mobile-permissions`｜基线：`321b4f6b`
日期：2026-10-20～21（自评，非验收结论）

## 一、本目录是什么

`raw/**` = 每条判据的**原始**输出（含命令与 `EXIT=` 行）；`anti/**` = 两条「门必须能红」反测的
注入 → 红 → cp 复原 → SHA256 逐字节一致 → 复跑绿 全过程。所有 ANSI 色码已用
`sed -e 's/\x1b\[[0-9;]*m//g'` 剥离。超长 eslint json 只落**计数摘要**，全量 json 在工作树外
scratch 目录（见 §四）。

## 二、raw/ 文件索引

| 文件 | 内容 | 对应判据 |
|---|---|---|
| `00-final-gate-sweep.txt` | 终态四门复跑汇总（type/test/lint/build） | 验收总览 |
| `05-json-parse-check.txt` | 两份配置 `JSON.parse` 读数 | 任务书 §三「JSON.parse 通过」 |
| `10-typecheck-baseline.txt` / `11-typecheck-after.txt` | vue-tsc 基线 0 错 / 修后 0 错，均 EXIT=0 | type-check 0=0 |
| `12-lint-baseline-summary.txt` / `13-lint-after-summary.txt` | 改前/改后全仓逐规则计数 | lint 不劣化 |
| `12b-lint-run-exits.txt` | eslint 两次运行的 EXIT | lint 不劣化 |
| `14-vitest-after.txt` | 新增权限用例全过（8/8，EXIT=0） | test 不劣化 |
| `15-build-mpweixin-baseline.txt` / `16-build-mpweixin-after.txt` | 小程序构建改前/改后，均 EXIT=0 | §二.3 取证 |
| `17-build-h5-after.txt` | `build:h5` EXIT=0 | build:h5 EXIT=0 |
| `18-build-app-after.txt` | `build:app` EXIT=0（App 端打包链取证，见 24） | 补充取证 |
| `20-manifest-provenance-root-vs-src.txt` | **根 manifest.json 是否仍被构建使用**的移走-重建对照实验 | 任务书 §二.3 |
| `21-route-probe-pagesjson-vs-manifest.txt` | 探针 A：pages.json 顶层 `mp-weixin` ⇒ 产物无 permission（**有效**）。同文件 PROBE B 段「探针未出现」**作废**，无注入确认行/回读且与 22 互斥 | 靶点复核（仅 A 段） |
| `21b-probe-b-invalid.note.txt` | 勘误说明：21 的 PROBE B 段作废理由 + 独立佐证；原文逐字节未改 | 靶点复核（指向 22） |
| `22-route-probe-manifest-only.txt` | 探针 B：manifest.json 的 `mp-weixin` ⇒ 产物出现该 desc 原文（`inject rc=0` + 注入后 JSON 回读 + 复原 SHA 一致） | 靶点复核 |
| `23-mp-product-appjson-after.txt` | 改后产物 `app.json` 的 permission / requiredPrivateInfos 实读 | §二.2 生效证明 |
| `24-app-product-privacyDescription-excerpt.txt` | App 端产物 `manifest.json` 里六键原文（`ios`→`apple` 归一） | §二.1 生效证明 |
| `25-field-diff-proof-only-added.txt` | 逐字段自证：changed=0 / removed=0 / added=3（pages.json 全 0） | 红线「只增不改」 |
| `30-privacy-api-grep-evidence.txt` | 隐私接口全量 grep（8 项合法表命中数 + 录音/相机/语音/蓝牙证据行号） | §二.2「只登记实际使用」 |
| `40-git-diff-manifest.txt` | 配置改动全量 `git diff` + pages.json diff（空） | 逐字段审 |

## 三、anti/ 文件索引

- `anti/loop1-drop-ios-key/`：删 `NSBluetoothAlwaysUsageDescription` 整行 ⇒
  `01-target-red.txt`（EXIT=1，点名「缺少 NSBluetoothAlwaysUsageDescription」）⇒
  `02-restore-sha256.txt` 与 `00-pre-sha256.txt` 一致 ⇒ `03-restore-green.txt`（EXIT=0，8 passed）。
  备份 `manifest.json.orig`，过程叙述 `04-walkthrough.txt`。
- `anti/loop2-unused-private-info/`：`requiredPrivateInfos` 塞入代码未使用的 `getLocation` ⇒
  同结构四段，红行点名「登记了代码中未使用的隐私接口：getLocation」。

两条反测各在**一条 bash 命令内**走完（协议 §3），复原一律 `cp`，不用 `sed -i`（CRLF 陷阱）。

## 四、复现命令与 scratch 位置

```bash
# 借入门禁 harness（本基线 321b4f6b 无门禁设施，交付前已删除、未提交）
cd D:/Users/ZXQL/wt-agents/QODER-16
git show 9fd90257:app-mobile/vitest.config.ts > app-mobile/vitest.config.ts
git show 9fd90257:app-mobile/.eslintrc.cjs   > app-mobile/.eslintrc.cjs

# 四门（一律在 app-mobile 目录，用 junction 里的真实入口）
cd app-mobile
node ../node_modules/vue-tsc/bin/vue-tsc.js --noEmit
node ../node_modules/vitest/vitest.mjs run
node ../node_modules/eslint/bin/eslint.js src --ext .ts,.vue
cd .. && npm --workspace app-mobile run build:h5
npm --workspace app-mobile run build:mp-weixin   # §二.3 产物取证
npm --workspace app-mobile run build:app         # 六键产物取证（见 24）
```

全量 eslint json 与探针/反测辅助脚本在工作树外 scratch 目录（不入库）：
`D:\Users\ZXQL\scratch\qoder16\`（`lint-baseline.json`、`lint-after.json`、`lint-final.json`、
`lint-summary.mjs`、`diff-proof.mjs`、`probe-splice.mjs`、`inject-anti.mjs`、
`manifest-provenance.sh`、`route-probe.sh`）。产物 `app-mobile/dist/**` 已被 gitignore，不入库。
