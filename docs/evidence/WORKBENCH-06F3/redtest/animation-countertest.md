# WORKBENCH-06F3 动效 mutation 记录

> 被测用例：`admin-web/tests/ui-animation.spec.mjs`（11 例）
> 装置：`admin-web/tests/animation-countertest.mjs`（注入 → 断言点名红 → 逐字节复原 SHA256 → 复跑回绿）

| 反测 | 目标文件 | 注入 | EXIT | FAIL | 点名 | 复原恒等 |
|:--|:--|:--|--:|--:|:--:|:--:|
| M1-drop-rail-transition | `src/layouts/WorkbenchShell.vue` | 删除 rail 项 transition | 1 | 1 | ✅ | ✅ |
| M2-drop-alert-background | `src/layouts/WorkbenchShell.vue` | 删除 rail .alert 的 background（退回到 F1 缺陷：keyframes 底色不生效） | 1 | 1 | ✅ | ✅ |
| M3-drop-grid-transition | `src/layouts/WorkbenchShell.vue` | 删除壳层 grid-template-columns 过渡 | 1 | 1 | ✅ | ✅ |
| M4a-drop-subnav-transition | `src/layouts/WorkbenchSubnav.vue` | 删除二级卡 transition | 1 | 1 | ✅ | ✅ |
| M4b-drop-fdv-item-hover | `src/components/workbench/AiFeedView.vue` | 删除信息流卡片 hover 边框规则 | 1 | 1 | ✅ | ✅ |
| M5-drop-enter-animation | `src/components/workbench/AiFeedView.vue` | 删除信息流卡片入场动画引用 | 1 | 1 | ✅ | ✅ |
| M7-drop-ask-transition | `src/components/workbench/AiFeedView.vue` | 删除提问条 transition | 1 | 1 | ✅ | ✅ |
| M8-drop-seg-transition | `src/layouts/WorkbenchShell.vue` | 删除胶囊项 transition | 1 | 1 | ✅ | ✅ |
| M8b-drop-seg-hover | `src/layouts/WorkbenchShell.vue` | 删除胶囊未选中项 hover 规则（二轮审计发现的真缺陷） | 1 | 1 | ✅ | ✅ |
| M9-drop-reduced-motion-in-feed | `src/components/workbench/AiFeedView.vue` | 删除组件内 reduced-motion（断言应守住无障碍） | 1 | 1 | ✅ | ✅ |

## 逐条 FAIL 原文

### M1-drop-rail-transition（删除 rail 项 transition）

```text
FAIL  #1 rail 项有非零 transition（原型 .rl-it{transition:.15s}）  ← .wb-rail-item 缺少非零 transition；实际块：display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 2px; border: 0; border-radius: 8px; b
```

### M2-drop-alert-background（删除 rail .alert 的 background（退回到 F1 缺陷：keyframes 底色不生效））

```text
FAIL  #2 rail .alert 有 animation 且设置了 background（否则 keyframes 底色不生效）  ← .alert 缺少 animation
```

### M3-drop-grid-transition（删除壳层 grid-template-columns 过渡）

```text
FAIL  #3 壳层第二列收起用 grid 过渡（非 display:none 瞬隐）  ← .wb-shell 缺少 grid-template-columns 的非零 transition；块内：.wb-shell { height: 100vh; display: grid; grid-template-columns: var(--wb-rail-w, 64px) var(--wb-side-w, 230px) minmax(0, 1fr); background: var(--wb-bg, #f4f6f8); overflow: hidden; 
```

### M4a-drop-subnav-transition（删除二级卡 transition）

```text
FAIL  #4-a 二级卡 .sn-card 有非零 transition  ← .sn-card 缺少非零 transition
```

### M4b-drop-fdv-item-hover（删除信息流卡片 hover 边框规则）

```text
FAIL  #4-b 信息流卡片 .fdv-item 有 hover 边框规则 + 非零 transition  ← 未找到 .fdv-item:hover（原型的 .feed-card:hover{border-color} 对应物）
```

### M5-drop-enter-animation（删除信息流卡片入场动画引用）

```text
FAIL  #5 信息流卡片有入场 keyframes 且被 .fdv-item 引用  ← .fdv-item 未引用 wb-fdv-in 入场动画
```

### M7-drop-ask-transition（删除提问条 transition）

```text
FAIL  #7 信息流提问条 .fdv-ask 有非零 transition（变色之外还需过渡）  ← .fdv-ask 缺少非零 transition
```

### M8-drop-seg-transition（删除胶囊项 transition）

```text
FAIL  #8 工作台/收银台胶囊项有非零 transition  ← .wb-mode-seg-item 缺少非零 transition
```

### M8b-drop-seg-hover（删除胶囊未选中项 hover 规则（二轮审计发现的真缺陷））

```text
FAIL  #8b 胶囊**未选中项**有 hover 规则（对齐原型 .ms:hover{color:var(--ink)}）  ← 缺少 .wb-mode-seg-item:hover（原型 L88 `.ms:hover{color:var(--ink)}`）⇒ 未选中项悬停无反馈
```

### M9-drop-reduced-motion-in-feed（删除组件内 reduced-motion（断言应守住无障碍））

```text
FAIL  #9 无障碍：prefers-reduced-motion 规则仍在（不得为动效删掉）  ← AiFeedView 应就地尊重 reduced-motion（关闭入场动画）
```

## 复原后复跑

```text
PASS  #1 rail 项有非零 transition（原型 .rl-it{transition:.15s}）  ← background-color 150ms ease, color 150ms ease
PASS  #2 rail .alert 有 animation 且设置了 background（否则 keyframes 底色不生效）  ← animation + background + keyframes(background+色值) 齐备
PASS  #3 壳层第二列收起用 grid 过渡（非 display:none 瞬隐）  ← grid 列宽 250ms 过渡 + 收起态非 display:none
PASS  #4-a 二级卡 .sn-card 有非零 transition  ← background-color 150ms ease, border-color 150ms ease, color 150ms ease
PASS  #4-b 信息流卡片 .fdv-item 有 hover 边框规则 + 非零 transition  ← hover 边框 + 过渡齐备
PASS  #5 信息流卡片有入场 keyframes 且被 .fdv-item 引用  ← w b-fdv-in（opacity+transform）+ .fdv-item 引用 + 保留终态
PASS  #8b 胶囊**未选中项**有 hover 规则（对齐原型 .ms:hover{color:var(--ink)}）  ← hover 改 color=var(--wb-ink, #16181d) + 选中项独立规则
PASS  #6 推送圆点 @keyframes fdv-blink 存在且 .fdv-dot 引用（锁住既有能力）  ← keyframes + 引用 均在位
PASS  #7 信息流提问条 .fdv-ask 有非零 transition（变色之外还需过渡）  ← background-color 150ms ease, border-color 150ms ease, color 150ms ease
PASS  #8 工作台/收银台胶囊项有非零 transition  ← background-color 120ms ease, color 120ms ease, box-shadow 120ms ease
PASS  #9 无障碍：prefers-reduced-motion 规则仍在（不得为动效删掉）  ← 全局规则保留 + 组件内也尊重该偏好
PASS  #10 动效时长落在原型区间 120–350ms（不自拟夸张值）  ← transition 18 处取值 120/150/250ms；animation 4 处取值 350/1100/1400ms
小结：12 passed / 0 failed
```
