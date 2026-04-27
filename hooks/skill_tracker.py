#!/usr/bin/env python3
"""
Claude Code PreToolUse Hook - Skill Usage Tracker

Intercepts Skill tool invocations and records usage statistics.
Designed to run silently - any error is logged, never propagated.
"""

import sys
import json
import csv
import os
import platform
from pathlib import Path
from datetime import datetime, date

# -- Paths (relative to this script) -----------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
STATS_FILE = DATA_DIR / "stats.csv"
CONFIG_FILE = DATA_DIR / "config.json"
LOCK_FILE = DATA_DIR / ".lock"
LOG_FILE = PROJECT_ROOT / "logs" / "tracker.log"


# -- Cross-platform file locking ---------------------------------------------
def _lock(f):
    """Acquire an exclusive lock on file handle f."""
    if platform.system() == "Windows":
        import msvcrt
        msvcrt.locking(f.fileno(), msvcrt.LK_LOCK, 1)
    else:
        import fcntl
        fcntl.flock(f, fcntl.LOCK_EX)


def _unlock(f):
    """Release file lock on handle f."""
    if platform.system() == "Windows":
        import msvcrt
        try:
            msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
        except OSError:
            pass
    else:
        import fcntl
        fcntl.flock(f, fcntl.LOCK_UN)


# -- Logging ------------------------------------------------------------------
def _log_error(msg: str) -> None:
    """Append error to log file. Never raises."""
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] ERROR: {msg}\n")
    except Exception:
        pass


# -- Skill name extraction ----------------------------------------------------
def extract_skill_name(data: dict) -> str:
    """Extract skill name from hook payload, handling various formats."""
    tool_input = data.get("tool_input", {})

    # tool_input might arrive as a JSON string
    if isinstance(tool_input, str):
        try:
            tool_input = json.loads(tool_input)
        except (json.JSONDecodeError, TypeError):
            return ""

    if isinstance(tool_input, dict):
        for key in ("skill", "skill_name", "name"):
            val = tool_input.get(key, "")
            if isinstance(val, str) and val.strip():
                return val.strip()

    return ""


# -- Stats update --------------------------------------------------------------
def update_stats(skill_name: str) -> None:
    """Increment today's count for the given skill in stats.csv."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    today = date.today().isoformat()
    rows = []
    updated = False

    if not STATS_FILE.exists():
        STATS_FILE.write_text("date,skill_name,count\n", encoding="utf-8")

    with open(STATS_FILE, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("date") == today and row.get("skill_name") == skill_name:
                row["count"] = str(int(row.get("count", 0)) + 1)
                updated = True
            rows.append(row)

    if not updated:
        rows.append({"date": today, "skill_name": skill_name, "count": "1"})

    tmp = STATS_FILE.with_suffix(".tmp")
    with open(tmp, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "skill_name", "count"])
        writer.writeheader()
        writer.writerows(rows)
    os.replace(str(tmp), str(STATS_FILE))


# -- Config auto-register ------------------------------------------------------
def ensure_skill_in_config(skill_name: str) -> None:
    """Register a newly-seen skill in config.json if not already present."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            config = json.load(f)
    else:
        config = _default_config()

    if skill_name in config.get("skills", {}):
        return
    if skill_name in config.get("trash", {}):
        return

    now = datetime.now().isoformat(timespec="seconds")
    display_name = skill_name.replace("-", " ").replace("_", " ").title()

    config.setdefault("skills", {})[skill_name] = {
        "name": skill_name,
        "display_name": display_name,
        "description": "",
        "enabled": True,
        "tags": [],
        "created_at": now,
        "updated_at": now,
    }

    groups = config.setdefault("groups", {})
    ungrouped = groups.setdefault("ungrouped", {
        "name": "ungrouped",
        "display_name": "Ungrouped",
        "color": "#888888",
        "order": 999,
        "skills": [],
    })
    if skill_name not in ungrouped.get("skills", []):
        ungrouped.setdefault("skills", []).append(skill_name)

    tmp = CONFIG_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    os.replace(str(tmp), str(CONFIG_FILE))


def _default_config() -> dict:
    return {
        "version": "1.0",
        "meta": {"skills_dir": "", "installed_at": ""},
        "groups": {
            "ungrouped": {
                "name": "ungrouped",
                "display_name": "Ungrouped",
                "color": "#888888",
                "order": 999,
                "skills": [],
            }
        },
        "skills": {},
        "trash": {},
    }


# -- Main entry ----------------------------------------------------------------
def main() -> None:
    try:
        raw = sys.stdin.read()
    except Exception:
        return

    if not raw or not raw.strip():
        return

    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return

    if data.get("tool_name") != "Skill":
        return

    skill_name = extract_skill_name(data)
    if not skill_name:
        _log_error(f"Could not extract skill name from: {json.dumps(data)[:200]}")
        return

    # Acquire file lock before writing
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    lock_fh = open(LOCK_FILE, "w")
    try:
        _lock(lock_fh)
        update_stats(skill_name)
        ensure_skill_in_config(skill_name)
    finally:
        _unlock(lock_fh)
        lock_fh.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        _log_error(f"Unhandled: {type(e).__name__}: {e}")
    finally:
        sys.exit(0)  # CRITICAL: never block Claude Code
