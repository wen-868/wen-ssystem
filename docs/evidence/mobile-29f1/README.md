# MOBILE-29F1 证据树 · 上传安全头与 JSON 内容类型分离

单号：MOBILE-29F1（P0）｜负责人：阿潵（WB 端 / 移动端）｜2026-10-23
分支：`mobile/MOBILE-29F1-upload-header`｜基线：`a531ed28`（QODER-29 收敛态）
派单：`docs/tasks/inbox/MOBILE-29F1-upload-header-separation.md`

## 目录

| 路径 | 内容 |
|------|------|
| `raw/` | 门禁/构建/守卫原始日志（跑完即留档，可复跑） |
| `anti/` | 反测（§9.1 五步协议）逐轮注入/验红/复原/验绿记录 |
| `smoke/` | 真实 H5 上传冒烟脚手架 + results.json（§8.9 留档） |
| `../cards/R101-MOBILE-29F1-阿潵回传.md` | 回传卡（十项格式） |

## 环境修复记录（机器级，影响所有 junction 到主检出的工作树）

本机（win32-x64）node_modules 自 2026-10-22 起受 npm 可选依赖 bug
（npm/cli#4828）影响，rollup 与 esbuild 均只装了 arm64 变体，x64 原生二进制缺失，
导致 vitest/vite 全体起不来。本单执行中在主检出 `node_modules` 补齐两件
（sha1 与 registry shasum 逐一致，tarball 与抽取件留档于工作树外
`D:/Users/ZXQL/wt-agents/_mobile-29f1-deps-fix/`）：

1. `@rollup/rollup-win32-x64-msvc@4.62.2`（sha1 `3671ce3f…`）→ `node_modules/rollup/dist/rollup.win32-x64-msvc.node`
2. `@esbuild/win32-x64@0.25.12`（sha1 `9bdad817…`）→ `node_modules/@esbuild/win32-x64/`

修复后 `require('rollup/dist/native.js')` 与 `esbuild.transform()` 均实测可用，
惠及所有以 junction/symlink 复用主检出 node_modules 的工作树。

## 机器负载与门禁抖动（重要背景）

执行期间本机 CPU 持续 100%（8 逻辑核，并发 6 个重型代理会话：WorkBuddy ×2、
DeepSeek Harness ×3、Trae CN ×2、sandbox-center）。满量 vitest 的 import 阶段
实测 82–120s，5s 默认用例超时在 import/await 点击穿，且 **vitest 超时不取消
测试异步续体**——超时用例的续跑会与下一用例交错、污染其 uni stub 调用计数
（`request-retry-safety.spec.ts` ②「promise resolved {ok:true}」即此形态）。

三轮满量跑失败文件各不相同（storage-crypto/update-security 超时 →
request-contract③ 双 toast → request-retry-safety①②），而各文件单独跑全绿；
本单未触碰上述任何文件。按门禁纪律「真假看历史成功率不看当前颜色」，
以逐门 EXIT=0 + 满量绿跑（328/328）为证，抖动全程留档于
`raw/20-gates-chain-run1-*.log` 与 `raw/11b-*.log`。

## 基线口径

tests 冻结基线（`app-mobile/scripts/gates-baseline.json`）：QODER-29 收口态
16 文件 / 322 用例（该轮绿跑日志见 `docs/evidence/qoder-29/raw/`）。
本单 `tests/request-contract.spec.ts` 19 → 25 用例（+6，全部实调驱动真实模块），
实测 16/328 ⇒ 按「实测即基线」同步上调（只升不降）。
