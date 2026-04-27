# Skill Management System - Windows Uninstaller
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  Skill Management System - Uninstaller" -ForegroundColor Yellow
Write-Host ""

$SETTINGS = "$env:USERPROFILE\.claude\settings.json"

if (Test-Path $SETTINGS) {
    $PYTHON = $null
    foreach ($cmd in @("python", "python3", "py")) {
        try {
            $ver = & $cmd --version 2>&1
            if ($ver -match "Python 3") { $PYTHON = $cmd; break }
        } catch {}
    }

    if ($PYTHON) {
        $script = @"
import json, sys
from pathlib import Path

p = Path(sys.argv[1])
if not p.exists():
    print('  Settings file not found, nothing to do')
    sys.exit(0)

settings = json.loads(p.read_text('utf-8'))
ptu = settings.get('hooks', {}).get('PreToolUse', [])

new_ptu = []
removed = False
for group in ptu:
    if group.get('matcher') == 'Skill':
        new_hooks = [h for h in group.get('hooks', []) if 'skill_tracker.py' not in h.get('command', '')]
        if len(new_hooks) < len(group.get('hooks', [])):
            removed = True
        if new_hooks:
            group['hooks'] = new_hooks
            new_ptu.append(group)
    else:
        new_ptu.append(group)

settings['hooks']['PreToolUse'] = new_ptu
p.write_text(json.dumps(settings, indent=2, ensure_ascii=False), 'utf-8')

if removed:
    print('  [OK] Hook removed from settings.json')
else:
    print('  [OK] No hook found to remove')
"@
        & $PYTHON -c $script $SETTINGS
    } else {
        Write-Host "  [WARN] Python not found. Please manually remove the hook from:" -ForegroundColor Yellow
        Write-Host "  $SETTINGS" -ForegroundColor White
    }
} else {
    Write-Host "  [OK] No settings.json found" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Data files are preserved in data/ directory." -ForegroundColor Gray
Write-Host "  To fully remove, delete this project directory." -ForegroundColor Gray
Write-Host ""
