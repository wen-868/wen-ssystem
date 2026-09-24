# R101-S3-67 computed 矩阵 v2（凌舟用浏览器实测，2026-09-25）

> 依据：`docs/tasks/cards/R101-派单-20260925-D2-S3-67.md`（Issue #97）——**只出矩阵、不改值**。
> 性质：**取证 + 分析**（凌舟执行；本卡不含任何代码/色值改动）。
> 前作：`docs/tasks/cards/R101-S3-67-computed矩阵.md`（2026-09-21，Chromium / 2 路由）。
> 原始产物：`docs/evidence/S3-67/raw/**`（baseline/sentinel JSON + 探针文本 + 截图），工具见 `docs/evidence/S3-67/tools/`。

## 一、方法与真实运行条件（先说清"怎么量出来的"）

| 项 | 值 |
|---|---|
| 环境 | 本地 `mock 后端 :8081` + `admin-web dev :5173`（vite proxy → mock） |
| 引擎 | **firefox 153.0** 与 **chromium（Playwright headless）** 各跑一轮 |
| 登录 | `admin` / `admin123`（真实登录成功，非 mock 跳过） |
| 路由阶段 | `/dashboard`、`/customers`、`/orders`、`/instant-retail/config`、`/system/config`、`/pos/cashier`(+`openPay`/`openTrace` 两个前置动作态)，共 8 个阶段 |
| 读法 | 每个控件逐实例读 `getComputedStyle` 的**四边 border 色 / box-shadow 首色**、自身底与祖先底，并计算与**有效背景**的对比度 |
| 与旧卡的差别 | 旧卡只覆盖 2 个路由、只 chromium；本卡新增**现金台三态**与**跨引擎对照** |

**探针加固（凌舟）**：工具原实现 `goto` 后立即 `fill`，在冷启动/首轮 vite transform 下会 30s 超时（实测两次失败）。已加"显式等登录表单可见 + 默认超时 60s"两处等待后跑通；加固处有行内注释留痕。

## 二、基线矩阵（运行期实测，按控件族）

判定口径：WCAG 1.4.11 非文本对比 **≥3:1**；比值取"边界色 vs 该控件实际呈现的背景（优先自身底）"。

| 控件族 | 选择器 | 实测边界来源与取值 | 有效背景 | 比值 | 判定 |
|---|---|---|---|---|---|
| EP 输入框 | `.el-input__wrapper` | box-shadow 首色 `#888888` | `#FFFFFF` | **3.54** | ✅ |
| EP 下拉 | `.el-select__wrapper` | box-shadow 首色 `#888888` | `#FFFFFF` | **3.54** | ✅ |
| EP 圆形小按钮 | `.el-button.is-circle` | border 边色 `#888888` | `#FFFFFF` | **3.54** | ✅ |
| EP 默认按钮 | `.el-button--default` | border 边色 `#888888` | `#FFFFFF` | **3.54** | ✅ |
| EP 主按钮 | `.el-button--primary` | **填充色自身** `#3F6FEF` | `#3F6FEF` | 1.00（对被填充面 3.81–4.07） | —（填充型，1.4.11 不按"边框"判） |
| EP 表格表头 | `.el-table th.el-table__cell` | `#E2E2E2` 族 | `#FFFFFF` | **1.21** | ❌ |
| EP 表格单元格 | `.el-table td.el-table__cell` | `#E2E2E2` 族 | `#FFFFFF` | **1.30** | ❌ |
| EP 卡片容器 | `.el-card` | `#F0F0F0` | `#FFFFFF` | 1.04 | —（容器描边，非控件识别边界） |
| AI 面板文本域 | `.ai-input-box .el-textarea__inner` | 被 `--border-light` 接管（box-shadow = none） | `#FFFFFF` | **1.00** | ❌（与 S3-67 族相关，见 §四） |
| 收银台·商品搜索 | `.product-search-input .el-input__wrapper` | `#E2E2E2` 族 | `#FFFFFF` | **1.30** | ❌ |
| 收银台·支付码输入 | `.pay-code-input .el-input__wrapper` | `#E2E2E2` 族 | `#FFFFFF` | **1.22** | ❌ |
| 收银台·数量按钮 | `.qty-btn` | `#E2E2E2` 族 | `#FFFFFF` | **1.30** | ❌ |
| 收银台·数字键盘 | `.numpad-key`（14 实例） | `#E2E2E2` 族 | `#FFFFFF` | **1.30** | ❌ |
| 收银台·支付方式卡（未选中） | `.pay-method-card` | `#E2E2E2` 族 | `#FFFFFF` | **1.30** | ❌ |
| 收银台·支付方式卡（选中） | `.pay-method-card.active` | `#3F6FEF` 填充 | 自身 | **4.12** | ✅ |
| 收银台·购物车汇总 | `.cart-summary`（虚线分隔线引用点 `CashierView.vue:2148`） | `#E2E2E2` 族 | `#FFFFFF` | **1.30** | ❌ |

**结论（决策输入）**：`--border-normal` / `--table-border` = **`#E2E2E2`** 这一族在**运行期**真实落在 **① 表格表头/单元格 ② 收银台 6 类控件** 上，实测 **1.21–1.30**，**均 < 3:1**；而 `--el-border-color` / `--input-border` = `#888888` 族的输入类控件已是 **3.54**（达标）。

⇒ 若日后要动这一族，**影响面 = 上表被标 ❌ 的 8 处**（表格 2 + 收银台 6），不是"全站"。这与 S3-67 卡"先出矩阵再改值"的入场条件一致：**矩阵已出，但改值仍未获授权**。

## 三、变量归属：工具哨兵轮**无效**，改用**规则级权威取证**定论（2026-09-25 补）

### 3.1 工具哨兵轮为何无效（如实报备）

6 个变量的哨兵轮**全部**报「变化 N 项，**变了但不是哨兵色**」，**没有任何控件被归因成功**。根因：基线轮多数阶段 `found=0`（控件尚未渲染），哨兵轮才渲染出值 ⇒ 工具把"**后渲染出来**"当成"**被变量改了**"（firefox 报 14 项、chromium 报 2 项，正是时序差）。**该轮结论一律不采信。**

### 3.2 改用两种权威方法（都属计算/引擎级，非"读源码猜层叠"）

**方法 A：CDP `CSS.getMatchedStylesForNode`**（Chromium 引擎给出的**真正匹配的规则序列**，按层叠顺序），对每个控件列出所有含 `border`/`box-shadow` 的匹配规则并判断胜出者。
**方法 B：哨兵注入 + computed 回读**（把候选变量写成 `#010203`，看 computed 是否变成 `rgb(1,2,3)`；用于**验证**方法 A 的结论）。

证据：`docs/evidence/S3-67/raw/attrib-cdp-styles.txt`。

### 3.3 结论（现金台＝D2 的决策面）

| 控件 | 胜出的规则（CDP 实际匹配） | **驱动变量** | computed | 比值 |
|---|---|---|---|---|
| `.product-search-input .el-input__wrapper`（收银台） | `.product-search-input[data-v-…] .el-input__wrapper`（特异性 **0,2,0**，高于 EP 的 0,1,0） | **`--border-normal`** | `rgb(226,226,226)` | 1.30 ❌ |
| `.qty-btn` | `.qty-btn[data-v-…]` → `border: 1px solid var(--border-normal)` | **`--border-normal`** | `rgb(226,226,226)` | 1.30 ❌ |
| `.cart-summary` | `.cart-summary[data-v-…]` → `border-top: 1px dashed var(--border-normal)` | **`--border-normal`**（方法 B 注入即翻转 ★） | `rgb(226,226,226)` | 1.30 ❌ |
| 通用 `.el-input__wrapper`（`/customers` 等） | app 的 `.el-input__wrapper,.el-select__wrapper{…var(--input-border)…}` 与 EP 的 `.el-input__wrapper{…var(--el-input-border-color,var(--el-border-color))…}` **同特异性**，EP **后置**胜出 | **`--el-border-color`** | `rgb(136,136,136)` | 3.54 ✅ |
| `.el-table th/td.el-table__cell` | CDP 未列出含 border 的匹配规则 ⇒ 边界来自 EP 表格变量/浏览器默认，**非本次候选 6 变量** | 未定（**不影响**本卡结论） | 见表 §二 | 1.21/1.30 ❌ |

**⇒ 决策口径（比"值相同无法区分"更硬）**：`--border-normal` **确实**驱动收银台 4 类控件（方法 A 给出特异性更高的胜出规则、方法 B 在 `.cart-summary` 上实测翻转）；`--border-normal` 与 `--table-border` 同值 `#E2E2E2`，因此**只改 `--table-border` 不会修好收银台**，只改 `--border-normal` 也**不会**影响通用输入框（那些读 `--el-border-color`）。

### 3.4 工具缺陷（登记，不阻断本卡）

工具的哨兵轮需修：① 只统计"基线轮与哨兵轮**都已渲染**"的元素交集；② 注入前先禁用过渡（`transition:none`，否则读到动画中间帧——本次 `.qty-btn` 在未禁过渡的临时探针上就出现过"注入不翻转"的假象，`.cart-summary` 无过渡则立即翻转）。修好前，**工具输出的归属列不得采信**，以本卡 §3.3 的 CDP 结论为准。

## 四、与旧卡（2026-09-21）的关系

1. 旧卡结论（输入类 3.54 达标、表格/容器偏低）**与本卡一致**，本卡在其基础上**扩大了路由覆盖**并给出**跨引擎对照**；
2. 本卡新增的**收银台 6 类控件 <3:1** 为旧卡未覆盖面（旧卡 `/products`、`/instant-retail/config` 为目标控件未渲染，记 `missing`）；
3. **同一处更正**：旧卡把 `.el-textarea__inner` 记为 `1.00`，本卡确认其成因是**被 `--border-light`（`#F0F0F0`）接管、`box-shadow: none`**，与 `--el-border-color` 族无关（与 S3-63 的例外登记一致）。

## 五、未完成与边界（如实）

1. **归属轮待重跑**（§三），修法与判据已写明；
2. **firefox 的多数阶段 `found=0`**：目标控件在 firefox 下未渲染（或渲染更慢），故 firefox 轮**只能作对照、不能单独作结论**；引用台账以 **chromium** 轮为准；
3. 本卡**未改任何源码/色值/token**，也未新增门禁；只动 `docs/evidence/S3-67/raw/**`（产物）与工具里的两处等待。

## 六、红线自查

未改 `admin-web/src/**`、未改任何 token/样式、未改 `docs/migrations/**`；工具改动仅"等待时序"两处且带注释；`git status` 仅本目录与工具文件。

派单人：凌舟（总负责人）｜2026-09-25
