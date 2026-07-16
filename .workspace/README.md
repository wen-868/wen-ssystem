# 工作文件夹

> 此文件夹存放所有**非代码**的工作文件。代码目录（backend/, admin-web/, app-mobile/ 等）不在其中。

## 目录结构

```
.workspace/
├── memories/        ← AI 助手记忆文件（凌舟/墨/林夕/苏然/阿坚/阿澈）
├── standards/       ← 项目标准 & 规则
│   ├── 项目统一标准.md
│   ├── 项目规则.md
│   ├── 项目记忆.md
│   └── 踩坑日志.md
├── tasks/           ← 任务文件
│   ├── current-tasks.md     ← 唯一任务索引文件
│   ├── R47-*.md             ← 修复方案
│   └── R48-*.md             ← 修复方案
├── reports/         ← 测试报告 & 审查报告
└── product/         ← 产品规格文档
```

## 不能移动的文件（代码运行时依赖）

以下文件必须保留在原位置，代码启动时会读取：

- `docs/migrations/` — migration.ts 启动时执行 SQL 迁移
- `docs/init_database.sql` — 完整数据库建表脚本
- `docs/API.md` — API 文档
- `docs/DEPLOY.md` — 部署文档
- `deploy/` — 部署脚本和配置
- `scripts/` — 工程脚本（构建、测试、部署）
- `docs/design/` — 设计规范
- `docs/archive/` — 历史归档
