@echo off
setlocal
cd /d "%~dp0"

where gh >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI ^(gh^) is required. Install it from https://cli.github.com/ and sign in once with: gh auth login
  pause
  exit /b 1
)

gh auth status --hostname github.com >nul 2>nul
if errorlevel 1 (
  echo Sign in to GitHub once with: gh auth login
  pause
  exit /b 1
)

echo Starting the production deployment workflow for the latest pushed main branch...
gh workflow run deploy-production.yml --repo alimranniloy/Tiwlo-2.0 --ref main
if errorlevel 1 (
  echo Deployment could not be started. Check that the workflow is pushed and configured.
  pause
  exit /b 1
)

start "" "https://github.com/alimranniloy/Tiwlo-2.0/actions/workflows/deploy-production.yml"
echo GitHub Actions is deploying Tiwlo. Review the run in the browser window.
pause
