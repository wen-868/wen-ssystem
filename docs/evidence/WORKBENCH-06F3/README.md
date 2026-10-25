# WORKBENCH-06 界面与交互动画一致性审计（只读，未改产品代码）

> 审计人：墨（工作台前端 owner）｜2026-10-26
> 触发：凌舟验收 WORKBENCH-06F2 通过后，要求「检查新版工作台的 UI 界面和交互动画跟原型是否一致」
> 工作树：`D:\Users\ZXQL\ZXQL-MS\wt-works\WORKBENCH-06F2`（HEAD `78fba0d0`）
> 原型：`D:\Users\ZXQL\ZXQL-AI\docs\设计\智享全链_工作台电脑端_UI原型_融合版.html`
> 原型 SHA256：`6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51`（脚本每次校验）
> 取证方式：vite preview 4173 构建产物 + 真实登录 + Playwright；**判据一律用浏览器 computed 值（R8.1）**

---

## 〇、结论先行

**结构层面：一致**（WORKBENCH-06 已验收：rail 64 / 第二列 231 / 顶部三格 / feed·chat·manual 三层 / 底部输入区）。

**动效层面：不一致 —— 10 项壳层动效中 8 项缺失。**
实现侧壳层几乎没写 `transition`/`animation`，而原型在每个交互点上都有 120–350ms 的过渡或入场动画。
这不是"配色差异"，是**交互手感差异**：点击/悬停/切换全部硬切，没有过渡。

| 类别 | 原型 | 实现 | 判定 |
|:--|:--|:--|:--|
壳层 `@keyframes` | 25+（含 `rlFlash`/`fin`/`fdot`/`swIn` 等） | 2（`wb-rail-blink`/`fdv-blink`） | **缺** |
壳层 `transition` 声明 | 108 处（全项目） | 壳层组件内 **0 处**（仅 `.cmp-form` 有 1 处聚焦过渡） | **缺** |
壳层 `animation` 声明 | 31 处（全项目） | 壳层 2 处 | **缺** |

逐项比对（10 项壳层动效）：
- **MATCH 1**（底部输入框聚焦双环）
- **SKIP 1**（设置弹窗入场——实现无该对象，D-6 已裁定跳 `/system`）
- **MISSING 8**（rail 过渡、rail 红闪、第二列收起、二级卡过渡、信息流卡片入场、推送圆点、提问条过渡、胶囊项过渡）

> **首轮误报已排除（重要）**：首轮审计 8 项全部 MISSING 时，我先怀疑是探针问题。
> 定位到 `tokens.css:436-444` 的 `@media (prefers-reduced-motion: reduce){*{transition-duration:.01ms!important}}`，
> 而 Chromium/Playwright 默认可能命中 `reduce` ⇒ 会把所有 transition 压平。
> 已在两个 context 显式设 `reducedMotion:"no-preference"` 并加**前提自证断言**（两侧均 `reduce=false` 后才取样）。
> **在排除该干扰后，8 项仍为 MISSING ⇒ 缺陷为真，非探针假阳性。**

---

## 一、逐项差异明细（含原型出处与实现现状）

| # | 动效 | 原型出处 | 原型 computed | 实现 computed | 判定 |
|--:|:--|:--|:--|:--|:--|
| 1 | 一级 rail 项 hover/选中过渡 | `L122 .rl-it{transition:.15s}` | `all 0.15s` | **`all 0s`** | **MISSING** |
| 2 | 工作台有新动态时 rail 项整块红闪 | `L187 .rl-it.alert{animation:rlFlash 1.1s}` | `rlFlash 1.1s` | **`none`**（且 `.alert` 规则未设 `background`，keyframes 的底色不生效） | **MISSING** |
| 3 | 第二列收起过渡 | `L34 .side{transition:margin .25s}` + `L35 .side.hide{margin-left:-230px}` | `width,margin 0.4s/0.25s` | **`all 0s`**（实现用 `display:none` 瞬隐，非平滑滑出） | **MISSING** |
| 4 | 二级功能卡 hover 过渡 | `L133-134 .sub-card` + `i{transition:.15s}` | `background-color,border-color,box-shadow,transform 0.2s` | **元素在空菜单下不渲染**；源码 `.sn-card`/`.sn-card:hover` **无 transition** | **MISSING** |
| 5 | 信息流卡片入场动画 | `L150 .feed-card{animation:fin…}` | `fin 0.35s` | **`none`**（`.fdv-item` 无入场动画） | **MISSING** |
| 6 | 「实时推送中」圆点呼吸 | `L145 .fdot{animation:fdot 1.6s}` | `fdot 1.6s` | 离线态不渲染（取样限制）；**源码有 `@keyframes fdv-blink` 且 `.fdv-dot` 已引用** | **源码侧 OK，运行态未验** |
| 7 | 信息流提问条 hover 过渡 | `L147-148 .feed-ask:hover` | `all 0.15s` | **`all 0s`**（变色有效，但无过渡） | **MISSING（过渡）** |
| 8 | 工作台/收银台胶囊项过渡 | `L87 .ms{transition}` | `background-color,border-color,color,box-shadow 0.12s` | **`all 0s`** | **MISSING** |
| 9 | 底部输入框聚焦双环 | `L642 .input-box:focus-within` | `border-color,box-shadow,background-color 0.15s` | `border-color,box-shadow 0.15s` | **MATCH** |
| 10 | 设置弹窗入场 | `L671 @keyframes swIn 0.22s` | `swIn 0.22s` | 实现无设置弹窗（D-6 已裁定跳 `/system`） | **SKIP（已裁定）** |

### 1.1 hover 反馈复核（真实鼠标 hover，非 JS 伪造）

| 元素 | hover 变色 | 说明 |
|:--|:--:|:--|
| rail 工作台项 | **否** | 该项当前为 `.on` 选中态；`.wb-rail-item.on` 特异性高于 `:hover` ⇒ **选中态优先属正常**（原型 `.rl-it.on` 同构），非缺陷 |
| rail 模块项 | — | mock DB 空菜单下不存在（取样限制） |
| 胶囊-工作台 | **否** | 同样是 `.on` 选中态（`.wb-mode-seg-item.on` 覆盖 hover），正常 |
| 信息流提问条 | **是**（白→`rgb(239,244,255)`） | 变色有效，**仅缺过渡**（`all 0s`） |
| 信息流卡片 | **否** | 原型 `.feed-card:hover{border-color:var(--blue)}`；实现 `.fdv-item` **无 hover 规则** ⇒ **真缺** |

---

## 二、根因分类（区分"没写"与"写了被压平"）

| 根因 | 涉及项 | 说明 |
|:--|:--|:--|
| **A. 从未编写**（主因） | 1/2/3/4/5/7/8 + 卡片 hover | WORKBENCH-02~06 各轮聚焦「结构对位 + 功能接线 + 契约对齐」，**动效层始终没进验收条目**；F1/F2 的判据都是结构/数据/契约，未含动效 ⇒ 写与不写都不影响验收 |
| **B. 写了但被媒体查询压平** | 首轮全部 8 项（**已排除**） | `tokens.css` 的 `prefers-reduced-motion` 规则 + 无头浏览器默认 `reduce` 造成的假阳性，**非真实缺陷** |
| **C. 已写且正确** | 6（推送圆点）、9（输入框聚焦） | 源码与 computed 均正确 |

**责任归属**：A 类属**我（墨）在 02~06 各轮的交付缺口**——原型动效是我该对齐的部分，但我把"结构一致"当成了"界面一致"。
不属凌舟派单遗漏：派单卡 §二.3/§三.1 要求的是"同尺寸截图对照 + 结构清单"，动效确实未列入硬验收；但**原型有而我未做，是我的判断偏窄**。

---

## 三、修复建议（按性价比排序，供凌舟决定是否立单）

| 优先 | 项 | 建议做法 | 工作量 |
|:--:|:--|:--|:--|
| **P0** | 1/4/7/8 的 `transition` | 在 `WorkbenchShell.vue` / `WorkbenchSubnav.vue` / `AiFeedView.vue` 对应类上补 `transition: <具体属性> .15s ease`（**用具体属性而非 `all`**，与原型一致且避免无谓重排） | 小（4 处 CSS） |
| **P1** | 5 信息流卡片入场 | 新增 `@keyframes wb-fdv-in{from{opacity:0;transform:translateY(-6px)}}`，`.fdv-item` 引用 `.35s` | 小（1 keyframes + 1 行） |
| **P1** | 3 第二列收起 | 由 `display:none` 改为 `margin-left:-231px` + `transition: margin .25s`（与原型同构），保留 `sideCollapsed` 状态 | 小-中（需确认布局不塌） |
| **P2** | 2 rail 红闪补全 | `.wb-rail-item.alert` 补 `background`（当前只有 `color`，导致 keyframes 底色不生效）+ 复核 `feedAlert` 触发条件 | 小 |
| **P2** | 卡片 hover 边框 | `.fdv-item:hover{border-color:var(--wb-primary)}` | 极小 |
| **待裁定** | 4 二级卡过渡的运行态验证 | 需非空菜单才能取样（mock DB 为空）⇒ 与「非空运行态未验」同源，**建议并入该项一并解决** | — |

**必须同时做的门禁**（照本项目铁律）：
1. 每条动效加断言（computed `transition-duration !== 0s` / `animation-name !== none`）；
2. **mutation**：删任一 transition/keyframes ⇒ 断言点名红；
3. 保留 `prefers-reduced-motion` 无障碍规则**不动**（它是正确行为），但审计脚本必须显式关闭该媒体查询；
4. 动效时长与原型对齐（120–350ms 区间），避免自拟夸张动效。

---

## 四、证据与复跑

```powershell
# 前置：mock 后端 8080 + vite preview 4173（VITE_API_BASE=/api 构建）
node docs/evidence/WORKBENCH-06F3/ui-animation-audit.mjs
```

产物：
- `reports/ui-animation-audit.json`：10 项逐条 proto/impl computed 读数 + verdict + 两侧媒体查询前提读数
- `screenshots/hover-*.png`、`focus-composer.png`：hover/focus 前后对照（肉眼可核）
- 首轮误报与排除过程记录在本文件 §〇

**审计脚本关键实现**（防复发，已写入注释）：
- 两个 context 均 `reducedMotion: "no-preference"`；
- 新增 `assertMotionMedia()`：两侧**各自**断言 `reduce=false && no-preference=true` 后才取样；
- 离线态元素（`.fdv-dot`）改判源码真值，并显式标注"取样限制"而非"缺陷"。

## 五、未覆盖项（如实登记）

1. **非空菜单下的二级卡动效**：mock DB 无菜单行 ⇒ `.sn-card` 不渲染，运行态未验（与 F1 已登记的"非空运行态未验"同源）。
2. **推送在线时的圆点呼吸**：AI 底座 WS 未连 ⇒ 只在源码侧确认（`@keyframes fdv-blink` + `.fdv-dot` 引用）。
3. **业务页内部动效**：本审计只覆盖**壳层**（rail/第二列/顶部/feed/输入区）；`views/**` 内部动效不在本轮范围（且本轮不改 `views/**`）。
4. **原型其余 15+ keyframes**（如 `v34*`/`v35*`/`v37*` 系列）：属原型后期迭代板块（AI 助理/审批/播报等），当前工作台未实现对应页面 ⇒ 无可比对对象，未纳入。
5. **Electron 客户端 / <1280px / 移动 H5**：不在范围。
