# DSH NetQoS Helper（需要管理员）——按触发软件给 Coopanion / SnowLuma / DSH 限速，或几乎断开。
# 配置与状态都在 $env:DSH_HOME\netqos（默认 %USERPROFILE%\.dsh\netqos）。
# 只写 ASCII 状态（idle / throttled <exe> <action>），中文由插件负责翻译。
$ErrorActionPreference = 'SilentlyContinue'
$root = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$dir = Join-Path $root 'netqos'
$cfgFile = Join-Path $dir 'config.json'
$stateFile = Join-Path $dir 'state.txt'
$logFile = Join-Path $dir 'helper.log'
$policyName = 'DSH NetQoS Throttle'

New-Item -ItemType Directory -Force -Path $dir | Out-Null

function Log($m) {
  Add-Content -Path $logFile -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) -Encoding UTF8
  if ((Get-Item $logFile -ErrorAction SilentlyContinue).Length -gt 512KB) { Move-Item $logFile "$logFile.1" -Force }
}

function Get-Cfg {
  try { return (Get-Content $cfgFile -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}

function MatchingApp($cfg) {
  foreach ($a in $cfg.apps) {
    $name = ($a.exe -replace '\.exe$', '')
    if (Get-Process -Name $name -ErrorAction SilentlyContinue) { return $a }
  }
  return $null
}

function RunningTargets($cfg) {
  $out = @()
  foreach ($t in $cfg.targets) {
    $name = ($t -replace '\.exe$', '')
    $p = Get-Process -Name $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($p -and $p.Path) { $out += [pscustomobject]@{ name = $t; path = $p.Path } }
  }
  return $out
}

function Clear-Policy {
  Get-NetQosPolicy -PolicyStore ActiveStore -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*netqos*" } |
    Remove-NetQosPolicy -PolicyStore ActiveStore -Confirm:$false -ErrorAction SilentlyContinue
}

function Apply-Policy($cfg, $app, $targets) {
  Clear-Policy
  $bits = if ($app.action -eq 'pause') { 8000 } else { [int]$cfg.rateKBps * 8 * 1024 }
  foreach ($t in $targets) {
    try {
      New-NetQosPolicy -Name "$policyName $($t.name)" -AppPathNameMatchCondition $t.path `
        -ThrottleRateActionBitsPerSecond ([uint64]$bits) -PolicyStore ActiveStore -ErrorAction Stop | Out-Null
      Log ("policy ok: " + $t.path + " @ " + $bits)
    } catch {
      Log ("policy FAIL: " + $t.name + " -> " + $_.Exception.Message)
    }
  }
  Log ("apply {0} [{1}] {2} kbit/s -> {3}" -f $app.exe, $app.action, [math]::Round($bits / 1024), (($targets | ForEach-Object { $_.name }) -join ','))
}

Log 'helper started'
$lastKey = ''
while ($true) {
  $cfg = Get-Cfg
  if ($cfg) {
    $app = MatchingApp $cfg
    $targets = RunningTargets $cfg
    $key = if ($app) { "$($app.exe)|$($app.action)|$($cfg.rateKBps)|" + (($targets | ForEach-Object { $_.name }) -join ',') } else { 'idle' }
    if ($key -ne $lastKey) {
      if ($app) {
        Apply-Policy $cfg $app $targets
        Set-Content -Path $stateFile -Value ("throttled " + $app.exe + " " + $app.action) -Encoding ASCII
      } else {
        Clear-Policy
        Set-Content -Path $stateFile -Value 'idle' -Encoding ASCII
      }
      $lastKey = $key
    }
  }
  Start-Sleep -Seconds 5
}
