# Hacker CLI Gym

Build command-line muscle memory by doing short reps in a real native shell.

Hacker CLI Gym is a free, open-source curriculum with two clean tracks:

- **Linux:** 100 practical commands executed in Bash.
- **Windows:** 100 PowerShell cmdlets executed in Windows PowerShell.

Each rep explains one command, breaks down an example, gives you a practical
task, runs what you type, and checks the real result. Hints are optional, and
the final hint contains a working reference command.

The runner automatically selects the track for the current operating system.
No account, hosted lab, telemetry, third-party Python package, or Internet
connection is required after cloning the repository.

## Quick start

### Linux

Use a Linux host, VM, distrobox, or container with Python 3.10+ and Bash:

```console
git clone https://github.com/mikegropp/hacker-cli-gym.git
cd hacker-cli-gym
python3 gym.py doctor
python3 gym.py daily
```

Some later Linux reps use standard utilities that minimal installations omit.
`doctor` reports missing commands and their common package names. On Debian or
Ubuntu, install the full curriculum toolset with:

```console
sudo apt update
sudo apt install bash coreutils grep sed gawk util-linux bsdextrautils \
  man-db less binutils xxd diffutils procps time ncal file gzip bzip2 \
  xz-utils zip unzip iproute2 iputils-ping curl wget openssh-client rsync systemd
```

### Windows PowerShell

Use a Windows host or VM with Python 3.10+ and Windows PowerShell 5.1:

```powershell
git clone https://github.com/mikegropp/hacker-cli-gym.git
Set-Location hacker-cli-gym
py gym.py doctor
py gym.py daily
```

The Windows curriculum is PowerShell-only. Its reps use cmdlets and object
pipelines rather than Command Prompt commands.

Installation as a Python package is optional on either platform:

```console
python -m pip install .
hacker-cli-gym daily
```

## One rep

```text
========================================================================
TOPIC: Select-Object
Choose object properties  [03-object-pipelines | rep 025 | foundation]
========================================================================
Select-Object keeps the properties you need from objects in the pipeline.

EXAMPLE
  $ Import-Csv crew.csv | Select-Object name,role
  - Import-Csv turns every CSV row into an object.
  - Select-Object emits only the name and role properties.

YOUR REP
Read inventory.csv and display only the name and status properties.

gym> Import-Csv inventory.csv | Select-Object name,status

OUTPUT
name   status
----   ------
router online
switch offline
[exit 0]

CHECK
[PASS] Both selected properties and their values were displayed.
[PASS] The pipeline completed successfully.

REP COMPLETE
XP: +100 | Total: 1700 | Level 4 Operator
```

The output comes from the machine's real shell, not a simulated terminal.
Every rep starts in a fresh temporary directory containing only synthetic
practice files. `:reset` restores the rep, and the directory is removed when
the rep ends.

## Daily loop and progression

`daily` starts the next unfinished five-to-ten-minute rep for the current
platform. Completing reps earns XP based on difficulty, attempts, and hints.
Progress stays in a local JSON file and includes:

- levels and ranks from Rookie through Shellsmith;
- a UTC daily streak;
- best score per rep;
- completion counts and a badge for each finished ten-command section.

```console
python gym.py daily
python gym.py status
python gym.py sections
python gym.py section 03-object-pipelines
```

## Curricula

Each track progresses from discovery and file work to pipelines, structured
data, system inspection, networking, and administration.

### Linux: 100 commands

1. Navigation and help — `pwd` through `man`
2. Files and directories — `mkdir` through `stat`
3. Reading content — `cat` through `wc`
4. Text processing — `cut`, `grep`, `sed`, `awk`, and more
5. Composition and comparison — `echo` through `csplit`
6. Identity and permissions — `chmod` through `who`
7. Processes and execution — `ps` through `seq`
8. System and storage — `uname` through `free`
9. Archives and integrity — `tar` through `sha256sum`
10. Networking and services — `ip` through `journalctl`

### Windows: 100 PowerShell cmdlets

1. Discovery and navigation — `Get-Help` through `Join-Path`
2. Files and directories — `New-Item` through `Get-FileHash`
3. Object pipelines — `Select-String` through `Tee-Object`
4. Structured data — CSV, JSON, XML, HTML, and files
5. Variables and formatting — `Get-Variable` through `Write-Warning`
6. Paths, archives, and security — `Split-Path` through `Get-Acl`
7. Processes and services — `Get-Process` through `Measure-Command`
8. System and storage — `Get-Date` through `Get-Volume`
9. Networking and policy — `Get-NetIPAddress` through `Set-Acl`
10. Windows administration — `Get-LocalUser` through `Get-TimeZone`

See [COMMANDS.md](COMMANDS.md) for both exact command lists.

## Runner commands

```console
python gym.py doctor                    # check the shell, catalog, and commands
python gym.py daily                     # run one short daily rep
python gym.py start                     # start the next unfinished native rep
python gym.py list                      # list reps for this operating system
python gym.py list --all                # inspect both catalogs from any OS
python gym.py sections                  # show native section completion
python gym.py section 04-text-processing
python gym.py run linux-awk             # choose a Linux rep directly
python gym.py run powershell-import-csv # choose a PowerShell rep directly
python gym.py status
python gym.py reset-progress
```

Use `python3` on Linux or `py` on Windows if those are the Python launchers on
your system.

Inside a rep:

- `:hint` reveals the next hint;
- `:example` repeats the annotated example;
- `:files` lists the disposable workspace;
- `:reset` restores the starting files;
- `:skip` or `:quit` exits without recording completion.

Progress defaults to `~/.hacker-cli-gym/progress.json`. Set
`HACKER_CLI_GYM_PROGRESS` to use a different path.

## Practice data

Each rep receives purpose-built synthetic files from its lesson catalog. The
repository also includes [sample-files](sample-files/) for free practice with
logs, CSV/TSV data, configuration files, host lists, and a small project tree.
Nothing in the sample data represents a real system or person.

## Safety boundary

Hacker CLI Gym runs learner input on the learner's machine. It is not an
operating-system security sandbox. Its guardrails:

- allow only commands declared by the current rep;
- constrain paths and file output to the temporary workspace;
- block substitution, unreviewed chaining, shell launchers, and dynamic code;
- keep networking reps offline or loopback-only;
- keep system inspection read-only;
- require `-WhatIf` for PowerShell process and service actions;
- use a minimal environment and a twelve-second timeout;
- delete temporary state automatically.

Use a disposable VM or container if you want an operating-system isolation
boundary, and always read a command before pressing Enter.

## Contributing

The curricula live in:

- `hacker_cli_gym/lessons/linux/catalog.json`
- `hacker_cli_gym/lessons/powershell/core.json`
- `hacker_cli_gym/lessons/powershell/windows.json`

See [CONTRIBUTING.md](CONTRIBUTING.md) and the adjacent JSON schema to improve
or add reps.

## License

[MIT](LICENSE). Use it, fork it, teach with it, and contribute back.
