# S3-106 静态检查取证脚本（凌舟可原样复跑）
# 用法：pwsh -File docs/evidence/S3-106/tools/s3-106-checks.ps1
# 产出：docs/evidence/S3-106/outputs/02-tsc-project.txt / 03-tsc-testfile.txt / 04-eslint.txt /
#       05-vitest-blocked.txt / 06-worktree-status.txt
$ErrorActionPreference = "Continue"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
$out = Join-Path $repo "docs\evidence\S3-106\outputs"
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

Save-Check "命令：cd backend; npx tsc -p tsconfig.json --noEmit（本单验收标准①）" `
    (Join-Path $repo "backend") "02-tsc-project.txt" {
    npx tsc -p tsconfig.json --noEmit
}

Save-Check "命令：cd backend; node node_modules/typescript/bin/tsc --noEmit --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --types vitest/globals,node src/__tests__/shared/migration-drop-guard.test.ts（tsconfig 排除 src/__tests__/**，故单跑）" `
    (Join-Path $repo "backend") "03-tsc-testfile.txt" {
    node node_modules/typescript/bin/tsc --noEmit --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --types vitest/globals,node src/__tests__/shared/migration-drop-guard.test.ts
}

Save-Check "命令：cd backend; npx eslint src/shared/migration.ts src/__tests__/shared/migration-drop-guard.test.ts（本单验收标准①）" `
    (Join-Path $repo "backend") "04-eslint.txt" {
    npx eslint src/shared/migration.ts src/__tests__/shared/migration-drop-guard.test.ts
}

Save-Check "命令：cd backend; npx vitest run src/__tests__/shared/migration-drop-guard.test.ts（本沙箱预期失败：esbuild spawn EPERM，见踩坑[118]）" `
    (Join-Path $repo "backend") "05-vitest-blocked.txt" {
    npx vitest run src/__tests__/shared/migration-drop-guard.test.ts
}

Save-Check "命令：git rev-parse --abbrev-ref HEAD; git rev-parse --short HEAD; git status --porcelain（只读）" `
    $repo "06-worktree-status.txt" {
    git rev-parse --abbrev-ref HEAD
    git rev-parse --short HEAD
    git status --porcelain
}
