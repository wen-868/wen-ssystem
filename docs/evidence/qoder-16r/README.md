# QODER-16R 证据目录（隐私权限交付重栈到常驻门禁）

执行方：Qoder（移动端执行方，子代理）｜分支：`fix/qoder-16r-permissions-restack`
基线：`dfeedbc0`（#368 合并后的 main，常驻门禁已在树上）｜HEAD 起点：`f4260a90`（旧 3 笔 rebase 后哈希）
日期：2026-10-21（执行方自评，非验收结论）

## 一、与 `docs/evidence/qoder-16/`（上一轮）的关系

- **旧证据原样保留、一个字节未改**（含 raw/21 与其勘误件 `raw/21b-probe-b-invalid.note.txt`、
  raw/22 采信段）。本轮**不改写**旧文件，所有新读数**另存本目录新文件号**。
- 上一轮基线 `321b4f6b` 无常驻门禁，靠"借入 harness 跑完删除"；本轮基线 `dfeedbc0` 起
  `vitest.config.ts`/`.eslintrc.cjs`/`scripts/*.mjs`/`scripts/gates-baseline.json` 全部入库，
  **所有门一律走常驻 `npm run <gate>` 入口**，未借入/删除任何 harness。
- 交付内容本体（`src/manifest.json` 六键 + `mp-weixin.permission` + `requiredPrivateInfos`、
  `tests/mobile-permissions.spec.ts` 8 用例）在 rebase 笔 `6b6fb197` 里已带上新基线，
  本轮**没有改动任何业务源码**，唯一实现改动 = `gates-baseline.json` 的 `tests` 段
  （5/56 → 6/64，实测即基线）。

## 二、raw/ 文件索引

| 文件 | 内容 | 对应判据 |
|---|---|---|
| `01-type-check.log` | 常驻 `npm run type-check`：vue-tsc EXIT=0，0 条 = 基线 0 条 | type-check 0=0 |
| `02-lint.log` | 常驻 `npm run lint`：error 20/20、warning 12872/12872，EXIT=0 | lint 逐规则不劣化 |
| `03a-test-before-baseline.log` | 改基线**前** `npm run test`：6 文件/64 用例全过（含 mobile-permissions 8/8），基线 5/56 提示调高 | 8 用例接常驻 vitest 跑绿 + 口径留痕 |
| `03b-test-after-baseline.log` | 改基线**后** `npm run test`：6/64 = 基线 6/64，EXIT=0 | test 门绿（实测即基线） |
| `04-check-contract.log` | 常驻 `npm run check:contract`：差集 1 / 具名豁免 1，EXIT=0 | contract EXIT=0 |
| `05-build-h5.log` | `npm run build:h5` DONE，EXIT=0 | build:h5 EXIT=0 |
| `06-build-mp-weixin.log` | `npm run build:mp-weixin` DONE，EXIT=0 | build:mp-weixin EXIT=0 |
| `07-mpweixin-appjson-readback.log` | 产物 `app.json` 实读：`permission["scope.record"].desc` 原文在场、`requiredPrivateInfos = []` | 产物读数保持 |
| `08-build-app.log` | `npm run build:app`（可选项，跑了）DONE，EXIT=0 | iOS 六键产物侧证前置 |
| `09-app-product-privacyDescription-readback.log` | App 产物 `manifest.json` 六键原文实读（`ios`→`apple` 归一节点） | iOS 六键进产物 |
| `10-config-json-and-lengths.log` | 两份配置 JSON.parse OK；六键 desc 长度 47–62；scope.record desc 45 字；appid 基线值 | 卡 §锚点复核 |
| `11-pagesjson-no-dead-config.log` | `grep mp-weixin src/pages.json` 0 命中 + `git diff dfeedbc0..HEAD -- pages.json` 空 | 不向 pages.json 补死配置 |
| `20-final-gate-sweep.log` | 终态四门复跑（type-check/lint/test/check:contract 各 EXIT=0） | 验收总览 |
| `21-final-selfcheck.log` | 协议 §7 收尾自检（status/log/diff 面/backend=0/src 只 manifest） | 改动面自证 |
| `30-unverified-registration.txt` | 真机 / 微信开发者工具 / 小程序后台隐私协议三项未验登记（含原因与复现命令） | 协议 §6 |

## 三、anti/ 索引

- `anti/loop1-drop-ios-key/`：删 `NSBluetoothAlwaysUsageDescription` 整行（工作树外 scratch
  `.mjs` 字节精确注入，5777→5552 字节，grep 0 命中）⇒ `01-target-red.txt`（EXIT=1，点名
  「缺少 NSBluetoothAlwaysUsageDescription」+ spec:111 TypeError）⇒ `02-restore-sha256.txt`
  （cp 复原，SHA 与 `00-pre-sha256.txt` 逐字节一致 f551ca55…604e5fe）⇒ `03-restore-green.txt`
  （复跑 6/64 EXIT=0）⇒ `04-walkthrough.txt` 全程叙述（含比对脚本首版提取 bug 的勘误留痕）。

## 四、复现命令

```bash
cd D:/Users/ZXQL/wt-agents/QODER-16/app-mobile
npm run type-check && npm run lint && npm run test && npm run check:contract   # 四门
npm run build:h5 && npm run build:mp-weixin && npm run build:app               # 三构建
# 产物回读
node -e "const j=require('./dist/build/mp-weixin/app.json');console.log(j.permission,j.requiredPrivateInfos)"
# 反测（勿在工作树内放脚本）：见 anti/loop1-drop-ios-key/04-walkthrough.txt
```
