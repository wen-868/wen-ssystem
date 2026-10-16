#!/usr/bin/env bash
# S3-234 证据装置：把 `deploy/auto-deploy.sh` 的**迁移段真实源码**按标记抽取出来执行。
#
# 为什么不"复刻一份等价脚本"：复刻件与真实部署脚本会各自漂移，证明的是复刻件而不是线上件。
# 本装置用 `sed -n '/标记开始/,/标记结束/p'` 直接抽**仓库里的原文**（行数会打印出来，可核对），
# 再 `bash -n` 过一遍语法、然后执行 —— 抽出来的就是部署时跑的那几行。
#
# 前置（夹具库）：cwd 下 `backend/.env` 需含 DB_HOST/DB_PORT/DB_USER/DB_NAME（`run-migration.mjs` 从 cwd 读 .env）。
# 用法（仓库根执行）：bash docs/evidence/S3-234/harness/run-deploy-migration-section.sh [仓库根]
set -euo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
SCRIPT="${REPO_ROOT}/deploy/auto-deploy.sh"
export PROJECT_DIR="${REPO_ROOT}"
# 迁移失败汇总数组在 auto-deploy.sh 顶部声明（标记段之外），此处按同一约定预置，保证抽取段可独立执行
MIGRATION_FAILURES=()

EXTRACTED="$(mktemp)"
sed -n '/S3-234 迁移段开始/,/S3-234 迁移段结束/p' "${SCRIPT}" > "${EXTRACTED}"

echo "== 源文件：${SCRIPT}（总 $(wc -l < "${SCRIPT}") 行）"
echo "== 按标记抽取到的迁移段：$(wc -l < "${EXTRACTED}") 行"
echo "== 抽取段首行：$(head -n 1 "${EXTRACTED}")"
echo "== 抽取段末行：$(tail -n 1 "${EXTRACTED}")"
echo "== bash -n 语法检查："
bash -n "${EXTRACTED}"
echo "   OK（退出码 0）"
echo "== 执行抽取段（cwd=${REPO_ROOT}）"
cd "${REPO_ROOT}"
set +e
bash "${EXTRACTED}"
RC=$?
set -e
echo "== 抽取段执行退出码：${RC}（迁移段本身容错不阻断 ⇒ 预期 0；失败项以「❌ [迁移]」点名）"
rm -f "${EXTRACTED}"
