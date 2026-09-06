# Cycle Shop - Windows dev startup helper
# Usage: .\start-dev.ps1
# Requires PostgreSQL running and DATABASE_URL set (see .env)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# Load .env into process environment
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $parts = $_ -split '=', 2
    if ($parts.Count -eq 2) {
      Set-Item -Path "env:$($parts[0].Trim())" -Value $parts[1].Trim()
    }
  }
}

Write-Host "Starting API server on port 8080..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit", "-ExecutionPolicy", "Bypass", "-Command",
  "cd '$root'; `$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); `$env:DATABASE_URL='$env:DATABASE_URL'; `$env:PORT='8080'; `$env:NODE_ENV='development'; pnpm.cmd --filter @workspace/api-server run build; pnpm.cmd --filter @workspace/api-server run start"
)

Start-Sleep -Seconds 2

Write-Host "Starting frontend on port 5173..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit", "-ExecutionPolicy", "Bypass", "-Command",
  "cd '$root'; `$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); `$env:PORT='5173'; `$env:BASE_PATH='/'; pnpm.cmd --filter @workspace/cycle-shop run dev"
)

Write-Host ""
Write-Host "Servers starting in separate windows." -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "  API:      http://localhost:8080/api/healthz" -ForegroundColor Green
