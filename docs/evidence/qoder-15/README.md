# QODER-15 证据目录（价格异常页数值入口止血）

执行方：Qoder（移动端）子代理｜自评读数，非验收结论。
工作树：`D:\Users\ZXQL\wt-agents\QODER-15`｜分支 `fix/qoder-15-price-anomaly-numeric`｜基线 `321b4f6b`。

## 门禁设施说明（等价装置）

`321b4f6b` 的 app-mobile **无门禁设施**（无 `tests/`、无 `vitest.config.ts`、无 `.eslintrc.cjs`、`package.json` 无 test/lint/type-check 脚本）。
按共享协议 §2，从链上提交 `9fd90257` 借入 harness 后测量，**测毕已删除、未提交**：

```
git show 9fd90257:app-mobile/vitest.config.ts > app-mobile/vitest.config.ts
git show 9fd90257:app-mobile/.eslintrc.cjs   > app-mobile/.eslintrc.cjs
mkdir -p app-mobile/tests
```

复现命令（一律在 `D:\Users\ZXQL\wt-agents\QODER-15\app-mobile` 目录，用 junction 真实入口）：

| 判据 | 命令 |
| --- | --- |
| 用例 | `node ../node_modules/vitest/vitest.mjs run` |
| 类型 | `node ../node_modules/vue-tsc/bin/vue-tsc.js --noEmit` |
| 静态 | `node ../node_modules/eslint/bin/eslint.js src --ext .ts,.vue`（取逐规则用 `-f json -o <scratch>/x.json`） |
| 构建 | 工作树根：`npm --workspace app-mobile run build:h5` |

全量 eslint json（过大未入库）落工作树外 scratch：`D:\Users\ZXQL\wt-agents\QODER-15-scratch\eslint-pre.json` / `eslint-post.json`（见 `raw/09-eslint-full-json.note.txt`）。

## raw/ —— 每条判据原始输出（ANSI 已剥，含 EXIT= 行）

- `01-typecheck-pre.txt` / `02-typecheck-post.txt`：基线/修后 vue-tsc，均 EXIT=0、0 错。
- `03-eslint-pre.txt` / `04-eslint-post.txt`：全仓 files/error/warning + EXIT。
- `05-eslint-compare.txt`：逐规则 diff 摘要（error 20→20、warning 12880→12880、劣化 0）。
- `06-test-baseline.txt`：基线 `--passWithNoTests` → No test files found，既有用例 0。
- `07-test-post.txt`：本单新增 2 文件 / 44 用例全过 EXIT=0。
- `08-build-h5.txt`：`build:h5` EXIT=0（DONE Build complete）。
- `09-eslint-full-json.note.txt`：全量 json 落 scratch 的位置说明。
- `10-test-final-green.txt`：反测复原后完整套件复跑全绿。
- `render-evidence-stdout.txt`：真实 Vue SSR 管线渲染 price-row 片段——基线抛 `TypeError: _ctx.item.costPrice.toFixed is not a function`，修后正常出 HTML。

## anti/ —— 反测三段（门必须能红）

把页面 `costPrice` 一处改回裸 `.toFixed()`：

- `00-pre-sha256.txt`：注入前 vue 文件 SHA256 = `7b3d87e7…eba6`。
- `01-static-red.txt`：静态门 `RED_EXIT=1`，点名 3 项红（计数≠4、`costPrice` 专项、全局 `item.*Price.toFixed` 正则）。
- `02-restore-sha256.txt`：`cp` 复原后 SHA256 = `7b3d87e7…eba6`，与注入前逐字节一致。
- `03-static-green.txt`：复跑 `GREEN_EXIT=0`，7 用例绿。

注入器 `inject.mjs`（scratch）只匹配纯 ASCII 子串 `fmtAmount(item.costPrice)`，命中数≠1 直接 `exit 9`；复原用 `cp`（非 `sed -i`，避免 CRLF 归一致使 SHA256 假阴）。

## browser/ —— 页面不再白屏的实证（渲染级 + 真实浏览器 DOM）

`build:h5` 出产物后，用独立 node 静态服务（5181，服务本工作树 `dist/build/h5`）+ browser-use MCP **实开**页面片段：

- `render-demo-fixed.html`：真实 SFC 的 price-row 模板片段 + 真实 `src/utils/format.ts`（esbuild 转译，非手抄）经 Vue SSR 渲染，喂后端 DECIMAL 下发形态数据（字符串 / null / 0 / undefined）。
- `render-demo-dom-readback.txt`：`mcp__browser-use__evaluate_script` 回读真实浏览器 DOM —— 8 个价格单元格：null/undefined → `¥—`（×2）、有效 0 → `¥0.00`（×2）、字符串 `'12.34'` → `¥12.34`。
- `render-demo-a11y-snapshot.txt`：`take_snapshot` 无障碍树结构记录。

**未取到 PNG 截图**：in-app browser viewport 为 hidden（`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`），截图动作被拒；改用 DOM 文本回读 + a11y 快照作为浏览器级实证。**完整登录态真机/整页 E2E 未验**（无 :8080 后端在线、无登录态 token），详见回传卡 §七。
