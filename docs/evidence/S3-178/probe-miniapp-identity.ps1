# S3-178 取证脚本（可在改前/改后各跑一次，输出逐条对比）
# 用法：powershell -File probe-miniapp-identity.ps1 -Base http://127.0.0.1:8098 -Label 改前
param(
  [string]$Base = "http://127.0.0.1:8098",
  [string]$Label = "baseline"
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

function Write-Line([string]$text) { Write-Output $text }

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Path,
    [hashtable]$Headers = @{},
    [string]$Body = $null
  )
  # 统一走 curl.exe：状态码与响应体都能取到（PowerShell 5.1 读非 2xx 响应体会丢内容）
  $curlArgs = @("-s", "-S", "-X", $Method, "$Base$Path", "-w", "`n<%{http_code}>", "-o", "-")
  foreach ($k in $Headers.Keys) { $curlArgs += @("-H", ("{0}: {1}" -f $k, $Headers[$k])) }
  if ($Body) { $curlArgs += @("-H", "Content-Type: application/json", "--data-raw", $Body) }
  $raw = & curl.exe @curlArgs 2>&1
  $lines = @($raw)
  $codeLine = $lines[$lines.Count - 1]
  $bodyText = ($lines[0..($lines.Count - 2)] -join " ")
  if ($bodyText.Length -gt 400) { $bodyText = $bodyText.Substring(0, 400) + "...(truncated)" }
  Write-Line ("[{0}] {1} {2} => HTTP {3} | {4}" -f $Name, $Method, $Path, $codeLine, $bodyText)
}

Write-Line "===== S3-178 取证：$Label （$Base） ====="

# 1) 取商家 A 的登录凭证（mock 后端 demo-login：A = admin，id=1）
$loginRaw = & curl.exe -s -S -X POST "$Base/api/admin/auth/demo-login" -H "Content-Type: application/json" --data-raw '{}'
$loginJson = ($loginRaw -join "") | ConvertFrom-Json
$tokenA = $loginJson.data.token
$csrfA = $loginJson.data.csrfToken
Write-Line ("[A0] demo-login => code={0} user={1} id={2} tokenA.len={3} csrfA.len={4}" -f $loginJson.code, $loginJson.data.user.username, $loginJson.data.user.id, ([string]$tokenA).Length, ([string]$csrfA).Length)
if (-not $tokenA) { Write-Line "[A0] 登录失败，终止"; exit 1 }

$authA = @{ Authorization = "Bearer $tokenA" }
$authACsrf = @{ Authorization = "Bearer $tokenA"; "x-csrf-token" = "$csrfA" }

# 2) #1 marketing-miniapp：身份来自客户端字段的越权反例
#    反例口径：凭证只属于 A(id=1)，body 里声明 userId=4242（B）——若服务层按 B 落库即为越权。
#    注：PowerShell 5.1 传给原生 exe 的参数会吃掉裸双引号，故 JSON 里的引号一律写成 \"
Invoke-Probe -Name "A1-无凭证+body.userId=B" -Method POST -Path "/api/miniapp/marketing/coupons/claim" -Body '{\"templateId\":1,\"userId\":4242}'
Invoke-Probe -Name "A2-A的凭证+body.userId=B+CSRF" -Method POST -Path "/api/miniapp/marketing/coupons/claim" -Headers $authACsrf -Body '{\"templateId\":1,\"userId\":4242}'
Invoke-Probe -Name "A3-A的凭证+body.userId=B(无CSRF头)" -Method POST -Path "/api/miniapp/marketing/coupons/claim" -Headers $authA -Body '{\"templateId\":1,\"userId\":4242}'
Invoke-Probe -Name "A4-A的凭证+body.userId=A+CSRF" -Method POST -Path "/api/miniapp/marketing/coupons/claim" -Headers $authACsrf -Body '{\"templateId\":1,\"userId\":1}'
Invoke-Probe -Name "A5-A的凭证+body.userId=登录态id(动态)" -Method POST -Path "/api/miniapp/marketing/coupons/claim" -Headers $authACsrf -Body ('{\"templateId\":1,\"userId\":' + $loginJson.data.user.id + '}')
Invoke-Probe -Name "A6-A的凭证+不传userId" -Method POST -Path "/api/miniapp/marketing/coupons/claim" -Headers $authACsrf -Body '{\"templateId\":1}'
Invoke-Probe -Name "B1-A的凭证+body.userId=B(秒杀)" -Method POST -Path "/api/miniapp/marketing/flash-sales/grab" -Headers $authACsrf -Body '{\"userId\":4242,\"quantity\":1}'
Invoke-Probe -Name "B2-A的凭证+body.userId=B(拼团)" -Method POST -Path "/api/miniapp/marketing/group-buys/teams/join" -Headers $authACsrf -Body '{\"userId\":4242,\"quantity\":1}'
Invoke-Probe -Name "C1-query.userId=B 读B的券" -Method GET -Path "/api/miniapp/marketing/coupons/my?userId=4242"
Invoke-Probe -Name "C2-query.userId=B 读B的积分" -Method GET -Path "/api/miniapp/marketing/points/my-records?userId=4242"
Invoke-Probe -Name "D1-公开浏览面(应保持公开)" -Method GET -Path "/api/miniapp/marketing/coupons/available"

# 3) #2 instant-retail-store：CSRF 两侧
Invoke-Probe -Name "E1-无CSRF头" -Method POST -Path "/api/store/instant-retail/orders/PLAT-178/confirm" -Headers $authA -Body '{}'
Invoke-Probe -Name "E2-带CSRF头" -Method POST -Path "/api/store/instant-retail/orders/PLAT-178/confirm" -Headers $authACsrf -Body '{}'
Invoke-Probe -Name "E3-GET(安全方法)" -Method GET -Path "/api/store/instant-retail/orders" -Headers $authA
Invoke-Probe -Name "E4-不存在的路径(证明是前缀级前置中间件,而非路径级)" -Method POST -Path "/api/store/instant-retail/orders/PLAT-178/not-a-route" -Headers $authA -Body '{}'

Write-Line "===== 取证结束：$Label ====="
