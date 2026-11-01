# Changelog

## 1.0.0 — 2026-11-01

- Publish Sidecar, a window plugin that opens or focuses one companion shell, switches between paired panes, and clears stale pairing metadata when either pane closes.
- Build the plugin directory and detail pages from real package manifests and README metadata.
- Add search, category filtering, empty states, install-command copying, responsive navigation, controlled canvas lights, and reduced-motion support.
- Validate package files, manifest fields, safe paths, documentation URLs, and generated pages for root and project-path deployments.
- Check pull requests without deployment; publish successful main-branch builds through GitHub Actions and GitHub Pages.

Sidecar was installed from its public GitHub subdirectory and exercised in an isolated real Tern 0.9.9 window on macOS. Opening a companion changed the pane count from one to two; switching returned focus to the source; repeated opening reused the existing companion; closing either side and opening again created a valid new pair. Other operating systems were not runtime-tested. The website's search, empty state, filtering, detail page, clipboard, mobile navigation, particles, and reduced-motion behavior were exercised in Chromium.
