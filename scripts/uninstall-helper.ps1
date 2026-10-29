# 卸载限速助手（需要管理员）：停任务、删任务、清掉所有 QoS 策略
$ErrorActionPreference = 'Continue'
$taskName = 'DSH NetQoS Helper'

schtasks /end /tn $taskName 2>$null | Out-Null
schtasks /delete /tn $taskName /f 2>$null | Out-Null

Get-NetQosPolicy -PolicyStore ActiveStore -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like '*netqos*' } |
  Remove-NetQosPolicy -PolicyStore ActiveStore -Confirm:$false -ErrorAction SilentlyContinue

Write-Host '已卸载计划任务并清除 QoS 策略。' -ForegroundColor Green
Write-Host '插件本身可以在 DSH 里用 dsh plugin remove dsh-netqos 卸掉。'
