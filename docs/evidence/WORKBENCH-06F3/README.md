# WORKBENCH-06F3 · 界面与交互动画对齐（审计 → 修复 → 复验）

> 负责人：墨（工作台前端 owner）｜2026-10-26
> 触发：凌舟验收 WORKBENCH-06F2 通过后，要求「检查新版工作台的 UI 界面和交互动画跟原型是否一致」
> 基线：`e68315f4224deb6114cc035de406eade74952503`（F2 基线）｜实现提交见 `git log`
> 工作树：`D:\Users\ZXQL\ZXQL-MS\wt-works\WORKBENCH-06F2`
> 原型：`D:\Users\ZXQL\ZXQL-AI\docs\设计\智享全链_工作台电脑端_UI原型_融合版.html`
> 原型 SHA256：`6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51`（脚本每次校验）
> 取证：vite preview 4173 构建产物 + 真实登录 + Playwright；**判据一律用浏览器 computed 值（R8.1）**

---

## 〇、结论

**结构一致**（WORKBENCH-06 已验收）+ **动效已对齐**（本单修复）。

| 阶段 | MATCH | MISSING | 说明 |
|:--|--:|--:|:--|
审计首轮（修复前） | 1 | **8** | 壳层几乎没写 transition/animation |
审计二轮（一轮修复后） | 5 | 1 | 4 项转为 MATCH；剩 side-collapse 口径误判 + 新发现胶囊 hover 缺失 |
**复验（本轮最终）** | **5** | **0** | MISSING 归零；SKIP 5 项均为「取样限制 / 已裁定差异」 |

> 注：`SKIP` ≠ 缺陷。5 项 SKIP 分别是：设置弹窗（D-6 已裁定跳 `/system`）、rail 红闪（当前无新动态、不加载 `.alert`）、
> 二级卡（mock DB 空菜单 ⇒ 0 张卡）、推送圆点（WS 未连 ⇒ 走「推送离线」分支）、以及上述三项的源码真值复核。

## 1. 8 项 MISSING 的修复（逐条对齐原型）

| # | 动效 | 原型出处 | 修复动作 | 修复后 computed |
|--:|:--|:--|:--|:--|
| 1 | rail 项 hover/选中过渡 | `L122 .rl-it{transition:.15s}` | `.wb-rail-item` 加 `transition: background-color 150ms, color 150ms` | `150/150ms` **MATCH** |
| 2 | rail 红闪 | `L187 .rl-it.alert{background:#DC2626;animation:rlFlash 1.1s}` | `.alert` 补 `background`（旧版只设 `color`，keyframes 底色不生效）+ keyframes 改为 `#dc2626→#f87171` + 光晕 | 源码已验（运行态无 `.alert` 触发，取样限制） |
| 3 | 第二列收起过渡 | `L34 .side{transition:margin .25s}` | `.wb-shell` 改 `transition: grid-template-columns 250ms`；收起态由 `display:none` 改 `overflow:hidden` | **实测中间帧 230→38.2→0px** ✅ |
| 4 | 二级卡 / 卡片 hover 过渡 | `L133-134 .sub-card` + `i{transition:.15s}` | `.sn-card` 加 transition；`.fdv-item` 加 hover 边框 + transition | `.sn-card` 源码已验（空菜单取样限制）；`.fdv-item` **MATCH 150/150ms** |
| 5 | 信息流卡片入场 | `L150 .feed-card{animation:fin .35s}` | 新增 `@keyframes wb-fdv-in`（opacity+translateY）+ `.fdv-item` 引用 `350ms both` | **MATCH 350/350ms** |
| 6 | 推送圆点呼吸 | `L145 .fdot{animation:fdot 1.6s}` | **F1 已存在**（`@keyframes fdv-blink`）；本单加断言锁住不被误删 | 源码已验（WS 未连取样限制） |
| 7 | 提问条 hover 过渡 | `L147-148 .feed-ask:hover` | `.fdv-ask` 加 transition（此前只有变色、无过渡） | **MATCH 150/150ms** |
| 8 | 胶囊项过渡 | `L87 .ms{transition}` | `.wb-mode-seg-item` 加 transition | **MATCH 120/120ms** |
| **8b** | **胶囊 hover 反馈**（二轮审计新发现） | `L88 .ms:hover{color:var(--ink)}` | 补 `.wb-mode-seg-item:hover{color}` + `.on:hover` 保持主色 | **实测 hover 变色 ✅** |

## 2. 无障碍纪律（**未为动效牺牲可达性**）

- `tokens.css:436-444` 的 `@media (prefers-reduced-motion: reduce){*{transition-duration:.01ms!important}}` **原样保留**；
- 新增入场动画**就地尊重**该偏好：`AiFeedView.vue` 内加 `@media (prefers-reduced-motion: reduce){.fdv-item{animation:none}}`；
- 断言 `#9` 同时守住两处；mutation `M9` 删除组件内规则 ⇒ 断言点名红。

## 3. 审计方法上的三次自我纠错（**关键，防后人重踩**）

| 坑 | 现象 | 根因 | 处置 |
|:--|:--|:--|:--|
**坑 1** | 首轮 8 项全 MISSING | Chromium/Playwright 默认可能命中 `prefers-reduced-motion: reduce`，而本项目有全局 `transition-duration:.01ms!important` ⇒ 全部压平 | 两个 context 显式 `reducedMotion:"no-preference"` + **两侧前提自证断言**（`reduce=false`）后才取样 |
**坑 2** | 二轮 4 项误判 | ① 拿 `max(transitionDuration, animationDuration)` 比时长 ⇒ rail 把 `.alert` 的 1.1s 循环动画和 .15s 过渡混比；② Vue scoped 给 keyframes 加哈希后缀（`wb-fdv-in-2de0b9f3`）；③ 元素当前不渲染（空菜单/离线/无 `.alert`）被当成缺陷 | ① transition 只与 transition 比、animation 只与 animation 比；② 剥离 `-[0-9a-f]{8}$` 后缀；③ 新增 `SKIP-SAMPLING` 口径 + **源码真值回退复核** |
**坑 3** | side-collapse 误判 MISSING | 过渡发生在 `.wb-shell` 的 `grid-template-columns`，而脚本量的是 `.wb-subnav` 自身 | 改由**中间帧实测**判决：点击收起 → 110ms 时列宽 38.2px（介于 230 与 0 之间）⇒ 证明真在插值 |

> 三次纠错的共同教训：**"读数异常时先怀疑探针，再怀疑实现"**——但不能只怀疑不核查，必须给出可复核的替代判据。

## 4. 复跑命令

```powershell
# ① 源码级动效断言（12 例）
node admin-web/tests/ui-animation.spec.mjs

# ② 动效 mutation（10 条：注入 → 点名红 → SHA256 恒等复原 → 回绿）
node admin-web/tests/animation-countertest.mjs

# ③ 全量测试（既有 143 条不得减少）
npm test --prefix admin-web

# ④ 运行态审计（前置：mock 后端 8080 + vite preview 4173，构建时 VITE_API_BASE=/api）
node docs/evidence/WORKBENCH-06F3/ui-animation-audit.mjs

# ⑤ 门禁
node admin-web/node_modules/vue-tsc/bin/vue-tsc.js -b admin-web/tsconfig.json --force
node admin-web/node_modules/eslint/bin/eslint.js admin-web/src/
node admin-web/node_modules/vite/bin/vite.js build --config admin-web/vite.config.ts admin-web

# ⑥ 冻结面
git diff --name-only e68315f4 -- admin-web/src/views backend
```

## 5. 结果摘要（原始输出见 `logs/`、`redtest/`、`reports/`）

| 项 | 读数 | 原始 |
|:--|:--|:--|
动效断言 `ui-animation.spec.mjs` | **12 passed / 0 failed** | `logs/11-ui-animation.log` |
**动效 mutation** | **10/10 点名变红** + **10/10 SHA256 恒等复原** + 复原后 12/12 回绿 | `logs/12-animation-countertest.log`、`redtest/animation-countertest.md` |
运行态审计（修复后） | **18 passed / 0 failed**；**MATCH 5 / MISSING 0 / DURATION-DIFF 0 / SKIP 5** | `logs/13-runtime-audit-after-fix.log`、`reports/ui-animation-audit.json` |
全量测试 `npm test` | **155 passed / 0 failed**（既有 143 条一条未减 + 新增 12） | `logs/10-npm-test.log` |
`vue-tsc -b --force` | **EXIT=0**（零输出，见 note） | `logs/20-vue-tsc.log`(+note) |
`eslint src/` | **EXIT=0**（零输出，见 note） | `logs/21-eslint.log`(+note) |
`vite build` | **EXIT=0**，✓ built in 2m 4s | `logs/30-build.log` |
业务冻结面 | `git diff --name-only e68315f4 -- admin-web/src/views backend` **零输出** | §6 |

## 6. 改动面

```
 admin-web/src/layouts/WorkbenchShell.vue        | 改（rail 过渡/红闪底色+keyframes、grid 收起过渡、胶囊过渡+hover）
 admin-web/src/layouts/WorkbenchSubnav.vue       | 改（.sn-card 过渡）
 admin-web/src/components/workbench/AiFeedView.vue | 改（卡片入场 keyframes、卡片 hover+过渡、提问条过渡、reduced-motion）
 admin-web/tests/ui-animation.spec.mjs           | 新增（12 例）
 admin-web/tests/animation-countertest.mjs       | 新增（10 条 mutation）
 admin-web/package.json                          | 改（串入 ui-animation.spec）
新增：docs/evidence/WORKBENCH-06F3/**
```

**未动**：`admin-web/src/views/**`（零改动）、`backend/**`、`ZXQL-AI/**`（原型与底座契约均只读）、既有 9 个 spec 的用例。

## 7. 未覆盖 / 取样限制（如实登记）

1. **rail 红闪的运行态**：需「有新动态」触发 `.alert`（`feedAlert` 依赖 `pendingReviewCount>0` 且 `face!=='feed'`）；当前 mock DB 无待审阅 ⇒ 运行态不渲染。已由**源码断言 + mutation M2** 覆盖。
2. **二级卡动效的运行态**：mock DB 空菜单 ⇒ 0 张卡。已由**源码断言 + mutation M4a** 覆盖。
3. **推送圆点呼吸的运行态**：AI 底座 WS 未连 ⇒ 走「推送离线」分支。已由**源码断言 + mutation（#6 锁住）** 覆盖。
4. **业务页内部动效**：本单只覆盖壳层；`views/**` 不在范围（且本单未改 `views/**`）。
5. **原型后期迭代的 15+ keyframes**（`v34*`/`v35*`/`v37*` 系列）：对应页面当前未实现 ⇒ 无可比对对象。
6. **Electron / <1280px / 移动 H5**：不在范围。

## 8. 目录结构

```text
docs/evidence/WORKBENCH-06F3/
├── README.md                        # 本文件（审计 → 修复 → 复验）
├── ui-animation-audit.mjs           # 运行态审计脚本（computed 值 + SKIP-SAMPLING 口径 + 中间帧实测）
├── logs/                            # 10-npm-test / 11-ui-animation / 12-animation-countertest /
│                                    # 13-runtime-audit-after-fix / 20-vue-tsc(+note) / 21-eslint(+note) / 30-build
├── reports/
│   └── ui-animation-audit.json      # 10 项逐条 proto/impl computed + verdict + 媒体查询前提
├── redtest/
│   └── animation-countertest.md     # 10 条 mutation：注入 SHA → FAIL 原文 → 复原 SHA → 回绿
└── screenshots/                     # hover/focus 前后对照（肉眼可核）
```
