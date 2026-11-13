$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path (Split-Path $root -Parent) "secretaria-backend"
$packages = Join-Path $root "modules/frontend/packages"

$env:PORT = if ($env:PORT) { $env:PORT } else { "3333" }
$env:DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "127.0.0.1" }
$env:DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "3306" }
$env:DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "test" }
$env:DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "root" }
$env:DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "" }
$env:DB_TLS = if ($env:DB_TLS) { $env:DB_TLS } else { "false" }
$env:OIDC_ISSUER = if ($env:OIDC_ISSUER) { $env:OIDC_ISSUER } elseif ($env:VITE_SUPABASE_URL) { "$($env:VITE_SUPABASE_URL.TrimEnd('/'))/auth/v1" } else { "" }
$env:OIDC_AUDIENCE = if ($env:OIDC_AUDIENCE) { $env:OIDC_AUDIENCE } else { "authenticated" }
$env:VITE_MFE_STUDENT_URL = "http://127.0.0.1:4173"
$env:VITE_MFE_INSTITUTION_URL = "http://127.0.0.1:4175"
$env:VITE_MFE_ACTIVITY_URL = "http://127.0.0.1:4176"
$env:VITE_MFE_DASHBOARD_URL = "http://127.0.0.1:4178"
$env:VITE_MFE_ADMIN_URL = "http://127.0.0.1:4179"
$env:MFE_HOST_ORIGINS = "http://localhost:4174"

$providers = @(
  @{ Name = "student"; AppName = "mfe-student"; ModuleName = "student"; Port = 4173 },
  @{ Name = "institution"; AppName = "mfe-institution"; ModuleName = "institution"; Port = 4175 },
  @{ Name = "activity"; AppName = "mfe-activity"; ModuleName = "activity"; Port = 4176 },
  @{ Name = "dashboard"; AppName = "mfe-dashboard"; ModuleName = "dashboard"; Port = 4178 },
  @{ Name = "admin"; AppName = "mfe-admin"; ModuleName = "admin"; Port = 4179 }
)

Push-Location $root
try {
  npm run build --workspace=@mfe/shared
  if ($LASTEXITCODE -ne 0) { throw "Shared package build failed." }

  npm run build --workspace=mfe-host --ignore-scripts
  if ($LASTEXITCODE -ne 0) { throw "Host build failed." }

  npm run build:module --workspaces --if-present --ignore-scripts
  if ($LASTEXITCODE -ne 0) { throw "Remote module builds failed." }
} finally {
  Pop-Location
}

if (-not (Test-Path (Join-Path $backend "go.mod"))) {
  throw "Backend repository not found at $backend. Clone https://github.com/fidelis27/secretaria-backend beside this repository."
}
if (-not (Get-NetTCPConnection -LocalPort 3333 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backend'; go run ./cmd/server" | Out-Null
  Write-Host "Started backend on port 3333"
}

foreach ($provider in $providers) {
  if (Get-NetTCPConnection -LocalPort $provider.Port -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "$($provider.Name): port $($provider.Port) already in use; skipping"
    continue
  }

  $modulesPath = Join-Path (Join-Path $packages $provider.AppName) "dist\modules"
  $command = "Set-Location '$root'; node ./scripts/module-serve.mjs '$modulesPath' '$($provider.AppName)' '$($provider.ModuleName)' '$($provider.Port)' 'http://localhost:4174'"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $command | Out-Null
  Write-Host "Started $($provider.Name) module provider on port $($provider.Port)"
}

if (-not (Get-NetTCPConnection -LocalPort 4174 -State Listen -ErrorAction SilentlyContinue)) {
  $hostPackage = Join-Path $packages "host"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$hostPackage'; npx vite preview --host 127.0.0.1 --port 4174 --strictPort" | Out-Null
  Write-Host "Started host preview on port 4174"
}

$healthUrl = "http://localhost:$($env:PORT)/health"
$healthReady = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
  try {
    $health = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($health.StatusCode -eq 200) {
      $healthReady = $true
      break
    }
  } catch {
    # The Go process may still be compiling or waiting for MariaDB.
  }
  Start-Sleep -Seconds 1
}

if (-not $healthReady) {
  throw "Backend did not become healthy at $healthUrl. Check MariaDB and the backend terminal."
}

Write-Host "Host: http://localhost:4174/"
Write-Host "Stop services with: .\scripts\stop-local.ps1"
