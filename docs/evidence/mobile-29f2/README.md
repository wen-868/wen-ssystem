# MOBILE-29F2 · 冒烟环境清理与安全头防夹带 —— 证据索引

> 执行方：阿潵（移动端负责人）｜2026-10-24
> 分支：`mobile/MOBILE-29F2-smoke-cleanup-header`｜基线 `57079530`（＝MOBILE-29F1 回传态）
> 工作树：`D:/Users/ZXQL/wt-agents/MOBILE-29F2`
> 派单卡：`docs/tasks/inbox/MOBILE-29F2-smoke-cleanup-header-hardening.md`
> 由来：凌舟 2026-10-24 对 MOBILE-29F1 的验收裁定——核心功能通过，
> 但**交付卫生**（根 `.env.local` 残留）与**防回归**（`buildSecureHeaders` 可被 extra 夹带
> Content-Type 绕过）两项未闭环 ⇒ 判「暂不整体通过」，派本单补齐。

## 一、本单做了什么

| # | 项 | 落点 |
|:--|:--|:--|
| 1 | 清理 29F1 冒烟遗留的工作树根 `.env.local`（被 .gitignore 隐藏 ⇒ git status 假净） | 已删除；两棵树 `.env*` 中 `127.0.0.1:5199` 命中 0；端口 5199 已释放 |
| 2 | 冒烟 runner 双 env 快照/恢复 + 异常退出兜底 | `smoke/run-smoke.mjs`（`process.on('exit')` + 信号钩子，29F1 只靠 finally 分支，被中断就残留） |
| 3 | `buildSecureHeaders(extra)` 剥离任意大小写形式 Content-Type | `src/api/request.ts` |
| 4 | 新增用例 ㉗（真实传 Content-Type 各形态，断言产物不含该键） | `tests/request-contract.spec.ts` |
| 5 | 冒烟 pageerror 分类裁决（仅具名 `hideTabBar:fail not TabBar page` 可豁免，未知判红留原文） | `smoke/run-smoke.mjs` |

## 二、目录结构

```
mobile-29f2/
├─ README.md              本文件
├─ raw/                   门禁与构建原始日志
├─ anti/                  反测（R1 源码面 / R2 环境面）+ 协议说明
└─ smoke/                 冒烟脚手架（server.cjs / run-smoke.mjs / results.json / uploads/）
```

## 三、门禁读数

见 `raw/`（最终数值以凌舟可见的最后一份 `2x-gates-chain-*.log` 为准）：

- `12-gates-test-329.log`：门 3 单独跑 **16 文件 / 329 用例全过 EXIT=0**
- `13-gates-contract.log`：门 4 EXIT=0（差集 1 条，全部具名豁免）
- `14-gates-guard.log`：门 5 EXIT=0（A 全登记 · B 分流 · C 无明文凭据 · D 无误用）
- `40-guard-inventory.json`：静态守卫登记册 JSON
- `2x-gates-chain-run*.log`：完整五门链（type-check → lint → test → contract → guard）

**环境说明（如实报备）**：本机为多会话并发环境（8 核，实测空闲内存一度低至 ~1GB），
vitest 默认 5s 超时在**链式串跑**场景下会被 import/计算密集用例击穿（超时后续体不取消，
续跑污染后续用例 stub 计数）⇒ 表现为 request-contract ②③④、request-retry-safety、
storage-crypto、update-security 等文件的**首条/计算密集用例超时**。
单独跑门 3 与单独跑各文件均稳定全绿，失败只出现在链式串跑且资源紧张时。
本单未为转绿放宽任何断言、未加 `it.skip`、未改超时配置。

## 四、反测（见 anti/README.md）

| 轮次 | 注入 | 期望 | 实测 |
|:--|:--|:--|:--|
| R1（源码面） | 摘掉 `buildSecureHeaders` 的 Content-Type 剥离循环 | ㉗ 红并点名 | ㉗ 红，㉑㉒㉓㉔ 仍绿 ⇒ ㉗ 是唯一捕获点；复原 SHA256 恒等后复跑绿 |
| R2（环境面） | 写入根 `.env.local`（5199 冒烟地址） | 从仓库根跑 spec EXIT=1 | EXIT=1（输出中 5199 命中 4 次）；删除后 EXIT=0 |

R1 同时实证了凌舟指出的 ㉒ 覆盖缺口：㉒ 标题声称「调用方塞 Content-Type 也不该出现」，
但用例体只传 Accept/Authorization，**从未真传 Content-Type**，故缺陷注入后 ㉒ 依然绿。

## 五、冒烟（见 smoke/results.json）

真实链路：Vite dev:h5（`.env.local` 注入基址）→ Playwright 页面内动态 import 真实
`profile.ts` / `products.ts` → 真实 `uni.uploadFile`（H5 XHR multipart）→
Express + multer 冒烟服务（127.0.0.1:5199）取证。

断言覆盖：两条记录的 Content-Type 均为浏览器自生成 multipart 且 boundary 在场、
multer 零错误、`req.file` 非空（字段名/大小/MIME 逐项核对）、页面内返回解析成功，
**外加本单新增**：pageerror 分类裁决、交付态两处 `.env.local` 无残留、5199 端口已释放。

## 六、凌舟复跑

```bash
cd D:/Users/ZXQL/wt-agents/MOBILE-29F2/app-mobile
npm run check:gates                    # 五门链
npm run build:h5 && npm run build:mp-weixin && npm run build:app   # 三端构建

cd ../docs/evidence/mobile-29f2/smoke
node run-smoke.mjs                     # 真实 H5 上传冒烟（脚手架全留档，跑完自动清理 env）
SMOKE_INJECT_PAGEERROR=anti-unknown-marker node run-smoke.mjs   # 反测：未知 pageerror ⇒ EXIT=1
```
