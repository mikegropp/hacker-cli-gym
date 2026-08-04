# The 100 Linux commands

This is a deliberately practical curriculum rather than a popularity chart.
Commands are grouped into ten sections of ten reps and grow from foundation to
intermediate and advanced system work.

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

## Difficulty curve

- Reps 001–030: foundation
- Reps 031–070: intermediate
- Reps 071–100: advanced

The final section teaches safe command forms: `ping` stays on loopback, `curl`
reads a local `file://` URL, `ssh -G` prints configuration without connecting,
`scp` and `rsync` copy only inside the rep, and systemd commands print version
information without changing services.
