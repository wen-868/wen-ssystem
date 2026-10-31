# 总后台令牌与视觉漂移收口报告

> 单号：**TOTAL-SAAS-UI-TOKENS-01**
> 执行人：**林夕**（总台 `saas-admin` 界面与设计规范 owner）
> 日期：2026-10-31
> 范围：`saas-admin/src/**`（视图 / 组件 / 样式）、`docs/设计/**`
> 未触碰：后端、SQL、平台权限判定

---

## 一、结论先行

| 指标 | 收口前 | 收口后 |
|---|---|---|
| ① 未定义令牌引用 | 1 | **0** |
| ② 硬编码色值 | 65 | **0** |
| ③ 硬编码圆角 | 26 | **0** |
| ③ 硬编码阴影 | 1 | **0** |
| **本仓可自决项合计** | **93** | **0** |
| ④ 与 admin-web 同名不同值 | 61 | 61（决策项，见 §五） |
| ⑤ Element 跨体系漂移 | 8 | 8（决策项，附修复草案，见 §五） |

- 本仓代码层面的令牌漂移**已清零**，且留下可复跑的审计脚本作为长期门禁。
- 另发现并修复一处**隐蔽的 P0**：`App.vue` 的 `:root` 静默覆盖了 `tokens.css` 的可达性修订值（详见 §二）。
- ④、⑤ 属**跨产品 / 跨体系对齐**，涉及品牌口径与全局视觉变更，不在本单自决范围内，已备好决策材料。

---

## 二、核心发现：P0 —— 令牌「改了却不生效」

### 现象

`saas-admin/src/App.vue` 中存在第二个 `:root` 块，重定义了三个基线令牌：

```css
:root {
  --text-primary: #1a1a2e;    /* tokens.css: #000000 */
  --text-secondary: #6b7280;  /* tokens.css: #444444 */
  --bg-page: #f5f7fa;         /* tokens.css: #f7f7f7 */
}
```

### 根因

`main.ts` 的样式加载顺序为 `element-plus` → `tokens.css` → `components.css` → `App.vue`。
`App.vue` 的 `:root` 与 `tokens.css` 的 `:root` **特异性相同且后加载**，因此旧值静默胜出 ——
`tokens.css` 里 S3-47 / S3-53 / S3-54 一系列可达性修订**从未真正生效**。

### 实测影响（`node docs/设计/contrast.mjs`）

| 组别 | 前景 | 背景 | 对比度 | AA 正文 4.5:1 |
|---|---|---|---|---|
| 覆盖值（现状） | `#6b7280` | `#f5f7fa` | 4.50:1 | 通过（余量耗尽） |
| 令牌值（修复后） | `#444444` | `#f7f7f7` | **9.09:1** | 通过 |
| 覆盖值（现状） | `#6b7280` | `#ffffff` | 4.83:1 | 通过 |
| 令牌值（修复后） | `#444444` | `#ffffff` | **9.74:1** | 通过 |
| 残留 Element 灰 | `#909399` | `#ffffff` | **3.08:1** | ❌ **不达标** |

> 注：覆盖值仍压线达标，故此项定性为「可达性余量被腰斩」而非「不达标」；
> 真正的不达标是残留的 `#909399`（3.08:1），已在本次一并清除。

### 处置

删除 `App.vue` 的 `:root` 重定义块，基线色**单一真源**回归 `tokens.css`，
`body` 仍以 `var()` 引用，切换无缝。已在原位置留注释说明「勿再开第二真源」。

---

## 三、修改清单（18 个文件）

### 1. 令牌体系

| 文件 | 修改 |
|---|---|
| `saas-admin/src/App.vue` | 删除 `:root` 第二真源（P0），补处置注释 |
| `saas-admin/src/styles/tokens.css` | 新增 `--color-star: #FF9900`（星级评分专用，取值沿用 EP 默认色，视觉零位移） |

### 2. 残留 Element 旧色 → 语义令牌（`#909399` 为 3.08:1 不达标项）

| 文件 | 处数 | 映射 |
|---|---|---|
| `views/PlatformReviews.vue` | 2 | `#909399`→`--text-muted`；`#f5f7fa`→`--bg-soft`；`#ff9900`→`--color-star` |
| `views/ErrorLogs.vue` | 2 | `#909399`→`--text-muted`；`#f5f7fa`→`--bg-soft` |
| `views/MessageConfig.vue` | 2 | `#909399`→`--text-muted` |
| `views/AuditLogs.vue` | 1 | `#f5f7fa`→`--bg-soft` |
| `views/subscription/SubscriptionApplies.vue` | 2 | `#909399`→`--text-muted`；`#f5f7fa`→`--bg-soft` |
| `views/tenant/ApplicationDetail.vue` | 5 | `#F56C6C`→`--color-danger`；`#303133`→`--text-primary`；`#EBEEF5`→`--border-light`；`#C0C4CC`→`--gray-300`；`#909399`→`--text-muted` |
| `views/login/PlatformRegister.vue` | 4 | `#f0f2f5`→`--bg-page`；`#303133`→`--text-primary`；`#909399`→`--text-muted`；`#606266`→`--text-secondary` |
| `views/SubscriptionDetail.vue` / `views/Subscriptions.vue` | 2 | `#ef4444`→`--color-danger` |
| `views/MobilePreview.vue` | 12 | 预览器自身 UI：`#f0f2f5`→`--bg-page`；`#e4e7ed`→`--border-normal`；`#606266`→`--text-secondary`；`#409eff`→`--color-primary`；`#909399`→`--text-muted`；`#F56C6C`→`--color-danger`；`#8492a6`→`--text-muted`；`#fff`→`--text-inverse` |

> **MobilePreview 豁免说明**：该组件模拟一部手机，机身 `#1a1a1a`、Home 条 `#333`、
> 异形圆角（36/44/28/24/14px）属**被模拟的硬件造型**，不是主题色，改令牌反而破坏拟真，故豁免并在审计脚本中登记。

### 3. 图表/统计卡配色令牌化

`views/TenantUsage.vue` 原写死 Tailwind 默认色板（`#10b981` emerald-500 / `#f59e0b` amber-500 /
`#8b5cf6` violet-500 / `#ef4444` red-500），与 `tokens.css` 的 `--chart-2 #16a34a`、
`--chart-3 #ea580c`、`--chart-5 #7c3aed` 并不一致。

因 ECharts 只接受具体色值字符串，新增 `tokenColor()` 在**运行时解析 CSS 变量**，
单一真源仍是 `tokens.css`；兜底值取自令牌字面值本身，即便 `document` 缺失也不会退回旧色板。

### 4. 圆角 / 阴影归阶（26 + 1 处）

`views/Dashboard.vue`、`views/PackageForm.vue`、`styles/components.css`、
`views/ai-config/{AiBillingConfig,PlatformAiConfig}.vue` 中的游离值（2/3/4/5/7px）
统一归入令牌阶梯 `--radius-xs 4 / sm 6 / md 8 / lg 10 / xl 12 / 2xl 16 / pill 20`；
`box-shadow: 0 2px 8px rgba(0,0,0,.06)` 与 `--shadow-md` 等值，直接替换。

---

## 四、验证（真跑命令，非推断）

| 项 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `vue-tsc --noEmit -p tsconfig.json` | **0 错误** |
| 生产构建 | `vite build` | **✓ built in 1m59s**（仅有既有 chunk 体积提示） |
| 审计回归 | `node docs/设计/token-audit.mjs` | ①②③ **全 0** |
| 对比度实测 | `node docs/设计/contrast.mjs` | 不达标项由 1 → 0 |
| 产物校验 | `node docs/设计/check-dist.mjs` / `check-dist2.mjs` / `check-dist3.mjs` | 见下 |
| 层叠顺序 | `node docs/设计/check-cascade.mjs` | 3 个 `:root:root` 覆盖**均已生效** |

产物侧关键证据：

- 全局 CSS 中 `--text-primary=#000000`、`--text-secondary=#444444`、`--bg-page=#f7f7f7`、`--color-star=#FF9900`，旧值 `#1a1a2e` 出现 **0** 次。
- 我方清除的旧色板 `#10b981` / `#f59e0b` / `#8b5cf6` / `#ef4444` 在**全部产物**中均为 **0** 次。
- 新令牌在产物中确被引用：`var(--text-muted)`×9、`var(--bg-soft)`×3、`var(--radius-xs)`×5、`var(--shadow-md)`×1、`var(--radius-pill)`×1、`var(--text-inverse)`×1、`var(--color-star)`×1。
- 仍残留的 `#909399` / `#303133` / `#409eff` 等**全部来自 element-plus 自身变量定义**（`--el-color-info`、`--el-text-color-primary` 等），非本仓代码。

---

## 五、待决策（不在本单自决范围，需凌舟裁定）

### ⑤ Element Plus 跨体系漂移 —— 8 项（**最高价值发现**）

同一界面里，EP 原生组件（`el-button` / `el-tag` / `el-message` …）读 `--el-*`，
自研组件读 `--color-*` / `--text-*`，两组值不同 ⇒ **这就是「视觉漂移」的实质**。

现有 `tokens.css` 已用 `:root:root` 收口 3 个（`--el-color-primary` / `--el-text-color-placeholder` / `--el-text-color-secondary`，已验证生效），余下 8 项：

| 语义 | Element 令牌 | EP 原值 | 设计令牌 | 令牌值 |
|---|---|---|---|---|
| 成功 | `--el-color-success` | `#67c23a` | `--color-success` | `#16a34a` |
| 警告 | `--el-color-warning` | `#e6a23c` | `--color-warning` | `#ea580c` |
| 危险 | `--el-color-danger` | `#f56c6c` | `--color-danger` | `#dc2626` |
| **信息** | `--el-color-info` | `#909399` | `--color-info` | `#2563eb` |
| 主文本 | `--el-text-color-primary` | `#303133` | `--text-primary` | `#000000` |
| 常规文本 | `--el-text-color-regular` | `#606266` | `--text-secondary` | `#444444` |
| 边框 | `--el-border-color` | `#dcdfe6` | `--border-normal` | `#E2E2E2` |
| 圆角 | `--el-border-radius-base` | `4px` | `--radius-md` | `8px` |

⚠️ 其中「信息」是**语义冲突**而非单纯色差：EP 的 info 是中性灰（`#909399`），
设计系统的 info 是品牌蓝（`#2563eb`）。若整体对齐，`el-tag type="info"` 会由灰变蓝，属显著视觉变更。

**为何不由我直接改**：这会让全站 EP 组件观感同时变化，超出「设计规范收口」应有的影响面，
按流程应先评审。**建议**采用与现有 3 项同法（追加进 `:root:root` 块，一次性生效、不逐处打补丁）：

```css
:root:root {
  /* 现有 3 项保持不变 */
  --el-color-primary: var(--color-primary);
  --el-text-color-placeholder: var(--text-placeholder);
  --el-text-color-secondary: var(--text-muted);

  /* —— 待评审后启用 —— */
  --el-color-success: var(--color-success);
  --el-color-warning: var(--color-warning);
  --el-color-danger: var(--color-danger);
  /* --el-color-info 语义冲突（灰 vs 蓝），需设计先表态 */
  --el-text-color-primary: var(--text-primary);
  --el-text-color-regular: var(--text-secondary);
  --el-border-color: var(--border-normal);
  --el-border-radius-base: var(--radius-md);
}
```

### ④ 与 admin-web 同名不同值 —— 61 项

`saas-admin`（Design Tokens v5.0，主色 `#2563eb`）与 `admin-web`（主色 `#3F6FEF`）为两个产品，
各有一套令牌，同名不同值多数是**合理的体系差异**，不是缺陷。其中值得单独核查的一项：

- `--gray-300`：`saas-admin #888888` vs `admin-web #CCCCCC`。
  saas-admin 的 `#888888` 是 S3-53 为滚动条滑块做的可达性修订（非文本 3:1），注释已说明「仅被 `::-webkit-scrollbar-thumb` 引用，改动无外溢」，**属有意取值**，不建议为了对齐而回退。

建议：④ 作为**跨产品品牌统一**议题单独立卡（涉及墨的 `admin-web`），不在本单内改。

### ③ 单号登记问题

截至本次执行，`docs/tasks/inbox/ACTIVE.md` 路由表、`docs/tasks/当前批次.md`、
`docs/tasks/current-tasks.md` 及全仓检索**均未登记 TOTAL-SAAS-UI-TOKENS-01**。
本次按 `ACTIVE.md` 中「派单消息已显式写明 agent 名 ⇒ 以消息为准直接开工」口径执行。
**建议凌舟补登记或正式派单**，以便后续验收留痕。

---

## 六、可复跑资产

| 文件 | 用途 |
|---|---|
| `docs/设计/token-audit.mjs` | 五维审计（①②③ 目标恒 0；④⑤ 为决策观察项），输出 `token-audit-report.md` |
| `docs/设计/contrast.mjs` | WCAG 对比度实测 |
| `docs/设计/apply-tokens.mjs` | 本次 51 处替换的可审计记录（支持 `--check` 只校验） |
| `docs/设计/check-cascade.mjs` | 验证 `:root:root` 覆盖在产物中的层叠顺序 |
| `docs/设计/check-dist.mjs` / `check-dist2.mjs` / `check-dist3.mjs` | 构建产物校验 |

建议将 `node docs/设计/token-audit.mjs` 的 ①②③ 结果纳入 CI 门禁（当前基线 = 0）。

---

## 七、遗留

1. ⑤ 的 8 项 EP 覆盖待评审后启用（草案已备）。
2. ④ 的 61 项跨产品对齐建议单独立卡。
3. `--kv-columns` 经核实为 `:style` 运行时注入（props 默认 2 + 模板 fallback 2），**属审计误报，代码无需改**；已让脚本识别注入式定义。
4. 本次改动**未逐页截图比对**，视觉变化集中在次级文字加深（4.50:1 → 9.09:1）与状态色统一，
   如需可视化回归，建议由苏然在跨端测试中补一轮截图比对。
