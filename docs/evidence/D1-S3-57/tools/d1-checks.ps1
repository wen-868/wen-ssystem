# S3-57 静态检查与门禁取证脚本（凌舟可原样复跑）
# 用法：pwsh -NoProfile -File docs/evidence/D1-S3-57/tools/d1-checks.ps1
# 产出：docs/evidence/D1-S3-57/outputs/02-tsc-project.txt / 03-eslint.txt / 04-vitest-blocked.txt / 05-worktree-status.txt
$ErrorActionPreference = "Continue"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
$out = Join-Path $repo "docs\evidence\D1-S3-57\outputs"
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Save-Check {
    param([string]$Title, [string]$WorkDir, [string]$File, [scriptblock]$Run)
    $target = Join-Path $out $File
    "== $Title" | Out-File -FilePath $target -Encoding utf8
    Push-Location $WorkDir
    try {
        $result = & $Run 2>&1
        ($result | Out-String).TrimEnd() | Out-File -FilePath $target -Append -Encoding utf8
        "EXIT=$LASTEXITCODE" | Out-File -FilePath $target -Append -Encoding utf8
    } finally {
        Pop-Location
    }
    Get-Content -Path $target -Raw
}

Save-Check "命令：cd backend; npx tsc --noEmit（派单卡门禁，覆盖 src/**，含本轮改动的 migration.ts 与新测试文件）" `
    (Join-Path $repo "backend") "02-tsc-project.txt" {
    npx tsc --noEmit
}

Save-Check "命令：cd backend; npx eslint src/shared/migration.ts src/__tests__/shared/migration-delimiter.test.ts src/__tests__/shared/migration.test.ts" `
    (Join-Path $repo "backend") "03-eslint.txt" {
    npx eslint src/shared/migration.ts src/__tests__/shared/migration-delimiter.test.ts src/__tests__/shared/migration.test.ts
}

Save-Check "命令：cd backend; npx vitest run（派单卡门禁：全量；本沙箱预期失败：esbuild spawn EPERM，见 docs/evidence/MIG-5b/outputs/04-vitest-blocked.txt）" `
    (Join-Path $repo "backend") "04-vitest-blocked.txt" {
    npx vitest run
}

Save-Check "命令：cd backend; npx vitest run src/__tests__/shared/migration-delimiter.test.ts（单文件，证明不是文件特有的问题）" `
    (Join-Path $repo "backend") "04b-vitest-single-blocked.txt" {
    npx vitest run src/__tests__/shared/migration-delimiter.test.ts
}

$target = Join-Path $out "05-worktree-status.txt"
"== 分支 / HEAD / 工作区状态 / 关键文件 SHA256" | Out-File -FilePath $target -Encoding utf8
Push-Location $repo
try {
    (git rev-parse --abbrev-ref HEAD 2>&1) | Out-File -FilePath $target -Append -Encoding utf8
    (git log --oneline -1 2>&1) | Out-File -FilePath $target -Append -Encoding utf8
    (git status --porcelain 2>&1) | Out-File -FilePath $target -Append -Encoding utf8
    foreach ($f in @(
        "backend/src/shared/migration.ts",
        "backend/src/__tests__/shared/migration-delimiter.test.ts",
        "backend/src/__tests__/shared/migration.test.ts"
    )) {
        $hash = (Get-FileHash -Algorithm SHA256 (Join-Path $repo $f)).Hash
        "$hash  $f" | Out-File -FilePath $target -Append -Encoding utf8
    }
    (git diff --numstat -- backend/src/shared/migration.ts backend/src/__tests__/shared/migration.test.ts 2>&1) | Out-File -FilePath $target -Append -Encoding utf8
} finally {
    Pop-Location
}
Get-Content -Path $target -Raw
