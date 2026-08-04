# Hacker CLI Gym

Learn 100 essential Linux commands in a real, disposable command line.

Hacker CLI Gym drops you into a small Debian Linux container containing real
files and the standard GNU/Linux tools. It gives you a mission, then gets out
of the way: use any valid Bash command, pipeline, redirect, variable, loop, or
multi-command solution. The checker grades the result, never the exact command
you typed.

## Start in 30 seconds

You only need Git and Docker.

```console
git clone https://github.com/mikegropp/hacker-cli-gym.git
cd hacker-cli-gym
./gym
```

The first run builds the image. Later runs start immediately at your next
unfinished rep. Progress is kept in a small Docker volume; every practice
workspace is recreated inside the disposable container.

You can also use Compose:

```console
docker compose run --build --rm gym
```

## What a rep feels like

```text
========================================================================
REP 031/100 · intermediate · cut
Select delimited fields
========================================================================
cut selects fields when input has a dependable simple delimiter.

YOUR MISSION
accounts.txt uses colons. Print only the username in field 2.
Workspace: /work · any Bash command or pipeline is allowed

gym[31]:~$ awk -F: '{print $2}' accounts.txt
alice
bob
carol
[exit 0]

CHECK
[PASS] Only the usernames were printed.

REP COMPLETE
```

The featured command is `cut`, but the alternative `awk` solution passes. You
can inspect files, take several steps, create helper variables, or solve the
mission in a completely different way. Checks observe output, exit status,
files, directories, links, ownership, and permissions.

## Gym controls

Controls start with a colon so normal Linux commands remain untouched:

```text
:hint       reveal a hint, then the reference approach
:example    repeat the annotated example
:files      list the current practice files
:reset      restore the rep's original files
:check      grade the last output and current filesystem state
:shell      open a completely unwrapped interactive Bash subshell
:lesson     repeat the mission
:status     show progress, XP, level, and streak
:next       move to the next rep
:previous   move to the previous rep
:go TARGET  jump by number, command, or lesson ID
:quit       leave the container
```

Everything else is evaluated by Bash. Multi-line loops and functions work as
well. Use `:shell` when you want full-screen or interactive programs without
the gym capturing their output; file changes made there remain available to
the checker when you return.

## Host commands

```console
./gym                       # next unfinished rep
./gym run 31                # run by number
./gym run cut               # run by command
./gym run linux-cut         # run by lesson ID
./gym list                  # list all reps
./gym status                # XP, level, streak, and section progress
./gym test                  # execute every reference approach
./gym build                 # rebuild after pulling changes
```

## VM clock troubleshooting

Docker uses the Linux host's clock. The image build tolerates up to one hour of
normal clock drift from pausing or restoring a VM. If APT still reports that a
Debian `Release` file "is not valid yet," synchronize the VM and rebuild:

```console
sudo timedatectl set-ntp true
timedatectl status
./gym build
```

The build deliberately keeps APT's repository-expiration checks enabled.

## The 100-command path

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

Reps 001–030 are foundation, 031–070 are intermediate, and 071–100 are
advanced. Each completed rep awards XP. Hints and repeated attempts reduce the
score for that run, while replaying a rep can improve your best score.

## Real Linux, safely disposable

The container intentionally runs as root so ownership, permissions, processes,
and system utilities behave naturally. You are free to break the container;
leaving and running `./gym` again restores it. The host launcher does not mount
the repository or any personal directory into the container.

Networking is disabled by default for deterministic practice. Loopback still
works for the networking reps. If you deliberately want network access for
open-ended exploration, invoke the image yourself with Docker's normal bridge
network.

Do not add sensitive host mounts or the Docker socket to an untrusted shell.
The container is the isolation boundary; it is not a virtual machine.

## Practice data

Each rep creates only the files it needs. The repository's `sample-files/`
directory adds logs, CSV/TSV data, configuration files, host lists, and a small
project tree for self-directed practice. All names and records are synthetic.

## License

[MIT](LICENSE). Use it, fork it, teach with it, and contribute back.
