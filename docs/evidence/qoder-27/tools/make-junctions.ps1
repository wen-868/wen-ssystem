$ErrorActionPreference = 'Stop'
$pairs = @(
  @{ Link = 'D:\Users\ZXQL\wt-agents\QODER-27\node_modules';        Target = 'D:\Users\ZXQL\wt-agents\QODER-23\node_modules' },
  @{ Link = 'D:\Users\ZXQL\wt-agents\QODER-27\app-mobile\node_modules'; Target = 'D:\Users\ZXQL\wt-agents\QODER-23\app-mobile\node_modules' }
)
foreach ($p in $pairs) {
  if (Test-Path $p.Link) {
    Write-Output ("ALREADY_EXISTS " + $p.Link)
  } else {
    New-Item -ItemType Junction -Path $p.Link -Target $p.Target | Out-Null
    Write-Output ("CREATED " + $p.Link)
  }
  $i = Get-Item $p.Link
  Write-Output ("  LinkType=" + $i.LinkType + " Target=" + ($i.Target -join ',') + " Entries=" + ((Get-ChildItem $p.Link | Measure-Object).Count))
}
foreach ($probe in @('vitest','eslint','vue-tsc','typescript','@dcloudio')) {
  $e = Test-Path ("D:\Users\ZXQL\wt-agents\QODER-27\node_modules\" + $probe)
  Write-Output ("PROBE QODER-27/node_modules/" + $probe + " = " + $e)
}
