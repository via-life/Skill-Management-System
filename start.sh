#!/usr/bin/env bash
# Skill Management System - Mac/Linux Start
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
echo ""
echo "  Starting Skill Management System..."
echo "  Dashboard: http://localhost:3000"
echo "  Press Ctrl+C to stop"
echo ""
# Open browser
command -v xdg-open &>/dev/null && xdg-open "http://localhost:3000" 2>/dev/null &
command -v open     &>/dev/null && open     "http://localhost:3000" 2>/dev/null &
cd "$PROJECT_ROOT"
python3 server.py
