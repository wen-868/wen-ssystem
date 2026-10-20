# ACTIVE-回执-QODER-15

> 执行方：Qoder（移动端）子代理｜日期：2026-10-21｜对应派单：QODER-15。所有读数均为**自评**。

## 人读摘要

修好了价格异常页白屏：后端 DECIMAL 可能以字符串/null 下发，页面四处金额（costPrice/retailPrice/storePrice/miniappPrice）直接 `.toFixed(2)` 会对 null/字符串抛 TypeError 白屏。新增公共工具 `app-mobile/src/utils/format.ts`（`toNum` 归一化 + `fmtAmount` 格式化，无效→`—`、有效 0→`0.00`，兼容 `'12.34'`/空白/千分位/`-0`/`NaN`/`Infinity`），`price.ts` 该接口四字段出参改 `number|string|null`，页面四处改 `¥{{ fmtAmount(item.x) }}`。未批量改其它页（同类风险登记 §七 提请后续单）。

判据（自评，同 harness 改前/改后）：type-check 0→0；lint error 20→20、warning 12880→12880、逐规则劣化 0；test 基线 0 用例→本单 2 文件 44 用例全过；build:h5 EXIT=0。反测：把 costPrice 改回裸 `.toFixed()` ⇒ 静态门 RED_EXIT=1 点名 costPrice，cp 复原后 SHA256 逐字节一致（`7b3d87e7…eba6`），复跑 GREEN_EXIT=0。页面不再白屏以真实 Vue SSR 管线（基线对 null 抛 `TypeError: _ctx.item.costPrice.toFixed is not a function`、修后正常渲染）+ browser-use 实开 DOM 回读（null/undefined→`¥—`、0→`¥0.00`、串→`¥12.34`）实证；**PNG 截图与登录态整页 E2E 未验**（in-app viewport hidden + 无 :8080 后端/无 token）。

偏差：基线无门禁设施，harness 借入自 `9fd90257`、测毕已删未提交；复现见回传卡 §五。

```
===DSH-RECEIPT-BEGIN===
id: QODER-15
status: DONE
summary: 价格异常页四处裸 .toFixed(2) 改接新增 utils/format.ts 的 fmtAmount（无效→—、0→0.00、兼容字符串/null），listAnomalies 四字段出参改 number|string|null；type-check 0=0、lint error20/warning12880 逐规则不劣化、build:h5 EXIT=0、新增 2 文件 44 用例全过；反测注入→静态门红点名 costPrice→复原 SHA256 逐字节一致→复跑绿。页面不再白屏以真实 SSR + 浏览器 DOM 回读实证；PNG/登录态整页 E2E 未验（偏差已披露）。
worktree: D:\Users\ZXQL\wt-agents\QODER-15
branch: fix/qoder-15-price-anomaly-numeric
commits: 233cd2fc(impl)；docs 笔=本卡+回执+证据（git log 最新一笔，写时不可知）
evidence: docs/evidence/qoder-15/README.md,docs/evidence/qoder-15/raw/01-typecheck-pre.txt,docs/evidence/qoder-15/raw/02-typecheck-post.txt,docs/evidence/qoder-15/raw/03-eslint-pre.txt,docs/evidence/qoder-15/raw/04-eslint-post.txt,docs/evidence/qoder-15/raw/05-eslint-compare.txt,docs/evidence/qoder-15/raw/06-test-baseline.txt,docs/evidence/qoder-15/raw/07-test-post.txt,docs/evidence/qoder-15/raw/08-build-h5.txt,docs/evidence/qoder-15/raw/09-eslint-full-json.note.txt,docs/evidence/qoder-15/raw/10-test-final-green.txt,docs/evidence/qoder-15/raw/render-evidence-stdout.txt,docs/evidence/qoder-15/anti/00-pre-sha256.txt,docs/evidence/qoder-15/anti/01-static-red.txt,docs/evidence/qoder-15/anti/02-restore-sha256.txt,docs/evidence/qoder-15/anti/03-static-green.txt,docs/evidence/qoder-15/browser/render-demo-fixed.html,docs/evidence/qoder-15/browser/render-demo-dom-readback.txt,docs/evidence/qoder-15/browser/render-demo-a11y-snapshot.txt
return_card: docs/tasks/cards/R101-QODER-15-回传.md
gates: type-check=>基线0/修后0(EXIT0) | lint=>error20->20/warning12880->12880/files190->191(逐规则劣化0) | test=>基线0用例/本单2文件44用例全过(EXIT0) | build:h5=>EXIT0 | 反测=>注入红RED_EXIT1点名costPrice/复原SHA256一致7b3d87e7eba6/复跑GREEN_EXIT0 | 页面不白屏=>真实SSR基线抛TypeError修后渲染+浏览器DOM回读null→¥—/0→¥0.00/串→¥12.34(自评,未验PNG与登录态E2E)
redlines: 遵守（未 push / 未开 PR / 未 git add -A，逐文件 add；未动 appid/后端/其它工作树；借入 harness 已删除且未提交；未 npm install）
===DSH-RECEIPT-END===
```
