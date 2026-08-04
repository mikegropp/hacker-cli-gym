# Contributing to Hacker CLI Gym

Contributions should remain practical, native-shell focused, local-first, and
easy to review.

## Lesson principles

- Teach one command, cmdlet, or composition idea per rep.
- Explain it in plain language before asking the learner to use it.
- Keep a normal solve between five and ten minutes.
- Use deterministic synthetic files and expected results.
- Grade observable output or workspace state, not an exact command string.
- Permit only the commands and reviewed operators the rep requires.
- Finish with a useful limitation or next-step idea.
- Avoid trivia, arbitrary flags, real targets, and required Internet access.
- Keep Linux reps in Bash and Windows reps entirely in PowerShell.

## Edit a catalog

Lessons are compact records in:

- `hacker_cli_gym/lessons/linux/catalog.json`
- `hacker_cli_gym/lessons/powershell/core.json`
- `hacker_cli_gym/lessons/powershell/windows.json`

Each record expands at load time into the complete lesson model.

1. Keep the lesson ID lowercase and globally unique.
2. Keep the order and command unique within its 1–100 track.
3. Put the rep in one of the track's existing ten-command sections.
4. Add only workspace-relative synthetic files or empty directories.
5. List every pipeline command in `allowed`.
6. Add `operators: ["&&"]` for reviewed Bash sequencing or
   `operators: [";"]` for reviewed PowerShell sequencing only when needed.
7. Put the reference command in `solution`; the loader exposes it as the final
   `Type: ...` hint.
8. Check the requested result using output, exit status, or workspace state.
9. Add Linux package names only when a minimal installation may omit a command.

The content contract is documented by
`hacker_cli_gym/lessons/schema.json`. The Python loader additionally rejects
duplicate IDs and per-track orders, unsafe paths, mismatched native shells,
unsupported operators, and unknown checks.

## Safety expectations

- Linux network commands must be offline, local-file, configuration-only, or
  loopback-only.
- PowerShell network cmdlets must be local or loopback-only.
- Do not add shell launchers, dynamic code execution, remote sessions, or
  credentials.
- PowerShell process and service action cmdlets must use `-WhatIf`.
- System discovery must be read-only.
- All file and ACL changes must stay inside the disposable rep workspace.

## Supported checks

- `stdout`, `stdout-unordered-lines`, `stdout-contains`, `output-contains`,
  `stdout-nonempty`, and `stdout-regex`;
- `stderr-contains` and `exit-code`;
- `path-exists`, `path-not-exists`, `file-content`, and `file-mode`;
- `same-inode`, `same-owner`, and `same-group`.

Multiple checks should verify both the requested outcome and any important
unchanged source state.

## Validate

```console
python -m compileall -q hacker_cli_gym gym.py tests
python -m unittest discover -s tests -v
python gym.py doctor
python gym.py list --all
```

On Linux, the suite runs and grades all 100 Linux reference solutions in real
Bash sessions. On Windows, it runs and grades all 100 PowerShell reference
solutions in Windows PowerShell. From other operating systems, it still checks
catalog structure, guardrails, progression, and reference-command syntax.

## Pull requests

Keep a pull request focused and state:

- the command, cmdlet, or behavior changed;
- the operating system and shell version tested;
- why the expected result is deterministic;
- any known distribution, PowerShell edition, package, or system difference.
