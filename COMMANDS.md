# Command curriculum

Hacker CLI Gym teaches 200 commands through 1,000 exercises. Every command has
five stages: orientation, useful options, focused results, pipeline
composition, and a practical workflow.

## Linux: 100 commands, 500 exercises

| Exercises | Section | Commands |
|---:|---|---|
| 001–050 | Navigation and help | `pwd`, `ls`, `cd`, `basename`, `dirname`, `realpath`, `which`, `whereis`, `type`, `man` |
| 051–100 | Files and directories | `mkdir`, `rmdir`, `touch`, `cp`, `mv`, `rm`, `ln`, `readlink`, `file`, `stat` |
| 101–150 | Reading content | `cat`, `less`, `head`, `tail`, `nl`, `tac`, `strings`, `od`, `xxd`, `wc` |
| 151–200 | Text processing | `cut`, `paste`, `grep`, `sed`, `awk`, `tr`, `sort`, `uniq`, `column`, `fmt` |
| 201–250 | Composition and comparison | `echo`, `printf`, `tee`, `xargs`, `diff`, `cmp`, `comm`, `join`, `split`, `csplit` |
| 251–300 | Identity and permissions | `chmod`, `chown`, `chgrp`, `umask`, `id`, `whoami`, `groups`, `getent`, `users`, `who` |
| 301–350 | Processes and execution | `ps`, `top`, `pgrep`, `kill`, `nohup`, `nice`, `timeout`, `sleep`, `time`, `seq` |
| 351–400 | System and storage | `uname`, `hostname`, `uptime`, `date`, `cal`, `env`, `printenv`, `df`, `du`, `free` |
| 401–450 | Archives and integrity | `tar`, `gzip`, `gunzip`, `bzip2`, `bunzip2`, `xz`, `unxz`, `zip`, `unzip`, `sha256sum` |
| 451–500 | Networking and services | `ip`, `ss`, `ping`, `curl`, `wget`, `ssh`, `scp`, `rsync`, `systemctl`, `journalctl` |

Linux exercises run in real Bash inside the disposable Debian image. The final
section uses only offline or loopback fixtures.

## PowerShell: 100 commands, 500 exercises

| Exercises | Section | Commands |
|---:|---|---|
| 001–050 | Discovery and navigation | `Get-Help`, `Get-Command`, `Get-Alias`, `Get-Location`, `Set-Location`, `Get-ChildItem`, `Get-Item`, `Test-Path`, `Resolve-Path`, `Join-Path` |
| 051–100 | Files and content | `New-Item`, `Copy-Item`, `Move-Item`, `Rename-Item`, `Remove-Item`, `Get-Content`, `Set-Content`, `Add-Content`, `Clear-Content`, `Get-FileHash` |
| 101–150 | Pipeline and text | `Select-String`, `Measure-Object`, `Sort-Object`, `Group-Object`, `Select-Object`, `Where-Object`, `ForEach-Object`, `Get-Unique`, `Compare-Object`, `Tee-Object` |
| 151–200 | Structured data | `ConvertFrom-Csv`, `ConvertTo-Csv`, `Import-Csv`, `Export-Csv`, `ConvertTo-Json`, `ConvertFrom-Json`, `ConvertTo-Xml`, `Select-Xml`, `ConvertTo-Html`, `Out-File` |
| 201–250 | Variables and output | `Get-Variable`, `Set-Variable`, `Remove-Variable`, `Get-Member`, `Write-Output`, `Write-Host`, `Format-Table`, `Format-List`, `Out-String`, `Write-Warning` |
| 251–300 | Paths, archives, and security | `Split-Path`, `Convert-Path`, `Get-PSDrive`, `Get-PSProvider`, `Get-ItemProperty`, `Compress-Archive`, `Expand-Archive`, `Export-Clixml`, `Import-Clixml`, `Get-Acl` |
| 301–350 | Processes, services, and modules | `Get-Process`, `Stop-Process`, `Start-Sleep`, `Get-Service`, `Start-Service`, `Stop-Service`, `Restart-Service`, `Get-Module`, `Import-Module`, `Measure-Command` |
| 351–400 | Time and system inventory | `Get-Date`, `New-TimeSpan`, `Get-Random`, `Get-Culture`, `Get-Host`, `Get-CimInstance`, `Get-ComputerInfo`, `Get-HotFix`, `Get-Disk`, `Get-Volume` |
| 401–450 | Networking and policy | `Get-NetIPAddress`, `Get-NetIPConfiguration`, `Get-NetAdapter`, `Get-NetRoute`, `Get-NetTCPConnection`, `Test-Connection`, `Resolve-DnsName`, `Get-ExecutionPolicy`, `Get-AuthenticodeSignature`, `Set-Acl` |
| 451–500 | Windows administration | `Get-LocalUser`, `Get-LocalGroup`, `Get-LocalGroupMember`, `Get-ScheduledTask`, `Get-WinEvent`, `Get-EventLog`, `Invoke-Command`, `Set-StrictMode`, `Get-WmiObject`, `Get-TimeZone` |

PowerShell exercises use native Windows PowerShell. Administrative commands are
taught through inspection, scoped workspace changes, disposable child
processes, or `-WhatIf` previews.
