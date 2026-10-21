# R101-QODER-25F1-回传

【汇报 QODER-25F1】QODER-25F1 tabBar 撞名与 AI 响应式返工：实现笔 d68e43e9 交付、续办会话补齐四门/三构建/产物核实/H5 未刷新采样/两轮反测复跑，自评全部硬验收达标；微信端 tabBar 运行时形态无 DevTools 判**未验**
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-22
交付物：逐条见下（含文件路径 + 提交哈希）
证据（可复跑）：docs/evidence/qoder-25f1/（raw/50–59、anti/A1–A2 为续办会话原始输出；raw/01–45、anti/01–02 为前会话原始留档）
验收自评：<逐条 通过/未通过 + 依据，见 §三/§四>
未完成与阻塞：<见 §七>
风险与自我报备：<见 §八>
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-25F1-回传.md
关联卡：docs/tasks/inbox/QODER-25F1-tabbar-reactivity.md

> 归属说明：**实现笔（d68e43e9）由前一会话交付并经负责人复核；证据树补齐、四门/三构建复跑、产物级 tabBar 核实、H5 未刷新采样、两轮反测复跑、回传与回执与文档提交由本次续办会话交付。** 两套读数均保留原始件、互不覆盖。续办会话未重写任何已提交实现。

## 一、基线与提交

- 工作树：`D:\Users\ZXQL\wt-agents\QODER-25F1`，分支 `fix/qoder-25f1-tabbar-reactivity`
- 基线：`286d071b`（QODER-25 尖端）
- 提交：
  - `d68e43e9` fix: QODER-25F1 自绘 tabBar 撞名改名 app-tab-bar 并收口 AI 流式消息响应式（实现笔，前会话，10 文件）
  - `（本笔）` docs: QODER-25F1 回传卡 + 回执 + 证据树（续办会话；哈希由 git log 实测，卡内不预写）
- `git diff bc1087ee..HEAD -- backend/ | wc -c` = **0**（见 §六红线与 raw/59 尾部复跑）

## 二、逐条实现说明（文件:行号，实测于 d68e43e9 工作树）

A. 撞名（派单 §一.A）：
- `app-mobile/src/components/custom-tab-bar.vue` → `app-mobile/src/components/app-tab-bar.vue`（git rename；CSS 类名 `.custom-tab-bar` 按派单保留，非组件注册面）
- 5 个挂载点标签+import 全部改名：`pages/home/home.vue:214/226`、`pages/products/products.vue:128/135`、`pages/ai-chat/ai-chat.vue:208/223`、`pages/functions/functions.vue:78/85`、`pages/profile/profile.vue:134/141`
- `App.vue:11-16` 隐藏原生栏口径 `#ifndef MP-WEIXIN`；`components/app-tab-bar.vue:104-110` 兜底隐藏同口径
- 根因锚点（实测原文已贴 raw/54(i)）：`node_modules/@dcloudio/uni-cli-shared/dist/easycom.js:212` `const H5_ONLY_COMPONENTS = ['custom-tab-bar']`，命中 `<custom-tab-bar>` 模板标签即 warn
- 守卫：`app-mobile/tests/tabbar-name-reactivity.spec.ts`（S1 撞名扫描 / S2 5 页挂载配对 / S3 路线互斥 / R1 响应式创建 / R2 假响应式禁绝 / R3 机制自证，共 6 用例）；`tests/ai-cross-platform.spec.ts` G6/G7 字面量同步；`scripts/gates-baseline.json` tests 12/196→13/202（note 仅末尾追加，机检 `newNote.startsWith(oldNote)`=true，其余分节逐字节相同——node -e 实测输出在证据树 README 末）

B. AI 消息响应式（派单 §一.B）：
- `app-mobile/src/pages/ai-chat/ai-chat.vue:638` `const aiMsg = reactive<ChatMessage>({...})`，`:644` `messages.value.push(aiMsg)`；onText(`:688`)/onDone/finally(`:716-727`) 写的就是这个代理；无 reload/forceUpdate/整表重赋值（R2 守卫禁绝，反测见 §五）

## 三、门 · 构建 · 守卫读数（全部为续办会话刚跑的原始输出）

- 四门：`npm --workspace app-mobile run check:gates` **GATES_EXIT=0**；tests 实测 **13 文件 / 202 用例**（与 gates-baseline 一致）（raw/57；raw/50 为三构建并行时的首跑，也以 57 干净串行复跑为准）
- 三构建（raw/51-53，尖端 d68e43e9）：`BUILD_EXIT_MP_WEIXIN=0`、`BUILD_EXIT_H5=0`、`BUILD_EXIT_APP=0`
- mp-weixin 撞名警告计数（raw/54）：
  - grep 管道反证自证：`grep -c 'Build complete' 51-53-builds-resume.log` = 1（管道非假 0）；同一管道打基线留档 `grep -c 'H5 平台专用组件' raw/01-baseline-build-mp-weixin.log` = **1**（警告串本可命中）
  - 目标读数：`awk '/# 51 /,/^# 52 /' … | grep -c 'H5 平台专用组件'` = **0**（GREP_EXIT=1）；`grep -c 'custom-tab-bar'` 同段 = **0**
- 产物残留：`find app-mobile/dist/build/mp-weixin -name 'custom-tab-bar*' | wc -l` = **0**；`components/` 实际文件：BanksCard.* / DocPage.* / **app-tab-bar.js|.json|.wxml|.wxss** / page-header/ / virtual-list.*
- 新守卫 6 用例全绿（raw/57 全量、anti 各轮复跑 16 passed）

## 四、tabBar 真实关系核实（产物级，派单 §一.A 最后一条；不以"构建过"代替）

- 产物 `dist/build/mp-weixin/app.json`：`tabBar.custom = true`；`tabBar.list.length = 5`（home/products/ai-chat/functions/profile）（raw/54(e) node -e 原文）
- 产物根**无** `custom-tab-bar/` 目录（raw/54(f) `LS_EXIT=2` 原文）
- 微信侧谁隐藏原生栏：`#ifndef MP-WEIXIN` 把 `uni.hideTabBar` 在微信端编掉——`grep -rl 'hideTabBar' dist/build/mp-weixin/` 命中文件数 **0**（`HIDETABBAR_GREP_EXIT=1`，54b 空清单）⇒ 微信端不存在任何 hideTabBar 调用；原生栏的抑制**只能**依赖 `tabBar.custom=true`；可见栏来自每页无条件挂载的 `app-tab-bar`（raw/54(g 前 (h) 与页面 wxml 挂载在册）
- 框架形态锚点：`uni-mp-weixin/dist/uni.compiler.js:267` 仅把 `src/custom-tab-bar` 列为**原样拷贝**目标，不会由 Vue 组件生成 ⇒ 若走微信原生自定义栏路线需手写 `src/custom-tab-bar/` 根级组件
- 结论（产物级）：本仓选择「`custom:true` 顶掉原生栏 + 每页手挂 app-tab-bar 单层栏」路线；两条路线互斥由 S3 守卫钉死（出现 `src/custom-tab-bar/` 目录而未收回 MP 每页挂载 ⇒ 红）。
- **未验声明**：微信在 `custom:true` 且根级无 `custom-tab-bar/` 时的真机运行时行为（静默不渲染 or 报错）**无 WeChat DevTools/真机，未验**；以上全部产物级证据已贴 raw/54。未用"提示不支持"替代接线，未隐藏所有栏冒充单层。

## 五、H5 实开与反测

- H5 未刷新采样（raw/58，全程同一页面实例 `#/pages/ai-chat/ai-chat`，序列内**零** `navigate_page`/`location.reload()`）：
  - RUN1 完整收流（events=200@300ms）：8 个带时间戳采样点 len **20→60→90→123→156→200→1536→1620**，收流后终态 2292、stopBtn 0；mock 侧 `SSE DONE after 200 events (client stayed until the end)`
  - RUN2 停止生成（events=600@300ms，同实例续采）：len **30→70→101→134→167→211→1356**，页面内时刻 19:32:40.002Z 点"■ 停止生成"（同一次调用派发完整 pointer 序列），mock **210ms 后**打出 `SSE CLIENT CLOSE after 210 events (remaining 390 events NOT sent)`；同一观察序列内下一采样点 **stopBtn 1→0**、len 冻结 2316（≈已发 210 事件×11 字符）
  - 采样稀疏段（浏览器窗口节流）已在 raw/58 note：t 相对同一 t0 单调，页面未换实例
  - 自动化配方按协议：原生 value setter + `input` 事件；pointerdown/mousedown/pointerup/mouseup/click 五连发
  - 截图未取（历史超时项未再尝试）；证据形态为 evaluate_script DOM 读数 + console/network 通道 + mock 日志
- 反测两轮均**由续办会话亲自复跑**（前会话 01/02 留档并存）：
  - Ⓐ 摘代理注回裸对象：INJECT_EXIT=0，红点名 **R1**（AssertionError 原文+spec:165），SHA_BEFORE==SHA_AFTER（c88fc7…738a，worktree-crlf），MARKER_RG_EXIT=1，复跑绿 EXIT=0
  - Ⓑ 注回旧名 custom-tab-bar：INJECT_EXIT=0（2 对各 hits=1），红点名 **S1/S2/S3 并连带 G6**（红行原文+行号在档），SHA 恒等，MARKER_RG_EXIT=1，复跑绿 EXIT=0

## 六、红线对照

| 红线 | 自评 | 依据 |
|---|---|---|
| 不 push / 不开 PR / 不 `git add -A` | 遵守 | 逐文件 git add；无 remote push 记录；`git log origin/... ` 未动 |
| `backend/` diff = 0 | 通过 | `git diff bc1087ee..HEAD -- backend/ | wc -c` = 0（raw/59 尾部） |
| 不改 AI 协议/工具确认/消息持久化结构 | 遵守 | 实现笔仅改名+reactive 包裹；本轮无 src 改动 |
| 不以"提示不支持"替代 tabBar 接线、不隐藏所有栏冒充单层 | 遵守 | §四：每页挂载在册、hideTabBar 仅非微信端、无 MP 提示分支 |
| 不把重挂载后 DOM 当未刷新响应式证据 | 遵守 | §五 RUN1/RUN2 全程无 reload/navigate；R2 守卫禁绝假响应式写法 |
| 端口 5173/5174/8388 全程未占 | 遵守 | raw/56/59 netstat 原文；teardown 六端口归零 |

## 七、未完成与阻塞

1. **微信端运行时表现未验**（无 WeChat DevTools/真机）：`custom:true` 且无根级 `custom-tab-bar/` 时微信是否静默不渲染原生栏、是否告警，只能到产物级为止（§四）。**待裁**：是否需另派一张"微信真机/开发者工具接线卡"。
2. App 端（HBuilderX 真机）tabBar 同样未验（无设备），仅产物构建通过。
3. 浏览器截图未取（历史超时项）；DOM 读数证据完整。

## 八、风险与自我报备

1. **越面发现（前会话遗留在办）**：teardown 时发现前一会话孤儿 dev:h5（PID 13668/7388，绑过 5175）仍存活；已按端口→PID→CommandLine 自证后清理并留档 raw/59。属本卡自家进程，未触碰他卡。
2. 首跑四门（raw/50）与三构建并行，存在读数干扰风险 ⇒ 已补 raw/57 干净串行复跑，并以 57 为准；raw/50 未删除未改写。
3. 反测Ⓐ绿跑首轮经 `| tail` 管道取码（取到 tail 的退出码而非 vitest）⇒ 已在 A1 日志内追加 note 并以无管道复跑重取（VITEST_R1_RESTORE_GREEN_EXIT_CLEANPIPE=0），原文未改写。
4. 内置浏览器 runtime 通道在前 20 分钟整体无响应（evaluate/snapshot/screenshot 全超时，Page 域可用），等待后自行恢复；期间未编造任何读数，恢复后才开始采样。
5. gates-baseline 收敛口径：本卡只写本树实测 13/202，四树不一致由集成单收敛（协议§三）。

## 九、踩坑实录

1. **派单口径含糊导致子代理自创占位装置、负责人更正为显式 --port**（本条为负责人 2026-10-22 口径更正，续办会话照此执行）：前会话把"让 vite 自选端口、禁止 5173/5174"解读为需占位 5173/5174，写了 `port-guard-f1.mjs`，实测还引出"占位进程与 vite 分脑绑同一端口"的假环境（raw/43 note）；正确解法是框架支持 `--port`（`vite-plugin-uni/dist/cli/server.js:118`），本会话用 `dev:h5 -- --port 5399` 一次成功，占位装置文件已删除（未跟踪件）。教训：派单里"禁止+自选"并存的口径应显式给可用端口白名单。
2. Git Bash 里 `netstat | grep` 管道时有假空（本会话复现一次），改为 `netstat -ano > file; grep file` 落盘再检才稳（raw/56b 已存快照）。
3. `grep -rl ... | head; echo $?` 取到的是 head 的退出码，会把 0 命中读成"成功命中"——产物 hideTabBar 计数首跑即中招，已改无管道写法重取（raw/54 (g-fixed)）。
4. 反测红/绿复跑凡走管道一律标注取码方式，见 §八.3。
5. 内置浏览器（browser-use）冷会话可能整体卡死 runtime 域；判据是 `1+1` 也超时而 `navigate_page`/`list_pages` 正常——此时应等待/换简单页面自证，而不是换装置造数。

## 十、复现命令 + 建议派单

```
cd /d/Users/ZXQL/wt-agents/QODER-25F1
npm --workspace app-mobile run check:gates                    # 期望 GATES_EXIT=0, 13/202
npm --workspace app-mobile run build:mp-weixin                # 期望 EXIT=0 且日志无"H5 平台专用组件"
find app-mobile/dist/build/mp-weixin -name 'custom-tab-bar*'  # 期望空
node -e "const j=require('./app-mobile/dist/build/mp-weixin/app.json');console.log(j.tabBar.custom)"   # true
# 反测①：node docs/evidence/qoder-25f1/anti/inject-01-raw-proxy.cjs app-mobile/src/pages/ai-chat/ai-chat.vue
#        → vitest run tests/tabbar-name-reactivity.spec.ts（R1 红）→ cp 复原 → 绿
# 反测②：node docs/evidence/qoder-25f1/anti/inject-02-old-name.cjs app-mobile/src/pages/ai-chat/ai-chat.vue
#        → S1/S2/S3+G6 红 → cp 复原 → 绿
# H5：node docs/evidence/qoder-25f1/mock-ai-backend-f1.mjs   (MOCK_PORT=8488)
#     npm --workspace app-mobile run dev:h5 -- --port 5399   (VITE_PROXY_TARGET/VITE_AI_BASE_URL=http://localhost:8488)
#     localStorage 置 merchant_token 后整页载 #/pages/ai-chat/ai-chat，页内 setInterval 采样，序列内禁 reload
```

建议：派一张微信真机/DevTools 接线卡（验证 `custom:true` 无根级 `custom-tab-bar/` 的运行时行为，并裁决是否需要落地根级组件目录）；App 端同题可并卡。
