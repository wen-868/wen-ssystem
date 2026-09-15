# R101-S3-39 · 部署脚本 `npm install` → `npm ci`（消除服务器 lockfile 漂移）

- 卡号：R101-S3-39
- 类型：缺陷修复 / 部署流程
- 提出：凌舟（2026-09-16，S3-38 部署后服务器工作区反复变脏的根因定位）
- 执行：林夕
- 状态：✅ 6 个部署脚本已改，本地语法校验通过；**生产验收（跑一次完整部署后工作区为空）待凌舟侧复跑**
- 关联：S3-38、`docs/部署链路对照表.md` §五、踩坑 [72]

---

## 一、缺陷本体

S3-38 部署后，服务器检出 `git status` 出现 **250 增 / 85 删**；
`git checkout -- package-lock.json` 还原后，**再跑一次部署又变脏**。

**根因（已取证，非人为、非 hook）**：

1. 服务器 `~/.npmrc` 的 registry = `https://mirrors.tencentyun.com/npm`；仓库里**没有** `.npmrc`，
   committed `package-lock.json` 的 `resolved` 指向**另一个源**；
2. 部署脚本用 **`npm install`** → 它会**按当前 registry 重写 lockfile 的 `resolved`**
   （本次差异新增的正是 `admin-web/node_modules/*` 指向 `mirrors.tencentyun.com` 的条目）；
3. 于是**每次部署都把生产检出改脏**——这是部署流程的副作用，不是垃圾。

> 与 `NUL` 那种"Windows 命令误用产生的垃圾"不同：这一类的判据是
> **生产检出出现大范围 `resolved` 字段差异的 lockfile 改动**。

## 二、凌舟给定的修复方向（已锁定）

1. 部署脚本里**非全局** `npm install` → **`npm ci`**
   （严格按 lockfile 安装、**不重写 lockfile**；需走镜像时 `npm ci --registry="$npm_config_registry"`）；
2. **全局安装保留**（`npm install -g pm2` / `-g pnpm@9` 不写项目 lock，不影响）；
3. ai-base 的 `pnpm install --no-frozen-lockfile` → **`--frozen-lockfile`**；
4. **每个部署脚本末尾加工作区自检**（`git status --porcelain` 非空即警告），让"部署引入脏改动"当场暴露；
5. **验收**：跑一次完整部署后 `git status --short` 必须为空。

## 三、本次改动（6 个脚本）

| 脚本 | 原 | 改 |
|---|---|---|
| `deploy/03-deploy.sh:39-43` | `npm install` | `npm ci` |
| `deploy/07-local-archive-deploy.sh:26-28` | `npm install` | `npm ci` |
| `deploy/auto-deploy.sh:14-15` | `npm install --ignore-scripts --legacy-peer-deps` | `npm ci --ignore-scripts --legacy-peer-deps` |
| `deploy/rollback.sh:36-37` | `npm install --ignore-scripts --legacy-peer-deps` | `npm ci --ignore-scripts --legacy-peer-deps`（回滚同样不应污染工作区） |
| `deploy/ai-base-deploy.sh:145-146` | `pnpm install --no-frozen-lockfile` | `pnpm install --frozen-lockfile` |
| `deploy/deploy-production.sh:91-94` | `npm install --production \|\| npm install` | `npm install --production --no-package-lock \|\| npm install --no-package-lock` |

**`deploy-production.sh` 的例外**：它是「产物打包式」部署，只拷贝 `backend/package.json`
（**无 lock 文件**）→ 无法使用 `npm ci`（`npm ci` 要求 lock 存在），
故退用 `--no-package-lock`，同样达到"不重写 lockfile、不污染工作区"的目的。

**保留未动（全局安装）**：`03-deploy.sh:67`、`deploy-production.sh:98` 的 `npm install -g pm2`，
以及 `ai-base-deploy.sh:50/56` 的 `npm install -g pnpm@9` —— 均为全局安装，不写项目 lock。

**自检块口径**（各脚本统一追加）：

```bash
if [[ ! -d .git ]]; then
  echo "跳过：当前目录不是 git 检出（$(pwd)）"
elif [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠️  警告：部署后工作区非空，被改动的文件：" >&2
  git status --porcelain >&2
  echo "⚠️  大范围 lock 的 resolved 差异 → 说明仍有脚本在用 npm install，应改 npm ci（S3-39）。" >&2
  echo "⚠️  不要提交这类改动，也不要只 revert 了事——改部署脚本才是根治。" >&2
else
  echo "工作区干净 ✅"
fi
```

> `ai-base-deploy.sh` 自检对象是 `${AI_DIR}` 检出、`deploy-production.sh` 是
> `/root/liquor-inventory-system`，两者不在仓库根执行，改用 `git -C "${DIR}" status --porcelain`。

## 四、门禁（本地已跑）

- [x] `bash -n` **6 个脚本全部通过**
      （本机 `bash` 不在 PATH，用绝对路径 `"C:/Program Files/Git/bin/bash.exe" -n`）
- [x] grep 复核：`deploy/` 下**非全局** install 已全部为 `ci` / `--no-package-lock`；
      `-g` 全局安装三处均保留
- [x] 同步文档 `deploy/README.md:79`（步骤说明里的 `npm install` → `npm ci`）

## 五、验收（生产侧，待凌舟复跑）

- [ ] 服务器跑一次**完整部署**后 `git status --short` **为空**
- [ ] （反向）若仍非空，自检块应**当场打印**被改动文件 → 说明还有脚本漏改，按提示回改

## 六、教训

1. **lockfile 是"部署副作用的记录面"**——它变脏往往不是"有人改了它"，
   而是"部署工具在用另一个源重写它"。
2. 排查工作区变脏，先问"**跑一次流程会不会自己变脏**"：
   可复现 → 流程问题；不可复现 → 人为。不要先归因到人。
3. 全局安装与局部安装**分开看**：`-g` 不写项目 lock，不要一刀切全改 `ci`。
4. **部署脚本应自带工作区自检**——把"部署后应干净"变成脚本会自己喊的断言，
   而不是靠人事后 `git status` 发现。
