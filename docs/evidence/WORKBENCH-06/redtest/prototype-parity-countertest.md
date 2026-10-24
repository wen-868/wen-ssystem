# WORKBENCH-06 反测记录（prototype-parity）

> 基线 SHA256(admin-web/src/layouts/WorkbenchShell.vue) = `5BF5C823B2D7EBAA6F811663D5D3472363161C3C6E502C22BFEFB05CD2C443A1`
> 装置：`admin-web/tests/prototype-parity-countertest.mjs`（逐条注入 → 断言点名红 → 逐字节复原 → 复跑回绿）

| 反测 | 注入 | EXIT | FAIL 行数 | 点名命中 | 注入后 SHA256 | 复原 SHA256 | 逐字节一致 |
|:--|:--|:--:|--:|:--:|:--|:--|:--:|
| A-remove-rail | 删除一级模块图标栏（rail） | 1 | 1 | ✅ | `CB07ED0669D78B49…` | `5BF5C823B2D7EBAA…` | ✅ |
| B-remove-second-nav | 删除第二列上下文导航（WorkbenchSubnav） | 1 | 1 | ✅ | `57A7AFEFA9B0B2A5…` | `5BF5C823B2D7EBAA…` | ✅ |
| C-remove-composer | 删除底部固定 AI 输入区（AiChatComposer） | 1 | 1 | ✅ | `3E05954DED65D895…` | `5BF5C823B2D7EBAA…` | ✅ |
| D-remove-fallback | 删除旧壳回退分支（MainLayout v-if） | 1 | 1 | ✅ | `954D7BE4EA2F2AF8…` | `5BF5C823B2D7EBAA…` | ✅ |

## 逐条 FAIL 原文

### A-remove-rail · 删除一级模块图标栏（rail）

```text
FAIL  一级 rail：常驻图标栏存在且含工作台项 + 模块项循环 + 设置固定底部  ← 一级 rail 结构缺失：
```

### B-remove-second-nav · 删除第二列上下文导航（WorkbenchSubnav）

```text
FAIL  第二列导航：Subnav 被装配 + 含新对话/二级目录/账户区/可收起  ← 第二列导航结构缺失：
```

### C-remove-composer · 删除底部固定 AI 输入区（AiChatComposer）

```text
FAIL  底部输入区：Composer 常驻 + 人工态 compact + 发送经统一链  ← 底部输入区结构缺失：
```

### D-remove-fallback · 删除旧壳回退分支（MainLayout v-if）

```text
FAIL  旧壳回退：MainLayout v-if=!shellEnabled 分支保留且互斥  ← 旧壳回退结构缺失：
```

## 复原后复跑

```text
PASS  一级 rail：常驻图标栏存在且含工作台项 + 模块项循环 + 设置固定底部  ← rail + desk/模块/设置三类项齐备
PASS  第二列导航：Subnav 被装配 + 含新对话/二级目录/账户区/可收起  ← 新对话 + 二级目录 + 账户 + 收起 齐备
PASS  Agent 状态区：装配于顶栏且含会话状态 + 待审阅 + 台账入口  ← 会话状态 + 待审阅 + 台账入口 齐备
PASS  主面三层：feed 默认 + chat + manual（router-view 常驻）  ← feed 默认 + chat + manual 三层，router-view 常驻
PASS  底部输入区：Composer 常驻 + 人工态 compact + 发送经统一链  ← 常驻输入区 + 人工态收条 + 真实发送链
PASS  工作台/收银台胶囊：mode-seg 双向 + desk/pos 两项  ← 工作台 ⇄ 收银台 双向胶囊
PASS  旧壳回退：MainLayout v-if=!shellEnabled 分支保留且互斥  ← 灰度回滚分支完整
PASS  无 mock：新面组件零原型数据层/随机/示例数据（红线：不用原型 mock）  ← 5 文件代码区零 mock / 零原型演示数据
PASS  真实数据源：feed 走 /admin/wb-notifications，待审阅走 /api/chat/confirmations  ← 动态/推送/待审阅均有真实端点，失败诚实降级
PASS  能力保留锚点：菜单 fail-closed / 角色裁剪 / AI 故障回退 / 收银保底未被破坏  ← 权限/菜单/故障/收银锚点全部保留
小结：10 passed / 0 failed
```
