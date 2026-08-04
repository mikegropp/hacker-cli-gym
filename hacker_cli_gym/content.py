from __future__ import annotations

import json
import re
import sys
from pathlib import Path, PurePosixPath

from .models import Lesson, LessonFormatError


LESSON_ID = re.compile(r"^[a-z][a-z0-9]+(?:-[a-z0-9]+)*$")
SUPPORTED_CHECKS = {
    "stdout",
    "stdout-unordered-lines",
    "stdout-contains",
    "output-contains",
    "stderr-contains",
    "stdout-nonempty",
    "stdout-regex",
    "path-exists",
    "path-not-exists",
    "file-content",
    "file-mode",
    "same-inode",
    "same-owner",
    "same-group",
    "exit-code",
}


def default_lessons_dir() -> Path:
    return Path(__file__).resolve().parent / "lessons"


def current_platform() -> str:
    if sys.platform.startswith("linux"):
        return "linux"
    if sys.platform.startswith("win"):
        return "windows"
    return sys.platform


def _safe_relative_path(raw_path: str, source: str) -> None:
    posix = PurePosixPath(raw_path)
    if (
        posix.is_absolute()
        or ".." in re.split(r"[\\/]", raw_path)
        or raw_path.startswith(("~", "\\\\"))
        or re.match(r"^[A-Za-z]:[\\/]", raw_path)
    ):
        raise LessonFormatError(f"{source}: path must stay inside the practice workspace")


def validate_lesson(lesson: Lesson) -> None:
    if not LESSON_ID.fullmatch(lesson.id):
        raise LessonFormatError(f"{lesson.source}.id: invalid lesson id {lesson.id!r}")
    valid_native_pair = (
        lesson.shell == "posix" and set(lesson.platforms) == {"linux"}
    ) or (
        lesson.shell == "powershell" and set(lesson.platforms) == {"windows"}
    )
    if not valid_native_pair:
        raise LessonFormatError(
            f"{lesson.source}: shell and native platform do not match"
        )
    supported_operators = {"&&"} if lesson.shell == "posix" else {";"}
    if set(lesson.allowed_operators) - supported_operators:
        raise LessonFormatError(
            f"{lesson.source}: unsupported operator for {lesson.shell}"
        )
    for relative_path in (*lesson.workspace_directories, *lesson.workspace_files):
        _safe_relative_path(relative_path, f"{lesson.source}.workspace.files")
    for check in lesson.checks:
        if check.kind not in SUPPORTED_CHECKS:
            raise LessonFormatError(
                f"{lesson.source}: unsupported check type {check.kind!r}"
            )
        if "path" in check.config:
            _safe_relative_path(str(check.config["path"]), f"{lesson.source}.checks")
        if "other_path" in check.config:
            _safe_relative_path(
                str(check.config["other_path"]), f"{lesson.source}.checks"
            )


def _expand_catalog_lesson(
    raw: object,
    source: str,
    *,
    track: str,
    platforms: list[str],
    shell: str,
) -> Lesson:
    if not isinstance(raw, dict):
        raise LessonFormatError(f"{source}: compact lesson must be an object")
    required = (
        "id",
        "order",
        "section",
        "command",
        "title",
        "about",
        "example",
        "example_output",
        "breakdown",
        "task",
        "solution",
        "files",
        "allowed",
        "checks",
        "completion",
    )
    missing = [field for field in required if field not in raw]
    if missing:
        raise LessonFormatError(f"{source}: missing compact fields {missing}")
    hints = raw.get("hints", [])
    if not isinstance(hints, list):
        raise LessonFormatError(f"{source}.hints: expected a list")
    order = raw["order"]
    if isinstance(order, int) and not isinstance(order, bool):
        default_difficulty = (
            "foundation" if order <= 30 else "intermediate" if order <= 70 else "advanced"
        )
    else:
        default_difficulty = "foundation"
    full_lesson = {
        "id": raw["id"],
        "order": raw["order"],
        "track": track,
        "section": raw["section"],
        "difficulty": raw.get("difficulty", default_difficulty),
        "platforms": platforms,
        "shell": shell,
        "command": raw["command"],
        "title": raw["title"],
        "about": raw["about"],
        "example": {
            "command": raw["example"],
            "output": raw["example_output"],
            "breakdown": raw["breakdown"],
        },
        "task": {
            "prompt": raw["task"],
            "hints": [
                *hints,
                f"Type: {raw['solution']}",
            ],
        },
        "workspace": {
            "directories": raw.get("directories", []),
            "files": raw["files"],
        },
        "allowed_commands": raw["allowed"],
        "allowed_operators": raw.get("operators", []),
        "packages": raw.get("packages", []),
        "checks": raw["checks"],
        "completion": raw["completion"],
    }
    return Lesson.from_dict(full_lesson, source)


def load_lessons(lessons_dir: Path | None = None) -> list[Lesson]:
    content_dir = (lessons_dir or default_lessons_dir()).resolve()
    if not content_dir.is_dir():
        raise LessonFormatError(f"lesson directory does not exist: {content_dir}")

    lessons: list[Lesson] = []
    seen_ids: dict[str, str] = {}
    seen_order: dict[tuple[str, int], str] = {}
    for lesson_path in sorted(content_dir.rglob("*.json")):
        if lesson_path.name == "schema.json":
            continue
        try:
            raw_data = json.loads(lesson_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise LessonFormatError(f"{lesson_path}: cannot read lesson: {exc}") from exc
        if isinstance(raw_data, dict) and raw_data.get("catalog_version") == 1:
            track = str(raw_data.get("track", "linux"))
            platforms = raw_data.get("platforms", ["linux"])
            shell = str(raw_data.get("shell", "posix"))
            if not isinstance(platforms, list):
                raise LessonFormatError(f"{lesson_path}: platforms must be a list")
            raw_lessons = raw_data.get("lessons")
            if not isinstance(raw_lessons, list):
                raise LessonFormatError(f"{lesson_path}: lessons must be a list")
            parsed_lessons = [
                _expand_catalog_lesson(
                    item,
                    f"{lesson_path}#{index}",
                    track=track,
                    platforms=platforms,
                    shell=shell,
                )
                for index, item in enumerate(raw_lessons, start=1)
            ]
        else:
            parsed_lessons = [Lesson.from_dict(raw_data, str(lesson_path))]

        for lesson in parsed_lessons:
            validate_lesson(lesson)
            if lesson.id in seen_ids:
                raise LessonFormatError(
                    f"duplicate lesson id {lesson.id!r}: {seen_ids[lesson.id]} and {lesson.source}"
                )
            order_key = (lesson.track, lesson.order)
            if order_key in seen_order:
                raise LessonFormatError(
                    f"duplicate order {lesson.order} in track {lesson.track!r}: "
                    f"{seen_order[order_key]} and {lesson.source}"
                )
            seen_ids[lesson.id] = lesson.source
            seen_order[order_key] = lesson.source
            lessons.append(lesson)
    if not lessons:
        raise LessonFormatError(f"no lessons found under {content_dir}")
    return sorted(lessons, key=lambda item: (item.track, item.order, item.id))


def compatible_lessons(lessons: list[Lesson], platform_name: str | None = None) -> list[Lesson]:
    observed_platform = platform_name or current_platform()
    return [lesson for lesson in lessons if observed_platform in lesson.platforms]
