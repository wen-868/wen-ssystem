param([Parameter(Mandatory = $true)][string]$PidFile)
$procId = (Get-Content -Path $PidFile -Raw).Trim()
if ($procId) {
  Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
  Write-Output "stopped pid=$procId"
}
