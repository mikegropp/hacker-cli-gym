from __future__ import annotations

import json
import tempfile
import unittest
from collections import Counter
from pathlib import Path

from hacker_cli_gym.content import compatible_lessons, load_lessons
from hacker_cli_gym.execution import (
    UnsafeCommand,
    check_command,
    evaluate_lesson,
    run_command,
    seed_workspace,
)
from hacker_cli_gym.progress import ProgressStore
from hacker_cli_gym.progress import level_for_xp, rank_for_level, score_rep


def reference_command(lesson) -> str:
    prefix = "Type: "
    for hint in reversed(lesson.task.hints):
        if hint.startswith(prefix):
            return hint[len(prefix) :]
    raise AssertionError(f"{lesson.id} does not end with a Type: reference hint")


class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.lessons = load_lessons()

    def test_catalog_is_exactly_100_linux_commands(self) -> None:
        self.assertEqual(100, len(self.lessons))
        self.assertEqual({"linux"}, {item.track for item in self.lessons})
        self.assertEqual({("linux",)}, {item.platforms for item in self.lessons})
        self.assertEqual({"posix"}, {item.shell for item in self.lessons})
        self.assertEqual(list(range(1, 101)), [item.order for item in self.lessons])
        self.assertEqual(100, len({item.id for item in self.lessons}))
        self.assertEqual(100, len({item.command for item in self.lessons}))

    def test_catalog_has_ten_balanced_sections(self) -> None:
        counts = Counter(item.section for item in self.lessons)
        self.assertEqual(10, len(counts))
        self.assertEqual({10}, set(counts.values()))

    def test_difficulty_increases_through_the_curriculum(self) -> None:
        counts = Counter(item.difficulty for item in self.lessons)
        self.assertEqual(
            {"foundation": 30, "intermediate": 40, "advanced": 30},
            dict(counts),
        )

    def test_every_lesson_has_instructional_content_and_reference_hint(self) -> None:
        for lesson in self.lessons:
            with self.subTest(lesson=lesson.id):
                self.assertGreaterEqual(len(lesson.about), 20)
                self.assertTrue(lesson.example.breakdown)
                self.assertGreaterEqual(len(lesson.task.hints), 2)
                self.assertTrue(reference_command(lesson))
                self.assertTrue(lesson.checks)

    def test_every_reference_solution_passes_the_command_guard(self) -> None:
        for lesson in self.lessons:
            with self.subTest(lesson=lesson.id):
                check_command(reference_command(lesson), lesson)

    def test_empty_directories_are_seeded(self) -> None:
        lesson = next(item for item in self.lessons if item.id == "linux-rmdir")
        with tempfile.TemporaryDirectory() as temp_name:
            workspace = Path(temp_name).resolve()
            seed_workspace(lesson, workspace)
            self.assertTrue((workspace / "retired").is_dir())
            self.assertEqual([], list((workspace / "retired").iterdir()))

    def test_every_linux_reference_solution_passes_in_bash(self) -> None:
        for lesson in compatible_lessons(self.lessons):
            with self.subTest(lesson=lesson.id):
                command = reference_command(lesson)
                check_command(command, lesson)
                with tempfile.TemporaryDirectory() as temp_name:
                    workspace = Path(temp_name).resolve()
                    seed_workspace(lesson, workspace)
                    result = run_command(command, lesson, workspace)
                    checks = evaluate_lesson(lesson, result, workspace)
                    failures = [item.description for item in checks if not item.passed]
                    self.assertFalse(
                        failures,
                        f"{lesson.id} failed: {failures}; stdout={result.stdout!r}; "
                        f"stderr={result.stderr!r}; exit={result.returncode}",
                    )


class GuardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.lessons = {item.id: item for item in load_lessons()}

    def test_allows_the_lesson_command(self) -> None:
        check_command("cut -d':' -f2 accounts.txt", self.lessons["linux-cut"])

    def test_blocks_an_unlisted_command(self) -> None:
        with self.assertRaises(UnsafeCommand):
            check_command("rm -rf .", self.lessons["linux-cut"])

    def test_blocks_unreviewed_chaining(self) -> None:
        with self.assertRaises(UnsafeCommand):
            check_command(
                "cut -d':' -f2 accounts.txt && rm accounts.txt",
                self.lessons["linux-cut"],
            )

    def test_blocks_command_substitution(self) -> None:
        with self.assertRaises(UnsafeCommand):
            check_command("cut -d':' -f2 $(pwd)", self.lessons["linux-cut"])

    def test_blocks_paths_outside_the_workspace(self) -> None:
        with self.assertRaises(UnsafeCommand):
            check_command("cat /etc/passwd", self.lessons["linux-cat"])
        with self.assertRaises(UnsafeCommand):
            check_command("chmod 000 ~/.ssh", self.lessons["linux-chmod"])
        with self.assertRaises(UnsafeCommand):
            check_command("cat note.txt > ../answer.txt", self.lessons["linux-cat"])

    def test_network_reps_are_offline_or_loopback_only(self) -> None:
        blocked = (
            ("linux-curl", "curl https://example.com"),
            ("linux-wget", "wget https://example.com/file"),
            ("linux-ping", "ping -c 1 8.8.8.8"),
            ("linux-ssh", "ssh example.com"),
            ("linux-scp", "scp file.txt host:/tmp/file.txt"),
            ("linux-rsync", "rsync -a source/ host:/tmp/"),
        )
        for lesson_id, command in blocked:
            with self.subTest(lesson=lesson_id), self.assertRaises(UnsafeCommand):
                check_command(command, self.lessons[lesson_id])

    def test_system_reps_cannot_change_host_state(self) -> None:
        blocked = (
            ("linux-kill", "kill 1"),
            ("linux-systemctl", "systemctl stop ssh"),
            ("linux-journalctl", "journalctl --vacuum-time=1s"),
            ("linux-tar", "tar --checkpoint-action=exec=sh -cf out.tar ."),
        )
        for lesson_id, command in blocked:
            with self.subTest(lesson=lesson_id), self.assertRaises(UnsafeCommand):
                check_command(command, self.lessons[lesson_id])

    def test_utility_extensions_cannot_launch_commands_or_write_external_paths(self) -> None:
        blocked = (
            ("linux-sed", "sed 's/DEBUG/id/e' config.txt"),
            ("linux-zip", "zip -TT 'sh' bundle.zip one.txt"),
            ("linux-sort", "sort -o/tmp/out hosts.txt"),
            ("linux-scp", "scp -Ssh artifact.txt staged.txt"),
            ("linux-rsync", "rsync -essh source/ destination/"),
        )
        for lesson_id, command in blocked:
            with self.subTest(lesson=lesson_id), self.assertRaises(UnsafeCommand):
                check_command(command, self.lessons[lesson_id])

    def test_wrapper_commands_cannot_launch_an_unlisted_program(self) -> None:
        with self.assertRaises(UnsafeCommand):
            check_command("timeout 1 bash", self.lessons["linux-timeout"])
        with self.assertRaises(UnsafeCommand):
            check_command("printf 'x\\n' | xargs sh", self.lessons["linux-xargs"])


class ProgressTests(unittest.TestCase):
    def test_scoring_levels_and_ranks(self) -> None:
        self.assertEqual(100, score_rep("foundation", attempts=1, hints_used=0))
        self.assertEqual(115, score_rep("intermediate", attempts=2, hints_used=1))
        self.assertEqual(3, level_for_xp(1000))
        self.assertEqual("Rookie", rank_for_level(3))
        self.assertEqual("Navigator", rank_for_level(5))

    def test_progress_round_trip_and_reset(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            progress_path = Path(temp_name) / "progress.json"
            store = ProgressStore(progress_path)
            store.mark_complete("linux-cut", attempts=2, hints_used=1)

            reloaded = ProgressStore(progress_path)
            self.assertIn("linux-cut", reloaded.completed_ids)
            record = reloaded.data["completed"]["linux-cut"]
            self.assertEqual(2, record["attempts"])
            self.assertEqual(1, record["hints_used"])
            self.assertEqual(75, record["points"])
            self.assertEqual(75, reloaded.total_xp)
            self.assertEqual(1, len(reloaded.data["activity"]))

            reloaded.reset()
            self.assertFalse(progress_path.exists())
            self.assertEqual(set(), reloaded.completed_ids)

    def test_saved_progress_is_valid_json(self) -> None:
        with tempfile.TemporaryDirectory() as temp_name:
            progress_path = Path(temp_name) / "progress.json"
            store = ProgressStore(progress_path)
            store.mark_complete("linux-pwd", attempts=1, hints_used=0)
            data = json.loads(progress_path.read_text(encoding="utf-8"))
            self.assertEqual(1, data["schema_version"])


if __name__ == "__main__":
    unittest.main()
