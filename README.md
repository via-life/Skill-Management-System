# 🎯 Skill Management System

A fully offline, zero-dependency management system for AI Agent skills — track usage, import from GitHub, organize, and visualize everything through a modern 3D-enhanced dashboard.

Built for **Claude Code** and compatible with any AI agent CLI that supports a skill/plugin system.

<br>

## ✨ Features

### Core
- **Auto Usage Tracking** — PreToolUse hook silently records every skill invocation to CSV
- **3-Level Skill Tree** — Skills organized by path (Global / Project) → pack → individual skill
- **Skill CRUD** — Create, edit, delete skills with real file operations on `~/.claude/skills/`
- **Import from URL** — Paste a GitHub/GitLab link, local path or ZIP → auto-detect → select → install
- **File Viewer** — Browse each skill's internal directory structure and read file contents
- **Groups** — Organize skills into custom color-coded categories
- **Skill Paths** — Register multiple skill directories, auto-detect global vs project scope

### Safety
- **Trash & Restore** — 30-day recycle bin with countdown, one-click restore
- **Operation History** — Full audit log (max 500 entries) with one-click undo for any action
- **Conflict Handling** — Skip or overwrite when importing existing skills
- **3-Level Warnings** — Toast → confirm modal → type-name-to-confirm for dangerous operations

### UI / UX
- **MagnetLines Background** — 240 CSS grid lines that rotate toward your cursor in real-time
- **Target Cursor** — Crosshair with 4 L-shaped corners, contracts on interactive element hover
- **3D Lanyard** — Three.js + Cannon-es physics rope in top-right corner, pull to toggle theme
- **AnimatedList** — List rows animate in with scale + fade on scroll via IntersectionObserver
- **Spotlight Cards** — Mouse-follow radial gradient light on stat cards
- **CountUp Numbers** — Stat values animate from 0 to target with ease-out cubic
- **Glassmorphism** — Frosted glass sections with `backdrop-filter: blur`
- **Shiny Title** — Gradient sweep animation on navbar brand text
- **Dark / Light Theme** — Follows system `prefers-color-scheme`, manual toggle, localStorage persist
- **i18n** — English / 中文 toggle, all UI text translated, persisted

### Cross-Platform
- Windows (PowerShell), macOS, Linux
- Install / Start / Uninstall scripts for each platform

<br>

## 📋 Prerequisites

- **Python 3.6+** — `python --version` to verify
- **Git** — for importing skills from remote repositories
- **AI Agent CLI** with skill support (e.g. [Claude Code](https://docs.anthropic.com/en/docs/claude-code))

<br>

## 🚀 Quick Start

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

<br>

## 🔧 How It Works

```
AI Agent CLI                         Skill Management System
+-----------+    PreToolUse Hook     +--------------------+
|  /skill   | ----stdin JSON-------> | skill_tracker.py   |
| invocation|                        |   → stats.csv      |
+-----------+                        |   → config.json    |
                                     +--------------------+
                                              │
Browser                              +--------------------+
+-------------+    REST API (30+)    |    server.py       |
|  Dashboard  | ◄──────────────────► | localhost:3000     |
|  index.html |                      +--------------------+
+-------------+
    │
    ├── MagnetLines (CSS Grid + atan2)
    ├── Target Cursor (mix-blend-mode: difference)
    ├── 3D Lanyard (Three.js + Cannon-es)
    └── Spotlight Cards (CSS radial-gradient)
```

1. `install` registers a **PreToolUse hook** in `~/.claude/settings.json`
2. Every skill invocation is automatically logged to `data/stats.csv`
3. `server.py` (Python stdlib, zero pip deps) serves dashboard + 30+ REST APIs
4. Dashboard: single HTML file (~1900 lines), CSS + JS inlined, 3D via CDN importmap

<br>

## 📥 Import Skills

1. Click **📥 Import** in the dashboard
2. Paste a URL or local path → click **Probe**
3. Select skills, choose target directory (Global / Project), set group
4. Handle conflicts (Skip / Overwrite per skill)
5. Click **Install** → done

**Supported sources:**

| Source | Example |
|--------|---------|
| GitHub repo | `https://github.com/user/repo` |
| GitHub subdirectory | `https://github.com/user/repo/tree/main/skills/x` |
| GitLab / Gitee | `https://gitlab.com/user/repo` |
| Local directory | `C:\skills\my-skill` or `/home/user/skills` |
| Local ZIP | `C:\downloads\skill-pack.zip` |

<br>

## 📂 Skill Path Types

| Type | Location | Scope |
|------|----------|-------|
| **Global** | `~/.claude/skills/` | All projects |
| **Project** | `<project>/.claude/skills/` | Single project |

Manage paths via the ⚙ gear icon in the Skill Management section.

**Detection rule:** Directory has `SKILL.md` → independent skill. Directory has subdirectories with `SKILL.md` → skill pack.

<br>

## 🗂 File Structure

```
Skill-Management-System/
├── hooks/
│   └── skill_tracker.py         # PreToolUse hook (auto-tracking)
├── dashboard/
│   └── index.html               # Single-file SPA (~1900 lines, CSS+JS inlined)
├── data/                        # Runtime data (all gitignored)
│   ├── config.json              # Skills, groups, trash, paths config
│   ├── stats.csv                # Daily usage statistics
│   ├── operation_log.json       # Operation history (max 500)
│   ├── trash/                   # Deleted skill directory backups
│   └── .import_tmp/             # Temporary import staging
├── logs/
│   └── *.log                    # Hook error logs
├── server.py                    # HTTP server + 30+ REST API endpoints
├── install.ps1 / install.sh     # Cross-platform installers
├── start.ps1 / start.sh         # Launchers (auto-opens browser)
├── uninstall.ps1 / uninstall.sh # Remove hook from settings
├── .gitignore
└── README.md
```

<br>

## 📡 API Reference

### Skills

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/skills` | List all skills (flat dict) |
| `GET` | `/api/skills-tree` | 3-level hierarchy by path |
| `GET` | `/api/skills/<name>` | Single skill detail + file tree |
| `POST` | `/api/skills` | Create a skill (writes to disk) |
| `PUT` | `/api/skills/<name>` | Update metadata + SKILL.md frontmatter |
| `DELETE` | `/api/skills/<name>` | Soft-delete → trash |
| `GET` | `/api/skills/<name>/files` | Directory tree |
| `GET` | `/api/skills/<name>/files/<path>` | Read file content |
| `PUT` | `/api/skills/<name>/group` | Move skill to another group |

### Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/import/probe` | Probe URL/path, detect skills |
| `POST` | `/api/import/install` | Install selected skills with conflict handling |
| `POST` | `/api/import/cleanup` | Clean up temp import files |

### Skill Paths

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/skills-dirs` | List all registered skill directories |
| `POST` | `/api/skills-dirs` | Add a skill path |
| `DELETE` | `/api/skills-dirs/<path>` | Remove a skill path |

### Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/groups` | List all groups |
| `POST` | `/api/groups` | Create group |
| `PUT` | `/api/groups/<name>` | Update group (name, color, order) |
| `DELETE` | `/api/groups/<name>` | Delete group (skills → ungrouped) |

### Trash

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/trash` | List trash (auto-cleans >30 days) |
| `POST` | `/api/trash/<name>/restore` | Restore from trash |
| `DELETE` | `/api/trash/<name>` | Permanently delete |
| `DELETE` | `/api/trash` | Clear all trash |

### Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats?days=N` | Raw usage data |
| `GET` | `/api/stats/summary?days=N` | Aggregated by skill, sorted |
| `GET` | `/api/stats/today` | Today's stats |
| `GET` | `/api/stats/trend?skill=X&days=N` | Single skill daily trend |

### Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/operations?page=1&limit=50` | Paginated history (newest first) |
| `POST` | `/api/operations/<id>/undo` | Undo any operation |

<br>

## 🗑 Uninstall

```powershell
# Windows
.\uninstall.ps1

# macOS / Linux
./uninstall.sh
```

Removes the hook from `~/.claude/settings.json`. Data files in `data/` are preserved — delete the project directory to fully remove.

<br>

## ⚙ Configuration

| Setting | Location | Default |
|---------|----------|---------|
| Server port | `PORT` in `server.py` | `3000` |
| Trash retention | `TRASH_MAX_DAYS` in `server.py` | `30` days |
| Operation log limit | `MAX_OPERATIONS` in `server.py` | `500` entries |

<br>

## 🎨 Visual Modules

All visual effects are pure CSS + vanilla JS, except the 3D lanyard which uses Three.js + Cannon-es via CDN importmap.

| Module | Tech | Description |
|--------|------|-------------|
| MagnetLines | CSS Grid + `atan2` | 20×12 line grid rotates toward cursor |
| Target Cursor | CSS + `mousemove` | Crosshair with L-corners, contracts on hover |
| 3D Lanyard | Three.js + Cannon-es | Physics rope with draggable ball, pull toggles theme |
| Spotlight Cards | CSS `radial-gradient` | Mouse-follow light effect on stat cards |
| Glassmorphism | `backdrop-filter: blur` | Frosted glass navbar, sections, group blocks |
| CountUp | `requestAnimationFrame` | Numbers animate from 0 to target |
| AnimatedList | `IntersectionObserver` | Rows scale + fade in on scroll |
| Shiny Text | CSS `background-clip: text` | Gradient sweep on title |
| Bar Chart | CSS `width` animation | Staggered entry with hover glow |

<br>

## 📄 License

MIT
