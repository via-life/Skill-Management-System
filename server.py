#!/usr/bin/env python3
"""
Skill Management System - HTTP Server + REST API

Pure Python stdlib server. No external dependencies.
Serves dashboard and provides CRUD APIs for skills, groups, trash, operations, stats.
"""

import json
import csv
import os
import re
import sys
import shutil
import random
import subprocess
import zipfile
import threading
from pathlib import Path
from datetime import datetime, date, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote

PORT = 3000
PROJECT_ROOT = Path(__file__).resolve().parent
DATA_DIR = PROJECT_ROOT / "data"
CONFIG_FILE = DATA_DIR / "config.json"
STATS_FILE = DATA_DIR / "stats.csv"
OPLOG_FILE = DATA_DIR / "operation_log.json"
TRASH_DIR = DATA_DIR / "trash"
DASHBOARD_FILE = PROJECT_ROOT / "dashboard" / "index.html"
DASHBOARD_DIST = PROJECT_ROOT / "dashboard" / "dist"
LOG_FILE = PROJECT_ROOT / "logs" / "server.log"

MAX_OPERATIONS = 500
TRASH_MAX_DAYS = 30

_data_lock = threading.Lock()


# =============================================================================
# Data helpers
# =============================================================================

def _read_config() -> dict:
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return _default_config()


def _write_config(config: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
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


def _read_oplog() -> list:
    if OPLOG_FILE.exists():
        with open(OPLOG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def _write_oplog(ops: list) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Enforce limit
    if len(ops) > MAX_OPERATIONS:
        ops = ops[-MAX_OPERATIONS:]
    tmp = OPLOG_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(ops, f, indent=2, ensure_ascii=False)
    os.replace(str(tmp), str(OPLOG_FILE))


def _add_operation(action: str, target_type: str, target_name: str,
                   group: str = "", before=None, after=None) -> dict:
    ops = _read_oplog()
    now = datetime.now()
    op_id = f"op_{now.strftime('%Y%m%d%H%M%S')}_{random.randint(0, 0xFFFF):04x}"
    entry = {
        "id": op_id,
        "timestamp": now.isoformat(timespec="seconds"),
        "action": action,
        "target_type": target_type,
        "target_name": target_name,
        "group": group,
        "before": before,
        "after": after,
        "undone": False,
    }
    ops.append(entry)
    _write_oplog(ops)
    return entry


def _read_stats(days=None) -> list:
    rows = []
    if not STATS_FILE.exists():
        return rows
    cutoff = None
    if days is not None:
        cutoff = (date.today() - timedelta(days=int(days))).isoformat()
    with open(STATS_FILE, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if cutoff and row.get("date", "") < cutoff:
                continue
            row["count"] = int(row.get("count", 0))
            rows.append(row)
    return rows


def _get_skills_dir(config: dict) -> Path:
    sd = config.get("meta", {}).get("skills_dir", "")
    if sd:
        return Path(sd)
    # Fallback
    home = Path.home()
    return home / ".claude" / "skills"


def _find_skill_group(config: dict, skill_name: str) -> str:
    for gname, gdata in config.get("groups", {}).items():
        if skill_name in gdata.get("skills", []):
            return gname
    return "ungrouped"


def _build_file_tree(dir_path: Path) -> list:
    """Recursively build a file tree structure."""
    tree = []
    if not dir_path.exists() or not dir_path.is_dir():
        return tree
    try:
        entries = sorted(dir_path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    except PermissionError:
        return tree
    for entry in entries:
        if entry.name.startswith("."):
            continue
        if entry.is_dir():
            tree.append({
                "type": "dir",
                "name": entry.name,
                "children": _build_file_tree(entry),
            })
        else:
            try:
                size = entry.stat().st_size
            except OSError:
                size = 0
            tree.append({
                "type": "file",
                "name": entry.name,
                "size": size,
            })
    return tree


def _cleanup_trash(config: dict) -> bool:
    """Remove trash entries older than TRASH_MAX_DAYS. Returns True if config changed."""
    trash = config.get("trash", {})
    now = datetime.now()
    to_remove = []
    for name, item in trash.items():
        deleted_at_str = item.get("deleted_at", "")
        if not deleted_at_str:
            continue
        try:
            deleted_at = datetime.fromisoformat(deleted_at_str)
        except (ValueError, TypeError):
            continue
        if (now - deleted_at).days > TRASH_MAX_DAYS:
            to_remove.append(name)

    if not to_remove:
        return False

    for name in to_remove:
        item = trash.pop(name, {})
        backup = item.get("backup_path", "")
        if backup:
            bp = PROJECT_ROOT / backup
            if bp.exists():
                shutil.rmtree(str(bp), ignore_errors=True)
        _add_operation("permanent_delete", "skill", name, before=item)

    return True


def _parse_skill_md_frontmatter(skill_dir: Path) -> dict:
    """Parse SKILL.md frontmatter for name and description."""
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return {}
    try:
        content = skill_md.read_text(encoding="utf-8")
    except Exception:
        return {}

    result = {}
    # Simple frontmatter parser
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            fm = content[3:end]
            for line in fm.strip().splitlines():
                if ":" in line:
                    key, _, val = line.partition(":")
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key == "name":
                        result["name"] = val
                    elif key == "description":
                        result["description"] = val
    return result


def _write_skill_md(skill_dir: Path, name: str, description: str) -> None:
    """Write a minimal SKILL.md with frontmatter."""
    skill_md = skill_dir / "SKILL.md"
    content = f"""---
name: {name}
description: {description}
---

# {name.replace('-', ' ').replace('_', ' ').title()}

{description}
"""
    skill_md.write_text(content, encoding="utf-8")


def _update_skill_md_frontmatter(skill_dir: Path, name: str, description: str) -> None:
    """Update SKILL.md frontmatter in-place, preserving body content."""
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        _write_skill_md(skill_dir, name, description)
        return

    content = skill_md.read_text(encoding="utf-8")
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            body = content[end + 3:].lstrip("\n")
            new_content = f"---\nname: {name}\ndescription: {description}\n---\n\n{body}"
            skill_md.write_text(new_content, encoding="utf-8")
            return

    # No existing frontmatter, prepend
    new_content = f"---\nname: {name}\ndescription: {description}\n---\n\n{content}"
    skill_md.write_text(new_content, encoding="utf-8")


# =============================================================================
# Import & Skills-tree helpers
# =============================================================================

IMPORT_TMP = DATA_DIR / ".import_tmp"


def _classify_entry(entry_path: Path) -> str:
    """Returns 'skill', 'pack', or 'ignore'."""
    if not entry_path.is_dir():
        return "ignore"
    if (entry_path / "SKILL.md").exists():
        return "skill"
    for child in entry_path.iterdir():
        if child.is_dir() and (child / "SKILL.md").exists():
            return "pack"
    return "ignore"


def _get_skill_paths(config: dict) -> list:
    """Return list of {path, type} from config."""
    paths = []
    # Global
    sd = _get_skills_dir(config)
    paths.append({"path": str(sd), "type": "global"})
    # User-defined extra paths
    for sp in config.get("meta", {}).get("skill_paths", []):
        p = sp.get("path", "")
        if p and p != str(sd):
            paths.append({"path": p, "type": sp.get("type", "project")})
    return paths


def _build_skills_tree(config: dict) -> list:
    """Build the 3-level tree: paths → entries (skill|pack) → sub-skills."""
    all_stats = _read_stats()
    # Aggregate stats by skill
    count_map = {}
    for row in all_stats:
        sn = row.get("skill_name", "")
        count_map[sn] = count_map.get(sn, 0) + row.get("count", 0)

    skill_paths = _get_skill_paths(config)
    result = []

    for sp in skill_paths:
        p = Path(sp["path"])
        path_info = {
            "path": sp["path"],
            "type": sp["type"],
            "label": f"{'Global' if sp['type']=='global' else 'Project'} ({sp['path']})",
            "writable": os.access(str(p), os.W_OK) if p.exists() else False,
            "exists": p.exists(),
            "entries": [],
        }

        if not p.exists():
            result.append(path_info)
            continue

        try:
            entries_list = sorted(p.iterdir(), key=lambda x: x.name.lower())
        except PermissionError:
            result.append(path_info)
            continue

        for entry in entries_list:
            if not entry.is_dir() or entry.name.startswith("."):
                continue
            kind = _classify_entry(entry)
            if kind == "skill":
                fm = _parse_skill_md_frontmatter(entry)
                sk_config = config.get("skills", {}).get(entry.name, {})
                path_info["entries"].append({
                    "kind": "skill",
                    "name": entry.name,
                    "display_name": sk_config.get("display_name", fm.get("name", entry.name)),
                    "description": sk_config.get("description", fm.get("description", "")),
                    "enabled": sk_config.get("enabled", True),
                    "tags": sk_config.get("tags", []),
                    "total_count": count_map.get(entry.name, 0),
                    "dir_path": str(entry),
                })
            elif kind == "pack":
                pack_skills = []
                for child in sorted(entry.iterdir(), key=lambda x: x.name.lower()):
                    if child.is_dir() and (child / "SKILL.md").exists():
                        cfm = _parse_skill_md_frontmatter(child)
                        csk = config.get("skills", {}).get(child.name, {})
                        pack_skills.append({
                            "kind": "skill",
                            "name": child.name,
                            "display_name": csk.get("display_name", cfm.get("name", child.name)),
                            "description": csk.get("description", cfm.get("description", "")),
                            "enabled": csk.get("enabled", True),
                            "tags": csk.get("tags", []),
                            "total_count": count_map.get(child.name, 0),
                            "dir_path": str(child),
                        })
                path_info["entries"].append({
                    "kind": "pack",
                    "name": entry.name,
                    "dir_path": str(entry),
                    "skills": pack_skills,
                })
        result.append(path_info)
    return result


def _is_git_url(url: str) -> bool:
    return bool(re.match(r"^https?://(github\.com|gitlab\.com|gitee\.com|bitbucket\.org)/", url))


def _is_local_path(url: str) -> bool:
    # Windows absolute (C:\ or C:/) or Unix absolute (/)
    if re.match(r"^[A-Za-z]:[/\\]", url) or url.startswith("/"):
        return True
    return False


def _normalize_git_url(url: str) -> tuple:
    """Return (clone_url, sub_path) from various Git URL formats."""
    # GitHub/GitLab tree URL: https://github.com/user/repo/tree/branch/path
    m = re.match(r"^(https?://[^/]+/[^/]+/[^/]+)/tree/[^/]+/(.+)$", url)
    if m:
        return m.group(1) + ".git", m.group(2)
    # Plain repo URL
    m = re.match(r"^(https?://[^/]+/[^/]+/[^/]+)(?:\.git)?/?$", url)
    if m:
        repo = m.group(1)
        if not repo.endswith(".git"):
            repo += ".git"
        return repo, ""
    return url, ""


def _scan_skills_in_dir(base_dir: Path, root_dir: Path) -> list:
    """Recursively find all SKILL.md entries under base_dir."""
    skills = []
    if not base_dir.exists():
        return skills
    # If base_dir itself has SKILL.md
    if (base_dir / "SKILL.md").exists():
        fm = _parse_skill_md_frontmatter(base_dir)
        rel = str(base_dir.relative_to(root_dir)).replace("\\", "/")
        files_count = sum(1 for _ in base_dir.rglob("*") if _.is_file())
        total_size = sum(f.stat().st_size for f in base_dir.rglob("*") if f.is_file())
        skills.append({
            "name": fm.get("name", base_dir.name),
            "description": fm.get("description", ""),
            "path_in_source": rel if rel != "." else "",
            "files_count": files_count,
            "total_size": total_size,
        })
        return skills  # Don't recurse into a skill

    # Check subdirectories
    try:
        for child in sorted(base_dir.iterdir(), key=lambda x: x.name.lower()):
            if child.is_dir() and not child.name.startswith("."):
                skills.extend(_scan_skills_in_dir(child, root_dir))
    except PermissionError:
        pass
    return skills


def _cleanup_import_tmp():
    """Remove all temporary import directories."""
    if IMPORT_TMP.exists():
        shutil.rmtree(str(IMPORT_TMP), ignore_errors=True)


# =============================================================================
# HTTP Handler
# =============================================================================

class SkillHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        ts = datetime.now().strftime("%H:%M:%S")
        sys.stderr.write(f"[{ts}] {args[0] if args else ''}\n")

    # -- Response helpers --

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, msg, status=400):
        self._send_json({"error": msg}, status)

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    # -- Routing --

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path).rstrip("/") or "/"
        params = parse_qs(parsed.query)

        if path == "/":
            return self._serve_html()

        # /api/skills
        if path == "/api/skills":
            return self._handle_get_skills()
        if path == "/api/skills-tree":
            return self._handle_get_skills_tree()
        if path == "/api/skills-dirs":
            return self._handle_get_skills_dirs()

        # /api/skills/<name>
        m = re.match(r"^/api/skills/([^/]+)$", path)
        if m:
            return self._handle_get_skill(m.group(1))

        # /api/skills/<name>/files
        m = re.match(r"^/api/skills/([^/]+)/files$", path)
        if m:
            return self._handle_get_skill_files(m.group(1))

        # /api/skills/<name>/files/<path>
        m = re.match(r"^/api/skills/([^/]+)/files/(.+)$", path)
        if m:
            return self._handle_get_skill_file_content(m.group(1), m.group(2))

        if path == "/api/trash":
            return self._handle_get_trash()
        if path == "/api/groups":
            return self._handle_get_groups()
        if path == "/api/operations":
            return self._handle_get_operations(params)

        if path == "/api/stats":
            return self._handle_get_stats(params)
        if path == "/api/stats/summary":
            return self._handle_get_stats_summary(params)
        if path == "/api/stats/today":
            return self._handle_get_stats_today()
        if path == "/api/stats/trend":
            return self._handle_get_stats_trend(params)

        # Static files from dashboard/dist/ (Vite build output)
        if not path.startswith("/api/"):
            return self._serve_static(path.lstrip("/"))

        self._send_error("Not found", 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path).rstrip("/")
        body = self._read_body()

        if path == "/api/skills":
            return self._handle_create_skill(body)
        if path == "/api/groups":
            return self._handle_create_group(body)
        if path == "/api/import/probe":
            return self._handle_import_probe(body)
        if path == "/api/import/install":
            return self._handle_import_install(body)
        if path == "/api/import/cleanup":
            return self._handle_import_cleanup(body)
        if path == "/api/skills-dirs":
            return self._handle_add_skill_path(body)

        # /api/trash/<name>/restore
        m = re.match(r"^/api/trash/([^/]+)/restore$", path)
        if m:
            return self._handle_restore_trash(m.group(1))

        # /api/operations/<id>/undo
        m = re.match(r"^/api/operations/([^/]+)/undo$", path)
        if m:
            return self._handle_undo_operation(m.group(1))

        self._send_error("Not found", 404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path).rstrip("/")
        body = self._read_body()

        # /api/skills/<name>/group
        m = re.match(r"^/api/skills/([^/]+)/group$", path)
        if m:
            return self._handle_move_skill_group(m.group(1), body)

        # /api/skills/<name>
        m = re.match(r"^/api/skills/([^/]+)$", path)
        if m:
            return self._handle_update_skill(m.group(1), body)

        # /api/groups/<name>
        m = re.match(r"^/api/groups/([^/]+)$", path)
        if m:
            return self._handle_update_group(m.group(1), body)

        self._send_error("Not found", 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path).rstrip("/")

        # /api/trash (clear all)
        if path == "/api/trash":
            return self._handle_clear_trash()

        # /api/trash/<name>
        m = re.match(r"^/api/trash/([^/]+)$", path)
        if m:
            return self._handle_permanent_delete(m.group(1))

        # /api/skills/<name>
        m = re.match(r"^/api/skills/([^/]+)$", path)
        if m:
            return self._handle_delete_skill(m.group(1))

        # /api/groups/<name>
        m = re.match(r"^/api/groups/([^/]+)$", path)
        if m:
            return self._handle_delete_group(m.group(1))

        # /api/skills-dirs/<encoded_path>
        m = re.match(r"^/api/skills-dirs/(.+)$", path)
        if m:
            return self._handle_remove_skill_path(m.group(1))

        self._send_error("Not found", 404)

    # -- Static --

    def _serve_html(self):
        # Try Vite dist/ first, fallback to legacy index.html
        dist_index = DASHBOARD_DIST / "index.html"
        target = dist_index if dist_index.exists() else DASHBOARD_FILE
        if not target.exists():
            self._send_error("Dashboard not found. Run: cd dashboard && npm run build", 404)
            return
        body = target.read_bytes()
        self.send_response(200)
        self._cors_headers()
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    MIME_TYPES = {
        '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
        '.mjs': 'application/javascript', '.json': 'application/json',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
        '.glb': 'model/gltf-binary', '.wasm': 'application/wasm',
        '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
    }

    def _serve_static(self, file_path):
        """Serve a static file from dashboard/dist/."""
        full_path = (DASHBOARD_DIST / file_path).resolve()
        # Security: must be within dist/
        if not str(full_path).startswith(str(DASHBOARD_DIST.resolve())):
            self._send_error("Access denied", 403)
            return
        if not full_path.exists() or not full_path.is_file():
            # SPA fallback: serve index.html for non-API, non-asset routes
            return self._serve_html()
        body = full_path.read_bytes()
        ext = full_path.suffix.lower()
        mime = self.MIME_TYPES.get(ext, 'application/octet-stream')
        self.send_response(200)
        self._cors_headers()
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        if ext in ('.js', '.css', '.woff2', '.glb', '.wasm'):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        self.end_headers()
        self.wfile.write(body)

    # =========================================================================
    # Skills CRUD
    # =========================================================================

    def _handle_get_skills(self):
        with _data_lock:
            config = _read_config()
        skills = config.get("skills", {})
        groups = config.get("groups", {})
        self._send_json({"skills": skills, "groups": groups})

    def _handle_get_skill(self, name):
        with _data_lock:
            config = _read_config()
        skill = config.get("skills", {}).get(name)
        if not skill:
            return self._send_error("Skill not found", 404)
        skills_dir = _get_skills_dir(config)
        skill_path = skills_dir / name
        tree = _build_file_tree(skill_path) if skill_path.exists() else []
        group = _find_skill_group(config, name)
        self._send_json({
            "skill": skill,
            "group": group,
            "path": str(skill_path),
            "tree": tree,
        })

    def _handle_get_skill_files(self, name):
        with _data_lock:
            config = _read_config()
        if name not in config.get("skills", {}):
            return self._send_error("Skill not found", 404)
        skills_dir = _get_skills_dir(config)
        skill_path = skills_dir / name
        tree = _build_file_tree(skill_path) if skill_path.exists() else []
        self._send_json({
            "name": name,
            "path": str(skill_path),
            "tree": tree,
        })

    def _handle_get_skill_file_content(self, skill_name, file_path):
        with _data_lock:
            config = _read_config()
        if skill_name not in config.get("skills", {}):
            return self._send_error("Skill not found", 404)
        skills_dir = _get_skills_dir(config)
        full_path = (skills_dir / skill_name / file_path).resolve()
        # Security: ensure path is within skill directory
        skill_root = (skills_dir / skill_name).resolve()
        if not str(full_path).startswith(str(skill_root)):
            return self._send_error("Access denied", 403)
        if not full_path.exists() or not full_path.is_file():
            return self._send_error("File not found", 404)
        try:
            content = full_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = "(Binary file - cannot display)"
        except Exception as e:
            return self._send_error(str(e), 500)
        self._send_json({
            "name": full_path.name,
            "path": file_path,
            "content": content,
            "size": full_path.stat().st_size,
        })

    def _handle_create_skill(self, body):
        name = body.get("name", "").strip()
        if not name:
            return self._send_error("name is required")
        if not re.match(r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$", name):
            return self._send_error("name must be alphanumeric with - _ .")

        with _data_lock:
            config = _read_config()
            if name in config.get("skills", {}):
                return self._send_error("Skill already exists", 409)

            skills_dir = _get_skills_dir(config)
            skill_path = skills_dir / name

            # Create real directory
            skill_path.mkdir(parents=True, exist_ok=True)
            desc = body.get("description", "")
            _write_skill_md(skill_path, name, desc)

            now = datetime.now().isoformat(timespec="seconds")
            display_name = body.get("display_name", "").strip()
            if not display_name:
                display_name = name.replace("-", " ").replace("_", " ").title()

            skill_data = {
                "name": name,
                "display_name": display_name,
                "description": desc,
                "enabled": body.get("enabled", True),
                "tags": body.get("tags", []),
                "created_at": now,
                "updated_at": now,
            }
            config.setdefault("skills", {})[name] = skill_data

            # Add to group
            group_name = body.get("group", "ungrouped")
            groups = config.setdefault("groups", {})
            if group_name not in groups:
                group_name = "ungrouped"
            groups.setdefault(group_name, {
                "name": group_name,
                "display_name": "Ungrouped",
                "color": "#888888",
                "order": 999,
                "skills": [],
            })
            if name not in groups[group_name].get("skills", []):
                groups[group_name].setdefault("skills", []).append(name)

            _write_config(config)
            _add_operation("create", "skill", name, group=group_name, after=skill_data)

        self._send_json({"skill": skill_data, "message": "Created"}, 201)

    def _handle_update_skill(self, name, body):
        with _data_lock:
            config = _read_config()
            skills = config.get("skills", {})
            if name not in skills:
                return self._send_error("Skill not found", 404)

            old = dict(skills[name])
            group = _find_skill_group(config, name)

            # Update allowed fields
            for field in ("display_name", "description", "enabled", "tags"):
                if field in body:
                    skills[name][field] = body[field]
            skills[name]["updated_at"] = datetime.now().isoformat(timespec="seconds")

            # Sync SKILL.md frontmatter
            skills_dir = _get_skills_dir(config)
            skill_path = skills_dir / name
            if skill_path.exists():
                _update_skill_md_frontmatter(
                    skill_path, name,
                    skills[name].get("description", "")
                )

            _write_config(config)
            _add_operation("update", "skill", name, group=group,
                           before=old, after=dict(skills[name]))

        self._send_json({"skill": skills[name], "message": "Updated"})

    def _handle_delete_skill(self, name):
        with _data_lock:
            config = _read_config()
            skills = config.get("skills", {})
            if name not in skills:
                return self._send_error("Skill not found", 404)

            skill_data = skills.pop(name)
            group = _find_skill_group(config, name)

            # Remove from group
            for gdata in config.get("groups", {}).values():
                if name in gdata.get("skills", []):
                    gdata["skills"].remove(name)

            # Move real directory to trash
            skills_dir = _get_skills_dir(config)
            src = skills_dir / name
            TRASH_DIR.mkdir(parents=True, exist_ok=True)
            dst = TRASH_DIR / name
            if dst.exists():
                shutil.rmtree(str(dst), ignore_errors=True)
            if src.exists():
                shutil.move(str(src), str(dst))

            # Add to trash in config
            now = datetime.now().isoformat(timespec="seconds")
            trash_entry = dict(skill_data)
            trash_entry["group"] = group
            trash_entry["deleted_at"] = now
            trash_entry["backup_path"] = f"data/trash/{name}"
            config.setdefault("trash", {})[name] = trash_entry

            _write_config(config)
            _add_operation("delete", "skill", name, group=group, before=skill_data)

        self._send_json({"message": f"Moved '{name}' to trash"})

    # =========================================================================
    # Trash
    # =========================================================================

    def _handle_get_trash(self):
        with _data_lock:
            config = _read_config()
            changed = _cleanup_trash(config)
            if changed:
                _write_config(config)
        trash = config.get("trash", {})
        # Add remaining_days
        now = datetime.now()
        items = []
        for name, item in trash.items():
            entry = dict(item)
            try:
                deleted_at = datetime.fromisoformat(item.get("deleted_at", ""))
                remaining = TRASH_MAX_DAYS - (now - deleted_at).days
                entry["remaining_days"] = max(0, remaining)
            except (ValueError, TypeError):
                entry["remaining_days"] = TRASH_MAX_DAYS
            items.append(entry)
        self._send_json({"trash": items})

    def _handle_restore_trash(self, name):
        with _data_lock:
            config = _read_config()
            trash = config.get("trash", {})
            if name not in trash:
                return self._send_error("Not found in trash", 404)

            item = trash.pop(name)
            original_group = item.pop("group", "ungrouped")
            item.pop("deleted_at", None)
            backup_path_str = item.pop("backup_path", "")

            # Move directory back
            skills_dir = _get_skills_dir(config)
            dst = skills_dir / name
            if backup_path_str:
                src = PROJECT_ROOT / backup_path_str
                if src.exists():
                    if dst.exists():
                        shutil.rmtree(str(dst), ignore_errors=True)
                    shutil.move(str(src), str(dst))

            # Restore to config
            item["updated_at"] = datetime.now().isoformat(timespec="seconds")
            config.setdefault("skills", {})[name] = item

            # Restore to group
            groups = config.get("groups", {})
            if original_group not in groups:
                original_group = "ungrouped"
            if name not in groups[original_group].get("skills", []):
                groups[original_group].setdefault("skills", []).append(name)

            _write_config(config)
            _add_operation("restore", "skill", name, group=original_group, after=item)

        self._send_json({"message": f"Restored '{name}'"})

    def _handle_permanent_delete(self, name):
        with _data_lock:
            config = _read_config()
            trash = config.get("trash", {})
            if name not in trash:
                return self._send_error("Not found in trash", 404)

            item = trash.pop(name)
            backup = item.get("backup_path", "")
            if backup:
                bp = PROJECT_ROOT / backup
                if bp.exists():
                    shutil.rmtree(str(bp), ignore_errors=True)

            _write_config(config)
            _add_operation("permanent_delete", "skill", name, before=item)

        self._send_json({"message": f"Permanently deleted '{name}'"})

    def _handle_clear_trash(self):
        with _data_lock:
            config = _read_config()
            trash = config.get("trash", {})
            names = list(trash.keys())
            for name in names:
                item = trash.pop(name)
                backup = item.get("backup_path", "")
                if backup:
                    bp = PROJECT_ROOT / backup
                    if bp.exists():
                        shutil.rmtree(str(bp), ignore_errors=True)
                _add_operation("permanent_delete", "skill", name, before=item)
            _write_config(config)

        self._send_json({"message": f"Cleared {len(names)} items from trash"})

    # =========================================================================
    # Groups
    # =========================================================================

    def _handle_get_groups(self):
        with _data_lock:
            config = _read_config()
        groups = config.get("groups", {})
        self._send_json({"groups": groups})

    def _handle_create_group(self, body):
        name = body.get("name", "").strip()
        if not name:
            return self._send_error("name is required")
        if name == "ungrouped":
            return self._send_error("Cannot create 'ungrouped' group")
        if not re.match(r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$", name):
            return self._send_error("name must be alphanumeric with - _ .")

        with _data_lock:
            config = _read_config()
            groups = config.setdefault("groups", {})
            if name in groups:
                return self._send_error("Group already exists", 409)

            # Determine order
            max_order = max((g.get("order", 0) for g in groups.values() if g.get("name") != "ungrouped"), default=-1)

            group_data = {
                "name": name,
                "display_name": body.get("display_name", name.replace("-", " ").title()),
                "color": body.get("color", "#6c63ff"),
                "order": body.get("order", max_order + 1),
                "skills": [],
            }
            groups[name] = group_data
            _write_config(config)
            _add_operation("group_create", "group", name, after=group_data)

        self._send_json({"group": group_data, "message": "Created"}, 201)

    def _handle_update_group(self, name, body):
        if name == "ungrouped" and "name" in body:
            return self._send_error("Cannot rename 'ungrouped' group")

        with _data_lock:
            config = _read_config()
            groups = config.get("groups", {})
            if name not in groups:
                return self._send_error("Group not found", 404)

            old = dict(groups[name])
            for field in ("display_name", "color", "order"):
                if field in body:
                    groups[name][field] = body[field]

            _write_config(config)
            _add_operation("group_update", "group", name,
                           before=old, after=dict(groups[name]))

        self._send_json({"group": groups[name], "message": "Updated"})

    def _handle_delete_group(self, name):
        if name == "ungrouped":
            return self._send_error("Cannot delete 'ungrouped' group")

        with _data_lock:
            config = _read_config()
            groups = config.get("groups", {})
            if name not in groups:
                return self._send_error("Group not found", 404)

            group_data = groups.pop(name)
            # Move skills to ungrouped
            skill_names = group_data.get("skills", [])
            ungrouped = groups.setdefault("ungrouped", {
                "name": "ungrouped",
                "display_name": "Ungrouped",
                "color": "#888888",
                "order": 999,
                "skills": [],
            })
            for sn in skill_names:
                if sn not in ungrouped.get("skills", []):
                    ungrouped.setdefault("skills", []).append(sn)

            _write_config(config)
            _add_operation("group_delete", "group", name, before=group_data)

        self._send_json({"message": f"Deleted group '{name}', skills moved to ungrouped"})

    def _handle_move_skill_group(self, skill_name, body):
        target_group = body.get("group", "").strip()
        if not target_group:
            return self._send_error("group is required")

        with _data_lock:
            config = _read_config()
            if skill_name not in config.get("skills", {}):
                return self._send_error("Skill not found", 404)

            groups = config.get("groups", {})
            if target_group not in groups:
                return self._send_error("Target group not found", 404)

            # Find current group
            old_group = _find_skill_group(config, skill_name)

            # Remove from old group
            if old_group in groups and skill_name in groups[old_group].get("skills", []):
                groups[old_group]["skills"].remove(skill_name)

            # Add to new group
            if skill_name not in groups[target_group].get("skills", []):
                groups[target_group].setdefault("skills", []).append(skill_name)

            _write_config(config)
            _add_operation("group_assign", "skill", skill_name,
                           group=target_group,
                           before={"group": old_group},
                           after={"group": target_group})

        self._send_json({"message": f"Moved '{skill_name}' to '{target_group}'"})

    # =========================================================================
    # Operations
    # =========================================================================

    def _handle_get_operations(self, params):
        page = int(params.get("page", [1])[0])
        limit = int(params.get("limit", [50])[0])
        limit = min(limit, 100)

        with _data_lock:
            ops = _read_oplog()

        # Reverse for newest first
        ops.reverse()
        total = len(ops)
        start = (page - 1) * limit
        end = start + limit
        page_ops = ops[start:end]

        self._send_json({
            "operations": page_ops,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit if total > 0 else 1,
        })

    def _handle_undo_operation(self, op_id):
        with _data_lock:
            ops = _read_oplog()
            target = None
            for op in ops:
                if op.get("id") == op_id:
                    target = op
                    break

            if not target:
                return self._send_error("Operation not found", 404)
            if target.get("undone"):
                return self._send_error("Already undone", 400)
            if target.get("action") == "permanent_delete":
                return self._send_error("Cannot undo permanent delete", 400)
            if target.get("action") == "undo":
                return self._send_error("Cannot undo an undo", 400)

            action = target["action"]
            tname = target.get("target_name", "")
            config = _read_config()

            try:
                if action == "create":
                    self._undo_create(config, tname)
                elif action == "update":
                    self._undo_update(config, tname, target.get("before", {}))
                elif action == "delete":
                    self._undo_delete(config, tname)
                elif action == "restore":
                    self._undo_restore(config, tname)
                elif action == "group_create":
                    self._undo_group_create(config, tname)
                elif action == "group_update":
                    self._undo_group_update(config, tname, target.get("before", {}))
                elif action == "group_delete":
                    self._undo_group_delete(config, tname, target.get("before", {}))
                elif action == "group_assign":
                    self._undo_group_assign(config, tname, target.get("before", {}))
                elif action == "import":
                    self._undo_import(config, target.get("after", {}))
                else:
                    return self._send_error(f"Cannot undo action '{action}'", 400)
            except Exception as e:
                return self._send_error(f"Undo failed: {e}", 500)

            target["undone"] = True
            _write_oplog(ops)
            _write_config(config)
            _add_operation("undo", target.get("target_type", "skill"), tname,
                           before={"undone_op_id": op_id})

        self._send_json({"message": f"Undone operation {op_id}"})

    def _undo_create(self, config, name):
        """Undo create: delete the skill (no trash)."""
        skills = config.get("skills", {})
        if name in skills:
            skills.pop(name)
        for gdata in config.get("groups", {}).values():
            if name in gdata.get("skills", []):
                gdata["skills"].remove(name)
        # Delete real dir
        skills_dir = _get_skills_dir(config)
        sp = skills_dir / name
        if sp.exists():
            shutil.rmtree(str(sp), ignore_errors=True)

    def _undo_update(self, config, name, before):
        """Undo update: restore previous field values."""
        skills = config.get("skills", {})
        if name not in skills:
            return
        for k, v in before.items():
            if k not in ("name", "created_at"):
                skills[name][k] = v
        # Sync SKILL.md
        skills_dir = _get_skills_dir(config)
        skill_path = skills_dir / name
        if skill_path.exists():
            _update_skill_md_frontmatter(skill_path, name, skills[name].get("description", ""))

    def _undo_delete(self, config, name):
        """Undo delete: restore from trash."""
        trash = config.get("trash", {})
        if name not in trash:
            return
        item = trash.pop(name)
        og = item.pop("group", "ungrouped")
        item.pop("deleted_at", None)
        bp_str = item.pop("backup_path", "")
        skills_dir = _get_skills_dir(config)
        dst = skills_dir / name
        if bp_str:
            src = PROJECT_ROOT / bp_str
            if src.exists():
                if dst.exists():
                    shutil.rmtree(str(dst), ignore_errors=True)
                shutil.move(str(src), str(dst))
        config.setdefault("skills", {})[name] = item
        groups = config.get("groups", {})
        if og not in groups:
            og = "ungrouped"
        if name not in groups[og].get("skills", []):
            groups[og].setdefault("skills", []).append(name)

    def _undo_restore(self, config, name):
        """Undo restore: move back to trash."""
        skills = config.get("skills", {})
        if name not in skills:
            return
        skill_data = skills.pop(name)
        group = _find_skill_group(config, name)
        for gdata in config.get("groups", {}).values():
            if name in gdata.get("skills", []):
                gdata["skills"].remove(name)
        skills_dir = _get_skills_dir(config)
        src = skills_dir / name
        TRASH_DIR.mkdir(parents=True, exist_ok=True)
        dst = TRASH_DIR / name
        if dst.exists():
            shutil.rmtree(str(dst), ignore_errors=True)
        if src.exists():
            shutil.move(str(src), str(dst))
        now = datetime.now().isoformat(timespec="seconds")
        trash_entry = dict(skill_data)
        trash_entry["group"] = group
        trash_entry["deleted_at"] = now
        trash_entry["backup_path"] = f"data/trash/{name}"
        config.setdefault("trash", {})[name] = trash_entry

    def _undo_group_create(self, config, name):
        groups = config.get("groups", {})
        if name in groups:
            skill_names = groups[name].get("skills", [])
            groups.pop(name)
            ungrouped = groups.setdefault("ungrouped", {
                "name": "ungrouped", "display_name": "Ungrouped",
                "color": "#888888", "order": 999, "skills": [],
            })
            for sn in skill_names:
                if sn not in ungrouped.get("skills", []):
                    ungrouped.setdefault("skills", []).append(sn)

    def _undo_group_update(self, config, name, before):
        groups = config.get("groups", {})
        if name in groups:
            for k, v in before.items():
                if k != "skills":
                    groups[name][k] = v

    def _undo_group_delete(self, config, name, before):
        groups = config.get("groups", {})
        if name not in groups:
            groups[name] = before
            # Remove skills from ungrouped that belong to this group
            ungrouped_skills = groups.get("ungrouped", {}).get("skills", [])
            for sn in before.get("skills", []):
                if sn in ungrouped_skills:
                    ungrouped_skills.remove(sn)

    def _undo_group_assign(self, config, name, before):
        old_group = before.get("group", "ungrouped")
        groups = config.get("groups", {})
        # Remove from current group
        for gdata in groups.values():
            if name in gdata.get("skills", []):
                gdata["skills"].remove(name)
        # Add back to old group
        if old_group in groups:
            if name not in groups[old_group].get("skills", []):
                groups[old_group].setdefault("skills", []).append(name)

    def _undo_import(self, config, after):
        """Undo import: delete all imported skill folders + remove from config."""
        skill_names = after.get("skills", [])
        skills_dir = _get_skills_dir(config)
        for sn in skill_names:
            # Remove file
            sp = skills_dir / sn
            if sp.exists():
                shutil.rmtree(str(sp), ignore_errors=True)
            # Remove from config
            config.get("skills", {}).pop(sn, None)
            for gdata in config.get("groups", {}).values():
                if sn in gdata.get("skills", []):
                    gdata["skills"].remove(sn)

    # =========================================================================
    # Skills Tree & Dirs
    # =========================================================================

    def _handle_get_skills_tree(self):
        with _data_lock:
            config = _read_config()
        tree = _build_skills_tree(config)
        self._send_json({"paths": tree})

    def _handle_get_skills_dirs(self):
        with _data_lock:
            config = _read_config()
        dirs = []
        for sp in _get_skill_paths(config):
            p = Path(sp["path"])
            skill_count = 0
            if p.exists():
                for e in p.iterdir():
                    if e.is_dir() and not e.name.startswith("."):
                        skill_count += 1
            dirs.append({
                "path": sp["path"],
                "type": sp["type"],
                "label": f"{'Global' if sp['type']=='global' else 'Project'} ({sp['path']})",
                "writable": os.access(str(p), os.W_OK) if p.exists() else False,
                "exists": p.exists(),
                "skill_count": skill_count,
                "existing_skills": [e.name for e in p.iterdir() if e.is_dir() and not e.name.startswith(".")] if p.exists() else [],
            })
        self._send_json({"dirs": dirs})

    def _handle_add_skill_path(self, body):
        path_str = body.get("path", "").strip()
        path_type = body.get("type", "project").strip()
        if not path_str:
            return self._send_error("path is required")
        with _data_lock:
            config = _read_config()
            meta = config.setdefault("meta", {})
            paths = meta.setdefault("skill_paths", [])
            # Check not duplicate
            for sp in paths:
                if sp.get("path") == path_str:
                    return self._send_error("Path already registered", 409)
            # Also check not same as global
            if path_str == meta.get("skills_dir", ""):
                return self._send_error("This is already the global path", 409)
            paths.append({"path": path_str, "type": path_type})
            _write_config(config)
        self._send_json({"message": f"Added path: {path_str}"}, 201)

    def _handle_remove_skill_path(self, path_str):
        with _data_lock:
            config = _read_config()
            meta = config.setdefault("meta", {})
            paths = meta.setdefault("skill_paths", [])
            new_paths = [sp for sp in paths if sp.get("path") != path_str]
            if len(new_paths) == len(paths):
                return self._send_error("Path not found", 404)
            meta["skill_paths"] = new_paths
            _write_config(config)
        self._send_json({"message": f"Removed path: {path_str}"})

    # =========================================================================
    # Import
    # =========================================================================

    def _handle_import_probe(self, body):
        url = body.get("url", "").strip()
        if not url:
            return self._send_error("url is required")

        try:
            IMPORT_TMP.mkdir(parents=True, exist_ok=True)
            tmp_name = f"{random.randint(0,0xFFFFFF):06x}"
            tmp_dir = IMPORT_TMP / tmp_name
            tmp_dir.mkdir(parents=True, exist_ok=True)

            source_type = "unknown"
            scan_dir = tmp_dir

            if _is_local_path(url):
                lp = Path(url)
                if not lp.exists():
                    return self._send_error(f"Path not found: {url}", 404)
                if lp.suffix.lower() == ".zip":
                    source_type = "local_zip"
                    with zipfile.ZipFile(str(lp), "r") as zf:
                        zf.extractall(str(tmp_dir))
                    scan_dir = tmp_dir
                else:
                    source_type = "local_dir"
                    scan_dir = lp  # Use directly, don't copy

            elif _is_git_url(url):
                clone_url, sub_path = _normalize_git_url(url)
                source_type = "git_repo" if not sub_path else "git_subdir"
                repo_dir = tmp_dir / "_repo"
                result = subprocess.run(
                    ["git", "clone", "--depth", "1", clone_url, str(repo_dir)],
                    capture_output=True, text=True, timeout=120
                )
                if result.returncode != 0:
                    err = result.stderr.strip()[:200]
                    return self._send_error(f"git clone failed: {err}", 500)
                scan_dir = repo_dir / sub_path if sub_path else repo_dir
            else:
                return self._send_error(f"Unsupported URL format: {url}")

            skills = _scan_skills_in_dir(scan_dir, scan_dir)

            self._send_json({
                "source": source_type,
                "source_url": url,
                "temp_dir": str(tmp_dir) if source_type != "local_dir" else "",
                "scan_dir": str(scan_dir),
                "skills": skills,
            })

        except subprocess.TimeoutExpired:
            return self._send_error("git clone timed out (120s limit)", 504)
        except Exception as e:
            return self._send_error(f"Probe failed: {type(e).__name__}: {e}", 500)

    def _handle_import_install(self, body):
        scan_dir = body.get("scan_dir", "").strip()
        selections = body.get("selections", [])
        group = body.get("group", "ungrouped")

        if not scan_dir or not selections:
            return self._send_error("scan_dir and selections are required")

        scan_path = Path(scan_dir)
        if not scan_path.exists():
            return self._send_error("Source directory not found. Please probe again.", 404)

        installed = []
        skipped = []

        with _data_lock:
            config = _read_config()
            groups = config.setdefault("groups", {})
            if group not in groups:
                group = "ungrouped"

            for sel in selections:
                name = sel.get("name", "")
                path_in_source = sel.get("path_in_source", "")
                target_dir_str = sel.get("target_dir", "")
                conflict_action = sel.get("conflict_action", "skip")

                if not name or not target_dir_str:
                    continue

                target_dir = Path(target_dir_str)
                target_dir.mkdir(parents=True, exist_ok=True)
                dst = target_dir / name

                # Determine source
                if path_in_source:
                    src = scan_path / path_in_source
                else:
                    src = scan_path

                if not src.exists():
                    skipped.append({"name": name, "reason": "source not found"})
                    continue

                # Conflict check
                if dst.exists():
                    if conflict_action == "skip":
                        skipped.append({"name": name, "reason": "already exists"})
                        continue
                    elif conflict_action == "overwrite":
                        shutil.rmtree(str(dst), ignore_errors=True)

                # Copy
                shutil.copytree(str(src), str(dst))

                # Register in config
                fm = _parse_skill_md_frontmatter(dst)
                now = datetime.now().isoformat(timespec="seconds")
                display_name = fm.get("name", name.replace("-", " ").replace("_", " ").title())
                config.setdefault("skills", {})[name] = {
                    "name": name,
                    "display_name": display_name,
                    "description": fm.get("description", ""),
                    "enabled": True,
                    "tags": [],
                    "created_at": now,
                    "updated_at": now,
                }
                if name not in groups[group].get("skills", []):
                    groups[group].setdefault("skills", []).append(name)
                installed.append(name)

            _write_config(config)

            if installed:
                _add_operation("import", "skill", ", ".join(installed),
                               group=group,
                               after={"skills": installed,
                                      "skipped": [s["name"] for s in skipped],
                                      "source": body.get("source_url", scan_dir)})

        # Cleanup temp dir if it was created by probe
        temp_dir = body.get("temp_dir", "")
        if temp_dir:
            tp = Path(temp_dir)
            if tp.exists() and str(IMPORT_TMP) in str(tp):
                shutil.rmtree(str(tp), ignore_errors=True)

        msg_parts = []
        if installed:
            msg_parts.append(f"Installed {len(installed)} skill(s)")
        if skipped:
            msg_parts.append(f"Skipped {len(skipped)}")
        self._send_json({
            "installed": installed,
            "skipped": skipped,
            "message": ", ".join(msg_parts) or "Nothing to install",
        })

    def _handle_import_cleanup(self, body):
        temp_dir = body.get("temp_dir", "").strip()
        if temp_dir:
            tp = Path(temp_dir)
            if tp.exists() and str(IMPORT_TMP) in str(tp):
                shutil.rmtree(str(tp), ignore_errors=True)
        self._send_json({"message": "Cleaned up"})

    # =========================================================================
    # Stats
    # =========================================================================

    def _handle_get_stats(self, params):
        days = params.get("days", [None])[0]
        if days is not None:
            days = int(days)
        rows = _read_stats(days)
        self._send_json({"stats": rows, "total": len(rows)})

    def _handle_get_stats_summary(self, params):
        days = params.get("days", [None])[0]
        if days is not None:
            days = int(days)
        rows = _read_stats(days)
        agg = {}
        for r in rows:
            sn = r.get("skill_name", "")
            if sn not in agg:
                agg[sn] = {"skill_name": sn, "total_count": 0,
                           "first_seen": r.get("date"), "last_seen": r.get("date")}
            agg[sn]["total_count"] += r.get("count", 0)
            d = r.get("date", "")
            if d < agg[sn]["first_seen"]:
                agg[sn]["first_seen"] = d
            if d > agg[sn]["last_seen"]:
                agg[sn]["last_seen"] = d

        summary = sorted(agg.values(), key=lambda x: x["total_count"], reverse=True)
        self._send_json({"summary": summary})

    def _handle_get_stats_today(self):
        today = date.today().isoformat()
        rows = _read_stats()
        today_rows = [r for r in rows if r.get("date") == today]
        self._send_json({"stats": today_rows, "date": today})

    def _handle_get_stats_trend(self, params):
        skill_name = params.get("skill", [None])[0]
        if not skill_name:
            return self._send_error("skill parameter is required")
        days = int(params.get("days", [30])[0])
        rows = _read_stats(days)
        trend = [r for r in rows if r.get("skill_name") == skill_name]
        self._send_json({"skill": skill_name, "trend": trend, "days": days})


# =============================================================================
# Main
# =============================================================================

def main():
    # Ensure data dirs exist
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TRASH_DIR.mkdir(parents=True, exist_ok=True)
    (PROJECT_ROOT / "logs").mkdir(parents=True, exist_ok=True)

    # Init files if missing
    if not CONFIG_FILE.exists():
        _write_config(_default_config())
    if not STATS_FILE.exists():
        STATS_FILE.write_text("date,skill_name,count\n", encoding="utf-8")
    if not OPLOG_FILE.exists():
        _write_oplog([])

    # Cleanup old trash on startup
    with _data_lock:
        config = _read_config()
        if _cleanup_trash(config):
            _write_config(config)

    # Cleanup leftover import temp dirs
    _cleanup_import_tmp()

    server = HTTPServer(("0.0.0.0", PORT), SkillHandler)
    print(f"\n  Skill Management System")
    print(f"  Dashboard: http://localhost:{PORT}")
    print(f"  Data dir:  {DATA_DIR}")
    print(f"  Press Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
