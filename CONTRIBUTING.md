# Contributing to Hacker CLI Gym

Keep contributions practical, deterministic, and focused on command-line
muscle memory.

## Lesson principles

- Teach a normal use of the featured command at every stage.
- Progress through useful options, precision, composition, and a realistic
  workflow; do not add difficulty for its own sake.
- Explain the idea in plain language before asking the learner to use it.
- Keep a normal solve short enough for daily practice.
- Use deterministic synthetic fixtures and expected results.
- Grade observable output or state, never an exact command string.
- Let alternative commands, pipelines, and multi-step solutions pass.
- Avoid trivia, real targets, credentials, and required Internet access.
- Keep Windows administration read-only, workspace-scoped, or behind
  `-WhatIf`.

## Curriculum sources

The checked-in JSON catalogs are generated artifacts:

- Linux foundations: `curriculum/linux.base.json`
- Linux stages 2–5: `tools/linux-progressions/*.mjs`
- PowerShell foundations: `curriculum/powershell.base.json`
- PowerShell stages 2–5: `tools/powershell-progressions/*.mjs`

Regenerate them with:

```console
node tools/generate-linux-curriculum.mjs
node tools/generate-powershell-curriculum.mjs
```

Each command must have exactly five unique tasks and reference approaches.
Keep IDs and stage-one ordering stable so existing learner progress survives
updates. Paths must be relative to the disposable lesson workspace.

## Outcome checks

Both runners support the common checks used by the generated catalogs:

- `stdout`, `stdout-contains`, `stdout-not-contains`, `output-contains`,
  `stdout-nonempty`, `stdout-regex`, and `exit-code`;
- `path-exists`, `path-not-exists`, `file-content`,
  `file-content-contains`, and `file-equals`.

The Linux runner additionally supports Linux-specific state checks for modes,
links, ownership, and groups. Use multiple checks when a mission needs to prove
both a requested result and a preserved source.

## Validate

Linux:

```console
./gym build
./gym test
```

Windows PowerShell 5.1:

```powershell
node tools/generate-powershell-curriculum.mjs
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\gym.ps1 test
```

The full tests validate catalog structure, recreate every fixture, execute all
500 reference approaches in the real target shell, and grade their results.
GitHub Actions runs both tracks.

## Pull requests

State what changed, why the progression is useful, how outcomes remain
deterministic, and any shell-version or distribution behavior that matters.
