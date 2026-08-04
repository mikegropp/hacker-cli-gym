from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


POINTS_BY_DIFFICULTY = {
    "foundation": 100,
    "intermediate": 140,
    "advanced": 180,
}
XP_PER_LEVEL = 500


def score_rep(difficulty: str, attempts: int, hints_used: int) -> int:
    base = POINTS_BY_DIFFICULTY.get(difficulty, 100)
    penalty = max(0, attempts - 1) * 10 + hints_used * 15
    return max(25, base - penalty)


def level_for_xp(xp: int) -> int:
    return xp // XP_PER_LEVEL + 1


def rank_for_level(level: int) -> str:
    if level >= 20:
        return "Shellsmith"
    if level >= 15:
        return "Administrator"
    if level >= 10:
        return "Operator"
    if level >= 5:
        return "Navigator"
    return "Rookie"


def default_progress_path() -> Path:
    override = os.environ.get("HACKER_CLI_GYM_PROGRESS")
    if override:
        return Path(override).expanduser()
    return Path.home() / ".hacker-cli-gym" / "progress.json"


class ProgressStore:
    def __init__(self, progress_path: Path | None = None) -> None:
        self.path = (progress_path or default_progress_path()).expanduser()
        self.data = self._load()

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"schema_version": 1, "completed": {}, "activity": []}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"cannot read progress file {self.path}: {exc}") from exc
        if data.get("schema_version") != 1 or not isinstance(data.get("completed"), dict):
            raise RuntimeError(f"unsupported or invalid progress file: {self.path}")
        if "activity" in data and not isinstance(data["activity"], list):
            raise RuntimeError(f"unsupported or invalid progress file: {self.path}")
        data.setdefault("activity", [])
        return data

    @property
    def completed_ids(self) -> set[str]:
        return set(self.data["completed"])

    @property
    def total_xp(self) -> int:
        return sum(int(record.get("points", 100)) for record in self.data["completed"].values())

    @property
    def level(self) -> int:
        return level_for_xp(self.total_xp)

    @property
    def streak_days(self) -> int:
        today = datetime.now(timezone.utc).date()
        completion_dates = {
            datetime.fromisoformat(str(record["completed_at"])).date()
            for record in self.data["completed"].values()
            if record.get("completed_at")
        }
        activity_dates = {
            datetime.fromisoformat(str(event["completed_at"])).date()
            for event in self.data.get("activity", [])
            if isinstance(event, dict) and event.get("completed_at")
        }
        dates = completion_dates | activity_dates
        if not dates:
            return 0
        cursor = today if today in dates else today.fromordinal(today.toordinal() - 1)
        if cursor not in dates:
            return 0
        streak = 0
        while cursor in dates:
            streak += 1
            cursor = cursor.fromordinal(cursor.toordinal() - 1)
        return streak

    def mark_complete(
        self,
        lesson_id: str,
        attempts: int,
        hints_used: int,
        difficulty: str = "foundation",
    ) -> int:
        now = datetime.now(timezone.utc).isoformat()
        previous = self.data["completed"].get(lesson_id, {})
        previous_points = int(previous.get("points", 0))
        points = max(previous_points, score_rep(difficulty, attempts, hints_used))
        self.data["completed"][lesson_id] = {
            "completed_at": previous.get("completed_at", now),
            "last_completed_at": now,
            "attempts": attempts,
            "hints_used": hints_used,
            "points": points,
        }
        self.data["activity"].append({"lesson_id": lesson_id, "completed_at": now})
        self.data["activity"] = self.data["activity"][-1000:]
        self._save()
        return points - previous_points

    def reset(self) -> None:
        self.data = {"schema_version": 1, "completed": {}, "activity": []}
        if self.path.exists():
            self.path.unlink()

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(self.data, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        temporary.replace(self.path)
