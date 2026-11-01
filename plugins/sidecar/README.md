<!-- bazaar
category = "Window workflow"
platforms = ["macOS", "Linux", "Windows", "iOS"]
dependencies = ["Tern with the documented window layout API", "Git on PATH for GitHub CLI installation"]
permissions = ["Reads focused pane identifiers", "Opens an interactive shell on the source pane's host", "Changes focus within the current window", "Keeps pane pair identifiers in memory only"]
api = "https://docs.stencil.so/tern/reference/api-window.md"
-->

# Sidecar

Keep a small shell beside the pane you are working in. Open it once, return to it without creating duplicates, and switch back to your original pane.

## Install

```sh
tern plugin install github.com/suj1e/tern-bazaar/plugins/sidecar
```

This is a **window-only** plugin. Install it on the machine displaying your Tern window, not on a remote server just because its panes are remote. A sidecar shell inherits the source pane's host and working directory through Tern's `cx.layout:split`; it does not interpret or inject shell commands. A source with an unknown directory follows Tern's normal split-directory behavior.

The window API is documented for macOS, Linux, Windows and iOS. These are SDK-supported platforms, not a claim of hands-on testing on every platform. The web client runs no window plugins. On iOS, copy this package folder into Tern's `Documents/Plugins` with Files and reload plugins; the CLI install command is desktop-only.

## Use

- In the command palette, choose **Sidecar / Open or focus sidecar on the right** or **Open or focus sidecar below**. A normal interactive shell opens and receives focus.
- Choose **Switch between paired panes**, or press `ctrl+alt+shift+j`, to return to the source. Repeat to go back to the sidecar.
- Run either open command again from either member of the pair to focus the same sidecar. The chosen direction only affects a newly created pair; it does not move an existing sidecar.
- Close a sidecar normally when finished. Its source stays open. Closing the source also leaves its sidecar running as an ordinary unpaired shell.

The plugin never closes panes, reads or writes files, contacts the network, uses the clipboard, or calls `tern.process`. Opening a shell still runs your normal shell startup files. A layout split is a session change visible in other windows attached to the session; focus and pairing are per window.

## Verify in a real Tern window

From this repository's root:

```sh
tern plugin link ./plugins/sidecar
tern plugin list --json
```

If an installed `sidecar` already exists, remove that installed copy before linking, or use installation instead. Keep a Tern desktop window open and confirm `sidecar` is Ready in Preferences / Plugins. Then:

1. Focus a shell in a known directory and select **Open or focus sidecar on the right**. Confirm exactly one new interactive shell appears on the right, on the same host, in that directory. Run `pwd` (or `Get-Location` in PowerShell) yourself to observe it.
2. Select **Switch between paired panes**. Confirm focus returns to the original pane; select it again and confirm focus returns to the sidecar.
3. From the source, select **Open or focus sidecar below**. Confirm it focuses the existing sidecar and does not add a third pane.
4. Close the sidecar normally, focus the source and choose the below command again. Confirm one new shell opens below. Close the source and confirm the shell is not closed by the plugin.
5. Open a fresh unpaired pane, choose **Switch between paired panes**, and confirm the explanatory toast appears without changing the layout.
6. Reload plugins. Existing shells must remain open; pair associations intentionally reset. The next open command makes a new pair, so close an old unpaired sidecar yourself if it is no longer useful.

A keyboard preset or your own binding may reserve the default chord. The palette always works. Bind the action `plugin.sidecar.switch_pair` in Tern settings if you prefer another chord. The other action IDs are `plugin.sidecar.open_right` and `plugin.sidecar.open_below`.

After development, run `tern plugin unlink sidecar`. Linking is live and package edits reload the plugin; an installed copy cannot replace a link.

## Updates and removal

```sh
tern plugin install github.com/suj1e/tern-bazaar/plugins/sidecar --force
tern plugin remove sidecar
```

Updates are manual. Tern does not resolve dependencies, compare versions, subscribe to this directory, or update plugins automatically. Pair associations reset on reload and are not restored across windows or app restarts. Panes remain normal session panes.

## API and trust

Implementation uses documented `tern.command`, `tern.on("pane_closed")`, `cx.session:focused()`, `cx.layout:split`, `cx.layout:focus` and `cx:toast`. See the [window API](https://docs.stencil.so/tern/reference/api-window.md), [layout guide](https://docs.stencil.so/tern/guides/layout.md), and [support matrix](https://docs.stencil.so/tern/concepts/support-matrix.md).

Tern plugins are trusted code, not sandboxed permission bundles. The permissions listed here describe this implementation, not restrictions enforced by Tern. Review `window.luau` before installation. MIT licensed; see `LICENSE` in this package.
