# Skill Management System - Windows Installer
# Run: .\install.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  Skill Management System - Installer" -ForegroundColor Cyan
Write-Host "  =====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Find Python
$PYTHON = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "Python 3\.([6-9]|\d{2})") {
            $PYTHON = $cmd
            Write-Host "  [OK] Found $ver" -ForegroundColor Green
            break
        }
    } catch {}
}

if (-not $PYTHON) {
    Write-Host "  [ERROR] Python 3.6+ is required." -ForegroundColor Red
    Write-Host "  Install from https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Step 2: Determine paths
$PROJECT_ROOT = $PSScriptRoot
$CLAUDE_DIR = "$env:USERPROFILE\.claude"
$SETTINGS = "$CLAUDE_DIR\settings.json"
$HOOK_SCRIPT = "$PROJECT_ROOT\hooks\skill_tracker.py"
$SKILLS_DIR = "$CLAUDE_DIR\skills"

Write-Host "  [..] Project: $PROJECT_ROOT"
Write-Host "  [..] Claude config: $CLAUDE_DIR"

# Step 3: Use Python for JSON operations (avoids PowerShell JSON type issues)
$installScript = @"
import json, sys, os, re
from pathlib import Path
from datetime import datetime

project_root = sys.argv[1]
settings_path = sys.argv[2]
hook_script = sys.argv[3]
python_cmd = sys.argv[4]
skills_dir = sys.argv[5]

# --- Merge settings.json ---
p = Path(settings_path)
p.parent.mkdir(parents=True, exist_ok=True)

settings = {}
if p.exists():
    try:
        settings = json.loads(p.read_text('utf-8'))
    except:
        settings = {}

hooks = settings.setdefault('hooks', {})
ptu = hooks.setdefault('PreToolUse', [])

# Idempotent check
already = False
for group in ptu:
    if group.get('matcher') == 'Skill':
        for h in group.get('hooks', []):
            if 'skill_tracker.py' in h.get('command', ''):
                already = True
                break

if not already:
    hook_cmd = f'{python_cmd} "{hook_script}"'
    ptu.append({
        'matcher': 'Skill',
        'hooks': [{'type': 'command', 'command': hook_cmd}]
    })
    p.write_text(json.dumps(settings, indent=2, ensure_ascii=False), 'utf-8')
    print('  [OK] Hook registered in settings.json')
else:
    print('  [OK] Hook already registered, skipped')

# --- Init data files ---
data_dir = Path(project_root) / 'data'
data_dir.mkdir(parents=True, exist_ok=True)
(Path(project_root) / 'logs').mkdir(parents=True, exist_ok=True)
(data_dir / 'trash').mkdir(parents=True, exist_ok=True)

config_file = data_dir / 'config.json'
stats_file = data_dir / 'stats.csv'
oplog_file = data_dir / 'operation_log.json'

now = datetime.now().isoformat(timespec='seconds')

if not config_file.exists():
    config = {
        'version': '1.0',
        'meta': {'skills_dir': skills_dir, 'installed_at': now},
        'groups': {
            'ungrouped': {
                'name': 'ungrouped', 'display_name': 'Ungrouped',
                'color': '#888888', 'order': 999, 'skills': []
            }
        },
        'skills': {},
        'trash': {}
    }
else:
    config = json.loads(config_file.read_text('utf-8'))
    config.setdefault('meta', {})['skills_dir'] = skills_dir

# --- Scan existing skills ---
skills_path = Path(skills_dir)
if skills_path.exists():
    for entry in skills_path.iterdir():
        if not entry.is_dir():
            continue
        sname = entry.name
        if sname.startswith('.'):
            continue
        if sname in config.get('skills', {}) or sname in config.get('trash', {}):
            continue

        # Parse SKILL.md frontmatter
        skill_md = entry / 'SKILL.md'
        desc = ''
        if skill_md.exists():
            try:
                content = skill_md.read_text('utf-8')
                if content.startswith('---'):
                    end = content.find('---', 3)
                    if end > 0:
                        fm = content[3:end]
                        for line in fm.strip().splitlines():
                            if ':' in line:
                                k, _, v = line.partition(':')
                                if k.strip() == 'description':
                                    desc = v.strip().strip('\'"')
            except:
                pass

        display_name = sname.replace('-', ' ').replace('_', ' ').title()
        config.setdefault('skills', {})[sname] = {
            'name': sname,
            'display_name': display_name,
            'description': desc,
            'enabled': True,
            'tags': [],
            'created_at': now,
            'updated_at': now
        }
        ungrouped = config['groups'].setdefault('ungrouped', {
            'name': 'ungrouped', 'display_name': 'Ungrouped',
            'color': '#888888', 'order': 999, 'skills': []
        })
        if sname not in ungrouped.get('skills', []):
            ungrouped.setdefault('skills', []).append(sname)
        print(f'  [OK] Found skill: {sname}')

config_file.write_text(json.dumps(config, indent=2, ensure_ascii=False), 'utf-8')

if not stats_file.exists():
    stats_file.write_text('date,skill_name,count\n', 'utf-8')

if not oplog_file.exists():
    oplog_file.write_text('[]', 'utf-8')

print('  [OK] Data files initialized')
"@

& $PYTHON -c $installScript $PROJECT_ROOT $SETTINGS $HOOK_SCRIPT $PYTHON $SKILLS_DIR

Write-Host ""
Write-Host "  Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Start the dashboard:" -ForegroundColor Cyan
Write-Host "    .\start.ps1" -ForegroundColor White
Write-Host ""
Write-Host "  Then open: http://localhost:3000" -ForegroundColor White
Write-Host ""
