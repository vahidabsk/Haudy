# Haudy Standalone Windows Build

Haudy uses a native Tauri desktop wrapper. The Windows build contains the Haudy application and opens in its own desktop window. It does not launch a browser tab, run a local Python server, or require Node.js or Rust on the computers where it is installed.

## Build computer requirements

Build the installer on a 64-bit Windows computer with:

1. Node.js LTS
2. Rustup using the **MSVC** toolchain
3. Microsoft C++ Build Tools with the **Desktop development with C++** workload

The build script configures the MSVC Rust toolchain, installs JavaScript dependencies, and creates the installer.

## Create the installer

1. Extract the Haudy Suite source ZIP on the Windows build computer.
2. Install the three build requirements above.
3. Open the extracted Haudy folder.
4. Double-click `build_windows.bat`.
5. After the build completes, open `src-tauri\target\release\bundle\nsis\`.
6. Distribute and run the generated `Haudy Audit Suite_1.1.2_x64-setup.exe`.

The installer uses the current-user installation mode, so it normally does not require administrator rights. It includes the offline WebView2 installer; therefore, it can install on a supported Windows computer even when the target device does not have internet access.

## Target computer requirements

The target computer needs only a supported 64-bit Windows version. Node.js, Rust, Python, and a browser are not required. The installed application uses its own desktop window.

Haudy data remains on the local Windows user profile and in the Haudy Database folder selected by the auditor. Keep the database folder in the organization-approved storage location and include it in normal backups.
