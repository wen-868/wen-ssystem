#!/usr/bin/env bash
# S3-234 证据装置（**R1 返工**）：部署迁移段的**「新失败阻断 / 已知不判红」反测**（两侧都要证）。
#
# 抽取与线上**同一份真源码**（迁移段 + 失败汇总段，同 s3241 装置口径），夹具用工作树内的 scratch 树，
# **不碰**仓库里的真清单与真登记册（真件 SHA256 前后比对见用例 E）。
#
# 用例（每个用例都断言"该红的红、该绿的绿"，断言失败 ⇒ 本装置退出码非 0）：
#   A **新失败必红**：夹具清单里放一个**不在登记册**、且必然失败的文件（`008_phase6_schema.sql`：
#     引用无前缀表名 `sys_role`）⇒ 逐条点名 + 段小结「新失败 1」+ 汇总段判红 + **组合退出码 1**；
#   B **登记在案的失败不判红**：同一失败文件**写进夹具登记册** ⇒ 打印「⏭️ 已知非幂等（登记在案）」+
#     段小结「新失败 0 / 已知 1」+ 汇总段**不判红** + **组合退出码 0**；
#     （真实清单里 B 类**不在**活动段，本用例故意放进去，只为覆盖这条分支——分支不覆盖就等于没有它）
#   C **清单缺失必红**（fail-closed）：删掉夹具清单 ⇒ 组合退出码 1；
#   D **登记册缺失必红**（fail-closed）：删掉夹具登记册 ⇒ 组合退出码 1（无法区分已知/新失败时不许猜"没事"）；
#   E **真件未被污染**：仓库里 `deploy/migrations-manifest.txt` 与
#     `deploy/migrations-nonidempotent-registry.txt` 的 SHA256 与开工前一致（全程只动 scratch 副本）。
#
# 用法（仓库根执行）：bash docs/evidence/S3-234/harness/run-deploy-section-blocking-redtest.sh [仓库根]
set -uo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
SCRIPT="${REPO_ROOT}/deploy/auto-deploy.sh"
REAL_MANIFEST="${REPO_ROOT}/deploy/migrations-manifest.txt"
REAL_REGISTRY="${REPO_ROOT}/deploy/migrations-nonidempotent-registry.txt"
# scratch 放在工作树内：这样 `run-migration.mjs` 的 ESM 依赖解析能沿目录往上找到工作树的 node_modules
SCRATCH="${REPO_ROOT}/.tmp-s3243-blocking-redtest"
rm -rf "${SCRATCH}"
mkdir -p "${SCRATCH}/deploy" "${SCRATCH}/backend" "${SCRATCH}/docs/migrations" "${SCRATCH}/scripts"
trap 'rm -rf "${SCRATCH}"' EXIT

SHA_BEFORE_MANIFEST="$(cd "${REPO_ROOT}" && sha256sum deploy/migrations-manifest.txt | awk '{print $1}')"
SHA_BEFORE_REGISTRY="$(cd "${REPO_ROOT}" && sha256sum deploy/migrations-nonidempotent-registry.txt | awk '{print $1}')"
echo "== 真件 SHA256（开工前）：清单 ${SHA_BEFORE_MANIFEST}｜登记册 ${SHA_BEFORE_REGISTRY}"

# 夹具：本机夹具库连接（无口令明文，已 gitignore）+ 迁移执行器原件 + 两个真实迁移文件
cp "${REPO_ROOT}/backend/.env" "${SCRATCH}/backend/.env"
cp "${REPO_ROOT}/scripts/run-migration.mjs" "${SCRATCH}/scripts/run-migration.mjs"
cp "${REPO_ROOT}/docs/migrations/069_商品SPU增加品牌ID.sql" "${SCRATCH}/docs/migrations/"
cp "${REPO_ROOT}/docs/migrations/008_phase6_schema.sql" "${SCRATCH}/docs/migrations/"
echo "== 夹具：${SCRATCH}（backend/.env + scripts/run-migration.mjs + 069/008 两个真迁移）"

sed -n '/S3-234 迁移段开始/,/S3-234 迁移段结束/p' "${SCRIPT}" > "${SCRATCH}/migration-section.sh"
sed -n '/S3-234 失败汇总段开始/,/S3-234 失败汇总段结束/p' "${SCRIPT}" > "${SCRATCH}/failures-section.sh"
{
  echo 'set -euo pipefail'
  echo 'AI_FAILURES=()'
  echo 'SMOKE_FAILURES=()'
  echo 'MIGRATION_FAILURES=()'
  cat "${SCRATCH}/migration-section.sh"
  cat "${SCRATCH}/failures-section.sh"
} > "${SCRATCH}/runner.sh"
echo "== 源文件 ${SCRIPT}（$(wc -l < "${SCRIPT}") 行）⇒ 迁移段 $(wc -l < "${SCRATCH}/migration-section.sh") 行 + 失败汇总段 $(wc -l < "${SCRATCH}/failures-section.sh") 行"
bash -n "${SCRATCH}/runner.sh" && echo "== bash -n（两段串成的一个脚本）：OK"

FAILED=0
check() { # check <用例> <断言描述> <结果 0/1>
  if [ "$3" = "0" ]; then
    echo "   ✅ [$1] $2"
  else
    echo "   ❌ [$1] $2（断言失败）"
    FAILED=$((FAILED + 1))
  fi
}
contains() { case "$1" in *"$2"*) return 0 ;; *) return 1 ;; esac; }

run_case() { # run_case <标签> <期望退出码>
  local label="$1" expect_rc="$2"
  echo ""
  echo "---- [$label] 夹具清单："
  sed -e 's/^/     /' "${SCRATCH}/deploy/migrations-manifest.txt" 2>/dev/null || echo "     (清单不存在)"
  echo "---- [$label] 夹具登记册："
  sed -e 's/^/     /' "${SCRATCH}/deploy/migrations-nonidempotent-registry.txt" 2>/dev/null || echo "     (登记册不存在)"
  echo "---- [$label] 执行输出 ----"
  (
    cd "${SCRATCH}"
    PROJECT_DIR="${SCRATCH}" DEPLOY_STRICT=1 bash "${SCRATCH}/runner.sh"
  ) > "${SCRATCH}/${label}.out" 2>&1
  local rc=$?
  sed -e 's/^/   /' "${SCRATCH}/${label}.out"
  echo "---- [$label] 组合退出码=${rc}（期望 ${expect_rc}）"
  OUT="$(cat "${SCRATCH}/${label}.out")"
  RC="${rc}"
}

# ── 用例 A：新失败必红（008 不在登记册；登记册里放 075/201 两个"别的东西"）
cat > "${SCRATCH}/deploy/migrations-manifest.txt" <<'EOF'
# 反测夹具清单（S3-234 装置专用，**不进仓**）
069_商品SPU增加品牌ID.sql
008_phase6_schema.sql
EOF
cat > "${SCRATCH}/deploy/migrations-nonidempotent-registry.txt" <<'EOF'
# 反测夹具登记册（不含 008 ⇒ 008 属"新失败"）
075_reset_admin_password_bcrypt.sql | 口令类种子 | 夹具占位 | 夹具
201_账号口径统一.sql | NON_IDEMPOTENT_WRITE | 夹具占位 | 夹具
EOF
run_case "A-新失败必红" 1
check A "组合退出码 = 1（新失败 ⇒ 判红）" "$([ "${RC}" = "1" ] && echo 0 || echo 1)"
check A "逐条点名到文件：❌ [迁移] 008_phase6_schema.sql 执行失败" "$(contains "${OUT}" '❌ [迁移] 008_phase6_schema.sql 执行失败' && echo 0 || echo 1)"
check A "段小结「新失败 1 个」" "$(contains "${OUT}" '新失败** 1 个' && echo 0 || echo 1)"
check A "汇总段判红（❌ 部署结束，但存在失败项）" "$(contains "${OUT}" '❌ 部署结束，但存在失败项' && echo 0 || echo 1)"
check A "未误判为「已知非幂等」" "$(contains "${OUT}" '已知非幂等（登记在案）：' && echo 1 || echo 0)"

# ── 用例 B：登记在案的失败不判红（008 写进登记册）
cat > "${SCRATCH}/deploy/migrations-manifest.txt" <<'EOF'
# 反测夹具清单（S3-234 装置专用，**不进仓**）
069_商品SPU增加品牌ID.sql
008_phase6_schema.sql
EOF
cat > "${SCRATCH}/deploy/migrations-nonidempotent-registry.txt" <<'EOF'
# 反测夹具登记册（008 在册 ⇒ 属"已知非幂等"）
008_phase6_schema.sql | ER_NO_SUCH_TABLE：Table 'sys_role' doesn't exist | 引用无前缀表名 | 夹具
EOF
run_case "B-登记在案不判红" 0
check B "组合退出码 = 0（已知失败 ⇒ 放行但打印）" "$([ "${RC}" = "0" ] && echo 0 || echo 1)"
check B "打印「⏭️ 已知非幂等（登记在案）：008_phase6_schema.sql」" "$(contains "${OUT}" '已知非幂等（登记在案）：008_phase6_schema.sql' && echo 0 || echo 1)"
check B "段小结「新失败** 0 个」" "$(contains "${OUT}" '新失败** 0 个' && echo 0 || echo 1)"
check B "段小结「已知非幂等（登记在案）1 个」" "$(contains "${OUT}" '已知非幂等（登记在案）1 个' && echo 0 || echo 1)"
check B "汇总段未判红（无「❌ 部署结束，但存在失败项」）" "$(contains "${OUT}" '❌ 部署结束，但存在失败项' && echo 1 || echo 0)"

# ── 用例 C：清单缺失 ⇒ 判红（fail-closed）
rm -f "${SCRATCH}/deploy/migrations-manifest.txt"
run_case "C-清单缺失必红" 1
check C "组合退出码 = 1" "$([ "${RC}" = "1" ] && echo 0 || echo 1)"
check C "点名「清单缺失」" "$(contains "${OUT}" '清单缺失' && echo 0 || echo 1)"

# ── 用例 D：登记册缺失 ⇒ 判红（fail-closed：不许猜"没事"）
cat > "${SCRATCH}/deploy/migrations-manifest.txt" <<'EOF'
# 反测夹具清单（S3-234 装置专用，**不进仓**）
069_商品SPU增加品牌ID.sql
008_phase6_schema.sql
EOF
rm -f "${SCRATCH}/deploy/migrations-nonidempotent-registry.txt"
run_case "D-登记册缺失必红" 1
check D "组合退出码 = 1" "$([ "${RC}" = "1" ] && echo 0 || echo 1)"
check D "点名「非幂等登记册缺失」" "$(contains "${OUT}" '非幂等登记册缺失' && echo 0 || echo 1)"
check D "段小结「新失败** 1 个」（008 无从判为已知）" "$(contains "${OUT}" '新失败** 1 个' && echo 0 || echo 1)"

# ── 用例 E：真件未被污染（全程只动 scratch 副本）
SHA_AFTER_MANIFEST="$(cd "${REPO_ROOT}" && sha256sum deploy/migrations-manifest.txt | awk '{print $1}')"
SHA_AFTER_REGISTRY="$(cd "${REPO_ROOT}" && sha256sum deploy/migrations-nonidempotent-registry.txt | awk '{print $1}')"
echo ""
echo "---- [E-真件未污染] 真件 SHA256（完工后）：清单 ${SHA_AFTER_MANIFEST}｜登记册 ${SHA_AFTER_REGISTRY}"
check E "真清单 SHA256 与开工前一致" "$([ "${SHA_AFTER_MANIFEST}" = "${SHA_BEFORE_MANIFEST}" ] && echo 0 || echo 1)"
check E "真登记册 SHA256 与开工前一致" "$([ "${SHA_AFTER_REGISTRY}" = "${SHA_BEFORE_REGISTRY}" ] && echo 0 || echo 1)"

echo ""
if [ "${FAILED}" = "0" ]; then
  echo "== 反测结论：**全部断言通过**（A 新失败必红 / B 已知不判红 / C 清单缺失必红 / D 登记册缺失必红 / E 真件未污染）"
  exit 0
fi
echo "== 反测结论：**${FAILED} 条断言失败**（见上方 ❌）" >&2
exit 1
