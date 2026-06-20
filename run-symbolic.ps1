# run-symbolic.ps1
# One-shot setup + launch for the Symbolic app on Windows.
# Usage: right-click > "Run with PowerShell", or in a PowerShell window:
#   powershell -ExecutionPolicy Bypass -File .\run-symbolic.ps1

$ErrorActionPreference = 'Stop'

$RepoUrl   = 'https://github.com/denrod25-del/symbolic.git'
$Branch    = 'claude/gohighlevel-platform-overview-htr0o9'
$TargetDir = Join-Path $HOME 'symbolic'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; Read-Host 'Press Enter to exit'; exit 1 }

# 1. Prerequisites
Write-Step 'Checking prerequisites (git, node, npm)'
if (-not (Get-Command git -ErrorAction SilentlyContinue))  { Fail 'Git is not installed. Get it from https://git-scm.com/download/win then re-run.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js is not installed. Get the LTS (22+) from https://nodejs.org then re-run.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue))  { Fail 'npm was not found (it ships with Node.js). Reinstall Node.js from https://nodejs.org.' }

$nodeMajor = (& node -p "process.versions.node.split('.')[0]")
if ([int]$nodeMajor -lt 22) { Fail "Node.js $nodeMajor detected, but 22+ is required. Update from https://nodejs.org." }
Write-Host ("git {0} / node {1} / npm {2}" -f (git --version), (node -v), (npm -v))

# 2. Clone (or reuse) and switch to the branch
if (Test-Path (Join-Path $TargetDir '.git')) {
  Write-Step "Repo already present at $TargetDir - updating"
  Set-Location $TargetDir
  git fetch origin $Branch
} else {
  Write-Step "Cloning into $TargetDir (you may be prompted to sign in to GitHub)"
  git clone $RepoUrl $TargetDir
  Set-Location $TargetDir
  git fetch origin $Branch
}
git checkout $Branch
git pull origin $Branch

# 3. Environment file
$envLocal = Join-Path $TargetDir '.env.local'
if (-not (Test-Path $envLocal)) {
  Write-Step 'Creating .env.local (placeholder Brave key - live search needs a real one)'
  Copy-Item (Join-Path $TargetDir '.env.local.example') $envLocal
  (Get-Content $envLocal) -replace 'your_brave_api_key_here', 'dev-placeholder' | Set-Content $envLocal
} else {
  Write-Step '.env.local already exists - leaving it as is'
}

# 4. Install dependencies
Write-Step 'Installing dependencies (npm install) - this can take a few minutes'
npm install

# 5. Launch, and open the browser once the server is up
Write-Step 'Starting the dev server at http://localhost:3000'
Write-Host 'The first compile takes ~10s. Press Ctrl+C in this window to stop the server.' -ForegroundColor Yellow
Start-Job -ScriptBlock {
  for ($i = 0; $i -lt 60; $i++) {
    try { if ((Invoke-WebRequest 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { Start-Process 'http://localhost:3000'; break } } catch {}
    Start-Sleep -Seconds 2
  }
} | Out-Null

npm run dev
