# R27 全量回归测试报告

> **测试轮次**：R27-A4  
> **测试时间**：2026-07-13  
> **测试负责人**：苏然  
> **验收标准**：所有测试通过，分支覆盖率 ≥ 90%

---

## 一、测试范围

### 后端测试
1. `npx tsc --noEmit --strict`（非测试文件 0 错误）
2. `npx vitest run`（全量测试，0 失败 0 跳过）
3. `npx vitest run --coverage`（验证分支覆盖率 ≥ 90%）
4. `npx eslint src/`（0 错误）

### 前端测试
5. admin-web：`npx vue-tsc --noEmit`（0 错误）
6. admin-web：`npm run build`（构建成功）
7. app-mobile：`npx vue-tsc --noEmit`（0 错误）
8. app-mobile：`npm run build:h5`（构建成功）
9. store-terminal：`npx eslint src/`（0 错误）
10. store-terminal：`npm run build`（构建成功）

### 功能验证
11. store-terminal 新增页面验证
12. admin-web 数据权限验证

---

## 二、测试结果汇总

| 测试项 | 结果 | 详情 |
|--------|------|------|
| 后端 tsc 类型检查 | ✅ 通过 | 非测试文件 0 错误 |
| 后端 vitest 单元测试 | ✅ 通过 | 372 文件，3980 用例，0 失败 0 跳过 |
| 后端分支覆盖率 | ✅ 通过 | 90.17%（≥ 90% 达标） |
| 后端 ESLint | ✅ 通过 | 0 错误（测试文件有未使用变量警告） |
| admin-web vue-tsc | ✅ 通过 | 0 错误 |
| admin-web build | ✅ 通过 | 构建成功（35.44s） |
| app-mobile vue-tsc | ✅ 通过 | 0 错误 |
| app-mobile build:h5 | ✅ 通过 | 构建成功 |
| store-terminal eslint | ✅ 通过 | 0 错误（4 个 console 警告） |
| store-terminal build | ✅ 通过 | 构建成功（17.19s） |

---

## 三、后端覆盖率详情

| 指标 | 数值 | 阈值 |
|------|------|------|
| 分支覆盖率 | 90.17% | ≥ 90% |
| 行覆盖率 | 97.5% | - |
| 函数覆盖率 | 97.33% | - |
| 语句覆盖率 | 97.06% | - |

---

## 四、功能验证结果

### 4.1 store-terminal 新增页面

| 页面 | 路由 | 状态 |
|------|------|------|
| 交接班管理 | `/shift` | ✅ 已注册 |
| 交接班详情 | `/shift/:id` | ✅ 已注册 |
| 会员识别 | `/member` | ✅ 已注册 |
| 销售退货 | `/sale-return` | ✅ 已注册 |

### 4.2 admin-web 数据权限

| 功能 | 状态 |
|------|------|
| 数据权限 Tab | ✅ 已实现 |
| 全部数据范围 | ✅ 已实现 |
| 按部门范围 | ✅ 已实现（树选择器） |
| 按门店范围 | ✅ 已实现（多选下拉框） |
| 按客户范围 | ✅ 已实现（多选下拉框） |

---

## 五、Bug 列表

**本次测试未发现新 Bug**

---

## 六、风险评估

| 风险 | 等级 | 说明 |
|------|------|------|
| 分支覆盖率未达 100% | ⚠️ 中 | 当前 90.17%，需继续优化 |
| console 警告 | ✅ 低 | store-terminal 有 4 个 console 警告，为原有代码 |
| ESLint 未使用变量警告 | ✅ 低 | 测试文件中有未使用变量警告 |

---

## 七、测试结论

✅ **R27 全量回归测试全部通过**

- 后端：372 文件 3980 用例全部通过，分支覆盖率 90.17%（≥ 90% 达标）
- 前端：admin-web、app-mobile、store-terminal 类型检查和构建全部成功
- 功能：store-terminal 新增页面路由已注册，admin-web 数据权限 Tab 已实现

---

## 八、测试证据

```
后端 vitest：372 passed (372)，3980 passed (3980)
后端分支覆盖率：90.17%
admin-web build：✓ built in 35.44s
app-mobile build:h5：DONE Build complete.
store-terminal build：✓ built in 17.19s
```