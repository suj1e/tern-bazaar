# Tern Bazaar

An independent, open-source collection of small Tern plugins and the static directory at **https://ternbazaar.beer**. This project is maintained by the community, not Stencil. It is not an official registry, native marketplace subscription, or automatic updater.

## The collection

| Plugin | What it does | Runtime |
| --- | --- | --- |
| [Sidecar](plugins/sidecar/README.md) | Opens one companion shell per source pane and switches focus between the pair without creating duplicates | Window only |

```sh
tern plugin install github.com/suj1e/tern-bazaar/plugins/sidecar
```

The folder is part of the source. Installing the repository root will not work: it intentionally has no root `plugin.toml`. GitHub installation requires Git on PATH and fetches the default branch.

See [Sidecar's README](plugins/sidecar/README.md) for exact palette commands, platform coverage, API references, behavior disclosures and hands-on acceptance steps. Tern plugins are trusted code with your account's access. Read the implementation before installing; disclosures are not a sandbox enforced by the host.

Update manually after reviewing changes:

```sh
tern plugin install github.com/suj1e/tern-bazaar/plugins/sidecar --force
```

Tern does not compare versions, resolve dependencies, or update automatically. For a pinned revision, clone this repository, check out your chosen commit or tag, and install the local package folder. Unlink a linked development package before replacing it with an installed copy.

## Develop the website

Use Node.js 22 and npm:

```sh
npm ci
npm run check
npm run build
```

`dist/` is the deployable static site and is not committed. You can serve it with any static HTTP server. There are no backend services, analytics, remote fonts, accounts, payments, or externally fetched plugin data in the build.

For a GitHub project URL rather than the custom domain:

```sh
BASE_PATH=/tern-bazaar/ npm run build
```

All generated local page and asset links include that prefix. The default/custom-domain build has an empty prefix. `site.config.mjs` is the canonical domain and repository configuration. A root build emits `CNAME`; a project-path build does not. The sitemap and robots URL follow the configured domain and prefix.

### What the checks exercise

Node's built-in test runner parses real TOML and README metadata, validates entry and documentation files, and renders HTML for root and project-path deployments. DOM-based tests check page structure, control names and labels, canonical URLs, duplicate IDs, internal links and anchors, and assets. Temporary package fixtures exercise missing entries, unknown manifest keys, traversal and symlink escapes, invalid versions, conflicting identities, unsafe documentation URLs, and missing local resources. Rendering escapes raw README HTML.

These checks **do not execute Luau or prove runtime loading**. They never download or execute an external plugin. Real Tern acceptance is separate and belongs in a deliberately isolated environment, below.

## Validate Sidecar without touching your usual Tern session

The SDK documents `TERN_CONFIG_DIR` as overriding both config and state, `TERN_DAEMON_SOCKET` as selecting a separate session daemon, and `STENCIL_LOG_DIR` as redirecting logs. Use all three. Run the following from this repository in a fresh terminal shell (or a subshell):

```sh
export TERN_BAZAAR_TEST_DIR="$(mktemp -d /tmp/tern-bazaar.XXXXXX)"
printf '%s\n' "$TERN_BAZAAR_TEST_DIR"
export TERN_CONFIG_DIR="$TERN_BAZAAR_TEST_DIR/config"
export TERN_DAEMON_SOCKET="$TERN_BAZAAR_TEST_DIR/daemon.sock"
export STENCIL_LOG_DIR="$TERN_BAZAAR_TEST_DIR/logs"
export STENCIL_LOG="warn,stencil=info,tern::plugin=debug"
tern plugin link "$PWD/plugins/sidecar"
tern plugin list --json
tern --control "$TERN_BAZAAR_TEST_DIR/control.sock" "$TERN_BAZAAR_TEST_DIR"
```

The last command launches an **ordinary real window** and its isolated daemon. Keep it open. In a second terminal, set `TERN_BAZAAR_TEST_DIR` to the printed directory from the first terminal, then run:

```sh
tern ctl --control "$TERN_BAZAAR_TEST_DIR/control.sock" state
tern ctl --control "$TERN_BAZAAR_TEST_DIR/control.sock" plugins run plugin.sidecar.open_right
tern ctl --control "$TERN_BAZAAR_TEST_DIR/control.sock" state
tern ctl --control "$TERN_BAZAAR_TEST_DIR/control.sock" plugins run plugin.sidecar.switch_pair
tern ctl --control "$TERN_BAZAAR_TEST_DIR/control.sock" state
tern ctl --control "$TERN_BAZAAR_TEST_DIR/control.sock" plugins run plugin.sidecar.open_below
tern ctl --control "$TERN_BAZAAR_TEST_DIR/control.sock" state
```

Expected observations: the first open adds exactly one shell pane on the right; switch changes focus to the original pane; the final open focuses the already paired sidecar without increasing the pane count. Use the window's Preferences / Plugins to confirm that its window entry is Ready, and inspect its toasts and isolated logs for loading or command failures. `plugin list` shows the host catalog: Ready there alone does not establish that window code ran. Complete the close/reopen and reload checks in [the package README](plugins/sidecar/README.md).

When finished, `tern ctl --control "$TERN_BAZAAR_TEST_DIR/control.sock" quit` closes the isolated window. An isolated daemon may remain; stop only the process associated with your test socket before removing the temporary directory. Do not stop the user's normal daemon. Exit the shell/subshell to discard the exported environment. The linked package remains only in the temporary config directory.

**Do not substitute `tern serve` or `tern shot` for this runtime check.** Headless runs disable ordinary plugins. `plugins fixtures` loads Tern's own source-tree test fixtures, not this package. This limitation and `plugins run` are documented in the [debugging guide](https://docs.stencil.so/tern/guides/debugging.md), [scripts guide](https://docs.stencil.so/tern/scripts/index.md), and [directory reference](https://docs.stencil.so/tern/concepts/packages.md#directories).

### Runtime verification

Sidecar 1.0.0 was exercised in an isolated Tern 0.9.9 window on macOS. Opening a sidecar changed the pane count from one to two; switching changed focus back to the source; opening again reused the same companion. Closing the companion, reopening below, and closing the source all cleared pairing state correctly. Installation from the public GitHub subdirectory also succeeded. This does not establish runtime testing on Windows, Linux, or iOS.


## Add or change a plugin

1. Create a complete package under `plugins/<id>/`. Keep the directory and manifest `id` equal. Use a schema-1 manifest, a unique name, a semantic version, a one-line description, and real `host` and/or `window` Luau entries. Manifest keys must match the [upstream reference](https://docs.stencil.so/tern/reference/manifest.md); arbitrary catalog keys do not belong in `plugin.toml`.
2. Put `README.md` and `LICENSE` inside the package so installation carries the documentation and license. Start the README with a `<!-- bazaar` TOML comment like Sidecar's. Catalog fields are `category`, `platforms`, `dependencies`, `permissions`, and `api`. Keep identity, version, description and entry points **only in the manifest**; those values are read directly by the directory generator.
3. Include the sections `Install`, `Use`, `Verify in a real Tern window`, `Updates and removal`, and `API and trust`. The install command must point to `github.com/suj1e/tern-bazaar/plugins/<id>`. Explain exact triggers, expected results, supported runtime halves, dependencies, trust and platform limitations. Distinguish SDK capability from hands-on platform testing.
4. Implement a useful behavior using documented APIs. Do not submit empty handlers, demonstration-only placeholders, fabricated plugins, made-up ratings, download counts, or compatibility claims. Keep the default branch installable, bump the package version when behavior changes, and keep release tags for users who pin revisions.
5. Run the three npm commands above, then load and trigger the package in an isolated real Tern window. Include observable results in your pull request. Site checks must not run plugin code or untrusted processes during pull-request builds.

`smol-toml` parses manifests and README metadata; `marked` renders README documentation with raw HTML escaped; `parse5` is test-only. Dependencies are exact-version pinned in the npm lockfile. The generator only reads local packages. No separate hand-written listing inventory can drift from them.

## Pages and domain setup

The workflow uses Node 22, `npm ci`, metadata/DOM tests, and a static build. Pull requests only check/build. Successful `main` builds and manual runs on `main` upload and deploy through the official GitHub Pages actions, using the `github-pages` environment and serialized deployment concurrency. No DNS credentials or plugin execution are part of CI.

Repository settings must enable GitHub Pages with **GitHub Actions**, set the custom domain to `ternbazaar.beer`, and point that domain's DNS to GitHub Pages. DNS and GitHub account settings are external prerequisites, not handled by the static build. Enable HTTPS when GitHub's certificate is ready.

The separate **Finalize HTTPS** workflow runs after successful Pages deployments, hourly, and on manual dispatch. It enables HTTPS only after GitHub reports an issued certificate, verifies the saved setting, and records pending issuance in its job summary. It needs only the repository's scoped GitHub token, not DNS credentials, and makes no changes when HTTPS is already enforced.

## Design decisions

Tern Bazaar is the sea-glass sibling of [omp Bazaar](https://ompbazaar.beer): deep blue `#101c38`, layered blue `#17234d`, clear text `#eff2fa`, muted text `#a4aec5`, and sea glass `#a5d9cd`. Iowan Old Style / Palatino / Georgia carry the spacious, left-aligned headlines; system sans keeps working text clear. A gently tilted two-pane workspace is the one expressive motif. The collection is an editorial list, not a fabricated wall of inventory cards. Twenty-six restrained canvas lights pause in hidden tabs, cap device pixel ratio, and turn off for reduced motion. Search and filters update without animation, keyboard focus is visible, and copy operations report both success and failure.

## License

MIT, including the Sidecar package. Tern and Stencil names belong to their respective owners; no affiliation is implied.
