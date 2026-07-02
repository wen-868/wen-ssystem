# 阿澈 · Phase 16 · 字段对齐修复 · 小程序端

**日期**：2026-07-02
**状态**：待开始
**来源**：Phase 15 字段级审计 — 小程序端字段 vs 后端 DDL 对齐

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 验证 `config.template.js` 占位符与后端 `publish` 服务替换逻辑一致 | **P0** | ❌ |

---

## 详细说明

### 1. 验证 `config.template.js` 占位符与后端 publish 替换逻辑一致 🔴

- **文件**：`miniapp/config.template.js`
- **关联文件**：`backend/src/services/admin/miniapp-publish.service.ts`
- **问题**：小程序模板使用 `__XXX__` 格式占位符，后端 `miniapp-publish.service.ts` 在发布时进行占位符替换。两边占位符名称必须完全一致。
- **检查方法**：

**步骤 1**：列出 `config.template.js` 中所有 `__XXX__` 占位符：
```bash
grep -oP '__[A-Z_]+__' miniapp/config.template.js | sort -u
```

**步骤 2**：列出 `miniapp-publish.service.ts` 中所有替换逻辑中引用的占位符：
```bash
grep -oP '__[A-Z_]+__' backend/src/services/admin/miniapp-publish.service.ts | sort -u
```

**步骤 3**：对比两个列表，确保：
- 所有 `config.template.js` 中的占位符在 `publish` 服务中都有对应的替换值
- 所有 `publish` 服务中引用的占位符在 `config.template.js` 中都存在
- 不能有多余占位符（会导致未被替换，模板中出现 `__XXX__` 字面量）
- 不能有缺失占位符（publish 服务尝试替换但模板中不存在，可能出错）

**修复**：根据对比结果，在 `config.template.js` 或 `miniapp-publish.service.ts` 中补充/删除不一致的占位符。

---

## 验收标准

1. `config.template.js` 和 `miniapp-publish.service.ts` 中的占位符完全一致
2. 小程序编译通过，无报错

---

## 文件清单

```
miniapp/
└── config.template.js    # 可能需要修改：对齐 publish 服务的占位符列表
```