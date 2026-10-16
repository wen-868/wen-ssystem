#!/usr/bin/env bash
# S3-234 证据装置：部署迁移段的**失败处理反测**（含 `set -euo pipefail` 保真）。
#
# 为什么单独一个装置（而不是复用 run-deploy-migration-section.sh）：
#   ① `deploy/auto-deploy.sh` 第 2 行就是 `set -euo pipefail`，而按标记抽取出来的段**不含**这一行
#      ⇒ 抽取段是在"未置严格选项"的 shell 里跑的。本装置把 `set -euo pipefail` **补在最前面**，
#      证明"迁移段在真实 shell 选项下不会中途 abort、失败项照样点名"。
#   ② 三个反测用例都故意制造"应当被点名"的失败，验证 A. 文件不存在 B. 文件执行失败 C. 清单缺失。
#
# 用法（仓库根执行）：bash docs/evidence/S3-234/harness/run-deploy-section-redtest.sh [仓库根]
set -uo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
SCRIPT="${REPO_ROOT}/deploy/auto-deploy.sh"
# scratch 放在工作树内（`.tmp-s3241-section-redtest/`）：这样 `run-migration.mjs` 的 ESM 依赖解析
# 能沿目录往上找到工作树的 node_modules（放到 %TEMP% 下会找不到 mysql2）。收尾用 trap 删干净。
SCRATCH="${REPO_ROOT}/.tmp-s3241-section-redtest"
rm -rf "${SCRATCH}"
mkdir -p "${SCRATCH}/deploy" "${SCRATCH}/backend" "${SCRATCH}/docs/migrations" "${SCRATCH}/scripts"
trap 'rm -rf "${SCRATCH}"' EXIT

# 夹具要能真跑 run-migration.mjs：拷 .env（夹具连接，无口令明文，不进提交）与脚本原件
cp "${REPO_ROOT}/backend/.env" "${SCRATCH}/backend/.env"
cp "${REPO_ROOT}/scripts/run-migration.mjs" "${SCRATCH}/scripts/run-migration.mjs"
echo "== 夹具：${SCRATCH}（backend/.env + scripts/run-migration.mjs 原件）"

# 抽取真实源码（与全量装置同一 sed 表达式）
sed -n '/S3-234 迁移段开始/,/S3-234 迁移段结束/p' "${SCRIPT}" > "${SCRATCH}/section.sh"
echo "== 源文件 ${SCRIPT}（$(wc -l < "${SCRIPT}") 行）；抽取段 $(wc -l < "${SCRATCH}/section.sh") 行"

# 补 set -euo pipefail（真实脚本第 2 行的选项），并在段前声明 PROJECT_DIR / MIGRATION_FAILURES
{ echo 'set -euo pipefail'; echo 'MIGRATION_FAILURES=()'; cat "${SCRATCH}/section.sh"; } > "${SCRATCH}/section-strict.sh"

# 夹具：一个真实存在的文件（069，复制真件）+ 一个不存在的文件；再放一个"必然失败"的文件（008，引用无前缀表名）
cp "${REPO_ROOT}/docs/migrations/069_商品SPU增加品牌ID.sql" "${SCRATCH}/docs/migrations/"
cp "${REPO_ROOT}/docs/migrations/008_phase6_schema.sql" "${SCRATCH}/docs/migrations/"

run_case() {
  local label="$1"
  echo ""
  echo "---- [$label] ----"
  set +e
  PROJECT_DIR="${SCRATCH}" bash "${SCRATCH}/section-strict.sh"
  local rc=$?
  set -e
  echo "[${label}] 段执行退出码=${rc}"
}

# 用例 A/B：清单里同时有 ①不存在的文件 ②必然失败的文件 ③正常的文件
cat > "${SCRATCH}/deploy/migrations-manifest.txt" <<'EOF'
# 反测清单（S3-234 装置专用，不进仓）
069_商品SPU增加品牌ID.sql
008_phase6_schema.sql
999_反测_清单指向的文件不存在.sql
EOF
run_case "A+B：清单含[不存在文件]+[必然失败文件]"

# 用例 C：清单整个缺失
rm -f "${SCRATCH}/deploy/migrations-manifest.txt"
run_case "C：清单缺失"

echo ""
echo "== 期望：三个用例都**不 abort**（段退出码 0，容错不阻断是设计），且「❌ [迁移]」逐条点名到文件"
