param([string]$Mode = "fresh", [string]$DbName = "s3149_fresh")
$dst = Join-Path $env:TEMP "s3149-scratch"
$env:S3144_SCRATCH = $dst
$env:S3144_MODE = $Mode
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3403"
$env:DB_USER = "root"
$env:DB_PASSWORD = ""
$env:DB_NAME = $DbName
$env:JWT_SECRET = "s3149-local-secret"
$env:NODE_ENV = "production"
Set-Location $dst
node "$dst\docs\evidence\S3-144\tools\s3144-e2e.mjs"
Write-Output ("DEVICE_EXIT=" + $LASTEXITCODE)
