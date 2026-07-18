# Haudy Desktop Packaging

Haudy uses a Tauri desktop wrapper for Windows. It packages the application as a native Windows installer that opens in its own desktop window, not a browser tab.

## Build in GitHub

The recommended way to create installers is GitHub Actions:

1. Push the project to GitHub.
2. Open the **Actions** tab.
3. Select **Build Desktop Packages**.
4. Click **Run workflow**.
5. Download the generated Windows artifact:
   - Windows package: `.msi` or `.exe`

The workflow can also run automatically when a tag starts with `desktop-v`, for example:

```sh
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

Tagged desktop builds also publish a GitHub Release. Haudy's Patch button opens the latest release page so users can download and install the newest package.

## Build on Windows

For the local standalone installer, use `build_windows.bat`. The Windows build computer needs Node.js LTS, Rustup with the MSVC toolchain, and Microsoft C++ Build Tools with **Desktop development with C++**. See [Windows Standalone Build](windows-standalone-build.md) for the full procedure.

The Windows package will be created under:

```text
src-tauri/target/release/bundle/
```

## Notes

- The normal Render web deployment is still supported.
- The desktop app uses the same Haudy user interface and local browser storage behavior.
- Windows packages can be built through the GitHub workflow or locally with `build_windows.bat`.
