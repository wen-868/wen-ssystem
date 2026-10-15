# S3-221 证据索引 · admin-web 文本 token 纳入对比度矩阵（收口总清单第 71 项）

- 工作树 / 分支：`D:\Users\ZXQL\wt-agents\S3-221` ｜ `chore/s3-221-adminweb-token-matrix`
- 基线：`295ab488`（= 本分支 HEAD；`origin/main` 另有 3 笔**纯文档**派单提交，无代码差异）
- 交付物：`scripts/contrast-check.cjs`（扩面，+137 / −2）
- 回执：`docs/tasks/cards/R101-S3-221-林夕-回传.md`（十项）+ `docs/tasks/inbox/ACTIVE-回执-S3-221.md`

## 复跑命令（全部零依赖、本地可跑）

```powershell
cd D:\Users\ZXQL\wt-agents\S3-221
node scripts/contrast-check.cjs          # 判据主命令（EXIT 0=绿 / 1=红）
node --check scripts/contrast-check.cjs  # 语法
```

## 文件清单

| 文件 | 内容 | 对应判据 |
|:--|:--|:--|
| `01-baseline-after-extend.txt` | 扩面后**全量矩阵**（48 行：31 既有 + 13 新增 + 4 登记），EXIT=0 | §三.1 |
| `02-red-muted-cccccc.txt` | **红侧**：`--text-muted` → `#cccccc` ⇒ EXIT=1，点名该 token（1.61/1.50/1.41） | §三.2 / §二.3 |
| `03-green-restore.txt` | **绿侧**：复原 ⇒ EXIT=0（附「未改坏值前本来就绿」对照 + 哈希 | §三.2 |
| `04-red-muted-bbbbbb.txt` | **换值仍红**：`--text-muted` → `#bbbbbb` ⇒ EXIT=1，比值变为 1.92（证明读真实取值） | §二.3 |
| `05-tokens-css-哈希链.txt` | 临时改动/复原的哈希链；复原后与动手前 sha256 相同、`git diff` 为空 | §三.4 / 红线 |
| `06-脚本自证-node-check-零新增依赖.txt` | `node --check`=0；零新增 require/import；改动面 | §三.3 |
| `07a-脚本diff.txt` | `git diff` 全量 | §三.4 |
| `07b-HEAD脚本-扩面前输出.txt` | 基线版脚本原样输出（对照用） | §三.4 |
| `07-既有saas-admin行未动-对照说明.md` | 逐行自动比对：既有 31 行**零差异**；仅 2 行"修改"且都在打印层 | §三.4 |
| `08-登记项实测比值与影响面.md` | 新发现 2 个不达标 token 的实测比值/引用点/候选修值/**未根治标注** | §六 |
| `09-待裁定-候选修值补丁.diff` | 修值草案（**未落地**），含"必须写字面 #365FCE、不能写 var()"的依据 | §六 |
| `10-adminweb-build.txt` | `npm --workspace admin-web run build` 读数 | §三.5 |
| `11-测试与哈希汇总.txt` | 后端 vitest 全量 / admin-web 自测 / 脚本哈希 | §三.5 |
| `12-e2e-workflow核对.txt` | 核对 `.github/workflows/e2e.yml` 第 106~109 行跑的就是本脚本 ⇒ 无需改 workflow | §四.4 |

## 一页结论

1. **盲区已堵**（可反证）：`admin-web` 自身文本 token 现按**真实取值**进入矩阵；把 `--text-muted`
   改成 `#cccccc`（第 13 项那次反测的坏值）现在**会红**，而扩面前**不会红**（`07b` 对照可证）。
2. **既有断言零改动**：31 条 saas-admin 行文本逐字节相同；仅打印层的 2 行微调（见 `07`）。
3. **两条红线遵守**：`admin-web/src/styles/tokens.css` 取值**未改**（哈希链 + `git diff` 为空）；
   `.github/**` / `deploy/**` / `docs/migrations/**` / 后端代码**零改动**。
4. **新发现 2 个不达标 token（`--text-link` / `--sidebar-text-active` = `#3F6FEF`）**：
   本单**只登记、不判红、不改值**，属**未根治**的已知覆盖缺口 ⇒ 待凌舟裁定（回执 §六）。
