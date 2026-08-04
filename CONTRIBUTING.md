# Contributing to Hacker CLI Gym

Contributions should remain practical, Linux-focused, local-first, and easy to
review.

## Lesson principles

- Teach one command or one composition idea per rep.
- Explain it in plain language before asking the learner to use it.
- Keep a normal solve between five and ten minutes.
- Use deterministic synthetic files and expected results.
- Grade observable output or workspace state, not an exact command string.
- Permit only the commands and reviewed operators the rep requires.
- Finish with a useful limitation or next-step idea.
- Avoid trivia, arbitrary flags, real targets, and required Internet access.
- Label package-specific and systemd-specific behavior clearly.

## Edit the catalog

Lessons are compact records in
`hacker_cli_gym/lessons/linux/catalog.json`. Each record expands at load time
into the complete lesson model.

1. Keep the lesson ID lowercase and unique.
2. Keep the order and command unique within the 1–100 curriculum.
3. Put the rep in one of the existing ten-command sections.
4. Add only workspace-relative synthetic files or empty directories.
5. List every command in `allowed`; add `operators: ["&&"]` only when required.
6. Put the reference command in `solution`; the loader exposes it as the final
   `Type: ...` hint.
7. Check the requested result using output, exit status, or workspace state.
8. Add common package names only when a minimal Linux install may omit the
   command.

The content contract is documented by
`hacker_cli_gym/lessons/schema.json`. The Python loader additionally rejects
duplicate IDs/orders, unsafe paths, unsupported operators, and unknown checks.

## Supported checks

- `stdout`, `stdout-unordered-lines`, `stdout-contains`, `stdout-nonempty`, and
  `stdout-regex`;
- `stderr-contains` and `exit-code`;
- `path-exists`, `path-not-exists`, `file-content`, and `file-mode`;
- `same-inode`, `same-owner`, and `same-group`.

Multiple checks should verify both the requested outcome and any important
unchanged source state.

## Validate

Run from a Linux system with the curriculum utilities installed:

```console
python3 -m compileall -q hacker_cli_gym gym.py tests
python3 -m unittest discover -s tests -v
python3 gym.py doctor
python3 gym.py list --all
```

On Linux, the suite runs all 100 reference solutions in real Bash sessions and
grades their results. On another OS, it still validates catalog structure,
guardrails, progression, and reference-command syntax.

## Pull requests

Keep a pull request focused and state:

- the command or behavior changed;
- the Linux distributions and utility versions tested;
- why the expected result is deterministic;
- any known GNU, BusyBox, package, init-system, or shell difference.
