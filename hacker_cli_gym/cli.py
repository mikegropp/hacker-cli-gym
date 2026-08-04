from __future__ import annotations

import argparse
import os
import shlex
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from .content import compatible_lessons, current_platform, load_lessons
from .engine import run_lesson
from .execution import powershell_module_path, shell_command
from .models import Lesson, LessonFormatError
from .progress import XP_PER_LEVEL, ProgressStore, rank_for_level


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="hacker-cli-gym",
        description="Learn practical command-line skills one local rep at a time.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument(
        "--lessons-dir",
        type=Path,
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--progress-file",
        type=Path,
        help=argparse.SUPPRESS,
    )
    commands = parser.add_subparsers(dest="action")

    doctor = commands.add_parser("doctor", help="Check the local shells and lesson catalog.")
    doctor.set_defaults(handler=_doctor)

    list_command = commands.add_parser("list", help="List lessons for this operating system.")
    list_command.add_argument("--all", action="store_true", help="Include lessons for other operating systems.")
    list_command.set_defaults(handler=_list)

    start = commands.add_parser("start", help="Start the next unfinished compatible lesson.")
    start.set_defaults(handler=_start)

    daily = commands.add_parser("daily", help="Do one five-to-ten-minute daily rep.")
    daily.set_defaults(handler=_daily)

    sections = commands.add_parser("sections", help="List practice sections for this platform.")
    sections.set_defaults(handler=_sections)

    section = commands.add_parser("section", help="Run every unfinished rep in one section.")
    section.add_argument("section_id", help="Section id, such as 04-text-processing.")
    section.add_argument("--all", action="store_true", help="Repeat completed reps too.")
    section.set_defaults(handler=_section)

    run = commands.add_parser("run", help="Run a lesson by id.")
    run.add_argument("lesson_id")
    run.set_defaults(handler=_run)

    status = commands.add_parser("status", help="Show local completion progress.")
    status.set_defaults(handler=_status)

    reset = commands.add_parser("reset-progress", help="Delete local completion progress.")
    reset.add_argument("--yes", action="store_true", help="Confirm the reset without prompting.")
    reset.set_defaults(handler=_reset_progress)
    return parser


def _lesson_available(lesson: Lesson) -> bool:
    return current_platform() in lesson.platforms and shell_command(lesson) is not None


def _available_commands(lessons: list[Lesson]) -> set[str]:
    if not lessons:
        return set()
    invocation = shell_command(lessons[0])
    if invocation is None:
        return set()
    commands = sorted({lesson.command for lesson in lessons})
    if lessons[0].shell == "posix":
        rendered = " ".join(shlex.quote(command) for command in commands)
        probe = (
            f"for command in {rendered}; do "
            "if command -v \"$command\" >/dev/null 2>&1; then "
            "printf '%s\\n' \"$command\"; fi; done"
        )
    else:
        rendered = ", ".join(
            "'" + command.replace("'", "''") + "'" for command in commands
        )
        probe = (
            f"$commands = @({rendered}); foreach ($command in $commands) {{ "
            "if (Get-Command -Name $command -ErrorAction SilentlyContinue) { "
            "Write-Output $command } }"
        )
    environment = os.environ.copy()
    if lessons[0].shell == "powershell":
        for key in tuple(environment):
            if key.casefold() == "psmodulepath":
                environment.pop(key)
        environment["PSModulePath"] = powershell_module_path()
    try:
        result = subprocess.run(
            [*invocation, probe],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=environment,
            timeout=30,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return set()
    return {line.strip() for line in result.stdout.splitlines() if line.strip()}


def _doctor(args: argparse.Namespace, lessons: list[Lesson], progress: ProgressStore) -> int:
    del args, progress
    observed_platform = current_platform()
    compatible = compatible_lessons(lessons, observed_platform)
    print(f"Hacker CLI Gym {__version__}")
    print(f"Platform: {observed_platform}")
    print(f"Python: {sys.version.split()[0]}")
    if observed_platform == "linux":
        print(f"Bash: {shutil.which('bash') or 'not found'}")
    elif observed_platform == "windows":
        print(
            "Windows PowerShell: "
            f"{shutil.which('powershell.exe') or shutil.which('powershell') or 'not found'}"
        )
    print(f"Lessons: {len(lessons)} total, {len(compatible)} for this platform")
    unavailable = [lesson.id for lesson in compatible if not _lesson_available(lesson)]
    if unavailable:
        print("Unavailable because a required shell is missing:")
        for lesson_id in unavailable:
            print(f"  - {lesson_id}")
        return 1
    if compatible:
        available_commands = _available_commands(compatible)
        missing_commands = sorted(
            {lesson.command for lesson in compatible} - available_commands
        )
        if missing_commands:
            package_hints = sorted(
                {
                    package
                    for lesson in compatible
                    if lesson.command in missing_commands
                    for package in lesson.packages
                }
            )
            print("Missing commands:")
            print(f"  {', '.join(missing_commands)}")
            if package_hints:
                print(f"Common package names: {', '.join(package_hints)}")
            return 1
    elif observed_platform not in {"linux", "windows"}:
        print("Catalog is valid. Use Linux or Windows to run the native reps.")
        return 0
    print("Ready.")
    return 0


def _list(args: argparse.Namespace, lessons: list[Lesson], progress: ProgressStore) -> int:
    selected = lessons if args.all else compatible_lessons(lessons)
    if not selected:
        print("No matching lessons.")
        return 1
    current_track = None
    current_section = None
    for lesson in selected:
        if lesson.track != current_track:
            current_track = lesson.track
            print(f"\n{current_track.upper()}")
            current_section = None
        if lesson.section != current_section:
            current_section = lesson.section
            print(f"\n  {current_section}")
        completed = "done" if lesson.id in progress.completed_ids else "    "
        available = "" if _lesson_available(lesson) else " [other OS/shell]"
        print(f"    [{completed}] {lesson.order:03d}  {lesson.id:<28} {lesson.command}{available}")
    print()
    return 0


def _select_next(args: argparse.Namespace, lessons: list[Lesson], progress: ProgressStore) -> Lesson | None:
    selected = compatible_lessons(lessons)
    return next(
        (
            lesson
            for lesson in selected
            if lesson.id not in progress.completed_ids and _lesson_available(lesson)
        ),
        None,
    )


def _start(args: argparse.Namespace, lessons: list[Lesson], progress: ProgressStore) -> int:
    lesson = _select_next(args, lessons, progress)
    if lesson is None:
        print("No unfinished compatible lessons found. Use `list --all` to see every track.")
        return 0
    return 0 if run_lesson(lesson, progress) else 1


def _daily(args: argparse.Namespace, lessons: list[Lesson], progress: ProgressStore) -> int:
    lesson = _select_next(args, lessons, progress)
    if lesson is None:
        available = [lesson for lesson in compatible_lessons(lessons) if _lesson_available(lesson)]
        if not available:
            print("Daily reps require a supported native shell for this platform.")
            return 1
        day_index = datetime.now(timezone.utc).date().toordinal() % len(available)
        lesson = available[day_index]
        print("All platform reps are complete. Today's daily rep is a review round.")
    print(f"Daily rep: {lesson.id} ({lesson.command})")
    return 0 if run_lesson(lesson, progress) else 1


def _sections(args: argparse.Namespace, lessons: list[Lesson], progress: ProgressStore) -> int:
    del args
    selected = compatible_lessons(lessons)
    for section_id in dict.fromkeys(lesson.section for lesson in selected):
        section_lessons = [lesson for lesson in selected if lesson.section == section_id]
        completed = sum(lesson.id in progress.completed_ids for lesson in section_lessons)
        print(f"{section_id:<32} {completed}/{len(section_lessons)} complete")
    return 0


def _section(args: argparse.Namespace, lessons: list[Lesson], progress: ProgressStore) -> int:
    selected = [
        lesson
        for lesson in compatible_lessons(lessons)
        if lesson.section == args.section_id and _lesson_available(lesson)
    ]
    if not selected:
        print(f"Unknown or unavailable section: {args.section_id}", file=sys.stderr)
        return 2
    pending = selected if args.all else [
        lesson for lesson in selected if lesson.id not in progress.completed_ids
    ]
    if not pending:
        print(f"Section {args.section_id} is already complete. Add --all to repeat it.")
        return 0
    print(f"Starting {args.section_id}: {len(pending)} rep(s).")
    print("Every rep uses a disposable workspace that is removed when the rep ends.\n")
    for index, lesson in enumerate(pending, start=1):
        print(f"Section progress: {index}/{len(pending)}")
        if not run_lesson(lesson, progress):
            print("Section stopped. Completed reps remain recorded; temporary state was removed.")
            return 1
    print(f"Section complete: {args.section_id}")
    return 0


def _run(args: argparse.Namespace, lessons: list[Lesson], progress: ProgressStore) -> int:
    lesson = next((item for item in lessons if item.id == args.lesson_id), None)
    if lesson is None:
        print(f"Unknown lesson: {args.lesson_id}", file=sys.stderr)
        return 2
    if current_platform() not in lesson.platforms:
        supported = ", ".join(lesson.platforms)
        print(
            f"{lesson.id} requires {supported}; this machine is {current_platform()}.",
            file=sys.stderr,
        )
        return 2
    if shell_command(lesson) is None:
        print(f"Required shell is not installed: {lesson.shell}", file=sys.stderr)
        return 2
    return 0 if run_lesson(lesson, progress) else 1


def _status(args: argparse.Namespace, lessons: list[Lesson], progress: ProgressStore) -> int:
    del args
    compatible = compatible_lessons(lessons)
    completed = [lesson for lesson in compatible if lesson.id in progress.completed_ids]
    print(f"Completed {len(completed)} of {len(compatible)} lessons for {current_platform()}.")
    next_level_xp = progress.level * XP_PER_LEVEL
    print(
        f"Level {progress.level} {rank_for_level(progress.level)} | "
        f"{progress.total_xp} XP | {progress.streak_days}-day streak"
    )
    print(f"Next level: {max(0, next_level_xp - progress.total_xp)} XP to go")
    print(f"Progress file: {progress.path}")
    for track in sorted({lesson.track for lesson in compatible}):
        track_lessons = [lesson for lesson in compatible if lesson.track == track]
        track_done = [lesson for lesson in track_lessons if lesson.id in progress.completed_ids]
        print(f"  {track}: {len(track_done)}/{len(track_lessons)}")
    completed_sections = [
        section
        for section in dict.fromkeys(lesson.section for lesson in compatible)
        if all(
            lesson.id in progress.completed_ids
            for lesson in compatible
            if lesson.section == section
        )
    ]
    if completed_sections:
        print(f"Section badges: {', '.join(completed_sections)}")
    return 0


def _reset_progress(args: argparse.Namespace, lessons: list[Lesson], progress: ProgressStore) -> int:
    del lessons
    if not args.yes:
        reply = input(f"Delete progress at {progress.path}? [y/N] ").strip().casefold()
        if reply not in {"y", "yes"}:
            print("Reset cancelled.")
            return 1
    progress.reset()
    print("Progress reset.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    if not args.action:
        args = parser.parse_args(["start"])
    try:
        lessons = load_lessons(args.lessons_dir)
        progress = ProgressStore(args.progress_file)
        return int(args.handler(args, lessons, progress))
    except (LessonFormatError, RuntimeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
