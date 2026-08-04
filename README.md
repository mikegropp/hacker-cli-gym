# Hacker CLI Gym

Build Linux command-line muscle memory by doing short reps in a real Bash
shell.

Hacker CLI Gym is a free, open-source curriculum for 100 practical Linux
commands. Each rep explains one command, breaks down an example, gives you a
small task, runs what you type, and checks the real result. Hints are optional,
and the final hint always contains a working reference command.

No account, subscription, hosted lab, telemetry, or Internet connection is
required after cloning the repository.

## Quick start

Use a Linux host, VM, distrobox, or container with Python 3.10+ and Bash:

```console
git clone https://github.com/mikegropp/hacker-cli-gym.git
cd hacker-cli-gym
python3 gym.py doctor
python3 gym.py daily
```

The Python runner has no third-party runtime dependencies. Some later reps use
standard Linux utilities that minimal installations omit. `doctor` reports any
missing commands and their common package names.

To install all curriculum utilities on Debian or Ubuntu:

```console
sudo apt update
sudo apt install bash coreutils grep sed gawk util-linux bsdextrautils \
  man-db less binutils xxd diffutils procps time ncal file gzip bzip2 \
  xz-utils zip unzip iproute2 iputils-ping curl wget openssh-client rsync systemd
```

Installation as a package is optional:

```console
python3 -m pip install .
hacker-cli-gym daily
```

## One rep

```text
========================================================================
TOPIC: cut
Select delimited fields  [04-text-processing | rep 031 | intermediate]
========================================================================
cut selects bytes, characters, or fields from every input line.

EXAMPLE
  $ cut -d',' -f1 crew.csv
  - -d',' says a comma separates fields.
  - -f1 selects the first field from each line.

YOUR REP
accounts.txt uses colons. Print only field 2: each account name.

gym> cut -d':' -f2 accounts.txt

OUTPUT
alice
bob
carol
[exit 0]

CHECK
[PASS] Only the three account names were printed.
[PASS] cut completed successfully.

REP COMPLETE
XP: +140 | Total: 4340 | Level 9 Navigator
```

This is the machine's real Linux command and real output—not a simulated
terminal. Every rep starts in a fresh temporary directory containing only its
synthetic practice files. `:reset` restores the rep, and the entire directory
is removed when the rep ends.

## Daily loop and progression

`daily` starts the next unfinished five-to-ten-minute rep. Completing reps earns
XP based on difficulty, attempts, and hints. Progress stays in a local JSON file
and includes:

- levels and ranks from Rookie through Shellsmith;
- a UTC daily streak;
- best score per rep;
- completion counts and a badge for each finished ten-command section.

```console
python3 gym.py daily
python3 gym.py status
python3 gym.py sections
python3 gym.py section 04-text-processing
```

## The 100-command curriculum

The list is a curated practical foundation, not a claim that command popularity
can be measured precisely. It progresses from navigation and file work to text
pipelines, permissions, processes, storage, archives, and services.

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

See [COMMANDS.md](COMMANDS.md) for the exact list and section map.

## Commands

```console
python3 gym.py doctor                 # check Bash, catalog, and utilities
python3 gym.py daily                  # run one short daily rep
python3 gym.py start                  # same progression without the daily label
python3 gym.py list                   # list reps available on this Linux system
python3 gym.py list --all             # inspect the catalog from any OS
python3 gym.py sections               # show section completion
python3 gym.py section 04-text-processing
python3 gym.py run linux-awk           # choose one rep directly
python3 gym.py status
python3 gym.py reset-progress
```

Inside a rep:

- `:hint` reveals the next hint;
- `:example` repeats the annotated example;
- `:files` lists the disposable workspace;
- `:reset` restores the starting files;
- `:skip` or `:quit` exits without recording completion.

Progress defaults to `~/.hacker-cli-gym/progress.json`. Set
`HACKER_CLI_GYM_PROGRESS` to use a different path.

## Practice data

Each rep receives purpose-built synthetic files from the lesson catalog. The
repository also includes [sample-files](sample-files/) for free practice with
logs, CSV/TSV data, configuration files, host lists, and a small project tree.
Nothing in the sample data represents a real system or person.

## Safety boundary

Hacker CLI Gym runs learner input on the learner's machine. It is not a security
sandbox. Its guardrails:

- allow only commands declared by the current rep;
- constrain paths and redirection to the temporary workspace;
- block command substitution, unreviewed chaining, and shell launchers;
- keep networking reps offline, loopback-only, or configuration-only;
- keep service and signal reps read-only;
- use a minimal environment and a six-second timeout;
- delete temporary state automatically.

Use a disposable Linux VM or container if you want an operating-system-level
isolation boundary, and always read a command before pressing Enter.

## Contributing

The entire curriculum lives in
`hacker_cli_gym/lessons/linux/catalog.json`. See [CONTRIBUTING.md](CONTRIBUTING.md)
and the adjacent JSON schema to add or improve reps.

## License

[MIT](LICENSE). Use it, fork it, teach with it, and contribute back.
