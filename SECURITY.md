# Security policy

## Supported versions

Security fixes are applied to the current major release. Users should update to
the newest published tag before reporting an issue that may already be fixed.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability. Use GitHub's private
vulnerability reporting feature on the repository Security tab and include:

- the affected runner and version or commit;
- a minimal reproduction;
- the potential impact on learner or host data; and
- any suggested mitigation.

The Linux gym intentionally executes arbitrary learner commands as root inside
a restricted Docker container. The Windows runner executes commands as the
current Windows user; use `windows-sandbox.ps1` when host isolation matters.
Never place secrets or personal files inside a mapped gym workspace.
