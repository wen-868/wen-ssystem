# ACTIVE-回执-QODER-13 · pin-ssl 指纹更新 + basis 行号 + `--no-stale` 守卫

> 汇报对象：凌舟｜汇报人：Qoder（移动端执行方）｜日期：2026-10-21｜对应派单编号：QODER-13
> 十项全文回传：`docs/tasks/cards/R101-QODER-13-回传.md`｜证据：`docs/evidence/qoder-13/**`

## 人读摘要

三件事全部完成（执行方自评，非验收结论）：

1. **① 指纹换值（未接线）**：`pin-spki.sh` 于 2026-10-21 01:46/01:47（本机）对两域各采一次（均 EXIT=0，对端 4 张证书），`PINNED_CERTS` 四条全部换成现网 Let's Encrypt 值并按域名成对写回：api 叶子 `Y/uy8CcE…fcHs=`（notAfter 2026-11-11，剩 22 天 WARN 命中）、api 中间 `s/tdAOmU…U3Y=`（YE2）、m 叶子 `rH0oqsRg…1M4=`（CN=admin.onepan.cn SAN 含 m，notAfter 2026-12-22）、m 中间 `brzvtCEC…oB4=`（YE1）。`installSslPinning()` 调用点仍为 **0**（未接线，rg 自证）。
2. **② basis 行号**：`permission-gates.ts:596` 的 `aftersale.routes.ts:64`→`:67`（后端真值已核：confirm-receipt 在 67 行）；只改这一处。
3. **③ `--no-stale` 开关**：`guard-rbac-wiring.mjs` 新增可选开关，陈旧（gaps+consumerEnd）>0 且传入时 ⇒ EXIT=1 逐条点名；不传行为逐字节不变。反测：注入 1 条陈旧 ⇒ `--strict --no-stale` EXIT=1 点名 `admin-auth.routes.ts|POST /api/qoder13-antitest/never-exists`，同现场不带开关 EXIT=0（**行为隔离证明**）；`cp` 复原 sha256 前后一致、复跑 EXIT=0。CI 未启用（未碰 workflows）。

判据自评：卡 §二.1-4 全达成（`rg -i trustasia` 判据范围按指令取 `pin-ssl.ts` 文件内 0 命中；全仓其余命中均为文档/历史证据未动，清单见回传卡 §五-1）。后端受影响两测试文件 282 passed EXIT=0。

## 未验清单

- 真机/小程序端 TLS 行为：**未验**（未接线，无取证手段）。
- 接线后连通性：**未验**（接线另裁）。
- 本单合并前现网证书再轮换：**未验**——api 叶子 2026-11-11 到期仅剩 22 天，引用前必须重跑脚本复核。
- 遗留注释漂移（已报备）：`pin-ssl.ts` 文件头 `:6/:28` 两处"2026-09-15 过期"表述随本次换值已语义过时，不属"紧邻注释"范围未动，待接线卡/凌舟裁定。

## 阻塞

无。

===DSH-RECEIPT-BEGIN===
id: QODER-13
status: done-self-assessed
summary: pin-ssl 四条指纹换 2026-10-21 现网 Let's Encrypt 值（未接线，调用点0）+ permission-gates basis :64→:67 + guard-rbac-wiring 新增 --no-stale 开关（默认行为不变，反测红点名+行为隔离+SHA复原一致）
worktree: D:\Users\ZXQL\wt-agents\QODER-13
branch: fix/qoder-13-pin-fingerprints-and-guard
commits: 见 git log --oneline origin/main..HEAD（实现笔 1 + docs 笔 2；基线 21b465e5=origin/main=dfeedbc0+2笔docs）
gates: type-check 0=0 EXIT=0 ／ lint error20 warning12872=基线 EXIT=0 ／ test 5文件56用例=基线 EXIT=0 ／ contract 差集1豁免1 EXIT=0 ／ guard --strict EXIT=0 --strict --no-stale(陈旧0) EXIT=0 注入陈旧后 --no-stale EXIT=1点名·不带 EXIT=0 ／ 后端两接线测试 282 passed EXIT=0
redlines: 未push／未开PR／未 git add -A／未接线（installSslPinning 调用点0）／未改任务书原件／未动 ACTIVE.md／未碰 .github/workflows／未 npm install／未改 gates-baseline.json／只动本工作树
evidence: docs/evidence/qoder-13/**（raw：两域采集01/02、新值对照08、trustasia范围与调用点03、basis rg 04、guard三态05/06、后端测试07、四门09-12、diff快照13；anti：有效反测 anti-no-stale-full-run.log + attempt1 无效留档；16 收尾自检）
return_card: docs/tasks/cards/R101-QODER-13-回传.md
===DSH-RECEIPT-END===
