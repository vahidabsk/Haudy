export function isDesktopApp() {
  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
    || navigator.userAgent.toLowerCase().includes("tauri")
    || window.location.protocol === "tauri:"
    || window.location.hostname === "tauri.localhost";
}
