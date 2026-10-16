#!/usr/bin/env bash
# S3-234 证据装置（**R1 返工版 v2**）：把 `deploy/auto-deploy.sh` 的两段**真实源码**按标记抽出来、串成一个
# shell 进程执行：
#   ① 迁移段（标记 `S3-234 迁移段开始` / `S3-234 迁移段结束`）
#   ② 失败汇总段（标记 `S3-234 失败汇总段开始` / `S3-234 失败汇总段结束`）
#
# 为什么不"复刻一份等价脚本"：复刻件与真实部署脚本会各自漂移，证明的是复刻件而不是线上件。
# 本装置用 `sed -n '/标记开始/,/标记结束/p'` 直接抽**仓库里的原文**（行数会打印，可核对），
# `bash -n` 过语法后执行 —— 抽出来的就是部署时跑的那几行。
#
# 为什么两段必须**同一个进程**：R1 返工的结论是「**新失败阻断部署**」，判红发生在**汇总段**
#   （`MIGRATION_FAILURES` 并入 `FAILURES` ⇒ 非交互或 `DEPLOY_STRICT=1` 时 `exit 1`）。
#   bash 数组不能跨进程传递 ⇒ 只跑迁移段拿不到"部署是否判红"的真结论。故本装置串成一脚本跑，
#   退出码 = **部署判红结论**；而"迁移段自身容错不 abort"的证据 = 段小结行被打印出来（见输出）。
#
# 保真说明（相对 s3241 版本的一处改进）：本版把 `set -euo pipefail`（`auto-deploy.sh` 第 2 行的选项）
#   补在段前 ⇒ 段在**真实 shell 选项**下跑（消除原 README §三「已知保真缺口①」）。
#
# 前置（夹具库）：`backend/.env` 指向本机夹具 MySQL（`127.0.0.1:3409`）；`run-migration.mjs` 需要 mysql2。
# 用法（仓库根执行）：
#   bash docs/evidence/S3-234/harness/run-deploy-migration-section.sh [仓库根] [标签]
# **装置退出码 = 组合退出码**（0 = 无新失败；1 = 存在新失败 ⇒ 部署判红）：供上层脚本 `/S3-234-返工` 串联判读。
set -euo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
TAG="${2:-run}"
SCRIPT="${REPO_ROOT}/deploy/auto-deploy.sh"
export PROJECT_DIR="${REPO_ROOT}"
# 交互式下也让判红生效：证据装置要拿到**确定性**的退出码（真实部署里非交互同样判红）
export DEPLOY_STRICT=1

# `AI_FAILURES` / `SMOKE_FAILURES` / `MIGRATION_FAILURES` 三个数组在 auto-deploy.sh 顶部声明（标记段之外），
# 此处按同一约定预置，保证抽取出来的两段可独立执行。
AI_FAILURES=()
SMOKE_FAILURES=()
MIGRATION_FAILURES=()

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT
MIG_BLOCK="${WORK}/migration-section.sh"
SUM_BLOCK="${WORK}/failures-section.sh"
RUNNER="${WORK}/deploy-chain-${TAG}.sh"

sed -n '/S3-234 迁移段开始/,/S3-234 迁移段结束/p' "${SCRIPT}" > "${MIG_BLOCK}"
sed -n '/S3-234 失败汇总段开始/,/S3-234 失败汇总段结束/p' "${SCRIPT}" > "${SUM_BLOCK}"

{
  echo 'set -euo pipefail'
  echo 'AI_FAILURES=()'
  echo 'SMOKE_FAILURES=()'
  echo 'MIGRATION_FAILURES=()'
  cat "${MIG_BLOCK}"
  cat "${SUM_BLOCK}"
} > "${RUNNER}"

echo "== [$TAG] 源文件：${SCRIPT}（总 $(wc -l < "${SCRIPT}") 行）"
echo "== [$TAG] 抽取：迁移段 $(wc -l < "${MIG_BLOCK}") 行（首行 $(head -n 1 "${MIG_BLOCK}")）"
echo "== [$TAG] 抽取：失败汇总段 $(wc -l < "${SUM_BLOCK}") 行（首行 $(head -n 1 "${SUM_BLOCK}")）"
echo "== [$TAG] bash -n 语法检查（两段串成的一个脚本）："
bash -n "${RUNNER}"
echo "   OK（退出码 0）"
echo "== [$TAG] 执行（cwd=${REPO_ROOT}，DEPLOY_STRICT=1 ⇒ 有失败项时以非零退出码结束）"
cd "${REPO_ROOT}"
set +e
bash "${RUNNER}"
RC=$?
set -e
echo "== [$TAG] **组合退出码（迁移段 + 失败汇总段）= ${RC}**（0 = 无新失败；1 = 存在新失败 ⇒ 部署判红）"
echo "== [$TAG] 判读口径：迁移段小结行里「新失败 0」+ 组合退出码 0 ⇒ 该清单在本夹具上跑通、且未判红。"
exit "${RC}"
