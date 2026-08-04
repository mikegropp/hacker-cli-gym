# Command curricula

Each native track contains ten sections of ten practical reps. Reps 001–030
are foundation, 031–070 are intermediate, and 071–100 are advanced.

## 100 Linux commands

| Reps | Section | Commands |
|---:|---|---|
| 001–010 | Navigation and help | `pwd`, `ls`, `cd`, `basename`, `dirname`, `realpath`, `which`, `whereis`, `type`, `man` |
| 011–020 | Files and directories | `mkdir`, `rmdir`, `touch`, `cp`, `mv`, `rm`, `ln`, `readlink`, `file`, `stat` |
| 021–030 | Reading content | `cat`, `less`, `head`, `tail`, `nl`, `tac`, `strings`, `od`, `xxd`, `wc` |
| 031–040 | Text processing | `cut`, `paste`, `grep`, `sed`, `awk`, `tr`, `sort`, `uniq`, `column`, `fmt` |
| 041–050 | Composition and comparison | `echo`, `printf`, `tee`, `xargs`, `diff`, `cmp`, `comm`, `join`, `split`, `csplit` |
| 051–060 | Identity and permissions | `chmod`, `chown`, `chgrp`, `umask`, `id`, `whoami`, `groups`, `getent`, `users`, `who` |
| 061–070 | Processes and execution | `ps`, `top`, `pgrep`, `kill`, `nohup`, `nice`, `timeout`, `sleep`, `time`, `seq` |
| 071–080 | System and storage | `uname`, `hostname`, `uptime`, `date`, `cal`, `env`, `printenv`, `df`, `du`, `free` |
| 081–090 | Archives and integrity | `tar`, `gzip`, `gunzip`, `bzip2`, `bunzip2`, `xz`, `unxz`, `zip`, `unzip`, `sha256sum` |
| 091–100 | Networking and services | `ip`, `ss`, `ping`, `curl`, `wget`, `ssh`, `scp`, `rsync`, `systemctl`, `journalctl` |

The final section uses safe forms: `ping` stays on loopback, `curl` reads a
local file URL, `ssh -G` prints configuration without connecting, `scp` and
`rsync` copy only inside the rep, and service commands print version details.

## 100 Windows PowerShell cmdlets

| Reps | Section | Cmdlets |
|---:|---|---|
| 001–010 | Discovery and navigation | `Get-Help`, `Get-Command`, `Get-Alias`, `Get-Location`, `Set-Location`, `Get-ChildItem`, `Get-Item`, `Test-Path`, `Resolve-Path`, `Join-Path` |
| 011–020 | Files and directories | `New-Item`, `Copy-Item`, `Move-Item`, `Rename-Item`, `Remove-Item`, `Get-Content`, `Set-Content`, `Add-Content`, `Clear-Content`, `Get-FileHash` |
| 021–030 | Object pipelines | `Select-String`, `Measure-Object`, `Sort-Object`, `Group-Object`, `Select-Object`, `Where-Object`, `ForEach-Object`, `Get-Unique`, `Compare-Object`, `Tee-Object` |
| 031–040 | Structured data | `ConvertFrom-Csv`, `ConvertTo-Csv`, `Import-Csv`, `Export-Csv`, `ConvertTo-Json`, `ConvertFrom-Json`, `ConvertTo-Xml`, `Select-Xml`, `ConvertTo-Html`, `Out-File` |
| 041–050 | Variables and formatting | `Get-Variable`, `Set-Variable`, `Remove-Variable`, `Get-Member`, `Write-Output`, `Write-Host`, `Format-Table`, `Format-List`, `Out-String`, `Write-Warning` |
| 051–060 | Paths, archives, and security | `Split-Path`, `Convert-Path`, `Get-PSDrive`, `Get-PSProvider`, `Get-ItemProperty`, `Compress-Archive`, `Expand-Archive`, `Export-Clixml`, `Import-Clixml`, `Get-Acl` |
| 061–070 | Processes and services | `Get-Process`, `Stop-Process`, `Start-Sleep`, `Get-Service`, `Start-Service`, `Stop-Service`, `Restart-Service`, `Get-Module`, `Import-Module`, `Measure-Command` |
| 071–080 | System and storage | `Get-Date`, `New-TimeSpan`, `Get-Random`, `Get-Culture`, `Get-Host`, `Get-CimInstance`, `Get-ComputerInfo`, `Get-HotFix`, `Get-Disk`, `Get-Volume` |
| 081–090 | Networking and policy | `Get-NetIPAddress`, `Get-NetIPConfiguration`, `Get-NetAdapter`, `Get-NetRoute`, `Get-NetTCPConnection`, `Test-Connection`, `Resolve-DnsName`, `Get-ExecutionPolicy`, `Get-AuthenticodeSignature`, `Set-Acl` |
| 091–100 | Windows administration | `Get-LocalUser`, `Get-LocalGroup`, `Get-LocalGroupMember`, `Get-ScheduledTask`, `Get-WinEvent`, `Get-EventLog`, `Invoke-Command`, `Set-StrictMode`, `Get-WmiObject`, `Get-TimeZone` |

PowerShell networking stays on the local machine or loopback. Process and
service action reps require `-WhatIf`, and ACL work is limited to synthetic
files inside the disposable practice directory.
