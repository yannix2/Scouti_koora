# Start all backend services (gateway + 2 microservices)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venv = "$root\venv\Scripts\python.exe"
$env:PYTHONPATH = "$root"

Write-Host "Starting all services with run_backend.py..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop all services." -ForegroundColor Yellow
Write-Host ""

if (Test-Path $venv) {
    & $venv "$root\run_backend.py"
} else {
    & python "$root\run_backend.py"
}
