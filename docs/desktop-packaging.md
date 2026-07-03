# Haudy Desktop Packaging

Haudy now has a Tauri desktop wrapper for Windows and macOS.

## Build in GitHub

The recommended way to create installers is GitHub Actions:

1. Push the project to GitHub.
2. Open the **Actions** tab.
3. Select **Build Desktop Packages**.
4. Click **Run workflow**.
5. Download the generated artifacts:
   - Windows package: `.msi` or `.exe`
   - macOS package: `.dmg`

The workflow can also run automatically when a tag starts with `desktop-v`, for example:

```sh
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

## Build on a Mac

Local desktop builds require Rust and Tauri dependencies:

```sh
pnpm install
pnpm tauri:build
```

The Tauri command is downloaded only when you run a desktop build, so the normal Render web deployment stays separate from desktop packaging.

The macOS package will be created under:

```text
src-tauri/target/release/bundle/
```

## Notes

- The normal Render web deployment is still supported.
- The desktop app uses the same Haudy user interface and local browser storage behavior.
- Windows packages should be built on Windows or through the GitHub workflow.
