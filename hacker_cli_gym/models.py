from __future__ import annotations

from dataclasses import dataclass
from typing import Any


class LessonFormatError(ValueError):
    """Raised when a lesson file does not satisfy the content contract."""


def _required(mapping: dict[str, Any], key: str, owner: str) -> Any:
    if key not in mapping:
        raise LessonFormatError(f"{owner}: missing required field {key!r}")
    return mapping[key]


def _string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise LessonFormatError(f"{field}: expected a non-empty string")
    return value


def _string_list(value: Any, field: str, *, allow_empty: bool = False) -> tuple[str, ...]:
    if not isinstance(value, list) or (not value and not allow_empty):
        raise LessonFormatError(f"{field}: expected a non-empty list of strings")
    result = tuple(_string(item, field) for item in value)
    if len(result) != len(set(result)):
        raise LessonFormatError(f"{field}: duplicate values are not allowed")
    return result


@dataclass(frozen=True)
class Example:
    command: str
    output: str
    breakdown: tuple[str, ...]


@dataclass(frozen=True)
class Task:
    prompt: str
    hints: tuple[str, ...]


@dataclass(frozen=True)
class Check:
    kind: str
    description: str
    config: dict[str, Any]


@dataclass(frozen=True)
class Lesson:
    id: str
    order: int
    track: str
    section: str
    difficulty: str
    platforms: tuple[str, ...]
    shell: str
    command: str
    title: str
    about: str
    example: Example
    task: Task
    workspace_directories: tuple[str, ...]
    workspace_files: dict[str, str]
    allowed_commands: tuple[str, ...]
    allowed_operators: tuple[str, ...]
    packages: tuple[str, ...]
    checks: tuple[Check, ...]
    completion: str
    source: str

    @classmethod
    def from_dict(cls, data: Any, source: str) -> "Lesson":
        if not isinstance(data, dict):
            raise LessonFormatError(f"{source}: lesson root must be an object")

        lesson_id = _string(_required(data, "id", source), f"{source}.id")
        order = _required(data, "order", source)
        if not isinstance(order, int) or isinstance(order, bool) or order < 1:
            raise LessonFormatError(f"{source}.order: expected a positive integer")

        platforms = _string_list(
            _required(data, "platforms", source), f"{source}.platforms"
        )
        if set(platforms) != {"linux"}:
            raise LessonFormatError(
                f"{source}.platforms: this curriculum targets Linux only"
            )

        shell = _string(_required(data, "shell", source), f"{source}.shell")
        if shell != "posix":
            raise LessonFormatError(f"{source}.shell: unsupported shell {shell!r}")

        example_data = _required(data, "example", source)
        if not isinstance(example_data, dict):
            raise LessonFormatError(f"{source}.example: expected an object")
        example = Example(
            command=_string(
                _required(example_data, "command", f"{source}.example"),
                f"{source}.example.command",
            ),
            output=str(example_data.get("output", "")),
            breakdown=_string_list(
                _required(example_data, "breakdown", f"{source}.example"),
                f"{source}.example.breakdown",
            ),
        )

        task_data = _required(data, "task", source)
        if not isinstance(task_data, dict):
            raise LessonFormatError(f"{source}.task: expected an object")
        task = Task(
            prompt=_string(
                _required(task_data, "prompt", f"{source}.task"),
                f"{source}.task.prompt",
            ),
            hints=_string_list(
                _required(task_data, "hints", f"{source}.task"),
                f"{source}.task.hints",
            ),
        )

        workspace = _required(data, "workspace", source)
        if not isinstance(workspace, dict):
            raise LessonFormatError(f"{source}.workspace: expected an object")
        workspace_files = _required(workspace, "files", f"{source}.workspace")
        if not isinstance(workspace_files, dict):
            raise LessonFormatError(f"{source}.workspace.files: expected an object")
        parsed_files: dict[str, str] = {}
        for relative_path, contents in workspace_files.items():
            parsed_files[_string(relative_path, f"{source}.workspace.files path")] = str(
                contents
            )
        workspace_directories = _string_list(
            workspace.get("directories", []),
            f"{source}.workspace.directories",
            allow_empty=True,
        )

        checks_data = _required(data, "checks", source)
        if not isinstance(checks_data, list) or not checks_data:
            raise LessonFormatError(f"{source}.checks: expected a non-empty list")
        checks: list[Check] = []
        for index, raw_check in enumerate(checks_data):
            owner = f"{source}.checks[{index}]"
            if not isinstance(raw_check, dict):
                raise LessonFormatError(f"{owner}: expected an object")
            check_kind = _string(_required(raw_check, "type", owner), f"{owner}.type")
            description = _string(
                _required(raw_check, "description", owner), f"{owner}.description"
            )
            checks.append(
                Check(
                    kind=check_kind,
                    description=description,
                    config={
                        key: value
                        for key, value in raw_check.items()
                        if key not in {"type", "description"}
                    },
                )
            )

        return cls(
            id=lesson_id,
            order=order,
            track=_string(_required(data, "track", source), f"{source}.track"),
            section=_string(data.get("section", "foundations"), f"{source}.section"),
            difficulty=_string(
                data.get("difficulty", "foundation"), f"{source}.difficulty"
            ),
            platforms=platforms,
            shell=shell,
            command=_string(_required(data, "command", source), f"{source}.command"),
            title=_string(_required(data, "title", source), f"{source}.title"),
            about=_string(_required(data, "about", source), f"{source}.about"),
            example=example,
            task=task,
            workspace_directories=workspace_directories,
            workspace_files=parsed_files,
            allowed_commands=_string_list(
                _required(data, "allowed_commands", source),
                f"{source}.allowed_commands",
            ),
            allowed_operators=_string_list(
                data.get("allowed_operators", []),
                f"{source}.allowed_operators",
                allow_empty=True,
            ),
            packages=_string_list(
                data.get("packages", []),
                f"{source}.packages",
                allow_empty=True,
            ),
            checks=tuple(checks),
            completion=_string(
                _required(data, "completion", source), f"{source}.completion"
            ),
            source=source,
        )
