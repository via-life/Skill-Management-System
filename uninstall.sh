#!/usr/bin/env bash
# Skill Management System - Mac/Linux Uninstaller
set -euo pipefail

echo ""
echo "  Skill Management System - Uninstaller"
echo ""

SETTINGS="$HOME/.claude/settings.json"

if [ -f "$SETTINGS" ]; then
    PYTHON=""
    for cmd in python3 python; do
        if command -v "$cmd" &>/dev/null; then
            PYTHON="$cmd"; break
        fi
    done

    if [ -n "$PYTHON" ]; then
        "$PYTHON" - "$SETTINGS" << 'PYEOF'
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
PYEOF
    else
        echo "  [WARN] Python not found. Manually remove hook from: $SETTINGS"
    fi
else
    echo "  [OK] No settings.json found"
fi

echo ""
echo "  Data files are preserved in data/ directory."
echo "  To fully remove, delete this project directory."
echo ""
