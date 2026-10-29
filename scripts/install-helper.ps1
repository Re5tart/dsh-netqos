# 一键安装限速助手（需要管理员）
#  1. 以管理员身份运行 PowerShell
#  2. cd 到插件目录，执行：  powershell -ExecutionPolicy Bypass -File .\scripts\install-helper.ps1
# 它会注册开机自启的计划任务（SYSTEM 权限）并立刻启动。

$ErrorActionPreference = 'Stop'
$taskName = 'DSH NetQoS Helper'
$pkg = Split-Path -Parent $PSScriptRoot
$helper = Join-Path $pkg 'helper.ps1'
if (-not (Test-Path $helper)) { throw "找不到 helper.ps1：$helper" }

$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$action = '"' + $ps + '" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $helper + '"'

schtasks /create /tn $taskName /tr $action /sc onstart /ru SYSTEM /rl HIGHEST /f | Out-Null
if ($LASTEXITCODE -ne 0) { throw "创建计划任务失败（退出码 $LASTEXITCODE），请确认是用管理员身份运行的。" }
schtasks /end /tn $taskName 2>$null | Out-Null
schtasks /run /tn $taskName | Out-Null

$root = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$dir = Join-Path $root 'netqos'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$cfg = Join-Path $dir 'config.json'
if (-not (Test-Path $cfg)) {
  $default = [ordered]@{
    rateKBps = 128
    targets  = @('Coopanion.exe', 'SnowLuma.exe', 'DeepSeek Harness.exe')
    apps     = @()
  }
  $default | ConvertTo-Json -Depth 5 | Set-Content -Path $cfg -Encoding UTF8
}

Write-Host "已安装：$taskName" -ForegroundColor Green
Write-Host "配置文件：$cfg"
Write-Host "重启 DSH 后，在「设置 → 网速守卫」里加触发软件即可。"
