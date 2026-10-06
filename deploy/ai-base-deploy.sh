#!/usr/bin/env bash
# ============================================================================
# AI 底座(NestJS)服务器部署脚本
# 由 auto-deploy.sh 在 git pull 后调用；容错设计：失败仅跳过 AI 底座，
# 不阻断主后端/前端部署。
# 源码来源：独立仓库 ZXQL-AI（wen-868/ZXQL-AI），部署时检出到 /opt/zhixiang/ai-base；
# 若独立仓库不可用，自动回退到管理系统内嵌的 backend/ai-base（保证旧 AI 不停）。
# 作者：凌舟 | 日期：2026-08-03 | 用途：R73-02 AI 底座部署阻塞项
# S3-40（2026-09-16 凌舟）：失败一律输出统一标记 `❌ [AI底座] 部署失败：<原因>`，
#   由 auto-deploy.sh 末尾汇总——容错不阻断主部署，但绝不"静默成功"
#   （同"假 CI 门禁"一类：绿灯/成功码不等于真的部署了）。
# S3-45（2026-09-16 凌舟登记 / 林夕实施）：拉取必须"显式成功或显式失败"。
#   原实现 `git fetch ... || true` 吞掉失败后**仍** `reset --hard origin/main` → 落到
#   **本地已过期的 origin/main 引用**、拿旧代码继续跑，而下游把网络失败误报成
#   "pnpm-lock.yaml 与 package.json 不同步"——**不只是沉默，而是归错因**，
#   会把排查推向错误方向（实测：一次 GnuTLS recv error (-110) 被报成 lock 失同步）。
#   现：① fetch 失败即 ai_fail（不再 reset）；② 只用 FETCH_HEAD，且仅在 fetch 成功分支内 reset；
#   ③ 日志打印实际拉到的 commit（自动覆盖"部署的是哪个提交"这条判据）；
#   ④ ai_fail 文案区分"拉取失败"与"lock 失同步"；⑤ 远端改用 SSH（服务器 HTTPS 抖过，SSH 实测稳定）。
#   ⚠️ 前置条件（新服务器上线必须逐条核，缺一即 SSH 拉取失败）：
#      1. 服务器有对 wen-868/ZXQL-AI **有读权限的 deploy key**；
#      2. `known_hosts` 已预置 GitHub 主机条目。
#         🔑 排障要点（凌舟真机注入实证，2026-09-16）：
#         - 实际连的是 **ssh.github.com:443**，不是 github.com:22 ——
#           本机 `/root/.ssh/config` 里有 `Host github.com → HostName ssh.github.com / Port 443`，
#           改 SSH 远端时**别照着"github.com"去排查**（他第一次把 github.com 指到不可达地址，故障没生效）。
#         - `known_hosts` 常开 **HashKnownHosts**（条目是哈希的）→
#           `grep github.com ~/.ssh/known_hosts` **匹配不到是假阴性**，不代表没有该条目。
#           正确查法：`ssh-keygen -F ssh.github.com -f ~/.ssh/known_hosts`（按主机名查，能解哈希）。
#         - 没有条目时又开着 BatchMode → SSH **不会**交互询问是否信任主机，直接失败退出
#           （这是有意为之：绝不让部署挂在无人应答的提问上）。
# ============================================================================
set -uo pipefail

PROJECT_DIR="/opt/zhixiang/liquor-inventory-system"
# 独立仓库（单源化）：AI 底座源码来自 ZXQL-AI 仓库
# S3-45⑤：远端改用 SSH（服务器 HTTPS 曾抖过：GnuTLS recv error (-110)；SSH 实测稳定）。
#   可用环境变量 AI_REPO_URL 覆盖，便于临时切回 HTTPS 排障。
AI_REPO_URL="${AI_REPO_URL:-git@github.com:wen-868/ZXQL-AI.git}"
# S3-45⑤（配套，必要）：SSH 在自动化里必须"快速失败"而非"等输入"——
#   BatchMode=yes 禁止任何交互式提问（无人应答会挂死整条部署），
#   ConnectTimeout=15 限制连接阶段挂死。
export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o BatchMode=yes -o ConnectTimeout=15}"
AI_TARGET_DIR="/opt/zhixiang/ai-base"
# 回退点：内嵌于管理系统的旧源码（阶段 C/D 验证通过后删除）
AI_LEGACY_DIR="${PROJECT_DIR}/backend/ai-base"
# 实际使用的源码目录（优先独立仓库，回退内嵌）
AI_DIR=""
BACKEND_ENV="${PROJECT_DIR}/backend/.env"
LOG_DIR="${PROJECT_DIR}/logs"
# S3-166-F1：AI 底座服务端口（健康检查与就绪探针共用同一变量；默认值与原字面量一致，可用环境变量覆盖）
AI_PORT="${AI_PORT:-3016}"
# S3-40：失败原因（软失败——健康检查等仍可继续的失败先记下，收尾统一出标记）
AI_FAIL_REASON=""
# S3-40：硬失败统一出口——打印统一标记后以 0 退出（不阻断主部署），由 auto-deploy.sh 汇总判定
ai_fail() {  # $1 = 失败原因
  echo "❌ [AI底座] 部署失败：$1" >&2
  exit 0
}

# S3-166：迁移失败统一出口——同样是"❌ [AI底座] 部署失败：<原因>"标记（auto-deploy.sh
#   的失败项汇总沿用同一条 grep），但**以非零码退出**（硬阻断）。
#   为什么不复用 ai_fail 的 exit 0：迁移没跑成却继续重启进程，正是本单要根治的
#   "代码已部署、数据库结构没跟上、服务实际不可用却报部署成功"的历史故障模式。
ai_migration_fail() {  # $1 = 失败原因
  echo "❌ [AI底座] 部署失败：$1" >&2
  exit 1
}

# S3-166-F1：迁移"已应用"错误的白名单判定。
#   为什么需要：生产已应用过 004/005（裸 ADD COLUMN）⇒ 重跑必报 1060；若一律硬阻断，
#   本脚本一上线就把 AI 底座发版掐死。故对"已应用/已存在"这一**窄类**错误容忍。
#   白名单只认这四个错误码，且**必须整条输出全部命中**才容忍（白名单式，不是"包含 1060 就算过"）：
#     1060 Duplicate column name ｜ 1061 Duplicate key name
#     1050 Table already exists ｜ 1091 Can't DROP ...; check that column/key exists
#   任一非白名单内容（1064 语法错、1146 表不存在、2002 连不上、其他任何码/关键字/告警行）
#   ⇒ 判定失败（fail-closed），由调用方走硬阻断。
ai_mig_error_all_tolerated() {  # $1 = mysql 的错误输出；返回值 0 = 全部属"已应用"
  local out="$1"
  [ -n "${out}" ] || return 1
  local rest
  # 1) 剔除全部白名单错误行（格式：`ERROR 1060 (42S21) at line 3: ...`）后，必须不剩任何非空行
  rest="$(printf '%s\n' "${out}" \
    | grep -vE '^[[:space:]]*ERROR[[:space:]]+(1060|1061|1050|1091)([[:space:]]|\(|:|$)' \
    | grep -vE '^[[:space:]]*$')"
  [ -z "${rest}" ] || return 1
  # 2) 且必须至少命中一条白名单错误（空输出/纯噪声不算"已应用"）
  printf '%s\n' "${out}" | grep -qE '^[[:space:]]*ERROR[[:space:]]+(1060|1061|1050|1091)([[:space:]]|\(|:|$)'
}

echo "==> [AI底座] 开始部署 $(date '+%Y-%m-%d %H:%M:%S')"

# ---- 0. 解析 AI 源码目录（单源化：优先独立仓库 ZXQL-AI，回退内嵌 backend/ai-base） ----
if [ -d "${AI_TARGET_DIR}/.git" ]; then
  echo "==> [AI底座] 更新独立仓库 ${AI_TARGET_DIR}"
  # S3-45⑤：历史检出是 HTTPS 克隆的；只改 AI_REPO_URL 不会影响已存在 remote 的 URL，
  #   必须显式 set-url，否则"把远端切到 SSH"这一步等于没做。
  git -C "${AI_TARGET_DIR}" remote set-url origin "${AI_REPO_URL}" 2>/dev/null || true
  echo "==> [AI底座] 远端 origin = $(git -C "${AI_TARGET_DIR}" remote get-url origin 2>/dev/null)"
  # S3-45①②：fetch 失败必须**显式失败**，且**失败后不得 reset**。
  #   旧写法 `git fetch ... || true` + `git reset --hard origin/main` 的致命处在于：
  #   fetch 一失败就静默回退到**本地已过期的 origin/main 引用** → 拿旧代码继续跑。
  #   现在只用 FETCH_HEAD，且 reset 只在 fetch 成功的分支内执行。
  FETCH_LOG="$(mktemp)"
  if git -C "${AI_TARGET_DIR}" fetch origin main >"${FETCH_LOG}" 2>&1; then
    tail -3 "${FETCH_LOG}"
    git -C "${AI_TARGET_DIR}" reset --hard FETCH_HEAD 2>&1 | tail -2
    # S3-45③：打印实际拉到的 commit，让"部署的是哪个提交"全程可见（可日志取证）
    echo "==> [AI底座] 已重置到 $(git -C "${AI_TARGET_DIR}" log --oneline -1)"
    rm -f "${FETCH_LOG}"
  else
    FETCH_ERR="$(tail -5 "${FETCH_LOG}" | tr '\n' ' ')"
    rm -f "${FETCH_LOG}"
    # S3-45①④：显式失败，且文案明确指向"拉取失败"——绝不与"lock 失同步"混同
    ai_fail "拉取 ZXQL-AI 失败（git fetch origin main 未成功；已保留现有代码、未做 reset）：${FETCH_ERR}"
  fi
else
  echo "==> [AI底座] 从独立仓库检出 ZXQL-AI 到 ${AI_TARGET_DIR}（${AI_REPO_URL}）"
  CLONE_LOG="$(mktemp)"
  if git clone "${AI_REPO_URL}" "${AI_TARGET_DIR}" >"${CLONE_LOG}" 2>&1; then
    tail -5 "${CLONE_LOG}"
    echo "==> [AI底座] 已检出 $(git -C "${AI_TARGET_DIR}" log --oneline -1)"
    rm -f "${CLONE_LOG}"
  else
    CLONE_ERR="$(tail -5 "${CLONE_LOG}" | tr '\n' ' ')"
    rm -f "${CLONE_LOG}"
    ai_fail "检出 ZXQL-AI 失败（git clone ${AI_REPO_URL} 未成功）：${CLONE_ERR}"
  fi
fi

if [ -f "${AI_TARGET_DIR}/package.json" ]; then
  AI_DIR="${AI_TARGET_DIR}"
  echo "==> [AI底座] 使用独立仓库源码：${AI_DIR}"
elif [ -f "${AI_LEGACY_DIR}/package.json" ]; then
  AI_DIR="${AI_LEGACY_DIR}"
  echo "==> [AI底座] 独立仓库不可用，回退到内嵌源码：${AI_DIR}（旧 AI 不停）"
else
  ai_fail "独立仓库与内嵌源码均不可用（${AI_TARGET_DIR} 与 ${AI_LEGACY_DIR} 均无 package.json）"
fi

# ---- 1. pnpm 检查（AI 底座为 pnpm 工程；服务器 Node 为 v20，必须用 pnpm@9，
#          corepack 默认拉取 pnpm 11 需 Node 22，会报 ERR_UNKNOWN_BUILTIN_MODULE） ----
if ! command -v pnpm >/dev/null 2>&1; then
  echo "==> [AI底座] 全局安装 pnpm@9（兼容 Node 20）"
  npm install -g pnpm@9 >/dev/null 2>&1 || ai_fail "pnpm@9 全局安装失败（npm install -g pnpm@9；AI 底座为 pnpm 工程，需 pnpm@9 兼容 Node 20）"
else
  PNPM_VERSION=$(pnpm --version 2>/dev/null || echo "unknown")
  echo "==> [AI底座] 已有 pnpm ${PNPM_VERSION}"
  if [ "${PNPM_VERSION%%.*}" -ge 10 ] 2>/dev/null; then
    echo "==> [AI底座] pnpm 主版本 ≥10 可能需 Node 22，降级为 pnpm@9"
    npm install -g pnpm@9 >/dev/null 2>&1 || true
  fi
fi

cd "${AI_DIR}"

# ---- 2. 生成 .env（仅当不存在时；共享 backend/.env 的 DB/Redis/JWT 配置） ----
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp ".env.example" ".env"
    echo "==> [AI底座] 从 .env.example 生成 .env"
  fi
  if [ -f "${BACKEND_ENV}" ]; then
    # 注意变量名映射：backend 用 DB_USER/DB_NAME，ai-base 用 DB_USERNAME/DB_DATABASE
    declare -A KEY_MAP=(
      [DB_HOST]=DB_HOST
      [DB_PORT]=DB_PORT
      [DB_USER]=DB_USERNAME
      [DB_NAME]=DB_DATABASE
      [DB_PASSWORD]=DB_PASSWORD
      [REDIS_HOST]=REDIS_HOST
      [REDIS_PORT]=REDIS_PORT
      [REDIS_PASSWORD]=REDIS_PASSWORD
      [JWT_SECRET]=JWT_SECRET
      [CSRF_SECRET]=CSRF_SECRET
    )
    for SRC in "${!KEY_MAP[@]}"; do
      DST="${KEY_MAP[$SRC]}"
      VAL=$(grep "^${SRC}=" "${BACKEND_ENV}" | head -1 | cut -d= -f2- || true)
      if [ -n "${VAL}" ] && [ -f ".env" ]; then
        if grep -q "^${DST}=" ".env"; then
          sed -i "s|^${DST}=.*|${DST}=${VAL}|" ".env"
        else
          echo "${DST}=${VAL}" >> ".env"
        fi
      fi
    done
    echo "==> [AI底座] 已同步 backend/.env 的 DB/Redis/JWT 配置（含 DB_USER→DB_USERNAME 映射）"
  fi
else
  echo "==> [AI底座] .env 已存在，保留现有配置"
fi

# ---- 2.4 每次部署都同步 CSRF_SECRET（写操作请求后端需要 x-csrf-token，
#          token = HMAC(CSRF_SECRET || JWT_SECRET, userId)，必须与 backend 一致） ----
if [ -f ".env" ] && [ -f "${BACKEND_ENV}" ]; then
  B_CSRF=$(grep '^CSRF_SECRET=' "${BACKEND_ENV}" | head -1 | cut -d= -f2- || true)
  if [ -n "${B_CSRF}" ]; then
    if grep -q '^CSRF_SECRET=' ".env"; then
      sed -i "s|^CSRF_SECRET=.*|CSRF_SECRET=${B_CSRF}|" ".env"
    else
      echo "CSRF_SECRET=${B_CSRF}" >> ".env"
    fi
    echo "==> [AI底座] 已同步 CSRF_SECRET（与 backend/.env 一致）"
  else
    echo "==> [AI底座] backend/.env 无 CSRF_SECRET，AI 底座将回退 JWT_SECRET 计算 CSRF"
  fi
fi

# ---- 2.5 确保 ENCRYPTION_KEY 为真实随机密钥（AUDIT-REPORT R3：禁止占位符/示例密钥启动） ----
if [ -f ".env" ]; then
  CUR_KEY=$(grep '^ENCRYPTION_KEY=' ".env" | head -1 | cut -d= -f2- || true)
  # 历史示例密钥（R70-01 曾提交于 .env.example，属公开值，禁止用于生产，检测到即轮换）
  EXAMPLE_KEY="14804bc70a2fcff7125aca977139aa5a92e3bff867e5aa1c5ebf1c3219db7359"
  if [ -z "${CUR_KEY}" ] || [ "${CUR_KEY}" = "${EXAMPLE_KEY}" ] || \
     echo "${CUR_KEY}" | grep -qiE 'change_me|changeme|your-encryption-key|your_encryption_key|replace_me|placeholder|请替换|xxx'; then
    NEW_KEY=$(openssl rand -hex 32)
    if grep -q '^ENCRYPTION_KEY=' ".env"; then
      sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${NEW_KEY}|" ".env"
    else
      echo "ENCRYPTION_KEY=${NEW_KEY}" >> ".env"
    fi
    echo "==> [AI底座] ENCRYPTION_KEY 为空/占位符/示例密钥，已用 openssl rand 自动生成并写入 .env（安全）"
  else
    echo "==> [AI底座] ENCRYPTION_KEY 已配置为真实密钥，保留现有值"
  fi
fi

# ---- 2.6 启用 API 目录工具（功能即技能：目录登记即成为 AI 技能；当前目录均为 low 风险查询） ----
if [ -f ".env" ]; then
  if grep -q '^ENABLE_API_CATALOG_TOOLS=' ".env"; then
    echo "==> [AI底座] ENABLE_API_CATALOG_TOOLS 已配置，保留现有值"
  else
    echo "ENABLE_API_CATALOG_TOOLS=true" >> ".env"
    echo "==> [AI底座] 已启用 ENABLE_API_CATALOG_TOOLS=true（API 目录工具注册）"
  fi
fi

# ---- 3. 安装依赖（需执行原生脚本以编译 @napi-rs/canvas） ----
echo "==> [AI底座] pnpm install"
# S3-45④：文案与"拉取失败"严格区分。锁不一致的排查要点（S3-43 实测）：
#   本底座受 Node 20 限制固定用 pnpm 9，而 pnpm 9 **只读 package.json#pnpm.overrides**、
#   不读 pnpm-workspace.yaml#overrides（后者是 pnpm 10+ 的位置）→ 两处必须同步。
pnpm install --frozen-lockfile 2>&1 | tail -8 || ai_fail "pnpm install --frozen-lockfile 失败（lock 与 package.json 的 overrides 不一致；本底座用 pnpm 9，overrides 必须写在 package.json#pnpm.overrides，pnpm-workspace.yaml 里的 pnpm 9 不读）"

# ---- 4. 构建 ----
echo "==> [AI底座] pnpm build"
pnpm build 2>&1 | tail -8 || ai_fail "pnpm build 失败（见上方构建日志）"

# ---- 4.5 数据库迁移补齐（S3-166：根治"代码已部署、结构没跟上"） ----
# 背景：2026-09-27 / 10-03 / 10-05 连续三次复测均为「AI 底座进程健康，但 007~011 未应用」
#   ⇒ `/api/health/ready` 探针 degraded ⇒ `/api/chat` 500 全挂。根因是本脚本只拉代码构建、
#   从来不跑迁移（迁移文件在独立仓库 ZXQL-AI 的 migrations/，需人工执行，而无人会"想起来"）。
# 做法：对 ${AI_DIR}/migrations/*.sql 按文件名数字序逐个执行（NNN_ 三位零填充前缀 ⇒ C 字节序 == 数字序）。
# 前提（缺一即本步骤会在生产报错并阻断部署，属 AI 底座仓 ZXQL-AI 侧待修项，见回传卡）：
#   ① 迁移脚本必须幂等：业务库 004_platform_ai_config_fallback.sql / 005_session_archive_billing.sql
#      目前是裸 `ADD COLUMN`（无 information_schema 判定）⇒ 重跑报 1060 Duplicate column；
#   ② SQL 注释必须合法：007_e5_auto_close.sql:7 与 009_audit_lane_categories.sql:9 写成 `--（`
#      （`--` 后无空白，直跟中文）⇒ MySQL 报 1064，需改为 `-- （`。
# 约束：迁移文件必须**整文件执行**（依赖 @ai_db 会话变量与 PREPARE），故用 `mysql < 文件` 投喂，
#   不得按分号拆分到多条连接逐条执行（拆分会丢会话变量）。
# 失败语义（S3-166-F1 修订）：任一脚本非 0 ⇒ **先看错误内容**：
#   · 若且仅若输出里的错误**全部**落在白名单 {1060,1061,1050,1091}（=已应用/已存在）内
#     ⇒ 记为 MIG_ALREADY（日志点名 + 汇总单列，绝不静默），继续跑下一个脚本；
#   · 其余任何错误（1064 语法错、1146 表不存在、2002 连不上…）⇒ 立即硬阻断
#     （见 ai_migration_fail），并在日志与失败汇总里点名脚本。
#   容忍只解决"已应用的迁移重放不致死"，**结构是否真的跟上**由第 6.1 步就绪探针终判。
echo "==> [AI底座] 迁移补齐 $(date '+%Y-%m-%d %H:%M:%S')"
AI_MIGRATIONS_DIR="${AI_DIR}/migrations"
AI_MIGRATIONS_SKIPPED=0
if [ ! -d "${AI_MIGRATIONS_DIR}" ]; then
  if [ "${AI_DIR}" = "${AI_LEGACY_DIR}" ]; then
    # 内嵌回退副本（backend/ai-base）不含 migrations/：迁移只由独立仓库 ZXQL-AI 维护
    echo "==> [AI底座] 迁移补齐：内嵌回退副本无 migrations/，跳过（独立仓库不可用时本就没有新迁移可补）"
    AI_MIGRATIONS_SKIPPED=1
  else
    ai_migration_fail "未找到迁移目录 ${AI_MIGRATIONS_DIR}（独立仓库检出异常，无法保证数据库结构；拒绝报部署成功）"
  fi
fi
if [ "${AI_MIGRATIONS_SKIPPED}" = "0" ]; then
  if ! command -v mysql >/dev/null 2>&1; then
    ai_migration_fail "未找到 mysql 客户端（迁移补齐依赖 mysql CLI，用法同 deploy/restore-drill.sh；请确认服务器已安装 mysql-server）"
  fi
  # 连接串沿用本脚本既有取法：读 AI 底座 .env 的 DB_* 键（该 .env 由第 2 步从 backend/.env 同步生成），
  #   不新增任何硬编码凭据；密码走 MYSQL_PWD（与 deploy/02-mysql-backup.sh、deploy/restore-drill.sh 同款）。
  MIG_ENV_FILE="${AI_DIR}/.env"
  MIG_DB_HOST="$(grep '^DB_HOST=' "${MIG_ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2-)"
  MIG_DB_PORT="$(grep '^DB_PORT=' "${MIG_ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2-)"
  MIG_DB_USER="$(grep '^DB_USERNAME=' "${MIG_ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2-)"
  if [ -z "${MIG_DB_USER}" ]; then
    MIG_DB_USER="$(grep '^DB_USER=' "${MIG_ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2-)"
  fi
  MIG_DB_PASSWORD="$(grep '^DB_PASSWORD=' "${MIG_ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2-)"
  MIG_DB_NAME="$(grep '^DB_DATABASE=' "${MIG_ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2-)"
  if [ -z "${MIG_DB_NAME}" ]; then
    MIG_DB_NAME="$(grep '^DB_NAME=' "${MIG_ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2-)"
  fi
  MIG_DB_HOST="${MIG_DB_HOST:-127.0.0.1}"
  MIG_DB_PORT="${MIG_DB_PORT:-3306}"
  if [ -z "${MIG_DB_USER}" ] || [ -z "${MIG_DB_NAME}" ]; then
    ai_migration_fail "AI 底座 .env（${MIG_ENV_FILE}）缺少 DB_USERNAME/DB_DATABASE（或 DB_USER/DB_NAME），无法确定业务库连接"
  fi
  echo "==> [AI底座] 迁移补齐：目标 ${MIG_DB_USER}@${MIG_DB_HOST}:${MIG_DB_PORT}/${MIG_DB_NAME}，目录 ${AI_MIGRATIONS_DIR}"
  MIG_TOTAL=0
  MIG_OK=0
  MIG_SKIP=0
  MIG_ALREADY=0
  MIG_ALREADY_LIST=""
  MIG_FAILED=""
  # LC_ALL=C ⇒ 字节序排序；NNN_ 前缀零填充 ⇒ 007 < 008 < ... < 011（数字序即字节序）
  while IFS= read -r MIG_FILE; do
    [ -n "${MIG_FILE}" ] || continue
    MIG_NAME="$(basename "${MIG_FILE}")"
    MIG_TOTAL=$((MIG_TOTAL + 1))
    MIG_OUT="$(MYSQL_PWD="${MIG_DB_PASSWORD}" mysql \
      --host="${MIG_DB_HOST}" \
      --port="${MIG_DB_PORT}" \
      --user="${MIG_DB_USER}" \
      --default-character-set=utf8mb4 \
      "${MIG_DB_NAME}" < "${MIG_FILE}" 2>&1)"
    MIG_RC=$?
    if [ "${MIG_RC}" -ne 0 ]; then
      if ai_mig_error_all_tolerated "${MIG_OUT}"; then
        # S3-166-F1：全部错误码都在白名单内 ⇒ "已应用"（重放），容忍但必须显式记账
        MIG_TOL_ERRNOS="$(printf '%s\n' "${MIG_OUT}" \
          | grep -oE '^[[:space:]]*ERROR[[:space:]]+[0-9]{4}' \
          | grep -oE '[0-9]{4}' | LC_ALL=C sort -u | tr '\n' ',' | sed -e 's/,$//')"
        [ -n "${MIG_OUT}" ] && echo "${MIG_OUT}" >&2
        echo "==> [AI底座][迁移] ${MIG_NAME} → 容忍（已应用：错误码 ${MIG_TOL_ERRNOS}）"
        MIG_ALREADY=$((MIG_ALREADY + 1))
        MIG_ALREADY_LIST="${MIG_ALREADY_LIST} ${MIG_NAME}"
        continue
      fi
      [ -n "${MIG_OUT}" ] && echo "${MIG_OUT}" >&2
      echo "==> [AI底座][迁移] ${MIG_NAME} → 失败（EXIT=${MIG_RC}）" >&2
      MIG_FAILED="${MIG_FAILED} ${MIG_NAME}(EXIT=${MIG_RC})"
      break
    fi
    if printf '%s' "${MIG_OUT}" | grep -q '已存在，跳过'; then
      echo "==> [AI底座][迁移] ${MIG_NAME} → 跳过（EXIT=0，幂等：已存在，跳过）"
      MIG_SKIP=$((MIG_SKIP + 1))
    else
      [ -n "${MIG_OUT}" ] && echo "${MIG_OUT}"
      echo "==> [AI底座][迁移] ${MIG_NAME} → 成功（EXIT=0）"
      MIG_OK=$((MIG_OK + 1))
    fi
  done < <(find "${AI_MIGRATIONS_DIR}" -maxdepth 1 -type f -name '*.sql' 2>/dev/null | LC_ALL=C sort)
  echo "==> [AI底座][迁移] 结果汇总：尝试 ${MIG_TOTAL} 个 / 成功 ${MIG_OK} / 跳过 ${MIG_SKIP} / 容忍（已应用） ${MIG_ALREADY} / 失败 $(if [ -n "${MIG_FAILED}" ]; then echo 1; else echo 0; fi)"
  if [ "${MIG_ALREADY}" -gt 0 ]; then
    # 容忍项单列（不与"失败"混为一谈）：谁被容忍、容忍了几个，一眼可查
    MIG_ALREADY_NAMES="$(printf '%s' "${MIG_ALREADY_LIST}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/[[:space:]][[:space:]]*/, /g')"
    echo "==> [AI底座][迁移] 容忍（已应用）= ${MIG_ALREADY} 个：${MIG_ALREADY_NAMES}"
  fi
  if [ -n "${MIG_FAILED}" ]; then
    ai_migration_fail "数据库迁移失败，已阻断本次 AI 底座部署（未重启进程，旧版本继续服务）；失败脚本：${MIG_FAILED# }"
  fi
  if [ "${MIG_TOTAL}" -eq 0 ]; then
    ai_migration_fail "迁移目录 ${AI_MIGRATIONS_DIR} 内没有 *.sql（无法保证数据库结构；拒绝报部署成功）"
  fi
fi

# ---- 5. 启动 PM2 ----
echo "==> [AI底座] pm2 启动 zhixiang-ai-base"
pm2 delete zhixiang-ai-base 2>/dev/null || true
pm2 start dist/main.js \
  --name zhixiang-ai-base \
  --cwd "${AI_DIR}" \
  --env production \
  --log "${LOG_DIR}/ai-base.log" \
  --time || ai_fail "pm2 启动 zhixiang-ai-base 失败（见 pm2 logs）"
pm2 save

# ---- 6. 健康检查 ----
echo "==> [AI底座] 健康检查 http://127.0.0.1:${AI_PORT}/api/health"
sleep 5
READY=0
for i in {1..15}; do
  if curl -fsS "http://127.0.0.1:${AI_PORT}/api/health" >/dev/null 2>&1; then
    echo "==> [AI底座] 健康检查通过（第 ${i} 次）"
    READY=1
    break
  fi
  sleep 2
done
if [ "${READY}" != "1" ]; then
  # S3-40：软失败——nginx 反代等后续步骤仍照常执行，收尾统一出标记
  AI_FAIL_REASON="健康检查未通过（15 次探测 http://127.0.0.1:${AI_PORT}/api/health 均失败），日志：${LOG_DIR}/ai-base.log"
fi

# ---- 6.1 就绪探针：终态闸门（S3-166-F1） ----
# 为什么单列一条：/api/health 只证明**进程活着**；迁移步骤容忍了"已应用"类错误（1060 等）之后，
#   必须有终态判据，否则"容忍"会退化成"把结构缺失一起放过"。就绪探针（缺表/缺列 ⇒ degraded）
#   就是那个判据——容忍是手段，探针才是"结构真的跟上了"的裁判。
# 失败出口：沿用 ai_migration_fail（同一条 ❌ 标记 + 非 0 退出），点名"探针未就绪"并打印响应摘要。
# 口径说明：只有进程健康检查通过时才探（进程都没起来属第 6 步已有的软失败口径，不重复升级为硬阻断）。
if [ "${READY}" != "1" ]; then
  echo "==> [AI底座] 就绪探针跳过：健康检查未通过（同上软失败口径，收尾统一出标记）"
else
  AI_HEALTH_READY_URL="http://127.0.0.1:${AI_PORT}/api/health/ready"
  echo "==> [AI底座] 就绪探针 ${AI_HEALTH_READY_URL}"
  AI_READY_OK=0
  AI_READY_STATUS=""
  AI_READY_BODY=""
  AI_READY_NOTE=""
  for i in {1..15}; do
    AI_READY_NOTE=""
    # 不加 -f：非 2xx（如 503 + degraded JSON）也要把响应体读回来做摘要
    AI_READY_BODY="$(curl -sS --max-time 5 "${AI_HEALTH_READY_URL}" 2>&1)" || AI_READY_NOTE="curl 退出码非 0（服务不可达/连接被拒）"
    AI_READY_STATUS="$(printf '%s' "${AI_READY_BODY}" \
      | grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
      | sed -e 's/.*:[[:space:]]*"\([^"]*\)"$/\1/')"
    if [ "${AI_READY_STATUS}" = "ready" ]; then
      AI_READY_OK=1
      echo "==> [AI底座] 就绪探针通过（status=ready，第 ${i} 次）"
      break
    fi
    sleep 2
  done
  if [ "${AI_READY_OK}" != "1" ]; then
    ai_migration_fail "探针未就绪：${AI_HEALTH_READY_URL} 未返回 status=ready（实际 status='${AI_READY_STATUS:-<空>}'${AI_READY_NOTE:+；${AI_READY_NOTE}}；响应摘要：$(printf '%s' "${AI_READY_BODY}" | tr -d '\n' | head -c 300)）"
  fi
fi

# ---- 7. nginx /ai-api/ 反代自动配置（SSE 流式对话 + WebSocket 实时推送） ----
# 幂等：已存在 /ai-api/ 则跳过；修改前备份；nginx -t 校验失败自动回滚，绝不破坏现有配置
echo "==> [AI底座] 检查 nginx /ai-api/ 反代配置"
NGINX_SITE=""
# 优先从 sites-enabled 解析实际生效文件（readlink -f 指向 sites-available 真实文件）
for f in /etc/nginx/sites-enabled/*; do
  REAL_FILE="$(readlink -f "${f}" 2>/dev/null || echo "${f}")"
  if [ -f "${REAL_FILE}" ] && grep -q "server_name.*admin.onepan.cn" "${REAL_FILE}" 2>/dev/null; then
    NGINX_SITE="${REAL_FILE}"
    break
  fi
done
if [ -z "${NGINX_SITE}" ]; then
  # 兜底：回退到 sites-available 全量扫描
  for f in /etc/nginx/sites-available/*; do
    if [ -f "${f}" ] && grep -q "server_name.*admin.onepan.cn" "${f}" 2>/dev/null; then
      NGINX_SITE="${f}"
      break
    fi
  done
fi

if [ -z "${NGINX_SITE}" ]; then
  echo "==> [AI底座] 未找到 admin.onepan.cn 的 nginx 配置文件（跳过；请手动配置 /ai-api/ 反代，模板见 deploy/nginx-production.conf）"
elif grep -q "location /ai-api/" "${NGINX_SITE}"; then
  AI_BLOCKS=$(grep -c "location /ai-api/" "${NGINX_SITE}")
  HAS_HTTP11=$(grep -c "proxy_http_version 1.1" "${NGINX_SITE}")
  HAS_UPGRADE=$(grep -c "proxy_set_header Upgrade" "${NGINX_SITE}")
  HAS_CONN=$(grep -c 'proxy_set_header Connection "upgrade"' "${NGINX_SITE}")
  # 每个 /ai-api/ 块都须含三要素才算完整
  if [ "${HAS_HTTP11}" -ge "${AI_BLOCKS}" ] && [ "${HAS_UPGRADE}" -ge "${AI_BLOCKS}" ] && [ "${HAS_CONN}" -ge "${AI_BLOCKS}" ]; then
    echo "==> [AI底座] /ai-api/ 反代已完整（proxy_http_version 1.1 + Upgrade + Connection），跳过"
  else
    cp "${NGINX_SITE}" "${NGINX_SITE}.bak-ai-api"
    awk '
      # 对所有 /ai-api/ 块补齐 WebSocket 三要素（幂等：块内已有则跳过）
      /location \/ai-api\/ \{/ { in_ai=1 }
      in_ai && /^\s*\}/ {
        # 块结束前检查三项是否齐全，缺失则补齐（幂等）
        if (!seen_http11) print "        proxy_http_version 1.1;"
        if (!seen_upgrade) print "        proxy_set_header Upgrade $http_upgrade;"
        if (!seen_conn) print "        proxy_set_header Connection \"upgrade\";"
        in_ai=0; seen_http11=0; seen_upgrade=0; seen_conn=0
      }
      in_ai && /proxy_http_version 1.1/ { seen_http11=1 }
      in_ai && /proxy_set_header Upgrade/ { seen_upgrade=1 }
      in_ai && /proxy_set_header Connection/ { seen_conn=1 }
      { print }
    ' "${NGINX_SITE}" > "${NGINX_SITE}.ai-api.tmp"
    if nginx -t >/dev/null 2>&1; then
      mv "${NGINX_SITE}.ai-api.tmp" "${NGINX_SITE}"
      systemctl reload nginx >/dev/null 2>&1 || nginx -s reload >/dev/null 2>&1 || true
      echo "==> [AI底座] /ai-api/ 反代已补齐 WebSocket 三要素（proxy_http_version 1.1/Upgrade/Connection）并通过 nginx -t，已 reload（备份：${NGINX_SITE}.bak-ai-api）"
    else
      rm -f "${NGINX_SITE}.ai-api.tmp"
      echo "==> [AI底座] nginx -t 校验失败，已保留原配置（请手动检查 ${NGINX_SITE}）"
    fi
  fi
else
  cp "${NGINX_SITE}" "${NGINX_SITE}.bak-ai-api"
  awk '
    /location \/api\/ \{/ { in_api=1 }
    in_api && /^    \}$/ {
      print
      print "    # AI 底座（SSE 流式对话 + WebSocket 实时推送）：/ai-api/* → 服务器 3016（保留 /api 前缀）"
      print "    location /ai-api/ {"
      print "        proxy_pass http://127.0.0.1:3016/;"
      print "        proxy_http_version 1.1;"
      print "        proxy_set_header Host $host;"
      print "        proxy_set_header X-Real-IP $remote_addr;"
      print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
      print "        proxy_set_header X-Forwarded-Proto $scheme;"
      print "        proxy_set_header Upgrade $http_upgrade;"
      print "        proxy_set_header Connection \"upgrade\";"
      print "        proxy_buffering off;"
      print "        proxy_cache off;"
      print "        proxy_read_timeout 300s;"
      print "        proxy_send_timeout 300s;"
      print "    }"
      in_api=0
      next
    }
    { print }
  ' "${NGINX_SITE}" > "${NGINX_SITE}.ai-api.tmp"

  if nginx -t >/dev/null 2>&1; then
    mv "${NGINX_SITE}.ai-api.tmp" "${NGINX_SITE}"
    systemctl reload nginx >/dev/null 2>&1 || nginx -s reload >/dev/null 2>&1 || true
    echo "==> [AI底座] /ai-api/ 反代已写入并通过 nginx -t，已 reload（备份：${NGINX_SITE}.bak-ai-api）"
  else
    rm -f "${NGINX_SITE}.ai-api.tmp"
    echo "==> [AI底座] nginx -t 校验失败，已保留原配置（请手动检查 ${NGINX_SITE}）"
  fi
fi

# ---- 8. RAG embedding 自动配置 + 检测（复用智谱 GLM_API_KEY，零手工） ----
EMBED_MODEL=$(grep '^EMBEDDING_MODEL=' .env 2>/dev/null | cut -d= -f2-)
if [ -z "${EMBED_MODEL}" ]; then
  GLM_KEY=$(grep '^GLM_API_KEY=' .env 2>/dev/null | head -1 | cut -d= -f2-)
  if [ -n "${GLM_KEY}" ]; then
    sed -i '/^EMBEDDING_BASE_URL=/d; /^EMBEDDING_API_KEY=/d; /^EMBEDDING_MODEL=/d' .env
    {
      echo "EMBEDDING_BASE_URL=https://open.bigmodel.cn/api/paas/v4"
      echo "EMBEDDING_API_KEY=${GLM_KEY}"
      echo "EMBEDDING_MODEL=embedding-3"
    } >> .env
    EMBED_MODEL="embedding-3"
    echo "==> [AI底座] RAG 已自动配置：智谱 embedding-3（复用 GLM_API_KEY，服务器零负载）"
  else
    echo "==> [AI底座] 提示：EMBEDDING_MODEL 未配置且无 GLM_API_KEY，RAG 预置知识库不会加载（配置 embedding 模型后重启生效）"
  fi
fi
if [ -n "${EMBED_MODEL}" ]; then
  EMBED_BASE=$(grep '^EMBEDDING_BASE_URL=' .env 2>/dev/null | cut -d= -f2-)
  EMBED_BASE="${EMBED_BASE:-http://127.0.0.1:11434/v1}"
  if echo "${EMBED_BASE}" | grep -q '11434'; then
    OLLAMA_HOST="${EMBED_BASE%/v1}"
    if curl -s --max-time 3 "${OLLAMA_HOST}/api/tags" >/dev/null 2>&1; then
      echo "==> [AI底座] RAG 已配置：EMBEDDING_MODEL=${EMBED_MODEL}，Ollama 连通正常（${OLLAMA_HOST}）"
    else
      echo "==> [AI底座] 提示：EMBEDDING_MODEL 已配置但 ${OLLAMA_HOST} 不可达——请确认 Ollama 已启动，且已执行 ollama pull ${EMBED_MODEL}"
    fi
  else
    echo "==> [AI底座] RAG embedding 指向云端服务：${EMBED_BASE}（EMBEDDING_MODEL=${EMBED_MODEL}）"
  fi
fi
if [ -z "$(grep '^DEEPSEEK_API_KEY=' .env 2>/dev/null | cut -d= -f2-)" ]; then
  echo "==> [AI底座] 提示：DEEPSEEK_API_KEY 未配置，端到端验收 LLM 项需配置后执行 node scripts/ai-base-e2e.mjs"
fi

# S3-40：软失败在此收口——只有全程无失败才报"部署完成"
if [ -n "${AI_FAIL_REASON}" ]; then
  echo "❌ [AI底座] 部署失败：${AI_FAIL_REASON}" >&2
else
  echo "==> [AI底座] 部署完成 $(date '+%Y-%m-%d %H:%M:%S')"
fi

# ---- 工作区自检（S3-39）：部署不应产生脏改动 ----
echo "==> 工作区自检（AI 底座检出）"
if [[ ! -d "${AI_DIR}/.git" ]]; then
  echo "跳过：${AI_DIR} 不是 git 检出"
elif [[ -n "$(git -C "${AI_DIR}" status --porcelain)" ]]; then
  echo "⚠️  警告：部署后 AI 底座检出非空，被改动的文件：" >&2
  git -C "${AI_DIR}" status --porcelain >&2
  echo "⚠️  大范围 lock 的 resolved 差异 → 仍有脚本用 npm install，应改 npm ci（S3-39）。" >&2
  echo "⚠️  不要提交这类改动，也不要只 revert 了事——改部署脚本才是根治。" >&2
else
  echo "工作区干净 ✅"
fi
