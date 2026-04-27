# Skill Management System

Track, visualize, and manage your Claude Code skills — fully offline, zero dependencies.

## Features

- **Auto-tracking** — PreToolUse hook records every Skill invocation to CSV
- **Dashboard** — Pure CSS charts, no CDN, no frameworks
- **Skill CRUD** — Create, edit, delete skills (operates on real `~/.claude/skills/` files)
- **File viewer** — Browse each skill's internal file structure
- **Groups** — Organize skills into custom categories
- **Trash** — 30-day recycle bin with restore capability
- **Operation history** — Full audit log with one-click undo
- **Dark / Light theme** — Follows system preference, manual toggle
- **Cross-platform** — Windows, macOS, Linux

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed
- Python 3.6+

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

Then open **http://localhost:3000** in your browser.

## How It Works

```
Claude Code                          Skill Management System
+-----------+    PreToolUse Hook     +-------------------+
| /skill    | ----stdin JSON-------> | skill_tracker.py  |
| invocation|                        |   +-> stats.csv   |
+-----------+                        |   +-> config.json |
                                     +-------------------+
                                              |
Browser                              +-------------------+
+-------------+    REST API          |    server.py      |
| Dashboard   | <------------------> | localhost:3000    |
| index.html  |                      +-------------------+
+-------------+
```

1. `install` script registers a PreToolUse hook in `~/.claude/settings.json`
2. Every time you use a Skill in Claude Code, the hook logs it to `data/stats.csv`
3. `server.py` serves the dashboard and provides REST APIs for management
4. Dashboard displays stats, manages skills/groups, and tracks all operations

## File Structure

```
Skill-Management-System/
├── hooks/skill_tracker.py    # PreToolUse hook script
├── dashboard/index.html      # Single-file SPA (CSS+JS inlined)
├── data/                     # Runtime data (gitignored)
│   ├── config.json           # Skill metadata + groups + trash
│   ├── stats.csv             # Daily usage statistics
│   ├── operation_log.json    # Operation history (max 500)
│   └── trash/                # Deleted skill directory backups
├── server.py                 # HTTP server + REST API
├── install.ps1 / install.sh  # Platform installers
├── start.ps1 / start.sh      # Launchers (auto-opens browser)
└── uninstall.ps1 / .sh       # Remove hook from settings
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills` | List all skills + groups |
| POST | `/api/skills` | Create a skill |
| PUT | `/api/skills/<name>` | Update a skill |
| DELETE | `/api/skills/<name>` | Soft-delete (move to trash) |
| GET | `/api/skills/<name>/files` | Skill file tree |
| GET | `/api/trash` | List trash items |
| POST | `/api/trash/<name>/restore` | Restore from trash |
| DELETE | `/api/trash/<name>` | Permanently delete |
| GET | `/api/groups` | List groups |
| POST | `/api/groups` | Create group |
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

This removes the hook from `~/.claude/settings.json`. Data files in `data/` are preserved. Delete the project directory to fully remove.

## Configuration

- **Port**: Change `PORT = 3000` in `server.py`
- **Trash retention**: Change `TRASH_MAX_DAYS = 30` in `server.py`
- **Operation log limit**: Change `MAX_OPERATIONS = 500` in `server.py`

## License

MIT
