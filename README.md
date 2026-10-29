# dsh-netqos

给 DSH 用的「网速守卫」：**你在打游戏（或跑任何指定的软件）时，自动把 Coopanion / SnowLuma / DSH 自己的带宽压下去；一关掉就自动放开。**

用的是 Windows 原生的按进程限速（QoS），不是代理、不改路由、不装驱动。

## 它解决什么

桌宠、QQ 桥、B 站拉取这些东西平时不占带宽，但群里的图和短视频是「瞬时几十兆」的尖峰——正好卡在你游戏里最要紧的那几秒。

这个插件让你提前定好：**哪些软件在跑的时候，让谁让路，让多少。**

## 安装（三步）

> 需要：Windows 10/11、DSH Desktop、管理员权限（只有第 3 步要）。

### 1. 放到插件目录

下载源码后解压到任意位置，例如 `C:\Users\你\.dsh\plugins\dsh-netqos`。

### 2. 装进 DSH

```powershell
dsh plugin --profile desktop add "link:C:\Users\你\.dsh\plugins\dsh-netqos"
```

### 3. 装限速助手（管理员）

**以管理员身份**打开 PowerShell，cd 到插件目录，执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-helper.ps1
```

它会注册一个开机自启的计划任务（SYSTEM 权限）并立即启动。

### 4. 重启 DSH

打开「设置 → 网速守卫」，加一条触发软件（例如 `cod.exe`），选「限速」或「几乎断开」，保存。

## 怎么用

| 字段 | 意思 |
| --- | --- |
| 触发软件 | 你运行它的时候才限速。比如 `cod.exe`、`cs2.exe`、`obs64.exe` |
| 限速值 | 选「限速」时每个目标进程的上限，默认 128 KB/s |
| 被限的对象 | 默认 `Coopanion.exe`、`SnowLuma.exe`、`DeepSeek Harness.exe`，写在 `config.json` 里可改 |
| 几乎断开 | 把上限压到 8 kbit/s，等于让路；QQ 文字消息还能过，图片视频基本下不动 |

配置与状态在 `%USERPROFILE%\.dsh\netqos\`：

- `config.json` — 触发软件、限速值、目标进程
- `state.txt` — `idle` 或 `throttled <exe> <action>`（插件负责显示成中文）
- `helper.log` — 助手日志，每条策略建没建起来都写在这

## 卸载

```powershell
# 管理员
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-helper.ps1

# 插件本身
dsh plugin --profile desktop remove dsh-netqos
```

## 已知局限

- 限速粒度是**整个进程**：限 Coopanion 时，它的 QQ 文字消息也会一起被压（128 KB/s 够用；「几乎断开」会掉线）。
- 助手每 5 秒轮询一次，切到游戏→限速最多延迟 5 秒。
- 按 exe 名匹配：同名不同路径的程序会一起算。
- 只在 Windows 上有效（用的是 `New-NetQosPolicy`）。

## 原理

`helper.ps1` 每 5 秒读一次 `config.json`：白名单里有进程在跑，就给每个「在跑的目标进程」建一条

```
New-NetQosPolicy -Name "DSH NetQoS Throttle <exe>" -AppPathNameMatchCondition <完整路径> \
  -ThrottleRateActionBitsPerSecond <bits> -PolicyStore ActiveStore
```

触发软件退出后把这些策略全部删掉。插件那半边只负责读写配置和显示状态，不碰网络。

## License

MIT
