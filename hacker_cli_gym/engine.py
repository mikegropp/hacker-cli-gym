from __future__ import annotations

import shutil
import tempfile
from collections.abc import Callable
from pathlib import Path

from .execution import (
    UnsafeCommand,
    check_command,
    evaluate_lesson,
    run_command,
    seed_workspace,
)
from .models import Lesson
from .progress import ProgressStore, rank_for_level


Output = Callable[[str], None]
Input = Callable[[str], str]


def _emit_multiline(output: Output, text: str) -> None:
    for line in text.rstrip("\n").splitlines():
        output(line)


def show_example(lesson: Lesson, output: Output = print) -> None:
    output("\nEXAMPLE")
    output(f"  $ {lesson.example.command}")
    for item in lesson.example.breakdown:
        output(f"  - {item}")
    output("\nExample output:")
    if lesson.example.output:
        _emit_multiline(output, lesson.example.output)
    else:
        output("  (no output; the command changes workspace state)")


def _workspace_listing(workspace: Path) -> list[str]:
    items: list[str] = []
    for candidate in sorted(workspace.rglob("*")):
        relative = candidate.relative_to(workspace)
        marker = "/" if candidate.is_dir() else ""
        items.append(f"{relative}{marker}")
    return items


def run_lesson(
    lesson: Lesson,
    progress: ProgressStore,
    *,
    input_fn: Input = input,
    output: Output = print,
) -> bool:
    output("=" * 72)
    output(f"TOPIC: {lesson.command}")
    output(
        f"{lesson.title}  [{lesson.section} | rep {lesson.order:03d} | {lesson.difficulty}]"
    )
    output("=" * 72)
    output(lesson.about)
    if lesson.packages:
        output(f"Common package(s): {', '.join(lesson.packages)}")
    show_example(lesson, output)

    attempts = 0
    hints_used = 0
    with tempfile.TemporaryDirectory(prefix=f"hacker-cli-gym-{lesson.id}-") as temp_name:
        workspace = Path(temp_name).resolve()
        seed_workspace(lesson, workspace)
        output("\nYOUR REP")
        output(lesson.task.prompt)
        output(f"Practice directory: {workspace}")
        output("Type :hint, :example, :files, :reset, :skip, or :quit at any time.")

        while True:
            try:
                learner_input = input_fn("gym> ").strip()
            except (EOFError, KeyboardInterrupt):
                output("\nSession ended. No progress was recorded.")
                return False

            if learner_input in {":quit", "quit", "exit"}:
                output("Session ended. No progress was recorded.")
                return False
            if learner_input == ":skip":
                output("Rep skipped. No progress was recorded.")
                return False
            if learner_input == ":hint":
                if hints_used < len(lesson.task.hints):
                    output(f"Hint {hints_used + 1}: {lesson.task.hints[hints_used]}")
                    hints_used += 1
                else:
                    output("All hints have already been shown.")
                continue
            if learner_input == ":example":
                show_example(lesson, output)
                continue
            if learner_input == ":files":
                items = _workspace_listing(workspace)
                output("Workspace files:")
                for item in items or ["(empty)"]:
                    output(f"  {item}")
                continue
            if learner_input == ":reset":
                for candidate in sorted(workspace.iterdir()):
                    if candidate.is_dir():
                        shutil.rmtree(candidate)
                    else:
                        candidate.unlink()
                seed_workspace(lesson, workspace)
                output("Workspace reset to the start of the rep.")
                continue

            try:
                check_command(learner_input, lesson)
            except UnsafeCommand as exc:
                output(f"[blocked] {exc}")
                continue

            attempts += 1
            result = run_command(learner_input, lesson, workspace)
            output("\nOUTPUT")
            if result.stdout:
                _emit_multiline(output, result.stdout)
            else:
                output("(no stdout)")
            if result.stderr:
                output("\nSTDERR")
                _emit_multiline(output, result.stderr)
            output(f"[exit {result.returncode}]")
            if result.timed_out:
                output("The command exceeded the six-second practice limit.")

            checks = evaluate_lesson(lesson, result, workspace)
            output("\nCHECK")
            for check in checks:
                marker = "PASS" if check.passed else "TRY "
                output(f"[{marker}] {check.description}")
            if all(check.passed for check in checks):
                xp_gained = progress.mark_complete(
                    lesson.id,
                    attempts,
                    hints_used,
                    lesson.difficulty,
                )
                output("\nREP COMPLETE")
                output(lesson.completion)
                output(f"Attempts: {attempts} | Hints used: {hints_used}")
                if xp_gained:
                    output(
                        f"XP: +{xp_gained} | Total: {progress.total_xp} | "
                        f"Level {progress.level} {rank_for_level(progress.level)}"
                    )
                else:
                    output(f"XP: best score retained | Total: {progress.total_xp}")
                return True

            output("Not quite. Inspect the output, try again, or type :hint.")
