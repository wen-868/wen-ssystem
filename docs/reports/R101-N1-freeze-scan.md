# R101-N1 · 冻结版色板 —— 静态取证附件

> 日期：2026-09-22 ｜ 取证方：林夕（UI/UX）｜ 性质：**只读取证 + 纯数学计算**，零代码改动
> 主仓：`D:/Users/ZXQL/ZXQL-MS/wen-ssystem`（`main` @ `eb33bfe9`）
> 复跑脚本：`D:/Users/ZXQL/ZXQL-MS/_n1_scan.cjs`、`_n1_scan2.cjs`、`_n1_scan3.cjs`、`_n1_appmobile.cjs`、`_n1_ratio.cjs`

---

## §0 口径与局限（先读）

| 项 | 说明 |
|---|---|
| 扫描范围 | 四端 `admin-web` / `saas-admin` / `app-mobile` / `website`，扩展名 `.css` `.scss` `.vue`，排除 `node_modules` / `dist` / `dist-*` / `.git` |
| 扫描文件数 | **1595**（其中样式 1250 + `.vue` 345） |
| CSS 自定义属性定义总数 | **678** |
| 「定义」识别 | `--name:` 形式；`var(--name)` 的**引用**不计入定义 |
| **本轮未做的** | 🔴 **未复跑浏览器 computed**（派出的实测 worker 撞 GitHub/模型侧 429 限流终止）。本附件中的「当前值」为**源码声明值**；R8.1 要求以 computed 定论，故凡是「端内存在多份定义」的行，一律标注「需 computed 定论」，**不用源码下结论** |
| 已有的 computed 来源 | H-2 阶段 1 同一次 measure 运行（`docs/reports/R101-H2-measure.cjs` + `R101-H2-token-inventory.md`），本卡引用处均标明「H-2 实测」 |
| 已知误报 | `--primary` 在 `admin-web/src/styles.css:538/704/1215/1216` 的 4 处「定义」是选择器文本（`:hover {`）误匹配，非真定义；`--text-regular = 14px` 是字号 token 非颜色。已在正文剔除 |

---

## §1 冻结版四端映射表（12 语义 × 4 端）

**现值列口径**：源码声明值（`@文件:行号`）；标 ⚠️ 者表示该端内**存在第二份定义**，实际生效值以 H-2 实测列为准。

| 语义 | **目标值（冻结）** | admin-web | saas-admin | app-mobile（SCSS `$`） | website |
|---|---|---|---|---|---|
| **主文字** | `#000000` | `--text-primary` @`tokens.css:73` = `#000000` ✅**已是目标值** | `--text-primary` @`tokens.css:109` = `#000000` ✅<br>⚠️ `App.vue:7` 另有 `#1a1a2e` | `$uni-text-color` @`uni.scss:66` = `#171717` → **改** | `--text` @`global.css:8` = `#1f2937` → **改** |
| **次文字** | `#444444` | `--text-secondary` @`tokens.css:74` = `#444444` ✅ | `--text-secondary` @`tokens.css:110` = `#444444` ✅<br>⚠️ `App.vue:8` 另有 `#6b7280` | `$uni-text-color-secondary` @`uni.scss:67` = `#525252` → **改** | `--text-secondary` @`global.css:9` = `#6b7280` → **改** |
| **弱文字 / 占位** | `#6D6D6D` | `--text-muted` @`tokens.css:80` = `#6d6d6d` ✅<br>`--text-placeholder` @`tokens.css:90` = `#6D6D6D` ✅ | `--text-muted` @`tokens.css:111` = `#6D6D6D` ✅<br>`--text-placeholder` @`tokens.css:112` = `#767676` → **改** | `$uni-text-color-grey` @`uni.scss:68` = `#737373` → **改**<br>`$uni-text-color-placeholder` @`uni.scss:69` = `#A3A3A3` → **改**（现值仅 2.85，严重不达标）<br>`$uni-text-color-light` @`uni.scss:70` = `#A3A3A3` → **改** | **缺失** → 需新增 |
| **页面底** | `#F5F5F5` | `--bg-page` @`tokens.css:104` = `#F5F5F5`（=目标值）<br>⚠️ `styles.css:1184` = `#F2F5FC` **（生效，蓝调）** | `--bg-page` @`tokens.css:137` = `#f7f7f7` → **改**<br>⚠️ `App.vue:9` 另有 `#f5f7fa` | `$uni-bg-color-grey` @`uni.scss:76` = `#F5F5F7` → **改** | `--bg-alt` @`global.css:11` = `#f8fafc` → **改** |
| **卡片底** | `#FFFFFF` | `--bg-card` @`tokens.css:105` = `#FFFFFF` ✅ | `--bg-card` @`tokens.css:138` = `#FFFFFF` ✅ | —（无对应语义） | `--bg` @`global.css:10` = `#ffffff` ✅ |
| **侧栏底** | `#FFFFFF` | `--bg-sidebar` @`tokens.css:108` = `#FAFAFA` → **改** | `--sidebar-bg` @`tokens.css:120` = `#FFFFFF` ✅<br>`--bg-sidebar` @`tokens.css:141` = `#FFFFFF` ✅ | — | — |
| **主色 primary** | `#365FCE` | `--color-primary` @`tokens.css:15` = `#3F6FEF` → **改** | `--color-primary` @`tokens.css:20` = `#2563eb` → **改** | `$uni-color-primary` @`uni.scss:8` = `#2563EB` → **改** | `--primary` @`global.css:4` = `#1a73e8` → **改** |
| **成功 success** | `#0A7655` | `--color-success` @`tokens.css:39` = `#0EA879` → **改** | `--color-success` @`tokens.css:63` = `#16a34a` → **改** | `$uni-color-success` @`uni.scss:15` = `#3A9D5C` → **改** | **缺失**（可选） |
| **警告 warning** | `#8E5D27` | `--color-warning` @`tokens.css:41` = `#D48B3A` → **改** | `--color-warning` @`tokens.css:65` = `#ea580c` → **改** | `$uni-color-warning` @`uni.scss:17` = `#C8803A` → **改** | **缺失**（可选） |
| **危险 danger** | `#C0392B` | `--color-danger` @`tokens.css:43` = `#C0392B` ✅**已是目标值** | `--color-danger` @`tokens.css:67` = `#dc2626` → **改** | `$uni-color-error` @`uni.scss:19` = `#C45050` → **改** | **缺失**（可选） |
| **边框·常规** | `#E2E2E2` | `--border-normal` @`tokens.css:115` = `#E2E2E2` ✅ | `--border-normal` @`tokens.css:148` = `#E2E2E2` ✅ | **未检出** `$uni-border-*` → **需新增** | `--border` @`global.css:13` = `#e5e7eb` → **改** |
| **边框·输入/强** | `#888888` | `--input-border` @`tokens.css:280` = `#888888` ✅ | `--input-border` @`tokens.css:285` = `#888888` ✅ | **未检出** → **需新增** | **缺失** → 需新增 |

**统计**：12 语义 × 4 端 = 48 格；其中 **已等于目标值 11 格**、**需改值 22 格**、**需新增 8 格**、**不适用（无该语义）7 格**。

> 🔴 **一处直接冲突（必须上报）**：`--border-normal` 在 N-1 被冻结为 `#E2E2E2`（＝两端现值、不改），而凌舟 §五 已作废 S3-67「改值项＝空集」结论、明确指出 **「改值项非空：`--border-normal` 族（CashierView 6 类 / 27 实例 / 1.22–1.30）」**。⇒ **两单对同一 token 的要求相反**，阶段 2 必须合并同批处置（见回传卡 §4 批次 4）。

---

## §2 `--bg-page` 收敛清单（凌舟补充清单第 1 项）

### 2.1 定义处：**4 处**（凌舟已知 2 处，实为 4 处）

| # | 端 | 落点 | 值 | 是否生效 |
|---|---|---|---|---|
| 1 | admin-web | `src/styles/tokens.css:104` | `#F5F5F5` | ❌ 被 #2 覆盖 |
| 2 | admin-web | `src/styles.css:1184` | `#F2F5FC` | ✅ **生效**（H-2 实测 `rgb(242,245,252)` 印证） |
| 3 | saas-admin | `src/App.vue:9` | `#f5f7fa` | ❌ 被 #4 覆盖 |
| 4 | saas-admin | `src/styles/tokens.css:137` | `#f7f7f7` | ✅ **生效**（H-2 实测 `rgb(247,247,247)` 印证） |

### 2.2 引用点：**47 个**（`var(--bg-page)` 全量，四端 `.css/.scss/.vue/.ts`）

分布（前 16 条示例，完整清单见 `_n1_scan.cjs` 输出）：
`admin-web/src/styles.css:57 / :115 / :1194`、`admin-web/src/layouts/MainLayout.vue:708 / :1210`、`admin-web/src/components/AiChat/AiChatWindow.vue:448`、`admin-web/src/views/components/PlatformPanel.vue:421`、`admin-web/src/views/customer/CustomerVisits.vue:512 / :529`、`admin-web/src/views/finance/FinanceDashboard.vue:305`、`PaymentsNewView.vue:415`、`ReceiptsView.vue:425`、`ReceivablesPayables.vue:333`、`admin-web/src/views/instant-retail/InstantRetailOrderBoard.vue:645 / :848` …（共 47）

### 2.3 收敛方案

| 步骤 | 动作 | 理由 |
|---|---|---|
| 1 | **删除** `admin-web/src/styles.css:1184` 的 `--bg-page: #F2F5FC` | 保留 `tokens.css:104` 的 `#F5F5F5`（＝冻结目标值）。删后 admin-web 页面底**自动**变为 `#F5F5F5`，**无需再改任何值** |
| 2 | **删除** `saas-admin/src/App.vue:9` 的 `--bg-page: #f5f7fa` | 保留 `tokens.css:137`；删后再把 `tokens.css:137` 由 `#f7f7f7` 改为 `#F5F5F5`（一次改值） |
| 3 | 同步删除 `styles.css:1185/1186/1187` 的 `--table-header-bg` / `--table-header-text` / `--table-row-hover` 三行 | 与 `--bg-page` 同一段重复块（详见 §3），一次删净 |
| 4 | 影响面 | 47 个引用点**全部不受影响**（它们读 `var(--bg-page)`，删除重复定义只改变解析到哪个值，不改变引用合法性） |

---

## §3 全仓「同 token 多次定义」扫描 —— 给数字

### 3.1 端内重复（同一端内同名 token 定义多次）← **本单真正关心的形态**

| 口径 | 数字 |
|---|---|
| 端内同名多次定义的 token 数 | **43** |
| 其中取值不同（端内**真冲突**）| **33** |
| **排除 `--el-*` 后**（`--el-*` 是 EP 变量，覆盖属预期）：多次定义 / 真冲突 | **26 / 21** |
| 涉及文件数 | **34** |
| 端内重复但**同值**（可安全去重、零风险）| 9（未排除 `--el-*`） |

### 3.2 端内真冲突明细（排除 `--el-*` 的**自有 token**，阶段 2 必须收敛）

| 端 | token | 各次落点与取值 |
|---|---|---|
| admin-web | `--bg-page` | `tokens.css:104` `#F5F5F5` ←→ `styles.css:1184` `#F2F5FC` |
| admin-web | `--table-header-bg` | `tokens.css:270` `#F8F8F8` ←→ `styles.css:1185` `#F4F7FF` |
| admin-web | `--table-header-text` | `tokens.css:271` `#444444` ←→ `styles.css:1186` `#333333` |
| admin-web | `--table-row-hover` | `tokens.css:272` `#F8F8F8` ←→ `styles.css:1187` `#F7FAFF` |
| **saas-admin** | **`--text-primary`** | `tokens.css:109` `#000000` ←→ **`App.vue:7` `#1a1a2e`** |
| **saas-admin** | **`--text-secondary`** | `tokens.css:110` `#444444` ←→ **`App.vue:8` `#6b7280`** |
| **saas-admin** | **`--bg-page`** | `tokens.css:137` `#f7f7f7` ←→ **`App.vue:9` `#f5f7fa`** |
| saas-admin | `--text` / `--text-h` / `--bg` / `--border` | `src/style.css:2/3/4/5` ←→ `src/style.css:35/36/37/38`（疑为深色模式残留，凌舟议题 4① 已裁定「删前须先证零引用」） |
| saas-admin | `--tag-padding` | `tokens.css:298` `2px 10px` ←→ `tokens.css:315` `3px 8px` |

> 🔴 **对凌舟验收卡 §三 的一处更正建议**：验收表「端内是否真的一致」对 saas-admin 抽查了 `--text-primary`/`--text-secondary`/`--bg-page`，结论为「✅ 与其表一致（saas `#000000`/`#444444`…）」。但**该抽查只读了 `tokens.css`，未读 `saas-admin/src/App.vue:7-9`** —— 那里存在第二份定义且取值完全不同。
> H-2 阶段 1 实测（`rgb(0,0,0)` / `rgb(68,68,68)` / `rgb(247,247,247)`）显示 **`tokens.css` 侧生效**，故最终结论**不受影响**；但「端内一致」这一判断的**证据链原本是缺一环的**，本轮补齐。

### 3.3 跨端对照（非「端内重复」，仅作背景）

| 口径 | 数字 |
|---|---|
| 在 ≥2 个端被定义的 token 名 | **157** |
| 其中各端取值不同（＝H-2 的「同语义不同值」族）| **72** |

### 3.4 SCSS 变量（app-mobile）

| 口径 | 数字 |
|---|---|
| `$` 变量定义总数（`uni.scss`，501 行）| **253** |
| 多次定义的 `$` 变量名 | 117（**取值冲突 0** —— SCSS 变量后定义覆盖前定义，无 --el-* 式分散覆盖）|

---

## §4 app-mobile 文字层命名方案

### 4.1 🔴 关键事实：**文字层已存在，不需要「新增一套」**

凌舟议题 2 裁定「新增 SCSS `$uni-color-*-text`」。实测：`app-mobile/src/uni.scss:66-72` **已有专用的文字层变量族**：

| 变量 | 现值 | 行号 | 对应语义 | H-2 实测/computed |
|---|---|---|---|---|
| `$uni-text-color` | `#171717` | `uni.scss:66` | 主文字 | → 目标 `#000000` |
| `$uni-text-color-secondary` | `#525252` | `uni.scss:67` | 次文字 | → 目标 `#444444` |
| `$uni-text-color-grey` | `#737373` | `uni.scss:68` | 弱文字 | → 目标 `#6D6D6D` |
| `$uni-text-color-placeholder` | `#A3A3A3` | `uni.scss:69` | 占位字 | → 目标 `#6D6D6D` |
| `$uni-text-color-light` | `#A3A3A3` | `uni.scss:70` | 弱化的文字 | → 目标 `#6D6D6D` |
| `$uni-text-color-inverse` | `#FFFFFF` | `uni.scss:71` | 反白字 | 不动（＝卡片底/反白） |
| `$uni-text-color-link` | `#2563EB` | `uni.scss:72` | 链接字 | → 目标 `#365FCE` |

⇒ **建议沿用现有 `$uni-text-color-*` 而非新增 `$uni-color-*-text`**（详见回传卡「附：需凌舟拍板事项」A）。理由：新增会与已存在的 7 个文字变量**并存出第二套文字 token**，恰好违背「一语义一值」。

### 4.2 引用点全量

| 口径 | 数字 |
|---|---|
| app-mobile 内 `.vue`/`.scss` 文件数 | 121 |
| `color:` 声明总数 | **2528** |
| 其中**使用 SCSS 变量**（`$...`）| **2526** |
| 其中**裸 hex / rgb()** | **2**（`uni.scss:192` `color: #fff`、`uni.scss:331` `color: #FFFFFF`）|

⇒ **改动面极小**：2526 处引用全部走变量，阶段 2 只需改 `uni.scss:66-72` 的 **7 个变量值**，2526 个引用点**一处都不用动**。这正是「禁改 `$uni-color-*`」裁定的价值 —— `$uni-color-*` 承载按钮底/渐变/图标，改它会牵动非文字用途。

### 4.3 排除项（非文字用途，不得随文字层改）

`$uni-color-primary` `@8`、`$uni-gradient-blue` `@12`、`$uni-color-success` `@15`、`$uni-color-warning` `@17`、`$uni-color-error` `@19` —— 这些同时被用作**按钮底/渐变/图标填充**，凌舟裁定「禁改」；但状态色统一（`#365FCE`/`#0A7655`/`#8E5D27`/`#C0392B`）本身是 N-1 目标，二者**不矛盾**：状态色统一改的是**值**，禁改条文约束的是「**不要为了文字对比度去改 `$uni-color-*`**」。

### 4.4 需**新增**的两项（app-mobile 确实没有）

| 变量（建议名）| 目标值 | 说明 |
|---|---|---|
| `$uni-border-color` | `#E2E2E2` | 边框·常规，现未检出 |
| `$uni-border-color-input` | `#888888` | 边框·输入/强（1.4.11），凌舟已明示「app-mobile 需新增」 |

---

## §5 冻结定值的对比度矩阵（纯数学，可复跑）

脚本：`D:/Users/ZXQL/ZXQL-MS/_n1_ratio.cjs`（WCAG 2.1 相对亮度公式）

### 5.1 目标值 × 常规浅底（最严 = `#FFFFFF`/`#F5F5F5`/`#F0F0F0` 三者最小）

| 语义 | 目标值 | 类型 | 阈值 | #FFFFFF | #F5F5F5 | #F0F0F0 | **最严** | 达标 |
|---|---|---|---|---|---|---|---|---|
| 主文字 | `#000000` | 文字 | 4.5 | 21.00 | 19.26 | 18.43 | **18.43** | ✅ |
| 次文字 | `#444444` | 文字 | 4.5 | 9.74 | 8.93 | 8.55 | **8.55** | ✅ |
| 弱文字·占位 | `#6D6D6D` | 文字 | 4.5 | 5.17 | 4.75 | 4.54 | **4.54** | ✅（余量仅 0.04） |
| 主色 | `#365FCE` | 文字 | 4.5 | 5.70 | 5.23 | 5.00 | **5.00** | ✅ |
| 成功 | `#0A7655` | 文字 | 4.5 | 5.62 | 5.16 | 4.93 | **4.93** | ✅ |
| 警告 | `#8E5D27` | 文字 | 4.5 | 5.61 | 5.14 | 4.92 | **4.92** | ✅ |
| 危险 | `#C0392B` | 文字 | 4.5 | 5.44 | 4.99 | 4.77 | **4.77** | ✅ |
| 边框·常规 | `#E2E2E2` | 非文本 | 3.0 | 1.30 | 1.19 | 1.14 | **1.14** | ❌ **不达标** |
| 边框·输入 | `#888888` | 非文本 | 3.0 | 3.54 | 3.25 | 3.11 | **3.11** | ✅ |

> ⚠️ `#E2E2E2` 判读：它是**装饰性分隔/描边**，WCAG 1.4.11 对「纯装饰」不适用；凌舟已裁定「不采纳 `#E5E5E5`，变更纯属 churn」，且 S3-63/67 已分析过。**如实记录不达标，不改值、不改阈值**（红线：不得为过门禁改背景/装饰）。

### 5.2 白字压状态实底（E-3 漏掉的整类）

| 底 | 比值 | 达标（≥4.5）|
|---|---|---|
| 主色 `#365FCE` | **5.70** | ✅ |
| 成功 `#0A7655` | **5.62** | ✅ |
| 警告 `#8E5D27` | **5.61** | ✅ |
| 危险 `#C0392B` | **5.44** | ✅ |

⇒ 凌舟 §3.2 备注「实底方向随统一色板一起达标（≥5.4）」**本轮以计算复验成立**。

### 5.3 R8.3 参照：状态软底（**仅用于发现风险，不得用于判达标**）

软底按「状态色 12% 混白」近似：

| 软底 | 主文字 `#000000` | 次文字 `#444444` | **弱文字 `#6D6D6D`** | 本色文字 |
|---|---|---|---|---|
| 主色 soft `#e7ecf9` | 17.76 | 8.24 | **4.38 ❌** | 4.82 |
| 成功 soft `#e2efeb` | 17.78 | 8.25 | **4.38 ❌** | 4.76 |
| 警告 soft `#f1ece5` | 17.87 | 8.29 | **4.40 ❌** | 4.77 |
| 危险 soft `#f7e7e6` | 17.53 | 8.13 | **4.32 ❌** | 4.54 |

⇒ **用数据坐实凌舟议题 3 的裁决**：弱文字/占位字在**四种状态软底上全部 <4.5**（4.32–4.40），故「软底上只用主文字/次文字，不放弱文字/占位字」**必须立为硬性规则**，且阶段 2 需落成可执行扫描守卫。

### 5.4 页面底 vs 卡片底（分区可辨识）

`#F5F5F5` vs `#FFFFFF` = **1.09**；现值 `#F2F5FC` vs `#FFFFFF` = **1.09**。
⇒ **去蓝调不改变页面底/卡片底的分区对比度**（两者同为 1.09），改 `#F2F5FC → #F5F5F5` **不引入可辨识性风险**。

---

## §6 复跑命令

```bash
node D:/Users/ZXQL/ZXQL-MS/_n1_scan3.cjs     # 端内重复（含 .vue）：43 / 33 / 26 / 21 / 34
node D:/Users/ZXQL/ZXQL-MS/_n1_scan2.cjs     # 端内+跨端拆分 + 12语义落点 + $uni-* 变量
node D:/Users/ZXQL/ZXQL-MS/_n1_scan.cjs      # --bg-page 4 处定义 + 47 引用点
node D:/Users/ZXQL/ZXQL-MS/_n1_appmobile.cjs # app-mobile 文字层 + 2528 引用点 + website
node D:/Users/ZXQL/ZXQL-MS/_n1_ratio.cjs     # 全部对比度计算
```
