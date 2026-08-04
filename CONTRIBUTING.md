# Contributing to Hacker CLI Gym

Keep contributions practical, deterministic, and focused on command-line
muscle memory.

## Lesson principles

- Teach one command or composition idea per rep.
- Explain it in plain language before asking the learner to use it.
- Keep a normal solve between five and ten minutes.
- Use deterministic synthetic files and expected results.
- Grade observable output or filesystem state, never an exact command string.
- Allow alternative commands and multi-step solutions to pass.
- Finish with a useful limitation or next-step idea.
- Avoid trivia, real targets, credentials, and required Internet access.

## Edit the catalog

All 100 reps live in `curriculum/linux.json`. Keep IDs, orders, and featured
commands unique. Add only workspace-relative synthetic paths. Put a known-good
reference approach in `solution`; it becomes the final hint, not a command
restriction.

Supported checks are:

- `stdout`, `stdout-unordered-lines`, `stdout-contains`, `output-contains`,
  `stdout-nonempty`, and `stdout-regex`;
- `stderr-contains` and `exit-code`;
- `path-exists`, `path-not-exists`, `file-content`, and `file-mode`;
- `same-inode`, `same-owner`, and `same-group`.

Use multiple checks when a mission should verify both a requested outcome and
an unchanged source file. Package metadata is helpful when the featured
command is not part of a minimal Debian installation.

## Validate

```console
./gym build
./gym test
```

The test command validates catalog structure, recreates every fixture set, runs
all 100 reference approaches in Bash, and grades their real results.

## Pull requests

State what changed, why the result remains deterministic, and any known GNU or
distribution-specific behavior.
