# Hacker CLI Gym

The Duolingo-style command-line gym: 1,000 short, practical exercises in real
shells.

- **Linux:** 100 essential commands × 5 stages = 500 Bash exercises in a
  disposable Debian container.
- **Windows:** 100 PowerShell commands × 5 stages = 500 exercises in native
  Windows PowerShell.

Every rep explains one useful idea, shows an example, gives you a real fixture,
and asks for an outcome. The checker grades output and state—not the exact
command you typed. Pipelines, variables, loops, alternative commands, and
multi-step solutions are welcome.

## Start the Linux gym

Requirements: Git and Docker.

```console
git clone https://github.com/mikegropp/hacker-cli-gym.git
cd hacker-cli-gym
./gym
```

The first run builds the image. Progress is stored in a Docker volume; each rep
recreates `/work` inside a disposable container. You can also use Compose:

```console
docker compose run --build --rm gym
```

## Start the PowerShell gym

Requirements: Windows and Windows PowerShell 5.1.

```powershell
git clone https://github.com/mikegropp/hacker-cli-gym.git
Set-Location hacker-cli-gym
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\gym.ps1 start
```

The PowerShell runner creates disposable lesson files and progress under
`$env:LOCALAPPDATA\HackerCliGym`. Its authored exercises do not require
administrator access and avoid changing real services, accounts, tasks, disks,
or network configuration.

PowerShell itself is unrestricted: a command you choose can affect Windows.
Use a non-administrator shell, and use a VM if you want the whole operating
system to be disposable.

## Five meaningful stages per command

Each command follows the same learning rhythm:

| Stage | Purpose |
|---:|---|
| 1 | Orientation: use the command for its most common job |
| 2 | Useful options: add a practical parameter or flag |
| 3 | Focused results: select, filter, or inspect more precisely |
| 4 | Pipeline composition: combine the command with normal shell tools |
| 5 | Practical workflow: solve a small, realistic multi-step task |

The stages are not made harder with arbitrary syntax. They progress from a
normal first use toward the way the command appears in everyday work.

## A rep in practice

```text
PowerShell rep 026/500 | command 006/100 | stage 1/5: Orientation

Get-ChildItem — List files

MISSION
Print only the names of the two files in the practice directory.

gym[26] ~> Get-ChildItem -File | ForEach-Object Name
notes.txt
status.txt

CHECK
[PASS] Only the requested names were printed.
REP COMPLETE
```

The reference might use `Select-Object -ExpandProperty Name`; the alternative
above still passes because it produces the requested result.

## Gym controls

Controls begin with a colon, leaving ordinary Bash and PowerShell input alone:

```text
:hint       reveal the next hint, then the reference approach
:example    repeat the example
:files      list the current practice files
:reset      restore the rep fixture
:check      grade the last output and current state again
:lesson     repeat the mission
:status     show progress, XP, and level
:next       move to the next rep
:previous   move to the previous rep
:go TARGET  jump by number, command, or lesson ID
:quit       leave the gym
```

The Linux track also provides `:shell` for an unwrapped interactive Bash
subshell.

## Launcher commands

Linux:

```console
./gym                         # next unfinished rep
./gym run 151                 # run by global exercise number
./gym run cut                 # first unfinished cut stage
./gym run linux-cut-5         # run by exact lesson ID
./gym list
./gym status
./gym test                    # execute all 500 references
./gym build
```

PowerShell:

```powershell
.\gym.ps1 start
.\gym.ps1 run 26
.\gym.ps1 run Get-ChildItem
.\gym.ps1 run powershell-get-childitem-5
.\gym.ps1 list
.\gym.ps1 status
.\gym.ps1 test               # execute all 500 references
```

## Linux command path

| Exercises | Commands | Section |
|---:|---:|---|
| 001–050 | 001–010 | Navigation and help |
| 051–100 | 011–020 | Files and directories |
| 101–150 | 021–030 | Reading content |
| 151–200 | 031–040 | Text processing |
| 201–250 | 041–050 | Composition and comparison |
| 251–300 | 051–060 | Identity and permissions |
| 301–350 | 061–070 | Processes and execution |
| 351–400 | 071–080 | System and storage |
| 401–450 | 081–090 | Archives and integrity |
| 451–500 | 091–100 | Networking and services |

The full command lists are in [COMMANDS.md](COMMANDS.md).

## PowerShell command path

| Exercises | Commands | Section |
|---:|---:|---|
| 001–050 | 001–010 | Discovery and navigation |
| 051–100 | 011–020 | Files and content |
| 101–150 | 021–030 | Pipeline and text |
| 151–200 | 031–040 | Structured data |
| 201–250 | 041–050 | Variables and output |
| 251–300 | 051–060 | Paths, archives, and security |
| 301–350 | 061–070 | Processes, services, and modules |
| 351–400 | 071–080 | Time and system inventory |
| 401–450 | 081–090 | Networking and policy |
| 451–500 | 091–100 | Windows administration |

## Linux isolation and networking

The Linux container runs as root so permissions, ownership, processes, SSH,
and system utilities behave naturally. The host launcher mounts no repository,
home directory, Docker socket, or personal files into the container.

Networking is disabled. Networking exercises use loopback-only HTTP and SSH
fixtures, so they remain deterministic and do not contact real targets.

If a VM clock is far behind or ahead and APT reports that a Debian `Release`
file is not valid yet, synchronize the VM and rebuild:

```console
sudo timedatectl set-ntp true
timedatectl status
./gym build
```

## Practice data

Every rep creates only the fixture it needs. The repository also includes
synthetic logs, CSV/TSV data, configurations, host lists, and a small project
tree in `sample-files/` for self-directed practice.

## License

[MIT](LICENSE). Use it, fork it, teach with it, and contribute back.
