# Skill Management System

A fully offline, zero-dependency system for tracking, visualizing, and managing AI Agent skills.

Works with any AI agent CLI that supports skills (Claude Code, etc.) — track usage, import from GitHub, organize into groups, and manage everything through a modern dashboard.

## Features

- **Auto Usage Tracking** — Hook-based tracking records every skill invocation to CSV, zero manual effort
- **Visual Dashboard** — Pure CSS charts with aurora background, spotlight cards, countup animations (no CDN/frameworks)
- **Import from URL** — Paste a GitHub/GitLab link or local path, auto-detect skills, select and install
- **3-Level Skill Tree** — Browse skills organized by path (global/project) → pack → individual skill
- **Skill CRUD** — Create, edit, delete skills with real file operations on disk
- **File Viewer** — Browse each skill's internal directory structure and view file contents
- **Skill Paths Management** — Register multiple skill directories (global + project-level), auto-detect type
- **Trash & Restore** — 30-day recycle bin, restore with one click, permanent delete with confirmation
- **Operation History** — Full audit log of every action, one-click undo for any operation
- **Conflict Handling** — Skip or overwrite when importing skills that already exist
- **i18n** — English / Chinese toggle, persisted to localStorage
- **Dark / Light Theme** — Follows system preference, manual toggle
- **Cross-Platform** — Windows, macOS, Linux

## Prerequisites

- Python 3.6+
- Git (for importing skills from remote repositories)
- An AI agent CLI with skill support (e.g., [Claude Code](https://docs.anthropic.com/en/docs/claude-code))

## Quick Start

### Windows (PowerShell)

```powershell
git clone https://github.com/via-life/Skill-Management-System.git
cd Skill-Management-System
.\install.ps1
.\start.ps1
```

### macOS / Linux

```bash
git clone https://github.com/via-life/Skill-Management-System.git
cd Skill-Management-System
chmod +x install.sh start.sh
./install.sh
./start.sh
```

Open **http://localhost:3000** in your browser.

## How It Works

```
AI Agent CLI                         Skill Management System
+-----------+    PreToolUse Hook     +-------------------+
|  skill    | ----stdin JSON-------> | skill_tracker.py  |
| invocation|                        |   +-> stats.csv   |
+-----------+                        |   +-> config.json |
                                     +-------------------+
                                              |
Browser                              +-------------------+
+-------------+    REST API          |    server.py      |
|  Dashboard  | <------------------> | localhost:3000    |
|  index.html |                      +-------------------+
+-------------+
```

1. The install script registers a PreToolUse hook in `~/.claude/settings.json`
2. Every skill invocation is automatically logged to `data/stats.csv`
3. `server.py` serves the dashboard and provides 20+ REST API endpoints
4. The dashboard displays usage stats, manages skills/groups, handles imports, and tracks all operations

## Dashboard Overview

| Section | Description |
|---------|-------------|
| **Stats Cards** | Total skills, today's usage, weekly usage, most-used skill (with spotlight hover effect) |
| **Usage Chart** | Top 10 skills bar chart with stagger animation (7d / 30d / all time) |
| **Skill Tree** | 3-level hierarchy: path (global/project) → skill or pack → sub-skills |
| **Recent Activity** | Latest usage records table |
| **Trash** | Deleted skills with remaining days countdown, restore or permanent delete |
| **Operation History** | Full timeline with undo capability, paginated |

## Import Skills

1. Click **Import** in the dashboard
2. Paste a URL (GitHub, GitLab, local path, or ZIP) and click **Probe**
3. Select which skills to install, choose target directory and group
4. Handle conflicts (skip or overwrite existing skills)
5. Click **Install** — done!

Supported sources:
- `https://github.com/user/repo` — full repository
- `https://github.com/user/repo/tree/main/path/to/skill` — subdirectory
- `https://gitlab.com/user/repo` — GitLab and other Git platforms
- `C:\path\to\skills` or `/path/to/skills` — local directory
- `C:\path\to\skill.zip` — local ZIP file

## Skill Path Types

| Type | Location | Description |
|------|----------|-------------|
| **Global** | `~/.claude/skills/` | Shared across all projects |
| **Project** | `<project>/.claude/skills/` | Scoped to a specific project |

Manage paths via the gear icon in the Skill Management section.

## File Structure

```
Skill-Management-System/
├── hooks/skill_tracker.py      # PreToolUse hook (auto-tracking)
├── dashboard/index.html        # Single-file SPA (CSS+JS inlined, ~55KB)
├── data/                       # Runtime data (gitignored)
│   ├── config.json             # Skill metadata, groups, trash, paths
│   ├── stats.csv               # Daily usage statistics
│   ├── operation_log.json      # Operation history (max 500 entries)
│   ├── trash/                  # Deleted skill directory backups
│   └── .import_tmp/            # Temporary import staging
├── server.py                   # HTTP server + 20+ REST API endpoints
├── install.ps1 / install.sh    # Cross-platform installers
├── start.ps1 / start.sh        # Launchers (auto-opens browser)
└── uninstall.ps1 / .sh         # Remove hook from settings
```

## API Reference

### Skills
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills` | List all skills (flat) |
| GET | `/api/skills-tree` | 3-level skill tree (by path) |
| GET | `/api/skills/<name>` | Single skill detail + file tree |
| POST | `/api/skills` | Create a skill |
| PUT | `/api/skills/<name>` | Update skill metadata |
| DELETE | `/api/skills/<name>` | Soft-delete (move to trash) |
| GET | `/api/skills/<name>/files` | Skill file tree |
| GET | `/api/skills/<name>/files/<path>` | Read file content |

### Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/import/probe` | Probe a URL/path for skills |
| POST | `/api/import/install` | Install selected skills |
| POST | `/api/import/cleanup` | Clean up temp files |

### Skill Paths
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills-dirs` | List all skill directories |
| POST | `/api/skills-dirs` | Add a skill path |
| DELETE | `/api/skills-dirs/<path>` | Remove a skill path |

### Groups, Trash, Stats, Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List groups |
| POST | `/api/groups` | Create group |
| GET | `/api/trash` | List trash (auto-cleans >30 days) |
| POST | `/api/trash/<name>/restore` | Restore from trash |
| GET | `/api/stats?days=N` | Usage statistics |
| GET | `/api/stats/summary?days=N` | Aggregated summary |
| GET | `/api/operations?page=1` | Operation history |
| POST | `/api/operations/<id>/undo` | Undo an operation |

## Uninstall

```powershell
# Windows
.\uninstall.ps1

# macOS / Linux
./uninstall.sh
```

Removes the hook from `~/.claude/settings.json`. Data files in `data/` are preserved.

## Configuration

| Setting | Location | Default |
|---------|----------|---------|
| Port | `PORT` in `server.py` | `3000` |
| Trash retention | `TRASH_MAX_DAYS` in `server.py` | `30` days |
| Operation log limit | `MAX_OPERATIONS` in `server.py` | `500` entries |

## License

MIT
