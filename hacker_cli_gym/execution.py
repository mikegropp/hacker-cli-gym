from __future__ import annotations

import os
import re
import shlex
import shutil
import stat
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .models import Check, Lesson


class UnsafeCommand(ValueError):
    """Raised when a command falls outside a lesson's lightweight guardrails."""


@dataclass(frozen=True)
class CommandResult:
    stdout: str
    stderr: str
    returncode: int
    timed_out: bool = False


@dataclass(frozen=True)
class CheckResult:
    description: str
    passed: bool


FORBIDDEN_FRAGMENTS = ("\n", "\r", "&&", "||", ";", "\x00")
FORBIDDEN_PATTERNS = (
    re.compile(r"\bsudo\b", re.IGNORECASE),
    re.compile(r"\bsu\s", re.IGNORECASE),
    re.compile(r"\b(?:bash|sh|zsh|fish)\s+-c\b", re.IGNORECASE),
    re.compile(r"\bsystem\s*\(", re.IGNORECASE),
    re.compile(r"\bfind\b[^|]*\s-(?:exec|execdir|delete)\b", re.IGNORECASE),
)
POWERSHELL_FORBIDDEN_PATTERNS = (
    re.compile(r"\b(?:Invoke-Expression|iex)\b", re.IGNORECASE),
    re.compile(r"\b(?:Start-Process|Start-Job|Add-Type|New-Object)\b", re.IGNORECASE),
    re.compile(r"-(?:ComputerName|Session|Credential|AsJob)\b", re.IGNORECASE),
    re.compile(r"\bSystem\.Diagnostics\b", re.IGNORECASE),
    re.compile(r"::"),
)
REDIRECTION = re.compile(r"(?:^|\s)(?:\d?>>?|<)\s*([^\s|]+)")
DISALLOWED_EXECUTABLES = {
    "bash",
    "dash",
    "fish",
    "node",
    "perl",
    "python",
    "python3",
    "ruby",
    "sh",
    "zsh",
    "cmd",
    "cmd.exe",
    "cscript",
    "cscript.exe",
    "mshta",
    "mshta.exe",
    "powershell",
    "powershell.exe",
    "pwsh",
    "pwsh.exe",
    "rundll32",
    "rundll32.exe",
    "wscript",
    "wscript.exe",
}
WRAPPER_COMMANDS = {"env", "nice", "nohup", "time", "timeout", "xargs"}


def _clean_redirection_target(raw_target: str) -> str:
    target = raw_target.strip().strip("'\"")
    return target


def _looks_outside_workspace(raw_token: str) -> bool:
    token = raw_token.strip().strip("'\"")
    if not token or token == ".":
        return False
    if token.startswith(("/", "~", "\\\\")):
        return True
    if re.match(r"^[A-Za-z]:[\\/]", token):
        return True
    if re.match(
        r"^(?:HKLM|HKCU|Registry|Cert|WSMan|Function|Alias):",
        token,
        re.IGNORECASE,
    ):
        return True
    return ".." in re.split(r"[\\/]", token)


def _embedded_path_escapes(raw_token: str) -> bool:
    token = raw_token.strip().strip("'\"")
    if token.startswith("-") and "/" in token:
        return True
    if "=" not in token:
        return False
    _, value = token.split("=", 1)
    return _looks_outside_workspace(value)


def _validate_special_command(command_name: str, tokens: list[str], lesson: Lesson) -> None:
    arguments = tokens[1:]
    comparable = command_name.casefold() if lesson.shell == "powershell" else command_name
    folded_arguments = [item.casefold() for item in arguments]

    if lesson.shell == "powershell":
        if comparable in {
            "stop-process",
            "start-service",
            "stop-service",
            "restart-service",
        }:
            if "-whatif" not in folded_arguments:
                raise UnsafeCommand(
                    f"The {command_name} rep requires -WhatIf and cannot change host state."
                )
        elif comparable == "test-connection":
            destinations = [
                item.strip("'\"")
                for item in arguments
                if not item.startswith("-") and not item.isdigit()
            ]
            if not destinations or destinations[-1].casefold() not in {
                "127.0.0.1",
                "::1",
                "localhost",
            }:
                raise UnsafeCommand("The Test-Connection rep is limited to loopback.")
        elif comparable == "resolve-dnsname":
            names = [item.strip("'\"") for item in arguments if not item.startswith("-")]
            if not names or names[0].casefold() != "localhost":
                raise UnsafeCommand("The Resolve-DnsName rep is limited to localhost.")
        elif comparable in {"invoke-command", "measure-command"}:
            rendered = " ".join(arguments)
            if not re.fullmatch(
                r"(?:-ScriptBlock\s+)?\{\s*(?:\d+\s*[+*/-]\s*\d+|'[^']*'|\"[^\"]*\")\s*\}",
                rendered,
                re.IGNORECASE,
            ):
                raise UnsafeCommand(
                    f"The {command_name} rep permits only a static local expression."
                )
        elif comparable == "foreach-object":
            if any("{" in item for item in arguments) or "-membername" not in folded_arguments:
                raise UnsafeCommand(
                    "This ForEach-Object rep uses the safe -MemberName form."
                )
            member_index = folded_arguments.index("-membername") + 1
            if member_index >= len(arguments) or arguments[member_index].casefold() not in {
                "tolower",
                "tostring",
                "toupper",
                "trim",
            }:
                raise UnsafeCommand("This ForEach-Object member is outside the rep.")
        elif comparable == "where-object" and any("{" in item for item in arguments):
            raise UnsafeCommand("This Where-Object rep uses property comparison syntax.")
        elif comparable == "import-module":
            module_names = [item for item in arguments if not item.startswith("-")]
            if not module_names or module_names[0].casefold() not in {
                "microsoft.powershell.management",
                "microsoft.powershell.utility",
            }:
                raise UnsafeCommand("This rep imports only a built-in PowerShell module.")
        elif comparable == "get-help" and "-online" in folded_arguments:
            raise UnsafeCommand("The Get-Help rep stays offline.")
        return

    if comparable == "kill":
        if not arguments or arguments[0] not in {"-l", "--list"}:
            raise UnsafeCommand("The kill rep only lists signal names; it never sends a signal.")
    elif comparable == "ping":
        destinations = [item for item in arguments if not item.startswith("-") and not item.isdigit()]
        if not destinations or destinations[-1] not in {"127.0.0.1", "::1", "localhost"}:
            raise UnsafeCommand("The ping rep is limited to this machine's loopback address.")
    elif comparable == "curl":
        urls = [item for item in arguments if "://" in item]
        if len(urls) != 1 or not re.fullmatch(r"file://\$PWD/[A-Za-z0-9._/-]+", urls[0]):
            raise UnsafeCommand("The curl rep only reads a file://$PWD/... URL in the practice workspace.")
    elif comparable == "wget":
        if not arguments or any(item not in {"--version", "-V"} for item in arguments):
            raise UnsafeCommand("The wget rep is offline and only permits --version.")
    elif comparable == "ssh":
        if len(arguments) != 2 or arguments[0] != "-G" or arguments[1].startswith("-"):
            raise UnsafeCommand("The ssh rep only prints configuration with ssh -G; it never connects.")
    elif comparable == "scp":
        if any(":" in item or "://" in item for item in arguments):
            raise UnsafeCommand("The scp rep permits local workspace copies only.")
        if any(item.startswith("-") and item not in {"-p", "-q", "-r", "-v"} for item in arguments):
            raise UnsafeCommand("The scp rep does not permit transport-changing options.")
    elif comparable == "rsync":
        if any(":" in item or "://" in item for item in arguments):
            raise UnsafeCommand("The rsync rep permits local workspace copies only.")
        if any(
            item.startswith(("-e", "--rsh", "--rsync-path"))
            for item in arguments
        ):
            raise UnsafeCommand("The rsync rep does not permit external transport programs.")
    elif comparable in {"systemctl", "journalctl"}:
        if not arguments or any(item not in {"--version", "--no-pager"} for item in arguments):
            raise UnsafeCommand(f"The {command_name} rep is read-only and only permits --version.")
    elif comparable == "tar":
        dangerous = ("--checkpoint-action", "--use-compress-program", "--to-command", "-I")
        if any(":" in item for item in arguments) or any(
            item.startswith(dangerous) or item.startswith("--rsh-command")
            for item in arguments
        ):
            raise UnsafeCommand("This tar form can launch another program and is outside the rep.")
    elif comparable == "zip":
        if any(item in {"-T", "-TT"} or item.startswith("-TT") for item in arguments):
            raise UnsafeCommand("The zip rep does not permit external archive test commands.")
    elif comparable == "sed":
        scripts = [item for item in arguments if not item.startswith("-")]
        if any(
            re.search(r"(^|;)\s*e(?:\s|$)", script)
            or re.search(r"s(.).*\1[0-9gIpM]*e[0-9gIpM]*$", script)
            for script in scripts
        ):
            raise UnsafeCommand("The sed rep does not permit the command-execution extension.")


def _nested_executable(command_name: str, tokens: list[str]) -> str | None:
    if command_name not in WRAPPER_COMMANDS:
        return None
    arguments = tokens[1:]
    index = 0
    if command_name == "env":
        while index < len(arguments) and (
            arguments[index].startswith("-") or "=" in arguments[index]
        ):
            index += 1
    elif command_name in {"nice", "timeout"}:
        while index < len(arguments) and arguments[index].startswith("-"):
            index += 2 if arguments[index] in {"-n", "--adjustment", "-k", "--kill-after", "-s", "--signal"} else 1
        if command_name == "timeout" and index < len(arguments):
            index += 1
    elif command_name == "time":
        while index < len(arguments) and arguments[index].startswith("-"):
            index += 1
    elif command_name == "xargs":
        options_with_values = {"-a", "-d", "-E", "-I", "-L", "-n", "-P", "-s"}
        while index < len(arguments) and arguments[index].startswith("-"):
            option = arguments[index].split("=", 1)[0]
            index += 2 if option in options_with_values and "=" not in arguments[index] else 1
    if index >= len(arguments):
        return None
    return Path(arguments[index]).name


def check_command(command: str, lesson: Lesson) -> None:
    stripped = command.strip()
    if not stripped:
        raise UnsafeCommand("Type a command, or use :hint, :example, :files, :reset, or :quit.")
    forbidden_fragments = [
        fragment
        for fragment in FORBIDDEN_FRAGMENTS
        if fragment not in lesson.allowed_operators
    ]
    for fragment in forbidden_fragments:
        if fragment in stripped:
            raise UnsafeCommand(f"This rep does not allow the shell operator {fragment!r}.")
    if lesson.shell == "posix" and "`" in stripped:
        raise UnsafeCommand("Backtick command substitution is outside this rep.")
    if lesson.shell == "posix" and "$(" in stripped:
        raise UnsafeCommand("Command substitution is outside this rep.")
    if lesson.shell == "powershell":
        if "`" in stripped or "$(" in stripped or "(" in stripped or ")" in stripped:
            raise UnsafeCommand("PowerShell substitution and nested expressions are outside this rep.")
        variable_references = re.findall(
            r"\$(?:\{[^}]+\}|[A-Za-z_][A-Za-z0-9_:]*)",
            stripped,
        )
        safe_variables = {
            "$pid",
            "$null",
            "$home",
            "$pwd",
            "$env:home",
            "$env:userprofile",
            "$env:temp",
            "$env:tmp",
        }
        if any(reference.casefold() not in safe_variables for reference in variable_references):
            raise UnsafeCommand(
                "That PowerShell variable may resolve outside the temporary workspace."
            )
        if re.search(r"(^|\s)[&.]\s+", stripped):
            raise UnsafeCommand("PowerShell call and dot-source operators are outside this rep.")
        for pattern in POWERSHELL_FORBIDDEN_PATTERNS:
            if pattern.search(stripped):
                raise UnsafeCommand(
                    "That PowerShell form is outside this rep's local practice boundary."
                )
    for pattern in FORBIDDEN_PATTERNS:
        if pattern.search(stripped):
            raise UnsafeCommand("That command form is outside this rep's local practice boundary.")

    allowed = {
        item.casefold() if lesson.shell == "powershell" else item
        for item in lesson.allowed_commands
    }
    segments = re.split(r"\||&&|;", stripped)
    for segment in segments:
        segment = segment.strip()
        if not segment:
            raise UnsafeCommand("Every pipeline stage needs a command.")
        try:
            tokens = shlex.split(segment, posix=lesson.shell == "posix")
        except ValueError as exc:
            raise UnsafeCommand(f"The shell could not parse this command: {exc}") from exc
        if not tokens:
            raise UnsafeCommand("Every pipeline stage needs a command.")
        command_name = Path(tokens[0]).name
        comparable = command_name.casefold() if lesson.shell == "powershell" else command_name
        if comparable not in allowed:
            allowed_display = ", ".join(lesson.allowed_commands)
            raise UnsafeCommand(
                f"{command_name!r} is outside this rep. Available commands: {allowed_display}."
            )
        if command_name.casefold() in DISALLOWED_EXECUTABLES:
            raise UnsafeCommand(f"Launching {command_name!r} is outside this rep.")
        if (
            lesson.shell == "powershell"
            and any(character in segment for character in "{}")
            and comparable not in {"invoke-command", "measure-command"}
        ):
            raise UnsafeCommand(
                "PowerShell script blocks are outside this rep's practice boundary."
            )
        nested = _nested_executable(command_name, tokens)
        if nested is not None:
            nested_comparable = nested.casefold() if lesson.shell == "powershell" else nested
            if nested_comparable not in allowed or nested.casefold() in DISALLOWED_EXECUTABLES:
                raise UnsafeCommand(f"The nested command {nested!r} is outside this rep.")
        _validate_special_command(command_name, tokens, lesson)
        for index, token in enumerate(tokens[1:], start=1):
            is_reviewed_xpath = (
                lesson.shell == "powershell"
                and comparable == "select-xml"
                and tokens[index - 1].casefold() == "-xpath"
                and re.fullmatch(
                    r"/{1,2}[A-Za-z][A-Za-z0-9_-]*(?:/[A-Za-z][A-Za-z0-9_-]*)*",
                    token.strip("'\""),
                )
            )
            if is_reviewed_xpath:
                continue
            if _looks_outside_workspace(token) or _embedded_path_escapes(token):
                raise UnsafeCommand(
                    "Paths must stay inside the temporary practice workspace."
                )

    for match in REDIRECTION.finditer(stripped):
        target = _clean_redirection_target(match.group(1))
        if not target:
            raise UnsafeCommand("A redirection needs a workspace-relative file.")
        target_path = Path(target)
        if target_path.is_absolute() or ".." in target_path.parts or target.startswith("~"):
            raise UnsafeCommand("Redirection must stay inside the temporary practice workspace.")


def shell_command(lesson: Lesson) -> list[str] | None:
    if lesson.shell == "posix":
        bash = shutil.which("bash")
        return [bash, "--noprofile", "--norc", "-c"] if bash else None
    if lesson.shell == "powershell":
        powershell = (
            shutil.which("powershell.exe")
            or shutil.which("powershell")
        )
        return (
            [powershell, "-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]
            if powershell
            else None
        )
    return None


def run_command(command: str, lesson: Lesson, workspace: Path, timeout: float = 12.0) -> CommandResult:
    invocation = shell_command(lesson)
    if invocation is None:
        raise RuntimeError(f"Required shell is unavailable for {lesson.id}: {lesson.shell}")

    inherited_keys = (
        "COMSPEC",
        "PATHEXT",
        "PSModulePath",
        "SystemDrive",
        "SystemRoot",
        "WINDIR",
    )
    environment = {
        key: os.environ[key]
        for key in inherited_keys
        if key in os.environ
    }
    environment.update(
        {
            "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
            "HACKER_CLI_GYM": "1",
            "HOME": str(workspace),
            "USERPROFILE": str(workspace),
            "TEMP": str(workspace),
            "TMP": str(workspace),
            "LC_ALL": "C",
            "LANG": "C",
            "LESSSECURE": "1",
            "PAGER": "cat",
        }
    )
    try:
        completed = subprocess.run(
            [*invocation, command],
            cwd=workspace,
            env=environment,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        return CommandResult(
            stdout=(exc.stdout or "")[:16_000],
            stderr=(exc.stderr or "")[:16_000],
            returncode=124,
            timed_out=True,
        )
    return CommandResult(
        stdout=completed.stdout[:16_000],
        stderr=completed.stderr[:16_000],
        returncode=completed.returncode,
    )


def safe_workspace_path(workspace: Path, relative_path: str) -> Path:
    candidate = (workspace / relative_path).resolve()
    try:
        candidate.relative_to(workspace.resolve())
    except ValueError as exc:
        raise ValueError(f"path escapes practice workspace: {relative_path}") from exc
    return candidate


def seed_workspace(lesson: Lesson, workspace: Path) -> None:
    for relative_path in lesson.workspace_directories:
        safe_workspace_path(workspace, relative_path).mkdir(parents=True, exist_ok=True)
    for relative_path, contents in lesson.workspace_files.items():
        destination = safe_workspace_path(workspace, relative_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(contents, encoding="utf-8", newline="\n")


def normalize_text(text: str, mode: str = "trim") -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    if mode == "exact":
        return normalized
    if mode == "whitespace":
        return "\n".join(" ".join(line.split()) for line in normalized.strip().splitlines())
    return normalized.strip()


def _render_expected(value: str, workspace: Path) -> str:
    return value.replace("{{workspace}}", str(workspace))


def _read_workspace_text(candidate: Path) -> str:
    raw = candidate.read_bytes()
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return raw.decode("utf-16", errors="replace")
    return raw.decode("utf-8-sig", errors="replace")


def evaluate_check(check: Check, result: CommandResult, workspace: Path) -> CheckResult:
    config = check.config
    passed = False
    if check.kind == "stdout":
        expected = _render_expected(str(config.get("expected", "")), workspace)
        mode = str(config.get("normalize", "trim"))
        passed = normalize_text(result.stdout, mode) == normalize_text(expected, mode)
    elif check.kind == "stdout-unordered-lines":
        expected = _render_expected(str(config.get("expected", "")), workspace)
        actual_lines = sorted(
            line.strip() for line in normalize_text(result.stdout).splitlines() if line.strip()
        )
        expected_lines = sorted(
            line.strip() for line in normalize_text(expected).splitlines() if line.strip()
        )
        passed = actual_lines == expected_lines
    elif check.kind == "path-exists":
        candidate = safe_workspace_path(workspace, str(config["path"]))
        expected_kind = str(config.get("kind", "any"))
        passed = candidate.exists()
        if passed and expected_kind == "file":
            passed = candidate.is_file()
        elif passed and expected_kind == "directory":
            passed = candidate.is_dir()
    elif check.kind == "file-content":
        candidate = safe_workspace_path(workspace, str(config["path"]))
        if candidate.is_file():
            actual = _read_workspace_text(candidate)
            expected = str(config.get("expected", ""))
            passed = normalize_text(actual, str(config.get("normalize", "trim"))) == normalize_text(
                expected, str(config.get("normalize", "trim"))
            )
    elif check.kind == "file-mode":
        candidate = safe_workspace_path(workspace, str(config["path"]))
        if candidate.exists():
            actual_mode = stat.S_IMODE(candidate.stat().st_mode)
            passed = actual_mode == int(str(config["expected"]), 8)
    elif check.kind == "exit-code":
        passed = result.returncode == int(config["expected"])
    elif check.kind == "path-not-exists":
        candidate = safe_workspace_path(workspace, str(config["path"]))
        passed = not candidate.exists()
    elif check.kind == "stdout-contains":
        expected = _render_expected(str(config.get("expected", "")), workspace)
        passed = normalize_text(expected) in normalize_text(result.stdout)
    elif check.kind == "output-contains":
        expected = _render_expected(str(config.get("expected", "")), workspace)
        passed = normalize_text(expected) in normalize_text(
            f"{result.stdout}\n{result.stderr}"
        )
    elif check.kind == "stderr-contains":
        expected = _render_expected(str(config.get("expected", "")), workspace)
        passed = normalize_text(expected) in normalize_text(result.stderr)
    elif check.kind == "stdout-nonempty":
        passed = bool(normalize_text(result.stdout))
    elif check.kind == "stdout-regex":
        passed = bool(re.fullmatch(str(config["expected"]), normalize_text(result.stdout)))
    elif check.kind == "same-inode":
        first = safe_workspace_path(workspace, str(config["path"]))
        second = safe_workspace_path(workspace, str(config["other_path"]))
        passed = first.exists() and second.exists() and first.stat().st_ino == second.stat().st_ino
    elif check.kind == "same-owner":
        first = safe_workspace_path(workspace, str(config["path"]))
        second = safe_workspace_path(workspace, str(config["other_path"]))
        passed = first.exists() and second.exists() and first.stat().st_uid == second.stat().st_uid
    elif check.kind == "same-group":
        first = safe_workspace_path(workspace, str(config["path"]))
        second = safe_workspace_path(workspace, str(config["other_path"]))
        passed = first.exists() and second.exists() and first.stat().st_gid == second.stat().st_gid
    return CheckResult(description=check.description, passed=passed)


def evaluate_lesson(lesson: Lesson, result: CommandResult, workspace: Path) -> list[CheckResult]:
    return [evaluate_check(check, result, workspace) for check in lesson.checks]
