# Skill Management System - Windows Start
$PROJECT_ROOT = $PSScriptRoot
Write-Host ""
Write-Host "  Starting Skill Management System..." -ForegroundColor Cyan
Write-Host "  Dashboard: http://localhost:3000" -ForegroundColor White
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""
Start-Process "http://localhost:3000"
python "$PROJECT_ROOT\server.py"
