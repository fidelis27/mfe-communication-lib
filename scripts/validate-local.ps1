$ErrorActionPreference = "Stop"

$apiBase = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { "http://localhost:3333" }
$accessToken = $env:SUPABASE_ACCESS_TOKEN
$origin = if ($env:CHECK_ORIGIN) { $env:CHECK_ORIGIN } else { "http://localhost:4174" }

function Assert-Equal([int] $actual, [int] $expected, [string] $check) {
  if ($actual -ne $expected) {
    throw "${check}: expected HTTP $expected, got HTTP $actual"
  }
  Write-Host "PASS $check ($actual)"
}

function Get-Status([string] $uri, [hashtable] $headers = @{}, [string] $method = "GET") {
  try {
    return (Invoke-WebRequest -Uri $uri -Headers $headers -Method $method -UseBasicParsing -ErrorAction Stop).StatusCode
  } catch {
    if ($_.Exception.Response) {
      return [int]$_.Exception.Response.StatusCode
    }
    throw "Could not reach ${uri}: $($_.Exception.Message)"
  }
}

Assert-Equal (Get-Status "$apiBase/health") 200 "backend health"
Assert-Equal (Get-Status "$apiBase/institutions") 401 "protected API without identity"
Assert-Equal (Get-Status "http://localhost:4174/") 200 "host preview"

if ($accessToken) {
  $authHeaders = @{ Authorization = "Bearer $accessToken" }
  Assert-Equal (Get-Status "$apiBase/metrics" $authHeaders) 200 "authenticated metrics"
} else {
  Write-Warning "Authenticated API and WebSocket checks skipped; set SUPABASE_ACCESS_TOKEN to a valid access token."
}

$corsHeaders = @{
  Origin = $origin
  "Access-Control-Request-Method" = "GET"
}
Assert-Equal (Get-Status "$apiBase/students" $corsHeaders "OPTIONS") 204 "CORS preflight"

$moduleProviders = @(
  @{ Name = "student"; AppName = "mfe-student"; Port = 4173 },
  @{ Name = "institution"; AppName = "mfe-institution"; Port = 4175 },
  @{ Name = "activity"; AppName = "mfe-activity"; Port = 4176 },
  @{ Name = "dashboard"; AppName = "mfe-dashboard"; Port = 4178 },
  @{ Name = "admin"; AppName = "mfe-admin"; Port = 4179 }
)
foreach ($provider in $moduleProviders) {
  $manifestUrl = "http://localhost:$($provider.Port)/api/modules/__modules_configuration"
  $manifest = Invoke-RestMethod -Uri $manifestUrl -Headers @{ Origin = $origin }
  if ($manifest.appName -ne $provider.AppName -or -not ($manifest.modules.PSObject.Properties.Name -contains $provider.Name)) {
    throw "$($provider.Name) manifest did not publish the expected application and module."
  }
  $assetPath = $manifest.modules.($provider.Name).scripts[0]
  $assetUrl = "http://localhost:$($provider.Port)$assetPath"
  Assert-Equal (Get-Status $assetUrl @{ Origin = $origin }) 200 "$($provider.Name) module asset"
  Assert-Equal (Get-Status $manifestUrl @{ Origin = $origin } "OPTIONS") 204 "$($provider.Name) manifest CORS"
}

if ($accessToken) {
  $socket = [System.Net.WebSockets.ClientWebSocket]::new()
  $socket.Options.AddSubProtocol("bearer.$accessToken")
  $socketUri = [Uri](($apiBase -replace '^http', 'ws') + "/events")
  try {
    $socket.ConnectAsync($socketUri, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    if ($socket.State -ne [System.Net.WebSockets.WebSocketState]::Open) {
      throw "WebSocket did not reach Open state"
    }
    Write-Host "PASS backend WebSocket (Open)"
  } finally {
    if ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
      try {
        $socket.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "validation", [Threading.CancellationToken]::None).GetAwaiter().GetResult()
      } catch {
        Write-Host "WebSocket close cleanup skipped: $($_.Exception.Message)"
      }
    }
    $socket.Dispose()
  }
}

if ($accessToken) {
  Write-Host "Local validation completed successfully."
} else {
  Write-Warning "Local validation completed with authenticated API/WebSocket checks skipped."
}
