# Contributing to Hacker CLI Gym

Keep contributions practical, deterministic, and focused on transferable
command-line skill.

## Lesson design

- Teach a normal use of the featured command at every stage.
- Progress through orientation, useful options, precision, composition, and a
  realistic workflow; do not add complexity for its own sake.
- Keep a normal solution short enough for five-to-ten-minute daily practice.
- Grade observable output or state, never an exact command string.
- Let alternative commands, pipelines, variables, loops, and multi-step
  solutions pass.
- Use deterministic synthetic fixtures. Never require Internet access, real
  targets, credentials, or learner-owned files.
- Keep authored Windows administration read-only, workspace-scoped, or behind
  `-WhatIf`.
- Give every check a precise learner-facing description. A failed check should
  identify the mismatched result without revealing the solution.
- Declare concepts and prerequisites instead of silently using syntax that the
  learner has not encountered. Small unavoidable dependencies belong in
  `introduced_inline` and must be explained in the lesson.

Every command has five distinct tasks. Stage 5 may use `mode: "capstone"` for a
blind transfer exercise. A capstone must depend on the generated
`.gym-challenge` token and check `.gym-proof`; this makes the result fresh on
every reset while preserving open-ended solutions.

## Explanations and hints

Each lesson needs an annotated example with at least two useful `breakdown`
items. Provide three progressive hints before the reference solution:

1. explain the concept or likely failure mode;
2. suggest the relevant syntax or pipeline shape;
3. give a concrete near-solution while leaving meaningful work to the learner.

Do not use generic hints such as “check the help.” The final reveal may show one
reference approach, but it is not the only valid answer. Assisted completion is
recorded as introduced rather than mastered, so hint quality directly affects
the review experience.

## Curriculum sources

The checked-in catalogs are generated artifacts:

- Linux foundations: `curriculum/linux.base.json`
- Linux stages 2–5: `tools/linux-progressions/*.mjs`
- PowerShell foundations: `curriculum/powershell.base.json`
- PowerShell stages 2–5: `tools/powershell-progressions/*.mjs`
- Shared metadata helpers: `tools/curriculum-metadata.mjs`
- Catalog contract: `curriculum/schema.json`
- Semantic validator: `tools/validate-curricula.mjs`

Regenerate and validate both tracks:

```console
node tools/generate-linux-curriculum.mjs
node tools/generate-powershell-curriculum.mjs
node tools/validate-curricula.mjs
```

Each track must remain exactly 100 commands × 5 lessons. Keep IDs, ordering,
and command names stable unless the change is an intentional curriculum
migration. When replacing an ID, list its predecessor in `legacy_ids` so saved
completion follows the lesson during progress migration. Paths must be relative
to the disposable lesson workspace.

The schema documents required fields. The semantic validator additionally
checks unique IDs, orders, and missions; supported checks; specific check
descriptions; hint and breakdown depth; prerequisites; capstone placement; and
the strength of missions containing words such as “only.” Generated JSON must
be committed with its source changes.

## Outcome checks

Across the two runners, the shared curriculum contract includes:

- `stdout`, `stdout-unordered-lines`, `stdout-contains`,
  `stdout-not-contains`, `stdout-nonempty`, `stdout-regex`,
  `stdout-line-count`, `stderr-contains`, `output-contains`, and `exit-code`;
- `path-exists`, `path-not-exists`, `file-content`,
  `file-content-contains`, and `file-equals`.

The Linux runner also supports `file-mode`, `same-inode`, `same-owner`, and
`same-group`.

Prefer exact or unordered output checks when the mission asks for “only” a
specific result. Use multiple independent checks when a workflow must prove an
output, a state change, and preservation of its source. Avoid
`stdout-nonempty` when the content can be specified.

A reference passing is necessary but not sufficient. The untouched fixture
must fail, command failures must not count as valid output, and a reasonable
alternative solution should pass. Set `requires_success` whenever a nonzero
command exit must fail the rep and use `check_strength` to make intentional
permissiveness visible.

## Validate changes

Linux:

```console
node tools/generate-linux-curriculum.mjs
node tools/generate-powershell-curriculum.mjs
node tools/validate-curricula.mjs
bash -n gym container/gym
./gym build
./gym test
```

Windows PowerShell 5.1:

```powershell
node tools/generate-linux-curriculum.mjs
node tools/generate-powershell-curriculum.mjs
node tools/validate-curricula.mjs
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\gym.ps1 test
```

CI regenerates both catalogs and rejects generated-file drift. It also validates
the curriculum contract and checks runner syntax. When a platform's runtime or
curriculum changes, CI builds its real environment, proves untouched fixtures
fail, exercises declared negative cases, and executes all 500 reference
approaches. Unrelated changes skip that platform's long sweep, and a newer push
cancels an obsolete in-progress run.

When changing the runner, manually exercise controls and persistence as well as
the happy path: start a rep, fail a check, use a hint, reset the workspace, jump
between reps, run a due review, inspect status, and verify progress recovery.

## Release images

Tags matching `v*` publish Linux images with provenance and an SBOM for amd64
and arm64 through `.github/workflows/release-image.yml`. It requires the normal
Linux and PowerShell jobs to have passed for the exact release commit instead
of running the full 1,000-reference suite again. The release workflow must use
the same source-fingerprint inputs as `./gym`; `./gym pull` refuses an image
that does not exactly match the checked-out Dockerfile, runner, curriculum, and
bundled sample files.

## Pull requests

Describe what changed, why the progression is useful, how grading remains
deterministic and open-ended, and any PowerShell-version or GNU/Linux behavior
that matters. Include the commands used to validate the change.
