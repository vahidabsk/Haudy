@echo off
setlocal EnableExtensions

echo.
echo Building Haudy Audit Suite for Windows...
echo.

where node >nul 2>nul || (
  echo Node.js LTS is required. Install it, restart Command Prompt, and run this file again.
  pause
  exit /b 1
)

where rustup >nul 2>nul || (
  echo Rustup is required. Install Rust with the MSVC toolchain, restart Command Prompt, and run this file again.
  pause
  exit /b 1
)

call rustup default stable-msvc
if errorlevel 1 (
  echo Could not activate the Rust MSVC toolchain.
  pause
  exit /b 1
)

call corepack enable
if errorlevel 1 (
  echo Corepack could not be enabled. Reinstall Node.js LTS and run this file again.
  pause
  exit /b 1
)

call pnpm install --frozen-lockfile
if errorlevel 1 (
  echo Dependency installation failed.
  pause
  exit /b 1
)

call pnpm dlx @tauri-apps/cli@^2 build --bundles nsis
if errorlevel 1 (
  echo.
  echo Build failed. Confirm that Microsoft C++ Build Tools with Desktop development with C++ is installed.
  pause
  exit /b 1
)

echo.
echo Done.
echo The standalone Windows installer is in:
echo src-tauri\target\release\bundle\nsis\
echo.
echo Install the generated -setup.exe file on the target Windows PC.
pause
